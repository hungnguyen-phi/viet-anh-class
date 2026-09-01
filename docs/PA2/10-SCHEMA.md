# 10-SCHEMA — Bảng, ràng buộc, trigger dữ liệu (PA2, bản chốt)

Vì sao tệp này trông như migration hơn là tài liệu: bài học 0129→0151 của repo là "mô tả bằng lời
thì hai người viết ra hai schema". Nên đây là **DDL chạy được** — người viết 0162→0167 chép từng
khối vào đúng tệp theo 50-DI-TRU §1, thêm khung `begin/commit` + khối L1/L2, không tự đặt lại tên.
Mọi tên cột/hàm theo BẢNG TÊN CHỐT ở 00-TONG-QUAN §3. Trigger có yếu tố VAI (duyệt, chữ ký, khoá,
nhập hộ, trần theo người) nằm ở 20-QUYEN §3 — tệp này chỉ giữ trigger THUẦN dữ liệu và máy.
Ba luật đọc trước khi gõ: (a) cột GENERATED chưa có giá trị trong BEFORE trigger — trigger tự tính
lại từ cột gốc; (b) mọi so timestamptz↔date qua giờ VN; (c) không sửa tệp migration đã chạy,
`create or replace` hàm đang có thì đọc `pg_proc` + so md5 trước (50-DI-TRU §1.3).

Quy ước chung cho MỌI bảng dưới đây (không lặp lại từng chỗ):
- Ngay dưới `create table`: `alter table X enable row level security; revoke all on table X from anon; grant select, insert, update, delete on X to authenticated;` (luật L1 — policy nằm ở 20-QUYEN).
- Trạng thái/kiểu là `text + check`, KHÔNG enum mới (đổi được bằng một migration; riêng `linh_vuc` tái dùng enum `wig_domain` + giá trị `khac` thêm ở 0161).
- `id uuid primary key default gen_random_uuid()`; `created_by uuid null default auth.uid() references profiles(id) on delete set null`; `created_at timestamptz not null default now()`.
- Bảng có `updated_at`: gắn `create trigger trg_touch_<bảng> before update on <bảng> for each row execute function touch_updated_at();` (hàm có sẵn từ 0064).

---

## 1. Tệp 0162 — nền: đơn vị, tuần học, nhóm, mẫu, cột bảng giữ

### 1.1 `don_vi` — đơn vị là bảng, không suy từ chuỗi (lật 5.6 #8)

```sql
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
create unique index if not exists don_vi_ma_uidx on don_vi (lower(ma));

insert into don_vi (ma, nhan_vi, nhan_en) values
  ('lan', 'lần', 'times'), ('bai', 'bài', 'exercises'), ('buoi', 'buổi', 'sessions'),
  ('phut', 'phút', 'minutes'), ('km', 'km', 'km'), ('diem', 'điểm', 'points'),
  ('phan_tram', '%', '%'), ('trang', 'trang', 'pages'), ('cau', 'câu', 'questions'),
  ('khach_quan_tam', 'khách quan tâm', 'leads')
on conflict do nothing;
```
Phép quy đổi giữa hai đơn vị KHÔNG nằm ở bảng này — nó nằm ở `noi.he_so` của từng dây.

### 1.2 `tuan_hoc` — lịch tuần của cơ sở; KHÔNG có dòng = tuần học

```sql
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
```
`thi` tính như `hoc`. Tuần `nghi` KHÔNG chặn ghi — chỉ đổi cách tính (30-PHEP-TINH §1.2).

### 1.3 `nhom`, `nhom_thanh_vien`

