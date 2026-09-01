-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0166 — PA2: TẦNG ĐỌC. Hai hàm lõi + hàm/view cho màn + thi đua ba số.
-- Vì sao gộp cả tầng đọc vào MỘT tệp: mọi số trên mọi màn phải đi qua đúng HAI hàm lõi
-- (private.gia_thuoc trả giá một THƯỚC trong một cửa sổ, private.so_hien_tai trả số hiện
-- tại một MỤC TIÊU) — mô hình cũ có bảy chỗ tự cộng và chúng lệch nhau. Để không màn nào tự
-- cộng lại, tệp này giữ: hai hàm lõi + các helper kỳ/tuần-học của chúng, hàm gợi ý Thắng/Thua
-- (definer TỰ GÁC, trả null khi không đọc được), hai view invoker (muc_tieu_v, cam_ket_v), các
-- hàm màn definer TỰ GÁC (viec_bang/bang_ron/thuoc_12_tuan/*_dem/metrics_tuan/bang_lop_*/
-- co_so_tong_hop/thi_dua_lop) và VIẾT LẠI class_competition_scores/campus_rollup (md5 guard,
-- giữ nguyên chữ ký) để trang lớp/BGH không đổ 500 khi bảng cũ bị drop ở 0168.
-- Luật: view LUÔN security_invoker=true + revoke anon (L3); hai hàm lõi KHÔNG gác (chỉ tính) →
-- revoke ĐỦ ba vai (public/anon/authenticated), chỉ hàm/view đã gác gọi (L12); hàm màn definer
-- gác trong WHERE cuối câu, sai vai → 0 dòng; nhóm <3 người không lộ tổng/trung bình cho học
-- sinh (L7). Đặc tả: docs/PA2/30-PHEP-TINH §1–§4. Tên cột theo 10-SCHEMA. Phụ thuộc 0165.
-- LỆCH ĐẶC TẢ (báo cho tác nhân tích hợp): (a) theo phân công trọng tài 50-DI-TRU §1.2, gia_thuoc
-- thuộc 0164 và so_hien_tai/goi_y_cam_ket thuộc 0165 — tệp này ĐẶT CẢ BA ở 0166 theo yêu cầu
-- điều phối "0166 = trọn tầng đọc"; là create-or-replace nên chạy 0164/0165 trước rồi 0166 chỉ
-- ghi đè y nguyên (0164/0165 KHÔNG được tự định nghĩa chúng, nếu không sẽ có hai bản tay). (b)
-- đặc tả ghi hai hàm lõi `language sql`; ở đây dùng `language plpgsql` (ma trận kiểu×chiều + đệ
-- quy so_hien_tai dễ đọc/đúng hơn, chữ ký y hệt) — người gọi không phân biệt được.
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 0. HELPER TUẦN / KỲ (private, thuần tính; revoke đủ ba vai ở khối cuối)
-- ─────────────────────────────────────────────────────────────────────────────────────

-- Số tuần của một kỳ MỤC TIÊU (ky text) — tuan→1, hai_tuan→2, thang→4 tuần ISO (không phải
-- tháng lịch, [H-19]).
create or replace function private.so_tuan_ky(p_ky text) returns int
language sql immutable as $$
  select case p_ky when 'tuan' then 1 when 'hai_tuan' then 2 when 'thang' then 4 else 1 end;
$$;

-- Tuần p_tuan (thứ Hai) là tuần HỌC của cơ sở? Không có dòng tuan_hoc = học; loai hoc/thi = học;
-- chỉ loai='nghi' là KHÔNG học.
create or replace function private.tuan_la_hoc(p_campus uuid, p_tuan date) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from tuan_hoc
                     where campus_id = p_campus and week_start = p_tuan and loai = 'nghi');
$$;

-- Số NGÀY HỌC trong [p_tu, p_den] (ngày thuộc tuần học).
create or replace function private.so_ngay_hoc(p_campus uuid, p_tu date, p_den date) returns int
language sql stable security definer set search_path = public as $$
  select case when p_tu is null or p_den is null or p_den < p_tu then 0 else (
    select count(*)::int
    from generate_series(p_tu::timestamp, p_den::timestamp, interval '1 day') gs
    where private.tuan_la_hoc(p_campus, vn_week_start(gs::date))
  ) end;
$$;

