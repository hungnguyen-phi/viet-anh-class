-- KIỂM 0193 — nguồn số "đếm số em đạt" (nguon_so = 'dem_em'). Một file, hai chiều.
--
--   npm run sql -- scripts/test-0193-dem-em.sql   (chạy SAU khi apply 0193)
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0193 thì đỏ NGAY ở
-- ca ① (mt_nguon_ck cũ không nhận 'dem_em' → 23514).
--
-- Ca kiểm:
--   ① tạo được mục tiêu LỚP nguon_so='dem_em' (đơn vị %, 0 → 95).
--   ② 3 mục tiêu em (3 ĐƠN VỊ KHÁC NHAU: lần / buổi / %) nối chỉ hướng vào → tổng 3, đạt 0 → 0%.
--   ③ em1 ghi số tới đích → 1/3 → 33.3 (làm tròn 1 chữ số), pct = 33.3/95, nguon 'may_dem_em'.
--   ④ em2 tới đích → 66.7; em3 ĐÓNG với ly_do_dong='dat' → 3/3 → 100, dat = true, trang_thai_do 'dat'.
--   ⑤ mục tiêu em chưa duyệt (gui) KHÔNG nằm trong mẫu số; muc_tieu_v cho cùng số + tu_so/mau_so.
--   ⑥ cap 'em' KHÔNG được dem_em (23514); kieu_dich khác 'toi' KHÔNG được dem_em (23514).
--   ⑦ GVCN kéo dây gop_so vào cha dem_em → 23514 với câu nói rõ; dây chi_huong thì được.
--   ⑧ noi_wig_len_tren: mục tiêu cá nhân của GVCN cùng đơn vị '%' nối vào cha dem_em → cha VẪN dem_em,
--     không sinh dây gop_so, và em ấy được đếm.
--   ⑨ đơn vị 'quyen' (quyển) có trong don_vi.
--   ⑩ mục tiêu TRƯỜNG dem_em đếm xuyên qua mục tiêu lớp (em → lớp → trường): 3/5 → 60.
--   ⑪ trang_wig (RPC màn /wig) trả tu_so/mau_so cho mục tiêu lớp dem_em (0189 từng bỏ hai cột này).

begin;

create temporary table bc193 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1),
     em as (select e.student_id, row_number() over (order by e.student_id) rn
            from t join enrollments e on e.class_id = t.lop and e.is_active
            join profiles p on p.id = e.student_id and p.role = 'student')
select t.lop, t.cs, t.gvcn,
  (select student_id from em where rn = 1) em1,
  (select student_id from em where rn = 2) em2,
  (select student_id from em where rn = 3) em3,
  (select student_id from em where rn = 4) em4,
  (select id from don_vi where ma = 'lan' limit 1)       dv_lan,
  (select id from don_vi where ma = 'buoi' limit 1)      dv_buoi,
  (select id from don_vi where ma = 'phan_tram' limit 1) dv_pt,
  vn_today()                                             bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 5, 30) kt
from t;
grant select on bc193 to public;

do $$ declare r bc193%rowtype; begin
  select * into r from bc193;
  if r.lop is null or r.gvcn is null or r.em4 is null or r.dv_lan is null or r.dv_buoi is null or r.dv_pt is null then
    raise exception 'Thiếu lớp Test / GVCN / 4 học sinh / đơn vị lan-buoi-phan_tram — không chạy được bài kiểm.';
  end if;
end $$;

create temporary table id193 (k text primary key, v uuid) on commit drop;

