-- 0066 — Siết hai thứ advisor Supabase bắt được sau khi áp 0061–0065.
--
-- (1) HÀM TRIGGER SECURITY DEFINER MÀ ANON GỌI ĐƯỢC.
--
-- `create function` của Postgres mặc định cấp EXECUTE cho PUBLIC, tức là cả vai `anon` (khách
-- chưa đăng nhập). Với hàm thường thì phiền; với hàm SECURITY DEFINER thì đó là một hàm CHẠY
-- BẰNG QUYỀN CHỦ SỞ HỮU mà người lạ gọi được.
--
-- Ba hàm dưới đây là hàm TRIGGER — chỉ Postgres được gọi, lúc ghi vào bảng. Không có lý do nào
-- để bất kỳ vai nào gọi trực tiếp. Trong 0065 tôi đã khoá đúng cách (pt_stamp_message và
-- pt_after_message chỉ còn postgres + service_role); 0064 và 0061 thì sót.
--
-- Chưa từng khai thác được gì qua chúng — gọi tay ngoài ngữ cảnh trigger thì Postgres báo lỗi
-- ngay. Nhưng đây là bề mặt thừa, và bịt tốn đúng ba dòng.
--
-- (2) HÀM THIẾU `set search_path`.
--
-- Không ghim search_path thì hàm giải tên bảng theo search_path của NGƯỜI GỌI. Người gọi tạo một
-- schema riêng có bảng trùng tên rồi đặt nó lên trước là hàm đọc nhầm bảng. Toàn bộ dự án đã
-- theo lệ ghim (xem 0003), hai hàm này sót.
--   • default_score_weight  — mới, từ 0064
--   • standard_grade_numbers — có từ trước, tiện tay ghim luôn cho hết cảnh báo

-- ── (1) Hàm trigger: gỡ quyền của PUBLIC/anon/authenticated ───────────────────
revoke all on function touch_updated_at()     from public, anon, authenticated;
revoke all on function review_guard()         from public, anon, authenticated;
revoke all on function audit_review_publish() from public, anon, authenticated;

-- ── (2) Ghim search_path ─────────────────────────────────────────────────────
-- `alter function ... set` giữ nguyên thân hàm, không cần chép lại định nghĩa (chép lại là cơ
-- hội để sai một chỗ mà không ai đọc ra).
alter function default_score_weight(score_kind)      set search_path = public;
alter function standard_grade_numbers(school_level)  set search_path = public;
