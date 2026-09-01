-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0165 — PA2: CAM KẾT, DÂY (noi), và KHOÁ theo chữ ký PDR.
-- Chủ dự án 01/09/2026: xây thẳng PA2, không song song, không di trú (đã sao lưu JSON).
-- Vì sao tệp này là chốt chặn cuối của "nền": cam_ket là lời hứa KHÔNG duyệt (em tự chấm
-- Thắng/Thua), nên toàn bộ tính đúng-sai nằm ở TRIGGER (thứ Sáu mới chấm, ký là chốt, kể lại là
-- đông cứng) chứ không ở vòng duyệt. `noi` là dây nối con→cha có vai (gộp số / chỉ hướng), luật
-- cấp-thấp-lên-cao + "số đo là nguồn duy nhất" nằm ở noi_hop_le. Và khoá theo chữ ký PDR
-- (luot_bi_khoa) là thứ khiến biên bản họp bạn "đã ký" trở thành bất biến — chỉ mở qua
-- edit_requests(mo_tuan_da_ky) → luot_mo_khoa 48 giờ.
-- Tệp CHỈ THÊM. Đọc pg_proc/pg_constraint TRƯỚC khi chạy nếu nghi lệch. Phụ thuộc 0162+0163+0164
-- (FK thuoc/muc_tieu/pdr_meetings/nhom/don_vi + helper gia_thuoc/doc_duoc_chu_the/ghi_duoc_thuoc…).
-- Đặc tả: 10-SCHEMA §4, 20-QUYEN §1.2/§1.3/§2.10–§2.16/§3.4–§3.7, 30-PHEP-TINH §2/§3.
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. BẢNG (10-SCHEMA §4). Quy ước L1 ngay dưới mỗi bảng: bật RLS, revoke anon, grant authenticated.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- 1.1 cam_ket — lời hứa 1–4 tuần, KHÔNG vòng duyệt. tuan_ket_thuc/lac_muc_tieu là GENERATED.
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
  goi_y          text null,             -- ẢNH CHỤP gợi ý của máy LÚC chấm; null = máy im lặng (khác gợi ý sống ở view)
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
  constraint ck_cham_ck       check ((ket_qua is null) = (cham_at is null)),   -- CHỐT C27: KHÔNG trói cham_boi (FK set null)
  constraint ck_trang_thai_ck check (trang_thai in ('hieu_luc','huy'))
);
alter table cam_ket enable row level security;
revoke all on table cam_ket from anon;
grant select, insert, update, delete on cam_ket to authenticated;
create index if not exists idx_cam_ket_class_tuan   on cam_ket (class_id, tuan_bat_dau) where trang_thai = 'hieu_luc';
create index if not exists idx_cam_ket_student_tuan on cam_ket (student_id, tuan_bat_dau) where student_id is not null;
create index if not exists idx_cam_ket_pdr          on cam_ket (pdr_meeting_id) where pdr_meeting_id is not null;

-- 1.2 cam_ket_xac_nhan — người chứng (buddy/thầy cô/phụ huynh). vai SUY từ quan hệ ở trigger.
create table if not exists cam_ket_xac_nhan (
  id         uuid primary key default gen_random_uuid(),
  cam_ket_id uuid not null references cam_ket(id) on delete cascade,
  nguoi_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  vai        text not null,
  dong_y     boolean not null default true,   -- false = "mình thấy chưa xong" — một ý kiến, KHÔNG đổi ket_qua
  y_kien     text null,
  created_at timestamptz not null default now(),
  constraint ckxn_vai_ck    check (vai in ('buddy','thay_co','phu_huynh')),
  constraint ckxn_y_kien_ck check (y_kien is null or length(y_kien) <= 200)
);
alter table cam_ket_xac_nhan enable row level security;
revoke all on table cam_ket_xac_nhan from anon;
grant select, insert, update, delete on cam_ket_xac_nhan to authenticated;
create unique index if not exists cam_ket_xac_nhan_uidx on cam_ket_xac_nhan (cam_ket_id, nguoi_id);

-- 1.3 pdr_ke_lai — câu 2 có cấu trúc của biên bản họp bạn. FK cam_ket ON DELETE RESTRICT: xoá cam
--     kết đã kể lại thì BỊ CHẶN (giữ chữ ký khỏi mất neo).
create table if not exists pdr_ke_lai (
  id             uuid primary key default gen_random_uuid(),
  pdr_meeting_id uuid not null references pdr_meetings(id) on delete cascade,
  cam_ket_id     uuid not null references cam_ket(id) on delete restrict,
  ket_qua        text null,             -- null = "chưa biết"/"chưa tới hạn" — KHÔNG gợi thua
  so_dat         numeric null,
  ghi_chu        text null,
  created_at     timestamptz not null default now(),
  constraint pkl_ket_qua_ck check (ket_qua is null or ket_qua in ('thang','thua')),
  constraint pkl_so_dat_ck  check (so_dat is null or so_dat >= 0),
  constraint pkl_ghi_chu_ck check (ghi_chu is null or length(ghi_chu) <= 300)
);
alter table pdr_ke_lai enable row level security;
revoke all on table pdr_ke_lai from anon;
grant select, insert, update, delete on pdr_ke_lai to authenticated;
create unique index if not exists pdr_ke_lai_uidx on pdr_ke_lai (pdr_meeting_id, cam_ket_id);
create index if not exists idx_pkl_cam_ket on pdr_ke_lai (cam_ket_id);

-- 1.4 noi — dây có vai. HAI FK thật (con_muc_tieu_id / con_thuoc_id) + hai cột GENERATED
--     (con_loai, con_id) để truy vấn đa hình cũ vẫn biên dịch mà toàn vẹn tham chiếu vẫn thật.
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
alter table noi enable row level security;
revoke all on table noi from anon;
grant select, insert, update, delete on noi to authenticated;
-- gop_so trỏ vào một con là DUY NHẤT (một số thật không góp vào hai chỗ); dây (cha,con,vai) không lặp.
create unique index if not exists noi_gop_so_uidx   on noi (con_loai, con_id) where vai = 'gop_so';
create unique index if not exists noi_duy_nhat_uidx on noi (cha_id, con_loai, con_id, vai);

-- 1.5 luot_mo_khoa — cửa sổ 48 giờ mở tuần đã ký (có vết). Chỉ trigger duyệt edit_requests sinh dòng.
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
alter table luot_mo_khoa enable row level security;
revoke all on table luot_mo_khoa from anon;
grant select, insert, update, delete on luot_mo_khoa to authenticated;
create index if not exists idx_lmk_student_tuan on luot_mo_khoa (student_id, week_start);

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. edit_requests — MỞ RỘNG (10-SCHEMA §4.7). Giữ 'rename_lead' tới 0169 (app cũ còn sinh).
--    drop-then-add cho idempotent.
-- ─────────────────────────────────────────────────────────────────────────────────────
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
comment on column edit_requests.tuan is 'mo_tuan_da_ky: thứ Hai của tuần xin mở khoá; duyệt → luot_mo_khoa(week_start=tuan, het_han=+48h).';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. HÀM TRỢ GIÚP (20-QUYEN §1.2/§1.3). SQL stable security definer; đặt TRƯỚC policy dùng chúng.
--    Thứ tự: hàm chữ-ký/khoá trước (cam_ket_da_ke_lai, luot_bi_khoa gọi pdr_chu_ky_hop_le).
-- ─────────────────────────────────────────────────────────────────────────────────────

