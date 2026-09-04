-- KIỂM 0164 — THƯỚC (hai cột trạng thái + da_tung_duyet), thuoc_lich_su (la_ha), LƯỢT (cửa sổ).
--
--   npm run sql -- scripts/test-0164-thuoc-luot-cua-so.sql   (chạy SAU khi apply 0164)
--
-- Luật chỉ nằm trong giao diện thì không phải luật: bài này dựng cả đường THUẬN lẫn CHIỀU NGƯỢC
-- cho từng chốt của 0164, đóng vai bằng request.jwt.claims + role authenticated, chạy thẳng trên
-- production rồi ROLLBACK nên không để lại gì. "Chưa vá phải ĐỎ": CHỐT CHẶN raise ngay nếu thiếu bảng.
--
--   Phase A (vai postgres, RLS bỏ qua — cô lập CHECK + trigger dữ liệu luot).
--   Phase B (vai authenticated — RLS + trigger duyệt/trần/thls + policy cửa sổ lượt).
--
-- KHÔNG kiểm khoá-chữ-ký (luot_bi_khoa) — hàm đó ở 0165; policy `luot` của 0164 chỉ có vế CỬA SỔ.
-- Bám 60-KIEM §1.6 (CHECK+trần), §1.7 (duyệt một lần + da_tung_duyet + thls), §1.9 (cửa sổ lượt).

begin;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.thuoc') is null
     or to_regclass('public.thuoc_lich_su') is null
     or to_regclass('public.luot') is null
     or not exists (select 1 from pg_trigger where tgname='trg_th_truoc_them'  and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_thls_truoc_them' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_luot_truoc_ghi' and not tgisinternal)
     or to_regprocedure('public.thuoc_nhan_luot(uuid,uuid)') is null
     or to_regprocedure('public.trong_cua_so_ghi(date)') is null then
    raise exception 'CHUA VA 0164: thiếu bảng/trigger/hàm thước-lượt — chạy migration 0164 trước.';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;
grant all on kq to public;

-- Bối cảnh (id động): lớp Test + 4 học sinh đang học + GVCN + admin + một đơn vị.
create temporary table bc on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select array_agg(sid order by sid) from (
     select e.student_id sid from enrollments e join profiles p on p.id=e.student_id
     where e.class_id=t.lop and e.is_active and p.role='student' order by e.student_id limit 4) z) em,
  (select id from profiles where role='admin' limit 1)   admin,
  (select id from don_vi where lower(ma)='lan' limit 1)  dv
from t;
grant select on bc to public;

-- Tự chủ số đếm (0187): đóng tạm mọi thước đo còn chạy của lớp Test trong giao dịch — trần 4
-- thước/em từng làm bài này đỏ oan khi tài khoản test có sẵn thước thử tay (04/09).
do $$ declare r bc%rowtype; begin
  select * into r from bc;
  update thuoc set trang_thai = 'dong' where class_id = r.lop and trang_thai <> 'dong';
end $$;

create temporary table art (k text primary key, v uuid) on commit drop;
grant all on art to public;

do $$ declare v_lop uuid; v_em uuid[]; v_dv uuid; begin
  select lop, em, dv into v_lop, v_em, v_dv from bc;
  if v_lop is null then raise exception 'Không thấy lớp Test.'; end if;
  if v_em is null or array_length(v_em,1) < 4 then raise exception 'Lớp Test cần ≥4 học sinh đang học.'; end if;
  if v_dv is null then raise exception 'Thiếu đơn vị "lan" (chạy 0162 seed don_vi).'; end if;
end $$;

-- ═══════════════════ PHASE A — CHECK + trigger dữ liệu luot (vai postgres, RLS bỏ qua) ═══════
-- th_truoc_them return sớm khi uid null → CHECK bảng vẫn bắn; trần KHÔNG chạy (đúng — trần cần uid).