-- Chỉ tiêu HIỆU LỰC của một thước tại một tuần (chốt C10): đọc CHỈ dòng thuoc_lich_su
-- trang_thai='hieu_luc' có tu_tuan lớn nhất ≤ tuần; không có → thuoc.chi_tieu_ky; dòng hieu_luc
-- có chi_tieu_ky null (tạm dừng) → trả NULL (tuần đó miễn).
create or replace function private.chi_tieu_tai(p_thuoc uuid, p_tuan date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v_found boolean; v_val numeric;
begin
  select true, chi_tieu_ky into v_found, v_val
  from thuoc_lich_su
  where thuoc_id = p_thuoc and trang_thai = 'hieu_luc' and tu_tuan <= p_tuan
  order by tu_tuan desc limit 1;
  if v_found then return v_val; end if;     -- v_val có thể NULL = tạm dừng
  return (select chi_tieu_ky from thuoc where id = p_thuoc);
end $$;

-- Thứ Hai đầu KỲ (theo ky_tuan) chứa p_ngay.
create or replace function private.ky_start(p_thuoc uuid, p_ngay date) returns date
language sql stable security definer set search_path = public as $$
  select (t.tu_tuan
    + (floor((vn_week_start(p_ngay) - t.tu_tuan)::numeric / (7 * t.ky_tuan)))::int * 7 * t.ky_tuan)
  from thuoc t where t.id = p_thuoc;
$$;

-- Kỳ của thước chứa p_ngay: (ky_tu, ky_den, so_tuan_hoc, chi_tieu co-theo-tuần-học,
-- chi_tieu_day_du (bỏ qua nghỉ — nghỉ được miễn phạt, không thưởng thêm), mien).
create or replace function private.ky_cua_thuoc(p_thuoc uuid, p_ngay date)
returns table (ky_tu date, ky_den date, so_tuan_hoc int, chi_tieu numeric,
               chi_tieu_day_du numeric, mien boolean)
language plpgsql stable security definer set search_path = public as $$
declare t thuoc%rowtype; v_campus uuid; v_kt date; v_kd date;
begin
  select * into t from thuoc where id = p_thuoc;
  if t.id is null then return; end if;
  v_campus := (select campus_id from classes where id = t.class_id);
  v_kt := private.ky_start(p_thuoc, p_ngay);
  v_kd := (v_kt + 7 * t.ky_tuan - 1)::date;
  return query
  with ws as (
    select distinct vn_week_start(gs::date) as w
    from generate_series(v_kt::timestamp, v_kd::timestamp, interval '1 day') gs
  )
  select v_kt, v_kd,
    count(*) filter (where private.tuan_la_hoc(v_campus, ws.w)
                       and private.chi_tieu_tai(p_thuoc, ws.w) is not null)::int,
    sum(private.chi_tieu_tai(p_thuoc, ws.w) / t.ky_tuan)
      filter (where private.tuan_la_hoc(v_campus, ws.w)
              and private.chi_tieu_tai(p_thuoc, ws.w) is not null),
    sum(coalesce(private.chi_tieu_tai(p_thuoc, ws.w), 0) / t.ky_tuan),
    bool_and(not private.tuan_la_hoc(v_campus, ws.w))
  from ws
  where ws.w >= t.tu_tuan and (t.den_tuan is null or ws.w <= t.den_tuan);
end $$;

-- Ma trận trạng thái của MỘT thước cho MỘT chủ thể (30 §1.3). Tách ra để dùng lại ở cả nhánh
-- một-em lẫn vòng gộp-lớp.
create or replace function private.tt_thuoc(
  p_gop text, p_chieu text, p_gia numeric, p_chi_tieu numeric, p_le_ra numeric,
  p_giu int, p_apd int, p_apd_qua int, p_mo boolean,
  out dat boolean, out trang_thai text)
language plpgsql immutable as $$
begin
  if p_chi_tieu is null then dat := null; trang_thai := 'mien'; return; end if;
  if p_gop = 'tong' and p_chieu = 'it_nhat' then
    if coalesce(p_gia, 0) >= p_chi_tieu then dat := true; trang_thai := 'dat';
    elsif p_mo then
      dat := false;
      if p_le_ra is null then trang_thai := 'dang_lam';
      elsif coalesce(p_gia, 0) >= p_le_ra then trang_thai := 'dang_thang';
      elsif coalesce(p_gia, 0) >= p_le_ra - 0.1 * p_chi_tieu then trang_thai := 'sat_nut';
      else trang_thai := 'can_co'; end if;
    else dat := false; trang_thai := 'truot'; end if;
  elsif p_gop = 'tong' and p_chieu = 'nhieu_nhat' then
    if coalesce(p_gia, 0) > p_chi_tieu then dat := false; trang_thai := 'vuot';
    elsif not p_mo and coalesce(p_giu, 0) >= coalesce(p_apd, 0) then dat := true; trang_thai := 'dat';
    elsif p_mo and coalesce(p_giu, 0) >= coalesce(p_apd_qua, 0) then dat := null; trang_thai := 'dang_giu';
    else dat := null; trang_thai := 'chua_biet'; end if;
  elsif p_gop = 'moi_nhat' then
    if p_gia is null then dat := null; trang_thai := 'chua_biet';
    elsif (p_chieu = 'it_nhat' and p_gia >= p_chi_tieu)
       or (p_chieu = 'nhieu_nhat' and p_gia <= p_chi_tieu) then dat := true; trang_thai := 'dat';
    elsif p_mo then dat := false; trang_thai := 'dang_lam';
    else dat := false; trang_thai := 'truot'; end if;
  elsif p_gop = 'dem_dat_nguong' then
    if coalesce(p_gia, 0) >= p_chi_tieu then dat := true; trang_thai := 'dat';
    elsif p_mo then dat := false; trang_thai := 'dang_lam';
    else dat := false; trang_thai := 'truot'; end if;
  else dat := null; trang_thai := 'chua_biet'; end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. HÀM LÕI 1 — private.gia_thuoc (30 §1)
--    Giá một THƯỚC trong cửa sổ [p_tu, p_den] cho p_chu_the (null + lớp/nhóm tung_em = gộp lớp).
--    Hợp đồng null (30 §0.4): không dòng → gia NULL (không coalesce ở đầu ra).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.gia_thuoc(
  p_thuoc uuid, p_tu date, p_den date, p_chu_the uuid default null)
returns table (
  gia numeric, so_dong int, so_ngay_ghi int, so_ngay_ap_dung int,
  so_ngay_ap_dung_da_qua int, so_ngay_giu int, so_tuan_hoc int, chi_tieu numeric,
  le_ra numeric, dat boolean, trang_thai text, ngay_cuoi date, gia_moi_nhat numeric,
  so_em_can int, so_em_ghi int, so_em_dat int)
language plpgsql stable security definer set search_path = public as $$
declare
  t thuoc%rowtype; v_hom_nay date; v_campus uuid; v_mo boolean;
  v_apd int := 0; v_apd_qua int := 0; v_tuan int := 0; v_chi_tieu numeric; v_le_ra numeric;
  v_team boolean := false; v_agg boolean := false;
  v_students uuid[]; v_sid uuid;
  v_gia numeric; v_dong int; v_ghi int; v_giu int; v_ngay date; v_gmoi numeric;
  v_dat boolean; v_tt text;
  a_gia numeric := 0; a_gia_has boolean := false; a_dong int := 0; a_ghi int := 0; a_giu int := 0;
  a_em_ghi int := 0; a_em_dat int := 0; a_can int; a_msum numeric := 0; a_mcnt int := 0; a_ncuoi date;
begin
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  select * into t from thuoc where id = p_thuoc;
  if t.id is null then return; end if;
  v_campus := (select campus_id from classes where id = t.class_id);
  v_mo := p_den >= v_hom_nay;

  -- Lịch (không phụ thuộc chủ thể): số ngày áp dụng (đã qua), số tuần học, chỉ tiêu, lẽ ra.
  select count(*), count(*) filter (where x.d <= v_hom_nay)
    into v_apd, v_apd_qua
  from generate_series(p_tu::timestamp, p_den::timestamp, interval '1 day') gs
  cross join lateral (select gs::date as d) x
  where x.d between t.tu_tuan and coalesce(t.den_tuan + 6, x.d)
    and (extract(isodow from x.d)::int = any (t.ngay_ap_dung))
    and private.tuan_la_hoc(v_campus, vn_week_start(x.d));

  select count(*) filter (where private.tuan_la_hoc(v_campus, w.w)
                            and private.chi_tieu_tai(p_thuoc, w.w) is not null)::int,
         sum(private.chi_tieu_tai(p_thuoc, w.w) / t.ky_tuan)
           filter (where private.tuan_la_hoc(v_campus, w.w)
                   and private.chi_tieu_tai(p_thuoc, w.w) is not null)
    into v_tuan, v_chi_tieu
  from (select distinct vn_week_start(gs::date) as w
        from generate_series(p_tu::timestamp, p_den::timestamp, interval '1 day') gs) w
  where w.w >= t.tu_tuan and (t.den_tuan is null or w.w <= t.den_tuan);

  -- le_ra chỉ có nghĩa cho gộp 'tong' (nhịp); moi_nhat/dem không có nhịp.
  if t.gop = 'tong' and v_chi_tieu is not null and v_apd > 0 then
    v_le_ra := v_chi_tieu * v_apd_qua::numeric / v_apd;
  else v_le_ra := null; end if;

  -- Chọn chủ thể.
  if t.pham_vi = 'ca_doi' then
    v_team := true;
  elsif t.chu_the = 'em' then
    v_students := array[t.student_id];
  elsif p_chu_the is not null then
    v_students := array[p_chu_the];
  else
    v_agg := true;
    if t.chu_the = 'lop' then
      select array_agg(e.student_id), count(*) into v_students, a_can
        from enrollments e where e.class_id = t.class_id and e.is_active;
    else
      select array_agg(v.student_id), count(*) into v_students, a_can
        from nhom_thanh_vien v where v.nhom_id = t.nhom_id and v.is_active;
    end if;
  end if;

  if v_team then
    select
      case t.gop when 'tong' then sum(gia_tri)
                 when 'moi_nhat' then (select gia_tri from luot l2
                    where l2.thuoc_id = p_thuoc and l2.student_id is null and l2.ngay between p_tu and p_den
                    order by ngay desc, stt desc, created_at desc limit 1)
                 when 'dem_dat_nguong' then count(*) filter (where gia_tri >= t.nguong_moi_lan) end,
      count(*)::int, count(distinct ngay)::int,
      count(distinct ngay) filter (where extract(isodow from ngay)::int = any (t.ngay_ap_dung)
                                    and private.tuan_la_hoc(v_campus, vn_week_start(ngay)))::int,
      (select ngay from luot l3 where l3.thuoc_id = p_thuoc and l3.student_id is null
         and l3.ngay between p_tu and p_den order by ngay desc, stt desc, created_at desc limit 1),
      (select gia_tri from luot l4 where l4.thuoc_id = p_thuoc and l4.student_id is null
         and l4.ngay between p_tu and p_den order by ngay desc, stt desc, created_at desc limit 1)
      into v_gia, v_dong, v_ghi, v_giu, v_ngay, v_gmoi
    from luot l where l.thuoc_id = p_thuoc and l.student_id is null and l.ngay between p_tu and p_den
      and (t.chieu_dich <> 'nhieu_nhat'
           or (private.tuan_la_hoc(v_campus, vn_week_start(l.ngay))
               and private.chi_tieu_tai(p_thuoc, vn_week_start(l.ngay)) is not null));
    select d0, t0 into v_dat, v_tt
      from private.tt_thuoc(t.gop, t.chieu_dich, v_gia, v_chi_tieu,
             case when t.gop = 'tong' then v_le_ra else null end,
             v_giu, v_apd, v_apd_qua, v_mo) as z(d0, t0);
    return query select v_gia, v_dong, v_ghi, v_apd, v_apd_qua, v_giu, v_tuan, v_chi_tieu,
      case when t.gop = 'tong' then v_le_ra else null end, v_dat, v_tt, v_ngay, v_gmoi,
      null::int, null::int, null::int;
    return;
  end if;

  foreach v_sid in array coalesce(v_students, '{}'::uuid[]) loop
    select
      case t.gop when 'tong' then sum(gia_tri)
                 when 'moi_nhat' then (select gia_tri from luot l2
                    where l2.thuoc_id = p_thuoc and l2.student_id = v_sid and l2.ngay between p_tu and p_den
                    order by ngay desc, stt desc, created_at desc limit 1)
                 when 'dem_dat_nguong' then count(*) filter (where gia_tri >= t.nguong_moi_lan) end,
      count(*)::int, count(distinct ngay)::int,
      count(distinct ngay) filter (where extract(isodow from ngay)::int = any (t.ngay_ap_dung)
                                    and private.tuan_la_hoc(v_campus, vn_week_start(ngay)))::int,
      (select ngay from luot l3 where l3.thuoc_id = p_thuoc and l3.student_id = v_sid
         and l3.ngay between p_tu and p_den order by ngay desc, stt desc, created_at desc limit 1),
      (select gia_tri from luot l4 where l4.thuoc_id = p_thuoc and l4.student_id = v_sid
         and l4.ngay between p_tu and p_den order by ngay desc, stt desc, created_at desc limit 1)
      into v_gia, v_dong, v_ghi, v_giu, v_ngay, v_gmoi
    from luot l where l.thuoc_id = p_thuoc and l.student_id = v_sid and l.ngay between p_tu and p_den
      and (t.chieu_dich <> 'nhieu_nhat'
           or (private.tuan_la_hoc(v_campus, vn_week_start(l.ngay))
               and private.chi_tieu_tai(p_thuoc, vn_week_start(l.ngay)) is not null));

    select d0, t0 into v_dat, v_tt
      from private.tt_thuoc(t.gop, t.chieu_dich, v_gia, v_chi_tieu,
             case when t.gop = 'tong' then v_le_ra else null end,
             v_giu, v_apd, v_apd_qua, v_mo) as z(d0, t0);

    if not v_agg then
      return query select v_gia, v_dong, v_ghi, v_apd, v_apd_qua, v_giu, v_tuan, v_chi_tieu,
        case when t.gop = 'tong' then v_le_ra else null end, v_dat, v_tt, v_ngay, v_gmoi,
        null::int, null::int, null::int;
      return;
    end if;

    a_dong := a_dong + coalesce(v_dong, 0);
    a_ghi := a_ghi + coalesce(v_ghi, 0);
    a_giu := a_giu + coalesce(v_giu, 0);
    if coalesce(v_dong, 0) > 0 then a_em_ghi := a_em_ghi + 1; end if;
    if v_dat then a_em_dat := a_em_dat + 1; end if;
    if t.gop = 'moi_nhat' then
      if v_gia is not null then a_msum := a_msum + v_gia; a_mcnt := a_mcnt + 1; end if;
    else
      if v_gia is not null then a_gia := a_gia + v_gia; a_gia_has := true; end if;
    end if;
    if v_ngay is not null and (a_ncuoi is null or v_ngay > a_ncuoi) then a_ncuoi := v_ngay; end if;
  end loop;

  if v_agg then
    return query select
      case when t.gop = 'moi_nhat' then (case when a_mcnt > 0 then a_msum / a_mcnt else null end)
           when t.gop = 'dem_dat_nguong' then a_gia
           else (case when a_gia_has then a_gia else null end) end,
      a_dong, a_ghi, v_apd, v_apd_qua, a_giu, v_tuan, v_chi_tieu,
      case when t.gop = 'tong' then v_le_ra else null end,
      null::boolean, null::text, a_ncuoi, null::numeric,
      coalesce(a_can, 0), a_em_ghi, a_em_dat;
  end if;
end $$;

-- Kẹp trần theo KỲ (30 §1.4): mỗi (em, kỳ) góp least(gia_em_ky, chi_tieu_day_du_ky) khi p_kep ∧
-- gop='tong' × it_nhat; nhieu_nhat/ca_doi không kẹp; moi_nhat → trung bình số cuối; dem → Σ.
create or replace function private.gop_thuoc_kep(p_thuoc uuid, p_tu date, p_den date, p_kep boolean)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  t thuoc%rowtype; v_students uuid[]; v_sid uuid; ky record; g numeric; v_dd numeric;
  v_sum numeric := 0; v_has boolean := false; v_msum numeric := 0; v_mcnt int := 0;
begin
  select * into t from thuoc where id = p_thuoc;
  if t.id is null then return null; end if;
  if t.pham_vi = 'ca_doi' then v_students := array[null::uuid];
  elsif t.chu_the = 'em' then v_students := array[t.student_id];
  elsif t.chu_the = 'lop' then
    select array_agg(e.student_id) into v_students from enrollments e
      where e.class_id = t.class_id and e.is_active;
  else
    select array_agg(v.student_id) into v_students from nhom_thanh_vien v
      where v.nhom_id = t.nhom_id and v.is_active;
  end if;

  if t.gop = 'moi_nhat' then                     -- nguồn duy nhất; không kẹp → trung bình em có dòng
    foreach v_sid in array coalesce(v_students, '{}'::uuid[]) loop
      select gt.gia into g from private.gia_thuoc(p_thuoc, p_tu, p_den, v_sid) gt;
      if g is not null then v_msum := v_msum + g; v_mcnt := v_mcnt + 1; end if;
    end loop;
    return case when v_mcnt = 0 then null else v_msum / v_mcnt end;
  end if;

  foreach v_sid in array coalesce(v_students, '{}'::uuid[]) loop
    for ky in
      with recursive w(kt) as (
        select private.ky_start(p_thuoc, p_tu)
        union all
        select (kt + 7 * t.ky_tuan)::date from w where (kt + 7 * t.ky_tuan)::date <= p_den
      )
      select w.kt as ky_tu, (w.kt + 7 * t.ky_tuan - 1)::date as ky_den from w
    loop
      select gt.gia into g
        from private.gia_thuoc(p_thuoc, greatest(ky.ky_tu, t.tu_tuan), ky.ky_den, v_sid) gt;
      if g is null then continue; end if;
      if p_kep and t.gop = 'tong' and t.chieu_dich = 'it_nhat' then
        select kc.chi_tieu_day_du into v_dd from private.ky_cua_thuoc(p_thuoc, ky.ky_tu) kc;
        v_sum := v_sum + least(g, coalesce(v_dd, g));
      else
        v_sum := v_sum + g;
      end if;
      v_has := true;
    end loop;
  end loop;
  return case when v_has then v_sum else null end;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. HÀM LÕI 2 — private.so_hien_tai (30 §2). Đệ quy qua con: p_sau > 3 → chốt.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.so_hien_tai(
  p_muc_tieu uuid, p_ky date default null, p_sau int default 0)
returns table (
  so numeric, nguon text, ngay_nguon date, so_nguon int,
  x numeric, y numeric, le_ra numeric, pct numeric, dat boolean, trang_thai text,
  ky_tu date, ky_den date, so_ky_giu int, so_ky_xet int, tu_so int, mau_so int)
language plpgsql stable security definer set search_path = public as $$
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
      where muc_tieu_id = m.id and thanh_phan_id is null and student_id is null
        and ngay between v_kytu and v_ky order by ngay desc, created_at desc limit 1;
    else
      select gia_tri, ngay into v_so, v_ngay from so_do
      where muc_tieu_id = m.id and thanh_phan_id is null and student_id is null
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
            and student_id is null and ngay between kk and kend order by ngay desc, created_at desc limit 1;
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
end $$;

-- Nội suy "lẽ ra tại d" theo NGÀY HỌC, có mốc trung gian (30 §2.4). x null → null.
create or replace function private.le_ra_diem(
  p_muc_tieu uuid, p_x numeric, p_y numeric, p_bat_dau date, p_ket_thuc date, p_d date, p_campus uuid)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare ngays date[]; gias numeric[]; i int; d0 date; d1 date; v0 numeric; v1 numeric; frac numeric; mau int;
begin
  if p_x is null or p_d is null or p_bat_dau is null or p_ket_thuc is null then return null; end if;
  ngays := array[p_bat_dau]; gias := array[p_x];
  for i in (select 1) loop null; end loop;   -- (giữ cấu trúc; mốc nạp bên dưới)
  for d0, v0 in select ngay, gia_tri from moc_muc_tieu
      where muc_tieu_id = p_muc_tieu and ngay > p_bat_dau and ngay < p_ket_thuc order by ngay
  loop ngays := ngays || d0; gias := gias || v0; end loop;
  ngays := ngays || p_ket_thuc; gias := gias || p_y;
  if p_d <= ngays[1] then return gias[1]; end if;
  if p_d >= ngays[array_length(ngays, 1)] then return gias[array_length(gias, 1)]; end if;
  for i in 1 .. array_length(ngays, 1) - 1 loop
    if p_d >= ngays[i] and p_d <= ngays[i + 1] then
      d0 := ngays[i]; d1 := ngays[i + 1]; v0 := gias[i]; v1 := gias[i + 1];
      mau := private.so_ngay_hoc(p_campus, d0, d1);
      if mau = 0 then return null; end if;
      frac := private.so_ngay_hoc(p_campus, d0, p_d)::numeric / mau;
      return v0 + (v1 - v0) * frac;
    end if;
  end loop;
  return null;
end $$;

-- Con của một ti_le_dat có "đạt" không (theo nguong_con hoặc dat) — dùng trong nhánh lay_tu.
create or replace function private.con_dat(p_child uuid, p_ky date, p_nguong numeric) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare sc record; v_chieu text;
begin
  select chieu into v_chieu from muc_tieu where id = p_child;
  select * into sc from private.so_hien_tai(p_child, p_ky, 0) sc;
  if p_nguong is not null then
    if sc.so is null then return false; end if;
    return case when v_chieu = 'giam' then sc.so <= p_nguong else sc.so >= p_nguong end;
  end if;
  return coalesce(sc.dat, false);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. GỢI Ý THẮNG/THUA — public.goi_y_cam_ket (30 §3, chốt C12). Definer, TỰ GÁC, trả null
--    khi người gọi không đọc được cam kết (và auth.uid() not null).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.goi_y_cam_ket(p_cam_ket uuid)
returns table (goi_y text, so_dat_goi_y numeric, thuoc_trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare
  c cam_ket%rowtype; t thuoc%rowtype; v_me uuid := (select auth.uid());
  v_tu date; v_den date; g record; v_goi text; v_tt text; v_sodat numeric; v_la_ban boolean;
begin
  select * into c from cam_ket where id = p_cam_ket;
  if c.id is null then return; end if;
  -- Tự gác: người gọi (đã đăng nhập) không đọc được cam kết → trả TOÀN null.
  if v_me is not null and not doc_duoc_cam_ket(p_cam_ket) then
    return query select null::text, null::numeric, null::text; return;
  end if;
  if c.trang_thai = 'huy' then return query select null::text, null::numeric, null::text; return; end if;

  v_tu := c.tuan_bat_dau; v_den := c.tuan_bat_dau + 7 * c.so_tuan - 1;

  if c.xong_at is not null then
    v_goi := 'thang';
  elsif c.thuoc_id is not null then
    select * into t from thuoc where id = c.thuoc_id;
    if c.chu_the = 'em' then
      select * into g from private.gia_thuoc(c.thuoc_id, v_tu, v_den, c.student_id) g;
      v_tt := g.trang_thai;
      if g.trang_thai in ('dat', 'dang_giu') then v_goi := 'thang';
      elsif g.trang_thai in ('truot', 'vuot') then v_goi := 'thua';
      else v_goi := null; end if;
    else                                   -- cam kết lớp/nhóm nối thước tung_em
      select * into g from private.gia_thuoc(c.thuoc_id, v_tu, v_den, null) g;
      v_tt := g.trang_thai;
      if v_den < coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today()) then
        if coalesce(g.so_em_dat, 0) = coalesce(g.so_em_can, 0) and coalesce(g.so_em_can, 0) > 0
          then v_goi := 'thang'; else v_goi := 'thua'; end if;
      else v_goi := null; end if;
    end if;
    -- so_dat_goi_y: chỉ khi cùng đơn vị; CHỈ trả cho chính em/PH/thầy cô (bạn cùng nhóm ẩn, [H-12]).
    if c.don_vi_id is not distinct from t.don_vi_id then
      v_la_ban := (c.chu_the = 'em' and v_me is distinct from c.student_id
                   and not (is_my_child(c.student_id) or staff_can_read_class(c.class_id))
                   and is_my_buddy(c.student_id));
      if not v_la_ban then v_sodat := g.gia; end if;
    end if;
  else
    v_goi := null;                          -- không thước → không gợi ý (kể cả có so_hua/so_dat)
  end if;

  return query select v_goi, v_sodat, v_tt;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. VIEW MÀN (invoker — dựa RLS bảng nền; L3 lặp lại security_invoker + revoke anon)
-- ─────────────────────────────────────────────────────────────────────────────────────
drop view if exists muc_tieu_v;
create view muc_tieu_v with (security_invoker = true) as
select m.*,
  dv.nhan_vi as ten_don_vi,
  -- Nhóm < 3 người: học sinh NGOÀI nhóm không thấy số (L7). Thầy cô/PH/thành viên vẫn thấy.
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.so end as so,
  h.nguon, h.ngay_nguon, h.so_nguon, h.x, h.y, h.le_ra,
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.pct end as pct,
  h.dat, h.trang_thai as trang_thai_do, h.ky_tu, h.ky_den, h.so_ky_giu, h.so_ky_xet, h.tu_so, h.mau_so
from muc_tieu m
left join don_vi dv on dv.id = m.don_vi_id
left join lateral private.so_hien_tai(m.id) h on true;
revoke all on muc_tieu_v from anon;
grant select on muc_tieu_v to authenticated;

drop view if exists cam_ket_v;
create view cam_ket_v with (security_invoker = true) as
select c.*,
  dv.nhan_vi as ten_don_vi,
  g.goi_y as goi_y_may,          -- gợi ý HIỆN TẠI của máy; c.goi_y là ẢNH CHỤP lúc chấm (khác tên)
  g.so_dat_goi_y
from cam_ket c
left join don_vi dv on dv.id = c.don_vi_id
left join lateral public.goi_y_cam_ket(c.id) g on true;
revoke all on cam_ket_v from anon;
grant select on cam_ket_v to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. HÀM MÀN (definer, TỰ GÁC ở WHERE cuối — sai vai 0 dòng)
-- ─────────────────────────────────────────────────────────────────────────────────────

-- "Việc em làm" — một dòng mỗi thước em phải ghi + thước ca_doi (cờ chi_xem), kỳ hiện tại.
create or replace function public.viec_bang(p_student uuid default null)
returns table (thuoc_id uuid, ten text, chu_the text, cach_ghi text, chieu_dich text,
  ky_tuan int, ten_don_vi text, ngay_ap_dung smallint[], cho_bu boolean, chi_xem boolean,
  ky_tu date, ky_den date, gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_hom_nay date;
begin
  v_student := coalesce(p_student, (select auth.uid()));
  if not (v_student = (select auth.uid()) or can_view_student(v_student)) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  return query
  select t.id, t.ten, t.chu_the, t.cach_ghi, t.chieu_dich, t.ky_tuan::int, dv.nhan_vi,
    t.ngay_ap_dung, t.cho_bu, (t.pham_vi = 'ca_doi'),
    kc.ky_tu, kc.ky_den, g.gia, g.chi_tieu, g.le_ra, g.dat, g.trang_thai
  from thuoc t
  left join don_vi dv on dv.id = t.don_vi_id
  cross join lateral private.ky_cua_thuoc(t.id, v_hom_nay) kc
  left join lateral private.gia_thuoc(t.id, kc.ky_tu, kc.ky_den, v_student) g on true
  where t.trang_thai = 'chay'
    and ( (t.pham_vi = 'tung_em' and (
              (t.chu_the = 'em' and t.student_id = v_student)
           or (t.chu_the = 'lop' and exists (select 1 from enrollments e
                 where e.class_id = t.class_id and e.student_id = v_student and e.is_active))
           or (t.chu_the = 'nhom' and em_trong_nhom(t.nhom_id, v_student))))
       or (t.pham_vi = 'ca_doi' and exists (select 1 from enrollments e
             where e.class_id = t.class_id and e.student_id = v_student and e.is_active)) );
end $$;

-- Băng rôn tuần này (30 §4.1).
create or replace function public.bang_ron(p_student uuid default null)
returns table (trang_thai text, viec_tong int, viec_dung_nhip int, ck_tong int, ck_giu int, ti_le numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_hom_nay date; v_w date; v_campus uuid; v_class uuid;
  v_vt int; v_vd int; v_ct int; v_cg int; v_r numeric; v_nghi boolean;
begin
  v_student := coalesce(p_student, (select auth.uid()));
  if not (v_student = (select auth.uid()) or can_view_student(v_student)) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(v_hom_nay);
  -- enrollments KHÔNG có cột created_at (id, class_id, student_id, is_active, is_attendance_leader).
  -- Mỗi em chỉ một dòng is_active nên limit 1 là đủ — theo đúng lối chuẩn của repo (0011/0012/0018…).
  select e.class_id, c.campus_id into v_class, v_campus
    from enrollments e join classes c on c.id = e.class_id
    where e.student_id = v_student and e.is_active limit 1;
  v_nghi := not private.tuan_la_hoc(v_campus, v_w);
  if v_nghi then
    return query select 'nghi'::text, 0, 0, 0, 0, null::numeric; return;
  end if;
  select count(*) filter (where vb.trang_thai <> 'mien'),
         count(*) filter (where vb.trang_thai in ('dat', 'dang_thang', 'dang_giu'))
    into v_vt, v_vd
  from public.viec_bang(v_student) vb where vb.chi_xem = false;
  select count(*), count(*) filter (where cv.ket_qua = 'thang'
             or (cv.ket_qua is null and cv.goi_y_may = 'thang'))
    into v_ct, v_cg
  from cam_ket_v cv
  where cv.chu_the = 'em' and cv.student_id = v_student and cv.trang_thai = 'hieu_luc'
    and v_w between cv.tuan_bat_dau and cv.tuan_ket_thuc;
  if coalesce(v_vt, 0) + coalesce(v_ct, 0) = 0 then
    return query select 'chua_co'::text, 0, 0, 0, 0, null::numeric; return;
  end if;
  v_r := (coalesce(v_vd, 0) + coalesce(v_cg, 0))::numeric / (coalesce(v_vt, 0) + coalesce(v_ct, 0));
  return query select
    case when v_r >= 1 then 'dang_thang' when v_r >= 0.5 then 'sat_nut' else 'can_co' end,
    coalesce(v_vt, 0), coalesce(v_vd, 0), coalesce(v_ct, 0), coalesce(v_cg, 0), round(v_r, 3);
end $$;

-- 12 tuần của một thước cho một chủ thể.
create or replace function public.thuoc_12_tuan(
  p_thuoc uuid, p_chu_the uuid default null, p_tuan_cuoi date default null)
returns table (tuan date, ky_tu date, ky_den date, la_tuan_hoc boolean,
  gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare v_hom_nay date; v_cuoi date; v_campus uuid; v_class uuid; v_pham text;
begin
  if not doc_duoc_thuoc(p_thuoc) then return; end if;
  select class_id, pham_vi into v_class, v_pham from thuoc where id = p_thuoc;
  if p_chu_the is not null
     and not (p_chu_the = (select auth.uid()) or is_my_child(p_chu_the) or staff_can_read_class(v_class)) then
    return;
  end if;
  if p_chu_the is null and v_pham <> 'ca_doi' and not staff_can_read_class(v_class) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_cuoi := vn_week_start(coalesce(p_tuan_cuoi, v_hom_nay));
  v_campus := (select campus_id from classes where id = v_class);
  return query
  select w.tuan, kc.ky_tu, kc.ky_den, private.tuan_la_hoc(v_campus, w.tuan),
    g.gia, g.chi_tieu, g.le_ra, g.dat, g.trang_thai
  from (select (v_cuoi - (n * 7))::date as tuan from generate_series(0, 11) n) w
  cross join lateral private.ky_cua_thuoc(p_thuoc, w.tuan) kc
  left join lateral private.gia_thuoc(p_thuoc, w.tuan, (w.tuan + 6)::date, p_chu_the) g on true
  order by w.tuan;
end $$;

-- Số ĐẾM lớp cho một thước (nhóm <3 học sinh → trung bình null; L7).
create or replace function public.thuoc_lop_dem(p_thuoc uuid, p_tuan date default null)
returns table (si_so int, so_em_ghi int, so_em_dat int, gia_lop numeric,
  chi_tieu numeric, le_ra numeric, mien boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_class uuid; v_hom_nay date; v_tuan date; v_hs boolean;
begin
  v_class := (select class_id from thuoc where id = p_thuoc);
  if not (is_class_student(v_class) or staff_can_read_class(v_class) or is_parent_of_class(v_class)) then
    return;
  end if;
  v_hs := is_class_student(v_class) and not staff_can_read_class(v_class) and not is_parent_of_class(v_class);
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_tuan := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select coalesce(g.so_em_can, 0), coalesce(g.so_em_ghi, 0), coalesce(g.so_em_dat, 0),
    case when v_hs and coalesce(g.so_em_can, 0) < 3 then null else g.gia end,
    g.chi_tieu, g.le_ra, (g.chi_tieu is null)
  from private.ky_cua_thuoc(p_thuoc, v_tuan) kc
  cross join lateral private.gia_thuoc(p_thuoc, kc.ky_tu, kc.ky_den, null) g;
end $$;

-- Số đếm lớp cho một mục tiêu.
create or replace function public.muc_tieu_lop_dem(p_muc_tieu uuid)
returns table (so_dat int, si_so int, so_huong_vao int)
language plpgsql stable security definer set search_path = public as $$
declare v_class uuid;
begin
  v_class := (select class_id from muc_tieu where id = p_muc_tieu);
  if not (is_class_student(v_class) or staff_can_read_class(v_class) or is_parent_of_class(v_class)) then
    return;
  end if;
  return query
  select
    (select count(*)::int from muc_tieu c where c.cap = 'em' and c.class_id = v_class
       and c.trang_thai = 'duyet'
       and exists (select 1 from noi n where n.con_muc_tieu_id = c.id and n.cha_id = p_muc_tieu)
       and (private.so_hien_tai(c.id)).dat),
    (select count(*)::int from enrollments e where e.class_id = v_class and e.is_active),
    (select count(*)::int from noi n join muc_tieu c on c.id = n.con_muc_tieu_id
       where n.cha_id = p_muc_tieu and c.cap = 'em');
end $$;

-- metrics theo tuần (thay metrics_tuan_v cũ).
create or replace function public.metrics_tuan(
  p_class uuid, p_tu date, p_den date default null, p_student uuid default null)
returns table (student_id uuid, week_start date, thuoc_tong int, thuoc_dat int, thuoc_mien int,
  ck_tong int, ck_thang int, ck_thua int, ck_chua_cham int, pdr_da_ky boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_den date; v_staff boolean; v_student uuid;
begin
  v_staff := staff_can_read_class(p_class);
  if v_staff then v_student := p_student;
  elsif is_class_student(p_class) then v_student := (select auth.uid());
  elsif p_student is not null and is_my_child(p_student) then v_student := p_student;
  else return; end if;
  v_den := coalesce(p_den, p_tu);
  return query
  with weeks as (
    select vn_week_start(gs::date) as w
    from generate_series(vn_week_start(p_tu)::timestamp, vn_week_start(v_den)::timestamp, interval '7 days') gs
  ),
  ems as (
    select e.student_id from enrollments e
    where e.class_id = p_class and e.is_active
      and (v_student is null or e.student_id = v_student)
  )
  select em.student_id, w.w,
    (select count(*)::int from public.viec_bang(em.student_id) vb where vb.chi_xem = false),
    (select count(*)::int from public.viec_bang(em.student_id) vb
       where vb.trang_thai in ('dat', 'dang_thang', 'dang_giu')),
    (select count(*)::int from public.viec_bang(em.student_id) vb where vb.trang_thai = 'mien'),
    (select count(*)::int from cam_ket c where c.student_id = em.student_id and c.trang_thai = 'hieu_luc'
       and w.w between c.tuan_bat_dau and c.tuan_ket_thuc),
    (select count(*)::int from cam_ket c where c.student_id = em.student_id and c.trang_thai = 'hieu_luc'
       and w.w between c.tuan_bat_dau and c.tuan_ket_thuc and c.ket_qua = 'thang'),
    (select count(*)::int from cam_ket c where c.student_id = em.student_id and c.trang_thai = 'hieu_luc'
       and w.w between c.tuan_bat_dau and c.tuan_ket_thuc and c.ket_qua = 'thua'),
    (select count(*)::int from cam_ket c where c.student_id = em.student_id and c.trang_thai = 'hieu_luc'
       and w.w between c.tuan_bat_dau and c.tuan_ket_thuc and c.ket_qua is null),
    pdr_da_ky(em.student_id, w.w)
  from ems em cross join weeks w;
end $$;

-- Bảng lớp của thầy cô — mỗi em một dòng.
create or replace function public.bang_lop_em(p_class uuid, p_tuan date default null)
returns table (student_id uuid, ho_ten text, thuoc_tong int, thuoc_dat int,
  ck_tong int, ck_thang int, mt_tong int, pdr_da_ky boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_hom_nay date; v_w date;
begin
  if not staff_can_read_class(p_class) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select e.student_id, p.full_name,
    (select count(*)::int from public.viec_bang(e.student_id) vb where vb.chi_xem = false),
    (select count(*)::int from public.viec_bang(e.student_id) vb
       where vb.trang_thai in ('dat', 'dang_thang', 'dang_giu')),
    (select count(*)::int from cam_ket c where c.student_id = e.student_id and c.trang_thai = 'hieu_luc'
       and v_w between c.tuan_bat_dau and c.tuan_ket_thuc),
    (select count(*)::int from cam_ket c where c.student_id = e.student_id and c.trang_thai = 'hieu_luc'
       and v_w between c.tuan_bat_dau and c.tuan_ket_thuc and c.ket_qua = 'thang'),
    (select count(*)::int from muc_tieu m where m.cap = 'em' and m.student_id = e.student_id
       and m.class_id = p_class and m.trang_thai = 'duyet'),
    pdr_da_ky(e.student_id, v_w)
  from enrollments e join profiles p on p.id = e.student_id
  where e.class_id = p_class and e.is_active;
end $$;

-- Bảng thước lớp/nhóm của thầy cô.
create or replace function public.bang_lop_thuoc(p_class uuid, p_tuan date default null)
returns table (thuoc_id uuid, ten text, chu_the text, gia_lop numeric, so_em_ghi int,
  so_em_dat int, si_so int, le_ra numeric, trang_thai text, mien boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_hom_nay date; v_w date;
begin
  if not staff_can_read_class(p_class) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select t.id, t.ten, t.chu_the, g.gia, coalesce(g.so_em_ghi, 0), coalesce(g.so_em_dat, 0),
    coalesce(g.so_em_can, 0), g.le_ra,
    case when g.chi_tieu is null then 'mien'
         when coalesce(g.so_em_can, 0) > 0 and coalesce(g.so_em_dat, 0) = g.so_em_can then 'dat'
         else 'dang_lam' end,
    (g.chi_tieu is null)
  from thuoc t
  cross join lateral private.ky_cua_thuoc(t.id, v_w) kc
  left join lateral private.gia_thuoc(t.id, kc.ky_tu, kc.ky_den, null) g on true
  where t.class_id = p_class and t.chu_the in ('lop', 'nhom') and t.pham_vi = 'tung_em'
    and t.trang_thai <> 'dong';
end $$;

-- Tỉ lệ em tự đặt mục tiêu (loại nguoi_nhap_ho).
create or replace function public.ty_le_em_tu_dat(p_class uuid)
returns table (so_muc_tieu int, so_tu_dat int, so_nhap_ho int, ty_le numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not staff_can_read_class(p_class) then return; end if;
  return query
  select count(*)::int,
    count(*) filter (where m.nguoi_nhap_ho is null)::int,
    count(*) filter (where m.nguoi_nhap_ho is not null)::int,
    round(100.0 * count(*) filter (where m.nguoi_nhap_ho is null) / nullif(count(*), 0), 1)
  from muc_tieu m where m.cap = 'em' and m.class_id = p_class and m.trang_thai = 'duyet';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. THI ĐUA — ba số tách (30 §4.2). private.thi_dua_ba_so KHÔNG gác (dùng chung cho
--    thi_dua_lop có gác và class_competition_scores tính-cho-mọi-lớp).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.thi_dua_ba_so(p_class uuid)
returns table (diem_muc_tieu numeric, diem_thuoc numeric, diem_cam_ket numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_hom_nay date; v_tu date; v_den date; v_dmt numeric; v_dth numeric; v_dck numeric;
begin
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_den := (vn_week_start(v_hom_nay) - 1)::date;      -- hết tuần đã đóng gần nhất
  v_tu := (vn_week_start(v_hom_nay) - 28)::date;      -- 4 tuần đã đóng

  select round(avg(h.pct) * 100, 1) into v_dmt
  from muc_tieu m cross join lateral private.so_hien_tai(m.id, v_hom_nay) h
  where m.cap = 'lop' and m.class_id = p_class and m.trang_thai = 'duyet'
    and m.kieu_dich in ('toi', 'toc_do_ky', 'ti_le_dat') and h.pct is not null;

  with dsach as (
    select t.id as thuoc_id, e.student_id
    from thuoc t join enrollments e on e.class_id = t.class_id and e.is_active
    where t.class_id = p_class and t.chu_the in ('lop', 'nhom') and t.pham_vi = 'tung_em'
      and t.trang_thai <> 'dong' and (t.chu_the = 'lop' or em_trong_nhom(t.nhom_id, e.student_id))
    union all
    select t.id, t.student_id from thuoc t
    where t.class_id = p_class and t.chu_the = 'em' and t.trang_thai <> 'dong'
  ),
  kys as (
    select distinct d.thuoc_id, d.student_id, k.ky_tu, k.ky_den
    from dsach d
    cross join lateral generate_series(v_tu::timestamp, v_den::timestamp, interval '7 days') w
    cross join lateral private.ky_cua_thuoc(d.thuoc_id, w::date) k
  ),
  o as (
    select g.dat, g.trang_thai
    from kys ky cross join lateral private.gia_thuoc(ky.thuoc_id, ky.ky_tu, ky.ky_den, ky.student_id) g
    where ky.ky_den between v_tu and v_den
  )
  select round(100.0 * count(*) filter (where dat)
               / nullif(count(*) filter (where trang_thai not in ('mien', 'chua_biet')), 0), 1)
    into v_dth from o;

  select round(100.0 * sum((c.ket_qua = 'thang')::int) / nullif(count(*), 0), 1) into v_dck
  from cam_ket c
  where c.class_id = p_class and c.trang_thai = 'hieu_luc' and c.ket_qua is not null
    and c.tuan_ket_thuc between v_tu and v_den;

  return query select v_dmt, v_dth, v_dck;
end $$;

create or replace function public.thi_dua_lop(p_class uuid)
returns table (diem_muc_tieu numeric, diem_thuoc numeric, diem_cam_ket numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_class_student(p_class) or is_parent_of_class(p_class) or staff_can_read_class(p_class)) then
    return;
  end if;
  return query select * from private.thi_dua_ba_so(p_class);
end $$;

-- Tổng hợp cơ sở cho BGH (30 §4).
create or replace function public.co_so_tong_hop(p_tuan date default null)
returns table (class_id uuid, class_name text, grade_name text, grade_sort int, gvcn_ten text,
  si_so int, mt_lop_duyet int, mt_pct numeric, mt_lop_dang_thang int, mt_lop_can_co int,
  thuoc_dat_pct numeric, ck_giu_pct numeric, pdr_ky_pct numeric, cho_duyet int)
language plpgsql stable security definer set search_path = public as $$
declare v_hom_nay date; v_w date;
begin
  if not ((select auth_role()) = 'admin'
          or ((select auth_role()) = 'principal')) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select c.id, c.name, coalesce(g.name, c.grade, '—'), coalesce(g.sort_order, 9999)::int,
    pr.full_name,
    (select count(*)::int from enrollments e where e.class_id = c.id and e.is_active),
    (select count(*)::int from muc_tieu m where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'duyet'),
    (select round(avg(h.pct) * 100, 1) from muc_tieu m
       cross join lateral private.so_hien_tai(m.id, v_hom_nay) h
       where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'duyet' and h.pct is not null),
    (select count(*)::int from muc_tieu m
       cross join lateral private.so_hien_tai(m.id, v_hom_nay) h
       where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'duyet' and h.trang_thai = 'dang_thang'),
    (select count(*)::int from muc_tieu m
       cross join lateral private.so_hien_tai(m.id, v_hom_nay) h
       where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'duyet' and h.trang_thai = 'can_co'),
    (select td.diem_thuoc from private.thi_dua_ba_so(c.id) td),
    (select td.diem_cam_ket from private.thi_dua_ba_so(c.id) td),
    (select round(100.0 * count(*) filter (where pdr_da_ky(e.student_id, v_w))
               / nullif(count(*), 0), 1)
       from enrollments e where e.class_id = c.id and e.is_active),
    ((select count(*)::int from muc_tieu m where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'gui')
     + (select count(*)::int from thuoc t where t.class_id = c.id and t.duyet = 'gui' and t.trang_thai <> 'dong'))
  from classes c
  left join grades g on g.id = c.grade_id
  left join profiles pr on pr.id = c.homeroom_teacher_id
  where c.is_active and c.school_year = current_school_year()
    and ((select auth_role()) = 'admin' or c.campus_id = (select auth_campus()));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 7. VIẾT LẠI HÀM SỐNG (md5 guard — chấp nhận chạy lại; giữ NGUYÊN chữ ký). Thân cũ chép vào
--    chú thích cuối tệp để lùi (§8 50-DI-TRU). score = trung bình các số không null của ba điểm.
-- ─────────────────────────────────────────────────────────────────────────────────────
do $guard$
declare v text := md5(pg_get_functiondef('public.class_competition_scores()'::regprocedure));
begin
  if v = 'CHUA_TINH_MD5_MOI' then raise notice '0166: class_competition_scores đã là bản PA2';
  elsif v <> '2f611dff248388e1ec29926b979205a7' then
    raise exception '0166: class_competition_scores trên production đã khác bản đọc 01/09 (%). Đọc lại pg_proc trước khi đè', v;
  end if;
end $guard$;

create or replace function public.class_competition_scores()
returns table (class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.campus_id, c.grade,
    case when c.grade ~ '^[0-9]+$' then
      case when c.grade::int between 1 and 5 then 'primary'
           when c.grade::int between 6 and 9 then 'secondary'
           else 'high' end
      else 'unknown' end,
    coalesce(round((
      select avg(x) from unnest(array[td.diem_muc_tieu, td.diem_thuoc, td.diem_cam_ket]) x
      where x is not null
    ), 1), 0)
  from classes c
  cross join lateral private.thi_dua_ba_so(c.id) td
  where c.school_year = current_school_year() and c.is_active;
$fn$;

do $guard$
declare v text := md5(pg_get_functiondef('public.campus_rollup()'::regprocedure));
begin
  if v = 'CHUA_TINH_MD5_MOI' then raise notice '0166: campus_rollup đã là bản PA2';
  elsif v <> 'd24e8eeb6a8c9301b9b28eb1233ee4a0' then
    raise exception '0166: campus_rollup trên production đã khác bản đọc 01/09 (%). Đọc lại pg_proc trước khi đè', v;
  end if;
end $guard$;

create or replace function public.campus_rollup()
returns table (class_id uuid, class_name text, school_year text, grade_id uuid, grade_name text,
  grade_sort integer, score numeric, att_today bigint, student_count bigint, wig_count bigint)
language sql stable security definer set search_path = public as $fn$
  with scores as (select * from class_competition_scores()),
  att as (select class_id, count(*) as n from attendance_records where date = vn_today() group by class_id),
  enr as (select class_id, count(*) as n from enrollments where is_active group by class_id),
  -- wig_count := số MỤC TIÊU cấp lớp đã DUYỆT (thay wigs cũ) — 30 §4.
  wig as (select m.class_id, count(*) as n from muc_tieu m
          where m.cap = 'lop' and m.trang_thai = 'duyet' group by m.class_id)
  select c.id, c.name, c.school_year, c.grade_id,
         coalesce(g.name, c.grade, '—'), coalesce(g.sort_order, 9999),
         coalesce(s.score, 0), coalesce(att.n, 0), coalesce(enr.n, 0), coalesce(wig.n, 0)
  from classes c
  left join grades g on g.id = c.grade_id
  left join scores s on s.class_id = c.id
  left join att on att.class_id = c.id
  left join enr on enr.class_id = c.id
  left join wig on wig.class_id = c.id
  where c.school_year = current_school_year() and c.is_active
    and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  order by coalesce(g.sort_order, 9999), c.name;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 8. ACL (L2/L12). Hai hàm lõi + helper private = revoke ĐỦ ba vai (chỉ hàm/view đã gác gọi).
--    Hàm màn public = revoke public/anon, grant authenticated. goi_y_cam_ket revoke/grant ở
--    khối grant của 0165 (20 §1.5) — ở đây lặp lại cho chắc (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────────────
do $acl$
declare f text;
begin
  foreach f in array array[
    'private.so_tuan_ky(text)', 'private.tuan_la_hoc(uuid,date)', 'private.so_ngay_hoc(uuid,date,date)',
    'private.chi_tieu_tai(uuid,date)', 'private.ky_start(uuid,date)', 'private.ky_cua_thuoc(uuid,date)',
    'private.tt_thuoc(text,text,numeric,numeric,numeric,int,int,int,boolean)',
    'private.gia_thuoc(uuid,date,date,uuid)', 'private.gop_thuoc_kep(uuid,date,date,boolean)',
    'private.so_hien_tai(uuid,date,int)', 'private.le_ra_diem(uuid,numeric,numeric,date,date,date,uuid)',
    'private.con_dat(uuid,date,numeric)', 'private.thi_dua_ba_so(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.goi_y_cam_ket(uuid)', 'public.viec_bang(uuid)', 'public.bang_ron(uuid)',
    'public.thuoc_12_tuan(uuid,uuid,date)', 'public.thuoc_lop_dem(uuid,date)',
    'public.muc_tieu_lop_dem(uuid)', 'public.metrics_tuan(uuid,date,date,uuid)',
    'public.bang_lop_em(uuid,date)', 'public.bang_lop_thuoc(uuid,date)', 'public.ty_le_em_tu_dat(uuid)',
    'public.co_so_tong_hop(date)', 'public.thi_dua_lop(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $acl$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- THÂN CŨ (chép để LÙI — pa2-lui-nen.sql đọc từ đây; §8 50-DI-TRU). KHÔNG chạy.
-- class_competition_scores() cũ: score theo wigs (measure_by manual / quang_duong / wig_actual).
-- campus_rollup() cũ: wig_count = count wigs scope='class' period='year'. Đầy đủ ở pg_proc 01/09,
-- md5 2f611dff248388e1ec29926b979205a7 / d24e8eeb6a8c9301b9b28eb1233ee4a0.
-- ═══════════════════════════════════════════════════════════════════════════════════