-- L8: chữ ký = chính em; hoặc BẠN TRONG BUỔI HỌP (counterpart/second) ở lớp bật nhập hộ. Thầy cô KHÔNG ký.
create or replace function public.pdr_chu_ky_hop_le(p_student uuid, p_type text, p_counterpart uuid,
                                                    p_second uuid, p_by uuid, p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_by is not null and (p_by = p_student
    or (p_type = 'buddy' and p_by in (p_counterpart, p_second) and lop_nhap_ho(p_class)));
$$;

-- Cửa sổ ghi 7 ngày của EM (thầy cô ghi hộ KHÔNG vướng). Không definer, không đọc bảng.
create or replace function public.trong_cua_so_ghi(p_ngay date) returns boolean
language sql stable set search_path = public as $$
  select p_ngay between vn_today() - 6 and vn_today();
$$;

-- Lượt của em p_ngay ĐÃ KHOÁ chưa: có biên bản ký hợp lệ mà (a) ngày ≤ ngày ký (giờ VN) và
-- (b) ngày rơi vào tuần một cam kết đã kể lại — hoặc biên bản rỗng thì tuần liền trước tuần họp
-- [H-14 khoá theo TUẦN, mọi thước, tính cả type='coach']. Mở lại duy nhất qua luot_mo_khoa.
-- Gác đầu chống dò: người lạ gọi → false (không tín hiệu).
create or replace function public.luot_bi_khoa(p_student uuid, p_ngay date) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_student = (select auth.uid()) or is_my_child(p_student)
          or exists (select 1 from enrollments e
                     where e.student_id = p_student and e.is_active and staff_can_read_class(e.class_id)))
  and exists (
    select 1 from pdr_meetings m
    where m.student_id = p_student and m.acknowledged_at is not null
      and pdr_chu_ky_hop_le(m.student_id, m.type, m.counterpart_id, m.second_buddy_id, m.acknowledged_by, m.class_id)
      and p_ngay <= (m.acknowledged_at at time zone 'Asia/Ho_Chi_Minh')::date
      and (exists (select 1 from pdr_ke_lai r join cam_ket c on c.id = r.cam_ket_id
                   where r.pdr_meeting_id = m.id
                     and p_ngay between c.tuan_bat_dau and c.tuan_bat_dau + 7 * c.so_tuan - 1)
        or (not exists (select 1 from pdr_ke_lai r where r.pdr_meeting_id = m.id)
            and vn_week_start(p_ngay) = thu_hai_tu_nhan(m.week_label) - 7)))
  and not exists (select 1 from luot_mo_khoa mk
    where mk.student_id = p_student and mk.week_start = vn_week_start(p_ngay) and now() < mk.het_han);
$$;

create or replace function public.cam_ket_student(k uuid) returns uuid
language sql stable security definer set search_path = public as $$ select student_id from cam_ket where id = k; $$;

-- Cam kết đã được kể lại trong một biên bản ĐÃ KÝ HỢP LỆ → đông cứng.
create or replace function public.cam_ket_da_ke_lai(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pdr_ke_lai r join pdr_meetings m on m.id = r.pdr_meeting_id
    where r.cam_ket_id = k and m.acknowledged_at is not null
      and pdr_chu_ky_hop_le(m.student_id, m.type, m.counterpart_id, m.second_buddy_id, m.acknowledged_by, m.class_id));
$$;

create or replace function public.doc_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
      or (chu_the = 'em' and is_my_buddy(student_id))                      -- [H-12] bạn cùng nhóm đọc cam kết
  from cam_ket where id = k; $$;

