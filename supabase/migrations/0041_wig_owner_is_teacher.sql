-- 0041 — Chốt quyền sở hữu WIG về GVCN: bỏ wig_student_self_update.
--
-- PRD §7 (bảng phân quyền): GVCN = "Điểm danh, WIG lớp, lead measure, biên bản họp";
-- Học sinh = "CẬP NHẬT TIẾN ĐỘ lead measure cá nhân, ghi chú Buddy" — không đặt/sửa mục tiêu.
-- PRD §6.2 màn 5-6: WIG tuần + LM tuần sau được "Thiết lập" trong buổi họp Coach × Buddy.
--
-- Thực trạng trước 0041 (đã rà 2026-07-26):
--   - UI + server action ĐÃ đúng: StudentWigSetup render dưới `canManage`, còn
--     createStudentYearWigs / createStudentWeekWigs / editStudentWig / deleteStudentWig đều
--     requireRole(['teacher','admin']). lead_measures cũng đã GVCN-only (lm_manage).
--   - CÒN SÓT: wig_student_self_update (0004_rls_policies.sql:149-151, bê từ bản SQL nháp
--     `wig_student_self_write` ở PRB §9 sang) cho học sinh UPDATE thẳng WIG cá nhân của mình
--     qua PostgREST → tự HẠ target_value được dù UI không có nút.
--
-- Vì sao phải bịt: điểm thi đua (class_competition_scores) = trung bình "lead measure hoàn
-- thành / học sinh", tính theo target. Ai tự hạ target thì tỷ lệ hoàn thành cao hơn → bảng
-- xếp hạng giữa các lớp mất ý nghĩa so sánh, và cam kết trong buổi họp Coach × Buddy mất
-- ràng buộc. Muốn đổi target thì đi qua edit_requests để GVCN duyệt (0034 + 0040).
--
-- Sau 0041, học sinh còn: SELECT wigs (wig_read) + ghi lead_progress trong ngày (0039).
-- Không mất chức năng nào đang dùng — không có code nào ghi `wigs` dưới danh nghĩa học sinh.
set search_path = public;

drop policy if exists wig_student_self_update on wigs;
