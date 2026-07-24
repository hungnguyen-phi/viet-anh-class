-- 0030 — Quản trị liên kết: Khối (grades) thành thực thể, cấu hình Môn (area_config),
-- và cờ archive cho Lớp. Toàn bộ ADDITIVE & non-destructive. RLS nhân theo 0004_rls_policies.
-- Idempotent (if not exists / drop policy if exists / on conflict) để áp lại an toàn.

-- ============ 1) KHỐI (grades) — thuộc Cơ sở ============
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campus_id, name)
);
create index if not exists grades_campus_idx on grades(campus_id);

alter table grades enable row level security;
-- Đọc: mọi người đã đăng nhập (giống campuses).
drop policy if exists grade_read on grades;
create policy grade_read on grades for select using (auth.uid() is not null);
-- BGH: quản lý khối trong campus mình phụ trách.
drop policy if exists grade_principal_manage on grades;
create policy grade_principal_manage on grades for all
  using (auth_role() = 'principal' and campus_id = auth_campus())
  with check (auth_role() = 'principal' and campus_id = auth_campus());
-- Admin toàn quyền.
drop policy if exists grade_admin_all on grades;
create policy grade_admin_all on grades for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

grant select, insert, update, delete on grades to authenticated;

-- ============ 2) LỚP: gắn khối (grade_id) + cờ archive (is_active) ============
alter table classes add column if not exists grade_id uuid references grades(id) on delete set null;
alter table classes add column if not exists is_active boolean not null default true;
create index if not exists classes_grade_idx on classes(grade_id);
create index if not exists classes_campus_active_idx on classes(campus_id, is_active);

-- Backfill: dựng khối từ cột text 'grade' cũ, rồi liên kết grade_id (giữ 'grade' để tương thích ngược).
insert into grades (campus_id, name)
  select distinct campus_id, btrim(grade)
  from classes
  where grade is not null and btrim(grade) <> ''
  on conflict (campus_id, name) do nothing;

update classes c
  set grade_id = g.id
  from grades g
  where g.campus_id = c.campus_id
    and g.name = btrim(c.grade)
    and c.grade_id is null
    and c.grade is not null and btrim(c.grade) <> '';

-- Không cần policy mới cho archive: policy update lớp của admin/principal/teacher đã có (0004).

-- ============ 3) MÔN: cấu hình 4 lĩnh vực 4DX ============
create table if not exists area_config (
  area wig_area primary key,
  label_vi text not null,
  label_en text not null,
  color_hex text not null,
  soft_rgba text not null,
  icon_name text not null,
  default_unit text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table area_config enable row level security;
drop policy if exists area_read on area_config;
create policy area_read on area_config for select using (auth.uid() is not null);
drop policy if exists area_admin_all on area_config;
create policy area_admin_all on area_config for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

grant select, insert, update, delete on area_config to authenticated;

-- Seed = ĐÚNG giá trị đang hiển thị (map SUBJ trong page.tsx + messages class.areas.*)
-- ⇒ frontend đọc bảng này ra kết quả y hệt, giao diện KHÔNG đổi.
insert into area_config (area, label_vi, label_en, color_hex, soft_rgba, icon_name, default_unit, sort_order) values
  ('knowledge','Kiến thức','Knowledge','#3a62c9','rgba(58,98,201,0.14)','BookOpen',  null, 0),
  ('skills',   'Kỹ năng',  'Skills',   '#557f3c','rgba(85,127,60,0.14)','Sparkles',  null, 1),
  ('english',  'Tiếng Anh','English',  '#0e7c86','rgba(14,124,134,0.14)','Languages',null, 2),
  ('physical', 'Thể chất', 'Physical', '#cf5a42','rgba(207,90,66,0.14)','Bike',      null, 3)
on conflict (area) do nothing;

-- ============ 4) Vá GRANT còn thiếu cho campuses ============
-- 0015 chỉ cấp SELECT trên campuses ⇒ admin không insert/update/delete được (tạo/sửa/lưu-trữ/xoá
-- cơ sở fail 42501). RLS campus_admin_all vẫn là lớp chốt (chỉ admin ghi được).
grant insert, update, delete on campuses to authenticated;