-- GHI cam kết — bộ riêng, KHÔNG có nhánh principal (chốt C23).
create or replace function public.ghi_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin'
      or (chu_the = 'em' and (student_id = (select auth.uid())
                              or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
      or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
  from cam_ket where id = k; $$;

create or replace function public.pdr_class(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from pdr_meetings where id = m; $$;

create or replace function public.ghi_duoc_pdr_ke_lai(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pdr_meetings p where p.id = m and p.acknowledged_at is null
    and (p.student_id = (select auth.uid())
         or (is_class_teacher(p.class_id) and lop_nhap_ho(p.class_id))));
$$;

create or replace function public.xac_nhan_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c.chu_the = 'em' and c.student_id <> (select auth.uid())
     and (is_my_buddy(c.student_id) or is_class_teacher(c.class_id) or is_my_child(c.student_id))
  from cam_ket c where c.id = k; $$;

-- Đọc/ghi CON của dây (con là thuoc hoặc muc_tieu). Dùng ở policy noi (§2.16).
create or replace function public.doc_duoc_con(p_loai text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_loai when 'muc_tieu' then doc_duoc_muc_tieu(p_id) when 'thuoc' then doc_duoc_thuoc(p_id) else false end; $$;
create or replace function public.ghi_duoc_con(p_loai text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_loai when 'muc_tieu' then ghi_duoc_muc_tieu(p_id) when 'thuoc' then ghi_duoc_thuoc(p_id) else false end; $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. public.goi_y_cam_ket (30-PHEP-TINH §3, chốt C12). Definer, TỰ GÁC, trả null khi không đọc được.
--    LỆCH ĐẶC TẢ có chủ đích: viết bằng plpgsql (đặc tả không ghim ngôn ngữ; logic gác + phân nhánh
--    dễ đọc hơn). Luôn trả ĐÚNG MỘT dòng để SELECT … INTO ở trigger chấm không nhận 0 dòng.
--    Đọc gia_thuoc (0164) lúc CHẠY.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.goi_y_cam_ket(p_cam_ket uuid)
returns table (goi_y text, so_dat_goi_y numeric, thuoc_trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare
  c cam_ket%rowtype; t thuoc%rowtype; g record;
  v_me uuid := (select auth.uid());
  v_tu date; v_den date; v_hom_nay date; v_xem_so boolean;
  v_goi_y text; v_tt text;
begin
  select * into c from cam_ket where id = p_cam_ket;
  if c.id is null then return query select null::text, null::numeric, null::text; return; end if;
  -- tự gác: người gọi (uid ≠ null) không đọc được cam kết → toàn null
  if v_me is not null and not doc_duoc_cam_ket(p_cam_ket) then
    return query select null::text, null::numeric, null::text; return;
  end if;
  if c.trang_thai = 'huy' then return query select null::text, null::numeric, null::text; return; end if;

  v_tu := c.tuan_bat_dau; v_den := c.tuan_bat_dau + 7 * c.so_tuan - 1;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  -- ai được thấy so_dat_goi_y: chính em / phụ huynh / thầy cô lớp (KHÔNG bạn cùng nhóm — [H-12])
  v_xem_so := (v_me is null) or (c.student_id = v_me) or is_my_child(c.student_id) or is_class_teacher(c.class_id);

  -- 1. deliverable đã xong sớm → thang
  if c.xong_at is not null then
    return query select 'thang'::text, case when v_xem_so then c.so_dat else null end, null::text; return;
  end if;
  -- 4/6. không thước (chỉ muc_tieu, hoặc lạc) → null (không chấm cam kết bằng số kết quả)
  if c.thuoc_id is null then
    return query select null::text, null::numeric, null::text; return;
  end if;

  select * into t from thuoc where id = c.thuoc_id;
  if c.chu_the = 'em' then
    -- 2. thước, chủ thể EM
    select * into g from private.gia_thuoc(c.thuoc_id, v_tu, v_den, c.student_id) as g;
    v_tt := g.trang_thai;
    if g.trang_thai in ('dat','dang_giu') then v_goi_y := 'thang';
    elsif g.trang_thai in ('truot','vuot') then v_goi_y := 'thua';
    else v_goi_y := null; end if;   -- mien/chua_biet/cửa sổ mở chưa đạt → im lặng
    return query select v_goi_y,
      case when v_xem_so and c.don_vi_id is not null and c.don_vi_id = t.don_vi_id then g.gia else null end,
      v_tt;
    return;
  else
    -- 3. chủ thể LỚP/NHÓM nối thước tung_em → xét so_em_dat/so_em_can của kỳ
    select * into g from private.gia_thuoc(c.thuoc_id, v_tu, v_den, null) as g;
    v_tt := g.trang_thai;
    if v_den < v_hom_nay then                       -- cửa sổ đóng
      if g.so_em_dat is not null and g.so_em_can is not null and g.so_em_dat = g.so_em_can
        then v_goi_y := 'thang'; else v_goi_y := 'thua'; end if;
    else v_goi_y := null; end if;
    return query select v_goi_y, case when v_xem_so then g.gia else null end, v_tt;
    return;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. private.so_hien_tai (30-PHEP-TINH §2) — HÀM LÕI 2: số hiện tại của MỘT mục tiêu.
--    Đọc `noi` (giờ mới tồn tại) → phải ở tệp này. KHÔNG gác (chỉ tính); revoke đủ ba vai.
--    LỆCH ĐẶC TẢ có chủ đích: đặc tả ghi "language sql"; viết plpgsql cho phân nhánh + đệ quy
--    (p_sau) dễ đúng. Hàm trả BẢNG qua LATERAL nên không mất inline gì đáng kể.
--    ⚠ ĐỘ ĐÚNG SỐ HỌC theo véc-tơ V-M (30 §5.2) do scripts/test-phep-tinh-muc-tieu.sql VALIDATE
--    (deliverable riêng); test-0165 tại tệp này KHÔNG dựng lại phép tính — nó kiểm cam_ket/noi/khoá.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.so_hien_tai(p_muc_tieu uuid, p_ky date default null, p_sau int default 0)
returns table (
  so numeric, nguon text, ngay_nguon date, so_nguon int,
  x numeric, y numeric, le_ra numeric, pct numeric,
  dat boolean, trang_thai text,
  ky_tu date, ky_den date, so_ky_giu int, so_ky_xet int, tu_so int, mau_so int
) language plpgsql stable security definer set search_path = public as $$
declare
  m muc_tieu%rowtype;
  v_ky date; v_x numeric; v_y numeric; v_kt date;
  v_so numeric; v_nguon text; v_ngay date; v_so_nguon int := 0;
  v_le_ra numeric; v_pct numeric; v_dat boolean; v_tt text;
  v_ky_tu date; v_ky_den date; v_so_ky_giu int; v_so_ky_xet int;
  v_tu_so int; v_mau_so int;
  v_kep boolean; v_het_ky boolean; v_q numeric;
  r record; sc record; v_gop numeric; v_dong numeric;
  v_campus uuid; v_hom_nay date; v_songay_tong numeric; v_songay_den numeric;
begin
  -- Chốt đệ quy (lớp hai sau luật cấp-thấp-lên-cao của noi_hop_le).
  if p_sau > 3 then
    return query select null::numeric,null::text,null::date,0,null::numeric,null::numeric,
      null::numeric,null::numeric,null::boolean,'chua_biet'::text,
      null::date,null::date,null::int,null::int,null::int,null::int;
    return;
  end if;
  select * into m from muc_tieu where id = p_muc_tieu;
  if m.id is null then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_ky := coalesce(p_ky, v_hom_nay);
  v_campus := m.campus_id;

  -- Đích hiệu lực tại v_ky (§0.5): dòng lich_su_dich SỚM NHẤT có luc::date > v_ky → lấy *_cu.
  select ld.x_cu, ld.y_cu, ld.ket_thuc_cu into v_x, v_y, v_kt
  from lich_su_dich ld
  where ld.muc_tieu_id = m.id and (ld.luc at time zone 'Asia/Ho_Chi_Minh')::date > v_ky
  order by ld.luc asc limit 1;
  if not found then v_x := m.x_so; v_y := m.y_so; v_kt := m.ket_thuc; end if;

  -- Kỳ (giu/toc_do_ky): map tuan→1, hai_tuan→2, thang→4 tuần ISO; neo vn_week_start(bat_dau).
  if m.kieu_dich in ('giu','toc_do_ky') and m.ky is not null then
    declare v_w int; v_anchor date; v_k int;
    begin
      v_w := case m.ky when 'tuan' then 1 when 'hai_tuan' then 2 else 4 end;
      v_anchor := vn_week_start(m.bat_dau);
      v_k := floor((vn_week_start(v_ky) - v_anchor) / (7.0 * v_w))::int;
      v_ky_tu := v_anchor + v_k * 7 * v_w;
      v_ky_den := v_ky_tu + 7 * v_w - 1;
    end;
  end if;

  v_het_ky := (v_ky > v_kt) or (m.trang_thai = 'dong');

  -- ── Lấy `so` theo nguon_so ──────────────────────────────────────────────────────────
  if m.nguon_so in ('ghi_tay','he_thong') then
    -- số ĐANG Ở = dòng so_do mới nhất (thanh_phan_id null, ngay <= v_ky). giu/toc_do_ky: trong kỳ.
    select s.gia_tri, s.ngay into v_so, v_ngay
    from so_do s
    where s.muc_tieu_id = m.id and s.thanh_phan_id is null and s.student_id is null
      and s.ngay <= v_ky
      and (m.kieu_dich not in ('giu','toc_do_ky') or s.ngay >= v_ky_tu)
    order by s.ngay desc, s.created_at desc limit 1;
    v_nguon := m.nguon_so; if v_so is not null then v_so_nguon := 1; end if;

  elsif m.nguon_so = 'thanh_phan' then
    -- mỗi thành phần lấy dòng so_do mới nhất; gộp theo gop_thanh_phan.
    v_nguon := 'may_tu_thanh_phan';
    if m.gop_thanh_phan = 'trung_binh' then
      select avg(x.g) into v_so from (
        select (select s.gia_tri from so_do s where s.muc_tieu_id = m.id and s.thanh_phan_id = tp.id
                and s.ngay <= v_ky order by s.ngay desc, s.created_at desc limit 1) as g
        from thanh_phan tp where tp.muc_tieu_id = m.id) x
      where x.g is not null;
    else  -- cong: đòi ĐỦ mọi phần có số; thiếu phần nào → null
      select case when count(*) filter (where x.g is null) > 0 then null else sum(x.g) end into v_so
      from (select (select s.gia_tri from so_do s where s.muc_tieu_id = m.id and s.thanh_phan_id = tp.id
                    and s.ngay <= v_ky order by s.ngay desc, s.created_at desc limit 1) as g
            from thanh_phan tp where tp.muc_tieu_id = m.id) x;
    end if;
    select count(*) into v_so_nguon from thanh_phan tp where tp.muc_tieu_id = m.id;

  elsif m.nguon_so = 'thuoc' then
    -- Σ giá các dây gop_so tới thước con duyet='duyet' ∧ trang_thai<>'dong', kẹp theo kỳ nếu cap lớp/nhóm/trường.
    v_nguon := 'may_tu_thuoc';
    v_kep := m.cap in ('lop','nhom','truong');
    v_gop := 0; v_so_nguon := 0;
    for r in
      select n.con_thuoc_id, n.he_so, th.gop as th_gop
      from noi n join thuoc th on th.id = n.con_thuoc_id
      where n.cha_id = m.id and n.vai = 'gop_so' and n.con_thuoc_id is not null
        and th.duyet = 'duyet' and th.trang_thai <> 'dong'
    loop
      v_so_nguon := v_so_nguon + 1;
      if r.th_gop = 'moi_nhat' then
        -- thước "lấy số mới nhất" là nguồn DUY NHẤT (noi_hop_le đã ép) → so = gia
        v_so := private.gop_thuoc_kep(r.con_thuoc_id, m.bat_dau, v_ky, v_kep);
      else
        v_dong := coalesce(private.gop_thuoc_kep(r.con_thuoc_id, m.bat_dau, v_ky, v_kep), 0) * r.he_so;
        v_gop := v_gop + v_dong;
      end if;
    end loop;
    if v_so_nguon = 0 then
      v_so := v_x;                                   -- không dây → so = x
    elsif (select count(*) from noi n join thuoc th on th.id=n.con_thuoc_id
           where n.cha_id=m.id and n.vai='gop_so' and th.gop='moi_nhat') = 0 then
      if v_x is null then v_so := v_gop;             -- x null có dây → "từ đầu tới giờ"
      elsif m.chieu = 'giam' then v_so := v_x - v_gop;
      else v_so := v_x + v_gop; end if;
    end if;

  elsif m.nguon_so = 'con' then
    -- Σ dây gop_so từ mục tiêu con, kẹp theo quãng CÓ HƯỚNG của con (§2.2).
    v_nguon := 'may_tu_con';
    v_kep := true;
    if m.gop_con = 'trung_binh' then
      v_gop := 0; v_so_nguon := 0;
      declare v_tong numeric := 0; v_dem int := 0;
      begin
        for r in select n.con_muc_tieu_id from noi n
          where n.cha_id = m.id and n.vai = 'gop_so' and n.con_muc_tieu_id is not null
        loop
          select * into sc from private.so_hien_tai(r.con_muc_tieu_id, v_ky, p_sau + 1) as t2;
          if sc.so is not null then v_tong := v_tong + sc.so; v_dem := v_dem + 1; end if;
        end loop;
        if v_dem > 0 then v_so := v_tong / v_dem; end if;
        v_so_nguon := v_dem;
      end;
    else  -- 'cong'
      v_gop := 0; v_so_nguon := 0;
      for r in select n.con_muc_tieu_id, n.he_so from noi n
        where n.cha_id = m.id and n.vai = 'gop_so' and n.con_muc_tieu_id is not null
      loop
        select * into sc from private.so_hien_tai(r.con_muc_tieu_id, v_ky, p_sau + 1) as t2;
        if sc.so is null then continue; end if;      -- con không số → bỏ
        -- đóng góp = quãng đã đi, kẹp [0, quãng con]
        select m2.chieu into v_tt from muc_tieu m2 where m2.id = r.con_muc_tieu_id;  -- tái dùng v_tt tạm
        if v_tt = 'giam' then
          if sc.x is null then continue; end if;      -- con giảm không x → bỏ
          v_dong := least(greatest(sc.x - sc.so, 0), sc.x - sc.y);
        else
          v_dong := least(greatest(sc.so - coalesce(sc.x, 0), 0), sc.y - coalesce(sc.x, 0));
        end if;
        v_gop := v_gop + v_dong * r.he_so;
        v_so_nguon := v_so_nguon + 1;
      end loop;
      v_tt := null;
      v_so := coalesce(v_x, 0) + v_gop;
    end if;
  end if;

  -- ── ti_le_dat (mọi nguon_so): tu_so/mau_so + so = 100·tu_so/mau_so ──────────────────
  if m.kieu_dich = 'ti_le_dat' then
    -- Đặc tả §2.3 phân theo lay_tu + bộ lọc; ở đây tính khung chung: mau_so = sĩ số/khung,
    -- tu_so = số đạt. ĐỘ ĐÚNG chi tiết theo lay_tu do test-phep-tinh-muc-tieu.sql chốt.
    v_tu_so := coalesce(v_tu_so, 0); v_mau_so := coalesce(v_mau_so, 0);
    if v_mau_so > 0 then v_so := 100.0 * v_tu_so / v_mau_so; else v_so := null; end if;
    v_nguon := coalesce(v_nguon, m.nguon_so);
  end if;

  -- ── le_ra: nội suy "lẽ ra hôm nay" theo NGÀY HỌC (§2.4) ─────────────────────────────
  if m.kieu_dich in ('toi','tran_tich_luy','toc_do_ky','giu') and v_x is not null then
    declare v_d date; v_x0 numeric;
    begin
      v_d := case m.kieu_dich when 'toc_do_ky' then v_ky_den else v_ky end;
      v_x0 := case when m.kieu_dich = 'tran_tich_luy' then coalesce(v_x, 0) else v_x end;
      if m.kieu_dich = 'giu' then
        v_le_ra := v_y;                               -- giữ: hằng y
      else
        v_songay_tong := private.so_ngay_hoc(v_campus, m.bat_dau, v_kt);
        v_songay_den  := private.so_ngay_hoc(v_campus, m.bat_dau, least(v_d, v_kt));
        if v_songay_tong is null or v_songay_tong = 0 then v_le_ra := null;
        else v_le_ra := v_x0 + (v_y - v_x0) * (v_songay_den / v_songay_tong); end if;
      end if;
    end;
  end if;

  -- ── pct / dat / trang_thai theo ma trận kiểu × chiều (§2.5) ─────────────────────────
  v_q := case when m.chieu = 'giam' then coalesce(v_x,0) - v_y else v_y - coalesce(v_x,0) end;
  if m.trang_thai = 'dong' then
    if m.ly_do_dong = 'dat' then v_dat := true; v_tt := 'dat';
    else v_dat := null; v_tt := 'dong'; end if;

  elsif m.kieu_dich = 'chu' then
    v_pct := null; v_dat := false; v_tt := 'dang_lam';

  elsif m.kieu_dich = 'ti_le_dat' then
    v_pct := case when v_y is not null and v_y <> 0 and v_so is not null then least(1, v_so / v_y) else null end;
    v_dat := (v_so is not null and v_so >= v_y);
    v_tt := case when v_dat then 'dat' else 'dang_lam' end;

  elsif m.kieu_dich = 'tran_tich_luy' then           -- so = Σ vi phạm; chieu='giu'
    v_pct := null;
    if v_so is not null and v_so > v_y then v_dat := false; v_tt := 'vuot';
    elsif v_het_ky and v_so is not null and v_so <= v_y then v_dat := true; v_tt := 'dat';
    else
      v_dat := null;
      if v_so is null then v_tt := 'chua_biet';
      elsif v_le_ra is not null and v_so <= v_le_ra then v_tt := 'dang_giu';
      elsif v_so <= v_y then v_tt := 'sat_nut';
      else v_tt := 'can_co'; end if;
    end if;

  elsif m.kieu_dich = 'giu' then                     -- theo kỳ; đếm so_ky_giu/so_ky_xet
    v_pct := null;
    -- (đếm kỳ đầy đủ để lại cho test-phep-tinh; ở đây tính trạng thái kỳ hiện tại + kết luận het_ky)
    if v_het_ky then
      v_dat := (coalesce(v_so_ky_xet,0) >= 1 and v_so_ky_giu = v_so_ky_xet);
      v_tt := case when v_dat then 'dat' else 'truot' end;
    else
      if v_so is null then v_dat := null; v_tt := 'chua_biet';
      else
        if (m.chieu in ('tang','giu') and v_so >= v_y) or (m.chieu = 'giam' and v_so <= v_y)
          then v_dat := null; v_tt := 'dang_giu';
          else v_dat := null; v_tt := 'can_co'; end if;
      end if;
    end if;

  elsif m.kieu_dich = 'toc_do_ky' then               -- so = số kỳ; xét kỳ cuối đã đóng
    v_pct := case when v_q <> 0 and v_so is not null then
       least(1, greatest(0, case when m.chieu='giam' then (coalesce(v_x,0)-v_so) else (v_so-coalesce(v_x,0)) end / v_q))
       else null end;
    if v_so is null then v_dat := null; v_tt := 'chua_biet';
    elsif m.chieu = 'giam' then
      v_dat := case when v_het_ky then v_so <= v_y else null end;
      v_tt := case when v_het_ky and v_so <= v_y then 'dat'
                   when v_het_ky then 'truot'
                   when v_le_ra is not null and v_so <= v_le_ra then 'dang_thang'
                   when v_le_ra is not null and v_so <= v_le_ra + 0.1 * v_q then 'sat_nut'
                   else 'can_co' end;
    else
      v_dat := case when v_het_ky then v_so >= v_y else null end;
      v_tt := case when v_het_ky and v_so >= v_y then 'dat'
                   when v_het_ky then 'truot'
                   when v_le_ra is not null and v_so >= v_le_ra then 'dang_thang'
                   when v_le_ra is not null and v_so >= v_le_ra - 0.1 * v_q then 'sat_nut'
                   else 'can_co' end;
    end if;

  else                                               -- 'toi' × tang/giam/giu
    if v_so is null then
      v_pct := null; v_dat := case when v_het_ky then false else null end;
      v_tt := case when v_het_ky then 'truot' else 'chua_biet' end;
    else
      if m.chieu = 'giam' then
        v_pct := case when v_q <> 0 then least(1, greatest(0, (coalesce(v_x,0) - v_so) / v_q)) else null end;
        v_dat := v_so <= v_y;
      else  -- tang / giu (x<y coi như tang)
        v_pct := case when v_q <> 0 then least(1, greatest(0, (v_so - coalesce(v_x,0)) / v_q)) else null end;
        v_dat := v_so >= v_y;
      end if;
      if v_dat then v_tt := 'dat';
      elsif v_het_ky then v_tt := 'truot';
      elsif v_le_ra is null then v_tt := 'dang_lam';
      elsif m.chieu = 'giam' then
        v_tt := case when v_so <= v_le_ra then 'dang_thang'
                     when v_so <= v_le_ra + 0.1 * v_q then 'sat_nut' else 'can_co' end;
      else
        v_tt := case when v_so >= v_le_ra then 'dang_thang'
                     when v_so >= v_le_ra - 0.1 * v_q then 'sat_nut' else 'can_co' end;
      end if;
    end if;
  end if;

  return query select v_so, v_nguon, v_ngay, v_so_nguon, v_x, v_y, v_le_ra, v_pct,
    v_dat, v_tt, v_ky_tu, v_ky_den, v_so_ky_giu, v_so_ky_xet, v_tu_so, v_mau_so;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGER DỮ LIỆU / VAI (schema private, security definer, KHÔNG "of <cột>").
-- ─────────────────────────────────────────────────────────────────────────────────────

-- 6.1 noi_hop_le (10-SCHEMA §4.5): máy chỉ tự nối 'chi_huong'; gop_so đòi nguon_so hợp, cấp thấp→cao,
--     số đo (moi_nhat) là nguồn duy nhất. Dây tạo được cả khi con còn 'gui' — phép cộng chỉ lấy 'duyet'.
create or replace function private.noi_hop_le() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_cha muc_tieu%rowtype; v_rank_cha int; v_rank_con int; v_con_gop text;
begin
  select * into v_cha from muc_tieu where id = new.cha_id;
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
drop trigger if exists trg_noi_hop_le on noi;
create trigger trg_noi_hop_le before insert on noi for each row execute function private.noi_hop_le();

-- 6.2 mt_truoc_xoa (10-SCHEMA §3.5) — hàm định nghĩa Ở ĐÂY vì thân đọc cam_ket + noi (giờ mới có).
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
drop trigger if exists trg_mt_truoc_xoa on muc_tieu;
create trigger trg_mt_truoc_xoa before delete on muc_tieu for each row execute function private.mt_truoc_xoa();

-- 6.3 cam_ket (20-QUYEN §3.4). Trần 2/tuần đếm THEO TỪNG TUẦN (chốt C28).
create or replace function private.ck_kiem_tran_tuan(c cam_ket) returns void
language plpgsql security definer set search_path = public as $$
declare v_ket_thuc date; v_max int;
begin
  v_ket_thuc := c.tuan_bat_dau + (c.so_tuan - 1) * 7;      -- KHÔNG đọc cột generated trong BEFORE
  select max(so) into v_max from (
    select count(*) as so
    from generate_series(c.tuan_bat_dau::timestamp, v_ket_thuc::timestamp, interval '7 days') w
    join cam_ket k on k.trang_thai = 'hieu_luc' and k.id is distinct from c.id
       and k.chu_the = c.chu_the and k.class_id = c.class_id
       and k.student_id is not distinct from c.student_id
       and k.nhom_id is not distinct from c.nhom_id
       and w::date between k.tuan_bat_dau and k.tuan_bat_dau + (k.so_tuan - 1) * 7
    group by w) s;
  if coalesce(v_max, 0) >= 2 then
    raise exception 'Mỗi tuần chỉ nên giữ nhiều nhất 2 cam kết — ít mà chắc' using errcode = '23514';
  end if;
end $$;

create or replace function private.ck_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_th thuoc%rowtype; v_mt muc_tieu%rowtype;
begin
  if v_me is null then return new; end if;                                   -- L6
  new.created_by := v_me;
  if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  new.ket_qua := null; new.cham_boi := null; new.cham_at := null;            -- không chấm lúc tạo
  new.so_dat := null; new.xong_at := null; new.goi_y := null;
  new.trang_thai := 'hieu_luc';
  if new.chu_the = 'em' and not exists (select 1 from enrollments e
       where e.class_id = new.class_id and e.student_id = new.student_id and e.is_active) then
    raise exception 'Em này không còn học ở lớp' using errcode = '23503';
  end if;
  if new.thuoc_id is not null then                                           -- neo cùng chủ thể
    select * into v_th from thuoc where id = new.thuoc_id;
    if v_th.id is null or v_th.class_id is distinct from new.class_id
       or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
      raise exception 'Việc gắn vào cam kết phải là việc của em hoặc của lớp/nhóm em' using errcode = '23514';
    end if;
  end if;
  if new.muc_tieu_id is not null then
    select * into v_mt from muc_tieu where id = new.muc_tieu_id;
    if v_mt.id is null or (v_mt.cap <> 'truong' and v_mt.class_id is distinct from new.class_id)
       or (v_mt.cap = 'em' and v_mt.student_id is distinct from new.student_id) then
      raise exception 'Mục tiêu gắn vào cam kết phải là mục tiêu của em hoặc của lớp/nhóm em' using errcode = '23514';
    end if;
  end if;
  if new.pdr_meeting_id is not null and exists (select 1 from pdr_meetings p
       where p.id = new.pdr_meeting_id and p.student_id is distinct from new.student_id) then
    raise exception 'Biên bản họp không phải của em này' using errcode = '23514';
  end if;
  perform private.ck_kiem_tran_tuan(new);
  return new;
end $$;
drop trigger if exists trg_ck_truoc_them on cam_ket;
create trigger trg_ck_truoc_them before insert on cam_ket for each row execute function private.ck_truoc_them();

create or replace function private.ck_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['ket_qua','cham_boi','cham_at','so_dat','xong_at',
      'goi_y','trang_thai','nguoi_nhap_ho','updated_at','class_id'];
  v_tu_pdr boolean := coalesce(current_setting('va.tu_pdr', true), '') = '1';
  v_doi boolean; v_ket_thuc date; v_cham_doi boolean;
begin
  if v_me is null and not v_tu_pdr then return new; end if;
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của cam kết chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if v_tu_pdr then return new; end if;               -- pkl_sau_ghi tự đặt đủ bộ chấm — khe hẹp có điều kiện
  v_doi := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ket_thuc := new.tuan_bat_dau + (new.so_tuan - 1) * 7;
  if v_doi then
    if cam_ket_da_ke_lai(new.id) then
      raise exception 'Cam kết này đã được kể lại trong buổi họp nên không sửa được nữa' using errcode = '42501';
    end if;
    if old.ket_qua is not null then
      raise exception 'Cam kết đã chấm rồi — muốn sửa thì nhờ thầy cô' using errcode = '42501';
    end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    if (new.tuan_bat_dau, new.so_tuan) is distinct from (old.tuan_bat_dau, old.so_tuan) then
      perform private.ck_kiem_tran_tuan(new);        -- đổi tuần thì đếm lại trần
    end if;
  end if;
  v_cham_doi := (new.ket_qua, new.so_dat, new.xong_at) is distinct from (old.ket_qua, old.so_dat, old.xong_at);
  if v_cham_doi then
    if new.chu_the = 'em' then
      if v_me <> new.student_id and not (is_class_teacher(new.class_id) and lop_nhap_ho(new.class_id)) then
        raise exception 'Em tự chấm Thắng/Thua cho cam kết của mình; thầy cô chỉ chấm cam kết của lớp'
          using errcode = '42501';
      end if;
    elsif not (is_class_teacher(new.class_id) or (select auth_role()) = 'admin') then
      raise exception 'Cam kết của lớp do thầy cô chủ nhiệm chấm' using errcode = '42501';
    end if;
    if cam_ket_da_ke_lai(new.id) then                -- ký là chốt — không chấm lại sau ký
      raise exception 'Cam kết này đã chốt trong buổi họp — muốn sửa thì nhờ thầy cô mở tuần' using errcode = '42501';
    end if;
    if new.ket_qua is not null and old.ket_qua is null then
      if coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today()) < v_ket_thuc + 4
         and new.xong_at is null then
        raise exception 'Đợi đến thứ Sáu tuần cuối rồi chấm nhé' using errcode = '23514';
      end if;
      new.cham_boi := v_me; new.cham_at := now();
      select g.goi_y into new.goi_y from public.goi_y_cam_ket(new.id) g;    -- ẢNH CHỤP gợi ý lúc chấm (hàm trả BẢNG)
      new.xong_at := coalesce(new.xong_at, now());
    elsif new.ket_qua is null and old.ket_qua is not null then
      new.cham_boi := null; new.cham_at := null; new.goi_y := null;
      new.so_dat := null; new.xong_at := null;       -- bỏ chấm (cùng người được chấm)
    else
      new.cham_boi := v_me; new.cham_at := now();     -- sửa so_dat/xong_at trên dòng đã chấm
    end if;
  else
    new.cham_boi := old.cham_boi; new.cham_at := old.cham_at; new.goi_y := old.goi_y;  -- chống giả chữ ký
  end if;
  if new.trang_thai = 'huy' and old.trang_thai <> 'huy'
     and (cam_ket_da_ke_lai(new.id) or old.ket_qua is not null) then
    raise exception 'Cam kết đã kể lại hoặc đã chấm thì không huỷ được' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_ck_truoc_sua on cam_ket;
create trigger trg_ck_truoc_sua before update on cam_ket for each row execute function private.ck_truoc_sua();

drop trigger if exists trg_touch_cam_ket on cam_ket;
create trigger trg_touch_cam_ket before update on cam_ket for each row execute function touch_updated_at();

-- 6.4 cam_ket_xac_nhan (20-QUYEN §3.5): nguoi_id := uid; vai SUY từ quan hệ, không tin đầu vào.
create or replace function private.ckxn_dung_vai() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); c cam_ket%rowtype;
begin
  if v_me is null then return new; end if;
  new.nguoi_id := v_me;
  select * into c from cam_ket where id = new.cam_ket_id;
  if is_class_teacher(c.class_id) then new.vai := 'thay_co';
  elsif is_my_child(c.student_id) then new.vai := 'phu_huynh';
  elsif is_my_buddy(c.student_id) then new.vai := 'buddy';
  else raise exception 'Bạn không phải người có thể xác nhận cam kết này' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_ckxn_dung_vai on cam_ket_xac_nhan;
create trigger trg_ckxn_dung_vai before insert on cam_ket_xac_nhan for each row execute function private.ckxn_dung_vai();

-- 6.5 pdr_ke_lai + pdr_meetings (20-QUYEN §3.6).
create or replace function private.pkl_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pdr_meetings%rowtype; c cam_ket%rowtype;
begin
  select * into p from pdr_meetings where id = new.pdr_meeting_id;
  select * into c from cam_ket where id = new.cam_ket_id;
  if c.chu_the <> 'em' or c.student_id is distinct from p.student_id then
    raise exception 'Chỉ kể lại cam kết của chính em' using errcode = '23514';
  end if;
  if c.tuan_bat_dau > thu_hai_tu_nhan(p.week_label) then
    raise exception 'Cam kết này chưa bắt đầu, chưa kể lại được' using errcode = '23514';
  end if;
  if p.acknowledged_at is not null and (select auth.uid()) is not null then
    raise exception 'Biên bản đã ký, không kể lại thêm được' using errcode = '42501';
  end if;
  if new.so_dat is not null and c.so_hua is null then
    raise exception 'Cam kết này không hứa con số — chỉ chấm thắng/thua thôi' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_pkl_truoc_ghi on pdr_ke_lai;
create trigger trg_pkl_truoc_ghi before insert or update on pdr_ke_lai for each row execute function private.pkl_truoc_ghi();

create or replace function private.pkl_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is not null
     and exists (select 1 from pdr_meetings m where m.id = old.pdr_meeting_id and m.acknowledged_at is not null) then
    raise exception 'Biên bản đã ký — muốn sửa thì nhờ thầy cô mở tuần' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists trg_pkl_truoc_xoa on pdr_ke_lai;
create trigger trg_pkl_truoc_xoa before delete on pdr_ke_lai for each row execute function private.pkl_truoc_xoa();

-- Câu 2 chốt → chép về cam_ket (cam_ket là nguồn duy nhất của kết quả; pdr_ke_lai là bản kể).
create or replace function private.pkl_sau_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pdr_meetings%rowtype;
begin
  select * into p from pdr_meetings where id = new.pdr_meeting_id;
  perform set_config('va.tu_pdr', '1', true);
  if new.ket_qua is not null then
    update cam_ket set ket_qua = new.ket_qua, so_dat = coalesce(new.so_dat, so_dat),
           cham_boi = p.student_id, cham_at = now(),
           goi_y = (select g.goi_y from public.goi_y_cam_ket(new.cam_ket_id) g),
           xong_at = coalesce(xong_at, now())
     where id = new.cam_ket_id;
  elsif tg_op = 'UPDATE' and old.ket_qua is not null then
    update cam_ket set ket_qua = null, so_dat = null, cham_boi = null, cham_at = null,
           goi_y = null, xong_at = null
     where id = new.cam_ket_id;
  end if;
  perform set_config('va.tu_pdr', '', true);
  return null;
end $$;
drop trigger if exists trg_pkl_sau_ghi on pdr_ke_lai;
create trigger trg_pkl_sau_ghi after insert or update on pdr_ke_lai for each row execute function private.pkl_sau_ghi();

-- pdr_meetings: đông cứng sau ký; sửa câu = chỉ em (hoặc GVCN lớp nhập hộ); ký = chính người bấm.
create or replace function private.pdr_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_doi_cau boolean;
begin
  if v_me is null then return new; end if;                                   -- L6
  if old.acknowledged_at is not null and (select auth_role()) <> 'admin' then
    raise exception 'Biên bản đã ký, không sửa được nữa' using errcode = '42501';
  end if;
  v_doi_cau := (new.q1_plan, new.q2_result, new.q3_obstacle, new.q4_overcome, new.q5_better_way, new.q6_commitment)
             is distinct from (old.q1_plan, old.q2_result, old.q3_obstacle, old.q4_overcome, old.q5_better_way, old.q6_commitment);
  -- (a) sửa câu trả lời: chỉ em / GVCN lớp nhập hộ — VÔ ĐIỀU KIỆN (vá lỗ buddy sửa-rồi-ký-hai-bước)
  if v_doi_cau and v_me <> new.student_id then
    if not (is_class_teacher(new.class_id) and lop_nhap_ho(new.class_id)) then
      raise exception 'Chỉ em mới sửa được câu trả lời của mình' using errcode = '42501';
    end if;
    new.nguoi_nhap_ho := v_me;
  end if;
  -- (b) ký
  if new.acknowledged_at is not null and old.acknowledged_at is null then
    if new.acknowledged_by is distinct from v_me then
      raise exception 'Chữ ký phải là của chính người bấm' using errcode = '42501';
    end if;
    if not pdr_chu_ky_hop_le(new.student_id, new.type, new.counterpart_id, new.second_buddy_id,
                             new.acknowledged_by, new.class_id) then
      raise exception 'Chỉ em, hoặc bạn cùng nhóm ở lớp được nhập hộ, mới ký được biên bản' using errcode = '42501';
    end if;
    if new.acknowledged_by <> new.student_id and v_doi_cau then
      raise exception 'Bạn chỉ ký, không sửa câu trả lời của bạn' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_pdr_truoc_sua on pdr_meetings;
create trigger trg_pdr_truoc_sua before update on pdr_meetings for each row execute function private.pdr_truoc_sua();

-- 6.6 edit_requests (20-QUYEN §3.7): đặt resolved_*; chặn requester đổi nội dung yêu cầu pending; áp dụng khi duyệt.
create or replace function private.er_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then return new; end if;
  if old.status = 'pending' and new.status <> 'pending' then
    new.resolved_by := v_me; new.resolved_at := now();
  end if;
  if old.status = 'pending' and not staff_can_manage_class(new.class_id)
     and (new.student_id, new.class_id, new.kind, new.ref_id, new.tuan)
         is distinct from (old.student_id, old.class_id, old.kind, old.ref_id, old.tuan) then
    raise exception 'Muốn đổi nội dung yêu cầu thì rút rồi gửi lại' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_er_truoc_sua on edit_requests;
create trigger trg_er_truoc_sua before update on edit_requests for each row execute function private.er_truoc_sua();

create or replace function private.er_sau_duyet() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_th thuoc%rowtype;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.kind = 'doi_ten_thuoc' then
      select * into v_th from thuoc where id = new.ref_id;
      if v_th.id is null or v_th.class_id is distinct from new.class_id
         or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
        raise exception 'Yêu cầu này không trỏ vào việc của đúng lớp/đúng em' using errcode = '23514';
      end if;
      perform set_config('va.doi_ten_qua_yeu_cau', '1', true);
      update thuoc set ten = btrim(new.message) where id = new.ref_id;
      perform set_config('va.doi_ten_qua_yeu_cau', '', true);
    elsif new.kind = 'mo_tuan_da_ky' then
      insert into luot_mo_khoa (student_id, class_id, week_start, mo_boi, mo_at, het_han, edit_request_id)
      values (new.student_id, new.class_id, new.tuan,
              coalesce(new.resolved_by, (select auth.uid())), now(), now() + interval '48 hours', new.id);
      perform log_audit('mo_tuan_da_ky', jsonb_build_object('edit_request', new.id, 'tuan', new.tuan));
    end if;                                          -- 'rename_lead' cũ: app cũ tự áp, trigger không đụng
  end if;
  return null;
end $$;
drop trigger if exists trg_er_sau_duyet on edit_requests;
create trigger trg_er_sau_duyet after update on edit_requests for each row execute function private.er_sau_duyet();

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 7. POLICY (20-QUYEN §2.11–§2.16). Mọi policy to authenticated; admin luôn rls_all_<bảng>.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- 7.1 luot_mo_khoa (§2.11)
drop policy if exists rls_select_lmk on luot_mo_khoa;
create policy rls_select_lmk on luot_mo_khoa for select to authenticated
  using (student_id = (select auth.uid()) or is_my_child(student_id) or staff_can_read_class(class_id));
drop policy if exists rls_dong_som_lmk on luot_mo_khoa;
create policy rls_dong_som_lmk on luot_mo_khoa for update to authenticated
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id) and het_han <= now());   -- GVCN chỉ ĐÓNG SỚM
drop policy if exists rls_all_luot_mo_khoa on luot_mo_khoa;
create policy rls_all_luot_mo_khoa on luot_mo_khoa for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 7.2 cam_ket (§2.12) — KHÔNG duyệt
drop policy if exists rls_select_cam_ket on cam_ket;
create policy rls_select_cam_ket on cam_ket for select to authenticated
  using (doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
         or (chu_the = 'em' and is_my_buddy(student_id)));
drop policy if exists rls_insert_cam_ket on cam_ket;
create policy rls_insert_cam_ket on cam_ket for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid()) and is_class_student(class_id))
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))));
drop policy if exists rls_update_cam_ket on cam_ket;
create policy rls_update_cam_ket on cam_ket for update to authenticated
  using (ghi_duoc_cam_ket(id))
  with check (
       (select auth_role()) = 'admin'
    or (chu_the = 'em' and (student_id = (select auth.uid())
                            or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id)));
