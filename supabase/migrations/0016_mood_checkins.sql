-- 0016 — Mood check-in: cảm xúc hằng ngày của học sinh (redesign v3).
-- Mỗi học sinh 1 bản ghi/ngày; chỉ sửa được trong ngày hôm nay.
-- Nhân sự lớp (GVCN/BGH/Admin) và phụ huynh của em được xem.

create type mood_level as enum ('great', 'good', 'ok', 'low', 'bad');

create table mood_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  date date not null default current_date,
  mood mood_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);
create index idx_mood_checkins_student on mood_checkins (student_id, date desc);
create index idx_mood_checkins_class on mood_checkins (class_id, date desc);

alter table mood_checkins enable row level security;

-- Học sinh: đọc của mình; ghi/sửa của mình chỉ cho ngày hôm nay.
create policy mc_student_read on mood_checkins for select using (student_id = auth.uid());
create policy mc_student_insert on mood_checkins for insert
  with check (student_id = auth.uid() and date = current_date);
create policy mc_student_update on mood_checkins for update
  using (student_id = auth.uid() and date = current_date)
  with check (student_id = auth.uid() and date = current_date);

-- Nhân sự lớp + phụ huynh: chỉ đọc.
create policy mc_staff_read on mood_checkins for select using (
  is_my_child(student_id)
  or exists (
    select 1 from enrollments e
    where e.student_id = mood_checkins.student_id and staff_can_read_class(e.class_id)
  )
);

-- Admin toàn quyền.
create policy mc_admin_all on mood_checkins for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

grant select, insert, update on mood_checkins to authenticated;

-- Học sinh đặt cảm xúc hôm nay (định danh server: date=current_date, tự gán class).
-- Security definer nhưng chỉ ghi đúng hàng của auth.uid() → an toàn.
create or replace function set_my_mood(p_mood mood_level)
returns void language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  select class_id into v_class from enrollments
  where student_id = auth.uid() and is_active limit 1;
  insert into mood_checkins (student_id, class_id, date, mood)
  values (auth.uid(), v_class, current_date, p_mood)
  on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();
end $$;
grant execute on function set_my_mood(mood_level) to authenticated;
