-- 0004 — Bật RLS cho MỌI bảng + policy theo ma trận §7.2 (ROLE_MATRIX).
-- Helper bổ sung (SECURITY DEFINER → bỏ qua RLS, tránh đệ quy policy).

create or replace function is_my_student(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments e join classes c on c.id = e.class_id
    where e.student_id = s and c.homeroom_teacher_id = auth.uid() and e.is_active
  );
$$;

create or replace function is_parent_of_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments e join parent_links pl on pl.student_id = e.student_id
    where e.class_id = c and pl.parent_id = auth.uid()
  );
$$;

create or replace function staff_can_read_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_class_teacher(c)
      or (auth_role() = 'principal' and is_campus_class(c))
      or auth_role() = 'admin';
$$;

create or replace function staff_can_manage_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_class_teacher(c) or auth_role() = 'admin';
$$;

create or replace function wig_class(w uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select class_id from wigs where id = w;
$$;

create or replace function lead_class(lm uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select w.class_id from lead_measures l join wigs w on w.id = l.wig_id where l.id = lm;
$$;

-- Bật RLS cho mọi bảng (nguyên tắc vàng §9.4).
alter table campuses enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table parent_links enable row level security;
alter table parent_invitations enable row level security;
alter table attendance_records enable row level security;
alter table wigs enable row level security;
alter table lead_measures enable row level security;
alter table lead_progress enable row level security;
alter table wig_meetings enable row level security;
alter table scoreboard_entries enable row level security;

-- ============ CAMPUSES ============
create policy campus_read on campuses for select using (auth.uid() is not null);
create policy campus_admin_all on campuses for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ PROFILES ============
-- Bảo vệ cột role/campus_id: chỉ admin được đổi (trigger ở dưới).
create or replace function protect_profile_privileged_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.campus_id is distinct from old.campus_id)
     and coalesce(auth_role(), 'pending') <> 'admin' then
    raise exception 'Chỉ admin được đổi role/campus của hồ sơ';
  end if;
  return new;
end;
$$;
create trigger trg_protect_profile_cols before update on profiles
  for each row execute function protect_profile_privileged_cols();

create policy prof_self_read on profiles for select using (id = auth.uid());
create policy prof_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy prof_parent_child on profiles for select using (is_my_child(id));
create policy prof_teacher_students on profiles for select using (is_my_student(id));
create policy prof_principal_campus on profiles for select
  using (auth_role() = 'principal' and campus_id = auth_campus());
create policy prof_admin_all on profiles for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ CLASSES ============
create policy class_teacher_read on classes for select using (is_class_teacher(id));
create policy class_student_read on classes for select using (is_class_student(id));
create policy class_parent_read on classes for select using (is_parent_of_class(id));
create policy class_principal_read on classes for select
  using (auth_role() = 'principal' and campus_id = auth_campus());
create policy class_teacher_update on classes for update
  using (is_class_teacher(id)) with check (is_class_teacher(id));
create policy class_principal_update on classes for update
  using (auth_role() = 'principal' and campus_id = auth_campus())
  with check (auth_role() = 'principal' and campus_id = auth_campus());
create policy class_admin_all on classes for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ ENROLLMENTS ============
create policy enr_teacher_read on enrollments for select using (is_class_teacher(class_id));
create policy enr_student_self on enrollments for select using (student_id = auth.uid());
create policy enr_parent_read on enrollments for select using (is_my_child(student_id));
create policy enr_principal_read on enrollments for select
  using (auth_role() = 'principal' and is_campus_class(class_id));
create policy enr_teacher_update on enrollments for update
  using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy enr_admin_all on enrollments for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ PARENT_LINKS ============
create policy pl_parent_self on parent_links for select using (parent_id = auth.uid());
create policy pl_admin_all on parent_links for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ PARENT_INVITATIONS ============
create policy pi_admin_all on parent_invitations for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ ATTENDANCE_RECORDS (gap b: khoá theo ngày) ============
create policy att_teacher_select on attendance_records for select using (is_class_teacher(class_id));
create policy att_teacher_insert on attendance_records for insert
  with check (is_class_teacher(class_id) and date = current_date);
create policy att_teacher_update on attendance_records for update
  using (is_class_teacher(class_id) and date = current_date)
  with check (is_class_teacher(class_id) and date = current_date);
create policy att_teacher_delete on attendance_records for delete
  using (is_class_teacher(class_id) and date = current_date);

create policy att_leader_insert on attendance_records for insert
  with check (is_attendance_leader(class_id) and date = current_date);
create policy att_leader_update on attendance_records for update
  using (is_attendance_leader(class_id) and date = current_date)
  with check (is_attendance_leader(class_id) and date = current_date);

create policy att_student_select on attendance_records for select using (is_class_student(class_id));
create policy att_parent_select on attendance_records for select using (is_my_child(student_id));
create policy att_principal_select on attendance_records for select
  using (auth_role() = 'principal' and is_campus_class(class_id));
create policy att_admin_all on attendance_records for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ WIGS ============
create policy wig_read on wigs for select using (
  is_class_student(class_id)
  or staff_can_read_class(class_id)
  or (scope = 'student' and is_my_child(student_id))
);
create policy wig_student_self_update on wigs for update
  using (scope = 'student' and student_id = auth.uid())
  with check (scope = 'student' and student_id = auth.uid());
create policy wig_manage on wigs for all
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

-- ============ LEAD_MEASURES ============
create policy lm_read on lead_measures for select using (
  staff_can_read_class(wig_class(wig_id)) or is_class_student(wig_class(wig_id))
);
create policy lm_manage on lead_measures for all
  using (staff_can_manage_class(wig_class(wig_id)))
  with check (staff_can_manage_class(wig_class(wig_id)));

-- ============ LEAD_PROGRESS (gap b: khoá 24h cho học sinh) ============
create policy lp_read on lead_progress for select using (
  student_id = auth.uid()
  or is_my_child(student_id)
  or staff_can_read_class(lead_class(lead_measure_id))
);
create policy lp_student_insert on lead_progress for insert
  with check (
    student_id = auth.uid() and logged_by = auth.uid()
    and is_class_student(lead_class(lead_measure_id))
  );
create policy lp_student_update on lead_progress for update
  using (logged_by = auth.uid() and created_at > now() - interval '24 hours')
  with check (logged_by = auth.uid());
create policy lp_student_delete on lead_progress for delete
  using (logged_by = auth.uid() and created_at > now() - interval '24 hours');
create policy lp_staff_manage on lead_progress for all
  using (staff_can_manage_class(lead_class(lead_measure_id)))
  with check (staff_can_manage_class(lead_class(lead_measure_id)));

-- ============ WIG_MEETINGS ============
create policy wm_teacher_all on wig_meetings for all
  using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy wm_student_select on wig_meetings for select using (
  is_class_student(class_id)
  and (student_id is null or student_id = auth.uid() or buddy_id = auth.uid())
);
create policy wm_parent_select on wig_meetings for select
  using (student_id is not null and is_my_child(student_id));
create policy wm_principal_select on wig_meetings for select
  using (auth_role() = 'principal' and is_campus_class(class_id));
create policy wm_admin_all on wig_meetings for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ SCOREBOARD_ENTRIES ============
create policy sb_class_read on scoreboard_entries for select using (
  class_id is not null
  and (
    is_class_teacher(class_id)
    or is_class_student(class_id)
    or (auth_role() = 'principal' and is_campus_class(class_id))
  )
);
create policy sb_student_self_read on scoreboard_entries for select
  using (student_id = auth.uid());
create policy sb_parent_read on scoreboard_entries for select
  using (student_id is not null and is_my_child(student_id));
create policy sb_admin_all on scoreboard_entries for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