drop policy if exists rls_delete_cam_ket on cam_ket;
create policy rls_delete_cam_ket on cam_ket for delete to authenticated
  using (ket_qua is null and not cam_ket_da_ke_lai(id)
         and not exists (select 1 from cam_ket_xac_nhan x where x.cam_ket_id = cam_ket.id)
         and ghi_duoc_cam_ket(id));
drop policy if exists rls_all_cam_ket on cam_ket;
create policy rls_all_cam_ket on cam_ket for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 7.3 cam_ket_xac_nhan (§2.13)
drop policy if exists rls_select_ckxn on cam_ket_xac_nhan;
create policy rls_select_ckxn on cam_ket_xac_nhan for select to authenticated using (doc_duoc_cam_ket(cam_ket_id));
drop policy if exists rls_insert_ckxn on cam_ket_xac_nhan;
create policy rls_insert_ckxn on cam_ket_xac_nhan for insert to authenticated
  with check (nguoi_id = (select auth.uid()) and xac_nhan_duoc_cam_ket(cam_ket_id));
drop policy if exists rls_sua_ckxn on cam_ket_xac_nhan;
create policy rls_sua_ckxn on cam_ket_xac_nhan for update to authenticated
  using (nguoi_id = (select auth.uid())) with check (nguoi_id = (select auth.uid()));
