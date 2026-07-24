-- 0029 — Thông báo (in-app) + Thời khoá biểu (mốc C: đủ 8 màn hình).
set search_path = public;

-- ============================================================
-- THÔNG BÁO: mỗi user đọc/đánh dấu đã đọc thông báo của mình.
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

alter table notifications enable row level security;
drop policy if exists notif_own_read on notifications;
create policy notif_own_read on notifications for select using (user_id = auth.uid());
drop policy if exists notif_own_update on notifications;
create policy notif_own_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on notifications to authenticated;

-- Sinh thông báo cho học sinh khi có biên bản họp WIG cá nhân MỚI (security definer → bỏ RLS để chèn).
create or replace function notify_student_meeting() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is not null then
    insert into notifications (user_id, title, body, link)
    values (new.student_id,
            'Có biên bản họp WIG tuần ' || coalesce(new.week_label, ''),
            left(coalesce(new.results, new.next_actions, ''), 200),
            '/student');
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_student_meeting on wig_meetings;
create trigger trg_notify_student_meeting after insert on wig_meetings
  for each row execute function notify_student_meeting();

-- ============================================================
-- THỜI KHOÁ BIỂU: ô theo (lớp, thứ, tiết). GVCN/Admin sửa; lớp/PH xem.
-- ============================================================
create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_no smallint not null check (period_no between 1 and 12),
  subject text not null,
  room text,
  created_at timestamptz not null default now(),
  unique (class_id, day_of_week, period_no)
);
create index if not exists idx_timetable_class on timetable_slots (class_id);

alter table timetable_slots enable row level security;
drop policy if exists tt_read on timetable_slots;
create policy tt_read on timetable_slots for select using (
  is_class_student(class_id) or staff_can_read_class(class_id) or is_parent_of_class(class_id)
);
drop policy if exists tt_manage on timetable_slots;
create policy tt_manage on timetable_slots for all
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
grant select, insert, update, delete on timetable_slots to authenticated;
