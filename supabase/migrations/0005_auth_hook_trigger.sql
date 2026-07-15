-- 0005 — Giới hạn miền email (data-driven) + trigger tạo profile khi có user mới.
-- Lớp 1 (chặn tạo user): hàm hook 'before user created' — BẬT trong Dashboard > Auth > Hooks (bước M2 [NGƯỜI]).
-- Lớp 2 (an toàn mặc định): trigger AFTER INSERT trên auth.users (chạy tự động).

create table signup_email_domains (
  domain text primary key,
  default_role user_role not null,
  created_at timestamptz not null default now()
);

insert into signup_email_domains (domain, default_role) values
  ('truongvietanh.com', 'pending'),        -- nhân sự: admin nâng quyền teacher/principal/admin
  ('student.truongvietanh.com', 'student'); -- học sinh: tự cấp role student

alter table signup_email_domains enable row level security;
create policy sed_read on signup_email_domains for select using (auth.uid() is not null);
create policy sed_admin_all on signup_email_domains for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- Lớp 2: tạo profile + gán role + nối parent_links từ lời mời.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_role user_role;
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
begin
  select default_role into v_role from signup_email_domains where domain = v_domain;

  if v_role is null then
    if exists (
      select 1 from parent_invitations
      where lower(email) = v_email and status in ('pending', 'accepted')
    ) then
      v_role := 'parent';
    else
      v_role := 'pending';
    end if;
  end if;

  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, v_full_name, v_role)
  on conflict (id) do nothing;

  if v_role = 'parent' then
    insert into parent_links (parent_id, student_id, relationship)
    select new.id, pi.student_id, 'guardian'
    from parent_invitations pi
    where lower(pi.email) = v_email and pi.status in ('pending', 'accepted')
    on conflict (parent_id, student_id) do nothing;

    update parent_invitations set status = 'accepted'
    where lower(email) = v_email and status = 'pending';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Lớp 1: hook 'before user created'. Trả object 'error' để từ chối tạo user sai miền
-- (trừ email đã được mời trong parent_invitations). PHẢI bật trong Dashboard và kiểm lại payload.
create or replace function restrict_signup_by_email_domain(event jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
  v_domain text := split_part(coalesce(v_email, ''), '@', 2);
begin
  if v_email is null or v_email = '' then
    return event;
  end if;

  if exists (select 1 from signup_email_domains where domain = v_domain)
     or exists (
       select 1 from parent_invitations
       where lower(email) = v_email and status in ('pending', 'accepted')
     ) then
    return event;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Email khong thuoc mien cho phep. Dung email truong hoac lien he quan tri vien.'
    )
  );
end;
$$;

grant execute on function restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;
revoke execute on function restrict_signup_by_email_domain(jsonb) from authenticated, anon, public;