```sql
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

create table if not exists nhom_thanh_vien (
  id         uuid primary key default gen_random_uuid(),
  nhom_id    uuid not null references nhom(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nhom_id, student_id)
);
```
Nhóm `loai='buddy'` chiếu từ `buddy_pairs` bằng RPC idempotent `tao_buddy_nhom` — bản ĐANG CHẠY
(0153_buddy_nhom_2_3.sql:19-51) CHỈ ghi `buddy_pairs`, chưa biết gì về `nhom`, nên 0162 phải
`create or replace` nó (đọc `pg_get_functiondef` + md5 guard, khai lại revoke/grant): trong CÙNG
giao dịch upsert `nhom(loai='buddy')` + `nhom_thanh_vien` dưới cờ `va.chieu_buddy` (góp ý #6);
huỷ cặp → gọi lại RPC là nhóm về `is_active=false`. KHÔNG trigger trên `buddy_pairs`.
Trigger dữ liệu: thành viên phải đang ghi danh lớp của nhóm
(`private.ntv_hop_le`, before insert/update — kiểm `enrollments.is_active`, errcode 23503).

### 1.4 `muc_tieu_mau` — mẫu mục tiêu của lớp (em chỉ điền số)

```sql
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
-- trigger private.mtm_tran_tam: > 8 mẫu active một lớp → 23514 'Tối đa 8 mẫu.'
```

### 1.5 Cột thêm vào bảng GIỮ + dòng `area_config`

```sql
alter table classes add column if not exists nhap_ho boolean not null default false;
comment on column classes.nhap_ho is
  'Lớp nhỏ (khối 1-3): thầy cô nhập NỘI DUNG ba tầng và sáu câu thay em; chữ ký vẫn của em/bạn cùng nhóm. BGH cùng cơ sở + admin bật [H-15].';
-- protect_class_privileged_cols: đọc pg_get_functiondef + md5 trước, thêm vế nhap_ho — xem 20-QUYEN §2.15.

alter table pdr_meetings add column if not exists nguoi_nhap_ho uuid references profiles(id) on delete set null;
comment on column pdr_meetings.nguoi_nhap_ho is 'Thầy cô gõ sáu câu thay em (lớp nhap_ho). KPI "% em tự làm" loại các dòng này.';

insert into area_config (area, label_vi, label_en, color_hex, soft_rgba, icon_name, default_unit, sort_order)
values ('khac', 'Khác', 'Other', '#6b7093', 'rgba(107,112,147,0.12)', 'circle-dashed', null, 99)
on conflict (area) do nothing;
```
(`alter type wig_domain add value if not exists 'khac';` là TOÀN BỘ nội dung 0161 — tệp trước đó,
một câu, không bọc transaction — 50-DI-TRU §1.2.)

---

## 2. Tệp 0163 — `muc_tieu` và số đo

### 2.1 `muc_tieu`

```sql
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
create index if not exists idx_muc_tieu_class   on muc_tieu (class_id, trang_thai) where class_id is not null;
create index if not exists idx_muc_tieu_student on muc_tieu (student_id) where student_id is not null;
create index if not exists idx_muc_tieu_truong  on muc_tieu (campus_id) where cap = 'truong';
```

Lưu ý cố ý: KHÔNG có check `y_so > 0` (đích 0 là số thật — lật #13); KHÔNG unique theo lĩnh vực
(hai mục tiêu cùng lĩnh vực hợp lệ — lật #6). "Trong năm học" (bat_dau/ket_thuc thuộc
01/07/Y1–31/07/Y2 của `nam_hoc`) kiểm ở trigger `mt_truoc_them` (20-QUYEN §3.2) vì CHECK không
gọi được hàm stable.

### 2.2 `moc_muc_tieu`, `thanh_phan`, `lich_su_dich`

```sql
create table if not exists moc_muc_tieu (
  id          uuid primary key default gen_random_uuid(),
  muc_tieu_id uuid not null references muc_tieu(id) on delete cascade,
  ngay        date not null,
  gia_tri     numeric not null,
  created_by  uuid null default auth.uid() references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (muc_tieu_id, ngay)
);

create table if not exists thanh_phan (
  id          uuid primary key default gen_random_uuid(),
  muc_tieu_id uuid not null references muc_tieu(id) on delete cascade,
  ten         text not null,
  thu_tu      smallint not null default 1,
  nguong      numeric null,
  created_at  timestamptz not null default now(),
  constraint tp_ten_ck check (ten = btrim(ten) and ten <> '' and length(ten) <= 80)
);

create table if not exists lich_su_dich (
  id           uuid primary key default gen_random_uuid(),
  muc_tieu_id  uuid not null references muc_tieu(id) on delete cascade,
  x_cu numeric null,  y_cu numeric null,  ket_thuc_cu date null,
  x_moi numeric null, y_moi numeric null, ket_thuc_moi date null,
  ai           uuid null references profiles(id) on delete set null,
  luc          timestamptz not null default now()
);
create index if not exists idx_lsd_muc_tieu on lich_su_dich (muc_tieu_id, luc);
```

### 2.3 `so_do` — số đọc theo NGÀY, có nguồn (ghi thêm, không đè)

```sql
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
create index if not exists idx_so_do_doc on so_do (muc_tieu_id, ngay desc, created_at desc);
create unique index if not exists so_do_he_thong_uidx on so_do (muc_tieu_id, ngay)
  where nguon = 'he_thong' and thanh_phan_id is null and student_id is null;
```
`so_do` là "số ĐANG Ở" (số đọc) — kể cả `tran_tich_luy` người ghi nhập tổng-đến-nay [H-20].
`gia_tri = 0` là một dòng thật. Sửa trong 7 ngày (policy); sau đó là lịch sử, ghi dòng mới.

---

## 3. Tệp 0164 — `thuoc`, `thuoc_lich_su`, `luot`

### 3.1 `thuoc` — HAI cột trạng thái độc lập (chốt C2)

```sql
create table if not exists thuoc (
  id             uuid primary key default gen_random_uuid(),
  chu_the        text not null,
  class_id       uuid not null references classes(id) on delete cascade,
  nhom_id        uuid null references nhom(id) on delete restrict,
  student_id     uuid null references profiles(id) on delete cascade,
  subject_id     uuid null references subjects(id) on delete set null,
  ten            text not null,
  cach_ghi       text not null default 'cham',
  nguon_he_thong text null,
  don_vi_id      uuid not null references don_vi(id) on delete restrict,
  moi_lan        numeric null default 1,
  toi_da_ngay    numeric null,
  chi_tieu_ky    numeric not null,
  ky_tuan        smallint not null default 1,
  chieu_dich     text not null default 'it_nhat',
  nguong_moi_lan numeric null,
  gop            text not null default 'tong',
  pham_vi        text not null default 'tung_em',
  ngay_ap_dung   smallint[] not null default '{1,2,3,4,5,6,7}',
  cho_bu         boolean not null default false,
  tu_tuan        date not null,
  den_tuan       date null,
  trang_thai     text not null default 'chay',
  duyet          text not null default 'gui',
  duyet_boi      uuid null references profiles(id) on delete set null,
  duyet_at       timestamptz null,
  ly_do_tra_lai  text null,
  da_tung_duyet  boolean not null default false,
  nguoi_nhap_ho  uuid null references profiles(id) on delete set null,
  created_by     uuid null default auth.uid() references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  chu_the_key    text generated always as
                   (chu_the || ':' || coalesce(student_id::text, nhom_id::text, class_id::text)) stored,
  constraint th_chu_the_ck   check (chu_the in ('lop','nhom','em')),
  constraint th_khoa_ck      check (
       (chu_the = 'lop'  and nhom_id is null     and student_id is null)
    or (chu_the = 'nhom' and nhom_id is not null and student_id is null)
    or (chu_the = 'em'   and nhom_id is null     and student_id is not null)),
  constraint th_ten_ck       check (ten = btrim(ten) and ten <> '' and length(ten) <= 160),
  constraint th_cach_ghi_ck  check (cach_ghi in ('cham','dien_so','he_thong')),
  constraint th_moi_lan_ck   check (cach_ghi <> 'cham' or moi_lan is not null),
  constraint th_he_thong_ck  check ((cach_ghi = 'he_thong') = (nguon_he_thong is not null)),
  constraint th_nguon_ht_ck  check (nguon_he_thong is null or nguon_he_thong in ('diem_danh')),
  constraint th_ky_tuan_ck   check (ky_tuan in (1,2,4)),
  constraint th_chieu_ck     check (chieu_dich in ('it_nhat','nhieu_nhat')),
  constraint th_gop_ck       check (gop in ('tong','moi_nhat','dem_dat_nguong')),
  constraint th_nguong_ck    check (gop <> 'dem_dat_nguong' or nguong_moi_lan is not null),
  constraint th_dem_kieng_ck check (not (gop = 'dem_dat_nguong' and chieu_dich = 'nhieu_nhat')),
  constraint th_pham_vi_ck   check (pham_vi in ('tung_em','ca_doi')),
  constraint th_ca_doi_ck    check (pham_vi <> 'ca_doi' or chu_the in ('lop','nhom')),
  constraint th_ngay_ad_ck   check (array_length(ngay_ap_dung, 1) between 1 and 7
                                    and ngay_ap_dung <@ array[1,2,3,4,5,6,7]::smallint[]),
  constraint th_thu_hai_ck   check (extract(isodow from tu_tuan) = 1
                                    and (den_tuan is null or extract(isodow from den_tuan) = 1)),
  constraint th_tuan_ck      check (den_tuan is null or tu_tuan <= den_tuan),
  constraint th_chi_tieu_ck  check (chi_tieu_ky >= 0),
  constraint th_trang_thai_ck check (trang_thai in ('chay','tam_dung','dong')),
  constraint th_duyet_ck     check (duyet in ('gui','duyet','tra_lai')),
  constraint th_mon_lop_ck   check (subject_id is null or chu_the = 'lop')
);
create index if not exists idx_thuoc_class   on thuoc (class_id) where trang_thai <> 'dong';
create index if not exists idx_thuoc_student on thuoc (student_id) where student_id is not null;
create unique index if not exists thuoc_mon_uidx on thuoc (class_id, subject_id)
  where subject_id is not null and trang_thai <> 'dong';
```
`da_tung_duyet` là chốt chống lách "hạ chỉ tiêu → về gui → sửa thẳng": nội dung đông cứng khi
`da_tung_duyet`, bất kể `duyet` đang là gì (trigger 20-QUYEN §3.3). KHÔNG có trần cứng cho
`gia_tri`/`toi_da_ngay` (cảnh báo mềm ở UI — lật #14).

### 3.2 `thuoc_lich_su` — thay đổi chỉ tiêu, hiệu lực từ tuần sau

```sql
create table if not exists thuoc_lich_su (
  id           uuid primary key default gen_random_uuid(),
  thuoc_id     uuid not null references thuoc(id) on delete cascade,
  tu_tuan      date not null,
  chi_tieu_ky  numeric null,            -- null = tuần tạm dừng (miễn)
  ngay_ap_dung smallint[] null,
  moi_lan      numeric null,
  trang_thai   text not null default 'hieu_luc',
  la_ha        boolean not null default false,
  nguoi_doi    uuid null default auth.uid() references profiles(id) on delete set null,
  ly_do        text null,
  duyet_boi    uuid null references profiles(id) on delete set null,
  duyet_at     timestamptz null,
  created_at   timestamptz not null default now(),
  constraint thls_thu_hai_ck    check (extract(isodow from tu_tuan) = 1),
  constraint thls_trang_thai_ck check (trang_thai in ('hieu_luc','cho_duyet','tu_choi')),
  constraint thls_chi_tieu_ck   check (chi_tieu_ky is null or chi_tieu_ky >= 0)
);
create index if not exists idx_thls_thuoc on thuoc_lich_su (thuoc_id, tu_tuan desc);
```
`private.chi_tieu_tai(thuoc, tuần)` CHỈ đọc dòng `trang_thai='hieu_luc'` (chốt C10) — chỉ tiêu
`cho_duyet`/`tu_choi` không bao giờ vào phép tính.

### 3.3 `luot` — bảng nhạy nhất

```sql
create table if not exists luot (
  id          uuid primary key default gen_random_uuid(),
  thuoc_id    uuid not null references thuoc(id) on delete cascade,
  student_id  uuid null references profiles(id) on delete cascade,   -- null = lượt cả đội
  ngay        date not null,
  stt         smallint not null default 1,
  gia_tri     numeric not null,
  nguoi_ghi   uuid null references profiles(id) on delete set null,  -- null = hệ thống
  nguon       text not null default 'tay',
  nguon_ref   uuid null,
  nguoi_sua   uuid null references profiles(id) on delete set null,
  sua_at      timestamptz null,
  created_at  timestamptz not null default now(),
  chu_the_key text generated always as (coalesce(student_id::text, 'doi')) stored,
  constraint luot_gia_tri_ck check (gia_tri >= 0),
  constraint luot_stt_ck     check (stt >= 1),
  constraint luot_nguon_ck   check (nguon in ('tay','he_thong'))
);
create unique index if not exists luot_ngay_uidx      on luot (thuoc_id, chu_the_key, ngay, stt);
create unique index if not exists luot_he_thong_uidx  on luot (thuoc_id, student_id, ngay) where nguon = 'he_thong';
create index if not exists idx_luot_nguon_ref         on luot (nguon_ref) where nguon = 'he_thong';  -- câu DELETE khi sửa điểm danh khỏi quét cả bảng (góp ý #20)
create index if not exists idx_luot_thuoc_ngay        on luot (thuoc_id, ngay);
create index if not exists idx_luot_student           on luot (student_id, ngay) where student_id is not null;
```
`gia_tri` ĐÃ là giá trị theo đơn vị của thước (app ghi `gia_tri = moi_lan` cho `cach_ghi='cham'`)
— hàm đọc không nhân lại, đổi `moi_lan` sau này không viết lại lịch sử. `gia_tri = 0` là dòng
thật ("có làm mà được 0" ≠ "không ghi").

### 3.4 Trigger dữ liệu trên `luot` — `private.luot_truoc_ghi`

```sql
create or replace function private.luot_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); t thuoc%rowtype;
begin
  select * into t from thuoc where id = new.thuoc_id;
  if tg_op = 'UPDATE' then
    if (new.thuoc_id, new.student_id, new.ngay, new.nguoi_ghi, new.nguon, new.nguon_ref)
       is distinct from (old.thuoc_id, old.student_id, old.ngay, old.nguoi_ghi, old.nguon, old.nguon_ref) then
      raise exception 'Muốn đổi ngày hay việc thì xoá lượt này rồi ghi lại' using errcode = '23514';
    end if;
    if v_me is not null then new.nguoi_sua := v_me; new.sua_at := now(); end if;
  else
    if coalesce(current_setting('va.nguon_he_thong', true), '') = '1' then
      new.nguoi_ghi := null;                          -- máy ghi từ PHIÊN thầy cô điểm danh (khe hẹp 0155 — góp ý #4)
    elsif v_me is not null then
      new.nguoi_ghi := v_me;                          -- không ghi tên người khác
      if new.nguon = 'he_thong' then
        raise exception 'Lượt do hệ thống ghi không ghi tay được' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.ngay < t.tu_tuan or (t.den_tuan is not null and new.ngay > t.den_tuan + 6) then
    raise exception 'Việc này không áp dụng cho ngày %', to_char(new.ngay, 'DD/MM') using errcode = '23514';
  end if;
  if v_me is not null and coalesce(current_setting('va.nguon_he_thong', true), '') <> '1'
     and not t.cho_bu
     and not (extract(isodow from new.ngay)::smallint = any (t.ngay_ap_dung)) then
    raise exception 'Việc này chỉ ghi vào những ngày đã chọn; muốn làm bù thì bật "cho làm bù"'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_luot_truoc_ghi before insert or update on luot
  for each row execute function private.luot_truoc_ghi();
```

### 3.5 Chặn xoá có nghĩa — `private.th_truoc_xoa` (0164), `private.mt_truoc_xoa` (0165)

```sql
create or replace function private.mt_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null or (select auth_role()) = 'admin' then return old; end if;
  if exists (select 1 from so_do s where s.muc_tieu_id = old.id) then
    raise exception 'Mục tiêu đã có số ghi — đóng lại chứ đừng xoá' using errcode = '23503';
  end if;
  if exists (select 1 from cam_ket c where c.muc_tieu_id = old.id and c.trang_thai = 'hieu_luc') then
    raise exception 'Còn cam kết đang neo vào mục tiêu này' using errcode = '23503';
  end if;
  if exists (select 1 from noi n where n.cha_id = old.id and n.vai = 'gop_so') then
    raise exception 'Còn dây góp số trỏ vào mục tiêu này — gỡ dây trước' using errcode = '23503';
  end if;
  return old;
end $$;
-- trg_mt_truoc_xoa before delete on muc_tieu (tạo ở 0165, sau khi cam_ket/noi tồn tại)

create or replace function private.th_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null or (select auth_role()) = 'admin' then return old; end if;
  if exists (select 1 from luot l where l.thuoc_id = old.id) then
    raise exception 'Đã có lượt ghi — kết thúc việc này thay vì xoá' using errcode = '23503';
  end if;
  return old;
end $$;
create trigger trg_th_truoc_xoa before delete on thuoc for each row execute function private.th_truoc_xoa();
```

---

## 4. Tệp 0165 — cam kết, dây, khoá

### 4.1 `cam_ket` — không có vòng duyệt

```sql
create table if not exists cam_ket (
  id             uuid primary key default gen_random_uuid(),
  chu_the        text not null,
  class_id       uuid not null references classes(id) on delete cascade,
  nhom_id        uuid null references nhom(id) on delete restrict,
  student_id     uuid null references profiles(id) on delete cascade,
  tuan_bat_dau   date not null,
  so_tuan        smallint not null default 1,
  tuan_ket_thuc  date generated always as (tuan_bat_dau + (so_tuan - 1) * 7) stored,
  noi_dung       text not null,
  so_hua         numeric null,
  don_vi_id      uuid null references don_vi(id) on delete restrict,
  so_dat         numeric null,
  thuoc_id       uuid null references thuoc(id) on delete set null,
  muc_tieu_id    uuid null references muc_tieu(id) on delete set null,
  lac_muc_tieu   boolean generated always as (thuoc_id is null and muc_tieu_id is null) stored,
  ket_qua        text null,
  goi_y          text null,             -- ảnh chụp gợi ý của máy LÚC chấm; null = máy im lặng
  cham_boi       uuid null references profiles(id) on delete set null,
  cham_at        timestamptz null,
  xong_at        timestamptz null,      -- deliverable một lần: xong sớm chấm sớm được
  pdr_meeting_id uuid null references pdr_meetings(id) on delete set null,
  nguoi_nhap_ho  uuid null references profiles(id) on delete set null,
  trang_thai     text not null default 'hieu_luc',
  created_by     uuid null default auth.uid() references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ck_chu_the_ck    check (chu_the in ('lop','nhom','em')),
  constraint ck_khoa_ck       check (
       (chu_the = 'lop'  and nhom_id is null     and student_id is null)
    or (chu_the = 'nhom' and nhom_id is not null and student_id is null)
    or (chu_the = 'em'   and nhom_id is null     and student_id is not null)),
  constraint ck_thu_hai_ck    check (extract(isodow from tuan_bat_dau) = 1),
  constraint ck_so_tuan_ck    check (so_tuan between 1 and 4),
  constraint ck_noi_dung_ck   check (noi_dung = btrim(noi_dung) and noi_dung <> '' and length(noi_dung) <= 300),
  constraint ck_so_hua_ck     check (so_hua is null or so_hua >= 0),
  constraint ck_don_vi_ck     check ((so_hua is null) = (don_vi_id is null)),
  constraint ck_so_dat_ck     check (so_dat is null or (so_hua is not null and so_dat >= 0)),
  constraint ck_ket_qua_ck    check (ket_qua is null or ket_qua in ('thang','thua')),
  constraint ck_goi_y_ck      check (goi_y is null or goi_y in ('thang','thua')),
  constraint ck_cham_ck       check ((ket_qua is null) = (cham_at is null)),   -- KHÔNG trói cham_boi (FK set null)
  constraint ck_trang_thai_ck check (trang_thai in ('hieu_luc','huy'))
);
create index if not exists idx_cam_ket_class_tuan   on cam_ket (class_id, tuan_bat_dau) where trang_thai = 'hieu_luc';
create index if not exists idx_cam_ket_student_tuan on cam_ket (student_id, tuan_bat_dau) where student_id is not null;
create index if not exists idx_cam_ket_pdr          on cam_ket (pdr_meeting_id) where pdr_meeting_id is not null;
```
Luật hai-cam-kết-một-tuần, ai chấm, khoá sau chấm/kể lại: trigger `ck_truoc_them/ck_truoc_sua`
ở 20-QUYEN §3.4. Nhắc riêng vì từng viết sai: **`tuan_ket_thuc` là cột GENERATED — trigger BEFORE
tự tính `v_ket_thuc := new.tuan_bat_dau + (new.so_tuan - 1) * 7` từ cột gốc, không đọc cột generated.**

### 4.2 `cam_ket_xac_nhan` — người chứng

```sql
create table if not exists cam_ket_xac_nhan (
  id         uuid primary key default gen_random_uuid(),
  cam_ket_id uuid not null references cam_ket(id) on delete cascade,
  nguoi_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  vai        text not null,
  dong_y     boolean not null default true,   -- false = "mình thấy chưa xong" — một ý kiến, không đổi ket_qua
  y_kien     text null,
  created_at timestamptz not null default now(),
  constraint ckxn_vai_ck    check (vai in ('buddy','thay_co','phu_huynh')),
  constraint ckxn_y_kien_ck check (y_kien is null or length(y_kien) <= 200)
);
create unique index if not exists cam_ket_xac_nhan_uidx on cam_ket_xac_nhan (cam_ket_id, nguoi_id);
-- trigger private.ckxn_dung_vai (20-QUYEN §3.5): vai SUY từ quan hệ, nguoi_id := auth.uid(), không tin đầu vào.
```

### 4.3 `pdr_ke_lai` — câu 2 có cấu trúc; FK RESTRICT giữ chữ ký

```sql
create table if not exists pdr_ke_lai (
  id             uuid primary key default gen_random_uuid(),
  pdr_meeting_id uuid not null references pdr_meetings(id) on delete cascade,
  cam_ket_id     uuid not null references cam_ket(id) on delete restrict,   -- xoá cam kết đã kể lại: BỊ CHẶN
  ket_qua        text null,             -- null = "chưa biết"/"chưa tới hạn" — không gợi thua (lật #18)
  so_dat         numeric null,
  ghi_chu        text null,
  created_at     timestamptz not null default now(),
  constraint pkl_ket_qua_ck check (ket_qua is null or ket_qua in ('thang','thua')),
  constraint pkl_so_dat_ck  check (so_dat is null or so_dat >= 0),
  constraint pkl_ghi_chu_ck check (ghi_chu is null or length(ghi_chu) <= 300)
);
create unique index if not exists pdr_ke_lai_uidx on pdr_ke_lai (pdr_meeting_id, cam_ket_id);
create index if not exists idx_pkl_cam_ket on pdr_ke_lai (cam_ket_id);
-- pkl_truoc_ghi / pkl_truoc_xoa / pkl_sau_ghi: 20-QUYEN §3.6. Điểm cứng: so_dat chỉ hợp lệ khi
-- cam_ket.so_hua có; INSERT ket_qua null KHÔNG xoá kết quả em đã tự chấm; UPDATE thang/thua→null
-- (trước khi ký) thì xoá bản chép; DELETE khi biên bản đã ký → 42501.
```

### 4.4 `noi` — dây có vai: hai FK thật + hai cột generated (chốt C3)

```sql
create table if not exists noi (
  id              uuid primary key default gen_random_uuid(),
  cha_id          uuid not null references muc_tieu(id) on delete cascade,
  con_muc_tieu_id uuid null references muc_tieu(id) on delete cascade,
  con_thuoc_id    uuid null references thuoc(id) on delete cascade,
  con_loai        text generated always as
                    (case when con_thuoc_id is not null then 'thuoc' else 'muc_tieu' end) stored,
  con_id          uuid generated always as (coalesce(con_thuoc_id, con_muc_tieu_id)) stored,
  vai             text not null,
  he_so           numeric not null default 1,
  noi_tu_dong     boolean not null default false,
  ghi_chu         text null,
  created_by      uuid null default auth.uid() references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint noi_mot_con_ck      check (num_nonnulls(con_muc_tieu_id, con_thuoc_id) = 1),
  constraint noi_vai_ck          check (vai in ('gop_so','chi_huong')),
  constraint noi_he_so_ck        check (he_so > 0),
  constraint noi_khong_tu_tro_ck check (con_muc_tieu_id is distinct from cha_id)
);
create unique index if not exists noi_gop_so_uidx   on noi (con_loai, con_id) where vai = 'gop_so';
create unique index if not exists noi_duy_nhat_uidx on noi (cha_id, con_loai, con_id, vai);
```
Mọi truy vấn kiểu cũ `where con_loai='thuoc' and con_id=…` vẫn biên dịch nhờ hai cột generated;
toàn vẹn tham chiếu là thật. `noi` KHÔNG sửa được — gỡ rồi nối lại (dòng mới, `created_by` mới);
policy không có update (20-QUYEN §2.16 — dây không sửa, gỡ rồi nối lại).

### 4.5 Trigger dữ liệu `private.noi_hop_le`

```sql
create or replace function private.noi_hop_le() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_cha muc_tieu%rowtype; v_rank_cha int; v_rank_con int; v_con_gop text;
begin
  select * into v_cha from muc_tieu where id = new.cha_id;
  -- Máy (auth.uid() null hoặc cờ va.noi_tu_dong) chỉ được "chỉ hướng" — mẫu khe hẹp 0155
  if v_me is null or coalesce(current_setting('va.noi_tu_dong', true), '') = '1' then
    if new.vai <> 'chi_huong' then
      raise exception 'Máy chỉ tự nối "chỉ hướng"' using errcode = '42501';
    end if;
    new.noi_tu_dong := true;
    return new;
  end if;
  new.noi_tu_dong := false;
  if new.vai = 'gop_so' then
    if new.con_thuoc_id is not null then
      if v_cha.nguon_so <> 'thuoc' then
        raise exception 'Mục tiêu này không cộng số từ việc — chọn "chỉ hướng", hoặc đổi nguồn số của mục tiêu'
          using errcode = '23514';
      end if;
      select gop into v_con_gop from thuoc where id = new.con_thuoc_id;
      if (v_con_gop = 'moi_nhat'
          and exists (select 1 from noi n where n.cha_id = new.cha_id and n.vai = 'gop_so' and n.id <> new.id))
         or exists (select 1 from noi n join thuoc t on t.id = n.con_thuoc_id
                    where n.cha_id = new.cha_id and n.vai = 'gop_so' and t.gop = 'moi_nhat' and n.id <> new.id) then
        raise exception 'Số đo (lấy số mới nhất) phải là nguồn duy nhất của mục tiêu' using errcode = '23514';
      end if;
    else
      if v_cha.nguon_so <> 'con' then
        raise exception 'Mục tiêu này không gộp từ mục tiêu khác' using errcode = '23514';
      end if;
      select case cap when 'em' then 1 when 'nhom' then 2 when 'lop' then 3 else 4 end
        into v_rank_con from muc_tieu where id = new.con_muc_tieu_id;
      v_rank_cha := case v_cha.cap when 'em' then 1 when 'nhom' then 2 when 'lop' then 3 else 4 end;
      if v_rank_con >= v_rank_cha then
        raise exception 'Chỉ gộp số từ cấp thấp lên cấp cao (em → nhóm → lớp → trường)' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_noi_hop_le before insert on noi for each row execute function private.noi_hop_le();
```
Khác đơn vị giữa con và cha: app bắt điền `he_so` (câu mẫu: "Việc này đếm *lần*, mục tiêu đếm
*bài* — chọn 'chỉ hướng' hoặc khai một lần đáng bao nhiêu bài"); CSDL không đoán được "hệ số
đúng" nên không chặn cứng. Dây `gop_so` tạo được cả khi con còn `duyet='gui'` — phép cộng chỉ
lấy thước `duyet='duyet'` (30-PHEP-TINH §3.1), em không phải quay lại nối dây sau duyệt.
Luật chặn-vòng cấp thấp→cao ở trên + giới hạn độ sâu trong `so_hien_tai` là hai lớp chống đệ quy.

### 4.6 `luot_mo_khoa` — cửa sổ mở tuần đã ký (48 giờ, có vết)

```sql
create table if not exists luot_mo_khoa (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id) on delete cascade,
  class_id        uuid not null references classes(id) on delete cascade,
  week_start      date not null,
  mo_boi          uuid null references profiles(id) on delete set null,
  mo_at           timestamptz not null default now(),
  het_han         timestamptz not null,
  edit_request_id uuid null references edit_requests(id) on delete set null,
  constraint lmk_thu_hai_ck check (extract(isodow from week_start) = 1)
);
create index if not exists idx_lmk_student_tuan on luot_mo_khoa (student_id, week_start);
```

### 4.7 `edit_requests` — MỞ RỘNG (không đổi nghĩa cũ; siết ở 0169)

```sql
alter table edit_requests drop constraint if exists edit_requests_kind_check;
alter table edit_requests add constraint edit_requests_kind_check
  check (kind in ('rename_lead', 'doi_ten_thuoc', 'mo_tuan_da_ky', 'khac'));
alter table edit_requests add column if not exists tuan date;
alter table edit_requests drop constraint if exists edit_requests_tuan_ck;
alter table edit_requests add constraint edit_requests_tuan_ck
  check ((kind = 'mo_tuan_da_ky') = (tuan is not null)
         and (tuan is null or extract(isodow from tuan) = 1));
alter table edit_requests drop constraint if exists edit_requests_doi_ten_ck;
alter table edit_requests add constraint edit_requests_doi_ten_ck
  check (kind <> 'doi_ten_thuoc' or (ref_id is not null and length(btrim(coalesce(message,''))) between 1 and 160));
comment on column edit_requests.kind is
  'rename_lead: mô hình cũ, gỡ ở 0169 · doi_ten_thuoc: ref_id=thuoc.id, message=tên mới, duyệt áp thẳng vào thuoc.ten (trigger) · mo_tuan_da_ky: tuan=thứ Hai tuần xin mở, duyệt → luot_mo_khoa 48 giờ · khac: lời nhắn tự do';
```
`rename_lead` GIỮ tới 0169 vì app cũ còn tạo nó tới hết PR-4 (EditRequestButton.tsx:53). Trigger
áp dụng khi duyệt (kind mới): 20-QUYEN §3.7 — có kiểm `ref_id` thuộc đúng lớp/đúng em của yêu cầu.

---

## 5. Tệp 0167 — nguồn hệ thống (điểm danh) và Hub

### 5.1 Điểm danh → `luot` + `so_do` — idempotent, chỉ đếm CÓ MẶT

```sql
create or replace function private.nguon_he_thong_diem_danh() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_pct numeric;
begin
  perform set_config('va.nguon_he_thong', '1', true);  -- mở khe cho luot/so_do_truoc_ghi: trigger này chạy
                                                       -- trong PHIÊN thầy cô điểm danh, uid ≠ null (góp ý #4)
  -- (a) Thước he_thong: MỘT bản ghi điểm danh CÓ MẶT (present/late) = một lượt; sửa điểm danh thì rút lượt
  if new.status in ('present', 'late') then
    for r in
      select t.id from thuoc t
      where t.cach_ghi = 'he_thong' and t.nguon_he_thong = 'diem_danh'
        and t.trang_thai = 'chay' and t.pham_vi = 'tung_em' and t.class_id = new.class_id
        and exists (select 1 from enrollments e
                    where e.class_id = t.class_id and e.student_id = new.student_id and e.is_active)
    loop
      insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon, nguon_ref)
      values (r.id, new.student_id, new.date, 1, null, 'he_thong', new.id)
      on conflict (thuoc_id, student_id, ngay) where nguon = 'he_thong' do nothing;
    end loop;
  elsif tg_op = 'UPDATE' and old.status in ('present', 'late') and new.status not in ('present', 'late') then
    delete from luot where nguon = 'he_thong' and nguon_ref = new.id;
  end if;
  -- (b) Mục tiêu he_thong (chuyên cần): upsert số đọc = % có mặt từ bat_dau tới ngày này
  for r in
    select m.id, m.cap, m.class_id, m.campus_id, m.bat_dau from muc_tieu m
    where m.nguon_so = 'he_thong' and m.nguon_he_thong = 'diem_danh' and m.trang_thai = 'duyet'
      and ((m.cap = 'lop' and m.class_id = new.class_id)
        or (m.cap = 'truong' and m.campus_id = (select campus_id from classes where id = new.class_id)))
  loop
    select round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*), 0), 1)
      into v_pct
    from attendance_records a join classes c on c.id = a.class_id
    where a.date between r.bat_dau and new.date
      and ((r.cap = 'lop' and a.class_id = r.class_id) or (r.cap = 'truong' and c.campus_id = r.campus_id));
    if v_pct is not null then
      insert into so_do (muc_tieu_id, ngay, gia_tri, nguon, nguon_ref, nguoi_ghi)
      values (r.id, new.date, v_pct, 'he_thong', new.id, null)
      on conflict (muc_tieu_id, ngay) where nguon = 'he_thong' and thanh_phan_id is null and student_id is null
      do update set gia_tri = excluded.gia_tri;
    end if;
  end loop;
  perform set_config('va.nguon_he_thong', '', true);
  return new;
exception when others then
  perform set_config('va.nguon_he_thong', '', true);
  raise warning 'nguon_he_thong_diem_danh: %', sqlerrm;   -- phần phụ không được làm rớt điểm danh
  return new;
end $;
revoke all on function private.nguon_he_thong_diem_danh() from public, anon, authenticated;
drop trigger if exists trg_nguon_he_thong_diem_danh on attendance_records;
create trigger trg_nguon_he_thong_diem_danh after insert or update on attendance_records
  for each row execute function private.nguon_he_thong_diem_danh();
```
RLS của `attendance_records` KHÔNG đổi. Bảng điểm (`subject_scores`) để đợt sau — không khai
giá trị CHECK cho nó bây giờ. Trigger này KHÔNG liên quan hợp đồng Hub (lượt `he_thong` bị Hub
lọc bỏ) — không chờ [H-03].

### 5.2 Hub: `private.hub_hang_doi_luot` (thay `trg_hub_hang_doi_tick` cũ)

```sql
create or replace function private.hub_hang_doi_luot() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_class uuid; v_ten text; v_chieu text; v_gop text; v_cach text; v_area text;
begin
  if new.student_id is null then return new; end if;                 -- lượt cả đội: không gắn em
  if new.nguon = 'he_thong' then return new; end if;                 -- điểm danh đã đi đường diem_danh.danh_dau
  if new.gia_tri is null or new.gia_tri <= 0 then return new; end if;-- 0 = "có làm được 0", không phải một lần làm
  select t.class_id, t.ten, t.chieu_dich, t.gop, t.cach_ghi
    into v_class, v_ten, v_chieu, v_gop, v_cach from thuoc t where t.id = new.thuoc_id;
  if v_class is null then return new; end if;
  if v_chieu = 'nhieu_nhat' or v_gop = 'moi_nhat' or v_cach = 'he_thong' then return new; end if;
  select case when m.linh_vuc::text in ('knowledge','leadership_skills','character','physical_wellbeing')
              then m.linh_vuc::text end
    into v_area
  from noi n join muc_tieu m on m.id = n.cha_id
  where n.con_thuoc_id = new.thuoc_id
  order by case n.vai when 'gop_so' then 0 else 1 end, n.created_at
  limit 1;                                                           -- gop_so trước, chi_huong sau; 'khac' → null
  insert into hub_event_outbox (event_type, source_table, source_id, payload)
  values ('viec_dan_dat.tick', 'luot', new.id, jsonb_build_object(
    'student_id', new.student_id, 'class_id', v_class, 'area', v_area, 'lead_title', v_ten,
    'logged_date', new.ngay, 'value', new.gia_tri, 'nguoi_ghi', new.nguoi_ghi))
  on conflict (source_table, source_id) do nothing;
  return new;
exception when others then
  raise warning 'hub_hang_doi_luot: %', sqlerrm;                     -- mẫu 0157:93-98
  return new;
end $$;
revoke all on function private.hub_hang_doi_luot() from public, anon, authenticated;
drop trigger if exists trg_hub_hang_doi_luot on luot;
create trigger trg_hub_hang_doi_luot after insert on luot for each row execute function private.hub_hang_doi_luot();
```
Chỉ AFTER INSERT — sửa/xoá lượt không sinh sự kiện (như hôm nay). Payload là bản ký duy nhất
(50-DI-TRU §5); `hub_event_outbox` không đổi; `unique (source_table, source_id)` cho hai trigger
cũ/mới sống chung tới 0168.

---

## 6. Tệp 0167 — `apply_class_transfer` bản HỢP NHẤT (một thân duy nhất, chốt C20)

Trước khi đè: đọc `pg_get_functiondef('public.apply_class_transfer(uuid,uuid)'::regprocedure)`,
so md5 với `c30ee9da19236f8a57fe52d93045a070` theo guard hai-giá-trị của 50-DI-TRU §1.3. Chèn khối
sau vào GIỮA đoạn tắt `pdr_schedules` và đoạn `insert into enrollments` của thân đang chạy:

```sql
  -- PA2: mục tiêu / việc / cam kết đang mở của em đi theo em. Cờ hẹp cho trigger biết đây là đổi lớp,
  -- không phải sửa nội dung (class_id/campus_id nằm trong whitelist "không phải nội dung" — lớp bảo hiểm thứ hai).
  perform set_config('va.doi_lop', '1', true);
  update muc_tieu set class_id = p_to_class,
         campus_id = (select campus_id from classes where id = p_to_class)
    where cap = 'em' and student_id = p_student
      and class_id is distinct from p_to_class and trang_thai <> 'dong';
  update thuoc set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student
      and class_id <> p_to_class and trang_thai <> 'dong';
  update cam_ket set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student and class_id <> p_to_class
      and trang_thai = 'hieu_luc' and ket_qua is null
      and tuan_bat_dau + (so_tuan * 7) - 1 >= vn_today();          -- tuần cuối còn chưa qua
  update nhom_thanh_vien v set is_active = false
    from nhom n where n.id = v.nhom_id and v.student_id = p_student
      and v.is_active and n.class_id <> p_to_class;
  perform set_config('va.doi_lop', '', true);
  -- Dây noi lên mục tiêu LỚP CŨ giữ nguyên — màn suy "góp vào lớp cũ" từ cha.class_id <> con.class_id.
```

Ba luật đọc ra từ khối này: (1) cam kết ĐÃ CHẤM là lịch sử của lớp cũ — đứng yên; (2) đổi khác
cơ sở thì `campus_id` của mục tiêu đi theo (predicate BGH/cơ sở mới đọc đúng); (3) KHÔNG có
trigger nào trên `enrollments` (bài học 0155).

`unenroll_student` (cùng tệp, cùng guard): thêm `update nhom_thanh_vien … is_active = false`
(nhóm thuộc lớp bị rời) và `update thuoc set trang_thai = 'tam_dung' where chu_the = 'em' and
student_id = p_student and class_id = p_class and trang_thai = 'chay'` — không đóng hẳn, em vào
lớp mới chạy tiếp.

---

## 7. Bảng phân công trigger — bảng nào, trigger nào, đặc tả ở đâu

| Bảng | Trigger (`trg_<hàm>`) | Hàm `private.` | Đặc tả |
|---|---|---|---|
| `muc_tieu` | truoc them / truoc sua / ghi lịch sử đích / truoc xoa / touch | `mt_truoc_them`, `mt_truoc_sua`, `mt_ghi_lich_su_dich`, `mt_truoc_xoa` | 20 §3.2, 10 §3.5 |
| `thanh_phan` | sau ghi (nội dung → mục tiêu về 'gui') | `tp_sau_ghi` | 20 §3.2 |
| `thuoc` | truoc them / truoc sua / truoc xoa / touch | `th_truoc_them`, `th_truoc_sua`, `th_truoc_xoa` | 20 §3.3, 10 §3.5 |
| `thuoc_lich_su` | truoc them / truoc sua / sau xoa | `thls_truoc_them`, `thls_truoc_sua`, `thls_sau_xoa` | 20 §3.3 |
| `luot` | truoc ghi / hub sau insert | `luot_truoc_ghi`, `hub_hang_doi_luot` | 10 §3.4, §5.2 |
| `so_do` | truoc ghi | `so_do_truoc_ghi` | dưới đây |
| `cam_ket` | truoc them / truoc sua / touch | `ck_truoc_them`, `ck_truoc_sua` | 20 §3.4 |
| `cam_ket_xac_nhan` | truoc them | `ckxn_dung_vai` | 20 §3.5 |
| `pdr_ke_lai` | truoc ghi / truoc xoa / sau ghi | `pkl_truoc_ghi`, `pkl_truoc_xoa`, `pkl_sau_ghi` | 20 §3.6 |
| `pdr_meetings` | truoc sua (chữ ký, sáu câu) | `pdr_truoc_sua` | 20 §3.6 |
| `noi` | hop le (before insert) | `noi_hop_le` | 10 §4.5 |
| `nhom_thanh_vien` | hop le | `ntv_hop_le` | 10 §1.3 |
| `muc_tieu_mau` | trần 8 mẫu | `mtm_tran_tam` | 10 §1.4 |
| `edit_requests` | truoc sua (resolved_*) / sau duyet (áp dụng) | `er_truoc_sua`, `er_sau_duyet` | 20 §3.7 |
| `attendance_records` | nguồn hệ thống | `nguon_he_thong_diem_danh` | 10 §5.1 |
| `classes` | protect_class_privileged_cols (mở rộng nhap_ho) | (public, đang có) | 20 §2.15 |

Không tên hàm/trigger nào trùng với 25 hàm `private.*` cũ sẽ drop ở 0168 (đã đối chiếu danh sách
50-DI-TRU §3) — để 0168 không kéo nhầm đồ mới.

`private.so_do_truoc_ghi` (before insert or update on `so_do`, tệp 0163): khi UPDATE khoá bộ
`(muc_tieu_id, thanh_phan_id, student_id, ngay, nguoi_ghi, nguon, nguon_ref)` (23514 "Muốn đổi
ngày thì xoá dòng này rồi ghi lại"), đặt `nguoi_sua/sua_at`; khi cờ `va.nguon_he_thong='1'`
(trigger điểm danh chạy trong phiên thầy cô — góp ý #4): ép `nguoi_ghi := null` và BỎ QUA các vế
chặn-tay dưới đây; khi người gõ (uid ≠ null): ép
`nguoi_ghi := uid`, chặn `nguon='he_thong'` (42501), chặn mục tiêu `dong` (23514 "Mục tiêu đã
đóng, không ghi thêm số"), chặn `nguon_so in ('thuoc','con')` (23514 "Số của mục tiêu này máy tự
cộng từ việc — không ghi tay được"), chặn `nguon_so='he_thong'` + tay, chặn `ngay > vn_today()`
(23514 "Chưa tới ngày đó mà") và `ngay < bat_dau` (23514 "Ngày này trước khi mục tiêu bắt đầu"),
đòi `thanh_phan_id` khi `nguon_so='thanh_phan'`; luôn kiểm `thanh_phan_id` thuộc đúng mục tiêu và
`student_id is not distinct from muc_tieu.student_id`. Ghi bù ngày cũ KHÔNG giới hạn 7 ngày [H-20].

---

## 8. Sổ câu lỗi phát từ tầng dữ liệu (app hiện thẳng qua `friendlyError`, P0001 → nguyên câu)

| errcode | Câu | Ở đâu |
|---|---|---|
| 23514 | Muốn đổi ngày hay việc thì xoá lượt này rồi ghi lại | luot_truoc_ghi |
| 23514 | Việc này không áp dụng cho ngày {dd/mm} | luot_truoc_ghi |
| 23514 | Việc này chỉ ghi vào những ngày đã chọn; muốn làm bù thì bật "cho làm bù" | luot_truoc_ghi |
| 42501 | Lượt do hệ thống ghi không ghi tay được | luot_truoc_ghi |
| 23514 | Chưa tới ngày đó mà / Ngày này trước khi mục tiêu bắt đầu | so_do_truoc_ghi |
| 23514 | Số của mục tiêu này máy tự cộng từ việc/mục tiêu con — không ghi tay được | so_do_truoc_ghi |
| 23514 | Mục tiêu này ghi số theo từng phần — chọn phần trước đã | so_do_truoc_ghi |
| 23514 | Máy chỉ tự nối "chỉ hướng" (42501) · Chỉ gộp số từ cấp thấp lên cấp cao · Số đo phải là nguồn duy nhất | noi_hop_le |
| 23503 | Mục tiêu đã có số ghi — đóng lại chứ đừng xoá · Còn cam kết đang neo · Còn dây góp số | mt_truoc_xoa |
| 23503 | Đã có lượt ghi — kết thúc việc này thay vì xoá | th_truoc_xoa |
| 23514 | Tối đa 8 mẫu. | mtm_tran_tam |

Không chuỗi nào có WIG/lead/PDR/buddy/"luỹ kế"/"cô" trần; câu chung cho nhiều vai viết trung tính
(không xưng "em" trong trigger dùng chung — bài học phản biện về câu trần cam kết).
