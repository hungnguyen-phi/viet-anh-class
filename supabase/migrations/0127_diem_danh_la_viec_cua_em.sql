-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0127 — ĐIỂM DANH LÀ VIỆC CỦA EM. TỔ TRƯỞNG CHỈ NHẮC. BGH/ADMIN MỚI SỬA ĐƯỢC.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Vòng comment PRD v3 của anh Nguyễn Mạnh Dương, chủ dự án đã chấp nhận:
--
--   "Cần bắt buộc mỗi học sinh phải tự điểm danh để check in cảm xúc, Attendance leader chỉ nhắc,
--    không điểm danh thay, ai không điểm danh thì mặc định là vắng"
--
-- kèm một suggestion XOÁ hẳn dòng "GVCN được sửa/bổ sung trong 7 ngày gần nhất". Và chủ dự án
-- chốt tiếp 14/08/2026 khi tôi hỏi ai sửa được một ngày ghi nhầm: "bgh, admin sửa được".
--
-- ── BỐN THỨ ĐỔI ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Check-in của em LUÔN ghi điểm danh. Trước đây nó chỉ ghi khi trường đã khai mạng
--    (truong_da_khai_mang); chưa khai thì check-in chỉ là cảm xúc, còn điểm danh vẫn chờ tay
--    người tick. Nay em tự điểm danh là luật, không phải một tính năng bật kèm wifi. Việc chặn
--    theo IP vẫn nguyên chỗ cũ — nó là chống gian lận, không phải điều kiện để tồn tại.
--
-- 2. Check-in BUỔI CHIỀU cũng ghi điểm danh, nhưng chỉ khi ngày ấy CHƯA có gì. Em quên buổi sáng
--    mà chiều vẫn tới lớp thì "muộn" là câu đúng; "vắng" là câu sai. Và không bao giờ hạ một dòng
--    'present' đã có xuống 'late'.
--
-- 3. Tổ trưởng và GVCN THÔI ghi. Tổ trưởng còn đúng một việc: nhìn ai chưa check-in để đi nhắc —
--    quyền ĐỌC giữ nguyên. Cửa sổ bù 7 ngày của GVCN đóng lại.
--
-- 4. VẮNG LÀ MẶC ĐỊNH, và KHÔNG có dòng nào được đẻ ra cho nó. Không dòng = chưa check-in = vắng.
--    Đẻ hàng loạt dòng 'absent' mỗi tối là bịa ra một hành động chưa ai làm, và ngày mai em đi
--    học thật thì hồ sơ đã có sẵn một câu nói dối phải đi sửa.

-- ── 1. CHECK-IN LUÔN LÀ ĐIỂM DANH ──────────────────────────────────────────────────────────
create or replace function public.student_checkin(p_student uuid, p_mood mood_level, p_ip text, p_buoi text default 'sang')
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_class uuid; v_campus uuid; v_da_khai boolean;
  v_hom_nay date := vn_today();
  w record;
  v_bay_gio timestamptz := now();
begin
  v_da_khai := truong_da_khai_mang();
  -- Chặn theo IP giữ nguyên: chỉ áp khi trường đã khai mạng, và nó chặn TRƯỚC mọi thứ.
  if v_da_khai and not ip_allowed(p_ip) then
    return 'blocked';
  end if;

  select e.class_id, c.campus_id into v_class, v_campus
  from enrollments e join classes c on c.id = e.class_id
  where e.student_id = p_student and e.is_active limit 1;

  if v_class is null then
    insert into mood_checkins (student_id, class_id, date, mood, buoi)
      values (p_student, null, v_hom_nay, p_mood, coalesce(p_buoi,'sang'))
      on conflict (student_id, date, buoi) do update set mood = excluded.mood, updated_at = now();
    return 'no_class';
  end if;

  select * into w from checkin_windows(v_campus);

  if coalesce(p_buoi,'sang') = 'chieu' then
    if v_bay_gio < w.chieu_mo or v_bay_gio > w.chieu_dong then
      return 'closed';
    end if;
    insert into mood_checkins (student_id, class_id, date, mood, buoi)
      values (p_student, v_class, v_hom_nay, p_mood, 'chieu')
      on conflict (student_id, date, buoi) do update set mood = excluded.mood, updated_at = now();

    -- Chiều mới check-in: ghi 'late' NẾU ngày ấy chưa có dòng nào. `do nothing` giữ nguyên dòng
    -- cũ — không hạ 'present' của buổi sáng xuống 'late', cũng không đè lên 'excused' cô đã đặt.
    insert into attendance_records (class_id, student_id, date, status, marked_by)
      -- ÉP KIỂU RÕ RÀNG. Trong plpgsql, một hằng chuỗi trần đứng cạnh biến sẽ được suy thành
      -- text, và cột này là enum — nên câu lệnh nổ ngay lúc chạy. Nhánh ghi điểm danh của hàm
      -- này CHƯA TỪNG CHẠY LẦN NÀO (trường chưa khai mạng, xem cờ truong_da_khai_mang), nên lỗi
      -- ấy nằm im từ đầu và chỉ lộ ra khi 0127 bật nhánh này lên.
      values (v_class, p_student, v_hom_nay, 'late'::attendance_status, p_student)
      on conflict (class_id, student_id, date) do nothing;
    return 'chieu';
  end if;

  if v_bay_gio < w.mo_luc or v_bay_gio > w.het_muon then
    return 'closed';
  end if;

  insert into mood_checkins (student_id, class_id, date, mood, buoi)
    values (p_student, v_class, v_hom_nay, p_mood, 'sang')
    on conflict (student_id, date, buoi) do update
      set mood = case when now() <= (select het_dung_gio from checkin_windows(v_campus))
                      then excluded.mood else mood_checkins.mood end,
          updated_at = now();

  -- ĐIỂM DANH LUÔN GHI, không còn chờ trường khai mạng. Em bấm là em có mặt.
  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, v_hom_nay,
            case when v_bay_gio <= w.het_dung_gio
                 then 'present'::attendance_status else 'late'::attendance_status end,
            p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        when attendance_records.status = 'excused' then attendance_records.status
        else excluded.status
      end;

  -- Giá trị trả về giữ nguyên bộ chữ cũ để màn hình không phải đổi: 'mood_only' nay chỉ còn nghĩa
  -- "trường chưa khai mạng nên không kiểm được IP", chứ điểm danh thì đã ghi.
  if not v_da_khai then
    return 'mood_only';
  end if;
  return case when v_bay_gio <= w.het_dung_gio then 'ok' else 'late' end;
