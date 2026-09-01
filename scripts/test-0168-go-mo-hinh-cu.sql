-- GỠ MÔ HÌNH MỤC TIÊU CŨ (0168) — npm run sql -- scripts/test-0168-go-mo-hinh-cu.sql — tự rollback
--
-- 0168 là tệp CHỈ DROP, nên phép kiểm ba mặt (CLAUDE.md §6 / 60-KIEM §0.5) đọc thế này:
--   · chiều ngược = ẢNH TRƯỚC DROP: bảng/view/hàm/publication cũ PHẢI CÒN. Nếu ai bỏ khối drop
--     ở giữa, mấy dòng "SAU DROP … mất" lật sang HỎNG ngay — một phép kiểm luôn xanh là vô dụng.
--   · đường vui = drop chạy SẠCH (đúng thứ tự an toàn view→bảng→hàm) và mọi thứ cũ MẤT.
--   · giữ không gãy = điểm danh, PDR (pdr_meetings), Hub outbox, scoreboard_entries, buddy_pairs,
--     pdr_schedules còn nguyên; 4 hàm thi đua (0166 giữ) + enum wig_domain/score_category còn;
--     đóng vai EM đọc bảng giữ KHÔNG lỗi; outbox vẫn ghi được sau drop.
--
-- Toàn bộ chạy trong MỘT transaction rollback — không byte nào bị ghi lên production. DROP lấy
-- ACCESS EXCLUSIVE trong khoảnh khắc rồi nhả khi rollback; lock_timeout 3s để không treo bảng
-- production nếu có ai đang đọc (chạy ở cửa sổ chặng ⑤, khi app đã thôi đọc bảng cũ). Bài này
-- BỔ SUNG cho test-pa2-khong-con-gi-tro-toi.sql (bài kia đo count quanh lần chạy 0168 thật; bài
-- này chứng minh chính khối drop THỰC THI ĐƯỢC và phần GIỮ sống sót — trong một transaction).
begin;
set local lock_timeout = '3s';
set local statement_timeout = '90s';

create table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

-- Một em trong lớp Test để đóng vai (không bắt buộc: thiếu thì phần đóng vai ghi BỎ QUA, không HỎNG)
create table ai as
select c.id as lop,
       (select e.student_id from enrollments e join profiles p on p.id = e.student_id
        where e.class_id = c.id and e.is_active and p.role = 'student' order by p.email limit 1) as em
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on ket_qua, ai to authenticated;

-- ═══ Danh sách tên cũ, gom một chỗ để đếm trước/sau bằng cùng bộ tên ═══
create temporary table ten_cu (loai text, nsp text, ten text, sig text);
create table _bang_cu (ten text);
insert into _bang_cu values ('wigs'),('commitments'),('lead_measures'),('lead_progress'),
  ('wig_so_do'),('wig_meetings'),('wig_meeting_notes'),('student_reflections'),('buddy_messages');
create table _view_cu (ten text);
insert into _view_cu values ('wig_progress_v'),('lead_tuan_v'),('metrics_tuan_v');
create table _ham_pub_cu (ten text);
insert into _ham_pub_cu values ('cam_ket_goi_y'),('child_class_progress'),('child_week_report'),
  ('child_weeks'),('class_lead_board'),('class_tick_matrix'),('cuon_so_lieu_lop'),('cuon_so_lieu'),
  ('cuon_dem'),('em_dat_du'),('lop_dat_du'),('wig_dat'),('so_do_moi_nhat'),('hs_ghi_bien_ban'),
  ('hs_tham_gia'),('mo_phong_hop'),('phong_dang_mo'),('lead_class'),('wig_class'),('wig_student'),
  ('lead_day_ok'),('lead_measure_canh_bao'),('pdr_bang'),('school_wig_rollup'),('tuan_da_chot'),
  ('tuan_da_hop'),('tick_open'),('kieu_don_vi'),('notify_student_meeting'),
  ('wig_meeting_note_dung_lop'),('ty_le_cuon');
create table _ham_priv_cu (ten text);
insert into _ham_priv_cu values ('cam_ket_hop_le'),('cam_ket_trang_thai'),('chan_qua_hai_cam_ket'),
  ('chi_em_va_bgh_sua_cam_ket'),('dem_lan_sua_cam_ket'),('khoa_sau_khi_chot'),('chan_qua_hai_viec'),
  ('chan_qua_muoi_viec'),('lead_theo_cam_ket'),('viec_em_sua_thi_cam_ket_cho_duyet'),
  ('chan_luong_vo_ly'),('hub_hang_doi_tick_dan_dat'),('tick_dung_thu'),('bien_ban_dien_ngay'),
  ('so_do_chi_cho_dich_ngoai'),('wig_so_do_cham_gio'),('chan_wig_lop_thu_nam'),('chan_em_tu_duyet'),
  ('chi_em_va_bgh_sua_muc_tieu'),('dong_bo_area_cam_ket'),('noi_muc_tieu_len_lop'),
  ('wig_em_sua_thi_cho_duyet'),('wig_lop_qua_tay_bgh'),('wig_actual'),('wig_actual_so');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- CHIỀU NGƯỢC — ẢNH TRƯỚC DROP: cũ PHẢI CÒN (nếu đã 0 thì check "SAU" vô nghĩa → bắt tại đây)
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into ket_qua
select 'TRƯỚC: 9 bảng cũ còn', '9', count(*)::text, count(*) = 9
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r' and c.relname in (select ten from _bang_cu);

