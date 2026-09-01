-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0162 — PA2 NỀN: đơn vị, tuần học, nhóm, mẫu mục tiêu + cột nhập hộ + helper nền.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Chủ dự án 01/09/2026: xây thẳng mô hình mục tiêu mới (PA2), không song song, không di trú.
-- Đặc tả: docs/PA2/ (bản chốt). Tệp này CHỈ THÊM — không sửa/xoá đối tượng mô hình cũ (drop ở 0168).
--
-- Vì sao tệp này là "nền": năm bảng dưới đây (don_vi, tuan_hoc, nhom, nhom_thanh_vien, muc_tieu_mau)
-- và sáu helper là thứ mà 0163–0167 (muc_tieu / thuoc / cam_ket / hub) FK và gọi tới. Không có
-- chúng thì các tệp sau không create được (hàm language sql bị parse ngay lúc CREATE). Ngoài ra tệp
-- này mở hai cột "nhập hộ" cho lớp nhỏ (khối 1-3, thầy cô gõ NỘI DUNG thay em, chữ ký vẫn của em),
-- gắn dòng lĩnh vực "Khác" vào area_config, và VIẾT LẠI tao_buddy_nhom để nó chiếu buddy_pairs sang
-- bảng nhom (bản 0153 đang chạy chỉ ghi buddy_pairs, chưa biết gì về nhom — đọc pg_proc rồi mới đè).
--
-- Điều kiện chạy: sau 0161 (đã thêm giá trị enum wig_domain 'khac' — tệp này DÙNG 'khac').
-- Mọi tên bảng/cột theo BẢNG TÊN CHỐT 00-TONG-QUAN §3; DDL chép từ 10-SCHEMA §1; RLS từ 20-QUYEN §2.1–2.4.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 1. don_vi — đơn vị đo là BẢNG, không suy từ chuỗi (lật 5.6 #8). Quy đổi giữa hai đơn vị KHÔNG ở
--    đây — nó nằm ở noi.he_so của từng dây (0165).
-- ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists don_vi (
  id         uuid primary key default gen_random_uuid(),
  ma         text not null,
  nhan_vi    text not null,
  nhan_en    text not null,
  is_active  boolean not null default true,
  created_by uuid null default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dv_ma_ck check (ma = btrim(ma) and ma <> '' and length(ma) <= 40)
);
alter table don_vi enable row level security;
revoke all on table don_vi from anon;
grant select, insert, update, delete on don_vi to authenticated;
create unique index if not exists don_vi_ma_uidx on don_vi (lower(ma));

insert into don_vi (ma, nhan_vi, nhan_en) values
  ('lan', 'lần', 'times'), ('bai', 'bài', 'exercises'), ('buoi', 'buổi', 'sessions'),
  ('phut', 'phút', 'minutes'), ('km', 'km', 'km'), ('diem', 'điểm', 'points'),
  ('phan_tram', '%', '%'), ('trang', 'trang', 'pages'), ('cau', 'câu', 'questions'),
  ('khach_quan_tam', 'khách quan tâm', 'leads')
on conflict do nothing;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 2. tuan_hoc — lịch tuần của cơ sở. KHÔNG có dòng = tuần học bình thường. 'thi' tính như 'hoc';
--    'nghi' KHÔNG chặn ghi, chỉ đổi cách tính (30-PHEP-TINH §1.2). week_start LUÔN là thứ Hai.
-- ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists tuan_hoc (
  campus_id  uuid not null references campuses(id) on delete cascade,
  week_start date not null,
  loai       text not null default 'hoc',
  created_by uuid null default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (campus_id, week_start),
  constraint tuanhoc_thu_hai_ck check (extract(isodow from week_start) = 1),
  constraint tuanhoc_loai_ck    check (loai in ('hoc','nghi','thi'))
);
alter table tuan_hoc enable row level security;
revoke all on table tuan_hoc from anon;
grant select, insert, update, delete on tuan_hoc to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 3. nhom + nhom_thanh_vien — nhóm trong lớp. loai='buddy' là bản CHIẾU từ buddy_pairs (xem §8);
--    loai='to'/'khac' là nhóm thầy cô tự lập. Mỗi em một dòng thành viên, gỡ = is_active=false (C9).
-- ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists nhom (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  ten        text not null,
  loai       text not null default 'to',
  is_active  boolean not null default true,
  created_by uuid null default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nhom_loai_ck check (loai in ('to','buddy','khac')),
  constraint nhom_ten_ck  check (ten = btrim(ten) and ten <> '' and length(ten) <= 80)
);
alter table nhom enable row level security;
revoke all on table nhom from anon;
grant select, insert, update, delete on nhom to authenticated;

create table if not exists nhom_thanh_vien (
  id         uuid primary key default gen_random_uuid(),
  nhom_id    uuid not null references nhom(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nhom_id, student_id)
);
alter table nhom_thanh_vien enable row level security;
revoke all on table nhom_thanh_vien from anon;
grant select, insert, update, delete on nhom_thanh_vien to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 4. muc_tieu_mau — mẫu mục tiêu của lớp (em chỉ điền số vào chỗ x_goi_y/y_goi_y). Trần 8 mẫu/lớp
--    ở trigger mtm_tran_tam. linh_vuc tái dùng enum wig_domain (đã có 'khac' từ 0161).
-- ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists muc_tieu_mau (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  ten        text not null,
  linh_vuc   wig_domain not null,
  subject_id uuid null references subjects(id) on delete set null,
  don_vi_id  uuid null references don_vi(id) on delete restrict,
  kieu_dich  text not null default 'toi',
  chieu      text not null default 'tang',
  x_goi_y    numeric null,
  y_goi_y    numeric null,
  is_active  boolean not null default true,
  created_by uuid null default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mtm_ten_ck   check (ten = btrim(ten) and ten <> '' and length(ten) <= 200),
  constraint mtm_kieu_ck  check (kieu_dich in ('toi','tran_tich_luy','giu','toc_do_ky','ti_le_dat','chu')),
  constraint mtm_chieu_ck check (chieu in ('tang','giam','giu'))
);
alter table muc_tieu_mau enable row level security;
revoke all on table muc_tieu_mau from anon;
grant select, insert, update, delete on muc_tieu_mau to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 5. Cột thêm vào bảng GIỮ + dòng area_config('khac').
-- ───────────────────────────────────────────────────────────────────────────────────────────
alter table classes add column if not exists nhap_ho boolean not null default false;
comment on column classes.nhap_ho is
  'Lớp nhỏ (khối 1-3): thầy cô nhập NỘI DUNG ba tầng và sáu câu thay em; chữ ký vẫn của em/bạn cùng nhóm. BGH cùng cơ sở + admin bật [H-15].';

alter table pdr_meetings add column if not exists nguoi_nhap_ho uuid references profiles(id) on delete set null;
comment on column pdr_meetings.nguoi_nhap_ho is
  'Thầy cô gõ sáu câu thay em (lớp nhap_ho). KPI "% em tự làm" loại các dòng này.';

-- Dòng lĩnh vực "Khác". LỆCH ĐẶC TẢ CÓ CHỦ Ý (xem chú thích cuối tệp): icon_name PascalCase
-- 'CircleDashed' và soft_rgba alpha .14 theo house style thật của 4 dòng đang chạy, KHÔNG phải
-- 'circle-dashed'/.12 mà 10-SCHEMA §1.5 chép nhầm — nếu để chữ thường thì Lucide không render nổi icon.
insert into area_config (area, label_vi, label_en, color_hex, soft_rgba, icon_name, default_unit, sort_order)
values ('khac', 'Khác', 'Other', '#6b7093', 'rgba(107,112,147,0.14)', 'CircleDashed', null, 99)
on conflict (area) do nothing;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 6. Helper nền (language sql, definer). lop_nhap_ho đọc classes.nhap_ho nên phải nằm SAU alter §5;
--    nhom_class/em_trong_nhom đọc bảng nhom nên phải nằm SAU §3. Grant ở khối §11.
-- ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.thuoc_co_so(p_campus uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_campus is not null and (
       (select auth_role()) = 'admin'
    or (select auth_campus()) = p_campus
    or exists (select 1 from enrollments e join classes c on c.id = e.class_id
               where e.student_id = (select auth.uid()) and e.is_active and c.campus_id = p_campus)
    or exists (select 1 from parent_links pl join enrollments e on e.student_id = pl.student_id
               join classes c on c.id = e.class_id
               where pl.parent_id = (select auth.uid()) and e.is_active and c.campus_id = p_campus)
    or exists (select 1 from classes c where c.homeroom_teacher_id = (select auth.uid()) and c.campus_id = p_campus)
    or exists (select 1 from teaching_assignments ta join classes c on c.id = ta.class_id
               where ta.teacher_id = (select auth.uid()) and ta.is_active and c.campus_id = p_campus));
$$;

create or replace function public.lop_nhap_ho(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nhap_ho from classes where id = c), false);
$$;

create or replace function public.la_gvbm_mon(c uuid, s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s is not null and exists (select 1 from teaching_assignments
    where class_id = c and subject_id = s and teacher_id = (select auth.uid()) and is_active);
$$;

create or replace function public.nhom_class(n uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from nhom where id = n; $$;

create or replace function public.em_trong_nhom(n uuid, s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from nhom_thanh_vien v join nhom g on g.id = v.nhom_id
                 where v.nhom_id = n and v.student_id = s and v.is_active and g.is_active);
$$;

create or replace function public.la_thanh_vien_nhom(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select em_trong_nhom(n, (select auth.uid()));
$$;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 7. Trigger dữ liệu THUẦN (không yếu tố vai — chạy cho cả service_role).
-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 7a. nhom_thanh_vien: thành viên phải đang ghi danh lớp của nhóm. Gỡ (is_active=false) không kiểm.
create or replace function private.ntv_hop_le() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  if not new.is_active then return new; end if;
  select class_id into v_class from nhom where id = new.nhom_id;
  if v_class is null then
    raise exception 'Nhóm không tồn tại' using errcode = '23503';
  end if;
  if not exists (select 1 from enrollments e
                 where e.class_id = v_class and e.student_id = new.student_id and e.is_active) then
    raise exception 'Chỉ thêm được học sinh đang học lớp này vào nhóm' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function private.ntv_hop_le() from public, anon, authenticated;
drop trigger if exists trg_ntv_hop_le on nhom_thanh_vien;
create trigger trg_ntv_hop_le before insert or update on nhom_thanh_vien
  for each row execute function private.ntv_hop_le();

-- 7b. muc_tieu_mau: tối đa 8 mẫu ĐANG DÙNG một lớp.
create or replace function private.mtm_tran_tam() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active and (select count(*) from muc_tieu_mau m
       where m.class_id = new.class_id and m.is_active and m.id <> new.id) >= 8 then
    raise exception 'Tối đa 8 mẫu.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.mtm_tran_tam() from public, anon, authenticated;
drop trigger if exists trg_mtm_tran_tam on muc_tieu_mau;
create trigger trg_mtm_tran_tam before insert or update on muc_tieu_mau
  for each row execute function private.mtm_tran_tam();

-- 7c. nhom: nhóm loai='buddy' là bản chiếu từ buddy_pairs — người KHÔNG được sửa/xoá tay, chỉ máy
--     chiếu (cờ va.chieu_buddy, do tao_buddy_nhom đặt). Không đụng nhóm 'to'/'khac' của thầy cô.
create or replace function private.nhom_buddy_chi_may() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.loai = 'buddy'
     and (select auth.uid()) is not null
     and coalesce(current_setting('va.chieu_buddy', true), '') <> '1' then
    raise exception 'Nhóm bạn học sửa ở trang Danh sách lớp' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.nhom_buddy_chi_may() from public, anon, authenticated;
drop trigger if exists trg_nhom_buddy_chi_may on nhom;
create trigger trg_nhom_buddy_chi_may before update or delete on nhom
  for each row execute function private.nhom_buddy_chi_may();

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 8. protect_class_privileged_cols — MỞ RỘNG cho cột nhap_ho (đọc pg_get_functiondef + md5 trước).
--    Trigger trg_protect_class_cols đã có sẵn trên classes; chỉ đè hàm, giữ nguyên trigger.
--    Cột cũ (homeroom_teacher_id/campus_id) giữ luật chỉ-admin; nhap_ho: admin HOẶC BGH cùng cơ sở [H-15].
-- ───────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v text := md5(pg_get_functiondef('public.protect_class_privileged_cols()'::regprocedure));
begin
  if v = '2afddd14d0430c4ae77dc285fefe53c7' then
    raise notice '0162: protect_class_privileged_cols đã là bản PA2, đè lại y nguyên';
  elsif v <> 'a2ed0e5f556dba52a879b66d5c40af90' then
    raise exception '0162: protect_class_privileged_cols trên production đã khác bản đọc 01/09 (%) — đọc lại pg_proc trước khi đè', v;
  end if;
end $$;

create or replace function public.protect_class_privileged_cols() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.homeroom_teacher_id is distinct from old.homeroom_teacher_id
      or new.campus_id is distinct from old.campus_id)
     and coalesce(auth_role(), 'pending') <> 'admin'
     -- Lối đi duy nhất: chính handle_new_user đang gán lớp cho giáo viên vừa đăng nhập lần đầu.
     -- Cờ đặt bằng set_config(..., true) nên chỉ sống trong transaction ấy, không rò ra ngoài.
     and coalesce(current_setting('app.gan_lop_khi_dang_ky', true), '') <> '1' then
    raise exception 'Chỉ admin được đổi GVCN hoặc cơ sở của lớp';
  end if;
  -- PA2: bật/tắt lớp nhập hộ (khối 1-3, thầy cô gõ NỘI DUNG thay em). Chỉ admin, hoặc BGH của
  -- chính cơ sở lớp này. Các cột đặc quyền cũ ở trên KHÔNG nới cho BGH.
  if new.nhap_ho is distinct from old.nhap_ho
     and not (coalesce(auth_role(), 'pending') = 'admin'
              or (auth_role() = 'principal' and is_campus_class(new.id))) then
    raise exception 'Chỉ admin hoặc ban giám hiệu cơ sở được bật/tắt lớp nhập hộ';
  end if;
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 9. tao_buddy_nhom — VIẾT LẠI để chiếu buddy_pairs sang nhom (bản 0153 chỉ ghi buddy_pairs).
--    Giữ INVOKER: insert chạy dưới quyền người gọi → RLS bp_manage + rls_manage_nhom/ntv + trigger
--    0146/0151 vẫn là chốt thật. Thêm hai luật mô hình nhóm: 2–3 em khác nhau; em nào đang có nhóm
--    buddy khác thì gỡ trước. Cả hàm là MỘT giao dịch — một cặp bị chặn thì cả nhóm không ra đời.
-- ───────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v text := md5(pg_get_functiondef('public.tao_buddy_nhom(uuid,uuid[])'::regprocedure));
begin
  if v = 'd00cfab66a82cfd481e4c1d792cea605' then
    raise notice '0162: tao_buddy_nhom đã là bản PA2, đè lại y nguyên';
  elsif v <> '3ebd8df88a89f0434394de9138c9f8d5' then
    raise exception '0162: tao_buddy_nhom trên production đã khác bản đọc 01/09 (%) — đọc lại pg_proc trước khi đè', v;
  end if;
end $$;

create or replace function public.tao_buddy_nhom(p_class uuid, p_members uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  n int;
  i int;
  j int;
  v_m uuid;
  v_nhom uuid;
begin
  select count(distinct m) into n from unnest(p_members) m;
  if n < 2 or n > 3 or n <> coalesce(array_length(p_members, 1), 0) then
    raise exception 'Nhóm buddy gồm 2 hoặc 3 học sinh khác nhau' using errcode = '23514';
  end if;
  if exists (
    select 1 from buddy_pairs b
    where b.is_active
      and (b.student_id = any(p_members) or b.buddy_id = any(p_members))
  ) then
    raise exception 'Có em đã ở một nhóm buddy khác — gỡ nhóm cũ trước' using errcode = '23514';
  end if;
  -- Mọi cặp đôi một, đầu nhỏ đứng trước (buddy_thu_tu_ck). Cả vòng lặp là MỘT giao dịch.
  for i in 1..n - 1 loop
    for j in i + 1..n loop
      insert into buddy_pairs (class_id, student_id, buddy_id, created_by)
      values (p_class,
              least(p_members[i], p_members[j]),
              greatest(p_members[i], p_members[j]),
              (select auth.uid()));
    end loop;
  end loop;

  -- Chiếu sang nhom. Cờ va.chieu_buddy báo cho trg_nhom_buddy_chi_may / trg_ntv_hop_le biết đây là
  -- máy chiếu (không phải người sửa tay). Cờ set_config(..., true) chỉ sống trong transaction này.
  perform set_config('va.chieu_buddy', '1', true);
  -- Gỡ nhóm bạn cũ còn "sống" mà dính bất kỳ em nào trong nhóm mới (bình thường không có, vì đã chặn
  -- em đang ở nhóm khác ở trên); rồi dọn nhóm bạn nào không còn thành viên sống — mỗi em đúng một nhóm.
  update nhom_thanh_vien v set is_active = false
    from nhom g
   where g.id = v.nhom_id and g.class_id = p_class and g.loai = 'buddy' and g.is_active
     and v.is_active and v.student_id = any (p_members);
  update nhom g set is_active = false
   where g.class_id = p_class and g.loai = 'buddy' and g.is_active
     and not exists (select 1 from nhom_thanh_vien v where v.nhom_id = g.id and v.is_active);
  -- Nhóm mới nguyên khối
  insert into nhom (class_id, ten, loai) values (p_class, 'Nhóm bạn học', 'buddy')
    returning id into v_nhom;
  foreach v_m in array p_members loop
    insert into nhom_thanh_vien (nhom_id, student_id, is_active) values (v_nhom, v_m, true)
    on conflict (nhom_id, student_id) do update set is_active = true;
  end loop;
  perform set_config('va.chieu_buddy', '', true);
end $$;
-- Hàm mới nào cũng revoke public/anon trước khi grant (đừng lặp lỗ 0151).
revoke all on function public.tao_buddy_nhom(uuid, uuid[]) from public, anon;
grant execute on function public.tao_buddy_nhom(uuid, uuid[]) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 10. Policy (20-QUYEN §2.1–2.4). Admin luôn có rls_all_<bảng>. Mọi policy to authenticated.
--     drop-then-create để tệp dán lại được (Postgres không có create policy if not exists).
-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 10.1 don_vi — ai cũng đọc; chỉ thầy cô/BGH/admin thêm; không sửa/xoá (admin qua rls_all) [H-17].
drop policy if exists rls_select_don_vi on don_vi;
create policy rls_select_don_vi on don_vi for select to authenticated using (true);
drop policy if exists rls_staff_ghi_don_vi on don_vi;
create policy rls_staff_ghi_don_vi on don_vi for insert to authenticated
  with check ((select auth_role()) in ('teacher','principal','admin') and created_by = (select auth.uid()));
drop policy if exists rls_all_don_vi on don_vi;
create policy rls_all_don_vi on don_vi for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 10.2 tuan_hoc
drop policy if exists rls_select_tuan_hoc on tuan_hoc;
create policy rls_select_tuan_hoc on tuan_hoc for select to authenticated using (thuoc_co_so(campus_id));
drop policy if exists rls_bgh_ghi_tuan_hoc on tuan_hoc;
create policy rls_bgh_ghi_tuan_hoc on tuan_hoc for all to authenticated
  using ((select auth_role()) = 'principal' and campus_id = (select auth_campus()))
  with check ((select auth_role()) = 'principal' and campus_id = (select auth_campus()));
drop policy if exists rls_all_tuan_hoc on tuan_hoc;
create policy rls_all_tuan_hoc on tuan_hoc for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 10.3 nhom + nhom_thanh_vien
drop policy if exists rls_select_nhom on nhom;
create policy rls_select_nhom on nhom for select to authenticated
  using (is_class_student(class_id) or is_parent_of_class(class_id)
         or staff_can_read_class(class_id) or is_subject_teacher_of_class(class_id));
drop policy if exists rls_manage_nhom on nhom;
create policy rls_manage_nhom on nhom for all to authenticated
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
drop policy if exists rls_all_nhom on nhom;
create policy rls_all_nhom on nhom for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

drop policy if exists rls_select_ntv on nhom_thanh_vien;
create policy rls_select_ntv on nhom_thanh_vien for select to authenticated
  using (is_class_student(nhom_class(nhom_id)) or is_parent_of_class(nhom_class(nhom_id))
         or staff_can_read_class(nhom_class(nhom_id)) or is_subject_teacher_of_class(nhom_class(nhom_id)));
drop policy if exists rls_manage_ntv on nhom_thanh_vien;
create policy rls_manage_ntv on nhom_thanh_vien for all to authenticated
  using (staff_can_manage_class(nhom_class(nhom_id))) with check (staff_can_manage_class(nhom_class(nhom_id)));
drop policy if exists rls_all_ntv on nhom_thanh_vien;
create policy rls_all_ntv on nhom_thanh_vien for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 10.4 muc_tieu_mau
drop policy if exists rls_select_mtm on muc_tieu_mau;
create policy rls_select_mtm on muc_tieu_mau for select to authenticated
  using (is_class_student(class_id) or is_parent_of_class(class_id) or staff_can_read_class(class_id));
drop policy if exists rls_manage_mtm on muc_tieu_mau;
create policy rls_manage_mtm on muc_tieu_mau for all to authenticated
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
drop policy if exists rls_all_mtm on muc_tieu_mau;
create policy rls_all_mtm on muc_tieu_mau for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 11. Khối grant cuối tệp (L2). Chỉ sáu helper TỆP NÀY tạo (tao_buddy_nhom đã revoke/grant riêng
--     ở §9; ba trigger private đã revoke ngay dưới chỗ tạo). Hàm 0163+ chưa tồn tại nên KHÔNG grant.
-- ───────────────────────────────────────────────────────────────────────────────────────────
do $$ declare f text; begin
  foreach f in array array[
    'thuoc_co_so(uuid)','lop_nhap_ho(uuid)','la_gvbm_mon(uuid,uuid)',
    'nhom_class(uuid)','em_trong_nhom(uuid,uuid)','la_thanh_vien_nhom(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- GHI CHÚ LỆCH ĐẶC TẢ (để người sau khỏi tưởng lỗi):
--  · area_config('khac'): 10-SCHEMA §1.5 chép icon 'circle-dashed' + soft_rgba .12. Bốn dòng ĐANG
--    CHẠY dùng icon PascalCase (BookOpen/Sparkles/Heart/Bike) và alpha .14. Đã theo house style thật
--    → 'CircleDashed' + 'rgba(107,112,147,0.14)'. Chữ thường sẽ làm Lucide không render icon.
--  · nhom_buddy_chi_may KHÔNG nới cho admin (theo đúng phác 20-QUYEN §2.3: "uid không null và không
--    cờ va.chieu_buddy → 42501"). Admin muốn dọn nhóm buddy thì đi qua tao_buddy_nhom hoặc tắt lớp.
--  · tao_buddy_nhom: bản 0153 đang chạy md5=3ebd8df88a89f0434394de9138c9f8d5 (khớp repo 0153) — guard §9.
--    Việc "chiếu" ở nền này là forward: mỗi lần gọi tạo ĐÚNG một nhóm sống của p_members và dọn nhóm
--    buddy cũ dính các em ấy. Đồng bộ đầy đủ khi CHỈ huỷ cặp mà không gọi lại RPC là việc của app (PR-3/4).
-- ═══════════════════════════════════════════════════════════════════════════════════════════
