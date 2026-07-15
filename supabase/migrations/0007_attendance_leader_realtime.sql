-- 0007 — Attendance leader đọc roster lớp + RPC ghi điểm danh + realtime.

-- Leader (học sinh được phân công) đọc enrollments lớp mình để liệt kê bạn cùng lớp.
create policy enr_leader_read on enrollments for select using (is_attendance_leader(class_id));

-- Leader đọc hồ sơ bạn cùng lớp (tên) để điểm danh.
create or replace function is_classmate_via_leader(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from enrollments e_self
    join enrollments e_other on e_other.class_id = e_self.class_id
    where e_self.student_id = auth.uid()
      and e_self.is_attendance_leader and e_self.is_active
      and e_other.student_id = s
  );
$$;
create policy prof_leader_classmates on profiles for select using (is_classmate_via_leader(id));

-- RPC ghi điểm danh: date = current_date (DB) → luôn khớp RLS "chỉ hôm nay".
-- SECURITY INVOKER → RLS att_teacher_* / att_leader_* quyết định quyền.
create or replace function mark_attendance(
  p_class uuid, p_student uuid, p_status attendance_status
) returns void
  language sql security invoker set search_path = public as $$
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  values (p_class, p_student, current_date, p_status, auth.uid())
  on conflict (class_id, student_id, date)
  do update set status = excluded.status, marked_by = excluded.marked_by;
$$;
revoke execute on function mark_attendance(uuid, uuid, attendance_status) from anon;
grant execute on function mark_attendance(uuid, uuid, attendance_status) to authenticated;

-- Ngày "hôm nay" theo DB (để app lọc khớp với RLS).
create or replace function app_today() returns date
  language sql stable security invoker set search_path = public as $$ select current_date; $$;
grant execute on function app_today() to authenticated, anon;

-- Realtime cho điểm danh.
alter publication supabase_realtime add table attendance_records;
