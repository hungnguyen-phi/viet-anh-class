-- 0193 — NGUỒN SỐ "ĐẾM SỐ EM ĐẠT" (nguon_so = 'dem_em') cho mục tiêu LỚP / TRƯỜNG.
--
-- VÌ SAO: đọc 12 tờ WIG thật của các lớp (docs/WIG_MAU_TU_THUC_TE.md) thì 10/12 lớp đặt cùng một
-- kiểu mục tiêu: "95% học sinh đạt mục tiêu học tập cá nhân". Đó là ĐẾM số em đạt, không phải CỘNG
-- số của các em. Mô hình cũ chỉ có 'con' (cộng/trung bình/tỉ lệ đạt qua dây gop_so, đòi cùng đơn
-- vị) — mục tiêu phổ biến nhất của lớp lại không tả được. Nay:
--
--   • nguon_so = 'dem_em': số của mục tiêu = % mục tiêu con (cap 'em') đang ĐẠT trên tổng mục tiêu
--     con đã duyệt, nối vào qua bảng `noi` (bất kỳ vai nào — dây chỉ hướng là đủ). Đơn vị ép '%',
--     đích y = % cần đạt (form mặc định 95), x = 0, kieu_dich 'toi'. Chỉ hợp lệ cap in ('lop','truong').
--   • Con "đạt" = private.so_hien_tai(con).dat — cùng một con số sự thật với thẻ của em; con đã
--     đóng với ly_do_dong='dat' cũng tính là đạt (và vẫn nằm trong mẫu số).
--   • Dây chỉ hướng vào cha dem_em KHÔNG cần cùng đơn vị (em đo "bài", em đo "điểm" đều đếm được).
--     noi_wig_len_tren không đổi cha dem_em sang 'con' dù em cùng đơn vị '%'. Dây gop_so vào cha
--     dem_em bị chặn với câu báo nói rõ.
--   • tu_so / mau_so (đã có sẵn trong muc_tieu_v) mang "số em đạt / tổng số em" để thẻ lớp in
--     "12/30 em đạt · 40%".
--   • Thêm đơn vị 'quyen' (quyển): 38% mục tiêu WIG 3 ngoài đời là về sách; bảng chưa có.
--
-- ĐÃ SO VỚI BẢN ĐANG CHẠY (pg_get_functiondef, 05/09/2026): so_hien_tai, noi_hop_le, noi_wig_len_tren,
-- trang_wig chép nguyên văn từ pg_proc + thêm đúng nhánh dem_em (trang_wig: thôi bỏ tu_so/mau_so). Không đụng mt_truoc_them / mt_truoc_sua /
-- go_wig_len_tren (không cần: go_wig chỉ hạ 'con' → 'ghi_tay', dem_em không bị chạm).
--
--   npm run sql -- supabase/migrations/0193_nguon_so_dem_em.sql
--   npm run sql -- scripts/test-0193-dem-em.sql

begin;

-- ── 1. Ràng buộc: nhận 'dem_em', chỉ cho lớp/trường, chỉ kiểu đích 'toi' (0 → y%) ─────────────────
alter table public.muc_tieu drop constraint if exists mt_nguon_ck;
alter table public.muc_tieu add constraint mt_nguon_ck
  check (nguon_so = any (array['thuoc','ghi_tay','he_thong','con','thanh_phan','dem_em']));
alter table public.muc_tieu drop constraint if exists mt_dem_em_ck;
alter table public.muc_tieu add constraint mt_dem_em_ck
  check (nguon_so <> 'dem_em' or (cap in ('lop','truong') and kieu_dich = 'toi'));

-- ── 2. Đơn vị "quyển" ───────────────────────────────────────────────────────────────────────────
insert into public.don_vi (ma, nhan_vi, nhan_en, is_active)
select 'quyen', 'quyển', 'books', true
where not exists (select 1 from public.don_vi where ma = 'quyen');