-- ── 1. CHECK constraint của thuoc ────────────────────────────────────────────────────────────
do $$
declare v_lop uuid; v_e3 uuid; v_dv uuid; w0 date := vn_week_start();
begin
  select lop, em[3], dv into v_lop, v_e3, v_dv from bc;

  -- (a) cham + moi_lan null → th_moi_lan_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, moi_lan, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X cham thiếu moi_lan', 'cham', null, v_dv, 5, w0);
    insert into kq values ('CHECK th_moi_lan_ck (cham+moi_lan null)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_moi_lan_ck (cham+moi_lan null)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_moi_lan_ck (cham+moi_lan null)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (b) dem_dat_nguong + nguong_moi_lan null → th_nguong_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, gop, nguong_moi_lan, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X dem thiếu nguong', 'dem_dat_nguong', null, v_dv, 5, w0);
    insert into kq values ('CHECK th_nguong_ck (dem+nguong null)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_nguong_ck (dem+nguong null)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_nguong_ck (dem+nguong null)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (c) ky_tuan = 3 → th_ky_tuan_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, ky_tuan, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X ky_tuan 3', 3, v_dv, 5, w0);
    insert into kq values ('CHECK th_ky_tuan_ck (ky_tuan=3)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_ky_tuan_ck (ky_tuan=3)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_ky_tuan_ck (ky_tuan=3)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (d) ca_doi + chu_the='em' → th_ca_doi_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, pham_vi, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X ca_doi cho em', 'ca_doi', v_dv, 5, w0);
    insert into kq values ('CHECK th_ca_doi_ck (ca_doi+em)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_ca_doi_ck (ca_doi+em)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_ca_doi_ck (ca_doi+em)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (e) khoá chủ thể sai: chu_the='em' kèm nhom_id → th_khoa_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, nhom_id, ten, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, gen_random_uuid(), 'X em kèm nhom', v_dv, 5, w0);
    insert into kq values ('CHECK th_khoa_ck (em+nhom_id)', 'văng', 'đi lọt', false);
  exception when others then insert into kq values ('CHECK th_khoa_ck (em+nhom_id)', 'văng', 'văng đúng', true); end;

  -- (f) dem_dat_nguong + nhieu_nhat → th_dem_kieng_ck (tổ hợp cấm)
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, gop, nguong_moi_lan, chieu_dich, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X dem+kieng', 'dem_dat_nguong', 1, 'nhieu_nhat', v_dv, 5, w0);
    insert into kq values ('CHECK th_dem_kieng_ck (dem+nhieu_nhat)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_dem_kieng_ck (dem+nhieu_nhat)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_dem_kieng_ck (dem+nhieu_nhat)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (g) tu_tuan KHÔNG phải thứ Hai → th_thu_hai_ck
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'X tu_tuan không thứ Hai', v_dv, 5, w0 + 1);
    insert into kq values ('CHECK th_thu_hai_ck (tu_tuan != T.Hai)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK th_thu_hai_ck (tu_tuan != T.Hai)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK th_thu_hai_ck (tu_tuan != T.Hai)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (h) ĐỐI CHỨNG: moi_nhat × nhieu_nhat → LỌT (tổ hợp hợp lệ; dien_so nên moi_lan được null).
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, gop, chieu_dich, moi_lan, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e3, 'Việc moi_nhat kiêng', 'dien_so', 'moi_nhat', 'nhieu_nhat', null, v_dv, 5, w0);
    insert into kq values ('ĐC moi_nhat × nhieu_nhat LỌT', 'lọt', 'lọt', true);
  exception when others then insert into kq values ('ĐC moi_nhat × nhieu_nhat LỌT', 'lọt', 'BỊ CHẶN: '||sqlerrm, false); end;
end $$;

-- ── 2. Thước mồi Ta (cham, it_nhat, all ngày) cho em[3] + trigger dữ liệu luot ────────────────
do $$
declare v_lop uuid; v_e3 uuid; v_dv uuid; w0 date := vn_week_start(); v_ta uuid;
begin
  select lop, em[3], dv into v_lop, v_e3, v_dv from bc;
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, gop, chieu_dich, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
  values ('em', v_lop, v_e3, 'Việc mồi luot', 'cham', 'tong', 'it_nhat', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0)
  returning id into v_ta;
  insert into art values ('ta', v_ta);

  -- (a) luot ngày TRƯỚC tu_tuan → luot_truoc_ghi 23514 (không áp dụng cho ngày)
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri) values (v_ta, v_e3, w0 - 1, 1);
    insert into kq values ('luot_truoc_ghi: ngày trước tu_tuan bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then insert into kq values ('luot_truoc_ghi: ngày trước tu_tuan bị chặn', '23514', 'chặn đúng (23514)', true);
           when others then insert into kq values ('luot_truoc_ghi: ngày trước tu_tuan bị chặn', '23514', 'chặn (khác): '||sqlerrm, true); end;

  -- (b) gia_tri = -1 → luot_gia_tri_ck
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri) values (v_ta, v_e3, w0, -1);
    insert into kq values ('CHECK luot_gia_tri_ck (gia_tri -1)', 'văng', 'đi lọt', false);
  exception when check_violation then insert into kq values ('CHECK luot_gia_tri_ck (gia_tri -1)', 'văng', 'văng đúng', true);
           when others then insert into kq values ('CHECK luot_gia_tri_ck (gia_tri -1)', 'văng', 'văng (khác): '||sqlerrm, true); end;

  -- (c) trùng (thuoc, chu_the_key, ngay, stt) → unique luot_ngay_uidx. stt 2 cùng ngày thì được.
  insert into luot (thuoc_id, student_id, ngay, stt, gia_tri) values (v_ta, v_e3, w0, 1, 3);
  begin
    insert into luot (thuoc_id, student_id, ngay, stt, gia_tri) values (v_ta, v_e3, w0, 2, 4);
    insert into kq values ('luot: stt 2 cùng ngày được', 'được', 'được', true);
  exception when others then insert into kq values ('luot: stt 2 cùng ngày được', 'được', 'BỊ CHẶN: '||sqlerrm, false); end;
  begin
    insert into luot (thuoc_id, student_id, ngay, stt, gia_tri) values (v_ta, v_e3, w0, 1, 9);
    insert into kq values ('luot: trùng (thuoc,em,ngày,stt) bị chặn', 'unique', 'đi lọt', false);
  exception when unique_violation then insert into kq values ('luot: trùng (thuoc,em,ngày,stt) bị chặn', 'unique', 'chặn đúng (unique)', true);
           when others then insert into kq values ('luot: trùng (thuoc,em,ngày,stt) bị chặn', 'unique', 'chặn (khác): '||sqlerrm, true); end;
