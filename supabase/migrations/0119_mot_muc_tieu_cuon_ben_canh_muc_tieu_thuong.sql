-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0119 — MỘT LĨNH VỰC ĐƯỢC PHÉP CÓ CẢ MỤC TIÊU THƯỜNG LẪN MỤC TIÊU CUỘN
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Bắt được bằng cách dựng thật: đăng nhập bằng chính tài khoản GVCN lớp Test, mở nút Tạo, điền
-- "86% học sinh có 6/8 môn từ 6.5 trở lên" cho lĩnh vực Kiến thức — và app trả về "Dữ liệu này đã
-- tồn tại (bị trùng)". Lớp ấy đã có mục tiêu năm Kiến thức ("Điểm trung bình 6 lên 8"), mà
-- wigs_lop_ky_uidx chỉ cho MỘT mục tiêu lớp cho mỗi (lĩnh vực, kỳ).
--
-- Luật "một lĩnh vực một mục tiêu" là đúng và giữ nguyên — nó là thứ giữ cho trang WIG đọc được.
-- Nhưng mục tiêu cuộn không tranh chỗ ấy: nó là một CÂU KHÁC về cùng lĩnh vực. "Điểm trung bình
-- của lớp lên 8" là trận đánh các em góp sức vào; "86% học sinh có 6/8 môn ≥ 6.5" là cách hiệu
-- trưởng và GVCN đọc kết quả của chính các em. Bắt chọn một trong hai là bắt bỏ đi một câu thật.
--
-- Nên khoá vẫn là (lớp, lĩnh vực, kỳ) — chỉ tách làm hai ngăn: thường và cuộn.
drop index if exists wigs_lop_ky_uidx;
create unique index wigs_lop_ky_uidx
  on wigs (class_id, area, period, period_label, ((measure_by = 'cuon')))
  where scope = 'class';

-- Mục tiêu TRƯỜNG trước nay không có khoá nào — bảng chỉ khoá scope='class' và scope='student'.
-- Hiệu trưởng bấm Lưu hai lần là có hai dòng y hệt nhau, và bảng ở /campus hiện hai dòng giống
-- nhau mà không ai biết cái nào mới.
create unique index if not exists wigs_truong_ky_uidx
  on wigs (campus_id, area, period, period_label)
  where scope = 'school';