-- ── 3. so_hien_tai: thêm nhánh dem_em (nguyên văn bản live + nhánh mới) ─────────────────────────
create or replace function private.so_hien_tai(p_muc_tieu uuid, p_ky date default null::date, p_sau integer default 0)
 returns table(so numeric, nguon text, ngay_nguon date, so_nguon integer, x numeric, y numeric, le_ra numeric, pct numeric, dat boolean, trang_thai text, ky_tu date, ky_den date, so_ky_giu integer, so_ky_xet integer, tu_so integer, mau_so integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  m muc_tieu%rowtype; v_hom_nay date; v_ky date; v_campus uuid;
  v_x numeric; v_y numeric; v_kt date; v_kep boolean;
  v_so numeric; v_nguon text := null; v_ngay date; v_so_nguon int := 0;
  v_le numeric; v_pct numeric; v_dat boolean; v_tt text;
  v_kytu date; v_kyden date; v_sky_giu int; v_sky_xet int; v_tu int; v_mau int;
  v_het boolean; v_q numeric; v_st int;
  rec record; sc record; v_agg numeric := 0; v_cnt int := 0; v_have int := 0; v_contrib numeric; g numeric;
  v_parts int := 0; v_pv int := 0; v_psum numeric := 0; v_pdat int := 0;
begin
  if p_sau > 3 then
    return query select null::numeric, null::text, null::date, 0, null::numeric, null::numeric,
      null::numeric, null::numeric, null::boolean, 'chua_biet'::text, null::date, null::date,
      null::int, null::int, null::int, null::int;
    return;
  end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  select * into m from muc_tieu where id = p_muc_tieu;
  if m.id is null then return; end if;
  v_ky := coalesce(p_ky, v_hom_nay);
  v_campus := m.campus_id;
  v_kep := m.cap in ('lop', 'nhom', 'truong');

  -- Đích hiệu lực tại v_ky (30 §0.5): lấy bộ *_cu của dòng lich_su_dich sớm nhất có luc > v_ky.
  select lsd.x_cu, lsd.y_cu, lsd.ket_thuc_cu into v_x, v_y, v_kt
  from lich_su_dich lsd
  where lsd.muc_tieu_id = m.id and (lsd.luc at time zone 'Asia/Ho_Chi_Minh')::date > v_ky
  order by lsd.luc asc limit 1;
  if not found then v_x := m.x_so; v_y := m.y_so; v_kt := m.ket_thuc; end if;
  if v_kt is null then v_kt := m.ket_thuc; end if;
  v_het := v_ky > v_kt or m.trang_thai = 'dong';

  -- Biên kỳ (mục tiêu) cho toc_do_ky/giu.
  if m.ky is not null then
    v_st := private.so_tuan_ky(m.ky);
    v_kytu := (vn_week_start(m.bat_dau)
      + (floor((vn_week_start(v_ky) - vn_week_start(m.bat_dau))::numeric / (7 * v_st)))::int * 7 * v_st)::date;
    v_kyden := (v_kytu + 7 * v_st - 1)::date;
  end if;

  -- ── Lấy `so` theo nguon_so ──────────────────────────────────────────────────────────
  if m.nguon_so in ('ghi_tay', 'he_thong') then
    if m.kieu_dich in ('toc_do_ky', 'giu') then
      select gia_tri, ngay into v_so, v_ngay from so_do
      where muc_tieu_id = m.id and thanh_phan_id is null and student_id is not distinct from m.student_id
        and ngay between v_kytu and v_ky order by ngay desc, created_at desc limit 1;
    else
      select gia_tri, ngay into v_so, v_ngay from so_do
      where muc_tieu_id = m.id and thanh_phan_id is null and student_id is not distinct from m.student_id
        and ngay <= v_ky order by ngay desc, created_at desc limit 1;
    end if;
    v_nguon := case m.nguon_so when 'he_thong' then 'he_thong' else 'ghi_tay' end;

  elsif m.nguon_so = 'thanh_phan' then
    for rec in
      select tp.id, tp.nguong,
        (select gia_tri from so_do s where s.muc_tieu_id = m.id and s.thanh_phan_id = tp.id
           and s.ngay <= v_ky order by ngay desc, created_at desc limit 1) as pv
      from thanh_phan tp where tp.muc_tieu_id = m.id
    loop
      v_parts := v_parts + 1;
      if rec.pv is not null then
        v_pv := v_pv + 1; v_psum := v_psum + rec.pv;
        if rec.pv >= coalesce(rec.nguong, m.nguong_con) then v_pdat := v_pdat + 1; end if;
      end if;
    end loop;
    if m.kieu_dich = 'ti_le_dat' then
      v_tu := v_pdat; v_mau := v_parts;
      v_so := case when v_parts = 0 then null else 100.0 * v_pdat / v_parts end;
    elsif m.gop_thanh_phan = 'trung_binh' then
      v_so := case when v_pv = 0 then null else v_psum / v_pv end;
    else                                   -- cong: đòi ĐỦ mọi phần có số, thiếu → null
      v_so := case when v_pv < v_parts then null else v_psum end;
    end if;
    v_nguon := 'may_tu_thanh_phan';
    v_so_nguon := v_pv;

  elsif m.nguon_so = 'thuoc' then
    for rec in
      select n.con_thuoc_id, n.he_so
      from noi n join thuoc th on th.id = n.con_thuoc_id
      where n.cha_id = m.id and n.vai = 'gop_so' and n.con_thuoc_id is not null
        and th.duyet = 'duyet' and th.trang_thai <> 'dong'
    loop
      if m.kieu_dich = 'toc_do_ky' then
        g := private.gop_thuoc_kep(rec.con_thuoc_id, v_kytu, v_ky, v_kep);
      elsif m.kieu_dich = 'giu' then
        g := private.gop_thuoc_kep(rec.con_thuoc_id, v_kytu, v_ky, false);
      else
        g := private.gop_thuoc_kep(rec.con_thuoc_id, m.bat_dau, v_ky, v_kep);
      end if;
      if g is not null then v_agg := v_agg + g * rec.he_so; v_cnt := v_cnt + 1; end if;
    end loop;
    if v_cnt = 0 then
      v_so := v_x; v_so_nguon := 0;
    else
      v_so_nguon := v_cnt;
      if m.kieu_dich = 'toc_do_ky' then v_so := v_agg;
      elsif m.chieu = 'giam' then v_so := coalesce(v_x, 0) - v_agg;
      else v_so := coalesce(v_x, 0) + v_agg; end if;
      if v_x is null and m.kieu_dich <> 'toc_do_ky' then v_so := v_agg; end if;   -- x null có dây → Σ
    end if;
    v_nguon := 'may_tu_thuoc';

  elsif m.nguon_so = 'con' then
    for rec in
      select n.con_muc_tieu_id, n.he_so, mc.chieu
      from noi n join muc_tieu mc on mc.id = n.con_muc_tieu_id
      where n.cha_id = m.id and n.vai = 'gop_so' and n.con_muc_tieu_id is not null
        and (mc.trang_thai = 'duyet' or (mc.trang_thai = 'dong' and mc.ly_do_dong = 'dat'))
    loop
      v_cnt := v_cnt + 1;
      select * into sc from private.so_hien_tai(rec.con_muc_tieu_id, v_ky, p_sau + 1) sc;
      if m.gop_con = 'trung_binh' then
        if sc.so is not null then v_agg := v_agg + sc.so; v_have := v_have + 1; end if;
      elsif m.gop_con = 'ti_le_dat' then
        if (m.nguong_con is not null and ((rec.chieu = 'giam' and sc.so <= m.nguong_con)
                                       or (rec.chieu <> 'giam' and sc.so >= m.nguong_con)))
           or (m.nguong_con is null and sc.dat) then v_have := v_have + 1; end if;
      else                                 -- cong: kẹp quãng CÓ HƯỚNG của con (30 §2.2)
        if sc.so is not null then
          if rec.chieu = 'giam' then
            if sc.x is not null then v_contrib := least(greatest(sc.x - sc.so, 0), sc.x - sc.y);
            else v_contrib := 0; end if;
          else
            v_contrib := least(greatest(sc.so - coalesce(sc.x, 0), 0), sc.y - coalesce(sc.x, 0));
          end if;
          v_agg := v_agg + v_contrib * rec.he_so;
        end if;
      end if;
    end loop;
    if m.gop_con = 'trung_binh' then
      v_so := case when v_have = 0 then null else v_agg / v_have end; v_so_nguon := v_cnt;
    elsif m.gop_con = 'ti_le_dat' then
      v_tu := v_have; v_mau := v_cnt;
      v_so := case when v_cnt = 0 then null else 100.0 * v_have / v_cnt end; v_so_nguon := v_cnt;
    else
      v_so := coalesce(v_x, 0) + v_agg; v_so_nguon := v_cnt;
    end if;
    v_nguon := 'may_tu_con';

  elsif m.nguon_so = 'dem_em' then
    -- 0193: ĐẾM số mục tiêu của các em (cap 'em') đang đạt / tổng đã duyệt, nối vào qua noi với BẤT
    -- KỲ vai nào (chỉ hướng là đủ, không cần cùng đơn vị). "Đạt" hỏi chính so_hien_tai của con —
    -- cùng con số với thẻ của em. Chưa em nào nối → 0/0 → 0%. Mục tiêu TRƯỜNG đếm cả em nối qua
    -- mục tiêu LỚP (em → lớp → trường), vì em chỉ nối được lên lớp mình.
    for rec in
      select mc.id as con_muc_tieu_id
      from muc_tieu mc
      where mc.cap = 'em'
        and (mc.trang_thai = 'duyet' or (mc.trang_thai = 'dong' and mc.ly_do_dong = 'dat'))
        and exists (
          select 1 from noi n
          where n.con_muc_tieu_id = mc.id
            and (n.cha_id = m.id
                 or (m.cap = 'truong' and n.cha_id in (
                       select n2.con_muc_tieu_id from noi n2 join muc_tieu ml on ml.id = n2.con_muc_tieu_id
                       where n2.cha_id = m.id and ml.cap = 'lop'
                         and (ml.trang_thai = 'duyet' or (ml.trang_thai = 'dong' and ml.ly_do_dong = 'dat'))))))
    loop
      v_cnt := v_cnt + 1;
      select * into sc from private.so_hien_tai(rec.con_muc_tieu_id, v_ky, p_sau + 1) sc;
      if coalesce(sc.dat, false) then v_have := v_have + 1; end if;
    end loop;
    v_tu := v_have; v_mau := v_cnt;
    v_so := case when v_cnt = 0 then 0 else round(100.0 * v_have / v_cnt, 1) end;
    v_so_nguon := v_cnt;
    v_nguon := 'may_dem_em';
  end if;

  -- ── ti_le_dat theo lay_tu (30 §2.3) — khi KHÔNG lấy từ con/thành phần ─────────────────
  if m.kieu_dich = 'ti_le_dat' and m.lay_tu is not null then
    if m.lay_tu = 'muc_tieu_em' and m.cap = 'lop' then
      select count(*) into v_mau from enrollments e where e.class_id = m.class_id and e.is_active;
      select count(*) into v_tu from (
        select e.student_id from enrollments e where e.class_id = m.class_id and e.is_active
          and exists (
            select 1 from muc_tieu c where c.cap = 'em' and c.student_id = e.student_id
              and c.class_id = m.class_id and c.trang_thai = 'duyet'
              and (m.linh_vuc is null or c.linh_vuc = m.linh_vuc)
              and (m.subject_id is null or c.subject_id = m.subject_id)
              and (m.don_vi_id is null or c.don_vi_id = m.don_vi_id)
              and private.con_dat(c.id, v_ky, m.nguong_con))) z;
    elsif m.lay_tu = 'muc_tieu_lop' then
      select count(*) into v_mau from classes cl where cl.campus_id = m.campus_id and cl.is_active
        and cl.school_year = current_school_year();
      select count(distinct c.class_id) into v_tu from muc_tieu c
        where c.cap = 'lop' and c.campus_id = m.campus_id and c.trang_thai = 'duyet'
          and (m.subject_id is null or c.subject_id = m.subject_id)
          and (m.linh_vuc is null or c.linh_vuc = m.linh_vuc)
          and private.con_dat(c.id, v_ky, m.nguong_con);
    elsif m.lay_tu = 'thuoc' then
      select coalesce(sum(gt.so_em_dat), 0), coalesce(sum(gt.so_em_can), 0) into v_tu, v_mau
      from noi n join thuoc th on th.id = n.con_thuoc_id
      cross join lateral private.ky_cua_thuoc(th.id, v_ky) kc
      cross join lateral private.gia_thuoc(th.id, kc.ky_tu, kc.ky_den, null) gt
      where n.cha_id = m.id and n.vai = 'gop_so' and th.pham_vi = 'tung_em';
    end if;
    v_so := case when coalesce(v_mau, 0) = 0 then null else 100.0 * v_tu / v_mau end;
  end if;

  -- ── giu: đếm kỳ giữ / kỳ xét (30 §2.5) ────────────────────────────────────────────────
  if m.kieu_dich = 'giu' then
    v_sky_giu := 0; v_sky_xet := 0;
    declare kk date; kend date; sk numeric; v_stop date;
    begin
      v_stop := case when v_het then v_kt else v_ky end;
      kk := (vn_week_start(m.bat_dau))::date;
      while kk <= v_stop loop
        kend := least((kk + 7 * v_st - 1)::date, v_stop);
        if m.nguon_so in ('ghi_tay', 'he_thong') then
          select gia_tri into sk from so_do where muc_tieu_id = m.id and thanh_phan_id is null
            and student_id is not distinct from m.student_id and ngay between kk and kend order by ngay desc, created_at desc limit 1;
        else
          sk := private.gop_thuoc_kep(
            (select n.con_thuoc_id from noi n where n.cha_id = m.id and n.vai = 'gop_so'
               and n.con_thuoc_id is not null limit 1), kk, kend, false);
        end if;
        if sk is not null then
          v_sky_xet := v_sky_xet + 1;
          if (m.chieu in ('tang', 'giu') and sk >= v_y) or (m.chieu = 'giam' and sk <= v_y) then
            v_sky_giu := v_sky_giu + 1;
          end if;
        end if;
        kk := (kk + 7 * v_st)::date;
      end loop;
    end;
  end if;

  -- ── le_ra (30 §2.4) ───────────────────────────────────────────────────────────────────
  if m.kieu_dich = 'toi' then
    v_le := private.le_ra_diem(m.id, v_x, v_y, m.bat_dau, v_kt, v_ky, v_campus);
  elsif m.kieu_dich = 'tran_tich_luy' then
    v_le := private.le_ra_diem(m.id, coalesce(v_x, 0), v_y, m.bat_dau, v_kt, v_ky, v_campus);
  elsif m.kieu_dich = 'toc_do_ky' then
    v_le := private.le_ra_diem(m.id, v_x, v_y, m.bat_dau, v_kt, v_kyden, v_campus);
  elsif m.kieu_dich = 'giu' then
    v_le := v_y;
  else v_le := null; end if;

  -- ── Ma trận kiểu × chiều → pct, dat, trang_thai (30 §2.5) ────────────────────────────
  if m.trang_thai = 'dong' then
    if m.ly_do_dong = 'dat' then v_dat := true; v_tt := 'dat';
    else v_dat := null; v_tt := 'dong'; end if;

  elsif m.kieu_dich = 'toi' then
    if v_x is null then v_pct := null;
    elsif m.chieu = 'giam' then v_q := v_x - v_y; v_pct := least(1, greatest(0, (v_x - v_so) / nullif(v_q, 0)));
    elsif m.chieu = 'tang' then v_q := v_y - v_x; v_pct := least(1, greatest(0, (v_so - v_x) / nullif(v_q, 0)));
    else
      if v_x < v_y then v_q := v_y - v_x; v_pct := least(1, greatest(0, (v_so - v_x) / nullif(v_q, 0)));
      elsif v_x > v_y then v_q := v_x - v_y; v_pct := least(1, greatest(0, (v_x - v_so) / nullif(v_q, 0)));
      else v_q := 0; v_pct := null; end if;
    end if;
    if m.chieu = 'giam' then v_dat := v_so <= v_y;
    elsif m.chieu = 'tang' then v_dat := v_so >= v_y;
    else v_dat := case when v_x <= v_y then v_so >= v_y else v_so <= v_y end; end if;
    if v_so is null then v_dat := null; v_tt := 'chua_biet';
    elsif v_dat then v_tt := 'dat';
    elsif v_het then v_tt := 'truot';
    elsif v_le is null then v_tt := 'dang_lam';
    elsif m.chieu = 'giam' then
      if v_so <= v_le then v_tt := 'dang_thang';
      elsif v_so <= v_le + 0.1 * coalesce(v_q, 0) then v_tt := 'sat_nut'; else v_tt := 'can_co'; end if;
    else
      if v_so >= v_le then v_tt := 'dang_thang';
      elsif v_so >= v_le - 0.1 * coalesce(v_q, 0) then v_tt := 'sat_nut'; else v_tt := 'can_co'; end if;
    end if;

  elsif m.kieu_dich = 'tran_tich_luy' then
    v_pct := null;
    if v_so is null then v_dat := null; v_tt := 'chua_biet';
    elsif v_so > v_y then v_dat := false; v_tt := 'vuot';
    elsif v_het then v_dat := true; v_tt := 'dat';
    else v_dat := null;
      if v_le is not null and v_so <= v_le then v_tt := 'dang_giu'; else v_tt := 'sat_nut'; end if;
    end if;

  elsif m.kieu_dich = 'giu' then
    v_pct := null;
    if v_het then v_dat := (coalesce(v_sky_xet, 0) >= 1 and v_sky_giu = v_sky_xet);
      v_tt := case when v_dat then 'dat' else 'truot' end;
    else v_dat := null;
      if v_so is null then v_tt := 'chua_biet';
      elsif (m.chieu in ('tang', 'giu') and v_so >= v_y) or (m.chieu = 'giam' and v_so <= v_y)
        then v_tt := 'dang_giu';
      else v_tt := 'can_co'; end if;
    end if;

  elsif m.kieu_dich = 'toc_do_ky' then
    if v_x is null then v_pct := null;
    elsif m.chieu = 'giam' then v_q := v_x - v_y; v_pct := least(1, greatest(0, (v_x - v_so) / nullif(v_q, 0)));
    else v_q := v_y - v_x; v_pct := least(1, greatest(0, (v_so - v_x) / nullif(v_q, 0))); end if;
    if v_het then
      v_dat := case when m.chieu = 'giam' then v_so <= v_y else v_so >= v_y end;
      v_tt := case when v_dat then 'dat' else 'truot' end;
    else v_dat := null;
      if v_so is null then v_tt := 'chua_biet';
      elsif m.chieu = 'giam' then
        if v_so <= v_le then v_tt := 'dang_thang';
        elsif v_so <= v_le + 0.1 * coalesce(v_q, 0) then v_tt := 'sat_nut'; else v_tt := 'can_co'; end if;
      else
        if v_so >= v_le then v_tt := 'dang_thang';
        elsif v_so >= v_le - 0.1 * coalesce(v_q, 0) then v_tt := 'sat_nut'; else v_tt := 'can_co'; end if;
      end if;
    end if;

  elsif m.kieu_dich = 'ti_le_dat' then
    v_pct := case when v_y is null or v_y = 0 then null else least(1, v_so / v_y) end;
    v_dat := (v_so is not null and v_so >= v_y);
    v_tt := case when v_dat then 'dat' else 'dang_lam' end;

  else                                   -- chu
    v_pct := null; v_so := null;
    if m.trang_thai = 'dong' and m.ly_do_dong = 'dat' then v_dat := true; v_tt := 'dat';
    else v_dat := false; v_tt := 'dang_lam'; end if;
  end if;

  return query select v_so, v_nguon, v_ngay, v_so_nguon, v_x, v_y, v_le, v_pct, v_dat, v_tt,
    case when m.ky is not null then v_kytu else null end,
    case when m.ky is not null then v_kyden else null end,
    v_sky_giu, v_sky_xet, v_tu, v_mau;
end $function$;

-- ── 4. trg_noi_hop_le: cha dem_em nhận dây chỉ hướng từ mọi mục tiêu em (đường chi_huong vốn không
--       đòi đơn vị — giữ nguyên); dây gop_so vào cha dem_em bị chặn với câu nói rõ vì sao. ────────
create or replace function private.noi_hop_le()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    -- 0193: mục tiêu đếm số em đạt không cộng số từ đâu cả — chỉ hướng là đủ để được đếm.
    if v_cha.nguon_so = 'dem_em' then
      raise exception 'Mục tiêu này đếm số em đạt mục tiêu của mình — chỉ cần "chỉ hướng" vào, không cộng số'
        using errcode = '23514';
    end if;
    if new.con_thuoc_id is not null then
      if v_cha.nguon_so <> 'thuoc' then
        raise exception 'Mục tiêu này không cộng số từ thước đo — chọn "chỉ hướng", hoặc đổi nguồn số của mục tiêu'
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
end $function$;

-- ── 5. noi_wig_len_tren: em cùng đơn vị '%' nối vào cha dem_em thì cha VẪN là dem_em (không đổi
--       sang 'con' + gop_so). Còn lại nguyên văn 0182. ────────────────────────────────────────────
create or replace function public.noi_wig_len_tren(p_con uuid, p_cha uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_me uuid := (select auth.uid()); con muc_tieu%rowtype; cha muc_tieu%rowtype;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  select * into con from muc_tieu where id = p_con;
  select * into cha from muc_tieu where id = p_cha;
  if con.id is null or cha.id is null then
    raise exception 'Không thấy mục tiêu để nối' using errcode = '23503';
  end if;
  if not ghi_duoc_muc_tieu(p_con) then
    raise exception 'Chỉ chủ mục tiêu mới nối được nó lên trên' using errcode = '42501';
  end if;
  if not ( (con.cap = 'em'  and con.student_id = v_me and cha.cap = 'lop'
            and cha.class_id = con.class_id and (is_class_teacher(con.class_id) or (select auth_role()) = 'admin'))
        or (con.cap = 'lop' and cha.cap = 'truong' and cha.trang_thai = 'duyet'
            and cha.campus_id = con.campus_id) ) then
    raise exception 'Chỉ nối được mục tiêu của mình lên mục tiêu lớp, hoặc mục tiêu lớp lên mục tiêu trường cùng cơ sở'
      using errcode = '42501';
  end if;
  insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'chi_huong', v_me)
    on conflict do nothing;
  -- 0182: cộng số CHỈ cho cá nhân→lớp. Lớp→trường luôn chỉ giữ hướng — trường đo theo cách riêng.
  -- 0193: cha đếm số em đạt (dem_em) không cộng số — dây chỉ hướng ở trên đã đủ để được đếm.
  if con.cap = 'em' and cha.nguon_so is distinct from 'dem_em'
     and con.don_vi_id is not null and con.don_vi_id = cha.don_vi_id then
    -- Đổi nguồn số của cha TRƯỚC — trg_noi_hop_le đòi cha nguon_so='con' rồi mới nhận dây gop_so.
    if cha.nguon_so is distinct from 'con' then
      perform set_config('va.doi_nguon_so', '1', true);
      update muc_tieu set nguon_so = 'con', gop_con = 'cong' where id = p_cha;
      perform set_config('va.doi_nguon_so', '', true);
    end if;
    insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'gop_so', v_me)
      on conflict do nothing;
  end if;
