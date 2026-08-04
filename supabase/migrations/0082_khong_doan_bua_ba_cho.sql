-- BA CHỖ APP ĐANG ĐOÁN BỪA THAY CHO NHÀ TRƯỜNG.
--
-- Cả ba đều cùng một hình dạng: thiếu cấu hình thì hàm ĐOÁN một giá trị "cho dễ", và cái đoán ấy
-- lại đúng bằng lựa chọn nguy hiểm nhất. Không có gì trên màn hình nói ra là mình đang đoán.
--
--   1. Chưa khai dải mạng nào  → ip_allowed() trả TRUE cho mọi IP  → học sinh mở app ở nhà tối
--      Chủ Nhật cũng bị coi là đang đứng trong trường, bị cổng check-in chặn cứng, và bấm xong
--      là CSDL có thêm một dòng điểm danh "có mặt".
--   2. Mời một giáo viên kèm lớp → lúc họ đăng nhập lần đầu, hệ thống ghi đè chủ nhiệm của lớp
--      ấy VÔ ĐIỀU KIỆN. Người đang chủ nhiệm mất lớp — mất điểm danh, báo bài, WIG — không nhật
--      ký, không thông báo cho ai.
--   3. student_checkin() ghi điểm danh dựa trên cùng cái đoán ở (1).
--
-- Chữa theo cùng một nguyên tắc: CHƯA KHAI THÌ NÓI LÀ CHƯA KHAI, đừng đoán hộ.

set search_path = public;

-- ============================================================
-- 1) truong_da_khai_mang — trường đã khai dải mạng nào chưa
-- ============================================================
-- Tách riêng khỏi ip_allowed() vì hai câu hỏi khác nhau và phía ứng dụng cần cả hai:
--   ip_allowed()          "IP này có nằm trong trường không"
--   truong_da_khai_mang() "câu trên có nghĩa gì không"
-- Trước đây chỉ có câu đầu, và nó trả TRUE cho cả hai nghĩa — nên màn hình không phân biệt được
-- "em đang ở trường" với "trường chưa khai gì cả".
--
-- KHÔNG lộ cấu hình: chỉ trả về đúng một chữ có/không, nên học sinh gọi được cũng không dò ra
-- dải nào. Vì vậy cấp quyền cho authenticated, khác với ip_allowed (chỉ service_role).
create or replace function truong_da_khai_mang() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_networks where is_active);
$$;
revoke all on function truong_da_khai_mang() from public, anon;
grant execute on function truong_da_khai_mang() to authenticated, service_role;

comment on function truong_da_khai_mang() is
  'Trường đã khai dải mạng nào đang bật chưa. Chưa khai thì cổng check-in theo IP không có nghĩa gì — xem 0082.';

