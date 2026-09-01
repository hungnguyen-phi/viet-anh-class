-- KIỂM 0165 — CAM KẾT, DÂY (noi), KHOÁ theo chữ ký PDR.  Chạy SAU khi apply 0162→0165.
--
--   npm run sql -- scripts/test-0165-cam-ket-noi-khoa.sql
--
-- Vì sao bài này kiểm ở tầng CSDL chứ không qua màn: mọi luật của 0165 sống trong ràng buộc,
-- trigger và policy — đúng chỗ mà giao diện không đi qua. Mọi phép đóng vai bằng
-- set_config('request.jwt.claims', ...) như các test khác; auth_role() đọc từ profiles nên đóng
-- vai đúng người thật (A=test1.hs, GVCN=tunhien01). Bài chạy trong MỘT giao dịch và ROLLBACK —
-- không để lại gì trên lớp Test.
--
-- Bao trùm (mỗi mục có CHIỀU THUẬN + CHIỀU NGƯỢC "thao tác sai phải bị chặn"):
--   A. cam_ket   — cột GENERATED tuan_ket_thuc/lac_muc_tieu; CHECK ck_cham chỉ trói cham_at (KHÔNG cham_boi)
--   B. trần 2/tuần đếm THEO TỪNG TUẦN (C28): A(1–2)+B(3–4)+C(1–4) LỌT; cam kết thứ 3 phủ một tuần đã đủ 2 → chặn
--   C. cam_ket_xac_nhan — vai SUY từ quan hệ (không tin cột gửi lên); người ngoài quan hệ bị chặn
--   D. noi — hai FK thật + con_loai/con_id GENERATED; unique gop_so; noi_hop_le (cấp thấp→cao,
--            số đo là nguồn duy nhất, cha đúng nguồn); máy chỉ tự nối 'chi_huong'
--   E. noi RLS (§2.16) — em tự nối 'chi_huong' lên mục tiêu lớp; 'gop_so' lên lớp bị chặn; KHÔNG sửa dây
--   F. pdr_ke_lai — FK ON DELETE RESTRICT; so_dat đòi so_hua; câu 2 chép về cam_ket HAI CHIỀU
--   G. Khoá chữ ký — ký biên bản kể lại cam kết → luot_bi_khoa=true → em không ghi được lượt tuần đó;
--      edit_requests(mo_tuan_da_ky) duyệt → luot_mo_khoa 48 giờ → mở lại → ghi được
--
-- "Chưa vá phải ĐỎ": chốt chặn đầu tệp raise ngay nếu 0165 chưa áp (bảng/hàm khoá chưa có).

begin;
set local search_path = public;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.cam_ket') is null or to_regclass('public.noi') is null
     or to_regclass('public.luot_mo_khoa') is null then
    raise exception 'CHUA VA 0165: thiếu bảng cam_ket/noi/luot_mo_khoa — chạy 0162→0165 trước.';
  end if;
  if to_regprocedure('public.luot_bi_khoa(uuid,date)') is null
     or to_regprocedure('public.goi_y_cam_ket(uuid)') is null then
    raise exception 'CHUA VA 0165: thiếu hàm luot_bi_khoa/goi_y_cam_ket.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_name='cam_ket' and column_name='tuan_ket_thuc') then
    raise exception 'CHUA VA 0165: cam_ket thiếu cột GENERATED tuan_ket_thuc.';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;
create temporary table ids (ten text primary key, id uuid) on commit drop;

-- Nhân vật + hằng số (lớp Test, người thật)
create temporary table v (k text primary key, val text) on commit drop;
insert into v values
  ('A','7f801b90-4de0-434e-ba24-be600a315fc9'),      -- test1.hs (học sinh)
  ('B','5b8a687d-e9bb-4e3b-ab51-0b19d462e4fb'),      -- agent1 (bạn cùng lớp, KHÔNG buddy)
  ('GVCN','005d401f-d100-4be4-864f-9c6c8fc14fca'),   -- tunhien01
  ('CLASS','ddefb0a7-eeaa-40e6-9e16-0fd4c65fc8bf'),
  ('CAMPUS','61453ebe-dd27-434c-8787-c78dd21da742'),
  ('W1','2026-08-17'),('W2','2026-08-24'),('W3','2026-08-31'),('W4','2026-09-07'),
  ('LOCKDAY','2026-08-26');
