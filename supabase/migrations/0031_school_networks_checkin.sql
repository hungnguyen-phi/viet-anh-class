-- 0031 — Gộp "cảm xúc = điểm danh" + cổng IP (chỉ cho check-in khi ở mạng trường).
-- Trình duyệt KHÔNG đọc được SSID wifi → chặn theo IP công cộng của mạng trường thay thế.
-- Bảo mật: đường ghi duy nhất là hàm student_checkin() chỉ service_role gọi được; server
-- đọc IP thật từ header rồi truyền vào (client KHÔNG tự truyền IP giả được vì không gọi được hàm).

-- ============ 1) Danh sách mạng/IP của trường (admin/BGH khai báo) ============
create table if not exists school_networks (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references campuses(id) on delete cascade,   -- null = áp cho mọi cơ sở
  label text not null,
  cidr cidr not null,                 -- vd 123.16.0.0/24 hoặc 1.2.3.4/32
  is_active boolean not null default true,
  -- GPS geofence: chuẩn bị sẵn schema, CHƯA dùng (lat/lng/bán kính mét).
  geo_lat double precision,
  geo_lng double precision,
  geo_radius_m integer,
  created_at timestamptz not null default now()
);
create index if not exists school_networks_active_idx on school_networks(is_active);

alter table school_networks enable row level security;
drop policy if exists sn_read on school_networks;
create policy sn_read on school_networks for select using (auth.uid() is not null);
drop policy if exists sn_principal_manage on school_networks;
create policy sn_principal_manage on school_networks for all
  using (auth_role() = 'principal' and campus_id = auth_campus())
  with check (auth_role() = 'principal' and campus_id = auth_campus());
drop policy if exists sn_admin_all on school_networks;
create policy sn_admin_all on school_networks for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

grant select, insert, update, delete on school_networks to authenticated;

-- ============ 2) Kiểm tra IP có thuộc mạng trường ============
-- Không có mạng nào khai báo (chưa cấu hình) → cho qua (grace, tránh khoá cả trường trước khi set up).
create or replace function ip_allowed(p_ip text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  if not exists (select 1 from school_networks where is_active) then
    return true; -- chưa cấu hình → không chặn
  end if;
  begin
    select exists(
      select 1 from school_networks where is_active and p_ip::inet <<= cidr::inet
    ) into v_ok;
  exception when others then
    v_ok := false; -- IP rỗng/không hợp lệ → coi như ngoài trường
  end;
  return coalesce(v_ok, false);
end $$;

-- ============ 3) Check-in: cảm xúc + điểm danh "có mặt" trong 1 lần, có cổng IP ============
-- Trả 'ok' | 'blocked' (ngoài trường) | 'no_class' (chưa xếp lớp).
-- p_ip do SERVER truyền (IP thật từ header) → an toàn. Chỉ service_role gọi được (revoke ở dưới).
create or replace function student_checkin(p_student uuid, p_mood mood_level, p_ip text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  if not ip_allowed(p_ip) then
    return 'blocked';
  end if;
  select class_id into v_class from enrollments
    where student_id = p_student and is_active limit 1;

  insert into mood_checkins (student_id, class_id, date, mood)
    values (p_student, v_class, current_date, p_mood)
    on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();

  if v_class is null then
    return 'no_class';
  end if;

  -- Cảm xúc = điểm danh: đánh "có mặt". KHÔNG đè nếu GV đã đánh Trễ/Có phép.
  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, current_date, 'present', p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        when attendance_records.status in ('excused','late') then attendance_records.status
        else 'present'
      end;

  return 'ok';
end $$;

-- Chỉ server (service_role) được gọi → client không thể bỏ qua cổng IP.
revoke all on function student_checkin(uuid, mood_level, text) from public;
revoke all on function ip_allowed(text) from public;
grant execute on function student_checkin(uuid, mood_level, text) to service_role;
grant execute on function ip_allowed(text) to service_role;

-- ============ 4) Khoá đường ghi cũ (chống lách cổng IP) ============
-- Trước đây học sinh tự ghi mood qua RLS/insert + RPC set_my_mood (KHÔNG kiểm IP).
-- Gỡ các đường đó → chỉ còn student_checkin (service_role, có IP). Giữ quyền ĐỌC của học sinh.
drop policy if exists mc_student_insert on mood_checkins;
drop policy if exists mc_student_update on mood_checkins;
revoke execute on function set_my_mood(mood_level) from authenticated;
