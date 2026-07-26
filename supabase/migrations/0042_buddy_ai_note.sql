-- 0042 — Buddy 4DX là LLM: lưu ghi chú Buddy do AI sinh vào wig_meetings.
--
-- Bối cảnh: PRD §7 cho học sinh "ghi chú Buddy" nhưng chưa từng có đường thực hiện —
-- wig_meetings chỉ có wm_student_select (đọc), mọi thao tác ghi thuộc wm_teacher_all/wm_admin_all.
-- Quyết định 2026-07-26: Buddy KHÔNG phải bạn cùng lớp mà là LLM (DeepSeek qua OpenRouter).
--
-- Vì sao KHÔNG dùng cột buddy_id sẵn có: nó là FK -> profiles(id), tức phải tạo một "user ma"
-- cho AI — user đó sẽ lọt vào danh sách nhân sự, vào enrollments, vào các truy vấn đếm người.
-- Tách cột riêng rẻ hơn và không làm bẩn bảng profiles. buddy_id giữ nguyên cho trường hợp
-- sau này vẫn muốn ghi nhận một bạn đồng hành là NGƯỜI THẬT.
--
-- Vì sao KHÔNG mở policy ghi cho học sinh: ghi chú do server sinh (server action gọi OpenRouter
-- bằng service_role, giống checkinMood) → học sinh vẫn không ghi trực tiếp được vào biên bản họp,
-- không tự bịa nội dung Buddy. Đọc thì wm_student_select / wm_parent_select đã lo.
--
-- QUYỀN RIÊNG TƯ (DATA_GOVERNANCE §1-§2): tiến độ + biên bản họp là PII học sinh nhạy cảm cao,
-- mà gọi OpenRouter là dữ liệu RA KHỎI vành đai RLS sang nhà cung cấp thứ ba. Vì vậy lib/buddy.ts
-- chỉ gửi số liệu ĐÃ BÓC DANH TÍNH (lĩnh vực, mục tiêu, đã đạt, số ngày còn lại) — không tên,
-- không email, không UUID. buddy_note_model ghi lại model đã dùng để truy vết về sau.
set search_path = public;

alter table wig_meetings
  add column if not exists buddy_note       text,
  add column if not exists buddy_note_model text,
  add column if not exists buddy_note_at    timestamptz;

comment on column wig_meetings.buddy_note is
  'Ghi chú Buddy do LLM sinh (DeepSeek qua OpenRouter). Ghi bằng service_role ở server action askBuddyNote; học sinh chỉ đọc.';
comment on column wig_meetings.buddy_note_at is
  'Lần sinh gần nhất — dùng để giới hạn 1 lần/ngày (giờ VN) cho đỡ tốn tiền API.';
