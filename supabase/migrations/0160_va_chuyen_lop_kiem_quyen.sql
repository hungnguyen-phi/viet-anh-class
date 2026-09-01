-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VÁ LỖ: apply_class_transfer gọi được KHÔNG CẦN QUYỀN (phát hiện 01/09/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- apply_class_transfer(p_student, p_to_class) là bước THỰC THI của việc chuyển lớp: tắt ghi danh
-- lớp cũ, tắt buddy/lịch PDR cũ, bật ghi danh lớp mới. Hai CỬA CHÍNH THỨC gọi nó — request (đường
-- quản trị) và decide (đường GVCN lớp nhận, 0089) — đều kiểm quyền đầy đủ TRƯỚC khi gọi.
--
-- Nhưng chính hàm này lại là CỬA SAU KHÔNG KHOÁ: nó SECURITY DEFINER, và `EXECUTE` vẫn mở cho
-- `anon` lẫn `authenticated` (mặc định Postgres cấp cho PUBLIC lúc tạo hàm; revoke ở 0089 không
-- còn hiệu lực sau lần create-or-replace ở 0151). Hệ quả đo được trên production 01/09/2026:
-- has_function_privilege('anon', ...) = true. Nghĩa là BẤT KỲ AI — kể cả một học sinh đã đăng
-- nhập — gọi thẳng RPC này là chuyển được học sinh bất kỳ sang lớp bất kỳ, không dấu vết, không ai
-- duyệt. Đây là lỗ quyền thật, KHÔNG liên quan gì tới việc xây lại mô hình mục tiêu.
--
-- HAI LỚP CHẶN, làm cùng lúc vì mỗi lớp bịt một đường:
--
-- ① THU HỒI EXECUTE khỏi public/anon/authenticated. Đây là bản vá thật sự. Hai cửa chính thức
--    KHÔNG gãy: request/decide đều SECURITY DEFINER, nên lời gọi `perform apply_class_transfer(...)`
--    bên trong chúng chạy với quyền của CHỦ HÀM, không phải quyền của người đăng nhập — thu quyền
--    của authenticated không đụng tới đường hợp lệ. Sau vá, không vai PostgREST nào gọi thẳng được.
--
-- ② THÊM KIỂM QUYỀN NGAY TRONG HÀM (phòng thân). Nếu mai này ai đó lỡ grant execute lại (một dòng
--    `grant ... to authenticated` quét cả schema là đủ), thì hàm vẫn tự từ chối người không phải
--    GVCN lớp nhận / quản trị / hiệu trưởng cơ sở. Kiểm này KHỚP đúng luật của cửa decide (0089):
--    ai duyệt được việc chuyển vào lớp đích thì mới thực thi được. Với đường admin, auth_role()
--    ='admin' cho qua; với đường decide, người gọi là GVCN lớp nhận nên is_class_teacher(p_to_class)
--    cho qua — cả hai đường hợp lệ đều lọt, chỉ cửa sau bị bịt.
--
-- Đọc pg_proc production trước khi đè (đã đọc 01/09: bản đang chạy là bản 0151, không có kiểm quyền).

create or replace function public.apply_class_transfer(p_student uuid, p_to_class uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- ② Phòng thân: chỉ quản trị, GVCN lớp nhận, hoặc hiệu trưởng cơ sở của lớp nhận mới thực thi.
  --    Trùng đúng luật cửa decide_class_transfer (0089). Lời gọi nội bộ từ request/decide (đường
  --    admin và đường GVCN lớp nhận) đều thoả điều kiện này.
  if not (
    auth_role() = 'admin'
    or is_class_teacher(p_to_class)
    or exists (select 1 from classes c where c.id = p_to_class
               and auth_role() = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp nhận (hoặc quản trị) mới chuyển lớp được'
      using errcode = '42501';
  end if;

  update enrollments set is_active = false, is_attendance_leader = false
  where student_id = p_student and is_active and class_id <> p_to_class;

  -- Buddy + lịch PDR của các lớp em đang rời: tắt, đừng để treo ở lớp cũ (giữ nguyên hành vi 0151).
  update buddy_pairs set is_active = false
    where is_active and class_id <> p_to_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id <> p_to_class and student_id = p_student;

  insert into enrollments (class_id, student_id, is_active)
  values (p_to_class, p_student, true)
  on conflict (class_id, student_id) do update set is_active = true;
end;
$function$;

-- ① Thu hồi execute khỏi mọi vai PostgREST. Chủ hàm vẫn chạy được → request/decide vẫn hoạt động.
revoke all on function public.apply_class_transfer(uuid, uuid) from public, anon, authenticated;