end $$;

-- ── 2. AI ĐƯỢC GHI ─────────────────────────────────────────────────────────────────────────
-- Tổ trưởng và GVCN rời khỏi danh sách ghi. Ban giám hiệu vào — trước nay họ CHỈ ĐỌC.
drop policy if exists rls_insert_attendance_records on attendance_records;
create policy rls_insert_attendance_records on attendance_records for insert
  with check (
    auth_role() = 'admin'::user_role
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  );

drop policy if exists rls_update_attendance_records on attendance_records;
create policy rls_update_attendance_records on attendance_records for update
  using (
    auth_role() = 'admin'::user_role
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  )
  with check (
    auth_role() = 'admin'::user_role
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  );

drop policy if exists rls_delete_attendance_records on attendance_records;
create policy rls_delete_attendance_records on attendance_records for delete
  using (
    auth_role() = 'admin'::user_role
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  );

-- ĐỌC giữ nguyên phạm vi cũ: tổ trưởng vẫn thấy bảng của hôm nay — đó chính là thứ để đi nhắc.
-- GVCN vẫn thấy cả lớp, phụ huynh vẫn thấy con mình, BGH thấy cơ sở mình.

-- ── 3. HAI RPC GHI TAY: NÓI RÕ AI ĐƯỢC GỌI ─────────────────────────────────────────────────
-- RLS ở trên mới là thứ chặn thật (hai hàm này chạy bằng quyền người gọi). Kiểm ở đây chỉ để câu
-- lỗi đọc được: không có nó thì GVCN bấm nhầm sẽ nhận "new row violates row-level security
-- policy" — đúng nhưng không ai hiểu.
create or replace function public.mark_attendance(p_class uuid, p_student uuid, p_status attendance_status)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if auth_role() not in ('admin', 'principal') then
    raise exception 'Điểm danh là việc của chính học sinh. Ghi nhầm thì nhờ ban giám hiệu sửa.'
      using errcode = 'insufficient_privilege';
  end if;
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  values (p_class, p_student, vn_today(), p_status, auth.uid())
  on conflict (class_id, student_id, date)
  do update set status = excluded.status, marked_by = excluded.marked_by;
end $$;

create or replace function public.mark_attendance_on(p_class uuid, p_student uuid, p_status attendance_status, p_date date)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if auth_role() not in ('admin', 'principal') then
    raise exception 'Điểm danh là việc của chính học sinh. Ghi nhầm thì nhờ ban giám hiệu sửa.'
      using errcode = 'insufficient_privilege';
  end if;
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  values (p_class, p_student, p_date, p_status, auth.uid())
  on conflict (class_id, student_id, date)
  do update set status = excluded.status, marked_by = excluded.marked_by;
end $$;

-- ── 4. AI CHƯA CHECK-IN — DANH SÁCH ĐỂ TỔ TRƯỞNG ĐI NHẮC ───────────────────────────────────
-- Không dòng điểm danh = chưa check-in = VẮNG. Hàm này trả đúng những em ấy, không đẻ dòng nào.
create or replace function chua_check_in(p_class uuid, p_date date default null)
returns table(student_id uuid, student_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.student_id, ten_hien_thi(p.full_name, p.email)
  from enrollments e
  join profiles p on p.id = e.student_id
  where e.class_id = p_class and e.is_active
    and not exists (
      select 1 from attendance_records a
      where a.class_id = p_class and a.student_id = e.student_id
        and a.date = coalesce(p_date, vn_today())
    )
    and (staff_can_read_class(p_class) or is_attendance_leader(p_class))
  order by 2;
$$;
revoke all on function chua_check_in(uuid, date) from public, anon;
grant execute on function chua_check_in(uuid, date) to authenticated, service_role;
