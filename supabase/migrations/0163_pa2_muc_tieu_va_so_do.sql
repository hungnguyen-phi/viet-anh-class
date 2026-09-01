-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0163 — PA2: MỤC TIÊU và SỐ ĐO. Chủ dự án 01/09/2026: xây thẳng PA2, không song song,
-- không di trú (đã sao lưu JSON). Đặc tả: docs/PA2/ (10 §2, 20 §1.1–1.2, §2.5–2.7, §3.2).
--
-- Vì sao tệp này: `muc_tieu` là thực thể sống trung tâm — bốn cấp (trường/lớp/nhóm/em), có đích,
-- có hạn, có VÒNG DUYỆT (nhap→gui→duyet/tra_lai→dong). Ba luật khó, phải đúng ở TẦNG DỮ LIỆU chứ
-- không ở màn: (1) thầy cô KHÔNG sửa NỘI DUNG mục tiêu của em — chỉ duyệt/trả lại (whitelist "cột
-- không phải nội dung", L5/L11); (2) trần ≤4 mục tiêu `duyet` và ≤2 `dang_tap_trung` một chủ thể
-- một năm; (3) `so_do` là "số đang ở" ghi theo NGÀY, có nguồn, không đè lịch sử. Số đọc phải khớp
-- đúng chủ của mục tiêu và không ghi tay được số mà máy tự cộng. Cột GENERATED (`chu_the_key`)
-- còn NULL trong BEFORE INSERT nên trigger tự ghép key từ cột gốc. Tệp CHỈ THÊM (drop ở 0168).
-- Phụ thuộc 0162 (don_vi, nhom, muc_tieu_mau, classes.nhap_ho, helper thuoc_co_so/lop_nhap_ho).
--
-- LỆCH ĐẶC TẢ CÓ CHỦ Ý (mt_truoc_xoa): 50-DI-TRU §1 + 10-SCHEMA §3.5 xếp mt_truoc_xoa Ở 0165 (thân
-- đọc cam_ket/noi — chưa có trước 0165). Vai trò tệp này lại giao "mt_truoc_xoa chặn xoá có nghĩa",
-- nên đặt SỚM tại đây, bọc hai vế cam_ket/noi bằng to_regclass để không đổ khi bảng chưa tồn tại
-- (0163→0165 chỉ chặn theo so_do — đủ, vì RLS rls_delete_muc_tieu đã chặn xoá dòng có so_do). 0165
-- `create or replace` lại hàm này (bản chuẩn, bỏ guard) + drop-if-exists trigger → không xung đột,
-- 0165 thắng. Giữ ở cả hai là lưới an toàn idempotent, KHÔNG phải trùng lặp gây lỗi.
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Whitelist dùng chung cho trigger duyệt lại (20 §1.4) — 0163 là tệp ĐẦU dùng nó
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.doi_noi_dung(p_old jsonb, p_new jsonb, p_khong_noi_dung text[])
returns boolean language sql immutable as $$
  select (p_new - p_khong_noi_dung) is distinct from (p_old - p_khong_noi_dung);
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Bảng muc_tieu (10 §2.1) — L1 ngay dưới create
-- ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists muc_tieu (
  id             uuid primary key default gen_random_uuid(),
  cap            text not null,
  campus_id      uuid not null references campuses(id) on delete cascade,
  class_id       uuid null references classes(id) on delete cascade,
  nhom_id        uuid null references nhom(id) on delete restrict,
  student_id     uuid null references profiles(id) on delete cascade,
  nam_hoc        text not null default current_school_year(),
  chu_the_key    text generated always as
                   (cap || ':' || coalesce(student_id::text, nhom_id::text, class_id::text, campus_id::text)) stored,
  ten            text not null,
  linh_vuc       wig_domain not null default 'knowledge',
  subject_id     uuid null references subjects(id) on delete set null,
  kieu_dich      text not null default 'toi',
  chieu          text not null default 'tang',
  x_so           numeric null,
  y_so           numeric null,
  chua_do_x      boolean not null default false,
  x_chu          text null,
  y_chu          text null,
  don_vi_id      uuid null references don_vi(id) on delete restrict,
  ky             text null,
  bat_dau        date not null default vn_today(),
  ket_thuc       date not null,
  nguon_so       text not null default 'ghi_tay',
  nguon_he_thong text null,
  gop_con        text null,
  gop_thanh_phan text null,
  nguong_con     numeric null,
  lay_tu         text null,
  mau_id         uuid null references muc_tieu_mau(id) on delete set null,
  trang_thai     text not null default 'nhap',
  duyet_boi      uuid null references profiles(id) on delete set null,
  duyet_at       timestamptz null,
  ly_do_tra_lai  text null,
  dong_boi       uuid null references profiles(id) on delete set null,
  dong_at        timestamptz null,
  ly_do_dong     text null,
  dang_tap_trung boolean not null default false,
  nguoi_nhap_ho  uuid null references profiles(id) on delete set null,
  created_by     uuid null default auth.uid() references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint mt_cap_ck        check (cap in ('truong','lop','nhom','em')),
  constraint mt_khoa_ck       check (
       (cap = 'truong' and class_id is null     and nhom_id is null     and student_id is null)
    or (cap = 'lop'    and class_id is not null and nhom_id is null     and student_id is null)
    or (cap = 'nhom'   and class_id is not null and nhom_id is not null and student_id is null)
    or (cap = 'em'     and class_id is not null and nhom_id is null     and student_id is not null)),
  constraint mt_ten_ck        check (ten = btrim(ten) and ten <> '' and length(ten) <= 200),
  constraint mt_kieu_ck       check (kieu_dich in ('toi','tran_tich_luy','giu','toc_do_ky','ti_le_dat','chu')),
  constraint mt_chieu_ck      check (chieu in ('tang','giam','giu')),
  constraint mt_so_dich_ck    check (kieu_dich = 'chu' or y_so is not null),
  constraint mt_chu_ck        check (kieu_dich <> 'chu' or y_chu is not null),
  constraint mt_y_can_x_ck    check (kieu_dich <> 'toi' or x_so is not null or chua_do_x),
  constraint mt_chieu_thuan_ck check (kieu_dich <> 'toi' or x_so is null or chieu = 'giu'
                                   or (chieu = 'tang' and x_so < y_so) or (chieu = 'giam' and x_so > y_so)),
  constraint mt_tran_giu_ck   check (kieu_dich <> 'tran_tich_luy' or chieu = 'giu'),
  constraint mt_ky_gia_tri_ck check (ky is null or ky in ('tuan','hai_tuan','thang')),
  constraint mt_ky_can_ck     check (kieu_dich not in ('toc_do_ky','giu') or ky is not null),
  constraint mt_nguon_ck      check (nguon_so in ('thuoc','ghi_tay','he_thong','con','thanh_phan')),
  constraint mt_nguon_con_ck  check (nguon_so <> 'con' or (cap <> 'em' and gop_con is not null)),
  constraint mt_gop_con_ck    check (gop_con is null or gop_con in ('cong','trung_binh','ti_le_dat')),
  constraint mt_gop_tp_ck     check ((nguon_so = 'thanh_phan') = (gop_thanh_phan is not null)),
  constraint mt_gop_tp_gia_tri_ck check (gop_thanh_phan is null or gop_thanh_phan in ('cong','trung_binh')),
  constraint mt_ti_le_ck      check (kieu_dich <> 'ti_le_dat' or lay_tu is not null),
  constraint mt_lay_tu_ck     check (lay_tu is null or lay_tu in ('thuoc','muc_tieu_em','muc_tieu_lop')),
  constraint mt_don_vi_ck     check (kieu_dich in ('chu','ti_le_dat') or don_vi_id is not null),
  constraint mt_ngay_ck       check (bat_dau <= ket_thuc),
  constraint mt_he_thong_ck   check ((nguon_so = 'he_thong') = (nguon_he_thong is not null)),
  constraint mt_nguon_ht_ck   check (nguon_he_thong is null or nguon_he_thong in ('diem_danh')),
  constraint mt_trang_thai_ck check (trang_thai in ('nhap','gui','duyet','tra_lai','dong')),
  constraint mt_ly_do_dong_ck check (ly_do_dong is null or ly_do_dong in ('dat','doi','bo'))
);
alter table muc_tieu enable row level security;
revoke all on table muc_tieu from anon;
grant select, insert, update, delete on muc_tieu to authenticated;
create index if not exists idx_muc_tieu_class   on muc_tieu (class_id, trang_thai) where class_id is not null;
create index if not exists idx_muc_tieu_student on muc_tieu (student_id) where student_id is not null;
create index if not exists idx_muc_tieu_truong  on muc_tieu (campus_id) where cap = 'truong';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. moc_muc_tieu, thanh_phan, lich_su_dich (10 §2.2)
-- ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists moc_muc_tieu (
  id          uuid primary key default gen_random_uuid(),
  muc_tieu_id uuid not null references muc_tieu(id) on delete cascade,
  ngay        date not null,
  gia_tri     numeric not null,
  created_by  uuid null default auth.uid() references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (muc_tieu_id, ngay)
);
alter table moc_muc_tieu enable row level security;
revoke all on table moc_muc_tieu from anon;
grant select, insert, update, delete on moc_muc_tieu to authenticated;

create table if not exists thanh_phan (
  id          uuid primary key default gen_random_uuid(),
  muc_tieu_id uuid not null references muc_tieu(id) on delete cascade,
  ten         text not null,
  thu_tu      smallint not null default 1,
  nguong      numeric null,
  created_at  timestamptz not null default now(),
  constraint tp_ten_ck check (ten = btrim(ten) and ten <> '' and length(ten) <= 80)
);
alter table thanh_phan enable row level security;
revoke all on table thanh_phan from anon;
grant select, insert, update, delete on thanh_phan to authenticated;

create table if not exists lich_su_dich (
  id           uuid primary key default gen_random_uuid(),
  muc_tieu_id  uuid not null references muc_tieu(id) on delete cascade,
  x_cu numeric null,  y_cu numeric null,  ket_thuc_cu date null,
  x_moi numeric null, y_moi numeric null, ket_thuc_moi date null,
  ai           uuid null references profiles(id) on delete set null,
  luc          timestamptz not null default now()
);
alter table lich_su_dich enable row level security;
revoke all on table lich_su_dich from anon;
grant select, insert, update, delete on lich_su_dich to authenticated;
create index if not exists idx_lsd_muc_tieu on lich_su_dich (muc_tieu_id, luc);

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. so_do — số đọc theo NGÀY, có nguồn (ghi thêm, không đè) (10 §2.3)
-- ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists so_do (
  id            uuid primary key default gen_random_uuid(),
  muc_tieu_id   uuid not null references muc_tieu(id) on delete cascade,
  thanh_phan_id uuid null references thanh_phan(id) on delete cascade,
  student_id    uuid null references profiles(id) on delete cascade,
  ngay          date not null,
  gia_tri       numeric not null,
  nguon         text not null default 'tay',
  nguon_ref     uuid null,
  nguoi_ghi     uuid null references profiles(id) on delete set null,
  nguoi_sua     uuid null references profiles(id) on delete set null,
  sua_at        timestamptz null,
  created_at    timestamptz not null default now(),
  constraint sd_nguon_ck check (nguon in ('tay','he_thong'))
);
alter table so_do enable row level security;
revoke all on table so_do from anon;
grant select, insert, update, delete on so_do to authenticated;
create index if not exists idx_so_do_doc on so_do (muc_tieu_id, ngay desc, created_at desc);
-- Điểm danh chỉ upsert MỘT dòng he_thong mỗi (mục tiêu, ngày) — chốt idempotent cho trigger 0167.
create unique index if not exists so_do_he_thong_uidx on so_do (muc_tieu_id, ngay)
  where nguon = 'he_thong' and thanh_phan_id is null and student_id is null;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. Helper CHỦ THỂ (20 §1.1) + tra cứu theo id (20 §1.2) — public, definer, đặt TRƯỚC policy
--    doc = đọc được dòng của chủ thể; ghi = ghi NỘI DUNG (chưa duyệt); duyet = người duyệt cấp này.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.doc_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_cap
    when 'em'     then p_student = (select auth.uid())
                    or is_my_child(p_student)
                    or staff_can_read_class(p_class)                       -- BGH đọc dòng thô [H-13]
    when 'nhom'   then is_class_student(p_class) or is_parent_of_class(p_class)
                    or staff_can_read_class(p_class)                       -- cả lớp thấy dòng cấp nhóm (C24)
    when 'lop'    then is_class_student(p_class) or is_parent_of_class(p_class)
                    or staff_can_read_class(p_class) or is_subject_teacher_of_class(p_class)
    when 'truong' then thuoc_co_so(p_campus)                               -- em/PH thấy mục tiêu trường [H-11]
    else false end;
$$;

create or replace function public.ghi_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then (p_student = (select auth.uid()) and is_class_student(p_class))
                    or (is_class_teacher(p_class) and lop_nhap_ho(p_class))
    when 'nhom'   then is_class_teacher(p_class)
    when 'lop'    then is_class_teacher(p_class)
                    or ((select auth_role()) = 'principal' and is_campus_class(p_class))
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;

create or replace function public.duyet_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then is_class_teacher(p_class)
    when 'nhom'   then is_class_teacher(p_class)                           -- [H-06] GVCN tạo nhóm = tự duyệt
    when 'lop'    then (select auth_role()) = 'principal' and is_campus_class(p_class)
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;

create or replace function public.muc_tieu_class(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from muc_tieu where id = m; $$;
create or replace function public.muc_tieu_student(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select student_id from muc_tieu where id = m; $$;
create or replace function public.doc_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;
create or replace function public.ghi_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;
create or replace function public.duyet_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. Hai hàm trần nhỏ (20 §3.2) — dùng cả ở mt_truoc_them và mt_truoc_sua; p_tru = id bỏ qua
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.mt_kiem_tran(p_key text, p_nam text, p_tru uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if (select count(*) from muc_tieu
      where chu_the_key = p_key and nam_hoc = p_nam and trang_thai = 'duyet'
        and (p_tru is null or id <> p_tru)) >= 4 then
    raise exception 'Đã có 4 mục tiêu đang chạy — đóng bớt một cái trước' using errcode = '23514';
  end if;
end $$;

create or replace function private.mt_kiem_tap_trung(p_key text, p_tru uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if (select count(*) from muc_tieu
      where chu_the_key = p_key and dang_tap_trung and trang_thai <> 'dong'
        and (p_tru is null or id <> p_tru)) >= 2 then
    raise exception 'Đang tập trung 2 mục tiêu rồi — bỏ một cái trước nhé' using errcode = '23514';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 7. Trigger DUYỆT (20 §3.2): mt_truoc_them, mt_truoc_sua, mt_ghi_lich_su_dich, tp_sau_ghi
--    chu_the_key GENERATED còn NULL trong BEFORE INSERT → tự ghép key từ cột gốc.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.mt_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_duyet boolean; v_y1 int; v_key text;
begin
  if v_me is null then return new; end if;                                   -- L6
  new.created_by := v_me;
  v_key := new.cap || ':' || coalesce(new.student_id::text, new.nhom_id::text, new.class_id::text, new.campus_id::text);
  v_y1  := split_part(new.nam_hoc, '-', 1)::int;
  if new.bat_dau < make_date(v_y1, 7, 1) or new.ket_thuc > make_date(v_y1 + 1, 7, 31) then
    raise exception 'Ngày của mục tiêu phải nằm trong năm học %', new.nam_hoc using errcode = '23514';
  end if;
  v_duyet := duyet_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  if new.cap = 'em' and v_me <> new.student_id then
    new.nguoi_nhap_ho := v_me;                                              -- nhập hộ: dấu vết
    if new.trang_thai not in ('nhap','gui') then new.trang_thai := 'gui'; end if;
  elsif v_duyet then
    if new.trang_thai is distinct from 'nhap' then new.trang_thai := 'duyet'; end if;
  elsif new.trang_thai not in ('nhap','gui') then
    raise exception 'Mục tiêu mới chỉ ở dạng nháp hoặc gửi duyệt' using errcode = '42501';
  end if;
  if new.trang_thai = 'duyet' then
    perform private.mt_kiem_tran(v_key, new.nam_hoc, null);                 -- KHÔNG new.chu_the_key (còn NULL)
    new.duyet_boi := v_me; new.duyet_at := now();
  else
    new.duyet_boi := null; new.duyet_at := null;
  end if;
  if new.dang_tap_trung then
    perform private.mt_kiem_tap_trung(v_key, null);
  end if;
  new.dong_boi := null; new.dong_at := null; new.ly_do_dong := null;
  return new;
end $$;

create or replace function private.mt_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['trang_thai','duyet_boi','duyet_at','ly_do_tra_lai',
      'dong_boi','dong_at','ly_do_dong','dang_tap_trung','nguoi_nhap_ho','updated_at',
      'class_id','campus_id',
      -- chu_the_key là cột GENERATED STORED: trong BEFORE UPDATE, new.chu_the_key = NULL (Postgres chỉ
      -- tính lại cột generated SAU mọi before-trigger), còn old.chu_the_key có giá trị → nếu KHÔNG loại
      -- khỏi diff thì doi_noi_dung LUÔN thấy "khác" và mọi update (kể cả chỉ đổi trạng thái để duyệt) bị
      -- hiểu nhầm là "đổi nội dung". Loại an toàn: nó suy từ cap/student_id/nhom_id/class_id/campus_id —
      -- các cột gốc ấy vẫn được diff riêng. (Đặc tả 20-QUYEN §3.2 thiếu cột này — vá tại đây; 0164
      -- th_truoc_sua và 0165 ck_truoc_sua có CÙNG lỗ với thuoc.chu_the_key / cam_ket.tuan_ket_thuc+lac_muc_tieu.)
      'chu_the_key'];                                                      -- L11
  v_doi boolean; v_ghi boolean; v_duyet boolean; v_key text;
begin
  if v_me is null then return new; end if;
  if (new.class_id is distinct from old.class_id or new.campus_id is distinct from old.campus_id)
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của mục tiêu chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_duyet := duyet_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_key   := old.chu_the_key;

  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung mục tiêu của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    if old.trang_thai = 'dong' then
      raise exception 'Mục tiêu đã đóng, không sửa được nữa' using errcode = '42501';
    end if;
    if new.cap = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    -- Người sửa KHÔNG đồng thời là người duyệt-của-cấp → nội dung về 'gui' (nháp giữ nháp).
    if not (v_duyet and v_ghi) and old.trang_thai in ('gui','duyet','tra_lai') then
      new.trang_thai := 'gui'; new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
    end if;
  end if;

  if old.trang_thai = 'dong' and new.trang_thai <> 'dong' and (select auth_role()) <> 'admin' then
    raise exception 'Mục tiêu đã đóng — muốn mở lại thì nhờ quản trị' using errcode = '42501';   -- [H-10]
  end if;

  if new.trang_thai is distinct from old.trang_thai
     and not (v_doi and new.trang_thai = 'gui' and old.trang_thai in ('gui','duyet','tra_lai')) then
    case new.trang_thai
      when 'duyet' then
        if not v_duyet then
          raise exception '%', case new.cap when 'lop' then 'Mục tiêu của lớp do ban giám hiệu duyệt'
                                            else 'Chỉ thầy cô chủ nhiệm mới duyệt được mục tiêu này' end
            using errcode = '42501';
        end if;
        perform private.mt_kiem_tran(v_key, new.nam_hoc, new.id);
        new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null;
      when 'tra_lai' then
        if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
        if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
          raise exception 'Trả lại thì phải ghi lý do để em biết sửa gì' using errcode = '23514';
        end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'gui' then
        if not v_ghi then raise exception 'Chỉ chủ mục tiêu mới gửi duyệt được' using errcode = '42501'; end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'nhap' then
        if not v_ghi or old.trang_thai not in ('gui','tra_lai') then
          raise exception 'Chỉ rút về nháp khi mục tiêu đang chờ duyệt hoặc bị trả lại' using errcode = '42501';
        end if;
        new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
      when 'dong' then
        if not (v_ghi or v_duyet) then
          raise exception 'Không có quyền đóng mục tiêu này' using errcode = '42501';
        end if;
        if new.ly_do_dong not in ('dat','doi','bo') then
          raise exception 'Đóng mục tiêu thì chọn: đã đạt, đổi mục tiêu khác, hay thôi không theo nữa'
            using errcode = '23514';
        end if;
        new.dong_boi := v_me; new.dong_at := now();
      else
        raise exception 'Trạng thái không hợp lệ' using errcode = '23514';
    end case;
  end if;

  if new.dang_tap_trung and not old.dang_tap_trung then
    perform private.mt_kiem_tap_trung(v_key, new.id);
  end if;
  -- Không ai nhét tay chữ ký: trạng thái không đổi thì chữ ký giữ nguyên giá trị cũ.
  if new.trang_thai = old.trang_thai then
    new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;
    new.dong_boi := old.dong_boi;  new.dong_at := old.dong_at;
  end if;
  return new;
end $$;

-- after update: đích (x/y/ket_thuc) đổi → ghi một dòng lịch sử
create or replace function private.mt_ghi_lich_su_dich() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.x_so, new.y_so, new.ket_thuc) is distinct from (old.x_so, old.y_so, old.ket_thuc) then
    insert into lich_su_dich (muc_tieu_id, x_cu, y_cu, ket_thuc_cu, x_moi, y_moi, ket_thuc_moi, ai, luc)
    values (new.id, old.x_so, old.y_so, old.ket_thuc, new.x_so, new.y_so, new.ket_thuc, (select auth.uid()), now());
  end if;
  return null;
end $$;

-- after insert/update/delete on thanh_phan: sửa thành phần là sửa NỘI DUNG → mục tiêu về 'gui'
-- nếu người sửa không phải người duyệt-của-cấp và mục tiêu đang duyet/tra_lai.
create or replace function private.tp_sau_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mt uuid := coalesce(new.muc_tieu_id, old.muc_tieu_id);
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  if not duyet_duoc_muc_tieu(v_mt) then
    update muc_tieu set trang_thai = 'gui', duyet_boi = null, duyet_at = null
      where id = v_mt and trang_thai in ('duyet','tra_lai');
  end if;
  return coalesce(new, old);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 8. Trigger DỮ LIỆU: so_do_truoc_ghi (10 §7) + mt_truoc_xoa (10 §3.5)
-- ─────────────────────────────────────────────────────────────────────────────────────
-- so_do là "số đang ở": UPDATE khoá danh tính dòng; số đọc phải khớp chủ của mục tiêu; khe hẹp
-- va.nguon_he_thong (phiên thầy cô điểm danh, uid ≠ null — góp ý #4) ẩn danh người ghi và bỏ qua
-- chặn-tay; ghi bù ngày cũ KHÔNG giới hạn 7 ngày [H-20] (cửa sổ 7 ngày là của LƯỢT, không của số đo).
create or replace function private.so_do_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_he_thong boolean := coalesce(current_setting('va.nguon_he_thong', true), '') = '1';
  m muc_tieu%rowtype;
begin
  select * into m from muc_tieu where id = new.muc_tieu_id;
  if tg_op = 'UPDATE' then
    if (new.muc_tieu_id, new.thanh_phan_id, new.student_id, new.ngay, new.nguoi_ghi, new.nguon, new.nguon_ref)
       is distinct from (old.muc_tieu_id, old.thanh_phan_id, old.student_id, old.ngay, old.nguoi_ghi, old.nguon, old.nguon_ref) then
      raise exception 'Muốn đổi ngày thì xoá dòng này rồi ghi lại' using errcode = '23514';
    end if;
    if v_me is not null then new.nguoi_sua := v_me; new.sua_at := now(); end if;
  end if;
  -- Số đọc phải khớp chủ của mục tiêu (em ↔ đúng em; lớp/trường ↔ null). Áp cả nguồn hệ thống.
  if new.student_id is distinct from m.student_id then
    raise exception 'Số này không thuộc đúng chủ của mục tiêu' using errcode = '23514';
  end if;
  if new.thanh_phan_id is not null
     and not exists (select 1 from thanh_phan tp where tp.id = new.thanh_phan_id and tp.muc_tieu_id = new.muc_tieu_id) then
    raise exception 'Phần này không thuộc mục tiêu đó' using errcode = '23514';
  end if;
  -- Khe hẹp máy điểm danh: ẩn danh người ghi, bỏ qua chặn-tay dưới đây.
  if v_he_thong then
    new.nguoi_ghi := null;
    return new;
  end if;
  if v_me is not null then
    new.nguoi_ghi := v_me;
    if new.nguon = 'he_thong' then
      raise exception 'Số do hệ thống ghi không ghi tay được' using errcode = '42501';
    end if;
    if m.trang_thai = 'dong' then
      raise exception 'Mục tiêu đã đóng, không ghi thêm số' using errcode = '23514';
    end if;
    if m.nguon_so in ('thuoc','con') then
      raise exception 'Số của mục tiêu này máy tự cộng từ việc/mục tiêu con — không ghi tay được' using errcode = '23514';
    end if;
    if m.nguon_so = 'he_thong' then
      raise exception 'Số của mục tiêu này máy tự lấy từ điểm danh — không ghi tay được' using errcode = '23514';
    end if;
    if m.nguon_so = 'thanh_phan' and new.thanh_phan_id is null then
      raise exception 'Mục tiêu này ghi số theo từng phần — chọn phần trước đã' using errcode = '23514';
    end if;
    if new.ngay > vn_today() then
      raise exception 'Chưa tới ngày đó mà' using errcode = '23514';
    end if;
    if new.ngay < m.bat_dau then
      raise exception 'Ngày này trước khi mục tiêu bắt đầu' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Chặn xoá có nghĩa. Đặc tả 10 §3.5 xếp hàm+trigger này ở 0165 (sau khi cam_ket/noi tồn tại);
-- vai trò 0163 giao "mt_truoc_xoa chặn xoá có nghĩa" nên đặt tại đây — hai vế cam_ket/noi bọc
-- to_regclass + IF LỒNG NHAU để câu SQL đọc bảng chưa-có KHÔNG bị planner tra cứu (plpgsql chỉ lập
-- kế hoạch câu lệnh khi CHẠM tới). Production sau 0165 có đủ bảng → hành vi y đặc tả.
create or replace function private.mt_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null or (select auth_role()) = 'admin' then return old; end if;
  if exists (select 1 from so_do s where s.muc_tieu_id = old.id) then
    raise exception 'Mục tiêu đã có số ghi — đóng lại chứ đừng xoá' using errcode = '23503';
  end if;
  if to_regclass('public.cam_ket') is not null then
    if exists (select 1 from cam_ket c where c.muc_tieu_id = old.id and c.trang_thai = 'hieu_luc') then
      raise exception 'Còn cam kết đang neo vào mục tiêu này' using errcode = '23503';
    end if;
  end if;
  if to_regclass('public.noi') is not null then
    if exists (select 1 from noi n where n.cha_id = old.id and n.vai = 'gop_so') then
      raise exception 'Còn dây góp số trỏ vào mục tiêu này — gỡ dây trước' using errcode = '23503';
    end if;
  end if;
  return old;
end $$;

-- Ép ẩn quyền EXECUTE các hàm private (chỉ trigger gọi, chạy bằng quyền chủ bảng) — L2
revoke all on function private.doi_noi_dung(jsonb, jsonb, text[]) from public;
grant execute on function private.doi_noi_dung(jsonb, jsonb, text[]) to authenticated;
revoke all on function private.mt_kiem_tran(text, text, uuid)  from public, anon, authenticated;
revoke all on function private.mt_kiem_tap_trung(text, uuid)   from public, anon, authenticated;
revoke all on function private.mt_truoc_them()      from public, anon, authenticated;
revoke all on function private.mt_truoc_sua()       from public, anon, authenticated;
revoke all on function private.mt_ghi_lich_su_dich() from public, anon, authenticated;
revoke all on function private.tp_sau_ghi()         from public, anon, authenticated;
revoke all on function private.so_do_truoc_ghi()    from public, anon, authenticated;
revoke all on function private.mt_truoc_xoa()       from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 9. Gắn trigger (idempotent: drop-if-exists + create)
-- ─────────────────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_mt_truoc_them on muc_tieu;
create trigger trg_mt_truoc_them before insert on muc_tieu for each row execute function private.mt_truoc_them();
drop trigger if exists trg_mt_truoc_sua on muc_tieu;
create trigger trg_mt_truoc_sua before update on muc_tieu for each row execute function private.mt_truoc_sua();
drop trigger if exists trg_mt_ghi_lich_su_dich on muc_tieu;
create trigger trg_mt_ghi_lich_su_dich after update on muc_tieu for each row execute function private.mt_ghi_lich_su_dich();
drop trigger if exists trg_touch_muc_tieu on muc_tieu;
create trigger trg_touch_muc_tieu before update on muc_tieu for each row execute function touch_updated_at();
drop trigger if exists trg_mt_truoc_xoa on muc_tieu;
create trigger trg_mt_truoc_xoa before delete on muc_tieu for each row execute function private.mt_truoc_xoa();

drop trigger if exists trg_tp_sau_ghi on thanh_phan;
create trigger trg_tp_sau_ghi after insert or update or delete on thanh_phan
  for each row execute function private.tp_sau_ghi();

drop trigger if exists trg_so_do_truoc_ghi on so_do;
create trigger trg_so_do_truoc_ghi before insert or update on so_do
  for each row execute function private.so_do_truoc_ghi();

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 10. Policy (20 §2.5–2.7). Admin luôn rls_all_<bảng>. Mọi policy to authenticated.
-- ─────────────────────────────────────────────────────────────────────────────────────
-- muc_tieu
drop policy if exists rls_select_muc_tieu on muc_tieu;
create policy rls_select_muc_tieu on muc_tieu for select to authenticated
  using (doc_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
drop policy if exists rls_insert_muc_tieu on muc_tieu;
create policy rls_insert_muc_tieu on muc_tieu for insert to authenticated
  with check (created_by = (select auth.uid())
              and ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
-- UPDATE mở cho cả người ghi lẫn người duyệt; trigger §3.2 quyết cột nào ai được đụng.
drop policy if exists rls_update_muc_tieu on muc_tieu;
create policy rls_update_muc_tieu on muc_tieu for update to authenticated
  using (ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
         or duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id))
  with check (ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
              or duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
-- DELETE: 0163 CHƯA có vế noi/cam_ket (bảng chưa tồn tại) — 0165 drop-if-exists + tạo lại thêm hai
-- vế. Backstop cho service_role/admin nằm ở trigger mt_truoc_xoa (áp cả không-phiên).
drop policy if exists rls_delete_muc_tieu on muc_tieu;
create policy rls_delete_muc_tieu on muc_tieu for delete to authenticated
  using (trang_thai in ('nhap','gui','tra_lai')
         and ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
         and not exists (select 1 from so_do s where s.muc_tieu_id = muc_tieu.id));
drop policy if exists rls_all_muc_tieu on muc_tieu;
create policy rls_all_muc_tieu on muc_tieu for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- moc_muc_tieu
drop policy if exists rls_select_moc on moc_muc_tieu;
create policy rls_select_moc on moc_muc_tieu for select to authenticated using (doc_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_manage_moc on moc_muc_tieu;
create policy rls_manage_moc on moc_muc_tieu for all to authenticated
  using (ghi_duoc_muc_tieu(muc_tieu_id)) with check (ghi_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_all_moc on moc_muc_tieu;
create policy rls_all_moc on moc_muc_tieu for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- thanh_phan (y hệt moc_muc_tieu; kèm trigger tp_sau_ghi)
drop policy if exists rls_select_thanh_phan on thanh_phan;
create policy rls_select_thanh_phan on thanh_phan for select to authenticated using (doc_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_manage_thanh_phan on thanh_phan;
create policy rls_manage_thanh_phan on thanh_phan for all to authenticated
  using (ghi_duoc_muc_tieu(muc_tieu_id)) with check (ghi_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_all_thanh_phan on thanh_phan;
create policy rls_all_thanh_phan on thanh_phan for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- lich_su_dich: chỉ đọc + trigger definer ghi (không policy ghi cho authenticated); admin qua rls_all
drop policy if exists rls_select_lsd on lich_su_dich;
create policy rls_select_lsd on lich_su_dich for select to authenticated using (doc_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_all_lsd on lich_su_dich;
create policy rls_all_lsd on lich_su_dich for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- so_do
drop policy if exists rls_select_so_do on so_do;
create policy rls_select_so_do on so_do for select to authenticated
  using (student_id = (select auth.uid())
         or (student_id is null and doc_duoc_muc_tieu(muc_tieu_id))
         or (student_id is not null and (is_my_child(student_id)
             or staff_can_read_class(muc_tieu_class(muc_tieu_id)))));
drop policy if exists rls_insert_so_do on so_do;
create policy rls_insert_so_do on so_do for insert to authenticated
  with check (nguon = 'tay' and nguoi_ghi = (select auth.uid()) and ghi_duoc_muc_tieu(muc_tieu_id));
drop policy if exists rls_update_so_do on so_do;
create policy rls_update_so_do on so_do for update to authenticated
  using (nguon = 'tay' and created_at > now() - interval '7 days'
         and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)))
  with check (nguon = 'tay' and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)));
drop policy if exists rls_delete_so_do on so_do;
create policy rls_delete_so_do on so_do for delete to authenticated
  using (nguon = 'tay' and created_at > now() - interval '7 days'
         and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)));
drop policy if exists rls_all_so_do on so_do;
create policy rls_all_so_do on so_do for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 11. Khối grant L2 cho helper public 0163 vừa tạo (20 §1.5 — cắt theo phần của tệp này)
-- ─────────────────────────────────────────────────────────────────────────────────────
do $$ declare f text; begin
  foreach f in array array[
    'doc_duoc_chu_the(text,uuid,uuid,uuid,uuid)','ghi_duoc_chu_the(text,uuid,uuid,uuid,uuid)',
    'duyet_duoc_chu_the(text,uuid,uuid,uuid,uuid)',
    'muc_tieu_class(uuid)','muc_tieu_student(uuid)','doc_duoc_muc_tieu(uuid)','ghi_duoc_muc_tieu(uuid)',
    'duyet_duoc_muc_tieu(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

commit;
