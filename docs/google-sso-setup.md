# Bật Google SSO cho Viet Anh Class

App **đã có sẵn toàn bộ code** cho Google SSO (nút đăng nhập, xử lý callback, giới hạn miền email).
Tài liệu này là các bước **cắm** cuối cùng — chỉ cần làm 1 lần, chủ yếu bấm trên Dashboard.

> Trạng thái hạ tầng (đã dựng sẵn, không cần đụng):
> - ✅ Nút "Đăng nhập với Google" — `components/auth/LoginForm.tsx`
> - ✅ Xử lý callback OAuth — `app/[locale]/(auth)/auth/callback/route.ts`
> - ✅ Tạo hồ sơ + gán vai trò theo miền — trigger `handle_new_user` (migration 0005/0008)
> - ✅ Hàm chặn miền lạ — `restrict_signup_by_email_domain` (migration 0005)
> - ✅ Bảng miền cho phép — `signup_email_domains`: `truongvietanh.com → pending`, `student.truongvietanh.com → student`
>
> Chỉ còn thiếu: OAuth client bên Google + bật provider/hook/redirect URLs trên Supabase.

---

## Thông số cố định của project

| Mục | Giá trị |
| :-- | :-- |
| Supabase project | `viet-anh-class` (`eagsageokobtidpmxucx`) |
| **Redirect URI để dán vào Google** | `https://eagsageokobtidpmxucx.supabase.co/auth/v1/callback` |
| App callback (Supabase tự gọi lại) | `/auth/callback` |

---

## Bước 1 — Tạo OAuth client trên Google Cloud Console

1. Vào https://console.cloud.google.com → chọn/tạo project của trường.
2. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** (nếu trường dùng Google Workspace `truongvietanh.com` → chỉ người trong tổ chức đăng nhập được, an toàn nhất). Nếu học sinh ở miền `student.truongvietanh.com` là Workspace khác thì chọn **External** và thêm cả 2 miền vào test users / publish.
   - Điền tên app, email hỗ trợ, logo (tùy chọn).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URIs** → thêm đúng dòng này:
     ```
     https://eagsageokobtidpmxucx.supabase.co/auth/v1/callback
     ```
   - Bấm Create → **lưu lại `Client ID` và `Client secret`**.

---

## Bước 2 — Bật Google provider trên Supabase

1. Dashboard → project **viet-anh-class** → **Authentication → Sign In / Providers → Google**.
2. Bật **Enable Sign in with Google**.
3. Dán **Client ID** và **Client Secret** (từ Bước 1) → **Save**.

## Bước 3 — Khai báo Redirect URLs (nơi được phép quay về sau đăng nhập)

Dashboard → **Authentication → URL Configuration**:
- **Site URL**: URL production (ví dụ `https://viet-anh-class.vercel.app`). Khi dev cứ để localhost cũng được.
- **Redirect URLs** → thêm (mỗi dòng một URL, có `/**` để khớp mọi path):
  ```
  http://localhost:6868/**
  http://localhost:3001/**
  http://localhost:3000/**
  https://viet-anh-class.vercel.app/**
  ```
  (Đổi domain production cho đúng khi deploy thật.)

## Bước 4 — Bật hook chặn miền email (QUAN TRỌNG — an toàn dữ liệu)

Đây là lớp chặn **từ chối tạo tài khoản** với email ngoài miền trường (mạnh hơn lớp trigger mặc định).

Dashboard → **Authentication → Hooks (Auth Hooks)** → **Before User Created**:
- Enable → chọn **Postgres function** → schema `public`, function `restrict_signup_by_email_domain`.
- Save.

> Nếu không thấy mục "Before User Created": lớp dự phòng `handle_new_user` (trigger, đã bật sẵn) vẫn gán
> vai trò đúng theo miền — nhưng nên bật hook này để **chặn hẳn** email lạ ngay từ đầu.

## Bước 5 — Kiểm thử end-to-end

1. Mở app (`http://localhost:6868` hoặc production) → bấm **Đăng nhập với Google**.
2. Đăng nhập bằng email `@truongvietanh.com` → phải vào được, hồ sơ tạo với role `pending`
   (admin nâng quyền sau ở `/admin`), hoặc `@student.truongvietanh.com` → role `student`.
3. Thử email Gmail cá nhân bất kỳ → phải **bị từ chối** (nếu đã bật hook Bước 4).
4. Sau khi có 1 admin: vào `/admin` → nâng vai trò cho GVCN/BGH.

---

## Ghi chú vận hành

- **Phụ huynh** KHÔNG dùng Google SSO — họ nhận magic link qua email (admin mời ở `/admin`, nút "Mời phụ huynh").
- **Tắt khối demo login** trước production: bỏ biến `NEXT_PUBLIC_ENABLE_DEMO` trên Vercel (mặc định không có → nút demo tự ẩn). Và **xóa tài khoản demo `demo1234`** trên DB (xem cuối file).
- Thêm/bớt miền cho phép: sửa bảng `signup_email_domains` (SQL Editor), ví dụ thêm cơ sở mới.
- Cấu hình dạng code (tùy chọn, cho ai dùng Supabase CLI): xem `supabase/config.toml`.

### Xóa tài khoản demo trước go-live (chạy trong SQL Editor)
```sql
-- Gỡ mật khẩu demo (vẫn giữ hồ sơ để không vỡ dữ liệu mẫu), HOẶC xóa hẳn user demo:
-- Cách an toàn: chỉ vô hiệu đăng nhập bằng mật khẩu
update auth.users set encrypted_password = null
where email in (
  'co.lan@truongvietanh.com','hs01@student.truongvietanh.com','hs02@student.truongvietanh.com',
  'admin@truongvietanh.com','bgh@truongvietanh.com','phuhuynh.an@gmail.com'
);
```
