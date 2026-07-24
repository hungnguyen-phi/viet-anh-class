-- 0020 — Ràng buộc toàn vẹn dữ liệu (Audit Phase 2).
-- Chống: tick lead measure vô hạn, biên bản họp trùng, lớp trùng, WIG mục tiêu ≤ 0,
-- parent_link tự trỏ, enrollment active trùng, email hoa/thường. + FK index còn thiếu.
-- Có bước DEDUP trước khi thêm UNIQUE (dữ liệu seed W30 có dòng trùng). An toàn chạy lại.
set search_path = public;

-- ============================================================
-- lead_progress: 1 bản ghi / lead / học sinh / ngày; value > 0.
-- ============================================================
-- Dedup: giữ 1 dòng (ctid nhỏ nhất) cho mỗi (lead, student, ngày) khi student_id không null.
delete from lead_progress a using lead_progress b
where a.student_id is not null
  and a.lead_measure_id = b.lead_measure_id
  and a.student_id = b.student_id
  and a.logged_date = b.logged_date
  and a.ctid > b.ctid;

create unique index if not exists uq_lead_progress_daily
  on lead_progress (lead_measure_id, student_id, logged_date)
  where student_id is not null;

do $$ begin
  alter table lead_progress add constraint lead_progress_value_pos check (value > 0);
exception when duplicate_object then null; end $$;

-- ============================================================
-- wig_meetings: 1 biên bản / (lớp, tuần) cấp lớp; 1 / (học sinh, tuần) cấp cá nhân.
-- ============================================================
delete from wig_meetings a using wig_meetings b
where a.student_id is null and b.student_id is null
  and a.class_id = b.class_id and a.week_label = b.week_label
  and a.ctid > b.ctid;
delete from wig_meetings a using wig_meetings b
where a.student_id is not null and b.student_id is not null
  and a.student_id = b.student_id and a.week_label = b.week_label
  and a.ctid > b.ctid;

create unique index if not exists uq_meeting_class_week
  on wig_meetings (class_id, week_label) where student_id is null;
create unique index if not exists uq_meeting_student_week
  on wig_meetings (student_id, week_label) where student_id is not null;

-- ============================================================
-- classes: không trùng (cơ sở, tên, năm học).
-- ============================================================
create unique index if not exists uq_class_campus_name_year
  on classes (campus_id, name, school_year);

-- ============================================================
-- wigs: mục tiêu > 0; scope khớp student_id.
-- ============================================================
do $$ begin
  alter table wigs add constraint wig_target_pos check (target_value > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table wigs add constraint wig_scope_student check (
    (scope = 'class' and student_id is null) or (scope = 'student' and student_id is not null)
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- parent_links: không tự trỏ (parent ≠ student).
-- ============================================================
do $$ begin
  alter table parent_links add constraint parent_not_self check (parent_id <> student_id);
exception when duplicate_object then null; end $$;

-- ============================================================
-- enrollments: mỗi học sinh chỉ 1 lớp đang active.
-- ============================================================
create unique index if not exists uq_enrollment_active_student
  on enrollments (student_id) where is_active;

-- ============================================================
-- Email không phân biệt hoa/thường (mọi tra cứu đều dùng lower()).
-- ============================================================
create unique index if not exists uq_pug_lower_email on pending_user_grants (lower(email));
create unique index if not exists uq_pi_lower_email_student on parent_invitations (lower(email), student_id);

-- ============================================================
-- FK index còn thiếu (tránh seq-scan khi xoá/sửa hàng cha).
-- ============================================================
create index if not exists idx_attendance_marked_by       on attendance_records (marked_by);
create index if not exists idx_lead_progress_logged_by     on lead_progress (logged_by);
create index if not exists idx_audit_actor                 on audit_log (actor_id);
create index if not exists idx_wig_meetings_coach          on wig_meetings (coach_id);
create index if not exists idx_wig_meetings_buddy          on wig_meetings (buddy_id);
create index if not exists idx_parent_invitations_student  on parent_invitations (student_id);
create index if not exists idx_parent_invitations_invited  on parent_invitations (invited_by);
create index if not exists idx_pug_class                   on pending_user_grants (class_id);
create index if not exists idx_pug_student                 on pending_user_grants (student_id);
create index if not exists idx_parent_links_parent         on parent_links (parent_id);
