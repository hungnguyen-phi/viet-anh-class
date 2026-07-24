-- 0019 — Sửa timezone: "hôm nay" của DB phải theo giờ Việt Nam (UTC+7), không phải UTC.
-- Lỗi cũ: current_date (UTC) trong khung 00:00–07:00 giờ VN trả về NGÀY HÔM TRƯỚC → điểm danh
-- sáng sớm ghi đè ngày hôm qua, mood/lead cũng lệch ngày. Áp CÙNG với 0018.
-- Phụ thuộc: 0018 (đã tạo att_leader_select). Chạy 0018 trước, rồi 0019.

set search_path = public;

-- ============================================================
-- Nguồn chân lý duy nhất cho "hôm nay theo giờ VN".
-- ============================================================
create or replace function vn_today() returns date
  language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;
grant execute on function vn_today() to authenticated, anon;

-- app_today() (app đọc để lọc "hôm nay") → trả ngày VN.
create or replace function app_today() returns date
  language sql stable security invoker set search_path = public as $$ select vn_today(); $$;
grant execute on function app_today() to authenticated, anon;

-- mark_attendance ghi theo ngày VN.
create or replace function mark_attendance(
  p_class uuid, p_student uuid, p_status attendance_status
) returns void
  language sql security invoker set search_path = public as $$
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  values (p_class, p_student, vn_today(), p_status, auth.uid())
  on conflict (class_id, student_id, date)
  do update set status = excluded.status, marked_by = excluded.marked_by;
$$;
revoke execute on function mark_attendance(uuid, uuid, attendance_status) from anon;
grant execute on function mark_attendance(uuid, uuid, attendance_status) to authenticated;

-- set_my_mood ghi theo ngày VN.
create or replace function set_my_mood(p_mood mood_level)
returns void language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  select class_id into v_class from enrollments
  where student_id = auth.uid() and is_active limit 1;
  insert into mood_checkins (student_id, class_id, date, mood)
  values (auth.uid(), v_class, vn_today(), p_mood)
  on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();
end $$;
grant execute on function set_my_mood(mood_level) to authenticated;

-- Default cột date theo ngày VN (khi insert trực tiếp không truyền date).
alter table mood_checkins   alter column date        set default (now() at time zone 'Asia/Ho_Chi_Minh')::date;
alter table lead_progress   alter column logged_date set default (now() at time zone 'Asia/Ho_Chi_Minh')::date;

-- ============================================================
-- Tái tạo mọi policy đang khoá theo "current_date" → dùng vn_today().
-- attendance_records: teacher (insert/update/delete), leader (insert/update/select).
-- ============================================================
drop policy if exists att_teacher_insert on attendance_records;
create policy att_teacher_insert on attendance_records for insert
  with check (is_class_teacher(class_id) and date = vn_today());

drop policy if exists att_teacher_update on attendance_records;
create policy att_teacher_update on attendance_records for update
  using (is_class_teacher(class_id) and date = vn_today())
  with check (is_class_teacher(class_id) and date = vn_today());

drop policy if exists att_teacher_delete on attendance_records;
create policy att_teacher_delete on attendance_records for delete
  using (is_class_teacher(class_id) and date = vn_today());

drop policy if exists att_leader_insert on attendance_records;
create policy att_leader_insert on attendance_records for insert
  with check (is_attendance_leader(class_id) and date = vn_today());

drop policy if exists att_leader_update on attendance_records;
create policy att_leader_update on attendance_records for update
  using (is_attendance_leader(class_id) and date = vn_today())
  with check (is_attendance_leader(class_id) and date = vn_today());

drop policy if exists att_leader_select on attendance_records;
create policy att_leader_select on attendance_records for select
  using (is_attendance_leader(class_id) and date = vn_today());

-- mood_checkins: student insert/update chỉ trong ngày (VN).
drop policy if exists mc_student_insert on mood_checkins;
create policy mc_student_insert on mood_checkins for insert
  with check (student_id = auth.uid() and date = vn_today());

drop policy if exists mc_student_update on mood_checkins;
create policy mc_student_update on mood_checkins for update
  using (student_id = auth.uid() and date = vn_today())
  with check (student_id = auth.uid() and date = vn_today());
