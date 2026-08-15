-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0134 — BGH SỬA ĐƯỢC MỤC TIÊU VÀ CAM KẾT, TRONG PHẠM VI CƠ SỞ CỦA MÌNH
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0133 chặn GVCN sửa mục tiêu/cam kết của em, và trong trigger đã chừa đường cho 'admin' lẫn
-- 'principal'. Nhưng chừa trong trigger là chưa đủ: trigger chỉ chạy khi RLS đã cho câu lệnh đi
-- qua, mà cửa RLS duy nhất cho hai bảng ấy là `staff_can_manage_class` — và hàm đó chỉ tính GVCN
-- của lớp cùng admin, KHÔNG tính hiệu trưởng.
--
-- Nên sau 0133, hiệu trưởng không sửa được gì cả: bị chặn ở cửa ngoài, chưa tới lượt trigger.
-- Chủ dự án đã chốt từ trước: "bgh, admin sửa được". Đây là chỗ làm cho câu ấy thành thật.
--
-- ── VÌ SAO KHÔNG SỬA `staff_can_manage_class` ────────────────────────────────────────────────
--
-- Hàm ấy gác hàng chục chính sách trên nhiều bảng — điểm, nhận xét, báo bài, thời khoá biểu.
-- Thêm 'principal' vào đó là mở một lúc mọi cánh cửa ấy, mà phần lớn không ai yêu cầu và không ai
-- kiểm. Thêm hai chính sách RIÊNG, hẹp đúng bằng việc cần, thì đọc lại sau này còn biết vì sao có.
--
-- ── PHẠM VI: CƠ SỞ CỦA CHÍNH MÌNH ────────────────────────────────────────────────────────────
--
-- `is_campus_class` hỏi "lớp này có thuộc cơ sở tôi không". Đây là ranh giới đã dựng sẵn cho vai
-- hiệu trưởng ở khắp nơi trong app, và nó là ranh giới THẬT: dữ liệu của trẻ con ở cơ sở khác
-- không được lọt sang. Bộ kiểm test-quyen-muc-tieu-truong và test-rls-bgh-hoc-sinh canh đúng
-- đường ấy — nếu bản vá này lỡ tay nới rộng, hai bài đó phải đỏ.

-- ── MỤC TIÊU ─────────────────────────────────────────────────────────────────────────────────
drop policy if exists rls_bgh_sua_muc_tieu on wigs;
create policy rls_bgh_sua_muc_tieu on wigs for update
  using (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  with check (auth_role() = 'principal'::user_role and is_campus_class(class_id));

drop policy if exists rls_bgh_xoa_muc_tieu on wigs;
create policy rls_bgh_xoa_muc_tieu on wigs for delete
  using (auth_role() = 'principal'::user_role and is_campus_class(class_id));

-- ── CAM KẾT TUẦN ─────────────────────────────────────────────────────────────────────────────
drop policy if exists rls_bgh_sua_cam_ket on commitments;
create policy rls_bgh_sua_cam_ket on commitments for update
  using (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  with check (auth_role() = 'principal'::user_role and is_campus_class(class_id));

drop policy if exists rls_bgh_xoa_cam_ket on commitments;
create policy rls_bgh_xoa_cam_ket on commitments for delete
  using (auth_role() = 'principal'::user_role and is_campus_class(class_id));