insert into ket_qua
select 'TRƯỚC: 3 view cũ còn', '3', count(*)::text, count(*) = 3
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'v' and c.relname in (select ten from _view_cu);

insert into ket_qua
select 'TRƯỚC: đủ 32 hàm public cũ còn', '32', count(*)::text, count(*) = 32
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in (select ten from _ham_pub_cu);

insert into ket_qua
select 'TRƯỚC: đủ 25 hàm private cũ còn', '25', count(*)::text, count(*) = 25
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
where p.proname in (select ten from _ham_priv_cu);

insert into ket_qua
select 'TRƯỚC: wig_meetings trong publication realtime', '1', count(*)::text, count(*) = 1
from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'wig_meetings';

-- ═══════════════════════════════════════════════════════════════════════════════════
-- ĐƯỜNG VUI — CHẠY KHỐI DROP CỦA 0168 (đúng thứ tự an toàn: outbox → publication → view →
-- bảng cascade → hàm public → hàm private). Bọc thu() để "chạy sạch" thành một dòng ĐẠT/HỎNG.
-- ═══════════════════════════════════════════════════════════════════════════════════
do $$
declare v_loi text := null;
begin
  update hub_event_outbox set status = 'failed', last_error = '0168 test'
   where source_table = 'lead_progress' and status = 'pending';

  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wig_meetings')
  then alter publication supabase_realtime drop table wig_meetings; end if;

  drop view if exists public.metrics_tuan_v;
  drop view if exists public.lead_tuan_v;
  drop view if exists public.wig_progress_v;

  drop table if exists
    buddy_messages, wig_meeting_notes, wig_so_do, lead_progress, lead_measures,
    commitments, wig_meetings, wigs, student_reflections cascade;

  drop function if exists
    public.cam_ket_goi_y(uuid), public.child_class_progress(uuid), public.child_week_report(uuid, text),
    public.child_weeks(uuid), public.class_lead_board(uuid, date, uuid), public.class_tick_matrix(uuid, date),
    public.cuon_so_lieu_lop(uuid), public.cuon_so_lieu(uuid[]), public.cuon_dem(uuid),
    public.em_dat_du(uuid, uuid, integer, date, date), public.lop_dat_du(uuid, integer, date, date),
    public.wig_dat(uuid), public.so_do_moi_nhat(uuid),
    public.hs_ghi_bien_ban(uuid, text, date, text, text),
    public.hs_ghi_bien_ban(uuid, text, date, text, text, text, text, text),
    public.hs_tham_gia(uuid, text, date), public.mo_phong_hop(uuid, date, text),
    public.phong_dang_mo(uuid, text), public.lead_class(uuid), public.wig_class(uuid),
    public.wig_student(uuid), public.lead_day_ok(uuid, date), public.lead_measure_canh_bao(uuid),
    public.pdr_bang(uuid, date), public.school_wig_rollup(date), public.tuan_da_chot(uuid, uuid, date),
    public.tuan_da_hop(uuid, date), public.tick_open(uuid), public.kieu_don_vi(text),
    public.notify_student_meeting(), public.wig_meeting_note_dung_lop(), public.ty_le_cuon(uuid);

  drop function if exists
    private.cam_ket_hop_le(), private.cam_ket_trang_thai(), private.chan_qua_hai_cam_ket(),
    private.chi_em_va_bgh_sua_cam_ket(), private.dem_lan_sua_cam_ket(), private.khoa_sau_khi_chot(),
    private.chan_qua_hai_viec(), private.chan_qua_muoi_viec(), private.lead_theo_cam_ket(),
    private.viec_em_sua_thi_cam_ket_cho_duyet(), private.chan_luong_vo_ly(),
    private.hub_hang_doi_tick_dan_dat(), private.tick_dung_thu(), private.bien_ban_dien_ngay(),
    private.so_do_chi_cho_dich_ngoai(), private.wig_so_do_cham_gio(), private.chan_wig_lop_thu_nam(),
    private.chan_em_tu_duyet(), private.chi_em_va_bgh_sua_muc_tieu(), private.dong_bo_area_cam_ket(),
    private.noi_muc_tieu_len_lop(), private.wig_em_sua_thi_cho_duyet(), private.wig_lop_qua_tay_bgh(),
    private.wig_actual(uuid), private.wig_actual_so(uuid);

  insert into ket_qua values ('ĐƯỜNG VUI: khối drop 0168 chạy sạch (không văng phụ thuộc)',
    'không lỗi', 'chạy tới hết', true);