end $$;

-- ═══════════════════ PHASE B — RLS + trigger duyệt/trần/thls + policy cửa sổ (authenticated) ══
select set_config('role', 'authenticated', true);   -- transaction-local tới lúc test anon reset

-- ── 3. em[1] tạo thước riêng T1 → chay/gui/da_tung_duyet=false; tự duyệt → 42501; ghi 'gui' → 1 ─
do $$
declare v_lop uuid; v_e1 uuid; v_dv uuid; w0 date := vn_week_start(); v_t1 uuid; r record; n int;
begin
  select lop, em[1], dv into v_lop, v_e1, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, gop, chieu_dich, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e1, 'Đọc 10 phút mỗi ngày', 'cham', 'tong', 'it_nhat', 1, '{1,2,3,4,5,6,7}', v_dv, 10, w0)
    returning id into v_t1;
    insert into art values ('t1', v_t1);
    select trang_thai, duyet, da_tung_duyet into r from thuoc where id = v_t1;
    insert into kq values ('em tạo thước → chay/gui/chưa duyệt', 'chay|gui|f',
       r.trang_thai||'|'||r.duyet||'|'||r.da_tung_duyet::text, r.trang_thai='chay' and r.duyet='gui' and not r.da_tung_duyet);
  exception when others then insert into kq values ('em tạo thước → chay/gui/chưa duyệt', 'chay|gui|f', 'LỖI: '||sqlerrm, false); end;

  -- NGƯỢC: em tự set duyet='duyet' → 42501
  begin
    update thuoc set duyet='duyet' where id = v_t1;
    insert into kq values ('em tự duyệt thước mình bị chặn', '42501', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('em tự duyệt thước mình bị chặn', '42501', 'chặn đúng (42501)', true);
           when others then insert into kq values ('em tự duyệt thước mình bị chặn', '42501', 'chặn (khác): '||sqlerrm, true); end;

  -- THUẬN: em ghi lượt HÔM NAY khi thước còn 'gui' → 1 (H-09)
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon)
    values (v_t1, v_e1, vn_today(), 1, v_e1, 'tay');
    select count(*) into n from luot where thuoc_id=v_t1 and student_id=v_e1 and ngay=vn_today();
    insert into kq values ('em ghi lượt khi thước gui (H-09)', '1', n::text, n=1);
  exception when others then insert into kq values ('em ghi lượt khi thước gui (H-09)', '1', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 4. GVCN duyệt T1 → duyet/da_tung_duyet=true; em sửa chi_tieu/chủ sau duyệt → 42501 ─────────
do $$
declare v_gvcn uuid; v_e1 uuid; v_e2 uuid; v_t1 uuid; r record;
begin
  select gvcn, em[1], em[2] into v_gvcn, v_e1, v_e2 from bc;
  select v into v_t1 from art where k='t1';

  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    update thuoc set duyet='duyet' where id = v_t1;
    select duyet, da_tung_duyet into r from thuoc where id = v_t1;
    insert into kq values ('GVCN duyệt thước em → duyet+da_tung_duyet', 'duyet|t',
       r.duyet||'|'||r.da_tung_duyet::text, r.duyet='duyet' and r.da_tung_duyet);
  exception when others then insert into kq values ('GVCN duyệt thước em → duyet+da_tung_duyet', 'duyet|t', 'LỖI: '||sqlerrm, false); end;

  -- NGƯỢC: em sửa chi_tieu_ky sau duyệt (da_tung_duyet) → 42501
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    update thuoc set chi_tieu_ky=99 where id = v_t1;
    insert into kq values ('em sửa nội dung sau duyệt (da_tung_duyet) bị chặn', '42501', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('em sửa nội dung sau duyệt (da_tung_duyet) bị chặn', '42501', 'chặn đúng (42501)', true);
           when others then insert into kq values ('em sửa nội dung sau duyệt (da_tung_duyet) bị chặn', '42501', 'chặn (khác): '||sqlerrm, true); end;

  -- NGƯỢC: em đổi student_id (chủ của việc) → 42501
  begin
    update thuoc set student_id=v_e2 where id = v_t1;
    insert into kq values ('em đổi chủ của việc bị chặn', '42501', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('em đổi chủ của việc bị chặn', '42501', 'chặn đúng (42501)', true);
           when others then insert into kq values ('em đổi chủ của việc bị chặn', '42501', 'chặn (khác): '||sqlerrm, true); end;
end $$;

-- ── 5. thls: tuần này → 23514; tuần sau hạ 10% → hieu_luc; hạ lần 2 → cho_duyet ∧ thuoc.duyet='gui' ─
do $$
declare v_e1 uuid; v_t1 uuid; w0 date := vn_week_start(); r text; d text;
begin
  select em[1] into v_e1 from bc;
  select v into v_t1 from art where k='t1';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);

  -- NGƯỢC: tu_tuan = tuần NÀY → 23514
  begin
    insert into thuoc_lich_su (thuoc_id, tu_tuan, chi_tieu_ky, nguoi_doi) values (v_t1, w0, 9, v_e1);
    insert into kq values ('thls tu_tuan tuần này bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then insert into kq values ('thls tu_tuan tuần này bị chặn', '23514', 'chặn đúng (23514)', true);
           when others then insert into kq values ('thls tu_tuan tuần này bị chặn', '23514', 'chặn (khác): '||sqlerrm, true); end;

  -- THUẬN: tuần sau, hạ 10% (10→9) → hieu_luc
  begin
    insert into thuoc_lich_su (thuoc_id, tu_tuan, chi_tieu_ky, nguoi_doi) values (v_t1, w0 + 7, 9, v_e1);
    select trang_thai into r from thuoc_lich_su where thuoc_id=v_t1 and tu_tuan=w0+7;
    insert into kq values ('thls hạ 10% lần 1 → hieu_luc', 'hieu_luc', r, r='hieu_luc');
  exception when others then insert into kq values ('thls hạ 10% lần 1 → hieu_luc', 'hieu_luc', 'LỖI: '||sqlerrm, false); end;

  -- THUẬN: hạ lần 2 (9→8) → cho_duyet ∧ thuoc.duyet='gui'
  begin
    insert into thuoc_lich_su (thuoc_id, tu_tuan, chi_tieu_ky, nguoi_doi) values (v_t1, w0 + 14, 8, v_e1);
    select trang_thai into r from thuoc_lich_su where thuoc_id=v_t1 and tu_tuan=w0+14;
    select duyet into d from thuoc where id=v_t1;
    insert into kq values ('thls hạ lần 2 → cho_duyet ∧ thuoc.duyet=gui', 'cho_duyet|gui', r||'|'||d, r='cho_duyet' and d='gui');
  exception when others then insert into kq values ('thls hạ lần 2 → cho_duyet ∧ thuoc.duyet=gui', 'cho_duyet|gui', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 6. em rút dòng cho_duyet → thuoc.duyet TRỞ VỀ 'duyet' (thls_sau_xoa; chặn vòng chéo) ────────
do $$
declare v_e1 uuid; v_t1 uuid; w0 date := vn_week_start(); d text;
begin
  select em[1] into v_e1 from bc;
  select v into v_t1 from art where k='t1';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    delete from thuoc_lich_su where thuoc_id=v_t1 and tu_tuan=w0+14 and trang_thai='cho_duyet';
    select duyet into d from thuoc where id=v_t1;
    insert into kq values ('em rút dòng cho_duyet → thuoc.duyet trở về duyet', 'duyet', d, d='duyet');
  exception when others then insert into kq values ('em rút dòng cho_duyet → thuoc.duyet trở về duyet', 'duyet', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 7. GVCN duyệt dòng cho_duyet → hieu_luc ∧ thuoc.duyet='duyet' (chặn vòng chéo) ──────────────
do $$
declare v_e1 uuid; v_gvcn uuid; v_t1 uuid; w0 date := vn_week_start(); r text; d text;
begin
  select em[1], gvcn into v_e1, v_gvcn from bc;
  select v into v_t1 from art where k='t1';
  -- em tạo lại một dòng hạ (→ cho_duyet vì đã hạ ≥1 lần)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  insert into thuoc_lich_su (thuoc_id, tu_tuan, chi_tieu_ky, nguoi_doi) values (v_t1, w0 + 21, 7, v_e1);
  -- GVCN duyệt dòng đó
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    update thuoc_lich_su set trang_thai='hieu_luc' where thuoc_id=v_t1 and tu_tuan=w0+21;
    select trang_thai into r from thuoc_lich_su where thuoc_id=v_t1 and tu_tuan=w0+21;
    select duyet into d from thuoc where id=v_t1;
    insert into kq values ('GVCN duyệt dòng hạ → hieu_luc ∧ thuoc.duyet=duyet', 'hieu_luc|duyet', r||'|'||d, r='hieu_luc' and d='duyet');
  exception when others then insert into kq values ('GVCN duyệt dòng hạ → hieu_luc ∧ thuoc.duyet=duyet', 'hieu_luc|duyet', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 8. GVCN tạo thước LỚP ca_doi → duyet='duyet' NGAY (C11/H-07); em ghi ca_doi → chặn, GVCN → 1 ─
do $$
declare v_lop uuid; v_gvcn uuid; v_e1 uuid; v_dv uuid; w0 date := vn_week_start(); v_tc uuid; d text; n int;
begin
  select lop, gvcn, em[1], dv into v_lop, v_gvcn, v_e1, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into thuoc (chu_the, class_id, ten, cach_ghi, gop, chieu_dich, pham_vi, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('lop', v_lop, 'Cả lớp xếp hàng', 'cham', 'tong', 'it_nhat', 'ca_doi', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0)
    returning id into v_tc;
    insert into art values ('tc', v_tc);
    select duyet into d from thuoc where id=v_tc;
    insert into kq values ('GVCN tạo thước lớp → duyet NGAY (C11)', 'duyet', d, d='duyet');
  exception when others then insert into kq values ('GVCN tạo thước lớp → duyet NGAY (C11)', 'duyet', 'LỖI: '||sqlerrm, false); end;

  -- NGƯỢC: em ghi ca_doi (student = mình) → chặn (thuoc_nhan_luot đòi student null cho ca_doi)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_tc, v_e1, vn_today(), 1, v_e1);
    insert into kq values ('em ghi lượt ca_doi (student mình) bị chặn', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('em ghi lượt ca_doi (student mình) bị chặn', 'chặn', 'chặn đúng (RLS)', true);
           when others then insert into kq values ('em ghi lượt ca_doi (student mình) bị chặn', 'chặn', 'chặn (khác): '||sqlerrm, true); end;

  -- THUẬN: GVCN ghi ca_doi (student null) → 1
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_tc, null, vn_today(), 1, v_gvcn);
    select count(*) into n from luot where thuoc_id=v_tc and student_id is null and ngay=vn_today();
    insert into kq values ('GVCN ghi lượt ca_doi (student null) → 1', '1', n::text, n=1);
  exception when others then insert into kq values ('GVCN ghi lượt ca_doi (student null) → 1', '1', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 9. Cửa sổ 7 ngày: T2 (tu_tuan 4 tuần trước) — hôm nay/−6 → 1; −7/+1 → chặn; gia_tri 0 → 1 ────
do $$
declare v_lop uuid; v_e1 uuid; v_dv uuid; v_t2 uuid; w date := vn_week_start(vn_today() - 28); n int;
begin
  select lop, em[1], dv into v_lop, v_e1, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, gop, chieu_dich, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
  values ('em', v_lop, v_e1, 'Việc cửa sổ', 'cham', 'tong', 'it_nhat', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w)
  returning id into v_t2;
  insert into art values ('t2', v_t2);

  begin insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today(), 2, v_e1);
    insert into kq values ('cửa sổ: em ghi HÔM NAY → 1', '1', '1', true);
  exception when others then insert into kq values ('cửa sổ: em ghi HÔM NAY → 1', '1', 'LỖI: '||sqlerrm, false); end;

  begin insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today() - 6, 2, v_e1);
    insert into kq values ('cửa sổ: em ghi −6 ngày → 1', '1', '1', true);
  exception when others then insert into kq values ('cửa sổ: em ghi −6 ngày → 1', '1', 'LỖI: '||sqlerrm, false); end;

  begin insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today() - 7, 2, v_e1);
    insert into kq values ('cửa sổ: em ghi −7 ngày bị chặn', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('cửa sổ: em ghi −7 ngày bị chặn', 'chặn', 'chặn đúng (RLS)', true);
           when others then insert into kq values ('cửa sổ: em ghi −7 ngày bị chặn', 'chặn', 'chặn (khác): '||sqlerrm, true); end;

  begin insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today() + 1, 2, v_e1);
    insert into kq values ('cửa sổ: em ghi +1 (mai) bị chặn', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('cửa sổ: em ghi +1 (mai) bị chặn', 'chặn', 'chặn đúng (RLS)', true);
           when others then insert into kq values ('cửa sổ: em ghi +1 (mai) bị chặn', 'chặn', 'chặn (khác): '||sqlerrm, true); end;

  begin insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today() - 1, 0, v_e1);
    select count(*) into n from luot where thuoc_id=v_t2 and ngay=vn_today()-1 and gia_tri=0;
    insert into kq values ('cửa sổ: gia_tri 0 là dòng thật → 1', '1', n::text, n=1);
  exception when others then insert into kq values ('cửa sổ: gia_tri 0 là dòng thật → 1', '1', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 10. GVCN ghi hộ ngày −20 (quá 7 ngày, lớp thường) → 1 (C25); em ghi thước riêng em[2] → chặn ─
do $$
declare v_lop uuid; v_gvcn uuid; v_e1 uuid; v_e2 uuid; v_dv uuid; v_t2 uuid; v_t4 uuid; w0 date := vn_week_start(); n int;
begin
  select lop, gvcn, em[1], em[2], dv into v_lop, v_gvcn, v_e1, v_e2, v_dv from bc;
  select v into v_t2 from art where k='t2';

  -- THUẬN: GVCN ghi hộ em[1] ngày −20 (T2 tu_tuan 4 tuần trước nên còn trong [tu_tuan, ∞))
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t2, v_e1, vn_today() - 20, 1, v_gvcn);
    select count(*) into n from luot where thuoc_id=v_t2 and student_id=v_e1 and ngay=vn_today()-20;
    insert into kq values ('GVCN ghi hộ ngày −20 (không cửa sổ) → 1 (C25)', '1', n::text, n=1);
  exception when others then insert into kq values ('GVCN ghi hộ ngày −20 (không cửa sổ) → 1 (C25)', '1', 'LỖI: '||sqlerrm, false); end;

  -- em[2] tạo thước riêng T4; em[1] ghi lượt vào thước của em[2] → chặn
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2::text)::text, true);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
  values ('em', v_lop, v_e2, 'Việc riêng em2', 'cham', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0)
  returning id into v_t4;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t4, v_e1, vn_today(), 1, v_e1);
    insert into kq values ('em ghi lượt vào thước của em khác bị chặn', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then insert into kq values ('em ghi lượt vào thước của em khác bị chặn', 'chặn', 'chặn đúng (RLS)', true);
           when others then insert into kq values ('em ghi lượt vào thước của em khác bị chặn', 'chặn', 'chặn (khác): '||sqlerrm, true); end;
end $$;

-- ── 11. ngay_ap_dung: ghi ngày KHÔNG chọn, cho_bu=false → 23514; cho_bu=true → 1 ────────────────
do $$
declare v_lop uuid; v_e1 uuid; v_dv uuid; v_t5 uuid; w0 date := vn_week_start();
        v_ad smallint[]; n int;
begin
  select lop, em[1], dv into v_lop, v_e1, v_dv from bc;
  v_ad := (select array_agg(d::smallint) from generate_series(1,7) d where d <> extract(isodow from vn_today())::int);
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, moi_lan, ngay_ap_dung, cho_bu, don_vi_id, chi_tieu_ky, tu_tuan)
  values ('em', v_lop, v_e1, 'Việc chọn ngày', 'cham', 1, v_ad, false, v_dv, 5, w0)
  returning id into v_t5;

  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t5, v_e1, vn_today(), 1, v_e1);
    insert into kq values ('ghi ngày ngoài ngay_ap_dung (cho_bu=false) bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then insert into kq values ('ghi ngày ngoài ngay_ap_dung (cho_bu=false) bị chặn', '23514', 'chặn đúng (23514)', true);
           when others then insert into kq values ('ghi ngày ngoài ngay_ap_dung (cho_bu=false) bị chặn', '23514', 'chặn (khác): '||sqlerrm, true); end;

  update thuoc set cho_bu = true where id = v_t5;   -- cho_bu ở whitelist → em bật được, không về gui
  begin
    insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (v_t5, v_e1, vn_today(), 1, v_e1);
    select count(*) into n from luot where thuoc_id=v_t5 and ngay=vn_today();
    insert into kq values ('bật cho_bu → ghi ngày đó được → 1', '1', n::text, n=1);
  exception when others then insert into kq values ('bật cho_bu → ghi ngày đó được → 1', '1', 'LỖI: '||sqlerrm, false); end;
end $$;

-- ── 12. Trần ≤4 việc/em: em[4] 4 việc riêng → việc thứ 5 chặn; thước lớp tung_em → "% em vượt" ────
do $$
declare v_lop uuid; v_gvcn uuid; v_e4 uuid; v_dv uuid; w0 date := vn_week_start(); i int;
begin
  select lop, gvcn, em[4], dv into v_lop, v_gvcn, v_e4, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e4::text)::text, true);
  for i in 1..4 loop
    insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e4, 'Việc trần '||i, 'cham', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0);
  end loop;
  insert into kq values ('trần: em[4] tạo 4 việc riêng được', '4 OK', '4 OK', true);
  begin
    insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e4, 'Việc trần 5', 'cham', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0);
    insert into kq values ('trần: việc riêng thứ 5 bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then insert into kq values ('trần: việc riêng thứ 5 bị chặn', '23514', 'chặn đúng (23514)', true);
           when others then insert into kq values ('trần: việc riêng thứ 5 bị chặn', '23514', 'chặn (khác): '||sqlerrm, true); end;

  -- GVCN thêm thước LỚP tung_em → em[4] đang 4 → vượt → chặn, nêu SỐ (không tên)
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into thuoc (chu_the, class_id, ten, cach_ghi, gop, chieu_dich, pham_vi, moi_lan, ngay_ap_dung, don_vi_id, chi_tieu_ky, tu_tuan)
    values ('lop', v_lop, 'Việc lớp tung_em', 'cham', 'tong', 'it_nhat', 'tung_em', 1, '{1,2,3,4,5,6,7}', v_dv, 5, w0);
    insert into kq values ('trần: thước lớp tung_em khi có em đủ 4 bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then insert into kq values ('trần: thước lớp tung_em khi có em đủ 4 bị chặn', '23514', 'chặn đúng (23514)', true);
           when others then insert into kq values ('trần: thước lớp tung_em khi có em đủ 4 bị chặn', '23514', 'chặn (khác): '||sqlerrm, true); end;
end $$;

-- ── 13. Xoá thước ĐÃ CÓ LƯỢT → 23503 (th_truoc_xoa) ────────────────────────────────────────────
do $$
declare v_e1 uuid; v_t2 uuid;
begin
  select em[1] into v_e1 from bc;
  select v into v_t2 from art where k='t2';   -- T2 đã có lượt (hôm nay, −6, −20…)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    delete from thuoc where id = v_t2;
    insert into kq values ('xoá thước đã có lượt bị chặn', '23503', 'đi lọt', false);
  exception when foreign_key_violation then insert into kq values ('xoá thước đã có lượt bị chặn', '23503', 'chặn đúng (23503)', true);
           when others then insert into kq values ('xoá thước đã có lượt bị chặn', '23503', 'chặn (khác): '||sqlerrm, true); end;
end $$;

-- ── 14. anon KHÔNG đọc được luot (RLS + revoke) ───────────────────────────────────────────────
reset role;                 -- về postgres (superuser) để đổi sang anon
set role anon;
do $$
declare n int;
begin
  begin
    select count(*) into n from luot;
    insert into kq values ('anon đọc luot bị chặn', 'chặn', 'đi lọt n='||n, false);
  exception when insufficient_privilege then insert into kq values ('anon đọc luot bị chặn', 'chặn', 'chặn đúng (RLS/grant)', true);
           when others then insert into kq values ('anon đọc luot bị chặn', 'chặn', 'chặn (khác): '||sqlerrm, true); end;
end $$;
reset role;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