-- Lưu ý: 'hôm nay' của production = 2026-09-01 (vn_today). LOCKDAY 2026-08-26 nằm trong cửa sổ ghi
-- 7 ngày (today-6 = 08-26) — nên nếu ghi bị chặn thì DO khoá chữ ký chứ không phải do quá hạn.

-- Tiện đọc hằng
create or replace function pg_temp.a()      returns uuid language sql as $$ select val::uuid from v where k='A' $$;
create or replace function pg_temp.b()      returns uuid language sql as $$ select val::uuid from v where k='B' $$;
create or replace function pg_temp.gvcn()   returns uuid language sql as $$ select val::uuid from v where k='GVCN' $$;
create or replace function pg_temp.cls()    returns uuid language sql as $$ select val::uuid from v where k='CLASS' $$;
create or replace function pg_temp.camp()   returns uuid language sql as $$ select val::uuid from v where k='CAMPUS' $$;
create or replace function pg_temp.wk(p text) returns date language sql as $$ select val::date from v where k=p $$;
create or replace function pg_temp.lbl(d date) returns text language sql as $$
  select 'W'||to_char(d,'IW')||'-'||to_char(d,'IYYY') $$;

-- Vai "hệ thống" (uid null) để dựng cảnh không vướng trigger có yếu tố vai
create or replace function pg_temp.as_system() returns void language sql as $$
  select set_config('request.jwt.claims','',true) $$;
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u)::text, true) $$;

-- Các mục E/G chạy dưới role 'authenticated' (để RLS có hiệu lực) nhưng vẫn ghi kết quả vào bảng
-- tạm và đọc hằng — cấp quyền trên bảng tạm cho authenticated (chỉ trong phiên test, rollback).
grant select, insert, update, delete on kq, ids, v to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- DỰNG CẢNH (vai hệ thống, quyền postgres — trigger có yếu tố vai bỏ qua khi uid null)
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_system();
reset role;

-- một nhóm để có mục tiêu cấp 'nhom'
with x as (insert into nhom (class_id, ten, loai) values (pg_temp.cls(), 'Nhóm kiểm 0165', 'to') returning id)
insert into ids select 'NHOM', id from x;