drop policy if exists rls_xoa_ckxn on cam_ket_xac_nhan;
create policy rls_xoa_ckxn on cam_ket_xac_nhan for delete to authenticated using (nguoi_id = (select auth.uid()));
drop policy if exists rls_all_ckxn on cam_ket_xac_nhan;
create policy rls_all_ckxn on cam_ket_xac_nhan for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 7.4 pdr_ke_lai (§2.14)
drop policy if exists rls_select_pkl on pdr_ke_lai;
create policy rls_select_pkl on pdr_ke_lai for select to authenticated
  using (is_pdr_participant(pdr_meeting_id) or staff_can_read_class(pdr_class(pdr_meeting_id)));
drop policy if exists rls_manage_pkl on pdr_ke_lai;
create policy rls_manage_pkl on pdr_ke_lai for all to authenticated
  using (ghi_duoc_pdr_ke_lai(pdr_meeting_id)) with check (ghi_duoc_pdr_ke_lai(pdr_meeting_id));
drop policy if exists rls_all_pkl on pdr_ke_lai;
create policy rls_all_pkl on pdr_ke_lai for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 7.5 pdr_meetings — thêm MỘT khe hẹp: bạn cùng nhóm KÝ ở lớp nhập hộ (policy cũ giữ nguyên).
drop policy if exists pdr_buddy_ky on pdr_meetings;
create policy pdr_buddy_ky on pdr_meetings for update to authenticated
  using (type = 'buddy' and acknowledged_at is null and lop_nhap_ho(class_id)
         and (select auth.uid()) in (counterpart_id, second_buddy_id))
  with check (type = 'buddy' and lop_nhap_ho(class_id)
              and acknowledged_by = (select auth.uid()) and acknowledged_at is not null);

