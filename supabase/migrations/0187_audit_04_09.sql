-- 0187 — ĐỢT SỬA THEO AUDIT 04/09/2026 (một file, chạy một lần). Sinh từ bản LIVE dump 04/09 bằng
-- scripts/.live/build-0187.cjs: hàm chỉ đổi câu/gate được chép NGUYÊN VĂN pg_get_functiondef rồi vá
-- đúng chỗ (vá lệch là script dừng) — không có chuyện ghi đè mất bản vá cũ. Hàm viết lại hẳn có ghi chú.
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef live (04/09/2026) trước khi đè, tất cả trùng bản repo mới nhất:
--   viec_bang(0179) · bang_ron · thi_dua_lop · bang_lop_em · co_so_tong_hop · nguoi_duyet ·
--   class_attendance_day · muc_tieu_lop_dem · thuoc_lop_dem · muc_tieu_lich_su_tuan · thuoc_12_tuan ·
--   apply/cancel/decide/request_class_transfer · enroll_student_by_email · open_term_for_class ·
--   seed_class_subjects · unenroll_student · private.thi_dua_ba_so · private.ck_truoc_them(0181) ·
--   private.er_sau_duyet · private.luot_truoc_ghi · private.noi_hop_le · private.so_do_truoc_ghi ·
--   private.th_kiem_tran · private.th_truoc_sua(0184) · private.th_truoc_xoa · view cam_ket_v
--   (security_invoker=true, grant authenticated/service_role).
--
-- LƯU Ý CHO MIGRATION SAU: mục 1 thu quyền EXECUTE mặc định → hàm public tạo MỚI từ nay KHÔNG tự có
-- EXECUTE cho authenticated. Mỗi hàm mới app gọi phải kèm `grant execute on function … to authenticated`.
-- (create or replace giữ grant cũ; DROP+CREATE thì mất — phải grant lại.)

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 1. LỖ RÒ RPC (CHẶN): thu ACL mặc định + revoke anon 44 hàm + gác NULL.
--    Nguyên nhân: pg_default_acl của postgres/public cấp EXECUTE cho anon+authenticated cho MỌI hàm
--    mới; gate `if not (a = auth.uid() or f())` với anon là NULL → không chặn.
-- ═════════════════════════════════════════════════════════════════════════════════════
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;
-- (service_role giữ — nó là khoá máy chủ, bỏ qua RLS bằng thiết kế. Thử 04/09: chỉ revoke anon/
--  authenticated thì hàm mới vẫn nhận `=X` cho PUBLIC — phải revoke cả public.)

