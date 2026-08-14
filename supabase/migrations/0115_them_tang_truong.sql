-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0115 — MỞ TẦNG TRƯỜNG CHO wig_scope
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Tách riêng một tệp chỉ để thêm một giá trị enum, vì Postgres không cho DÙNG giá trị vừa thêm
-- trong cùng một giao dịch với lúc thêm. Gộp chung với 0116 thì mọi hàm nhắc tới 'school' sẽ nổ
-- ngay lúc tạo. Chạy tệp này trước, 0116 sau.
alter type wig_scope add value if not exists 'school';