exception when others then
  -- Lỗi phụ thuộc (drop hàm trước bảng chẳng hạn) bị bắt ở đây; savepoint ngầm của block đã lùi
  -- các drop → mấy dòng "SAU: mất" cũng đỏ theo (đối chứng kép). Ghi thẳng lỗi ra để thấy chỗ.
  v_loi := sqlstate || ' ' || sqlerrm;
  insert into ket_qua values ('ĐƯỜNG VUI: khối drop 0168 chạy sạch (không văng phụ thuộc)',
    'không lỗi', 'VĂNG: ' || v_loi, false);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SAU DROP — cũ PHẢI MẤT
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into ket_qua
select 'SAU: 9 bảng cũ đã mất', '0', count(*)::text, count(*) = 0
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r' and c.relname in (select ten from _bang_cu);

insert into ket_qua
select 'SAU: 3 view cũ đã mất', '0', count(*)::text, count(*) = 0
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'v' and c.relname in (select ten from _view_cu);

insert into ket_qua
select 'SAU: 32 hàm public cũ đã mất', '0', count(*)::text, count(*) = 0
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in (select ten from _ham_pub_cu);

insert into ket_qua
select 'SAU: 25 hàm private cũ đã mất', '0', count(*)::text, count(*) = 0
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
where p.proname in (select ten from _ham_priv_cu);

insert into ket_qua
select 'SAU: wig_meetings rời publication', '0', count(*)::text, count(*) = 0
from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'wig_meetings';

insert into ket_qua
select 'SAU: outbox nguồn lead_progress không còn pending', '0', count(*)::text, count(*) = 0
from hub_event_outbox where source_table = 'lead_progress' and status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════════
-- GIỮ KHÔNG GÃY — bảng/hàm/enum phải CÒN sau khi cascade quét
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into ket_qua
select 'GIỮ: 6 bảng nền còn (điểm danh/PDR/Hub/scoreboard/buddy/lịch)', '6', count(*)::text, count(*) = 6
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r' and c.relname in
  ('scoreboard_entries','pdr_meetings','attendance_records','buddy_pairs','pdr_schedules','hub_event_outbox');

insert into ket_qua
select 'GIỮ: 4 hàm thi đua (0166 giữ) không bị cascade cuốn', '4', count(*)::text, count(*) = 4
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in ('campus_rollup','class_competition_scores','class_ranks','campus_ranks');

insert into ket_qua
select 'GIỮ: enum wig_domain + score_category còn', '2', count(distinct typname)::text, count(distinct typname) = 2
from pg_type where typname in ('wig_domain','score_category');

insert into ket_qua
select 'GIỮ: helper PDR/buddy còn (pdr_da_ky/is_pdr_participant/tao_buddy_nhom)', '3', count(*)::text, count(*) = 3
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in ('pdr_da_ky','is_pdr_participant','tao_buddy_nhom');

-- functional: Hub outbox vẫn GHI được sau drop (bảng + check status còn nguyên)
do $$
declare v_so integer;
begin
  insert into hub_event_outbox (event_type, source_table, source_id, payload)
  values ('kiem.0168', 'kiem_0168', gen_random_uuid(), '{}'::jsonb);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('GIỮ: hub_event_outbox vẫn insert được sau drop', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into ket_qua values ('GIỮ: hub_event_outbox vẫn insert được sau drop', '1 dòng', 'GÃY: ' || sqlerrm, false);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- ĐÓNG VAI EM — sau drop, đọc bảng GIỮ dưới RLS không lỗi (mặt RLS của phần giữ còn sống)
-- ═══════════════════════════════════════════════════════════════════════════════════
do $$
declare v_em uuid := (select em from ai); v_loi text;
begin
  if v_em is null then
    insert into ket_qua values ('ĐÓNG VAI: em Test đọc điểm danh/PDR sau drop', 'không lỗi',
      'BỎ QUA (lớp Test chưa có em)', true);
    return;
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  begin
    perform count(*) from attendance_records;
    perform count(*) from pdr_meetings;
    v_loi := null;
  exception when others then v_loi := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into ket_qua values ('ĐÓNG VAI: em Test đọc điểm danh + PDR sau drop', 'không lỗi',
    coalesce(v_loi, 'đọc được'), v_loi is null);
end $$;

reset role;

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
