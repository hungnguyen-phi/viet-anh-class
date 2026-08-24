## Sửa gì, vì sao

<!-- Một đoạn ngắn: chuyện gì đang hỏng hoặc thiếu, và vì sao cách sửa này là đúng.
     Đừng liệt kê file đã đổi — diff nói rồi. -->

## Đã kiểm bằng gì

<!-- "Build xanh" không tính. Ghi thật những gì đã chạy, kèm kết quả. -->

- [ ] `npx tsc --noEmit` sạch
- [ ] Đã dựng thật và **NHÌN ẢNH** màn bị ảnh hưởng (`node scripts/chup-trang.mjs <email> <đường-dẫn> ra.png`)
- [ ] Bộ kiểm liên quan trong `scripts/` đã chạy — ghi tên và kết quả:
- [ ] Chuỗi mới có cả `messages/vi.json` và `messages/en.json`
- [ ] Chữ trên màn không có biệt ngữ (không "lead", không "luỹ kế", không "cô" trống không)

## Có đụng CSDL không

- [ ] Không đụng
- [ ] Có migration mới (số tiếp theo, chưa chạy lên production) — tên file:
- [ ] Đã đọc `pg_proc` trước khi `create or replace` hàm đang chạy

## Có gì chủ dự án cần quyết không

<!-- Đổi màu/font, đổi luật, chạy migration lên production, đụng dữ liệu lớp thật — nói ở đây. -->
