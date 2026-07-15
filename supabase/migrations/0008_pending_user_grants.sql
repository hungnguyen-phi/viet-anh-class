-- 0008 — Mời người dùng mới: gán sẵn vai trò (+ lớp/HS) theo email, áp dụng khi họ đăng nhập.

create table pending_user_grants (
  email text primary key,
  role user_role not null,
  class_id uuid references classes(id) on delete set null,   -- GVCN của lớp này / HS vào lớp này
  student_id uuid references profiles(id) on delete set null, -- phụ huynh của HS này
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table pending_user_grants enable row level security;
create policy pug_admin_all on pending_user_grants for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- handle_new_user: ưu tiên grant (nếu có) để set role + gán lớp/HS ngay khi đăng nhập lần đầu.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_role user_role;
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_grant pending_user_grants%rowtype;
begin
  select default_role into v_role from signup_email_domains where domain = v_domain;
  if v_role is null then
    if exists (select 1 from parent_invitations where lower(email) = v_email and status in ('pending','accepted')) then
      v_role := 'parent';
    else
      v_role := 'pending';
    end if;
  end if;

  -- Lời mời chủ động (admin tạo) ghi đè vai trò mặc định.
  select * into v_grant from pending_user_grants where lower(email) = v_email;
  if found then
    v_role := v_grant.role;
  end if;

  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, v_full_name, v_role)
  on conflict (id) do nothing;

  -- Áp dụng gán theo grant.
  if found then
    if v_grant.role = 'teacher' and v_grant.class_id is not null then
      update classes set homeroom_teacher_id = new.id where id = v_grant.class_id;
    elsif v_grant.role = 'student' and v_grant.class_id is not null then
      insert into enrollments (class_id, student_id) values (v_grant.class_id, new.id)
      on conflict (class_id, student_id) do nothing;
    elsif v_grant.role = 'parent' and v_grant.student_id is not null then
      insert into parent_links (parent_id, student_id, relationship)
      values (new.id, v_grant.student_id, 'guardian')
      on conflict (parent_id, student_id) do nothing;
    end if;
    delete from pending_user_grants where lower(email) = v_email;
  end if;

  -- Phụ huynh được mời qua parent_invitations (nối tất cả con + đánh dấu accepted).
  if v_role = 'parent' then
    insert into parent_links (parent_id, student_id, relationship)
    select new.id, pi.student_id, 'guardian'
    from parent_invitations pi
    where lower(pi.email) = v_email and pi.status in ('pending','accepted')
    on conflict (parent_id, student_id) do nothing;
    update parent_invitations set status = 'accepted'
    where lower(email) = v_email and status = 'pending';
  end if;

  return new;
end;
$$;
