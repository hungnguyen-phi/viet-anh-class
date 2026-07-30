-- 0067 — Bỏ điều kiện "còn đang học" khỏi WITH CHECK của UPDATE trên student_term_reviews.
--
-- LỖI: policy rls_update_student_term_reviews (0064) có is_enrolled(student_id, class_id) trong
-- WITH CHECK. Nghe thì hợp lý — "chỉ sửa phiếu của em còn học lớp này". Nhưng WITH CHECK bị vi
-- phạm thì Postgres HUỶ NGUYÊN CÂU LỆNH, không phải bỏ qua một dòng.
--
-- Hậu quả thật: giáo viên lưu nhận xét cho cả lớp bằng MỘT câu update (đúng cách — 30 lượt gọi
-- riêng thì trang treo). Chỉ cần MỘT em chuyển trường giữa học kỳ là câu đó vi phạm ở đúng một
-- dòng, và cả 30 em không lưu được gì, báo cụt lủn "Bạn không có quyền". Nút Công bố cũng vậy.
-- Giáo viên sẽ không đoán ra nguyên nhân — em kia đã biến khỏi danh sách lớp từ lâu.
--
-- Đã đo trên production trước khi sửa (transaction rồi rollback): lớp còn đủ thì update 2/2 dòng;
-- cho một em rời lớp rồi update lại → BỊ CHẶN 42501, cả hai dòng đều không lưu.
--
-- SỬA: bỏ is_enrolled khỏi UPDATE. Vẫn GIỮ ở INSERT — đó mới là chỗ nó cần thiết, để không lập
-- được phiếu cho em không thuộc lớp mình. Sửa một phiếu ĐÃ TỒN TẠI thì việc "em còn học không"
-- không còn là câu hỏi đúng: phiếu đó do chính GVCN lập hồi em còn học, và học kỳ vẫn phải kết
-- thúc cho em ấy — điểm và nhận xét của quãng em đã học là dữ liệu có thật, không được đóng băng
-- nửa chừng chỉ vì em chuyển đi.
--
-- KHÔNG nới quyền sang lớp khác: is_class_teacher(class_id) vẫn nguyên, và class_id là cột của
-- chính dòng đó. GVCN vẫn chỉ chạm được phiếu của lớp mình.

drop policy if exists rls_update_student_term_reviews on student_term_reviews;

create policy rls_update_student_term_reviews on student_term_reviews
  as permissive for update to authenticated
  using (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id) and not term_is_locked(term_id))
  )
  with check (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id) and not term_is_locked(term_id))
  );
