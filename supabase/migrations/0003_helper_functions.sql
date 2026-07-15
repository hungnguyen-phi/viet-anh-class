-- 0003 — Helper functions cho RLS (PRD §9.3) + is_attendance_leader (gap a).
-- Tất cả SECURITY DEFINER + search_path cố định để tránh đệ quy RLS và injection.

create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_campus() returns uuid
  language sql stable security definer set search_path = public as $$
  select campus_id from profiles where id = auth.uid();
$$;

create or replace function is_class_teacher(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from classes where id = c and homeroom_teacher_id = auth.uid());
$$;

create or replace function is_class_student(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments
    where class_id = c and student_id = auth.uid() and is_active
  );
$$;

create or replace function is_my_child(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from parent_links where parent_id = auth.uid() and student_id = s
  );
$$;

create or replace function is_attendance_leader(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments
    where class_id = c and student_id = auth.uid() and is_active and is_attendance_leader
  );
$$;

-- Lớp của 1 campus mà principal hiện tại phụ trách (dùng cho policy BGH).
create or replace function is_campus_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from classes where id = c and campus_id = auth_campus()
  );
$$;
