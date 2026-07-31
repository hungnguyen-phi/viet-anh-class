# Coolify đang gửi chìa khoá quản trị sang app

> **CHỦ DỰ ÁN ĐÃ QUYẾT ĐỊNH (2026-07-31): GIỮ NGUYÊN, KHÔNG ĐỔI TÊN MIỀN.**
>
> Không phải việc treo. Đừng tự sửa. Ghi lại đây để người đọc sau biết chuyện này đã được cân
> nhắc và bỏ qua có chủ đích, và để nếu sau này đổi ý thì có sẵn các bước.
>
> Hệ quả cần nhớ: chừng nào Coolify còn ở `vietanh.org`, **một lỗ XSS trong app sẽ leo thẳng
> thành chiếm máy chủ**, chứ không dừng ở chiếm app. Nghĩa là mọi thứ nhận đầu vào từ người dùng
> rồi đưa ra màn hình đều phải cẩn thận hơn mức bình thường. Nếu sau này bật CSP sang chế độ chặn
> (hiện đang report-only, xem `next.config.ts`) thì đó là lớp phòng thủ đáng giá nhất còn lại.

**Mức độ:** không phải lỗi của app, nhưng app đang gánh rủi ro thay.

## Chuyện gì đang xảy ra

Cookie là mẩu giấy nhớ trình duyệt giữ hộ một trang web, để lần sau vào không phải đăng nhập lại.
Quy tắc của trình duyệt: **cookie đặt cho `vietanh.org` sẽ tự động gửi kèm sang MỌI tên miền con**
— `class.vietanh.org`, và bất kỳ cái nào khác.

Coolify (công cụ deploy) đang chạy trên `vietanh.org` và đặt ở đó một cookie đăng nhập, bên trong
ghi `isSuperAdmin: true`. Nên mỗi lần ai đó mở `class.vietanh.org`, trình duyệt **gửi kèm luôn
chìa khoá quản trị Coolify sang** — dù app không hỏi và không dùng gì tới nó.

Đọc được ngay trong lúc kiểm tra app (2026-07-30), bằng một dòng JavaScript trong tab đang mở:

```
auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  → {"email":"hung.nguyen@truongvietanh.com", "isSuperAdmin":true, ...}
```

## Vì sao đáng lo

App có header chống XSS và CSP (đang ở chế độ chỉ ghi log, xem `next.config.ts`), nên chưa có lỗ
nào đã biết. Nhưng nếu **một ngày nào đó** app dính XSS — kẻ xấu chèn được đoạn mã chạy trong
trang — thì đoạn mã đó đọc được cookie kia và chiếm được Coolify, tức là **chiếm cả máy chủ**,
không chỉ app.

Nói cách khác: một lỗ nhỏ trong app đang được nối thẳng vào quyền cao nhất của hạ tầng. Hai thứ
đó lẽ ra phải tách rời.

Bản thân cookie cũng đang đi qua đường truyền tới một máy chủ khác (app) trong mọi request — chỗ
nó không có việc gì phải tới.

## Cách sửa

Cho Coolify một tên miền **không cùng họ** với `vietanh.org`. Ví dụ `deploy.truongvietanh.com`
hoặc một tên miền riêng hẳn.

1. Trỏ bản ghi DNS mới về IP máy chủ Coolify.
2. Trong Coolify → Settings → Instance Domain: đổi sang tên miền mới, để nó cấp chứng chỉ TLS.
3. Đăng nhập lại bằng tên miền mới.
4. Xoá cookie cũ: mở `https://vietanh.org`, DevTools → Application → Cookies → xoá hết.
5. Kiểm lại: mở `https://class.vietanh.org`, DevTools → Application → Cookies. Chỉ được còn cookie
   của chính app (`sb-...-auth-token`, `NEXT_LOCALE`). Không còn dòng `auth=`.

**Không đụng gì tới app** — không sửa code, không deploy lại.

## Cách khác, kém hơn

Nếu bắt buộc giữ Coolify trên `vietanh.org`: đặt cookie của nó thành `__Host-` prefix (khoá cứng
vào đúng một host, không gửi sang tên miền con). Nhưng đó là cấu hình bên trong Coolify, phụ
thuộc phiên bản, và mỗi lần nâng cấp lại phải kiểm lại. Đổi tên miền dứt điểm hơn.