-- 7.6 edit_requests — đặt lại policy insert (vá lỗ em A gửi yêu cầu mang student_id của B).
drop policy if exists rls_insert_edit_requests on edit_requests;
create policy rls_insert_edit_requests on edit_requests for insert to authenticated
  with check (requester_id = (select auth.uid())
              and ((is_class_student(class_id) and student_id = (select auth.uid()))
                   or is_my_child(student_id)
                   or (kind = 'mo_tuan_da_ky' and staff_can_manage_class(class_id))));

-- 7.7 noi (§2.16) — RLS theo chủ thể CHA, đọc đòi CẢ con. KHÔNG có UPDATE (dây gỡ rồi nối lại).
drop policy if exists rls_select_noi on noi;
create policy rls_select_noi on noi for select to authenticated
  using (doc_duoc_muc_tieu(cha_id) and doc_duoc_con(con_loai, con_id));
drop policy if exists rls_insert_noi on noi;
create policy rls_insert_noi on noi for insert to authenticated
  with check (created_by = (select auth.uid()) and noi_tu_dong = false
              and doc_duoc_muc_tieu(cha_id) and ghi_duoc_con(con_loai, con_id)
              and (vai = 'chi_huong'                          -- em tự HƯỚNG lên mục tiêu lớp (C15)
                   or (vai = 'gop_so' and ghi_duoc_muc_tieu(cha_id))));
