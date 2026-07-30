-- 0059 — Giáo viên chủ nhiệm được XEM và HUỶ lời mời của chính lớp mình.
--
-- LỖI: migration 0058 làm danh sách lớp hiện thêm những em đã được mời mà chưa đăng nhập lần nào
-- (đọc bảng pending_user_grants). Nhưng RLS của bảng đó chỉ mở cho quản trị viên và hiệu trưởng
-- (rls_all_pending_user_grants) — giáo viên chủ nhiệm KHÔNG đọc được dòng nào. Nghĩa là đúng
-- người cần thấy "mình đã mời ai" thì vẫn thấy lớp trống, còn hiệu trưởng — người không cần —
-- lại thấy. Mời được (qua rpc invite_student_to_class, SECURITY DEFINER) nhưng không xem lại
-- được, cũng không huỷ được lời mời gõ sai.
--
-- Đã đo trên production trước khi sửa: quản trị viên thấy đủ, GVCN 7B1 thấy 0 dòng.
--
-- Mở HẸP, đúng hai việc còn thiếu:
--   - SELECT: chỉ những lời mời thuộc lớp mình chủ nhiệm.
--   - DELETE: cũng vậy — để nút "huỷ lời mời" chạy được (cancelStudentInvite xoá trực tiếp).
-- KHÔNG mở INSERT/UPDATE: việc mời vẫn phải đi qua rpc invite_student_to_class, vì ở đó mới có
-- các bước kiểm (email hợp lệ, đã có tài khoản chưa, có đang được mời với vai khác không) và
-- mới tự điền campus_id đúng.
--
-- Chỉ vai 'student': lời mời giáo viên/phụ huynh là việc của quản trị viên, GVCN không dính vào.
-- is_class_teacher() có sẵn từ 0003 (SECURITY DEFINER nên không đệ quy RLS của bảng classes).

create policy rls_teacher_read_own_class_invites on pending_user_grants
  for select
  using (role = 'student' and class_id is not null and is_class_teacher(class_id));

create policy rls_teacher_cancel_own_class_invites on pending_user_grants
  for delete
  using (role = 'student' and class_id is not null and is_class_teacher(class_id));
