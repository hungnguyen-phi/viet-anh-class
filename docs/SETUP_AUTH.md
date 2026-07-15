# Thiết lập đăng nhập (các bước thủ công — [NGƯỜI])

App đã có sẵn code đăng nhập (Google OAuth + magic link phụ huynh) và 3 lớp giới hạn miền.
Để đăng nhập chạy thật, cần làm các bước cấu hình sau (không tự động hoá qua tool được).

Thông tin dự án:
- **Supabase project**: `Viet Anh Class` — ref `iycuuhrnuavmywabdxqd`
- **Supabase URL**: `https://iycuuhrnuavmywabdxqd.supabase.co`
- **App URL (production)**: `https://viet-anh-class.vercel.app`

---

## 1. Google Cloud Console — tạo OAuth client

1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo/chọn project.
2. **APIs & Services → OAuth consent screen**: chọn **Internal** (giới hạn trong Google Workspace `truongvietanh.com`) → điền tên app, email hỗ trợ.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URI**: `https://iycuuhrnuavmywabdxqd.supabase.co/auth/v1/callback`
4. Lưu lại **Client ID** và **Client Secret**.

> Lưu ý: học sinh dùng `@student.truongvietanh.com`. Nếu đây là Workspace **khác** với nhân sự, có thể cần consent screen cho phép cả 2 miền (hoặc chọn External + giới hạn bằng Auth Hook đã cài sẵn).

## 2. Supabase Dashboard — bật Google + cấu hình URL

1. **Authentication → Providers → Google**: bật, dán **Client ID** + **Client Secret** ở bước 1.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://viet-anh-class.vercel.app`
   - **Redirect URLs** (thêm từng dòng):
     - `https://viet-anh-class.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`
     - `https://*.vercel.app/auth/callback` (cho preview deploy, nếu muốn)
3. **Authentication → Hooks → Before User Created**: bật, trỏ tới Postgres function
   `public.restrict_signup_by_email_domain` (đã tạo sẵn ở migration `0005`).
   → Đây là Lớp 1 chặn tạo user sai miền. Sau khi bật, **thử đăng nhập 1 email lạ** để xác nhận bị chặn.

## 3. Email magic link (phụ huynh)
Mặc định Supabase tự gửi email (giới hạn lượng nhỏ — đủ cho pilot). Khi lên production thật,
nên cấu hình **SMTP riêng** (Authentication → Emails → SMTP) + miền gửi để tránh vào spam.

## 4. Tạo Admin đầu tiên
Nhân sự `@truongvietanh.com` đăng nhập lần đầu sẽ có role `pending` (thấy trang "Tài khoản chưa được cấp quyền").
Để có admin đầu tiên, chạy SQL (Supabase → SQL Editor) sau khi người đó đã đăng nhập 1 lần:

```sql
update public.profiles set role = 'admin'
where email = 'dia-chi-email-admin@truongvietanh.com';
```

Từ admin này, các vai trò khác (principal/teacher) được gán trong màn Quản trị (M3) hoặc bằng SQL tương tự.

## 5. Kiểm thử nhanh sau khi cấu hình
- Đăng nhập Google bằng email `@truongvietanh.com` → nếu chưa là admin → thấy trang "chưa được cấp quyền".
- Sau khi `update ... role='admin'` → đăng nhập lại → vào thẳng `/admin`.
- Email lạ (ngoài miền, chưa được mời) → bị chặn (nếu đã bật hook ở 2.3) hoặc rơi vào `pending`.
- Học sinh `@student.truongvietanh.com` → vào `/` (trang lớp).
