-- 0185 — MỘT CAM KẾT CÓ NHIỀU THƯỚC ĐO DẪN DẮT (chủ dự án chốt 04/09/2026)
--
-- Trước giờ dây cam kết ↔ thước là 1-1 qua cam_ket.thuoc_id. Đảo chiều: thước TRỎ VỀ cam kết
-- qua thuoc.cam_ket_id (n-1) — một cam kết treo bao nhiêu thước tuỳ (trần ≤4 thước/em ở
-- th_kiem_tran vẫn là phanh tổng). cam_ket.thuoc_id GIỮ NGUYÊN cột (nó nằm trong cột generated
-- lac_muc_tieu và dữ liệu cũ) nhưng từ nay THÔI GHI — mọi luồng mới đi qua thuoc.cam_ket_id.
-- Trần 2 cam kết/tuần giữ nguyên (không đụng ck_kiem_tran_tuan).
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef trên production (04/09/2026) trước khi đè:
--   lan_cam_ket_tuan = bản 0177 · goi_y_cam_ket = bản 0166 · viec_bang = bản 0179 —
--   cả ba trùng repo, không có vá lệch. ck_truoc_them (0181) KHÔNG đụng (giữ neo thuoc_id cũ).

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Cột mới + backfill. Xoá cam kết là chùm thước rụng theo (cascade) — đúng nghĩa
--    "thước sinh ra để phục vụ cam kết ấy".
-- ─────────────────────────────────────────────────────────────────────────────────────
alter table thuoc add column if not exists cam_ket_id uuid null references cam_ket(id) on delete cascade;
create index if not exists idx_thuoc_cam_ket on thuoc (cam_ket_id) where cam_ket_id is not null;

-- Backfill: MỘT thước có thể được nhiều bản-tuần cam kết trỏ tới (con lăn 0177 clone giữ nguyên
-- thuoc_id) → gắn thước vào bản MỚI NHẤT của dòng, không phải bản bất kỳ.
update thuoc t
set cam_ket_id = c.id
from (
  select distinct on (thuoc_id) id, thuoc_id
  from cam_ket
  where thuoc_id is not null
  order by thuoc_id, tuan_bat_dau desc, created_at desc
) c
where c.thuoc_id = t.id and t.cam_ket_id is null;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Neo cùng chủ thể — trigger RIÊNG phía thuoc (không đụng th_truoc_them/sua đang chạy):
--    thước trỏ vào cam kết thì cam kết phải cùng lớp, và thước của ai thì cam kết của người đó.
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.th_neo_cam_ket() returns trigger
language plpgsql security definer set search_path = public as $$
declare c cam_ket%rowtype;
begin
  if new.cam_ket_id is null then return new; end if;
  select * into c from cam_ket where id = new.cam_ket_id;
  if c.id is null then
    raise exception 'Không thấy cam kết để gắn thước đo' using errcode = '23503';
  end if;
  if c.class_id is distinct from new.class_id
     or (new.chu_the = 'em' and (c.chu_the <> 'em' or c.student_id is distinct from new.student_id)) then
    raise exception 'Thước đo phải gắn vào cam kết của chính mình' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_th_neo_cam_ket on thuoc;
create trigger trg_th_neo_cam_ket before insert or update of cam_ket_id on thuoc
  for each row execute function private.th_neo_cam_ket();

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. lan_cam_ket_tuan — clone cam kết sang tuần mới rồi RE-POINT CẢ CHÙM thước theo.
--    (Bản live = 0177. Đổi: viết vòng lặp để lấy id bản clone; thuoc_id trên clone = null —
--    dây đi bằng cam_ket_id từ nay; cam kết vẫn lăn dù đã hết thước.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.lan_cam_ket_tuan() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_mon date := date_trunc('week', vn_today())::date;   -- thứ Hai tuần này (ISO week bắt đầu T2)
  v_n   int := 0;
  l     record;
  v_moi uuid;
begin
  for l in
    with latest as (
      -- Bản MỚI NHẤT của mỗi dòng (em × mục tiêu). Mục tiêu null → gộp bằng một uuid mốc.
      select distinct on (c.student_id, coalesce(c.muc_tieu_id, '00000000-0000-0000-0000-000000000000'::uuid))
             c.id, c.class_id, c.student_id, c.noi_dung, c.so_hua, c.don_vi_id, c.muc_tieu_id,
             c.trang_thai, c.tuan_ket_thuc
      from cam_ket c
      where c.chu_the = 'em' and c.student_id is not null
      order by c.student_id,
               coalesce(c.muc_tieu_id, '00000000-0000-0000-0000-000000000000'::uuid),
               c.tuan_bat_dau desc, c.created_at desc
    )
    select * from latest
    where trang_thai = 'hieu_luc'                 -- bản mới nhất còn hiệu lực (chưa bị xoá→huỷ)
      and tuan_ket_thuc < v_mon                   -- đã kết thúc (cần lăn tiếp; bắt kịp cả tuần lỡ)
  loop
    insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id, thuoc_id)
    values ('em', l.class_id, l.student_id, l.noi_dung, l.so_hua, l.don_vi_id, 1, v_mon, l.muc_tieu_id, null)
    returning id into v_moi;
    -- Chùm thước còn sống đi theo cam kết tuần mới; thước đã kết thúc (dong) ở lại quá khứ.
    update thuoc set cam_ket_id = v_moi where cam_ket_id = l.id and trang_thai <> 'dong';
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

