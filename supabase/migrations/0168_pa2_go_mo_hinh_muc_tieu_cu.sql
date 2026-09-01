-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0168 — PA2: GỠ MÔ HÌNH MỤC TIÊU CŨ (WIG/lead/commitment/biên bản/Sư Tử).
-- Chủ dự án 01/09/2026: xây thẳng PA2, không song song, không di trú — sao lưu JSON rồi gỡ.
--
-- Chỉ chạy ở chặng ⑤ (PR-5), SAU khi: (1) 0161–0167 đã áp (mô hình mới đủ, các trang cô/BGH đã
-- thôi đọc bảng cũ — cổng grep test-khong-doc-bang-cu.mjs = 0); (2) sao lưu JSON + kiem-truoc-drop
-- xanh; (3) [H-04] gật (wigs còn 2 dòng KIEMTUDONG-XOA-* của 12A1 — đã trong bản sao lưu);
-- (4) [H-24] Sư Tử/LLM gỡ hẳn cùng buddy_messages; [H-25] student_reflections gỡ cùng.
--
-- THỨ TỰ AN TOÀN (khác thứ tự chữ trong 50-DI-TRU §3.2–3.5 — xem "LỆCH" dưới): VIEW → BẢNG(cascade)
-- → HÀM public → HÀM trigger private. Lý do bắt buộc phải BẢNG trước HÀM: đã đọc pg_depend
-- 01/09 — 32 POLICY (trên lead_measures/lead_progress/wig_so_do), 3 TRIGGER (wig_meetings/
-- wig_meeting_notes) và 1 RULE (lead_tuan_v) PHỤ THUỘC các hàm public sắp drop; nếu drop hàm
-- TRƯỚC bảng thì Postgres chặn "other objects depend on it". Bảng rơi cascade cuốn theo 25 trigger
-- + 42 policy + FK nội bộ trước, khi ấy 32 hàm mới drop sạch không cần cascade.
--
-- GIỮ nguyên (KHÔNG đụng): scoreboard_entries (bảng giữ, dùng enum score_category), pdr_meetings,
-- attendance_records, buddy_pairs, pdr_schedules, timetable*, notifications, hub_event_outbox
-- (chỉ đánh failed dòng nguồn cũ), và 4 hàm sql class_ranks/campus_ranks/campus_rollup/
-- class_competition_scores (0166 đã viết lại không còn đọc bảng cũ). Các hàm dùng thân chuỗi
-- ($$…$$) KHÔNG ghi pg_depend lên bảng → cascade KHÔNG cuốn nhầm hàm nào (đã đối chiếu 01/09).
--
-- Idempotent: guard đếm qua to_regclass (chạy lại khi bảng đã mất không văng), mọi drop có
-- `if exists`. edit_requests.kind cũ + enum wig_period/wig_scope + classes.tick_lock_dow là việc
-- của 0169 (KHÔNG làm ở đây). Đọc pg_proc/pg_depend production 01/09 trước khi viết — không suy tệp.
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 0. GUARD — in ra số dòng SẮP mất (người chạy đối chiếu với kiem-truoc-drop.sql / bản sao lưu).
--    Dùng to_regclass để idempotent: chạy lần hai (bảng đã gỡ) chỉ ghi notice, không văng.
-- ─────────────────────────────────────────────────────────────────────────────────────
do $$
declare r text; n bigint;
begin
  foreach r in array array[
    'wigs','commitments','lead_measures','lead_progress','wig_meetings',
    'wig_meeting_notes','wig_so_do','student_reflections','buddy_messages'
  ] loop
    if to_regclass('public.' || r) is not null then
      execute format('select count(*) from public.%I', r) into n;
      raise notice '0168 sắp drop % : % dòng', r, n;
    else
      raise notice '0168 : % đã không còn (chạy lại)', r;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Hub outbox — mọi sự kiện nguồn cũ 'lead_progress' còn pending: đánh failed (dữ liệu đã bỏ,
--    dispatcher đọc payload tự chứa nên KHÔNG được để chúng lửng lơ gửi sang Hub sau khi drop).
-- ─────────────────────────────────────────────────────────────────────────────────────
update hub_event_outbox
   set status = 'failed', last_error = '0168: mo hinh muc tieu cu da bo'
 where source_table = 'lead_progress' and status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Publication realtime — wig_meetings là bảng cũ DUY NHẤT nằm trong supabase_realtime.
--    Gỡ tường minh trước (có điều kiện, khỏi đổ oan nếu đã gỡ), drop bảng cũng tự gỡ nhưng
--    tường minh cho người đọc nhật ký thấy rõ.
-- ─────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wig_meetings'
  ) then
    alter publication supabase_realtime drop table wig_meetings;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. VIEW cũ (3) — đọc thẳng bảng cũ; phải rơi TRƯỚC bảng, và lead_tuan_v giữ 1 rule phụ thuộc