do $$
declare r bc193%rowtype; v_wig uuid; v_e1 uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid; h record; v record;
begin
  select * into r from bc193;

  -- ① Mục tiêu LỚP đếm số em đạt. CHƯA áp 0193 → mt_nguon_ck cũ chặn ngay đây.
  begin
    insert into muc_tieu (cap, class_id, campus_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                          don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('lop', r.lop, r.cs, 'ZZTEST-0193 95% em đạt mục tiêu', 'knowledge', 'do_luong', 'toi', 'tang',
            r.dv_pt, 0, 95, r.bd, r.kt, 'dem_em', 'duyet')
    returning id into v_wig;
  exception when check_violation then
    raise exception 'CHUA VA 0193: muc_tieu chưa nhận nguon_so=dem_em (%)', sqlerrm;
  end;
  insert into id193 values ('wig', v_wig);
  raise notice '① OK — tạo được mục tiêu lớp dem_em';

  -- ② Ba mục tiêu em, ba đơn vị khác nhau, nối chỉ hướng vào.
  insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.lop, r.cs, r.em1, 'ZZTEST-0193 em1 làm 10 lần', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_lan, 0, 10, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v_e1;
  insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.lop, r.cs, r.em2, 'ZZTEST-0193 em2 đi 5 buổi', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_buoi, 0, 5, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v_e2;
  insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.lop, r.cs, r.em3, 'ZZTEST-0193 em3 tới 80%', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_pt, 0, 80, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v_e3;
  -- em4: mới GỬI, chưa duyệt → không được đếm.
  insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.lop, r.cs, r.em4, 'ZZTEST-0193 em4 chưa duyệt', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_lan, 0, 3, r.bd, r.kt, 'ghi_tay', 'gui') returning id into v_e4;
  insert into id193 values ('e1', v_e1), ('e2', v_e2), ('e3', v_e3), ('e4', v_e4);
  insert into noi (cha_id, con_muc_tieu_id, vai) values (v_wig, v_e1, 'chi_huong'), (v_wig, v_e2, 'chi_huong'),
                                                        (v_wig, v_e3, 'chi_huong'), (v_wig, v_e4, 'chi_huong');
  select * into h from private.so_hien_tai(v_wig);
  if h.so is distinct from 0 or h.mau_so is distinct from 3 or h.tu_so is distinct from 0 then
    raise exception '② HỎNG: mong 0/3 → 0, ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  raise notice '② OK — 3 em (3 đơn vị khác nhau) nối vào, chưa ai đạt → 0/3 → 0%%';

  -- ③ em1 ghi số tới đích.
  insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi) values (v_e1, r.em1, r.bd, 10, 'tay', r.em1);
  select * into h from private.so_hien_tai(v_wig);
  if h.so is distinct from 33.3 or h.tu_so is distinct from 1 or h.mau_so is distinct from 3 then
    raise exception '③ HỎNG: mong 1/3 → 33.3, ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  if h.nguon is distinct from 'may_dem_em' then raise exception '③ HỎNG: nguon mong may_dem_em, ra %', h.nguon; end if;
  if round(h.pct, 3) is distinct from round(33.3 / 95, 3) then raise exception '③ HỎNG: pct mong %, ra %', round(33.3 / 95, 3), h.pct; end if;
  if h.dat is distinct from false then raise exception '③ HỎNG: dat mong false, ra %', h.dat; end if;
  raise notice '③ OK — em1 tới đích → 1/3 → 33.3, pct %, nguon may_dem_em', round(h.pct, 3);

  -- ④ em2 tới đích, em3 đóng-đạt.
  insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi) values (v_e2, r.em2, r.bd, 5, 'tay', r.em2);
  select * into h from private.so_hien_tai(v_wig);
  if h.so is distinct from 66.7 then raise exception '④ HỎNG: mong 66.7, ra %', h.so; end if;
  update muc_tieu set trang_thai = 'dong', ly_do_dong = 'dat', dong_at = now() where id = v_e3;
  select * into h from private.so_hien_tai(v_wig);
  if h.so is distinct from 100 or h.tu_so is distinct from 3 or h.mau_so is distinct from 3 then
    raise exception '④ HỎNG: mong 3/3 → 100, ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  if h.dat is distinct from true or h.trang_thai is distinct from 'dat' then
    raise exception '④ HỎNG: mong dat=true/trang_thai=dat, ra %/%', h.dat, h.trang_thai;
  end if;
  raise notice '④ OK — em2 tới đích → 66.7; em3 đóng-đạt → 3/3 → 100, đạt';

  -- ⑤ em4 (gui) không trong mẫu số; muc_tieu_v cho cùng số.
  update muc_tieu set trang_thai = 'duyet' where id = v_e4;
  select * into h from private.so_hien_tai(v_wig);
  if h.mau_so is distinct from 4 or h.so is distinct from 75 then
    raise exception '⑤ HỎNG: duyệt em4 xong mong 3/4 → 75, ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  select so, pct, tu_so, mau_so, nguon_so into v from muc_tieu_v where id = v_wig;
  if v.so is distinct from 75 or v.tu_so is distinct from 3 or v.mau_so is distinct from 4 or v.nguon_so is distinct from 'dem_em' then
    raise exception '⑤ HỎNG: muc_tieu_v ra so=% tu=% mau=% nguon=%', v.so, v.tu_so, v.mau_so, v.nguon_so;
  end if;
  raise notice '⑤ OK — em chưa duyệt không đếm; duyệt xong vào mẫu số (3/4 → 75); muc_tieu_v khớp';

  -- ⑥ Chặn: cap em không được dem_em; kieu_dich khác toi không được dem_em.
  begin
    insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                          don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('em', r.lop, r.cs, r.em1, 'ZZTEST-0193 em không được dem_em', 'knowledge', 'do_luong', 'toi', 'tang',
            r.dv_pt, 0, 95, r.bd, r.kt, 'dem_em', 'duyet');
    raise exception '⑥ HỎNG: cap em mà vẫn nhận nguon_so=dem_em';
  exception when check_violation then null;
  end;
  begin
    insert into muc_tieu (cap, class_id, campus_id, ten, linh_vuc, loai_moc, kieu_dich, chieu, ky,
                          don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('lop', r.lop, r.cs, 'ZZTEST-0193 giu không được dem_em', 'knowledge', 'do_luong', 'giu', 'giu', 'tuan',
            r.dv_pt, 95, 95, r.bd, r.kt, 'dem_em', 'duyet');
    raise exception '⑥ HỎNG: kieu_dich=giu mà vẫn nhận nguon_so=dem_em';
  exception when check_violation then null;
  end;
  raise notice '⑥ OK — cap em / kieu_dich khác toi đều bị chặn (23514)';
end $$;

-- ⑦ GVCN (đăng nhập thật qua jwt) kéo dây gop_so vào cha dem_em → chặn; chi_huong → được.
do $$
declare r bc193%rowtype; v_wig uuid; v_gv uuid; v_msg text; n int;
begin
  select * into r from bc193;
  select v into v_wig from id193 where k = 'wig';
  -- Mục tiêu CÁ NHÂN của GVCN (cap em, student_id = GVCN), đơn vị '%', đích 0→90 — dùng cho ⑦ và ⑧.
  insert into muc_tieu (cap, class_id, campus_id, student_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.lop, r.cs, r.gvcn, 'ZZTEST-0193 mục tiêu cá nhân GVCN %', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_pt, 0, 90, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v_gv;
  insert into id193 values ('gv', v_gv);

  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (v_wig, v_gv, 'gop_so', r.gvcn);
    raise exception '⑦ HỎNG: cha dem_em vẫn nhận dây gop_so';
  exception when check_violation then
    v_msg := sqlerrm;
  end;
  if v_msg not like '%đếm số em đạt%' then raise exception '⑦ HỎNG: câu báo không nói rõ vì sao: %', v_msg; end if;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice '⑦ OK — gop_so vào cha dem_em bị chặn: "%"', v_msg;

  -- ⑧ noi_wig_len_tren (GVCN, cùng đơn vị %) → cha vẫn dem_em, không có gop_so, GVCN được đếm.
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.noi_wig_len_tren(v_gv, v_wig);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  if (select nguon_so from muc_tieu where id = v_wig) is distinct from 'dem_em' then
    raise exception '⑧ HỎNG: noi_wig_len_tren đổi cha dem_em sang %', (select nguon_so from muc_tieu where id = v_wig);
  end if;
  select count(*) into n from noi where cha_id = v_wig and vai = 'gop_so';
  if n <> 0 then raise exception '⑧ HỎNG: sinh % dây gop_so vào cha dem_em', n; end if;
  select count(*) into n from noi where cha_id = v_wig and con_muc_tieu_id = v_gv and vai = 'chi_huong';
  if n <> 1 then raise exception '⑧ HỎNG: không có dây chi_huong GVCN → lớp'; end if;
  if (select mau_so from private.so_hien_tai(v_wig)) is distinct from 5 then
    raise exception '⑧ HỎNG: mẫu số mong 5 (4 em + GVCN), ra %', (select mau_so from private.so_hien_tai(v_wig));
  end if;
  raise notice '⑧ OK — nối cùng đơn vị %% vào cha dem_em: cha vẫn dem_em, 0 dây gop_so, mẫu số 5';
end $$;

-- ⑨ Đơn vị quyển.
do $$ begin
  if not exists (select 1 from don_vi where ma = 'quyen' and is_active) then
    raise exception '⑨ HỎNG: chưa có đơn vị quyen (quyển)';
  end if;
  raise notice '⑨ OK — có đơn vị quyển';
end $$;

-- ⑩ Mục tiêu TRƯỜNG dem_em đếm xuyên qua mục tiêu lớp (em → lớp → trường): 3/5 → 60.
do $$
declare r bc193%rowtype; v_wig uuid; v_tr uuid; h record;
begin
  select * into r from bc193;
  select v into v_wig from id193 where k = 'wig';
  insert into muc_tieu (cap, campus_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('truong', r.cs, 'ZZTEST-0193 trường 90% em đạt', 'knowledge', 'do_luong', 'toi', 'tang',
          r.dv_pt, 0, 90, r.bd, r.kt, 'dem_em', 'duyet') returning id into v_tr;
  select * into h from private.so_hien_tai(v_tr);
  if h.mau_so is distinct from 0 or h.so is distinct from 0 then
    raise exception '⑩ HỎNG: trường chưa nối lớp nào mà ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  insert into noi (cha_id, con_muc_tieu_id, vai) values (v_tr, v_wig, 'chi_huong');
  select * into h from private.so_hien_tai(v_tr);
  if h.tu_so is distinct from 3 or h.mau_so is distinct from 5 or h.so is distinct from 60 then
    raise exception '⑩ HỎNG: mong 3/5 → 60 qua lớp, ra %/% → %', h.tu_so, h.mau_so, h.so;
  end if;
  raise notice '⑩ OK — mục tiêu trường dem_em đếm em qua mục tiêu lớp: 3/5 → 60';
end $$;

-- ⑪ trang_wig (RPC màn /wig) trả tu_so/mau_so cho mục tiêu lớp dem_em — thẻ in "3/5 em đạt".
do $$
declare r bc193%rowtype; v_wig uuid; j jsonb; row_ jsonb;
begin
  select * into r from bc193;
  select v into v_wig from id193 where k = 'wig';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  j := public.trang_wig(r.lop, vn_week_start(vn_today()), r.gvcn, r.cs, 8);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  select x into row_ from jsonb_array_elements(j -> 'mtRows') x where x ->> 'id' = v_wig::text;
  if row_ is null then raise exception '⑪ HỎNG: trang_wig không trả mục tiêu lớp dem_em'; end if;
  if (row_ ->> 'tu_so')::int is distinct from 3 or (row_ ->> 'mau_so')::int is distinct from 5
     or (row_ ->> 'nguon_so') is distinct from 'dem_em' then
    raise exception '⑪ HỎNG: trang_wig trả tu_so=% mau_so=% nguon_so=%', row_ ->> 'tu_so', row_ ->> 'mau_so', row_ ->> 'nguon_so';
  end if;
  raise notice '⑪ OK — trang_wig trả tu_so/mau_so (3/5) cho thẻ lớp';
  raise notice '✔ TẤT CẢ TEST 0193 ĐẠT';
end $$;

rollback;
