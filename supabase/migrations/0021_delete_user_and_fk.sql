-- 0021 — Cho phép xoá người dùng an toàn (tuân thủ: xoá dữ liệu trẻ em khi phụ huynh yêu cầu).
-- (1) Sửa hành vi ON DELETE của các FK trỏ về profiles để xoá không bị chặn/mồ côi:
--     - cột "ai thao tác" (marked_by, logged_by, coach/buddy, invited_by, actor) → SET NULL (giữ lịch sử).
--     - dữ liệu THUỘC VỀ em (wigs/lead_progress/wig_meetings theo student) → CASCADE.
-- (2) RPC admin_delete_user (SECURITY DEFINER) xoá auth.users → cascade profiles → cascade dữ liệu con.
set search_path = public;

-- ===== FK "ai thao tác" → SET NULL (cột đều nullable) =====
alter table classes            drop constraint if exists classes_homeroom_teacher_id_fkey;
alter table classes            add  constraint classes_homeroom_teacher_id_fkey
  foreign key (homeroom_teacher_id) references profiles(id) on delete set null;

alter table attendance_records drop constraint if exists attendance_records_marked_by_fkey;
alter table attendance_records add  constraint attendance_records_marked_by_fkey
  foreign key (marked_by) references profiles(id) on delete set null;

alter table lead_progress      drop constraint if exists lead_progress_logged_by_fkey;
alter table lead_progress      add  constraint lead_progress_logged_by_fkey
  foreign key (logged_by) references profiles(id) on delete set null;

alter table wig_meetings       drop constraint if exists wig_meetings_coach_id_fkey;
alter table wig_meetings       add  constraint wig_meetings_coach_id_fkey
  foreign key (coach_id) references profiles(id) on delete set null;

alter table wig_meetings       drop constraint if exists wig_meetings_buddy_id_fkey;
alter table wig_meetings       add  constraint wig_meetings_buddy_id_fkey
  foreign key (buddy_id) references profiles(id) on delete set null;

alter table parent_invitations drop constraint if exists parent_invitations_invited_by_fkey;
alter table parent_invitations add  constraint parent_invitations_invited_by_fkey
  foreign key (invited_by) references profiles(id) on delete set null;

alter table pending_user_grants drop constraint if exists pending_user_grants_invited_by_fkey;
alter table pending_user_grants add  constraint pending_user_grants_invited_by_fkey
  foreign key (invited_by) references profiles(id) on delete set null;

alter table audit_log          drop constraint if exists audit_log_actor_id_fkey;
alter table audit_log          add  constraint audit_log_actor_id_fkey
  foreign key (actor_id) references profiles(id) on delete set null;

alter table scoreboard_entries drop constraint if exists scoreboard_entries_student_id_fkey;
alter table scoreboard_entries add  constraint scoreboard_entries_student_id_fkey
  foreign key (student_id) references profiles(id) on delete set null;

-- ===== FK dữ liệu THUỘC VỀ học sinh → CASCADE (chỉ xoá dòng của đúng em đó) =====
alter table wigs               drop constraint if exists wigs_student_id_fkey;
alter table wigs               add  constraint wigs_student_id_fkey
  foreign key (student_id) references profiles(id) on delete cascade;

alter table lead_progress      drop constraint if exists lead_progress_student_id_fkey;
alter table lead_progress      add  constraint lead_progress_student_id_fkey
  foreign key (student_id) references profiles(id) on delete cascade;

alter table wig_meetings       drop constraint if exists wig_meetings_student_id_fkey;
alter table wig_meetings       add  constraint wig_meetings_student_id_fkey
  foreign key (student_id) references profiles(id) on delete cascade;

alter table parent_invitations drop constraint if exists parent_invitations_student_id_fkey;
alter table parent_invitations add  constraint parent_invitations_student_id_fkey
  foreign key (student_id) references profiles(id) on delete cascade;

-- ===== RPC xoá người dùng (admin) =====
create or replace function admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth_role(), 'pending') <> 'admin' then
    raise exception 'Chỉ admin được xoá người dùng';
  end if;
  if p_user = auth.uid() then
    raise exception 'Không thể tự xoá chính mình';
  end if;
  delete from auth.users where id = p_user; -- cascade → profiles → dữ liệu con
end $$;
revoke execute on function admin_delete_user(uuid) from anon;
grant execute on function admin_delete_user(uuid) to authenticated;
