-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0173 — so_hien_tai đọc số đo của mục tiêu EM theo đúng chủ (vá mâu thuẫn có sẵn)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- so_do_truoc_ghi (0163) BUỘC dòng số đo mang student_id = chủ mục tiêu (mục tiêu của em ↔ đúng
-- em; lớp/trường ↔ null). Nhưng so_hien_tai (0166) lại ĐỌC `student_id is null` — nên số đo tay
-- của MỌI mục tiêu của em (đo lường / hành động / kế hoạch) không bao giờ được đọc, tiến độ đứng 0.
-- Chưa lộ vì chưa ai đo tay mục tiêu của em (0 dòng so_do kiểu này). Cột mốc "kế hoạch" (0172) là
-- ca đầu tiên chạm phải.
--
-- Vá: đọc `student_id is not distinct from m.student_id` — mục tiêu lớp (student_id null) giữ NGUYÊN
-- hành vi (`is not distinct from null` = `is null`); mục tiêu của em đọc đúng dòng của em. Chỉ đổi ở
-- các chỗ đọc SO_DO; các chỗ đọc luot/thanh_phan giữ nguyên. Thân hàm chép NGUYÊN từ pg_proc
-- production 02/09, chỉ khác đúng 2 dòng ấy — md5 để đối chiếu ở PR.

CREATE OR REPLACE FUNCTION private.so_hien_tai(p_muc_tieu uuid, p_ky date DEFAULT NULL::date, p_sau integer DEFAULT 0)
 RETURNS TABLE(so numeric, nguon text, ngay_nguon date, so_nguon integer, x numeric, y numeric, le_ra numeric, pct numeric, dat boolean, trang_thai text, ky_tu date, ky_den date, so_ky_giu integer, so_ky_xet integer, tu_so integer, mau_so integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
