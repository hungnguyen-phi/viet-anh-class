-- 0022 — Ghi danh / chuyển lớp / rời lớp cho học sinh (Audit Phase 2).
-- enrollments không có RLS INSERT cho GVCN → dùng RPC SECURITY DEFINER có guard quyền.
-- Ghi danh = chuyển lớp: tắt enrollment active khác (khớp unique uq_enrollment_active_student ở 0020).
set search_path = public;

create or replace function enroll_student_by_email(p_class uuid, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  if not (is_class_teacher(p_class) or auth_role() = 'admin') then
    raise exception 'Không có quyền ghi danh cho lớp này';
  end if;
  select id into v_student from profiles
    where lower(email) = lower(p_email) and role = 'student';
  if v_student is null then
    return 'not_found';
  end if;
  -- chuyển lớp: tắt các enrollment đang active khác của em
  update enrollments set is_active = false
    where student_id = v_student and is_active and class_id <> p_class;
  -- ghi danh (hoặc kích hoạt lại) vào lớp này
  insert into enrollments (class_id, student_id, is_active)
    values (p_class, v_student, true)
    on conflict (class_id, student_id) do update set is_active = true;
  return 'ok';
end $$;
revoke execute on function enroll_student_by_email(uuid, text) from anon;
grant execute on function enroll_student_by_email(uuid, text) to authenticated;

create or replace function unenroll_student(p_class uuid, p_student uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_class_teacher(p_class) or auth_role() = 'admin') then
    raise exception 'Không có quyền';
  end if;
  update enrollments set is_active = false, is_attendance_leader = false
    where class_id = p_class and student_id = p_student;
end $$;
revoke execute on function unenroll_student(uuid, uuid) from anon;
grant execute on function unenroll_student(uuid, uuid) to authenticated;
