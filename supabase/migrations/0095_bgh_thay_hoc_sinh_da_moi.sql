-- BAN GIÁM HIỆU PHẢI THẤY CẢ NHỮNG EM MỚI ĐƯỢC MỜI, KHÔNG CHỈ EM ĐÃ ĐĂNG NHẬP.
--
-- Soi trên production ngay sau 0094: hiệu trưởng mở lớp 10A1 ra chỉ thấy ĐÚNG MỘT dòng, trong
-- khi lớp ấy có 10 em đã được mời. Danh sách gần như trống, mà không có câu nào nói vì sao.
--
-- Nguyên nhân là một chỗ khớp lệch giữa hai bản viết cách nhau nhiều tháng:
--
--   · 0049 cho hiệu trưởng đọc lời mời trong cơ sở mình, nhận diện bằng CỘT campus_id của chính
--     hàng lời mời ấy.
--   · Nhưng hàm mời hàng loạt (/admin → Mời người dùng) chỉ ghi email, vai và lớp — KHÔNG ghi
--     campus_id. Nên mọi lời mời tạo bằng đường ấy đều có campus_id rỗng, và với hiệu trưởng thì
--     chúng vô hình.
--
-- GVCN không dính vì 0059 cho họ đọc theo LỚP (is_class_teacher), không theo campus_id. Đó cũng
-- là cách đúng hơn: lớp thì luôn biết nó thuộc cơ sở nào, còn campus_id chép sang hàng lời mời
-- là một bản sao, mà bản sao thì có ngày quên chép.
--
-- Nên sửa hai lớp:
--   1. Thêm đường đọc theo LỚP cho hiệu trưởng — không phụ thuộc cột campus_id nữa.
--   2. Điền bù campus_id cho những hàng đang rỗng, để các chỗ khác còn đọc theo cột ấy vẫn đúng.
-- Và ở phía ứng dụng, hàm mời hàng loạt từ nay ghi luôn campus_id (xem inviteUser).
set search_path = public;

-- ── 1. HIỆU TRƯỞNG ĐỌC/QUẢN LỜI MỜI THEO LỚP TRONG CƠ SỞ MÌNH ─────────────────────────────
-- is_campus_class() đã có sẵn và là SECURITY DEFINER, nên không kéo theo RLS của bảng classes.
-- Giữ nguyên trần của 0049: KHÔNG cho mời admin/principal — hiệu trưởng không tự nâng vai mình
-- hay dựng thêm người ngang quyền.
drop policy if exists rls_principal_class_invites on pending_user_grants;
create policy rls_principal_class_invites on pending_user_grants
  for all
  using (
    (select auth_role()) = 'principal'::user_role
    and class_id is not null
    and is_campus_class(class_id)
  )
  with check (
    (select auth_role()) = 'principal'::user_role
    and class_id is not null
    and is_campus_class(class_id)
    and role in ('teacher'::user_role, 'student'::user_role, 'parent'::user_role)
  );

-- ── 2. ĐIỀN BÙ CƠ SỞ CHO NHỮNG LỜI MỜI ĐANG RỖNG ──────────────────────────────────────────
-- Chỉ đụng hàng có lớp và đang rỗng cơ sở; hàng đã có cơ sở thì để yên, kể cả khi khác với cơ sở
-- của lớp — trường hợp ấy là chuyện của người khai, không phải chuyện của migration này.
update pending_user_grants g
   set campus_id = c.campus_id
  from classes c
 where g.class_id = c.id
   and g.campus_id is null;