-- Anon KHÔNG cần gọi hàm nào: đăng nhập đi qua GoTrue, middleware chỉ verify JWT cục bộ, mọi rpc()
-- trong app đều sau đăng nhập (đã grep app/lib/components 04/09). 44 hàm anon gọi được là qua
-- `anon=X` hoặc qua PUBLIC (`=X/postgres`) — nên thu CẢ public lẫn anon trên toàn bộ 156 hàm public,
-- rồi cấp lại đích danh authenticated + service_role đúng như đang có (137 hàm), trừ nhóm nội bộ.

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated, service_role;
revoke execute on function public.admin_user_counts(text) from public, anon;
grant execute on function public.admin_user_counts(text) to authenticated, service_role;
revoke execute on function public.album_class(uuid) from public, anon;
grant execute on function public.album_class(uuid) to authenticated, service_role;
revoke execute on function public.app_today() from public, anon;
grant execute on function public.app_today() to authenticated, service_role;
revoke execute on function public.apply_class_transfer(uuid,uuid) from public, anon;
revoke execute on function public.audit_review_publish() from public, anon;
revoke execute on function public.auth_campus() from public, anon;
grant execute on function public.auth_campus() to authenticated, service_role;
revoke execute on function public.auth_role() from public, anon;
grant execute on function public.auth_role() to authenticated, service_role;
revoke execute on function public.bang_lop_em(uuid,date) from public, anon;
grant execute on function public.bang_lop_em(uuid,date) to authenticated, service_role;
revoke execute on function public.bang_lop_thuoc(uuid,date) from public, anon;
grant execute on function public.bang_lop_thuoc(uuid,date) to authenticated, service_role;
revoke execute on function public.bang_ron(uuid) from public, anon;
grant execute on function public.bang_ron(uuid) to authenticated, service_role;
revoke execute on function public.cam_ket_da_ke_lai(uuid) from public, anon;
grant execute on function public.cam_ket_da_ke_lai(uuid) to authenticated, service_role;
revoke execute on function public.cam_ket_student(uuid) from public, anon;
grant execute on function public.cam_ket_student(uuid) to authenticated, service_role;
revoke execute on function public.campus_ranks() from public, anon;
grant execute on function public.campus_ranks() to authenticated, service_role;
revoke execute on function public.campus_rollup() from public, anon;
grant execute on function public.campus_rollup() to authenticated, service_role;
revoke execute on function public.can_manage_class_cover(text) from public, anon;
grant execute on function public.can_manage_class_cover(text) to authenticated, service_role;
revoke execute on function public.can_manage_class_photo(text) from public, anon;
grant execute on function public.can_manage_class_photo(text) to authenticated, service_role;
revoke execute on function public.can_manage_student_email(text) from public, anon;
grant execute on function public.can_manage_student_email(text) to authenticated, service_role;
revoke execute on function public.can_read_class_photo(text) from public, anon;
grant execute on function public.can_read_class_photo(text) to authenticated, service_role;
revoke execute on function public.can_read_subject_score(uuid,uuid) from public, anon;
grant execute on function public.can_read_subject_score(uuid,uuid) to authenticated, service_role;
revoke execute on function public.can_view_student(uuid) from public, anon;
grant execute on function public.can_view_student(uuid) to authenticated, service_role;
revoke execute on function public.can_write_subject_score(uuid,uuid) from public, anon;
grant execute on function public.can_write_subject_score(uuid,uuid) to authenticated, service_role;
revoke execute on function public.cancel_class_transfer(uuid) from public, anon;
grant execute on function public.cancel_class_transfer(uuid) to authenticated, service_role;
revoke execute on function public.checkin_windows(uuid) from public, anon;
grant execute on function public.checkin_windows(uuid) to authenticated, service_role;
revoke execute on function public.chua_check_in(uuid,date) from public, anon;
grant execute on function public.chua_check_in(uuid,date) to authenticated, service_role;
revoke execute on function public.class_attendance_day(uuid,date) from public, anon;
grant execute on function public.class_attendance_day(uuid,date) to authenticated, service_role;
revoke execute on function public.class_campus(uuid) from public, anon;
grant execute on function public.class_campus(uuid) to authenticated, service_role;
revoke execute on function public.class_competition_scores() from public, anon;
revoke execute on function public.class_ranks(uuid) from public, anon;
grant execute on function public.class_ranks(uuid) to authenticated, service_role;
revoke execute on function public.class_subject_grade_guard() from public, anon;
revoke execute on function public.class_subject_guard() from public, anon;
revoke execute on function public.co_so_tong_hop(date) from public, anon;
grant execute on function public.co_so_tong_hop(date) to authenticated, service_role;
revoke execute on function public.current_school_year() from public, anon;
grant execute on function public.current_school_year() to authenticated, service_role;
revoke execute on function public.decide_class_transfer(uuid,boolean,text) from public, anon;
grant execute on function public.decide_class_transfer(uuid,boolean,text) to authenticated, service_role;
revoke execute on function public.default_score_weight(score_kind) from public, anon;
grant execute on function public.default_score_weight(score_kind) to authenticated, service_role;
revoke execute on function public.doc_duoc_cam_ket(uuid) from public, anon;
grant execute on function public.doc_duoc_cam_ket(uuid) to authenticated, service_role;
revoke execute on function public.doc_duoc_chu_the(text,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.doc_duoc_chu_the(text,uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke execute on function public.doc_duoc_con(text,uuid) from public, anon;
grant execute on function public.doc_duoc_con(text,uuid) to authenticated, service_role;
revoke execute on function public.doc_duoc_muc_tieu(uuid) from public, anon;
grant execute on function public.doc_duoc_muc_tieu(uuid) to authenticated, service_role;
revoke execute on function public.doc_duoc_thuoc(uuid) from public, anon;
grant execute on function public.doc_duoc_thuoc(uuid) to authenticated, service_role;
revoke execute on function public.duyet_duoc_chu_the(text,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.duyet_duoc_chu_the(text,uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke execute on function public.duyet_duoc_muc_tieu(uuid) from public, anon;
grant execute on function public.duyet_duoc_muc_tieu(uuid) to authenticated, service_role;
revoke execute on function public.duyet_duoc_thuoc(uuid) from public, anon;
grant execute on function public.duyet_duoc_thuoc(uuid) to authenticated, service_role;
revoke execute on function public.em_trong_nhom(uuid,uuid) from public, anon;
grant execute on function public.em_trong_nhom(uuid,uuid) to authenticated, service_role;
revoke execute on function public.enroll_student_by_email(uuid,text) from public, anon;
grant execute on function public.enroll_student_by_email(uuid,text) to authenticated, service_role;
revoke execute on function public.ensure_class_subject() from public, anon;
revoke execute on function public.fill_score_weight() from public, anon;
revoke execute on function public.ghi_duoc_cam_ket(uuid) from public, anon;
grant execute on function public.ghi_duoc_cam_ket(uuid) to authenticated, service_role;
revoke execute on function public.ghi_duoc_chu_the(text,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.ghi_duoc_chu_the(text,uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke execute on function public.ghi_duoc_con(text,uuid) from public, anon;
grant execute on function public.ghi_duoc_con(text,uuid) to authenticated, service_role;
revoke execute on function public.ghi_duoc_muc_tieu(uuid) from public, anon;
grant execute on function public.ghi_duoc_muc_tieu(uuid) to authenticated, service_role;
revoke execute on function public.ghi_duoc_pdr_ke_lai(uuid) from public, anon;
grant execute on function public.ghi_duoc_pdr_ke_lai(uuid) to authenticated, service_role;
revoke execute on function public.ghi_duoc_thuoc(uuid) from public, anon;
grant execute on function public.ghi_duoc_thuoc(uuid) to authenticated, service_role;
revoke execute on function public.ghi_ho_duoc_luot(uuid) from public, anon;
grant execute on function public.ghi_ho_duoc_luot(uuid) to authenticated, service_role;
revoke execute on function public.go_wig_len_tren(uuid,uuid) from public, anon;
grant execute on function public.go_wig_len_tren(uuid,uuid) to authenticated, service_role;
revoke execute on function public.goi_y_cam_ket(uuid) from public, anon;
grant execute on function public.goi_y_cam_ket(uuid) to authenticated, service_role;
revoke execute on function public.ham_lay_ngay_may_chu() from public, anon;
grant execute on function public.ham_lay_ngay_may_chu() to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.homework_class(uuid) from public, anon;
grant execute on function public.homework_class(uuid) to authenticated, service_role;
revoke execute on function public.invite_student_to_class(uuid,text) from public, anon;
grant execute on function public.invite_student_to_class(uuid,text) to authenticated, service_role;
revoke execute on function public.ip_allowed(text) from public, anon;
revoke execute on function public.is_attendance_leader(uuid) from public, anon;
grant execute on function public.is_attendance_leader(uuid) to authenticated, service_role;
revoke execute on function public.is_campus_class(uuid) from public, anon;
grant execute on function public.is_campus_class(uuid) to authenticated, service_role;
revoke execute on function public.is_class_student(uuid) from public, anon;
grant execute on function public.is_class_student(uuid) to authenticated, service_role;
revoke execute on function public.is_class_teacher(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid) to authenticated, service_role;
revoke execute on function public.is_classmate_via_leader(uuid) from public, anon;
grant execute on function public.is_classmate_via_leader(uuid) to authenticated, service_role;
revoke execute on function public.is_enrolled(uuid,uuid) from public, anon;
grant execute on function public.is_enrolled(uuid,uuid) to authenticated, service_role;
revoke execute on function public.is_my_buddy(uuid) from public, anon;
grant execute on function public.is_my_buddy(uuid) to authenticated, service_role;
revoke execute on function public.is_my_campus(uuid) from public, anon;
grant execute on function public.is_my_campus(uuid) to authenticated, service_role;
revoke execute on function public.is_my_child(uuid) from public, anon;
grant execute on function public.is_my_child(uuid) to authenticated, service_role;
revoke execute on function public.is_my_student(uuid) from public, anon;
grant execute on function public.is_my_student(uuid) to authenticated, service_role;
revoke execute on function public.is_my_subject_student(uuid) from public, anon;
grant execute on function public.is_my_subject_student(uuid) to authenticated, service_role;
revoke execute on function public.is_parent_of_class(uuid) from public, anon;
grant execute on function public.is_parent_of_class(uuid) to authenticated, service_role;
revoke execute on function public.is_pdr_participant(uuid) from public, anon;
grant execute on function public.is_pdr_participant(uuid) to authenticated, service_role;
revoke execute on function public.is_subject_teacher_of_class(uuid) from public, anon;
grant execute on function public.is_subject_teacher_of_class(uuid) to authenticated, service_role;
revoke execute on function public.la_gvbm_mon(uuid,uuid) from public, anon;
grant execute on function public.la_gvbm_mon(uuid,uuid) to authenticated, service_role;
revoke execute on function public.la_gvcn_cua(uuid,uuid) from public, anon;
grant execute on function public.la_gvcn_cua(uuid,uuid) to authenticated, service_role;
revoke execute on function public.la_thanh_vien_nhom(uuid) from public, anon;
grant execute on function public.la_thanh_vien_nhom(uuid) to authenticated, service_role;
revoke execute on function public.la_to_truong_diem_danh(uuid) from public, anon;
grant execute on function public.la_to_truong_diem_danh(uuid) to authenticated, service_role;
revoke execute on function public.lan_cam_ket_tuan() from public, anon;
revoke execute on function public.link_student_details() from public, anon;
revoke execute on function public.log_audit(text,jsonb) from public, anon;
grant execute on function public.log_audit(text,jsonb) to authenticated, service_role;
revoke execute on function public.lop_nhap_ho(uuid) from public, anon;
grant execute on function public.lop_nhap_ho(uuid) to authenticated, service_role;
revoke execute on function public.luot_bi_khoa(uuid,date) from public, anon;
grant execute on function public.luot_bi_khoa(uuid,date) to authenticated, service_role;
revoke execute on function public.mark_attendance_on(uuid,uuid,attendance_status,date) from public, anon;
grant execute on function public.mark_attendance_on(uuid,uuid,attendance_status,date) to authenticated, service_role;
revoke execute on function public.mark_attendance(uuid,uuid,attendance_status) from public, anon;
grant execute on function public.mark_attendance(uuid,uuid,attendance_status) to authenticated, service_role;
revoke execute on function public.metrics_tuan(uuid,date,date,uuid) from public, anon;
grant execute on function public.metrics_tuan(uuid,date,date,uuid) to authenticated, service_role;
revoke execute on function public.muc_tieu_class(uuid) from public, anon;
grant execute on function public.muc_tieu_class(uuid) to authenticated, service_role;
revoke execute on function public.muc_tieu_lich_su_tuan(uuid,integer) from public, anon;
grant execute on function public.muc_tieu_lich_su_tuan(uuid,integer) to authenticated, service_role;
revoke execute on function public.muc_tieu_lop_dem(uuid) from public, anon;
grant execute on function public.muc_tieu_lop_dem(uuid) to authenticated, service_role;
revoke execute on function public.muc_tieu_student(uuid) from public, anon;
grant execute on function public.muc_tieu_student(uuid) to authenticated, service_role;
revoke execute on function public.nguoi_duyet() from public, anon;
grant execute on function public.nguoi_duyet() to authenticated, service_role;
revoke execute on function public.nhom_class(uuid) from public, anon;
grant execute on function public.nhom_class(uuid) to authenticated, service_role;
revoke execute on function public.noi_wig_len_tren(uuid,uuid) from public, anon;
grant execute on function public.noi_wig_len_tren(uuid,uuid) to authenticated, service_role;
revoke execute on function public.notify_edit_request() from public, anon;
revoke execute on function public.open_term_for_class(uuid,uuid) from public, anon;
grant execute on function public.open_term_for_class(uuid,uuid) to authenticated, service_role;
revoke execute on function public.pdr_chu_ky_hop_le(uuid,text,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.pdr_chu_ky_hop_le(uuid,text,uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke execute on function public.pdr_class(uuid) from public, anon;
grant execute on function public.pdr_class(uuid) to authenticated, service_role;
revoke execute on function public.pdr_da_ky(uuid,date) from public, anon;
grant execute on function public.pdr_da_ky(uuid,date) to authenticated, service_role;
revoke execute on function public.protect_class_privileged_cols() from public, anon;
revoke execute on function public.protect_profile_privileged_cols() from public, anon;
revoke execute on function public.pt_after_message() from public, anon;
revoke execute on function public.pt_can_read_thread(uuid) from public, anon;
grant execute on function public.pt_can_read_thread(uuid) to authenticated, service_role;
revoke execute on function public.pt_can_write_thread(uuid) from public, anon;
grant execute on function public.pt_can_write_thread(uuid) to authenticated, service_role;
revoke execute on function public.pt_class_message_health() from public, anon;
grant execute on function public.pt_class_message_health() to authenticated, service_role;
revoke execute on function public.pt_disclose_thread(uuid,uuid,text) from public, anon;
revoke execute on function public.pt_mark_read(uuid) from public, anon;
grant execute on function public.pt_mark_read(uuid) to authenticated, service_role;
revoke execute on function public.pt_my_threads() from public, anon;
grant execute on function public.pt_my_threads() to authenticated, service_role;
revoke execute on function public.pt_open_thread(uuid) from public, anon;
grant execute on function public.pt_open_thread(uuid) to authenticated, service_role;
revoke execute on function public.pt_stamp_message() from public, anon;
revoke execute on function public.pt_student_in_class(uuid,uuid) from public, anon;
grant execute on function public.pt_student_in_class(uuid,uuid) to authenticated, service_role;
revoke execute on function public.pt_unread_total() from public, anon;
grant execute on function public.pt_unread_total() to authenticated, service_role;
revoke execute on function public.request_class_transfer(uuid,uuid,text) from public, anon;
grant execute on function public.request_class_transfer(uuid,uuid,text) to authenticated, service_role;
revoke execute on function public.restrict_signup_by_email_domain(jsonb) from public, anon;
revoke execute on function public.review_class(uuid) from public, anon;
grant execute on function public.review_class(uuid) to authenticated, service_role;
revoke execute on function public.review_guard() from public, anon;
revoke execute on function public.review_is_editable(uuid) from public, anon;
grant execute on function public.review_is_editable(uuid) to authenticated, service_role;
revoke execute on function public.review_visible_to_family(uuid) from public, anon;
grant execute on function public.review_visible_to_family(uuid) to authenticated, service_role;
revoke execute on function public.seed_class_subjects(uuid) from public, anon;
grant execute on function public.seed_class_subjects(uuid) to authenticated, service_role;
revoke execute on function public.seed_grades_for_campus(uuid) from public, anon;
revoke execute on function public.set_my_campus_levels(school_level[]) from public, anon;
grant execute on function public.set_my_campus_levels(school_level[]) to authenticated, service_role;
revoke execute on function public.set_my_mood(mood_level) from public, anon;
grant execute on function public.set_my_mood(mood_level) to authenticated, service_role;
revoke execute on function public.sinh_nhac_pdr_luc(timestamp with time zone) from public, anon;
revoke execute on function public.sinh_nhac_pdr() from public, anon;
grant execute on function public.sinh_nhac_pdr() to authenticated, service_role;
revoke execute on function public.staff_can_manage_class(uuid) from public, anon;
grant execute on function public.staff_can_manage_class(uuid) to authenticated, service_role;
revoke execute on function public.staff_can_read_class(uuid) from public, anon;
grant execute on function public.staff_can_read_class(uuid) to authenticated, service_role;
revoke execute on function public.standard_grade_numbers_multi(school_level[]) from public, anon;
grant execute on function public.standard_grade_numbers_multi(school_level[]) to authenticated, service_role;
revoke execute on function public.standard_grade_numbers(school_level) from public, anon;
grant execute on function public.standard_grade_numbers(school_level) to authenticated, service_role;
revoke execute on function public.student_checkin(uuid,mood_level,text,text) from public, anon;
revoke execute on function public.subject_fits_class(uuid,uuid) from public, anon;
grant execute on function public.subject_fits_class(uuid,uuid) to authenticated, service_role;
revoke execute on function public.subject_fits_grade(uuid,uuid) from public, anon;
grant execute on function public.subject_fits_grade(uuid,uuid) to authenticated, service_role;
revoke execute on function public.subject_guard() from public, anon;
revoke execute on function public.subject_roster(uuid,uuid) from public, anon;
grant execute on function public.subject_roster(uuid,uuid) to authenticated, service_role;
revoke execute on function public.tao_buddy_nhom(uuid,uuid[]) from public, anon;
grant execute on function public.tao_buddy_nhom(uuid,uuid[]) to authenticated, service_role;
revoke execute on function public.teaching_assignment_guard() from public, anon;
revoke execute on function public.ten_hien_thi(text,text) from public, anon;
grant execute on function public.ten_hien_thi(text,text) to authenticated, service_role;
revoke execute on function public.term_is_locked(uuid) from public, anon;
grant execute on function public.term_is_locked(uuid) to authenticated, service_role;
revoke execute on function public.thi_dua_lop(uuid) from public, anon;
grant execute on function public.thi_dua_lop(uuid) to authenticated, service_role;
revoke execute on function public.thu_hai_tu_nhan(text) from public, anon;
grant execute on function public.thu_hai_tu_nhan(text) to authenticated, service_role;
revoke execute on function public.thuoc_12_tuan(uuid,uuid,date) from public, anon;
grant execute on function public.thuoc_12_tuan(uuid,uuid,date) to authenticated, service_role;
revoke execute on function public.thuoc_class(uuid) from public, anon;
grant execute on function public.thuoc_class(uuid) to authenticated, service_role;
revoke execute on function public.thuoc_co_so(uuid) from public, anon;
grant execute on function public.thuoc_co_so(uuid) to authenticated, service_role;
revoke execute on function public.thuoc_lop_dem(uuid,date) from public, anon;
grant execute on function public.thuoc_lop_dem(uuid,date) to authenticated, service_role;
revoke execute on function public.thuoc_nhan_luot(uuid,uuid) from public, anon;
grant execute on function public.thuoc_nhan_luot(uuid,uuid) to authenticated, service_role;
revoke execute on function public.toi_dich(numeric,numeric,numeric) from public, anon;
grant execute on function public.toi_dich(numeric,numeric,numeric) to authenticated, service_role;
revoke execute on function public.touch_updated_at() from public, anon;
revoke execute on function public.transfer_target_classes() from public, anon;
grant execute on function public.transfer_target_classes() to authenticated, service_role;
revoke execute on function public.trg_seed_grades() from public, anon;
revoke execute on function public.trong_cua_so_ghi(date) from public, anon;
grant execute on function public.trong_cua_so_ghi(date) to authenticated, service_role;
revoke execute on function public.truong_da_khai_mang() from public, anon;
grant execute on function public.truong_da_khai_mang() to authenticated, service_role;
revoke execute on function public.ty_le_em_tu_dat(uuid) from public, anon;
grant execute on function public.ty_le_em_tu_dat(uuid) to authenticated, service_role;
revoke execute on function public.unenroll_student(uuid,uuid) from public, anon;
grant execute on function public.unenroll_student(uuid,uuid) to authenticated, service_role;
revoke execute on function public.viec_bang(uuid) from public, anon;
grant execute on function public.viec_bang(uuid) to authenticated, service_role;
revoke execute on function public.vn_today() from public, anon;
grant execute on function public.vn_today() to authenticated, service_role;
revoke execute on function public.vn_week_start(date) from public, anon;
grant execute on function public.vn_week_start(date) to authenticated, service_role;
revoke execute on function public.xac_nhan_duoc_cam_ket(uuid) from public, anon;
grant execute on function public.xac_nhan_duoc_cam_ket(uuid) to authenticated, service_role;

-- authenticated: nhóm nội bộ / ghi hàng loạt / trigger KHÔNG cấp lại (không ai gọi tay; cron chạy
-- bằng postgres): lan_cam_ket_tuan, trg_seed_grades, protect_class_privileged_cols,
-- notify_edit_request, fill_score_weight, link_student_details, seed_grades_for_campus.
revoke execute on function public.lan_cam_ket_tuan() from authenticated;
revoke execute on function public.trg_seed_grades() from authenticated;
revoke execute on function public.protect_class_privileged_cols() from authenticated;
revoke execute on function public.notify_edit_request() from authenticated;
revoke execute on function public.fill_score_weight() from authenticated;
revoke execute on function public.link_student_details() from authenticated;
revoke execute on function public.seed_grades_for_campus(uuid) from authenticated;
-- sinh_nhac_pdr GIỮ: trang /notifications gọi làm lưới đỡ khi cron hụt.

-- 1b. Gác NULL: các hàm SECDEF có gate `if not (…)` — thêm dòng chặn "chưa đăng nhập" ngay đầu thân
--     (chép nguyên văn live, chỉ thêm MỘT dòng). Sau khi thu anon, dòng này là lớp phòng thân thứ hai.

CREATE OR REPLACE FUNCTION public.apply_class_transfer(p_student uuid, p_to_class uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  -- ② Phòng thân (GIỮ NGUYÊN 0160): chỉ quản trị / GVCN lớp nhận / hiệu trưởng cơ sở lớp nhận.
  if not (
    auth_role() = 'admin'
    or is_class_teacher(p_to_class)
    or exists (select 1 from classes c where c.id = p_to_class
               and auth_role() = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp nhận (hoặc quản trị) mới chuyển lớp được'
      using errcode = '42501';
  end if;

  -- 4 câu GIỮ NGUYÊN của 0160:
  update enrollments set is_active = false, is_attendance_leader = false
  where student_id = p_student and is_active and class_id <> p_to_class;

  update buddy_pairs set is_active = false
    where is_active and class_id <> p_to_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id <> p_to_class and student_id = p_student;

  -- ── PA2: dữ liệu mục tiêu ĐANG MỞ của em đi theo em ────────────────────────────────────────
  perform set_config('va.doi_lop', '1', true);

  -- Mục tiêu cấp em còn sống (chưa đóng): đổi lớp, và đổi cả cơ sở khi lớp nhận khác cơ sở (để
  -- predicate BGH/cơ sở mới đọc đúng). Mục tiêu đã 'dong' là lịch sử của lớp cũ — đứng yên.
  update muc_tieu set class_id = p_to_class,
         campus_id = (select campus_id from classes where id = p_to_class)
    where cap = 'em' and student_id = p_student
      and class_id is distinct from p_to_class and trang_thai <> 'dong';

  -- Việc của em còn sống: đổi lớp (thuoc không có campus_id, quyền suy từ class_id).
  update thuoc set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student
      and class_id <> p_to_class and trang_thai <> 'dong';

  -- Cam kết của em CHƯA CHẤM và tuần cuối CHƯA QUA: đi theo. Cam kết đã chấm = lịch sử lớp cũ, đứng yên.
  update cam_ket set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student and class_id <> p_to_class
      and trang_thai = 'hieu_luc' and ket_qua is null
      and tuan_bat_dau + (so_tuan * 7) - 1 >= vn_today();          -- tuần cuối còn chưa qua

  -- Nhóm ở lớp KHÁC lớp nhận: tắt tư cách thành viên (nhóm là của lớp cũ).
  update nhom_thanh_vien v set is_active = false
    from nhom n where n.id = v.nhom_id and v.student_id = p_student
      and v.is_active and n.class_id <> p_to_class;

  perform set_config('va.doi_lop', '', true);
  -- Dây `noi` lên mục tiêu LỚP CŨ giữ nguyên — màn suy "góp vào lớp cũ" từ cha.class_id <> con.class_id.

  insert into enrollments (class_id, student_id, is_active)
  values (p_to_class, p_student, true)
  on conflict (class_id, student_id) do update set is_active = true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_class_transfer(p_request uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_req class_transfer_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  select * into v_req from class_transfer_requests where id = p_request;
  if v_req.id is null or v_req.status <> 'pending' then
    raise exception 'De nghi khong con o trang thai cho';
  end if;
  if not (auth_role() = 'admin' or is_class_teacher(v_req.from_class_id)) then
    raise exception 'Chi nguoi de nghi (hoac quan tri) moi rut lai duoc';
  end if;
  update class_transfer_requests
  set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
  where id = p_request;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.decide_class_transfer(p_request uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req class_transfer_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  select * into v_req from class_transfer_requests where id = p_request;
  if v_req.id is null then raise exception 'Khong tim thay de nghi'; end if;
  if v_req.status <> 'pending' then raise exception 'De nghi nay da duoc xu ly roi'; end if;

  if not (
    auth_role() = 'admin'
    or is_class_teacher(v_req.to_class_id)
    or exists (select 1 from classes c where c.id = v_req.to_class_id
               and auth_role() = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chi giao vien chu nhiem lop nhan (hoac quan tri) moi duyet duoc';
  end if;

  if p_approve then
    perform apply_class_transfer(v_req.student_id, v_req.to_class_id);
  end if;

  update class_transfer_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decide_note = p_note
  where id = p_request;

  return case when p_approve then 'approved' else 'rejected' end;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.request_class_transfer(p_student uuid, p_to_class uuid, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from uuid;
  v_role user_role;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  v_role := auth_role();

  select class_id into v_from from enrollments
  where student_id = p_student and is_active
  order by class_id limit 1;

  if v_from is null then
    raise exception 'Em nay chua o lop nao';
  end if;
  if v_from = p_to_class then
    raise exception 'Em dang o chinh lop do roi';
  end if;
  if not exists (select 1 from classes c join campuses cs on cs.id = c.campus_id
                 where c.id = p_to_class and c.is_active and cs.is_active) then
    raise exception 'Lop dich khong con hoat dong';
  end if;

  if not (
    v_role = 'admin'
    or is_class_teacher(v_from)
    or exists (select 1 from classes c where c.id = v_from and v_role = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chi giao vien chu nhiem cua lop hien tai (hoac quan tri) moi de nghi doi duoc';
  end if;

  if v_role = 'admin' then
    perform apply_class_transfer(p_student, p_to_class);
    insert into class_transfer_requests
      (student_id, from_class_id, to_class_id, requested_by, note, status, decided_by, decided_at)
    values (p_student, v_from, p_to_class, auth.uid(), p_note, 'approved', auth.uid(), now());
    return 'moved';
  end if;

  if exists (select 1 from class_transfer_requests where student_id = p_student and status = 'pending') then
    return 'exists';
  end if;

  insert into class_transfer_requests (student_id, from_class_id, to_class_id, requested_by, note)
  values (p_student, v_from, p_to_class, auth.uid(), p_note);
  return 'requested';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enroll_student_by_email(p_class uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền ghi danh cho lớp này';
  end if;
  select id into v_student from profiles
    where lower(email) = lower(p_email) and role = 'student';
  if v_student is null then
    return 'not_found';
  end if;
  -- Một em chỉ học một lớp: vào lớp mới thì tắt lớp cũ.
  update enrollments set is_active = false
    where student_id = v_student and is_active and class_id <> p_class;
  insert into enrollments (class_id, student_id, is_active)
    values (p_class, v_student, true)
    on conflict (class_id, student_id) do update set is_active = true;
  return 'ok';
end $function$
;
CREATE OR REPLACE FUNCTION public.open_term_for_class(p_term uuid, p_class uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n int;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  if not (is_class_teacher(p_class) or auth_role() = 'admin') then
    raise exception 'Chỉ giáo viên chủ nhiệm của lớp này được mở đợt đánh giá';
  end if;
  if auth_role() <> 'admin' and term_is_locked(p_term) then
    raise exception 'Đợt đánh giá đã chốt sổ';
  end if;
  if not exists (
    select 1 from assessment_terms t join classes c on c.id = p_class
    where t.id = p_term and t.campus_id = c.campus_id
  ) then
    raise exception 'Đợt đánh giá không thuộc cơ sở của lớp';
  end if;

  insert into student_term_reviews (term_id, student_id, class_id, created_by, updated_by)
  select p_term, e.student_id, p_class, auth.uid(), auth.uid()
  from enrollments e
  where e.class_id = p_class and e.is_active
  on conflict (term_id, student_id) do nothing;   -- gọi lại nhiều lần vẫn an toàn

  get diagnostics v_n = row_count;
  return v_n;
end $function$
;
CREATE OR REPLACE FUNCTION public.seed_class_subjects(p_class uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n int; v_campus uuid;
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  select c.campus_id into v_campus from classes c where c.id = p_class;
  if v_campus is null then raise exception 'Không thấy lớp'; end if;

  if not (staff_can_manage_class(p_class)
          or (auth_role() = 'principal'::user_role and v_campus = auth_campus())) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp, ban giám hiệu cơ sở này hoặc quản trị viên được sửa chương trình của lớp';
  end if;

  insert into class_subjects (class_id, subject_id, created_by)
  select p_class, s.id, auth.uid()
  from subjects s
  where s.is_active
    and (s.campus_id is null or s.campus_id = v_campus)
    -- MỚI: bỏ qua môn không dạy khối này. Môn chưa khai lớp vẫn vào (hàm coi là không hạn chế).
    and subject_fits_grade(s.id, p_class)
  on conflict (class_id, subject_id) do nothing;   -- gọi lại bao nhiêu lần cũng an toàn

  get diagnostics v_n = row_count;
  return v_n;
end $function$
;
CREATE OR REPLACE FUNCTION public.unenroll_student(p_class uuid, p_student uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;   -- 0187: anon → NULL gate, chặn hẳn
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền';
  end if;

  update enrollments set is_active = false, is_attendance_leader = false
    where class_id = p_class and student_id = p_student;
  update buddy_pairs set is_active = false
    where is_active and class_id = p_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id = p_class and student_id = p_student;

  -- ── PA2: rời lớp → nhóm lớp này tắt thành viên; việc của em ở lớp này tạm dừng ───────────────
  perform set_config('va.doi_lop', '1', true);
  update nhom_thanh_vien v set is_active = false
    from nhom n where n.id = v.nhom_id and v.student_id = p_student
      and v.is_active and n.class_id = p_class;
  update thuoc set trang_thai = 'tam_dung'
    where chu_the = 'em' and student_id = p_student and class_id = p_class and trang_thai = 'chay';
  perform set_config('va.doi_lop', '', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.muc_tieu_lop_dem(p_muc_tieu uuid)
 RETURNS TABLE(so_dat integer, si_so integer, so_huong_vao integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_class uuid;
begin
  if (select auth.uid()) is null then return; end if;   -- 0187: anon → NULL gate, chặn hẳn
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
end $function$
;
CREATE OR REPLACE FUNCTION public.thuoc_lop_dem(p_thuoc uuid, p_tuan date DEFAULT NULL::date)
 RETURNS TABLE(si_so integer, so_em_ghi integer, so_em_dat integer, gia_lop numeric, chi_tieu numeric, le_ra numeric, mien boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_class uuid; v_hom_nay date; v_tuan date; v_hs boolean;
begin
  if (select auth.uid()) is null then return; end if;   -- 0187: anon → NULL gate, chặn hẳn
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
end $function$
;
CREATE OR REPLACE FUNCTION public.bang_ron(p_student uuid DEFAULT NULL::uuid)
 RETURNS TABLE(trang_thai text, viec_tong integer, viec_dung_nhip integer, ck_tong integer, ck_giu integer, ti_le numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid; v_hom_nay date; v_w date; v_campus uuid; v_class uuid;
  v_vt int; v_vd int; v_ct int; v_cg int; v_r numeric; v_nghi boolean;
begin
  if (select auth.uid()) is null then return; end if;   -- 0187: anon → NULL gate, chặn hẳn
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
end $function$
;
CREATE OR REPLACE FUNCTION public.class_attendance_day(p_class uuid, p_date date DEFAULT NULL::date)
 RETURNS TABLE(student_id uuid, ho_ten text, trang_thai text, gio_bam timestamp with time zone, nguoi_danh uuid, tu_dong boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_date date := coalesce(p_date, vn_today());
  v_campus uuid;
  w record;
begin
  if (select auth.uid()) is null
     or not coalesce(auth_role() in ('admin','principal') or is_class_teacher(p_class) or is_attendance_leader(p_class), false) then
    raise exception 'Không có quyền xem sổ điểm danh của lớp này' using errcode = '42501';
  end if;

  select campus_id into v_campus from classes where id = p_class;
  select * into w from checkin_windows(v_campus);

  return query
  select
    p.id, coalesce(p.full_name, p.email),
    coalesce(
      a.status::text,
      case
        when v_date < vn_today() or now() > w.het_muon then 'absent'
        else 'unknown'
      end
    ),
    a.created_at,
    a.marked_by,
    (a.marked_by is not null and a.marked_by = p.id)
  from enrollments e
  join profiles p on p.id = e.student_id
  left join attendance_records a
    on a.class_id = p_class and a.student_id = p.id and a.date = v_date
  where e.class_id = p_class and e.is_active
  order by coalesce(p.full_name, p.email);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.viec_bang(p_student uuid DEFAULT NULL::uuid)
 RETURNS TABLE(thuoc_id uuid, ten text, chu_the text, cach_ghi text, chieu_dich text, ky_tuan integer, ten_don_vi text, don_vi_id uuid, ngay_ap_dung smallint[], cho_bu boolean, chi_xem boolean, ky_tu date, ky_den date, gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text, cam_ket_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid; v_hom_nay date;
begin
  v_student := coalesce(p_student, (select auth.uid()));
  if (select auth.uid()) is null
     or not coalesce(v_student = (select auth.uid()) or can_view_student(v_student), false) then return; end if;
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
end $function$
;
-- nguoi_duyet: trước trả 3 tên+email admin cho bất kỳ ai; giờ chỉ người đã đăng nhập.
create or replace function public.nguoi_duyet()
 returns table(full_name text, email text)
 language sql stable security definer set search_path to 'public' as $function$
  select p.full_name, p.email
  from public.profiles p
  where p.role = 'admin' and (select auth.uid()) is not null
  order by p.full_name nulls last, p.email
  limit 3
$function$;

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 2. KHỬ RPC GỌI LẶP + ĐỆM ĐIỂM TUẦN (CHẶN hiệu năng)
--    · bang_lop_em: viec_bang 2 lần/em → 1 lần (lateral), cùng kết quả.
--    · thi_dua_ba_so tách: phần MỤC TIÊU tính sống (đổi theo tick, phải thấy ngay) + phần 4 TUẦN ĐÃ ĐÓNG
--      (chỉ đổi khi sang tuần) được ĐỆM trong private.diem_tuan_cache 15 phút, cron tính lại 10 phút/lần.
--    · co_so_tong_hop: 3 so_hien_tai/mục tiêu → 1; 2 thi_dua_ba_so/lớp → 1 (đọc đệm).
--    thi_dua_lop / co_so_tong_hop thành VOLATILE vì có thể ghi đệm (app gọi qua POST rpc, không đổi gì).
-- ═════════════════════════════════════════════════════════════════════════════════════
create or replace function public.bang_lop_em(p_class uuid, p_tuan date default null)
 returns table(student_id uuid, ho_ten text, thuoc_tong integer, thuoc_dat integer, ck_tong integer, ck_thang integer, mt_tong integer, pdr_da_ky boolean)
 language plpgsql stable security definer set search_path to 'public' as $function$
declare v_hom_nay date; v_w date;
begin
  if (select auth.uid()) is null or not coalesce(staff_can_read_class(p_class), false) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select e.student_id, p.full_name, vb.tong, vb.dat, ck.tong, ck.thang, mt.n, public.pdr_da_ky(e.student_id, v_w)
  from enrollments e
  join profiles p on p.id = e.student_id
  cross join lateral (
    select count(*) filter (where x.chi_xem = false)::int as tong,
           count(*) filter (where x.trang_thai in ('dat', 'dang_thang', 'dang_giu'))::int as dat
    from public.viec_bang(e.student_id) x) vb
  cross join lateral (
    select count(*)::int as tong, count(*) filter (where c.ket_qua = 'thang')::int as thang
    from cam_ket c
    where c.student_id = e.student_id and c.trang_thai = 'hieu_luc'
      and v_w between c.tuan_bat_dau and c.tuan_ket_thuc) ck
  cross join lateral (
    select count(*)::int as n from muc_tieu m
    where m.cap = 'em' and m.student_id = e.student_id and m.class_id = p_class and m.trang_thai = 'duyet') mt
  where e.class_id = p_class and e.is_active;
end $function$;

-- 2b. Đệm điểm tuần. Bảng ở schema private: không lộ qua PostgREST, chỉ hàm SECDEF/cron đọc ghi.
create table if not exists private.diem_tuan_cache (
  class_id   uuid not null references classes(id) on delete cascade,
  week_start date not null,
  payload    jsonb not null,
  tinh_luc   timestamptz not null default now(),
  primary key (class_id, week_start)
);

-- Phần MỤC TIÊU của thi đua (sống) — nguyên văn khối đầu của thi_dua_ba_so live.
create or replace function private.thi_dua_mt(p_class uuid, p_hom_nay date) returns numeric
 language sql stable security definer set search_path to 'public' as $function$
  select round(avg(h.pct) * 100, 1)
  from muc_tieu m cross join lateral private.so_hien_tai(m.id, p_hom_nay) h
  where m.cap = 'lop' and m.class_id = p_class and m.trang_thai = 'duyet'
    and m.kieu_dich in ('toi', 'toc_do_ky', 'ti_le_dat') and h.pct is not null
$function$;

-- Phần 4 TUẦN ĐÃ ĐÓNG (nặng: gia_thuoc × mọi thước × mọi em × 4 tuần) — nguyên văn hai khối sau của
-- thi_dua_ba_so live, chỉ tách ra để đệm được.
create or replace function private.thi_dua_4tuan(p_class uuid, p_hom_nay date)
 returns table(diem_thuoc numeric, diem_cam_ket numeric)
 language plpgsql stable security definer set search_path to 'public' as $function$
declare v_tu date; v_den date; v_dth numeric; v_dck numeric;
begin
  v_den := (vn_week_start(p_hom_nay) - 1)::date;      -- hết tuần đã đóng gần nhất
  v_tu := (vn_week_start(p_hom_nay) - 28)::date;      -- 4 tuần đã đóng
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
  return query select v_dth, v_dck;
end $function$;

-- thi_dua_ba_so: GIỮ chữ ký và kết quả y hệt (= mt sống + 4 tuần tính thẳng, không đệm) — cho test so sánh
-- và cho các chỗ đang gọi thẳng.
create or replace function private.thi_dua_ba_so(p_class uuid)
 returns table(diem_muc_tieu numeric, diem_thuoc numeric, diem_cam_ket numeric)
 language plpgsql stable security definer set search_path to 'public' as $function$
declare v_hom_nay date;
begin
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  return query select private.thi_dua_mt(p_class, v_hom_nay), t.diem_thuoc, t.diem_cam_ket
  from private.thi_dua_4tuan(p_class, v_hom_nay) t;
end $function$;

-- Bản CÓ ĐỆM: phần 4 tuần lấy từ diem_tuan_cache nếu còn tươi (< 15 phút), không thì tính rồi ghi.
-- Đang ở chế độ thử (va.hom_nay đặt tay) thì tính thẳng, không đọc/ghi đệm.
create or replace function private.thi_dua_ba_so_dem(p_class uuid)
 returns table(diem_muc_tieu numeric, diem_thuoc numeric, diem_cam_ket numeric)
 language plpgsql volatile security definer set search_path to 'public' as $function$
declare v_hom_nay date; v_w date; v_p jsonb; r record;
begin
  if coalesce(nullif(current_setting('va.hom_nay', true), ''), '') <> '' then
    return query select * from private.thi_dua_ba_so(p_class); return;
  end if;
  v_hom_nay := vn_today();
  v_w := vn_week_start(v_hom_nay);
  select d.payload into v_p from private.diem_tuan_cache d
  where d.class_id = p_class and d.week_start = v_w and d.tinh_luc > now() - interval '15 minutes';
  if v_p is null then
    select * into r from private.thi_dua_4tuan(p_class, v_hom_nay);
    v_p := jsonb_build_object('diem_thuoc', r.diem_thuoc, 'diem_cam_ket', r.diem_cam_ket);
    insert into private.diem_tuan_cache (class_id, week_start, payload, tinh_luc)
    values (p_class, v_w, v_p, now())
    on conflict (class_id, week_start) do update set payload = excluded.payload, tinh_luc = excluded.tinh_luc;
  end if;
  return query select private.thi_dua_mt(p_class, v_hom_nay), (v_p->>'diem_thuoc')::numeric, (v_p->>'diem_cam_ket')::numeric;
end $function$;

-- Cron tính trước cho mọi lớp đang hoạt động — người mở trang chỉ còn đọc.
create or replace function public.tinh_diem_tuan_cache() returns integer
 language plpgsql volatile security definer set search_path to 'public' as $function$
declare c record; r record; v_w date := vn_week_start(vn_today()); n int := 0;
begin
  for c in select id from classes where is_active and school_year = current_school_year() loop
    select * into r from private.thi_dua_4tuan(c.id, vn_today());
    insert into private.diem_tuan_cache (class_id, week_start, payload, tinh_luc)
    values (c.id, v_w, jsonb_build_object('diem_thuoc', r.diem_thuoc, 'diem_cam_ket', r.diem_cam_ket), now())
    on conflict (class_id, week_start) do update set payload = excluded.payload, tinh_luc = excluded.tinh_luc;
    n := n + 1;
  end loop;
  delete from private.diem_tuan_cache where week_start < v_w - 14;   -- giữ 2 tuần, khỏi phình
  return n;
end $function$;
revoke execute on function public.tinh_diem_tuan_cache() from public, anon, authenticated;
revoke execute on function public.nguoi_duyet() from public, anon;   -- create or replace giữ ACL cũ; chắc tay
grant execute on function public.nguoi_duyet() to authenticated, service_role;
select cron.unschedule(jobid) from cron.job where jobname = 'tinh-diem-tuan';
select cron.schedule('tinh-diem-tuan', '*/10 * * * *', 'select public.tinh_diem_tuan_cache()');

-- thi_dua_lop: gate + đọc đệm. (live = 0166, chỉ đổi gate và nguồn.)
create or replace function public.thi_dua_lop(p_class uuid)
 returns table(diem_muc_tieu numeric, diem_thuoc numeric, diem_cam_ket numeric)
 language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  if (select auth.uid()) is null
     or not coalesce(is_class_student(p_class) or is_parent_of_class(p_class) or staff_can_read_class(p_class), false) then
    return;
  end if;
  return query select * from private.thi_dua_ba_so_dem(p_class);
end $function$;

-- co_so_tong_hop: một lateral so_hien_tai/mục tiêu, một thi_dua/lớp (đệm). Cột và giá trị y hệt live.
create or replace function public.co_so_tong_hop(p_tuan date default null)
 returns table(class_id uuid, class_name text, grade_name text, grade_sort integer, gvcn_ten text, si_so integer, mt_lop_duyet integer, mt_pct numeric, mt_lop_dang_thang integer, mt_lop_can_co integer, thuoc_dat_pct numeric, ck_giu_pct numeric, pdr_ky_pct numeric, cho_duyet integer)
 language plpgsql volatile security definer set search_path to 'public' as $function$
declare v_hom_nay date; v_w date;
begin
  if (select auth.uid()) is null
     or not coalesce((select auth_role()) = 'admin' or (select auth_role()) = 'principal', false) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  v_w := vn_week_start(coalesce(p_tuan, v_hom_nay));
  return query
  select c.id, c.name, coalesce(g.name, c.grade, '—'), coalesce(g.sort_order, 9999)::int,
    pr.full_name,
    (select count(*)::int from enrollments e where e.class_id = c.id and e.is_active),
    mt.duyet, mt.pct, mt.dang_thang, mt.can_co,
    td.diem_thuoc, td.diem_cam_ket,
    (select round(100.0 * count(*) filter (where public.pdr_da_ky(e.student_id, v_w))
               / nullif(count(*), 0), 1)
       from enrollments e where e.class_id = c.id and e.is_active),
    ((select count(*)::int from muc_tieu m where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'gui')
     + (select count(*)::int from thuoc t where t.class_id = c.id and t.duyet = 'gui' and t.trang_thai <> 'dong'))
  from classes c
  left join grades g on g.id = c.grade_id
  left join profiles pr on pr.id = c.homeroom_teacher_id
  cross join lateral (
    select count(*)::int as duyet,
           round(avg(h.pct) * 100, 1) as pct,
           count(*) filter (where h.trang_thai = 'dang_thang')::int as dang_thang,
           count(*) filter (where h.trang_thai = 'can_co')::int as can_co
    from muc_tieu m cross join lateral private.so_hien_tai(m.id, v_hom_nay) h
    where m.cap = 'lop' and m.class_id = c.id and m.trang_thai = 'duyet') mt
  cross join lateral private.thi_dua_ba_so_dem(c.id) td
  where c.is_active and c.school_year = current_school_year()
    and ((select auth_role()) = 'admin' or c.campus_id = (select auth_campus()));
end $function$;

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 3. RPC NHẬN MẢNG (hợp đồng với F4): một request thay N request theo số mục tiêu/thước.
--    Gác quyền y hệt bản đơn (gọi lại bản đơn cho từng id).
-- ═════════════════════════════════════════════════════════════════════════════════════
create or replace function public.muc_tieu_lich_su_tuan_nhieu(p_ids uuid[], p_so_tuan integer default 8)
 returns table(muc_tieu_id uuid, tuan_ket date, so numeric)
 language plpgsql stable security definer set search_path to 'public' as $function$
declare v uuid;
begin
  if (select auth.uid()) is null then return; end if;
  foreach v in array coalesce(p_ids, '{}'::uuid[]) loop
    return query select v, l.tuan_ket, l.so from public.muc_tieu_lich_su_tuan(v, p_so_tuan) l;
  end loop;
end $function$;
revoke execute on function public.muc_tieu_lich_su_tuan_nhieu(uuid[], integer) from public, anon;
grant execute on function public.muc_tieu_lich_su_tuan_nhieu(uuid[], integer) to authenticated, service_role;

create or replace function public.thuoc_12_tuan_nhieu(p_thuocs uuid[], p_chu_the uuid default null, p_tuan_cuoi date default null)
 returns table(thuoc_id uuid, tuan date, ky_tu date, ky_den date, la_tuan_hoc boolean, gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text)
 language plpgsql stable security definer set search_path to 'public' as $function$
declare v uuid;
begin
  if (select auth.uid()) is null then return; end if;
  foreach v in array coalesce(p_thuocs, '{}'::uuid[]) loop
    return query select v, t.tuan, t.ky_tu, t.ky_den, t.la_tuan_hoc, t.gia, t.chi_tieu, t.le_ra, t.dat, t.trang_thai
    from public.thuoc_12_tuan(v, p_chu_the, p_tuan_cuoi) t;
  end loop;
end $function$;
revoke execute on function public.thuoc_12_tuan_nhieu(uuid[], uuid, date) from public, anon;
grant execute on function public.thuoc_12_tuan_nhieu(uuid[], uuid, date) to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 4. TÌM TÊN BỎ DẤU (hợp đồng với F5): bo_dau(), cột profiles.full_name_khong_dau + GIN trigram.
--    pending_user_grants KHÔNG có cột tên (chỉ email) → không thêm.
-- ═════════════════════════════════════════════════════════════════════════════════════
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
-- IMMUTABLE để dùng được trong cột generated + index (unaccent gốc là STABLE vì phụ thuộc từ điển;
-- từ điển mặc định không đổi — quy ước quen thuộc). đ/Đ có trong unaccent.rules.
create or replace function public.bo_dau(p text) returns text
 language sql immutable parallel safe set search_path to 'public' as $function$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')))
$function$;
-- Cột generated tính lúc INSERT/UPDATE bằng vai người ghi: authenticated (RLS), service_role, và
-- supabase_auth_admin (trigger handle_new_user tạo profiles). Không cấp public để anon = 0 hàm.
revoke execute on function public.bo_dau(text) from public, anon;
grant execute on function public.bo_dau(text) to authenticated, service_role, supabase_auth_admin;
alter table profiles add column if not exists full_name_khong_dau text
  generated always as (public.bo_dau(full_name)) stored;
create index if not exists idx_profiles_ten_khong_dau_trgm on profiles using gin (full_name_khong_dau extensions.gin_trgm_ops);

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 5. QUYỀN BGH: đối chiếu live — doc_duoc_chu_the('em') đã có staff_can_read_class (principal cùng
--    cơ sở) và can_view_student đã có nhánh principal → CSDL vốn cho BGH đọc em trong cơ sở. Chỗ chặn
--    nằm ở tầng route (lib/auth) — fork F2 sửa. Ở đây chỉ thêm test khẳng định (test-0187 mục 7).
-- ═════════════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 6. CHỐNG TRÙNG MỤC TIÊU LỚP (hợp đồng F4: bắt SQLSTATE 23505). Dữ liệu hiện có không vi phạm (đã kiểm).
-- ═════════════════════════════════════════════════════════════════════════════════════
create unique index if not exists muc_tieu_lop_ten_nam_uidx
  on muc_tieu (class_id, lower(btrim(ten)), nam_hoc) where cap = 'lop' and trang_thai <> 'dong';

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 7. DI SẢN cam_ket.thuoc_id: lac_muc_tieu = (thuoc_id null AND muc_tieu_id null) → sau 0185 thước trỏ
--    qua thuoc.cam_ket_id nên cam kết có thước mà không mục tiêu bị coi "lạc" sai. Định nghĩa lại
--    = (muc_tieu_id is null). Cột generated không alter được → drop/add; view cam_ket_v phụ thuộc →
--    drop rồi dựng lại NGUYÊN VĂN (security_invoker=true + grant y cũ — đây là chỗ từng rò 18/08).
--    Rà 7 hàm "còn đọc thuoc_id": ck_truoc_them (neo legacy new.thuoc_id — giữ, dữ liệu cũ),
--    goi_y_cam_ket nhánh lớp/nhóm cũ (giữ), lan_cam_ket_tuan (ghi null), ck_truoc_sua (chỉ lược diff);
--    luot_truoc_ghi/hub_hang_doi_luot/thls_* đọc luot.thuoc_id / thuoc_lich_su.thuoc_id — bảng khác,
--    không phải di sản. Không hàm nào cần đổi.
-- ═════════════════════════════════════════════════════════════════════════════════════
drop view if exists public.cam_ket_v;
alter table cam_ket drop column if exists lac_muc_tieu;
alter table cam_ket add column lac_muc_tieu boolean generated always as (muc_tieu_id is null) stored;
create view public.cam_ket_v with (security_invoker = true) as
 SELECT c.id, c.chu_the, c.class_id, c.nhom_id, c.student_id, c.tuan_bat_dau, c.so_tuan, c.tuan_ket_thuc,
    c.noi_dung, c.so_hua, c.don_vi_id, c.so_dat, c.thuoc_id, c.muc_tieu_id, c.lac_muc_tieu, c.ket_qua,
    c.goi_y, c.cham_boi, c.cham_at, c.xong_at, c.pdr_meeting_id, c.nguoi_nhap_ho, c.trang_thai,
    c.created_by, c.created_at, c.updated_at,
    dv.nhan_vi AS ten_don_vi,
    g.goi_y AS goi_y_may,
    g.so_dat_goi_y
   FROM cam_ket c
     LEFT JOIN don_vi dv ON dv.id = c.don_vi_id
     LEFT JOIN LATERAL goi_y_cam_ket(c.id) g(goi_y, so_dat_goi_y, thuoc_trang_thai) ON true;
grant select, insert, update, delete, truncate, references, trigger on public.cam_ket_v to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 8. CÂU BÁO TRIGGER: "việc" (tên cũ của thước đo dẫn dắt) → "thước đo"; câu có thể chạy cho thầy cô
--    viết trung tính. Chép nguyên văn live, chỉ đổi chuỗi trong raise exception.
-- ═════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.ck_truoc_them()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_me uuid := (select auth.uid()); v_th thuoc%rowtype; v_mt muc_tieu%rowtype;
begin
  if v_me is null then return new; end if;                                   -- L6
  new.created_by := v_me;
  if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  new.ket_qua := null; new.cham_boi := null; new.cham_at := null;            -- không chấm lúc tạo
  new.so_dat := null; new.xong_at := null; new.goi_y := null;
  new.trang_thai := 'hieu_luc';
  -- 0181: cam kết cá nhân của GVCN — thầy cô không có enrollment, xét homeroom thay.
  if new.chu_the = 'em'
     and not exists (select 1 from enrollments e
       where e.class_id = new.class_id and e.student_id = new.student_id and e.is_active)
     and not la_gvcn_cua(new.class_id, new.student_id) then
    raise exception 'Em này không còn học ở lớp' using errcode = '23503';
  end if;
  if new.thuoc_id is not null then                                           -- neo cùng chủ thể
    select * into v_th from thuoc where id = new.thuoc_id;
    if v_th.id is null or v_th.class_id is distinct from new.class_id
       or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
      raise exception 'Thước đo gắn vào cam kết phải là thước đo của chính mình hoặc của lớp/nhóm' using errcode = '23514';
    end if;
  end if;
  if new.muc_tieu_id is not null then
    select * into v_mt from muc_tieu where id = new.muc_tieu_id;
    if v_mt.id is null or (v_mt.cap <> 'truong' and v_mt.class_id is distinct from new.class_id)
       or (v_mt.cap = 'em' and v_mt.student_id is distinct from new.student_id) then
      raise exception 'Mục tiêu gắn vào cam kết phải là mục tiêu của em hoặc của lớp/nhóm em' using errcode = '23514';
    end if;
  end if;
  if new.pdr_meeting_id is not null and exists (select 1 from pdr_meetings p
       where p.id = new.pdr_meeting_id and p.student_id is distinct from new.student_id) then
    raise exception 'Biên bản họp không phải của em này' using errcode = '23514';
  end if;
  perform private.ck_kiem_tran_tuan(new);
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.er_sau_duyet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_th thuoc%rowtype;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.kind = 'doi_ten_thuoc' then
      select * into v_th from thuoc where id = new.ref_id;
      if v_th.id is null or v_th.class_id is distinct from new.class_id
         or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
        raise exception 'Yêu cầu này không trỏ vào thước đo của đúng lớp/đúng em' using errcode = '23514';
      end if;
      perform set_config('va.doi_ten_qua_yeu_cau', '1', true);
      update thuoc set ten = btrim(new.message) where id = new.ref_id;
      perform set_config('va.doi_ten_qua_yeu_cau', '', true);
    elsif new.kind = 'mo_tuan_da_ky' then
      insert into luot_mo_khoa (student_id, class_id, week_start, mo_boi, mo_at, het_han, edit_request_id)
      values (new.student_id, new.class_id, new.tuan,
              coalesce(new.resolved_by, (select auth.uid())), now(), now() + interval '48 hours', new.id);
      perform log_audit('mo_tuan_da_ky', jsonb_build_object('edit_request', new.id, 'tuan', new.tuan));
    end if;                                          -- 'rename_lead' cũ: app cũ tự áp, trigger không đụng
  end if;
  return null;
end $function$
;
CREATE OR REPLACE FUNCTION private.luot_truoc_ghi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_me uuid := (select auth.uid()); t thuoc%rowtype;
begin
  select * into t from thuoc where id = new.thuoc_id;
  if tg_op = 'UPDATE' then
    if (new.thuoc_id, new.student_id, new.ngay, new.nguoi_ghi, new.nguon, new.nguon_ref)
       is distinct from (old.thuoc_id, old.student_id, old.ngay, old.nguoi_ghi, old.nguon, old.nguon_ref) then
      raise exception 'Muốn đổi ngày hay thước đo thì xoá lượt này rồi ghi lại' using errcode = '23514';
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
end $function$
;
CREATE OR REPLACE FUNCTION private.noi_hop_le()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION private.so_do_truoc_ghi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_he_thong boolean := coalesce(current_setting('va.nguon_he_thong', true), '') = '1';
  m muc_tieu%rowtype;
begin
  select * into m from muc_tieu where id = new.muc_tieu_id;
  if tg_op = 'UPDATE' then
    if (new.muc_tieu_id, new.thanh_phan_id, new.student_id, new.ngay, new.nguoi_ghi, new.nguon, new.nguon_ref)
       is distinct from (old.muc_tieu_id, old.thanh_phan_id, old.student_id, old.ngay, old.nguoi_ghi, old.nguon, old.nguon_ref) then
      raise exception 'Muốn đổi ngày thì xoá dòng này rồi ghi lại' using errcode = '23514';
    end if;
    if v_me is not null then new.nguoi_sua := v_me; new.sua_at := now(); end if;
  end if;
  -- Số đọc phải khớp chủ của mục tiêu (em ↔ đúng em; lớp/trường ↔ null). Áp cả nguồn hệ thống.
  if new.student_id is distinct from m.student_id then
    raise exception 'Số này không thuộc đúng chủ của mục tiêu' using errcode = '23514';
  end if;
  if new.thanh_phan_id is not null
     and not exists (select 1 from thanh_phan tp where tp.id = new.thanh_phan_id and tp.muc_tieu_id = new.muc_tieu_id) then
    raise exception 'Phần này không thuộc mục tiêu đó' using errcode = '23514';
  end if;
  -- Khe hẹp máy điểm danh: ẩn danh người ghi, bỏ qua chặn-tay dưới đây.
  if v_he_thong then
    new.nguoi_ghi := null;
    return new;
  end if;
  if v_me is not null then
    new.nguoi_ghi := v_me;
    if new.nguon = 'he_thong' then
      raise exception 'Số do hệ thống ghi không ghi tay được' using errcode = '42501';
    end if;
    if m.trang_thai = 'dong' then
      raise exception 'Mục tiêu đã đóng, không ghi thêm số' using errcode = '23514';
    end if;
    if m.nguon_so in ('thuoc','con') then
      raise exception 'Số của mục tiêu này máy tự cộng từ thước đo/mục tiêu con — không ghi tay được' using errcode = '23514';
    end if;
    if m.nguon_so = 'he_thong' then
      raise exception 'Số của mục tiêu này máy tự lấy từ điểm danh — không ghi tay được' using errcode = '23514';
    end if;
    if m.nguon_so = 'thanh_phan' and new.thanh_phan_id is null then
      raise exception 'Mục tiêu này ghi số theo từng phần — chọn phần trước đã' using errcode = '23514';
    end if;
    if new.ngay > vn_today() then
      raise exception 'Chưa tới ngày đó mà' using errcode = '23514';
    end if;
    if new.ngay < m.bat_dau then
      raise exception 'Ngày này trước khi mục tiêu bắt đầu' using errcode = '23514';
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.th_kiem_tran(t thuoc)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_vuot int;
begin
  if t.trang_thai <> 'chay' or t.pham_vi = 'ca_doi' then return; end if;   -- ca_doi/tam_dung/dong không vào trần
  if t.chu_the = 'em' then
    if private.dem_viec_phai_ghi(t.class_id, t.student_id) >= 4 then       -- +1 dòng mới ⇒ vượt 4
      raise exception 'Đang theo dõi 4 thước đo rồi — kết thúc một thước đo trước nhé' using errcode = '23514';
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
      raise exception 'Thêm thước đo này thì % em vượt 4 thước đo phải ghi', v_vuot using errcode = '23514';
    end if;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION private.th_truoc_sua()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Lớp của thước đo chỉ đổi khi chuyển lớp' using errcode = '42501';
  end if;
  if (new.chu_the, new.student_id, new.nhom_id, new.subject_id)
     is distinct from (old.chu_the, old.student_id, old.nhom_id, old.subject_id) then
    raise exception 'Không đổi được chủ của thước đo — tạo thước đo mới' using errcode = '42501';
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
      raise exception 'Thầy cô không sửa nội dung thước đo của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    -- 0184: thước CÁ NHÂN thầy cô tự đứng tên (0181 tạo với da_tung_duyet=true vì tự duyệt) KHÔNG
    -- đông cứng — tự hứa tự chấm thì sửa tùy thích; guard "đã có lượt" phía dưới vẫn giữ nguyên.
    if old.da_tung_duyet
       and not (old.chu_the = 'em' and old.student_id = v_me and is_class_teacher(old.class_id)) then
      raise exception 'Thước đo này thầy cô đã duyệt rồi. Muốn đổi chỉ tiêu thì đổi từ tuần sau; muốn đổi tên thì gửi yêu cầu cho thầy cô'
        using errcode = '42501';
    end if;
    if exists (select 1 from luot l where l.thuoc_id = new.id)
       and (new.cach_ghi, new.gop, new.chieu_dich, new.don_vi_id, new.pham_vi, new.ky_tuan, new.tu_tuan, new.nguong_moi_lan)
           is distinct from (old.cach_ghi, old.gop, old.chieu_dich, old.don_vi_id, old.pham_vi, old.ky_tuan, old.tu_tuan, old.nguong_moi_lan) then
      raise exception 'Đã có lượt ghi — kết thúc thước đo này và tạo thước đo mới' using errcode = '23514';
    end if;
    if old.duyet = 'tra_lai' then new.duyet := 'gui'; new.ly_do_tra_lai := null; end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  end if;
  if new.duyet is distinct from old.duyet and not (v_doi and new.duyet = 'gui') then
    if new.duyet = 'duyet' then
      if not v_duyet then raise exception 'Chỉ thầy cô chủ nhiệm mới duyệt được thước đo này' using errcode = '42501'; end if;
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
      if not v_ghi then raise exception 'Chỉ chủ thước đo mới gửi duyệt được' using errcode = '42501'; end if;
    end if;
  end if;             -- không nhánh restore: đã ép về old ngay đầu, kể cả ca (v_doi ∧ duyet='gui')
  if new.den_tuan is distinct from old.den_tuan and new.den_tuan is not null and new.den_tuan < vn_week_start() then
    raise exception 'Kết thúc thước đo sớm nhất là hết tuần này' using errcode = '23514';
  end if;
  if new.trang_thai is distinct from old.trang_thai and not (v_ghi or v_duyet) then
    raise exception 'Không có quyền tạm dừng hay đóng thước đo này' using errcode = '42501';
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.th_truoc_xoa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select auth.uid()) is null or (select auth_role()) = 'admin' then return old; end if;
  if exists (select 1 from luot l where l.thuoc_id = old.id) then
    raise exception 'Đã có lượt ghi — kết thúc thước đo này thay vì xoá' using errcode = '23503';
  end if;
  return old;
end $function$
;
-- ═════════════════════════════════════════════════════════════════════════════════════
-- 9. DỌN NỀN
--    · Realtime: audit ghi "app không dùng" — SAI một nửa: AttendanceTable và lib/hub/revocation
--      subscribe postgres_changes trên attendance_records và hub_revoked_sessions. Chỉ bỏ
--      parent_teacher_messages (không có channel nào trong app).
--    · Hub: 61/61 sự kiện failed, HUB_* chưa cấu hình → tắt trigger xếp hàng; bật lại:
--      `alter table luot enable trigger trg_hub_hang_doi_luot;`
--    · Thông báo cũ của mô hình họp lớp (đã gỡ 19/08): 56 dòng "Cô đã ghi biên bản họp WIG…",
--      "Có biên bản họp WIG…", "Buddy nhắn bạn" — không hàm nào còn sinh (đã kiểm pg_proc).
-- ═════════════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime drop table public.parent_teacher_messages;
alter table luot disable trigger trg_hub_hang_doi_luot;
delete from notifications
 where title ~ '^(Cô đã ghi biên bản họp WIG|Có biên bản họp WIG|Buddy nhắn bạn)';

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 10. THƯỚC CẤP LỚP CŨ (chu_the=lop, pham_vi=ca_doi, UI tạo đã gỡ) — viec_bang/bang_lop_em vẫn đếm mà
--     không màn nào hiện → đóng. Chạy bằng postgres nên th_truoc_sua (v_me null) cho qua.
-- ═════════════════════════════════════════════════════════════════════════════════════
update thuoc set trang_thai = 'dong'
 where chu_the = 'lop' and pham_vi = 'ca_doi' and trang_thai <> 'dong';
