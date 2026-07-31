-- 0071 — Trả lại policy SELECT cho bucket class-covers. Không có nó thì KHÔNG AI upload được.
--
-- LỖI: chủ trường báo "tính năng đăng ảnh bìa lớp chưa được". Đo trên production trước khi sửa:
-- storage.objects với bucket_id='class-covers' có ĐÚNG 0 hàng, và 0/6 lớp có cover_image_url —
-- tức là chưa một lần upload nào thành công, kể từ khi tính năng ra đời.
--
-- NGUYÊN NHÂN, nghe rất trái khoáy: thiếu policy ĐỌC làm hỏng đường GHI.
--   • 0006 tạo bucket kèm policy class_covers_public_read.
--   • 0013 xoá policy đó, lý do ghi trong comment: "Public bucket không cần policy SELECT rộng
--     (URL công khai /object/public vẫn truy cập object)". Đúng cho chiều ĐỌC. Bỏ sót chiều GHI.
--   • Client gọi .upload(path, file, {upsert: true}). Đường upsert của storage-api chạy
--     `INSERT ... ON CONFLICT ... RETURNING *`. Mệnh đề RETURNING đọc lại dòng vừa ghi, nên
--     BẮT BUỘC phải có policy SELECT. Không có → 42501 ở mọi lần bấm nút.
--
-- Đã cô lập tận gốc bằng SQL (mỗi phép trong transaction rồi rollback):
--   INSERT thường                          → 42501
--   INSERT ... ON CONFLICT DO UPDATE       → 42501
--   như trên + thêm TẠM policy SELECT       → THÀNH CÔNG
--   như trên + chỉ thêm WITH CHECK cho UPDATE → vẫn 42501
-- Chỉ riêng policy SELECT là đủ. Không phải do dung lượng ảnh, không phải do .HEIC — ảnh 5MB và
-- ảnh HEIC cùng lỗi 403; bỏ upsert đi thì cùng file đó lên được ngay.
--
-- HẸP HƠN BẢN 0006, giữ đúng tinh thần 0013: chỉ cấp cho 'authenticated' và chỉ với ảnh của lớp
-- người đó quản, KHÔNG mở lại cho 'anon'. Người xem ảnh bìa vẫn đi qua URL công khai
-- /object/public như trước, không đụng tới policy này.
--
-- can_manage_class_cover(name) có sẵn từ 0037: bóc thư mục cấp 1 của đường dẫn ra làm class_id
-- rồi hỏi người gọi có quản lớp đó không.

create policy class_covers_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'class-covers' and can_manage_class_cover(name));