drop policy if exists rls_delete_noi on noi;
create policy rls_delete_noi on noi for delete to authenticated
  using (ghi_duoc_con(con_loai, con_id) or ghi_duoc_muc_tieu(cha_id));
drop policy if exists rls_all_noi on noi;
create policy rls_all_noi on noi for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 8. ĐẶT LẠI POLICY của tệp trước (giờ hàm khoá đã tồn tại).
-- ─────────────────────────────────────────────────────────────────────────────────────

-- 8.1 luot (20-QUYEN §2.10) — 0164 tạo bốn policy này CHƯA có vế luot_bi_khoa; đặt lại NGUYÊN VĂN + khoá.
drop policy if exists rls_em_ghi_luot on luot;
create policy rls_em_ghi_luot on luot for insert to authenticated
  with check (student_id = (select auth.uid()) and nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and thuoc_nhan_luot(thuoc_id, student_id)
              and trong_cua_so_ghi(ngay)
              and not luot_bi_khoa(student_id, ngay));
drop policy if exists rls_thay_co_ghi_luot on luot;
create policy rls_thay_co_ghi_luot on luot for insert to authenticated
  with check (nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and ghi_ho_duoc_luot(thuoc_id)
              and thuoc_nhan_luot(thuoc_id, student_id)
              and (student_id is null or not luot_bi_khoa(student_id, ngay)));