end $function$;

-- ── 6. trang_wig (0189): GIỮ tu_so / mau_so trong mtRows + mtToiRows để thẻ lớp in "3/5 em đạt".
--       Bản 0189 cố ý bỏ hai cột này (chưa ai dùng); còn lại nguyên văn bản live. ──────────────
create or replace function public.trang_wig(p_class uuid, p_tuan date, p_toi uuid default null::uuid, p_campus uuid default null::uuid, p_so_tuan integer default 8)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_ket date := p_tuan + 6;
  j jsonb := '{}'::jsonb;
  v_mt jsonb; v_mt_toi jsonb; v_truong jsonb;
  v_ids uuid[]; v_ids_toi uuid[]; v_ids_truong uuid[]; v_ke uuid[]; v_ls uuid[];
begin
  if (select auth.uid()) is null then return null; end if;

  -- muc_tieu_v ba lượt (lớp · tôi · trường) — cột đúng MT_COLS + vài cột thẻ trường cần.
  -- 0193: giữ tu_so/mau_so (thẻ dem_em cần).
  select coalesce(jsonb_agg(to_jsonb(m) - 'nguon' - 'ngay_nguon' - 'so_nguon' - 'x' - 'y' - 'ky_tu' - 'ky_den'
                                        - 'so_ky_giu' - 'so_ky_xet' - 'nam_hoc' - 'chu_the_key'
                                        - 'nguon_he_thong' - 'gop_con' - 'gop_thanh_phan' - 'nguong_con' - 'lay_tu' - 'mau_id'
                                        - 'duyet_boi' - 'duyet_at' - 'dong_boi' - 'dong_at' - 'ly_do_dong' - 'nguoi_nhap_ho'
                                        - 'created_by' - 'created_at' - 'updated_at' - 'bat_dau' - 'campus_id' - 'nhom_id' - 'cap'
                                        - 'class_id' order by m.created_at), '[]'::jsonb),
         coalesce(array_agg(m.id), '{}'::uuid[]),
         coalesce(array_agg(m.id) filter (where m.loai_moc = 'ke_hoach'), '{}'::uuid[]),
         coalesce(array_agg(m.id) filter (where m.pct is not null or m.so is not null), '{}'::uuid[])
    into v_mt, v_ids, v_ke, v_ls
  from muc_tieu_v m where m.class_id = p_class and m.cap = 'lop' and m.trang_thai <> 'dong';

  if p_toi is not null then
    select coalesce(jsonb_agg(to_jsonb(m) - 'nguon' - 'ngay_nguon' - 'so_nguon' - 'x' - 'y' - 'ky_tu' - 'ky_den'
                                          - 'so_ky_giu' - 'so_ky_xet' - 'nam_hoc' - 'chu_the_key'
                                          - 'nguon_he_thong' - 'gop_con' - 'gop_thanh_phan' - 'nguong_con' - 'lay_tu' - 'mau_id'
                                          - 'duyet_boi' - 'duyet_at' - 'dong_boi' - 'dong_at' - 'ly_do_dong' - 'nguoi_nhap_ho'
                                          - 'created_by' - 'created_at' - 'updated_at' - 'bat_dau' - 'campus_id' - 'nhom_id' - 'cap'
                                          - 'class_id' order by m.created_at), '[]'::jsonb),
           coalesce(array_agg(m.id), '{}'::uuid[]),
           v_ls || coalesce(array_agg(m.id) filter (where m.pct is not null or m.so is not null), '{}'::uuid[])
      into v_mt_toi, v_ids_toi, v_ls
    from muc_tieu_v m where m.class_id = p_class and m.cap = 'em' and m.student_id = p_toi and m.trang_thai <> 'dong';
  else
    v_mt_toi := null; v_ids_toi := '{}'::uuid[];
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ten', m.ten, 'don_vi_id', m.don_vi_id, 'ten_don_vi', m.ten_don_vi,
                                               'so', m.so, 'y_so', m.y_so) order by m.created_at), '[]'::jsonb),
         coalesce(array_agg(m.id), '{}'::uuid[])
    into v_truong, v_ids_truong
  from muc_tieu_v m where m.campus_id = p_campus and m.cap = 'truong' and m.trang_thai = 'duyet';

  j := jsonb_build_object(
    'thiDua',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.thi_dua_lop(p_class) x),
    'mtRows',    v_mt,
    'mtToiRows', v_mt_toi,
    'truongRows', v_truong,
    'thuocRows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.bang_lop_thuoc(p_class, p_tuan) x),
    'ckRows',    case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'noi_dung', c.noi_dung, 'so_hua', c.so_hua, 'so_dat', c.so_dat,
                     'ket_qua', c.ket_qua, 'ten_don_vi', c.ten_don_vi, 'muc_tieu_id', c.muc_tieu_id, 'thuoc_id', c.thuoc_id,
                     'tuan_bat_dau', c.tuan_bat_dau, 'tuan_ket_thuc', c.tuan_ket_thuc, 'so_tuan', c.so_tuan, 'trang_thai', c.trang_thai)), '[]'::jsonb)
                   from cam_ket_v c where c.class_id = p_class and c.chu_the = 'em' and c.student_id = p_toi and c.trang_thai <> 'huy') end,
    'enrolled',  (select coalesce(jsonb_agg(jsonb_build_object('student_id', e.student_id, 'profiles', jsonb_build_object('full_name', p.full_name))), '[]'::jsonb)
                   from enrollments e join profiles p on p.id = e.student_id where e.class_id = p_class and e.is_active),
    'mtCho',     (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ten', m.ten, 'linh_vuc', m.linh_vuc, 'student_id', m.student_id,
                     'x_so', m.x_so, 'y_so', m.y_so, 'ten_don_vi', m.ten_don_vi, 'ket_thuc', m.ket_thuc)), '[]'::jsonb)
                   from muc_tieu_v m where m.class_id = p_class and m.cap = 'em' and m.trang_thai = 'gui'),
    'haCho',     (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'thuoc_id', l.thuoc_id, 'chi_tieu_ky', l.chi_tieu_ky, 'la_ha', l.la_ha,
                     'thuoc', jsonb_build_object('ten', t.ten, 'class_id', t.class_id, 'student_id', t.student_id, 'chi_tieu_ky', t.chi_tieu_ky))), '[]'::jsonb)
                   from thuoc_lich_su l join thuoc t on t.id = l.thuoc_id where l.trang_thai = 'cho_duyet' and t.class_id = p_class),
    'thuocToiRows', case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ten', t.ten, 'cach_ghi', t.cach_ghi, 'chi_tieu_ky', t.chi_tieu_ky,
                     'ngay_ap_dung', t.ngay_ap_dung, 'don_vi_id', t.don_vi_id, 'cam_ket_id', t.cam_ket_id) order by t.created_at), '[]'::jsonb)
                   from thuoc t where t.class_id = p_class and t.student_id = p_toi and t.cam_ket_id is not null and t.trang_thai <> 'dong') end,
    'luotRows',  case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('thuoc_id', l.thuoc_id, 'ngay', l.ngay, 'gia_tri', l.gia_tri)), '[]'::jsonb)
                   from luot l where l.student_id = p_toi and l.ngay between p_tuan and v_ket) end,
    -- tầng 3
    'buocRows',  (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'muc_tieu_id', b.muc_tieu_id, 'tieu_de', b.tieu_de,
                     'phan_tram', b.phan_tram, 'xong_at', b.xong_at) order by b.thu_tu), '[]'::jsonb)
                   from buoc b where b.muc_tieu_id = any(v_ke)),
    'noiRows',   (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_thuoc_id', n.con_thuoc_id)), '[]'::jsonb)
                   from noi n where n.cha_id = any(v_ids) and n.vai = 'gop_so' and n.con_thuoc_id is not null),
    'noiToiRows', (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_muc_tieu_id', n.con_muc_tieu_id, 'vai', n.vai)), '[]'::jsonb)
                   from noi n where n.con_muc_tieu_id = any(v_ids_toi)),
    'noiTruongRows', (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_muc_tieu_id', n.con_muc_tieu_id, 'vai', n.vai)), '[]'::jsonb)
                   from noi n where n.cha_id = any(v_ids_truong) and n.con_muc_tieu_id = any(v_ids)),
    'lichSu',    (select coalesce(jsonb_agg(jsonb_build_object('muc_tieu_id', l.muc_tieu_id, 'tuan_ket', l.tuan_ket, 'so', l.so)), '[]'::jsonb)
                   from public.muc_tieu_lich_su_tuan_nhieu(v_ls, p_so_tuan) l)
  );
  return j;
end $function$;

commit;