-- MỤC TIÊU nền
with x as (insert into muc_tieu (cap, campus_id, class_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
   values ('lop', pg_temp.camp(), pg_temp.cls(), 'MT lớp nguồn thuoc', 'knowledge','toi','tang',
     10, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','thuoc','duyet')
   returning id) insert into ids select 'MT_LOP_THUOC', id from x;
with x as (insert into muc_tieu (cap, campus_id, class_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
   values ('lop', pg_temp.camp(), pg_temp.cls(), 'MT lớp nguồn thuoc 2', 'knowledge','toi','tang',
     10, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','thuoc','duyet')
   returning id) insert into ids select 'MT_LOP_THUOC2', id from x;
with x as (insert into muc_tieu (cap, campus_id, class_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
   values ('lop', pg_temp.camp(), pg_temp.cls(), 'MT lớp ghi tay', 'knowledge','toi','tang',
     10, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','ghi_tay','duyet')
   returning id) insert into ids select 'MT_GHI_TAY', id from x;
with x as (insert into muc_tieu (cap, campus_id, class_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, gop_con, trang_thai)
   values ('lop', pg_temp.camp(), pg_temp.cls(), 'MT lớp gộp con', 'knowledge','toi','tang',
     100, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','con','cong','duyet')
   returning id) insert into ids select 'MT_LOP_CON', id from x;
with x as (insert into muc_tieu (cap, campus_id, class_id, nhom_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, gop_con, trang_thai)
   values ('nhom', pg_temp.camp(), pg_temp.cls(), (select id from ids where ten='NHOM'),
     'MT nhóm gộp con', 'knowledge','toi','tang',
     100, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','con','cong','duyet')
   returning id) insert into ids select 'MT_NHOM_CON', id from x;
with x as (insert into muc_tieu (cap, campus_id, class_id, student_id, ten, linh_vuc, kieu_dich, chieu,
     y_so, chua_do_x, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
   values ('em', pg_temp.camp(), pg_temp.cls(), pg_temp.a(), 'MT của em A', 'knowledge','toi','tang',
     10, true, (select id from don_vi where lower(ma)='lan'), date '2026-08-03', date '2026-12-28','ghi_tay','duyet')
   returning id) insert into ids select 'MT_EM_A', id from x;

-- THƯỚC nền
with x as (insert into thuoc (chu_the, class_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, gop, tu_tuan,
     trang_thai, duyet, da_tung_duyet)
   values ('lop', pg_temp.cls(), 'Thước tổng', 'dien_so', (select id from don_vi where lower(ma)='lan'),
     3, 'tong', pg_temp.wk('W1'), 'chay','duyet',true)
   returning id) insert into ids select 'TH1', id from x;
with x as (insert into thuoc (chu_the, class_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, gop, tu_tuan,
     trang_thai, duyet, da_tung_duyet)
   values ('lop', pg_temp.cls(), 'Thước lấy số mới nhất', 'dien_so', (select id from don_vi where lower(ma)='lan'),
     8, 'moi_nhat', pg_temp.wk('W1'), 'chay','duyet',true)
   returning id) insert into ids select 'TH2', id from x;
with x as (insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, gop, tu_tuan,
     trang_thai, duyet, da_tung_duyet)
   values ('em', pg_temp.cls(), pg_temp.a(), 'Thước của em (khoá)', 'dien_so',
     (select id from don_vi where lower(ma)='lan'), 5, 'tong', pg_temp.wk('W2'), 'chay','duyet',true)
   returning id) insert into ids select 'TH_LOCK', id from x;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- A. cam_ket — cột GENERATED + CHECK ck_cham
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- A1 THUẬN: tuan_ket_thuc = tuan_bat_dau + (so_tuan-1)*7 ; lac_muc_tieu = (không thuoc, không muc_tieu)
-- (dùng em B cho mục A để KHÔNG cộng vào trần theo tuần của em A ở mục B)
with x as (insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
   values ('em', pg_temp.cls(), pg_temp.b(), pg_temp.wk('W1'), 3, 'Cam kết A1 kiểm cột sinh')
   returning id, tuan_ket_thuc, lac_muc_tieu)
insert into kq
select 'cam_ket.tuan_ket_thuc là cột sinh (W1 + 2 tuần = W3)', pg_temp.wk('W3')::text, x.tuan_ket_thuc::text,
       x.tuan_ket_thuc = pg_temp.wk('W3') from x;
insert into kq
select 'cam_ket.lac_muc_tieu sinh true khi không neo thuoc/mục tiêu', 'true', c.lac_muc_tieu::text, c.lac_muc_tieu
from cam_ket c where c.noi_dung = 'Cam kết A1 kiểm cột sinh';

-- A2: CHECK ck_cham — tắt trigger để chạm THẲNG ràng buộc
alter table cam_ket disable trigger trg_ck_truoc_them;
-- THUẬN: ket_qua + cham_at có, cham_boi NULL → LỌT (chốt C27: không trói cham_boi, FK set null)
do $$
declare v_ok boolean := true;
begin
  begin
    insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung,
      ket_qua, cham_at, cham_boi)
    values ('em', pg_temp.cls(), pg_temp.b(), pg_temp.wk('W1'), 1, 'A2 cham_boi null hợp lệ',
      'thang', now(), null);
  exception when others then v_ok := false;
  end;
  insert into kq values ('ck_cham cho phép cham_boi NULL khi đã chấm (FK set null)', 'lọt',
    case when v_ok then 'lọt' else 'BỊ CHẶN' end, v_ok);
end $$;
-- NGƯỢC: ket_qua có mà cham_at NULL → check_violation
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung, ket_qua, cham_at)
    values ('em', pg_temp.cls(), pg_temp.b(), pg_temp.wk('W1'), 1, 'A2 sai: chấm mà không có mốc thời gian',
      'thang', null);
  exception when check_violation then v_blocked := true;
  end;
  insert into kq values ('ck_cham chặn ket_qua có nhưng cham_at NULL', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
alter table cam_ket enable trigger trg_ck_truoc_them;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- B. Trần 2 cam kết đếm THEO TỪNG TUẦN (C28) — cần uid (trigger bỏ qua khi uid null)
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_user(pg_temp.a());   -- vẫn quyền postgres (RLS bỏ qua) — cô lập trigger trần
-- C_A: W1..W2 ; C_B: W3..W4 ; C_C: W1..W4 → mỗi tuần chỉ 1 cái đã có → C_C LỌT (A+B+C phủ nhau đúng luật)
insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
  values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W1'), 2, 'C_A tuần 1-2');
insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
  values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W3'), 2, 'C_B tuần 3-4');
do $$
declare v_ok boolean := true;
begin
  begin
    insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
      values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W1'), 4, 'C_C tuần 1-4');
  exception when others then v_ok := false;
  end;
  insert into kq values ('Trần/tuần: A(1-2)+B(3-4)+C(1-4) cùng lọt (mỗi tuần ≤2)', 'lọt',
    case when v_ok then 'lọt' else 'BỊ CHẶN SAI' end, v_ok);
end $$;
-- NGƯỢC: cam kết thứ 3 phủ W1 (đã có C_A và C_C = 2) → chặn
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
      values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W1'), 1, 'C_D tuần 1 (thứ 3)');
  exception when sqlstate '23514' then v_blocked := true;
  end;
  insert into kq values ('Trần/tuần chặn cam kết thứ 3 phủ tuần đã đủ 2', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- C. cam_ket_xac_nhan — vai SUY từ quan hệ (ckxn_dung_vai)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Dùng cam kết C_A của A
-- THUẬN: GVCN xác nhận, gửi vai='buddy' cố ý sai → trigger ép 'thay_co', nguoi_id = GVCN
select pg_temp.as_user(pg_temp.gvcn());
do $$
declare v_vai text; v_nguoi uuid; v_ck uuid;
begin
  select id into v_ck from cam_ket where noi_dung = 'C_A tuần 1-2';
  insert into cam_ket_xac_nhan (cam_ket_id, nguoi_id, vai)
    values (v_ck, pg_temp.a(), 'buddy')          -- nguoi_id sai (A) + vai sai (buddy) — cả hai phải bị ép
    returning vai, nguoi_id into v_vai, v_nguoi;
  insert into kq values ('ckxn: GVCN xác nhận → vai ép ''thay_co'', nguoi_id ép = GVCN', 'thay_co & GVCN',
    v_vai||' & '||(case when v_nguoi = pg_temp.gvcn() then 'GVCN' else 'khác' end),
    v_vai='thay_co' and v_nguoi = pg_temp.gvcn());
end $$;
-- NGƯỢC: B (bạn cùng lớp, KHÔNG buddy/không GV/không PH) xác nhận → 42501
select pg_temp.as_user(pg_temp.b());
do $$
declare v_blocked boolean := false; v_ck uuid;
begin
  select id into v_ck from cam_ket where noi_dung = 'C_A tuần 1-2';
  begin
    insert into cam_ket_xac_nhan (cam_ket_id, vai) values (v_ck, 'buddy');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  insert into kq values ('ckxn: người ngoài quan hệ bị chặn', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- D. noi — trigger noi_hop_le (đóng vai GVCN, quyền postgres để cô lập trigger khỏi RLS)
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_user(pg_temp.gvcn());
reset role;
-- D1 THUẬN gop_so thuoc→mục tiêu nguồn 'thuoc'; kiểm con_loai/con_id sinh đúng
do $$
declare v_loai text; v_conid uuid;
begin
  insert into noi (cha_id, con_thuoc_id, vai, he_so)
    values ((select id from ids where ten='MT_LOP_THUOC'), (select id from ids where ten='TH1'), 'gop_so', 1)
    returning con_loai, con_id into v_loai, v_conid;
  insert into kq values ('noi gop_so thuoc→MT(nguồn thuoc) lọt; con_loai/con_id sinh đúng',
    'thuoc & =TH1', v_loai||' & '||(case when v_conid=(select id from ids where ten='TH1') then '=TH1' else 'khác' end),
    v_loai='thuoc' and v_conid=(select id from ids where ten='TH1'));
end $$;
-- D2 THUẬN gop_so mục_tiêu(em)→mục_tiêu(lớp, nguồn 'con'): cấp thấp→cao
do $$
declare v_ok boolean := true; v_loai text;
begin
  begin
    insert into noi (cha_id, con_muc_tieu_id, vai)
      values ((select id from ids where ten='MT_LOP_CON'), (select id from ids where ten='MT_EM_A'), 'gop_so')
      returning con_loai into v_loai;
  exception when others then v_ok := false;
  end;
  insert into kq values ('noi gop_so mục tiêu em→lớp (cấp thấp lên cao) lọt; con_loai=muc_tieu', 'lọt & muc_tieu',
    case when v_ok then 'lọt & '||coalesce(v_loai,'?') else 'BỊ CHẶN' end, v_ok and v_loai='muc_tieu');
end $$;
-- D3 NGƯỢC gop_so mục_tiêu(lớp)→mục_tiêu(nhóm): cấp cao xuống thấp → chặn
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into noi (cha_id, con_muc_tieu_id, vai)
      values ((select id from ids where ten='MT_NHOM_CON'), (select id from ids where ten='MT_LOP_THUOC'), 'gop_so');
  exception when sqlstate '23514' then v_blocked := true;
  end;
  insert into kq values ('noi gop_so chặn cấp cao→thấp (lớp vào nhóm)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- D4 NGƯỢC gop_so thuoc→mục tiêu nguồn 'ghi_tay' (không cộng từ việc) → chặn
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into noi (cha_id, con_thuoc_id, vai)
      values ((select id from ids where ten='MT_GHI_TAY'), (select id from ids where ten='TH1'), 'gop_so');
  exception when sqlstate '23514' then v_blocked := true;
  end;
  insert into kq values ('noi gop_so chặn khi mục tiêu KHÔNG cộng số từ việc (ghi_tay)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- D5 NGƯỢC số đo (moi_nhat) không được đứng chung nguồn: thêm TH2(moi_nhat) vào cha đã có TH1 → chặn
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into noi (cha_id, con_thuoc_id, vai)
      values ((select id from ids where ten='MT_LOP_THUOC'), (select id from ids where ten='TH2'), 'gop_so');
  exception when sqlstate '23514' then v_blocked := true;
  end;
  insert into kq values ('noi: số đo (moi_nhat) phải là nguồn DUY NHẤT → chặn thêm bên cạnh', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- D6 NGƯỢC unique gop_so theo con: TH1 đã gop_so vào MT_LOP_THUOC; nối tiếp vào cha khác → 23505
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into noi (cha_id, con_thuoc_id, vai)
      values ((select id from ids where ten='MT_LOP_THUOC2'), (select id from ids where ten='TH1'), 'gop_so');
  exception when unique_violation then v_blocked := true;
  end;
  insert into kq values ('noi: một con chỉ gop_so vào MỘT cha (unique)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- D7 máy (cờ va.noi_tu_dong) chỉ tự nối 'chi_huong'
do $$
declare v_blocked boolean := false; v_ok boolean := true; v_tudong boolean;
begin
  perform set_config('va.noi_tu_dong','1',true);
  begin  -- gop_so bằng cờ máy → 42501
    insert into noi (cha_id, con_thuoc_id, vai)
      values ((select id from ids where ten='MT_LOP_THUOC2'), (select id from ids where ten='TH2'), 'gop_so');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  begin  -- chi_huong bằng cờ máy → lọt, noi_tu_dong ép true
    insert into noi (cha_id, con_muc_tieu_id, vai)
      values ((select id from ids where ten='MT_LOP_THUOC'), (select id from ids where ten='MT_EM_A'), 'chi_huong')
      returning noi_tu_dong into v_tudong;
  exception when others then v_ok := false;
  end;
  perform set_config('va.noi_tu_dong','',true);
  insert into kq values ('noi máy: gop_so bị chặn, chi_huong lọt (noi_tu_dong ép true)', 'chặn+lọt+true',
    (case when v_blocked then 'chặn' else 'LỌT' end)||'+'||(case when v_ok then 'lọt' else 'CHẶN' end)
      ||'+'||coalesce(v_tudong::text,'?'), v_blocked and v_ok and v_tudong);
end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- E. noi RLS (§2.16) — em tự nối 'chi_huong' lên mục tiêu lớp; 'gop_so' lên lớp bị chặn; KHÔNG sửa
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Gỡ dây máy vừa tạo để cha MT_LOP_THUOC không vướng (chi_huong không đụng gop_so, nhưng dọn cho sạch)
delete from noi where cha_id=(select id from ids where ten='MT_LOP_THUOC') and con_muc_tieu_id=(select id from ids where ten='MT_EM_A');
select pg_temp.as_user(pg_temp.a());
set local role authenticated;
-- E1 THUẬN: A tự nối 'chi_huong' mục tiêu của mình → mục tiêu LỚP
do $$
declare v_ok boolean := true; v_noi uuid;
begin
  begin
    insert into noi (cha_id, con_muc_tieu_id, vai)
      values ((select id from ids where ten='MT_LOP_THUOC'), (select id from ids where ten='MT_EM_A'), 'chi_huong')
      returning id into v_noi;
    insert into ids values ('NOI_CHIHUONG', v_noi);
  exception when others then v_ok := false;
  end;
  insert into kq values ('RLS noi: em tự nối chi_huong lên mục tiêu lớp', 'lọt',
    case when v_ok then 'lọt' else 'BỊ CHẶN' end, v_ok);
end $$;
-- E2 NGƯỢC: A nối 'gop_so' lên mục tiêu lớp (không được ghi cha) → RLS chặn (42501)
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into noi (cha_id, con_muc_tieu_id, vai)
      values ((select id from ids where ten='MT_LOP_CON'), (select id from ids where ten='MT_EM_A'), 'gop_so');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  insert into kq values ('RLS noi: em KHÔNG gop_so lên mục tiêu lớp', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- E3 NGƯỢC: KHÔNG có policy UPDATE cho noi → sửa dây = 0 dòng (dây gỡ rồi nối lại, không sửa tại chỗ)
do $$
declare v_n int;
begin
  update noi set he_so = 2 where id = (select id from ids where ten='NOI_CHIHUONG');
  get diagnostics v_n = row_count;
  insert into kq values ('RLS noi: KHÔNG sửa được dây (0 dòng update)', '0 dòng', v_n||' dòng', v_n = 0);
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- F. pdr_ke_lai — FK RESTRICT, so_dat đòi so_hua, câu 2 chép cam_ket HAI CHIỀU
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_system();
reset role;
-- cam kết C_PKL (không hứa số) + biên bản chưa ký
with x as (insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
   values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W2'), 1, 'C_PKL kể lại') returning id)
insert into ids select 'C_PKL', id from x;
with x as (insert into pdr_meetings (class_id, student_id, type, week_label)
   values (pg_temp.cls(), pg_temp.a(), 'buddy', pg_temp.lbl(pg_temp.wk('W3'))) returning id)
insert into ids select 'PDR_PKL', id from x;
-- F1 NGƯỢC: so_dat khi cam kết không hứa số → 23514
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into pdr_ke_lai (pdr_meeting_id, cam_ket_id, ket_qua, so_dat)
      values ((select id from ids where ten='PDR_PKL'), (select id from ids where ten='C_PKL'), 'thang', 5);
  exception when sqlstate '23514' then v_blocked := true;
  end;
  insert into kq values ('pdr_ke_lai: so_dat đòi cam_ket.so_hua (không hứa số → chặn)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- F2 THUẬN: kể lại ket_qua='thang' → chép về cam_ket (chiều xuôi)
insert into pdr_ke_lai (pdr_meeting_id, cam_ket_id, ket_qua)
  values ((select id from ids where ten='PDR_PKL'), (select id from ids where ten='C_PKL'), 'thang');
insert into kq
select 'pdr_ke_lai chép ket_qua sang cam_ket; cham_boi = em (chiều xuôi)', 'thang & A',
       coalesce(c.ket_qua,'—')||' & '||(case when c.cham_boi=pg_temp.a() then 'A' else 'khác' end),
       c.ket_qua='thang' and c.cham_boi=pg_temp.a()
from cam_ket c where c.id=(select id from ids where ten='C_PKL');
-- F3 THUẬN chiều ngược: đổi câu 2 về "chưa biết" (null) trước khi ký → xoá bản chép ở cam_ket
update pdr_ke_lai set ket_qua = null
  where pdr_meeting_id=(select id from ids where ten='PDR_PKL') and cam_ket_id=(select id from ids where ten='C_PKL');
insert into kq
select 'pdr_ke_lai đổi về null → cam_ket bỏ chấm (chiều ngược)', 'null & null',
       coalesce(c.ket_qua,'null')||' & '||coalesce(c.cham_at::text,'null'),
       c.ket_qua is null and c.cham_at is null
from cam_ket c where c.id=(select id from ids where ten='C_PKL');
-- F4 NGƯỢC: xoá cam kết đã có dòng kể lại → FK ON DELETE RESTRICT chặn (23503)
do $$
declare v_blocked boolean := false;
begin
  begin
    delete from cam_ket where id=(select id from ids where ten='C_PKL');
  exception when foreign_key_violation then v_blocked := true;
  end;
  insert into kq values ('cam_ket đã kể lại: FK RESTRICT chặn xoá', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- G. Khoá theo chữ ký PDR — luot_bi_khoa + edit_requests(mo_tuan_da_ky) mở lại
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_system();
reset role;
-- cam kết C_LOCK neo thước TH_LOCK, tuần W2 (phủ LOCKDAY 08-26); biên bản kể lại + KÝ
with x as (insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung, thuoc_id)
   values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W2'), 1, 'C_LOCK tuần khoá',
     (select id from ids where ten='TH_LOCK')) returning id)
insert into ids select 'C_LOCK', id from x;
with x as (insert into pdr_meetings (class_id, student_id, type, week_label)
   values (pg_temp.cls(), pg_temp.a(), 'buddy', pg_temp.lbl(pg_temp.wk('W4'))) returning id)   -- tuần khác PDR_PKL (unique)
insert into ids select 'PDR_LOCK', id from x;
insert into pdr_ke_lai (pdr_meeting_id, cam_ket_id, ket_qua)
  values ((select id from ids where ten='PDR_LOCK'), (select id from ids where ten='C_LOCK'), 'thang');
-- A tự ký biên bản của mình (chữ ký hợp lệ: p_by = student)
select pg_temp.as_user(pg_temp.a());
update pdr_meetings set acknowledged_by = pg_temp.a(), acknowledged_at = now()
  where id = (select id from ids where ten='PDR_LOCK');
-- G1 THUẬN: sau ký, luot_bi_khoa(A, LOCKDAY) = true
insert into kq
select 'Ký biên bản kể lại → luot_bi_khoa(A, ngày trong tuần đã kể) = true', 'true',
       luot_bi_khoa(pg_temp.a(), pg_temp.wk('LOCKDAY'))::text,
       luot_bi_khoa(pg_temp.a(), pg_temp.wk('LOCKDAY'));
-- G2 NGƯỢC: A ghi lượt vào ngày bị khoá → RLS chặn (42501)
set local role authenticated;
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon)
      values ((select id from ids where ten='TH_LOCK'), pg_temp.a(), pg_temp.wk('LOCKDAY'), 1, pg_temp.a(), 'tay');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  insert into kq values ('Tuần đã khoá: em KHÔNG ghi được lượt (RLS chặn)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- A gửi yêu cầu mở tuần
do $$
declare v_er uuid;
begin
  insert into edit_requests (class_id, student_id, requester_id, kind, tuan)
    values (pg_temp.cls(), pg_temp.a(), pg_temp.a(), 'mo_tuan_da_ky', pg_temp.wk('W2'))
    returning id into v_er;
  insert into ids values ('ER', v_er);
end $$;
reset role;
-- GVCN duyệt → er_sau_duyet sinh luot_mo_khoa 48 giờ
select pg_temp.as_user(pg_temp.gvcn());
update edit_requests set status='approved' where id = (select id from ids where ten='ER');
-- G3 THUẬN: có luot_mo_khoa còn hạn → luot_bi_khoa(A, LOCKDAY) = false
select pg_temp.as_user(pg_temp.a());
insert into kq
select 'Duyệt mo_tuan_da_ky → luot_mo_khoa 48h → luot_bi_khoa = false', 'false',
       luot_bi_khoa(pg_temp.a(), pg_temp.wk('LOCKDAY'))::text,
       not luot_bi_khoa(pg_temp.a(), pg_temp.wk('LOCKDAY'));
-- G4 THUẬN: mở khoá rồi, A ghi được lượt
set local role authenticated;
do $$
declare v_ok boolean := true;
begin
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon)
      values ((select id from ids where ten='TH_LOCK'), pg_temp.a(), pg_temp.wk('LOCKDAY'), 1, pg_temp.a(), 'tay');
  exception when others then v_ok := false;
  end;
  insert into kq values ('Sau khi mở tuần: em ghi được lượt', 'lọt',
    case when v_ok then 'lọt' else 'BỊ CHẶN' end, v_ok);
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- H. ck_truoc_sua — nội dung đông cứng SAU CHẤM và SAU KỂ LẠI
-- ════════════════════════════════════════════════════════════════════════════════════════════
select pg_temp.as_system();
reset role;
-- cam kết H_CK của A, tuần W2 (tuan_ket_thuc 08-24, +4 = 08-28 ≤ hôm nay 09-01 → chấm được);
-- chèn vai hệ thống để không vướng trần theo tuần (A đã đủ nhiều cam kết tuần W2)
with x as (insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung)
   values ('em', pg_temp.cls(), pg_temp.a(), pg_temp.wk('W2'), 1, 'H_CK cam kết để chấm') returning id)
insert into ids select 'H_CK', id from x;
select pg_temp.as_user(pg_temp.a());
-- A tự chấm Thắng (đã qua thứ Sáu tuần cuối)
update cam_ket set ket_qua = 'thang' where id = (select id from ids where ten='H_CK');
insert into kq
select 'ck_truoc_sua: em tự chấm được sau thứ Sáu tuần cuối', 'thang & có cham_at',
       coalesce(c.ket_qua,'—')||' & '||(case when c.cham_at is not null then 'có' else 'không' end),
       c.ket_qua='thang' and c.cham_at is not null
from cam_ket c where c.id=(select id from ids where ten='H_CK');
-- H1 NGƯỢC: sửa NỘI DUNG cam kết ĐÃ CHẤM → chặn (42501)
do $$
declare v_blocked boolean := false;
begin
  begin
    update cam_ket set noi_dung = 'H_CK sửa sau chấm' where id = (select id from ids where ten='H_CK');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  insert into kq values ('ck_truoc_sua chặn sửa nội dung SAU CHẤM', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;
-- H2 NGƯỢC: sửa nội dung cam kết ĐÃ KỂ LẠI trong biên bản ĐÃ KÝ (C_LOCK) → chặn (42501)
do $$
declare v_blocked boolean := false;
begin
  begin
    update cam_ket set noi_dung = 'C_LOCK sửa sau kể lại' where id = (select id from ids where ten='C_LOCK');
  exception when sqlstate '42501' then v_blocked := true;
  end;
  insert into kq values ('ck_truoc_sua chặn sửa nội dung SAU KỂ LẠI (biên bản đã ký)', 'bị chặn',
    case when v_blocked then 'bị chặn' else 'LỌT' end, v_blocked);
end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- TỔNG KẾT
-- ════════════════════════════════════════════════════════════════════════════════════════════
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi '||mong_doi||', thực tế '||thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat)||'/'||count(*)||' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

do $$
declare v_fail int;
begin
  select count(*) into v_fail from kq where not dat;
  if v_fail > 0 then
    raise exception 'TEST-0165 HỎNG: % bước không đạt (xem bảng trên)', v_fail;
  end if;
  raise notice 'TEST-0165: tất cả % bước ĐẠT', (select count(*) from kq);
end $$;

rollback;