comment on function lan_cam_ket_tuan() is
  'Thứ Hai đầu tuần: clone cam kết của em từ tuần trước sang tuần này rồi re-point cả chùm thước '
  '(thuoc.cam_ket_id) theo. Em xoá (huy) bản tuần này = đứt dòng → tự ngừng. Idempotent.';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. goi_y_cam_ket — nhiều thước: "có vẻ Thắng" khi TẤT CẢ thước còn chạy của cam kết đạt;
--    một cái trượt là "có vẻ Thua"; đang giữa chừng → im lặng. so_dat_goi_y lấy từ thước
--    CÙNG ĐƠN VỊ với cam kết (cái tạo sớm nhất, nếu có).
--    (Bản live = 0166. Nhánh lớp/nhóm cũ giữ NGUYÊN VĂN — dữ liệu cũ vẫn đọc đúng.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.goi_y_cam_ket(p_cam_ket uuid)
returns table (goi_y text, so_dat_goi_y numeric, thuoc_trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare
  c cam_ket%rowtype; t thuoc%rowtype; v_me uuid := (select auth.uid());
  v_tu date; v_den date; g record; v_goi text; v_tt text; v_sodat numeric; v_la_ban boolean;
  v_co_thuoc boolean := false; v_co_thua boolean := false; v_co_lung boolean := false;
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

  elsif c.chu_the = 'em' then
    -- 0185: quét CẢ CHÙM thước (thuoc.cam_ket_id; dữ liệu cũ đã backfill nên phủ hết).
    for t in
      select * from thuoc
      where cam_ket_id = c.id and trang_thai <> 'dong'
      order by created_at
    loop
      v_co_thuoc := true;
      select * into g from private.gia_thuoc(t.id, v_tu, v_den, c.student_id) g;
      if v_tt is null then v_tt := g.trang_thai; end if;          -- trạng thái thước ĐẦU (giữ chỗ cũ)
      if g.trang_thai in ('truot', 'vuot') then v_co_thua := true;
      elsif g.trang_thai not in ('dat', 'dang_giu') then v_co_lung := true;   -- mien/chua_biet/đang giữa chừng
      end if;
      -- so_dat_goi_y: thước cùng đơn vị ĐẦU TIÊN.
      if v_sodat is null and c.don_vi_id is not distinct from t.don_vi_id then v_sodat := g.gia; end if;
    end loop;
    if not v_co_thuoc then v_goi := null;                         -- không thước → không gợi ý
    elsif v_co_thua then v_goi := 'thua';
    elsif v_co_lung then v_goi := null;                           -- chưa ngã ngũ → im lặng
    else v_goi := 'thang'; end if;                                -- TẤT CẢ đạt/đang giữ
    -- Bạn cùng nhóm không thấy số ([H-12]) — giữ nguyên luật cũ.
    if v_sodat is not null then
      v_la_ban := (v_me is distinct from c.student_id
                   and not (is_my_child(c.student_id) or staff_can_read_class(c.class_id))
                   and is_my_buddy(c.student_id));
      if v_la_ban then v_sodat := null; end if;
    end if;

  elsif c.thuoc_id is not null then
    -- Nhánh LỚP/NHÓM cũ (dữ liệu trước 03/09) — nguyên văn bản 0166.
    select * into t from thuoc where id = c.thuoc_id;
    select * into g from private.gia_thuoc(c.thuoc_id, v_tu, v_den, null) g;
    v_tt := g.trang_thai;
    if v_den < coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today()) then
      if coalesce(g.so_em_dat, 0) = coalesce(g.so_em_can, 0) and coalesce(g.so_em_can, 0) > 0
        then v_goi := 'thang'; else v_goi := 'thua'; end if;
    else v_goi := null; end if;
    if c.don_vi_id is not distinct from t.don_vi_id then v_sodat := g.gia; end if;
  else
    v_goi := null;                          -- không thước → không gợi ý (kể cả có so_hua/so_dat)
  end if;

  return query select v_goi, v_sodat, v_tt;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. viec_bang — thêm cột cam_ket_id để màn của em bày ĐÚNG chùm thước dưới từng cam kết.
--    (Bản live = 0179; DROP vì đổi chữ ký trả về — thêm cột CUỐI, các cột cũ giữ nguyên chỗ.)
-- ─────────────────────────────────────────────────────────────────────────────────────
drop function if exists public.viec_bang(uuid);
create function public.viec_bang(p_student uuid default null)
returns table (
  thuoc_id uuid, ten text, chu_the text, cach_ghi text, chieu_dich text, ky_tuan int,
  ten_don_vi text, don_vi_id uuid, ngay_ap_dung smallint[], cho_bu boolean, chi_xem boolean,
  ky_tu date, ky_den date, gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text,
  cam_ket_id uuid
) language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_hom_nay date;
begin
  v_student := coalesce(p_student, (select auth.uid()));
  if not (v_student = (select auth.uid()) or can_view_student(v_student)) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  return query
  select t.id, t.ten, t.chu_the, t.cach_ghi, t.chieu_dich, t.ky_tuan::int, dv.nhan_vi, t.don_vi_id,
    t.ngay_ap_dung, t.cho_bu, (t.pham_vi = 'ca_doi'),
    kc.ky_tu, kc.ky_den, g.gia, g.chi_tieu, g.le_ra, g.dat, g.trang_thai,
    t.cam_ket_id
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
revoke all on function public.viec_bang(uuid) from anon;      -- y hệt 0179 — không đổi mặt quyền
grant execute on function public.viec_bang(uuid) to authenticated;
