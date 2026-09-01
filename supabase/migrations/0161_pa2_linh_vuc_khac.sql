-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0161 — PA2: thêm lĩnh vực "Khác / Other" vào enum wig_domain.  [H-02 gật 01/09/2026]
-- Chủ dự án 01/09/2026: xây thẳng mô hình mục tiêu mới (docs/PA2/), không song song, không di trú.
--
-- VÌ SAO TỆP NÀY ĐÚNG MỘT CÂU, KHÔNG bọc begin/commit (khác mọi tệp 0162→0169):
--   muc_tieu.linh_vuc, muc_tieu_mau.linh_vuc (0163) và area_config.area đều dùng enum wig_domain.
--   Mô hình mới cần một lĩnh vực "rổ" cho mục tiêu không thuộc bốn lĩnh vực 4DX sẵn có.
--   Postgres KHÔNG cho DÙNG một nhãn enum vừa thêm bằng ALTER TYPE ADD VALUE ngay TRONG cùng
--   transaction đã thêm nó (bài học 0115). run-sql.mjs gửi trọn tệp trong một lệnh = một
--   transaction ngầm; nên câu thêm nhãn phải đứng RIÊNG một tệp. 0162 (chạy sau, transaction
--   khác) mới được dùng 'khac' để chèn dòng area_config('khac') và các bảng/CHECK mới.
--   IF NOT EXISTS để chạy lại không lỗi (idempotent). Nhãn enum không xoá được → câu này không có
--   đường lùi; vô hại vì 'khac' chỉ là một lựa chọn THÊM, không đổi nghĩa bốn nhãn cũ (C30 GIỮ).
-- ═══════════════════════════════════════════════════════════════════════════════════

alter type wig_domain add value if not exists 'khac';
