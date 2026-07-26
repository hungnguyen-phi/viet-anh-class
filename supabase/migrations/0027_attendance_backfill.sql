-- 0027 — GVCN sửa/bổ sung điểm danh trong 7 NGÀY gần nhất (tổ trưởng vẫn chỉ hôm nay).
-- (File này được khôi phục 2026-07-26 từ supabase_migrations.schema_migrations của project
--  eagsageokobtidpmxucx: migration đã áp lên DB từ 2026-07-22 nhưng chưa từng commit vào git.
--  Cửa sổ ngày ở đây (-7) sau đó được 0037 siết lại còn đúng 7 ngày (-6 .. hôm nay).)
set search_path = public;

drop policy if exists att_teacher_insert on attendance_records;
create policy att_teacher_insert on attendance_records for insert
  with check (is_class_teacher(class_id) and date >= vn_today() - 7 and date <= vn_today());

drop policy if exists att_teacher_update on attendance_records;
create policy att_teacher_update on attendance_records for update
  using (is_class_teacher(class_id) and date >= vn_today() - 7 and date <= vn_today())
  with check (is_class_teacher(class_id) and date >= vn_today() - 7 and date <= vn_today());

drop policy if exists att_teacher_delete on attendance_records;
create policy att_teacher_delete on attendance_records for delete
  using (is_class_teacher(class_id) and date >= vn_today() - 7 and date <= vn_today());

-- Ghi điểm danh cho 1 NGÀY cụ thể (trong cửa sổ). SECURITY INVOKER → RLS quyết định.
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
