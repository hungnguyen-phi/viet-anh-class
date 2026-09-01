-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0170 — Thêm MÔ TẢ cho mục tiêu (chủ dự án 02/09/2026, form SMART)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Form đặt mục tiêu nay theo chuẩn SMART, có ô "mô tả" để em giải thích chi tiết cách làm — vừa
-- giúp em nghĩ kỹ hơn, vừa để thầy cô (và về sau là chấm chất lượng) hiểu đúng ý. `muc_tieu` chỉ
-- có `ten` (tiêu đề ngắn) và `y_chu` (đích bằng lời cho kiểu không-số), chưa có chỗ cho mô tả tự
-- do áp dụng cho MỌI kiểu mục tiêu. Thêm một cột text nullable — không phá dòng cũ, không ràng
-- buộc bắt buộc (mô tả là khuyến khích, không cưỡng ép).
--
-- `mo_ta` là NỘI DUNG: sửa nó ở mục tiêu đã duyệt phải đưa về chờ duyệt lại. Trigger duyệt
-- (private.mt_truoc_sua, 0163) viết theo whitelist "cột KHÔNG phải nội dung" nên cột mới này MẶC
-- ĐỊNH rơi vào nhóm nội dung — không cần sửa trigger. Đã đọc pg_get_functiondef 02/09 để chắc.

alter table muc_tieu add column if not exists mo_ta text;

comment on column muc_tieu.mo_ta is
  'Mô tả tự do em giải thích cách làm (form SMART, 0170). Nội dung → sửa sau duyệt phải duyệt lại.';