--    hàm kieu_don_vi (gỡ view này mới drop được hàm ở §5).
-- ─────────────────────────────────────────────────────────────────────────────────────
drop view if exists public.metrics_tuan_v;
drop view if exists public.lead_tuan_v;
drop view if exists public.wig_progress_v;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. BẢNG cũ (9) — cascade cuốn 25 trigger + toàn bộ policy + FK nội bộ + index + sequence.
--    Không bảng GIỮ nào có FK trỏ VÀO nhóm này (đã đối chiếu pg_constraint 01/09) nên cascade
--    không sờ tới bảng giữ. commitments.pdr_meeting_id → pdr_meetings là FK RA bảng giữ (chiều
--    con) — drop commitments không đụng pdr_meetings.
--    [H-04] wigs còn 2 dòng KIEMTUDONG-XOA-* của lớp thật 12A1 — đã có trong bản sao lưu, đã gật.
--    [H-24] buddy_messages = Sư Tử/LLM (0 dòng); [H-25] student_reflections (thôi bày 16/08).
-- ─────────────────────────────────────────────────────────────────────────────────────
drop table if exists
  buddy_messages,
  wig_meeting_notes,
  wig_so_do,
  lead_progress,
  lead_measures,
  commitments,
  wig_meetings,
  wigs,
  student_reflections
cascade;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. HÀM public (32) — giờ mới gỡ được: policy/trigger/rule phụ thuộc đã rơi cùng bảng/view.
--    Chữ ký lấy đúng từ pg_get_function_identity_arguments 01/09 (hs_ghi_bien_ban có 2 overload;
--    ty_le_cuon CÓ tồn tại trên production dù kiểm kê nháp bảo không — dùng if exists nên vô hại
--    kể cả khi chữ ký lệch). campus_rollup/class_competition_scores/class_ranks/campus_ranks KHÔNG
--    có trong danh sách này (0166 giữ, đã viết lại).
-- ─────────────────────────────────────────────────────────────────────────────────────
drop function if exists
  public.cam_ket_goi_y(uuid),
  public.child_class_progress(uuid),
  public.child_week_report(uuid, text),
  public.child_weeks(uuid),
  public.class_lead_board(uuid, date, uuid),
  public.class_tick_matrix(uuid, date),
  public.cuon_so_lieu_lop(uuid),
  public.cuon_so_lieu(uuid[]),
  public.cuon_dem(uuid),
  public.em_dat_du(uuid, uuid, integer, date, date),
  public.lop_dat_du(uuid, integer, date, date),
  public.wig_dat(uuid),
  public.so_do_moi_nhat(uuid),
  public.hs_ghi_bien_ban(uuid, text, date, text, text),
  public.hs_ghi_bien_ban(uuid, text, date, text, text, text, text, text),
  public.hs_tham_gia(uuid, text, date),
  public.mo_phong_hop(uuid, date, text),
  public.phong_dang_mo(uuid, text),
  public.lead_class(uuid),
  public.wig_class(uuid),
  public.wig_student(uuid),
  public.lead_day_ok(uuid, date),
  public.lead_measure_canh_bao(uuid),
  public.pdr_bang(uuid, date),
  public.school_wig_rollup(date),
  public.tuan_da_chot(uuid, uuid, date),
  public.tuan_da_hop(uuid, date),
  public.tick_open(uuid),
  public.kieu_don_vi(text),
  public.notify_student_meeting(),
  public.wig_meeting_note_dung_lop(),
  public.ty_le_cuon(uuid);

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. HÀM trigger private (25) — trigger đã rơi cùng bảng ở §4 nên không còn ai phụ thuộc.
--    wig_actual/wig_actual_so/chan_qua_muoi_viec KHÔNG gắn trigger nào (hàm phụ) nhưng vẫn thuộc
--    mô hình cũ → gỡ theo tên. hub_hang_doi_tick_dan_dat = trigger Hub cũ trên lead_progress.
-- ─────────────────────────────────────────────────────────────────────────────────────
drop function if exists
  private.cam_ket_hop_le(),
  private.cam_ket_trang_thai(),
  private.chan_qua_hai_cam_ket(),
  private.chi_em_va_bgh_sua_cam_ket(),
  private.dem_lan_sua_cam_ket(),
  private.khoa_sau_khi_chot(),
  private.chan_qua_hai_viec(),
  private.chan_qua_muoi_viec(),
  private.lead_theo_cam_ket(),
  private.viec_em_sua_thi_cam_ket_cho_duyet(),
  private.chan_luong_vo_ly(),
  private.hub_hang_doi_tick_dan_dat(),
  private.tick_dung_thu(),
  private.bien_ban_dien_ngay(),
  private.so_do_chi_cho_dich_ngoai(),
  private.wig_so_do_cham_gio(),
  private.chan_wig_lop_thu_nam(),
  private.chan_em_tu_duyet(),
  private.chi_em_va_bgh_sua_muc_tieu(),
  private.dong_bo_area_cam_ket(),
  private.noi_muc_tieu_len_lop(),
  private.wig_em_sua_thi_cho_duyet(),
  private.wig_lop_qua_tay_bgh(),
  private.wig_actual(uuid),
  private.wig_actual_so(uuid);

commit;