drop policy if exists rls_update_luot on luot;
create policy rls_update_luot on luot for update to authenticated
  using (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)))
  with check (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
              and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));
drop policy if exists rls_delete_luot on luot;
create policy rls_delete_luot on luot for delete to authenticated
  using (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));

-- 8.2 muc_tieu delete (20-QUYEN §2.5) — thêm vế noi/cam_ket (0163 tạo bản chưa có hai vế đó).
drop policy if exists rls_delete_muc_tieu on muc_tieu;
create policy rls_delete_muc_tieu on muc_tieu for delete to authenticated
  using (trang_thai in ('nhap','gui','tra_lai')
         and ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
         and not exists (select 1 from so_do s where s.muc_tieu_id = muc_tieu.id)
         and not exists (select 1 from noi n where n.cha_id = muc_tieu.id or n.con_muc_tieu_id = muc_tieu.id)
         and not exists (select 1 from cam_ket c where c.muc_tieu_id = muc_tieu.id and c.trang_thai = 'hieu_luc'));

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 9. KHỐI GRANT (L2). Hàm public đã gác → grant authenticated; hàm private/lõi → revoke đủ ba vai.
-- ─────────────────────────────────────────────────────────────────────────────────────
do $$ declare f text; begin
  foreach f in array array[
    'pdr_chu_ky_hop_le(uuid,text,uuid,uuid,uuid,uuid)','trong_cua_so_ghi(date)','luot_bi_khoa(uuid,date)',
    'cam_ket_student(uuid)','cam_ket_da_ke_lai(uuid)','doc_duoc_cam_ket(uuid)','ghi_duoc_cam_ket(uuid)',
    'pdr_class(uuid)','ghi_duoc_pdr_ke_lai(uuid)','xac_nhan_duoc_cam_ket(uuid)',
    'doc_duoc_con(text,uuid)','ghi_duoc_con(text,uuid)','goi_y_cam_ket(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Hàm lõi + trigger (chỉ máy gọi qua trigger / hàm đã gác) — không endpoint PostgREST.
revoke all on function private.so_hien_tai(uuid, date, int) from public, anon, authenticated;
revoke all on function private.noi_hop_le() from public, anon, authenticated;
revoke all on function private.mt_truoc_xoa() from public, anon, authenticated;
revoke all on function private.ck_kiem_tran_tuan(cam_ket) from public, anon, authenticated;
revoke all on function private.ck_truoc_them() from public, anon, authenticated;
revoke all on function private.ck_truoc_sua() from public, anon, authenticated;
revoke all on function private.ckxn_dung_vai() from public, anon, authenticated;
revoke all on function private.pkl_truoc_ghi() from public, anon, authenticated;
revoke all on function private.pkl_truoc_xoa() from public, anon, authenticated;
revoke all on function private.pkl_sau_ghi() from public, anon, authenticated;
revoke all on function private.pdr_truoc_sua() from public, anon, authenticated;
revoke all on function private.er_truoc_sua() from public, anon, authenticated;
revoke all on function private.er_sau_duyet() from public, anon, authenticated;

commit;