-- ============================================================
-- 2) student_checkin — chưa khai mạng thì ĐỪNG ghi điểm danh
-- ============================================================
-- Cảm xúc vẫn ghi: đó là em tự khai, đúng ở mọi nơi. Nhưng "có mặt ở trường" là một khẳng định
-- về vị trí, và khi chưa có dải mạng nào thì hệ thống KHÔNG BIẾT em đang ở đâu. Ghi đại là làm
-- bẩn đúng cái dữ liệu nhà trường phải chịu trách nhiệm — production đã có 8 dòng như vậy.
--
-- Trả thêm một trạng thái mới 'mood_only' để màn hình nói được sự thật: đã ghi cảm xúc, chưa
-- tính điểm danh. Nơi gọi coi mọi giá trị khác 'blocked'/'no_class' là thành công.
create or replace function student_checkin(p_student uuid, p_mood mood_level, p_ip text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
  v_da_khai boolean;
begin
  v_da_khai := truong_da_khai_mang();

  -- Chỉ chặn khi trường THẬT SỰ có cổng: chưa khai mạng thì chặn là chặn theo một luật không tồn tại.
  if v_da_khai and not ip_allowed(p_ip) then
    return 'blocked';
  end if;

  select class_id into v_class from enrollments
    where student_id = p_student and is_active limit 1;

  insert into mood_checkins (student_id, class_id, date, mood)
    values (p_student, v_class, current_date, p_mood)
    on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();

  if v_class is null then
    return 'no_class';
  end if;

  if not v_da_khai then
    return 'mood_only';
  end if;

  -- Cảm xúc = điểm danh: đánh "có mặt". KHÔNG đè nếu GV đã đánh Trễ/Có phép.
  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, current_date, 'present', p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        when attendance_records.status in ('excused','late') then attendance_records.status
        else 'present'
      end;

  return 'ok';
end $$;

revoke all on function student_checkin(uuid, mood_level, text) from public, anon, authenticated;
grant execute on function student_checkin(uuid, mood_level, text) to service_role;

comment on function student_checkin(uuid, mood_level, text) is
  'Cảm xúc + điểm danh trong một lần. Chưa khai dải mạng nào → trả mood_only và KHÔNG ghi điểm danh (0082).';

-- ============================================================
-- 3) handle_new_user — mời người mới KHÔNG được cướp lớp của người đang dạy
-- ============================================================
-- 0049 ghi `update classes set homeroom_teacher_id = new.id where id = v_grant.class_id;` — không
-- một điều kiện nào. Ngay lúc viết migration này, production đang có một lời mời chờ gắn vào một
-- lớp ĐÃ CÓ chủ nhiệm: người kia đăng nhập lần đầu là cô giáo đang dạy mất lớp, lặng lẽ.
--
-- Nay chỉ nhận khi ghế còn trống. Ghế đã có người thì lời mời vẫn thành công (người mới vẫn vào
-- được app với vai giáo viên), chỉ là không tự ý đổi chủ nhiệm — việc ấy để quản trị viên làm có
-- ý thức ở màn Quản trị, nơi có nhật ký và có câu xác nhận nói rõ hậu quả.
--
-- CHÉP TỪ BẢN ĐANG CHẠY TRÊN PRODUCTION (pg_proc.prosrc), không phải từ migration 0049.
--
-- Hai bản đã lệch nhau: bản thật còn tra bảng `signup_email_domains` để suy vai theo tên miền
-- email, và lấy full_name theo hai khoá metadata. Chép từ file 0049 là lặng lẽ xoá mất cả hai —
-- đúng cái bẫy mà chính đợt sửa này đang đi gỡ, chỉ khác là ở phía CSDL.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_role user_role;
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_grant pending_user_grants%rowtype;
  v_has_grant boolean := false;
begin
  select default_role into v_role from signup_email_domains where domain = v_domain;
  if v_role is null then
    if exists (select 1 from parent_invitations where lower(email) = v_email and status in ('pending','accepted')) then
      v_role := 'parent';
    else
      v_role := 'pending';
    end if;
  end if;

  select * into v_grant from pending_user_grants where lower(email) = v_email;
  v_has_grant := v_grant.email is not null;
  if v_has_grant then v_role := v_grant.role; end if;

  insert into profiles (id, email, full_name, role, campus_id)
  values (new.id, new.email, v_full_name, v_role,
          case when v_has_grant then v_grant.campus_id else null end)
  on conflict (id) do nothing;

  if v_has_grant then
    if v_grant.role = 'teacher' and v_grant.class_id is not null then
      -- ĐÂY là dòng duy nhất đã sửa: chỉ nhận lớp khi CHƯA AI chủ nhiệm.
      update classes set homeroom_teacher_id = new.id
      where id = v_grant.class_id and homeroom_teacher_id is null;
    elsif v_grant.role = 'student' and v_grant.class_id is not null then
      insert into enrollments (class_id, student_id) values (v_grant.class_id, new.id)
      on conflict (class_id, student_id) do nothing;
    elsif v_grant.role = 'parent' and v_grant.student_id is not null then
      insert into parent_links (parent_id, student_id, relationship)
      values (new.id, v_grant.student_id, 'guardian')
      on conflict (parent_id, student_id) do nothing;
    end if;
    delete from pending_user_grants where lower(email) = v_email;
  end if;

  if v_role = 'parent' then
    insert into parent_links (parent_id, student_id, relationship)
    select new.id, pi.student_id, 'guardian'
    from parent_invitations pi
    where lower(pi.email) = v_email and pi.status in ('pending','accepted')
    on conflict (parent_id, student_id) do nothing;
    update parent_invitations set status = 'accepted'
    where lower(email) = v_email and status = 'pending';
  end if;

  return new;
end $$;

comment on function handle_new_user() is
  'Tạo hồ sơ khi có tài khoản mới. Từ 0082: nhận lớp chủ nhiệm CHỈ khi ghế còn trống — không cướp lớp của người đang dạy.';
