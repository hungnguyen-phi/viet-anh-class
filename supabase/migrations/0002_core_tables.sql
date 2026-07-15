-- 0002 — Core tables (PRD §9.2). Multi-tenant ready; pilot bật 1 campus.
-- Gap (a): enrollments.is_attendance_leader (GVCN uỷ quyền điểm danh).

create table campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role user_role not null default 'pending',
  campus_id uuid references campuses(id),
  avatar_url text,
  locale text not null default 'vi',
  created_at timestamptz not null default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id),
  name text not null,
  grade text,
  school_year text not null,
  homeroom_teacher_id uuid references profiles(id),
  cover_image_url text,
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  is_attendance_leader boolean not null default false,
  unique (class_id, student_id)
);

create table parent_links (
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  relationship text,
  primary key (parent_id, student_id)
);

create table parent_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  student_id uuid not null references profiles(id),
  invited_by uuid references profiles(id),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (email, student_id)
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  status attendance_status not null default 'present',
  note text,
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (class_id, student_id, date)
);

create table wigs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references profiles(id),
  scope wig_scope not null,
  area wig_area not null,
  period wig_period not null,
  period_label text,
  parent_wig_id uuid references wigs(id),
  target_value numeric not null,
  unit text not null,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table lead_measures (
  id uuid primary key default gen_random_uuid(),
  wig_id uuid not null references wigs(id) on delete cascade,
  title text not null,
  target_value numeric not null,
  unit text,
  created_at timestamptz not null default now()
);

create table lead_progress (
  id uuid primary key default gen_random_uuid(),
  lead_measure_id uuid not null references lead_measures(id) on delete cascade,
  student_id uuid references profiles(id),
  value numeric not null default 1,
  logged_date date not null default current_date,
  logged_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table wig_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references profiles(id),
  week_label text not null,
  coach_id uuid references profiles(id),
  buddy_id uuid references profiles(id),
  commitments text,
  results text,
  next_actions text,
  created_at timestamptz not null default now()
);

create table scoreboard_entries (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id),
  class_id uuid references classes(id),
  student_id uuid references profiles(id),
  category score_category not null,
  sub_category text,
  points numeric not null default 0,
  period_label text not null,
  source_ref uuid,
  created_at timestamptz not null default now()
);

-- Indexes cho FK / RLS lookups (tránh cảnh báo advisor + tăng tốc policy).
create index idx_profiles_campus on profiles (campus_id);
create index idx_classes_campus on classes (campus_id);
create index idx_classes_teacher on classes (homeroom_teacher_id);
create index idx_enrollments_student on enrollments (student_id);
create index idx_parent_links_student on parent_links (student_id);
create index idx_parent_invitations_email on parent_invitations (lower(email));
create index idx_attendance_student on attendance_records (student_id);
create index idx_attendance_class_date on attendance_records (class_id, date);
create index idx_wigs_class on wigs (class_id);
create index idx_wigs_student on wigs (student_id);
create index idx_wigs_parent on wigs (parent_wig_id);
create index idx_lead_measures_wig on lead_measures (wig_id);
create index idx_lead_progress_measure on lead_progress (lead_measure_id);
create index idx_lead_progress_student on lead_progress (student_id);
create index idx_wig_meetings_class on wig_meetings (class_id);
create index idx_wig_meetings_student on wig_meetings (student_id);
create index idx_scoreboard_campus on scoreboard_entries (campus_id);
create index idx_scoreboard_class on scoreboard_entries (class_id);
create index idx_scoreboard_student on scoreboard_entries (student_id);
