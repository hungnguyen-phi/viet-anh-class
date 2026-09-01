-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0164 — PA2: THƯỚC (việc em làm), lịch sử chỉ tiêu, và LƯỢT ghi. Chủ dự án 01/09/2026:
-- xây thẳng PA2, không song song, không di trú (đã sao lưu JSON). Đặc tả: docs/PA2/
-- (10 §3, 20 §1.2 phần thước, §2.8–2.10, §3.3; 50-DI-TRU §1 tệp 0164).
--
-- Vì sao tệp này là chỗ nhạy nhất của mô hình: `luot` giữ MỌI lần em ghi một việc — mọi số trên
-- màn đều cộng từ đây, nên bốn luật phải đúng ở TẦNG DỮ LIỆU: (1) THƯỚC có HAI cột trạng thái ĐỘC
-- LẬP — `trang_thai` (chay/tam_dung/dong = vòng đời) và `duyet` (gui/duyet/tra_lai = vòng duyệt) —
-- cộng `da_tung_duyet` đông cứng nội dung để không ai lách "hạ chỉ tiêu → về gui → sửa thẳng";
-- (2) thước `duyet='gui'` của em VẪN nhận lượt (không ai phải chờ duyệt mới được làm việc tốt,
-- [H-09]); (3) một em chỉ theo dõi ≤4 việc phải ghi cùng lúc (trần trung tính, không nêu tên);
-- (4) lượt em ghi trong CỬA SỔ 7 ngày, thầy cô ghi hộ không vướng cửa sổ ([H-25]). KHOÁ theo chữ
-- ký PDR chưa dựng ở tệp này (hàm `luot_bi_khoa` cần `pdr_ke_lai` → 0165 ĐẶT LẠI bốn policy `luot`
-- thêm vế khoá; giữa 0164 và 0165 chưa màn nào ghi lượt vì PR-3 chưa lên). Tệp CHỈ THÊM (drop 0168).
-- Phụ thuộc 0162 (nhom/nhom_thanh_vien/don_vi/helper thuoc_co_so..em_trong_nhom), 0163
-- (doi_noi_dung, doc/ghi_duoc_chu_the).
--
-- GHI CHÚ TÍCH HỢP (báo cho tác nhân khác — chỗ lệch/thêm so với đặc tả, có chủ đích):
--  (a) `private.gia_thuoc` + chi_tieu_tai/ky_cua_thuoc/gop_thuoc_kep: 50-DI-TRU §1 xếp ở 0164,
--      nhưng 0166 (tầng đọc) đã ĐẶT CẢ CỤM ở đó theo yêu cầu điều phối "0166 = trọn tầng đọc" và
--      dặn 0164/0165 KHÔNG tự định nghĩa (tránh hai bản tay). ĐÃ KIỂM: validator plpgsql của
--      đường chạy thật (run-sql qua pooler) LỎNG — hàm 0165 gọi `gia_thuoc` tạo được dù 0166 định
--      nghĩa sau. Nên 0164 KHÔNG mang cụm đọc; giữ nguyên phân công thực tế của 0166.
--  (b) `public.trong_cua_so_ghi(date)` được định nghĩa Ở ĐÂY (ngoài 0165) vì CREATE POLICY kiểm
--      CHẶT sự tồn tại hàm: bốn policy `luot` cửa-sổ của 0164 tham chiếu nó. Hàm thuần (không đọc
--      bảng); 0165 `create or replace` lại y nguyên → no-op. Không phải hai bản tay đáng lo.
--  (c) Cờ phiên `va.th_duyet_dong_bo`: đặc tả để th_truoc_sua và thls_truoc_sua/thls_sau_xoa cùng
--      đồng bộ cờ `duyet` giữa `thuoc` và `thuoc_lich_su` bằng hai câu update chéo. Nếu để trần,
--      chúng tự cập nhật lại DÒNG ĐANG SỬA trong chính BEFORE trigger của nó → lỗi
--      triggered_data_change_violation. Cờ này chặn vòng chéo (một chiều thắng), giữ y nguyên MỌI
--      kết quả đặc tả (60-KIEM §1.7): em rút dòng hạ → thuoc.duyet trở về 'duyet'; GVCN duyệt dòng
--      hạ → 'hieu_luc' ∧ thuoc 'duyet'. KHÔNG phải khe cho người ghi (chỉ mở đúng 'gui'→'duyet' khi
--      nội dung không đổi, do hai trigger anh em bật).
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. thuoc — HAI cột trạng thái độc lập (chốt C2). 10 §3.1. L1 ngay dưới create.
-- ─────────────────────────────────────────────────────────────────────────────────────
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
  da_tung_duyet  boolean not null default false,      -- true ⇒ nội dung ĐÔNG CỨNG bất kể duyet đang là gì
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
alter table thuoc enable row level security;
revoke all on table thuoc from anon;
grant select, insert, update, delete on thuoc to authenticated;
create index if not exists idx_thuoc_class   on thuoc (class_id) where trang_thai <> 'dong';
create index if not exists idx_thuoc_student on thuoc (student_id) where student_id is not null;
-- Một lớp chỉ một thước ĐANG SỐNG cho mỗi môn (thước môn của GVBM).
create unique index if not exists thuoc_mon_uidx on thuoc (class_id, subject_id)
  where subject_id is not null and trang_thai <> 'dong';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. thuoc_lich_su — đổi chỉ tiêu, hiệu lực từ TUẦN SAU; chỉ dòng 'hieu_luc' vào phép tính. 10 §3.2.
-- ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists thuoc_lich_su (
  id           uuid primary key default gen_random_uuid(),
  thuoc_id     uuid not null references thuoc(id) on delete cascade,
  tu_tuan      date not null,
  chi_tieu_ky  numeric null,            -- null = tuần tạm dừng (miễn)
  ngay_ap_dung smallint[] null,
  moi_lan      numeric null,
  trang_thai   text not null default 'hieu_luc',
  la_ha        boolean not null default false,   -- "dễ đi hơn": kiêng nới trần / khác thì giảm chỉ tiêu
  nguoi_doi    uuid null default auth.uid() references profiles(id) on delete set null,
  ly_do        text null,
  duyet_boi    uuid null references profiles(id) on delete set null,
  duyet_at     timestamptz null,
  created_at   timestamptz not null default now(),
  constraint thls_thu_hai_ck    check (extract(isodow from tu_tuan) = 1),
  constraint thls_trang_thai_ck check (trang_thai in ('hieu_luc','cho_duyet','tu_choi')),
  constraint thls_chi_tieu_ck   check (chi_tieu_ky is null or chi_tieu_ky >= 0)
);
alter table thuoc_lich_su enable row level security;
revoke all on table thuoc_lich_su from anon;
grant select, insert, update, delete on thuoc_lich_su to authenticated;
create index if not exists idx_thls_thuoc on thuoc_lich_su (thuoc_id, tu_tuan desc);

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. luot — một lần ghi của một chủ thể vào một thước một ngày. 10 §3.3. Bảng nhạy nhất.
--    gia_tri ĐÃ theo đơn vị của thước (app ghi = moi_lan cho cách 'cham'); đọc không nhân lại.
--    gia_tri = 0 là dòng thật ("có làm được 0" ≠ "không ghi").
-- ─────────────────────────────────────────────────────────────────────────────────────
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
alter table luot enable row level security;
revoke all on table luot from anon;
grant select, insert, update, delete on luot to authenticated;
-- Một chủ thể, một thước, một ngày: cho phép nhiều lượt phân biệt bằng stt.
create unique index if not exists luot_ngay_uidx     on luot (thuoc_id, chu_the_key, ngay, stt);
-- Lượt máy (điểm danh) idempotent: một (thuoc, em, ngày) tối đa một dòng he_thong.
create unique index if not exists luot_he_thong_uidx on luot (thuoc_id, student_id, ngay) where nguon = 'he_thong';
-- Câu DELETE khi sửa điểm danh khỏi quét cả bảng (góp ý #20).
create index if not exists idx_luot_nguon_ref        on luot (nguon_ref) where nguon = 'he_thong';
create index if not exists idx_luot_thuoc_ngay       on luot (thuoc_id, ngay);
create index if not exists idx_luot_student          on luot (student_id, ngay) where student_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. Helper THƯỚC (20 §1.2) + cửa sổ ghi — public, definer/thuần, đặt TRƯỚC policy dùng chúng.
--    doc = đọc được dòng; ghi = ghi NỘI DUNG (chưa duyệt, KHÔNG nhánh principal — chốt C23);
--    duyet = GVCN/admin cho MỌI chủ thể kể cả thước môn (chốt C11); ghi_ho = ai ghi hộ/ghi cả đội.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.thuoc_class(t uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from thuoc where id = t; $$;

create or replace function public.doc_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
      or (subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;

-- GHI NỘI DUNG thước — bộ riêng, KHÔNG có nhánh principal (chốt C23).
create or replace function public.ghi_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin'
      or (chu_the = 'em' and (student_id = (select auth.uid())
                              or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
      or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
      or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;

-- NGƯỜI DUYỆT thước: GVCN/admin cho MỌI chủ thể, kể cả thước môn (chốt C11, [H-07][H-08]).
create or replace function public.duyet_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select staff_can_manage_class(class_id) from thuoc where id = t; $$;

-- Ai GHI HỘ lượt / ghi lượt cả đội (GVCN, GVBM đúng môn, admin).
create or replace function public.ghi_ho_duoc_luot(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select staff_can_manage_class(class_id)
      or (subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;

-- Thước đang nhận lượt của chủ thể p_student (null = lượt cả đội)? 'gui' vẫn ghi được ([H-09]).
create or replace function public.thuoc_nhan_luot(t uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from thuoc th
    where th.id = t and th.trang_thai = 'chay' and th.duyet in ('gui','duyet')
      and case when p_student is null then th.pham_vi = 'ca_doi'
          else th.pham_vi = 'tung_em' and case th.chu_the
            when 'em'   then th.student_id = p_student
            when 'lop'  then exists (select 1 from enrollments e
                                     where e.class_id = th.class_id and e.student_id = p_student and e.is_active)
            when 'nhom' then em_trong_nhom(th.nhom_id, p_student) end
          end);
$$;

-- Cửa sổ ghi 7 ngày của EM (thầy cô ghi hộ KHÔNG vướng — chốt C25). Không definer, không đọc bảng.
-- Cũng có trong 0165 (create or replace y nguyên); đặt ở đây vì CREATE POLICY 0164 cần nó tồn tại.
create or replace function public.trong_cua_so_ghi(p_ngay date) returns boolean
language sql stable set search_path = public as $$
  select p_ngay between vn_today() - 6 and vn_today();
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. Trần THEO NGƯỜI (20 §3.3b): một em ≤4 việc phải ghi cùng lúc. ca_doi + tam_dung/dong không tính.
-- ─────────────────────────────────────────────────────────────────────────────────────
-- Đếm "việc một em phải ghi" trong một lớp: thước của chính em + thước lớp/nhóm tung_em (kể cả môn),
-- chỉ trang_thai='chay'.
create or replace function private.dem_viec_phai_ghi(p_class uuid, p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from thuoc t
   where t.trang_thai = 'chay' and t.class_id = p_class and t.pham_vi = 'tung_em'
     and ( (t.chu_the = 'em'   and t.student_id = p_student)
        or (t.chu_the = 'lop')
        or (t.chu_the = 'nhom' and em_trong_nhom(t.nhom_id, p_student)) );
$$;

create or replace function private.th_kiem_tran(t thuoc) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_vuot int;
begin
  if t.trang_thai <> 'chay' or t.pham_vi = 'ca_doi' then return; end if;   -- ca_doi/tam_dung/dong không vào trần
  if t.chu_the = 'em' then
    if private.dem_viec_phai_ghi(t.class_id, t.student_id) >= 4 then       -- +1 dòng mới ⇒ vượt 4
      raise exception 'Đang theo dõi 4 việc rồi — kết thúc một việc trước nhé' using errcode = '23514';
    end if;
  elsif t.chu_the in ('lop','nhom') and t.pham_vi = 'tung_em' then
    if t.chu_the = 'lop' then
      select count(*) into v_vuot from enrollments e
        where e.class_id = t.class_id and e.is_active
          and private.dem_viec_phai_ghi(t.class_id, e.student_id) >= 4;
    else
      select count(*) into v_vuot from nhom_thanh_vien v
        where v.nhom_id = t.nhom_id and v.is_active
          and private.dem_viec_phai_ghi(t.class_id, v.student_id) >= 4;
    end if;
    if coalesce(v_vuot, 0) > 0 then                                        -- nêu SỐ, KHÔNG nêu tên (L7)
      raise exception 'Thêm việc này thì % em vượt 4 việc phải ghi', v_vuot using errcode = '23514';
    end if;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. Trigger DUYỆT thuoc (20 §3.3): th_truoc_them, th_truoc_sua. Duyệt MỘT lần; da_tung_duyet đông cứng.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.th_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then return new; end if;                                 -- L6 (seed/máy đi qua)
  new.created_by := v_me;
  if new.tu_tuan is null then new.tu_tuan := vn_week_start(); end if;
  new.trang_thai := 'chay'; new.da_tung_duyet := false;
  if new.chu_the = 'em' and v_me <> new.student_id then
    new.nguoi_nhap_ho := v_me; new.duyet := 'gui';                         -- nhập hộ: dấu vết, vẫn chờ duyệt
  elsif staff_can_manage_class(new.class_id) and new.chu_the in ('lop','nhom') and new.subject_id is null then
    new.duyet := 'duyet'; new.da_tung_duyet := true;                       -- GVCN tạo thước lớp/nhóm: hiệu lực ngay [H-07]
  else
    new.duyet := 'gui';                                                    -- em; GVBM thước môn chờ GVCN [H-08]
  end if;
  if new.duyet = 'duyet' then new.duyet_boi := v_me; new.duyet_at := now();
  else new.duyet_boi := null; new.duyet_at := null; end if;
  perform private.th_kiem_tran(new);                                       -- trần ≤4 hàng/em (§3.3b)
  return new;
end $$;

create or replace function private.th_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  -- L5/L11. 'chu_the_key' phải có: cột GENERATED stored đọc NULL trong NEW của BEFORE UPDATE (OLD có
  -- giá trị) → nếu không lược, to_jsonb(new) khác to_jsonb(old) ở khoá này ⇒ MỌI update bị coi là đổi
  -- nội dung. An toàn vì chu_the_key suy hoàn toàn từ chu_the/student_id/nhom_id/class_id (đã gác riêng).
  v_khong_noi_dung constant text[] := array['trang_thai','cho_bu','den_tuan','duyet','duyet_boi',
      'duyet_at','ly_do_tra_lai','da_tung_duyet','nguoi_nhap_ho','updated_at','class_id','chu_the_key'];
  v_doi boolean; v_ghi boolean; v_duyet boolean;
begin
  if v_me is null then return new; end if;
  new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;            -- ép về old NGAY ĐẦU (góp ý #15):
  new.da_tung_duyet := old.da_tung_duyet;                                  -- chỉ nhánh duyệt phía dưới được đổi
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của việc chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if (new.chu_the, new.student_id, new.nhom_id, new.subject_id)
     is distinct from (old.chu_the, old.student_id, old.nhom_id, old.subject_id) then
    raise exception 'Không đổi được chủ của việc — tạo việc mới' using errcode = '42501';
  end if;
  -- Khe hẹp hệ thống (GHI CHÚ TÍCH HỢP c): thls_sau_xoa / thls_truoc_sua trả cờ 'gui'→'duyet' khi
  -- em rút / GVCN xử dòng hạ chỉ tiêu. Nội dung KHÔNG đổi, chữ ký/da_tung_duyet giữ nguyên (đã ép
  -- về old ở trên). KHÔNG phải "em tự duyệt"; cờ do trigger anh em bật, không phải người ghi.
  if coalesce(current_setting('va.th_duyet_dong_bo', true), '') = '1'
     and old.duyet = 'gui' and new.duyet = 'duyet'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung) then
    return new;
  end if;
  -- Đổi tên qua yêu cầu đã duyệt: cờ phiên + ĐÚNG MỘT cột 'ten' đổi (điều kiện nội dung kèm cờ — L6).
  if coalesce(current_setting('va.doi_ten_qua_yeu_cau', true), '') = '1'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung || array['ten']) then
    return new;
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_thuoc(new.id);
  v_duyet := duyet_duoc_thuoc(new.id);
  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung việc của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    if old.da_tung_duyet then                                             -- đông cứng kể cả khi duyet='gui'
      raise exception 'Việc này thầy cô đã duyệt rồi. Muốn đổi chỉ tiêu thì đổi từ tuần sau; muốn đổi tên thì gửi yêu cầu cho thầy cô'
        using errcode = '42501';
    end if;
    if exists (select 1 from luot l where l.thuoc_id = new.id)
       and (new.cach_ghi, new.gop, new.chieu_dich, new.don_vi_id, new.pham_vi, new.ky_tuan, new.tu_tuan, new.nguong_moi_lan)
           is distinct from (old.cach_ghi, old.gop, old.chieu_dich, old.don_vi_id, old.pham_vi, old.ky_tuan, old.tu_tuan, old.nguong_moi_lan) then
      raise exception 'Đã có lượt ghi — kết thúc việc này và tạo việc mới' using errcode = '23514';
    end if;
    if old.duyet = 'tra_lai' then new.duyet := 'gui'; new.ly_do_tra_lai := null; end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  end if;
  if new.duyet is distinct from old.duyet and not (v_doi and new.duyet = 'gui') then
    if new.duyet = 'duyet' then
      if not v_duyet then raise exception 'Chỉ thầy cô chủ nhiệm mới duyệt được việc này' using errcode = '42501'; end if;
      new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null; new.da_tung_duyet := true;
      if coalesce(current_setting('va.th_duyet_dong_bo', true), '') <> '1' then   -- chặn vòng chéo (GHI CHÚ c)
        perform set_config('va.th_duyet_dong_bo', '1', true);
        update thuoc_lich_su set trang_thai = 'hieu_luc', duyet_boi = v_me, duyet_at = now()
          where thuoc_id = new.id and trang_thai = 'cho_duyet';
        perform set_config('va.th_duyet_dong_bo', '', true);
      end if;
    elsif new.duyet = 'tra_lai' then
      if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
      if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
        raise exception 'Trả lại thì phải ghi lý do' using errcode = '23514';
      end if;
      new.duyet_boi := null; new.duyet_at := null;
    elsif new.duyet = 'gui' then
      if not v_ghi then raise exception 'Chỉ chủ việc mới gửi duyệt được' using errcode = '42501'; end if;
    end if;
  end if;             -- không nhánh restore: đã ép về old ngay đầu, kể cả ca (v_doi ∧ duyet='gui')
  if new.den_tuan is distinct from old.den_tuan and new.den_tuan is not null and new.den_tuan < vn_week_start() then
    raise exception 'Kết thúc việc sớm nhất là hết tuần này' using errcode = '23514';
  end if;
  if new.trang_thai is distinct from old.trang_thai and not (v_ghi or v_duyet) then
    raise exception 'Không có quyền tạm dừng hay đóng việc này' using errcode = '42501';
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 7. Trigger thuoc_lich_su (20 §3.3): thls_truoc_them (la_ha + nullif chia-0), thls_truoc_sua, thls_sau_xoa.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.thls_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  t thuoc%rowtype;
  v_cu numeric;
  v_so_lan_ha int;
  v_moc_nam date := make_date(split_part(current_school_year(), '-', 1)::int, 7, 1);  -- 01/07 năm học [H-18]
begin
  select * into t from thuoc where id = new.thuoc_id;
  new.nguoi_doi := coalesce(v_me, new.nguoi_doi);
  if v_me is not null and new.tu_tuan < vn_week_start() + 7 then
    raise exception 'Chỉ tiêu mới chỉ có hiệu lực từ tuần sau' using errcode = '23514';
  end if;
  -- chỉ tiêu cũ = dòng 'hieu_luc' mới nhất TRƯỚC tu_tuan; không có → thuoc.chi_tieu_ky.
  select chi_tieu_ky into v_cu from thuoc_lich_su
    where thuoc_id = new.thuoc_id and trang_thai = 'hieu_luc' and tu_tuan < new.tu_tuan
    order by tu_tuan desc limit 1;
  if not found then v_cu := t.chi_tieu_ky; end if;
  -- la_ha = "dễ đi hơn": kiêng (nhieu_nhat) nới trần = mới > cũ; còn lại (làm cho đủ) hạ = mới < cũ.
  -- chi_tieu null (tạm dừng) hay cũ null → không tính hạ.
  if new.chi_tieu_ky is null or v_cu is null then new.la_ha := false;
  elsif t.chieu_dich = 'nhieu_nhat' then new.la_ha := new.chi_tieu_ky > v_cu;
  else new.la_ha := new.chi_tieu_ky < v_cu; end if;
  if v_me is null or duyet_duoc_thuoc(new.thuoc_id) then
    new.trang_thai := 'hieu_luc';                                          -- máy seed / chính người duyệt đổi
    if v_me is null then new.duyet_boi := null; new.duyet_at := null;
    else new.duyet_boi := v_me; new.duyet_at := now(); end if;
  else
    v_so_lan_ha := (select count(*) from thuoc_lich_su
                    where thuoc_id = new.thuoc_id and la_ha and trang_thai <> 'tu_choi'
                      and created_at >= v_moc_nam);
    -- Chia 0 (góp ý #19): nullif làm vế TỈ LỆ null khi chỉ tiêu cũ = 0 → vế ấy không kích (không đổ
    -- 22012); vế "đã hạ ≥ 1 lần" vẫn đếm — nới trần từ 0 vẫn bị bắt ở lần thứ hai.
    if new.la_ha
       and (abs(new.chi_tieu_ky - v_cu) / nullif(abs(v_cu), 0) > 0.30 or v_so_lan_ha >= 1) then
      new.trang_thai := 'cho_duyet'; new.duyet_boi := null; new.duyet_at := null;
      -- treo cờ trên thuoc; GIỮ da_tung_duyet + chữ ký cũ (nội dung vẫn đông cứng, chỉ chờ duyệt lại).
      if coalesce(current_setting('va.th_duyet_dong_bo', true), '') <> '1' then
        perform set_config('va.th_duyet_dong_bo', '1', true);
        update thuoc set duyet = 'gui' where id = new.thuoc_id and duyet = 'duyet';
        perform set_config('va.th_duyet_dong_bo', '', true);
      end if;
    else
      new.trang_thai := 'hieu_luc'; new.duyet_boi := null; new.duyet_at := null;   -- em đổi nhỏ, hiệu lực ngay
    end if;
  end if;
  return new;
end $$;

create or replace function private.thls_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then return new; end if;
  if private.doi_noi_dung(to_jsonb(old), to_jsonb(new), array['trang_thai','duyet_boi','duyet_at']) then
    raise exception 'Dòng thay đổi chỉ tiêu không sửa được — tạo dòng mới' using errcode = '42501';
  end if;
  if new.trang_thai is distinct from old.trang_thai then
    if old.trang_thai <> 'cho_duyet' or new.trang_thai not in ('hieu_luc','tu_choi') then
      raise exception 'Dòng chờ duyệt chỉ chuyển sang hiệu lực hoặc từ chối' using errcode = '42501';
    end if;
    if not duyet_duoc_thuoc(new.thuoc_id) then
      raise exception 'Chỉ thầy cô chủ nhiệm mới duyệt được thay đổi chỉ tiêu' using errcode = '42501';
    end if;
    new.duyet_boi := v_me; new.duyet_at := now();
    -- Hết dòng cho_duyet khác → trả thuoc.duyet về 'duyet'. Chặn vòng chéo bằng cờ (GHI CHÚ c).
    if coalesce(current_setting('va.th_duyet_dong_bo', true), '') <> '1'
       and not exists (select 1 from thuoc_lich_su x
                       where x.thuoc_id = new.thuoc_id and x.trang_thai = 'cho_duyet' and x.id <> new.id) then
      perform set_config('va.th_duyet_dong_bo', '1', true);
      update thuoc set duyet = 'duyet' where id = new.thuoc_id and duyet = 'gui';
      perform set_config('va.th_duyet_dong_bo', '', true);
    end if;
  end if;
  return new;
end $$;

create or replace function private.thls_sau_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Chủ rút dòng cho_duyet; không còn dòng cho_duyet nào khác và thuoc đã từng duyệt → trả 'duyet'.
  if old.trang_thai = 'cho_duyet'
     and coalesce(current_setting('va.th_duyet_dong_bo', true), '') <> '1'
     and not exists (select 1 from thuoc_lich_su x where x.thuoc_id = old.thuoc_id and x.trang_thai = 'cho_duyet') then
    perform set_config('va.th_duyet_dong_bo', '1', true);
    update thuoc set duyet = 'duyet' where id = old.thuoc_id and duyet = 'gui' and da_tung_duyet;
    perform set_config('va.th_duyet_dong_bo', '', true);
  end if;
  return old;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 8. Trigger DỮ LIỆU luot (10 §3.4) + chặn xoá thuoc có nghĩa (10 §3.5).
-- ─────────────────────────────────────────────────────────────────────────────────────
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
      new.nguoi_ghi := null;                          -- máy ghi từ PHIÊN thầy cô điểm danh (khe hẹp 0155)
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

create or replace function private.th_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null or (select auth_role()) = 'admin' then return old; end if;
  if exists (select 1 from luot l where l.thuoc_id = old.id) then
    raise exception 'Đã có lượt ghi — kết thúc việc này thay vì xoá' using errcode = '23503';
  end if;
  return old;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 9. Ép ẩn quyền EXECUTE các hàm private (chỉ trigger gọi, chạy bằng quyền chủ bảng) — L2.
-- ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function private.dem_viec_phai_ghi(uuid, uuid) from public, anon, authenticated;
revoke all on function private.th_kiem_tran(thuoc)   from public, anon, authenticated;
revoke all on function private.th_truoc_them()       from public, anon, authenticated;
revoke all on function private.th_truoc_sua()        from public, anon, authenticated;
revoke all on function private.thls_truoc_them()     from public, anon, authenticated;
revoke all on function private.thls_truoc_sua()      from public, anon, authenticated;
revoke all on function private.thls_sau_xoa()        from public, anon, authenticated;
revoke all on function private.luot_truoc_ghi()      from public, anon, authenticated;
revoke all on function private.th_truoc_xoa()        from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 10. Gắn trigger (idempotent: drop-if-exists + create).
-- ─────────────────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_th_truoc_them on thuoc;
create trigger trg_th_truoc_them before insert on thuoc for each row execute function private.th_truoc_them();
drop trigger if exists trg_th_truoc_sua on thuoc;
create trigger trg_th_truoc_sua before update on thuoc for each row execute function private.th_truoc_sua();
drop trigger if exists trg_touch_thuoc on thuoc;
create trigger trg_touch_thuoc before update on thuoc for each row execute function touch_updated_at();
drop trigger if exists trg_th_truoc_xoa on thuoc;
create trigger trg_th_truoc_xoa before delete on thuoc for each row execute function private.th_truoc_xoa();

drop trigger if exists trg_thls_truoc_them on thuoc_lich_su;
create trigger trg_thls_truoc_them before insert on thuoc_lich_su for each row execute function private.thls_truoc_them();
drop trigger if exists trg_thls_truoc_sua on thuoc_lich_su;
create trigger trg_thls_truoc_sua before update on thuoc_lich_su for each row execute function private.thls_truoc_sua();
drop trigger if exists trg_thls_sau_xoa on thuoc_lich_su;
create trigger trg_thls_sau_xoa after delete on thuoc_lich_su for each row execute function private.thls_sau_xoa();

drop trigger if exists trg_luot_truoc_ghi on luot;
create trigger trg_luot_truoc_ghi before insert or update on luot for each row execute function private.luot_truoc_ghi();

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 11. Policy (20 §2.8–2.10). Admin luôn rls_all_<bảng>. Mọi policy to authenticated.
--     LƯU Ý: bốn policy `luot` ở đây CHƯA có vế luot_bi_khoa (hàm cần pdr_ke_lai → 0165). 0165
--     `drop policy if exists` rồi tạo lại NGUYÊN VĂN + vế khoá; giữa 0164↔0165 chưa ai ghi lượt.
-- ─────────────────────────────────────────────────────────────────────────────────────
-- thuoc (§2.8)
drop policy if exists rls_select_thuoc on thuoc;
create policy rls_select_thuoc on thuoc for select to authenticated
  using (doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
         or (subject_id is not null and la_gvbm_mon(class_id, subject_id)));
-- INSERT tường minh, KHÔNG nhánh principal (chốt C23).
drop policy if exists rls_insert_thuoc on thuoc;
create policy rls_insert_thuoc on thuoc for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid()) and is_class_student(class_id))
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
    or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))));
drop policy if exists rls_update_thuoc on thuoc;
create policy rls_update_thuoc on thuoc for update to authenticated
  using (ghi_duoc_thuoc(id) or duyet_duoc_thuoc(id))
  with check (   -- trên CỘT DÒNG MỚI, không qua hàm nhận id (vá lỗ WITH CHECK đọc dòng cũ)
       (select auth_role()) = 'admin'
    or (chu_the = 'em' and (student_id = (select auth.uid())
                            or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
    or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))
    or staff_can_manage_class(class_id));
drop policy if exists rls_delete_thuoc on thuoc;
create policy rls_delete_thuoc on thuoc for delete to authenticated
  using (duyet <> 'duyet' and not da_tung_duyet and ghi_duoc_thuoc(id));
drop policy if exists rls_all_thuoc on thuoc;
create policy rls_all_thuoc on thuoc for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- thuoc_lich_su (§2.9)
drop policy if exists rls_select_thls on thuoc_lich_su;
create policy rls_select_thls on thuoc_lich_su for select to authenticated using (doc_duoc_thuoc(thuoc_id));
drop policy if exists rls_insert_thls on thuoc_lich_su;
create policy rls_insert_thls on thuoc_lich_su for insert to authenticated
  with check (nguoi_doi = (select auth.uid()) and ghi_duoc_thuoc(thuoc_id));
drop policy if exists rls_duyet_thls on thuoc_lich_su;
create policy rls_duyet_thls on thuoc_lich_su for update to authenticated
  using (duyet_duoc_thuoc(thuoc_id)) with check (duyet_duoc_thuoc(thuoc_id));
drop policy if exists rls_delete_thls on thuoc_lich_su;
create policy rls_delete_thls on thuoc_lich_su for delete to authenticated
  using (trang_thai = 'cho_duyet' and nguoi_doi = (select auth.uid()));
drop policy if exists rls_all_thls on thuoc_lich_su;
create policy rls_all_thls on thuoc_lich_su for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- luot (§2.10) — bản CỬA SỔ (chưa khoá chữ ký). 0165 đặt lại thêm luot_bi_khoa.
drop policy if exists rls_select_luot on luot;
create policy rls_select_luot on luot for select to authenticated
  using (student_id = (select auth.uid())
         or (student_id is null and doc_duoc_thuoc(thuoc_id))
         or (student_id is not null and (is_my_child(student_id)
             or staff_can_read_class(thuoc_class(thuoc_id)) or ghi_ho_duoc_luot(thuoc_id))));
-- EM tự ghi: cửa sổ 7 ngày (khoá chữ ký thêm ở 0165).
drop policy if exists rls_em_ghi_luot on luot;
create policy rls_em_ghi_luot on luot for insert to authenticated
  with check (student_id = (select auth.uid()) and nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and thuoc_nhan_luot(thuoc_id, student_id)
              and trong_cua_so_ghi(ngay));
-- THẦY CÔ ghi hộ / lượt cả đội: KHÔNG cửa sổ (để "quá 7 ngày nhờ thầy cô" có thật — C25).
drop policy if exists rls_thay_co_ghi_luot on luot;
create policy rls_thay_co_ghi_luot on luot for insert to authenticated
  with check (nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and ghi_ho_duoc_luot(thuoc_id)
              and thuoc_nhan_luot(thuoc_id, student_id));
drop policy if exists rls_update_luot on luot;
create policy rls_update_luot on luot for update to authenticated
  using (nguon = 'tay'
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)))
  with check (nguon = 'tay'
              and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));
drop policy if exists rls_delete_luot on luot;
create policy rls_delete_luot on luot for delete to authenticated
  using (nguon = 'tay'
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));
drop policy if exists rls_all_luot on luot;
create policy rls_all_luot on luot for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 12. Khối grant L2 cho helper public 0164 vừa tạo (20 §1.5 — cắt theo phần của tệp này).
-- ─────────────────────────────────────────────────────────────────────────────────────
do $$ declare f text; begin
  foreach f in array array[
    'thuoc_class(uuid)','doc_duoc_thuoc(uuid)','ghi_duoc_thuoc(uuid)','duyet_duoc_thuoc(uuid)',
    'ghi_ho_duoc_luot(uuid)','thuoc_nhan_luot(uuid,uuid)','trong_cua_so_ghi(date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

commit;
