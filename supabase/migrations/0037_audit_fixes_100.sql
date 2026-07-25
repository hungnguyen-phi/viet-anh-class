-- 0037 — Vá các lỗi audit 2026-07-22 (mục tiêu 100/100): mất điểm danh, timezone check-in,
-- storage bìa lớp không kiểm chủ sở hữu, thiếu GRANT pending_user_grants.
-- An toàn chạy lại (create or replace / drop if exists / grant idempotent).
set search_path = public;

-- ============================================================
-- 1) mark_attendance_on — RPC app đang gọi (AttendanceTable.tsx) nhưng CHƯA từng có
--    migration (chỉ tồn tại "chui" trên DB production → drift). Khôi phục lại đây,
--    SECURITY INVOKER để RLS att_teacher_*/att_admin_all quyết định quyền/khoảng ngày.
-- ============================================================
create or replace function mark_attendance_on(
  p_class uuid, p_student uuid, p_status attendance_status, p_date date
) returns void
  language sql security invoker set search_path = public as $$
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  values (p_class, p_student, p_date, p_status, auth.uid())
  on conflict (class_id, student_id, date)
  do update set status = excluded.status, marked_by = excluded.marked_by;
$$;
revoke execute on function mark_attendance_on(uuid, uuid, attendance_status, date) from anon;
grant execute on function mark_attendance_on(uuid, uuid, attendance_status, date) to authenticated;

-- ============================================================
-- 2) Điểm danh: chính thức cho GVCN/Admin sửa/bổ sung 7 NGÀY GẦN NHẤT (khớp UI
--    app/[locale]/(dashboard)/attendance/page.tsx đã cho chọn 7 ngày từ trước tới giờ).
--    docs/ROLE_MATRIX.md sẽ cập nhật theo (mục 3). Tổ trưởng (leader) GIỮ NGUYÊN chỉ
--    hôm nay — không có UI/nhu cầu backfill cho vai trò này.
-- ============================================================
drop policy if exists att_teacher_insert on attendance_records;
create policy att_teacher_insert on attendance_records for insert
  with check (is_class_teacher(class_id) and date between vn_today() - 6 and vn_today());

drop policy if exists att_teacher_update on attendance_records;
create policy att_teacher_update on attendance_records for update
  using (is_class_teacher(class_id) and date between vn_today() - 6 and vn_today())
  with check (is_class_teacher(class_id) and date between vn_today() - 6 and vn_today());

drop policy if exists att_teacher_delete on attendance_records;
create policy att_teacher_delete on attendance_records for delete
  using (is_class_teacher(class_id) and date between vn_today() - 6 and vn_today());

-- ============================================================
-- 3) student_checkin(): sửa lỗi timezone — dùng current_date (UTC) thay vì vn_today()
--    → 00:00–07:00 giờ VN bị ghi nhầm sang NGÀY HÔM TRƯỚC (giống lỗi đã vá ở 0019
--    cho mark_attendance/set_my_mood, nhưng bản 0031 lại tái phạm).
-- ============================================================
create or replace function student_checkin(p_student uuid, p_mood mood_level, p_ip text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  if not ip_allowed(p_ip) then
    return 'blocked';
  end if;
  select class_id into v_class from enrollments
    where student_id = p_student and is_active limit 1;

  insert into mood_checkins (student_id, class_id, date, mood)
    values (p_student, v_class, vn_today(), p_mood)
    on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();

  if v_class is null then
    return 'no_class';
  end if;

  -- Cảm xúc = điểm danh: đánh "có mặt". KHÔNG đè nếu GV đã đánh Trễ/Có phép.
  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, vn_today(), 'present', p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        when attendance_records.status in ('excused','late') then attendance_records.status
        else 'present'
      end;

  return 'ok';
end $$;
-- Giữ nguyên chính sách quyền gọi hàm (chỉ service_role) đã siết ở 0031/0032.
revoke all on function student_checkin(uuid, mood_level, text) from public, anon, authenticated;
grant execute on function student_checkin(uuid, mood_level, text) to service_role;

-- ============================================================
-- 4) Storage class-covers: policy cũ CHỈ kiểm bucket_id → BẤT KỲ user đăng nhập nào
--    cũng ghi/đè/xoá được ảnh bìa của MỌI lớp (kể cả lớp không dạy). Path do client
--    tự đặt dạng "<classId>/<ts>-<file>" (ClassCoverUpload.tsx) → xác thực classId
--    là thư mục gốc + người gọi phải staff_can_manage_class lớp đó.
-- ============================================================
create or replace function can_manage_class_cover(p_name text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare v_class uuid;
begin
  begin
    v_class := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false; -- path không đúng dạng "<uuid>/..." → từ chối
  end;
  return v_class is not null and staff_can_manage_class(v_class);
end $$;
grant execute on function can_manage_class_cover(text) to authenticated;

drop policy if exists class_covers_auth_insert on storage.objects;
create policy class_covers_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'class-covers' and can_manage_class_cover(name));

drop policy if exists class_covers_auth_update on storage.objects;
create policy class_covers_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'class-covers' and can_manage_class_cover(name));

drop policy if exists class_covers_auth_delete on storage.objects;
create policy class_covers_auth_delete on storage.objects
  for delete to authenticated using (bucket_id = 'class-covers' and can_manage_class_cover(name));

-- ============================================================
-- 5) pending_user_grants: có RLS (pug_admin_all) nhưng THIẾU GRANT bảng (như 0015 đã
--    vá cho các bảng khác) → PostgREST trả 42501 khi Admin mời user qua UI.
-- ============================================================
grant select, insert, update, delete on pending_user_grants to authenticated;
