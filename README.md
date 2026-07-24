# Viet Anh Class

App lãnh đạo lớp học theo khung **4DX** cho Trường Việt Anh.
Stack: **Next.js 15 (App Router, TS) + Supabase (Postgres + Auth + RLS) + Vercel**.

## Chạy thử trên máy
1. Cài Node.js (xem `../HUONG_DAN_TUNG_BUOC.md`).
2. Mở thư mục này trong VS Code, mở Terminal:
   ```bash
   npm install
   cp .env.example .env.local   # rồi điền URL + anon key Supabase
   npm run dev
   ```
3. Mở http://localhost:3000 (hoặc port khác nếu 3000 bận: `npm run dev -- -p 3001`).

## Đăng nhập demo (không cần Google SSO)
Trang login có sẵn khối **Demo** — bấm nút theo vai trò để vào ngay. Mật khẩu chung `demo1234`
(tạo bởi `supabase/seed.sql`). Các tài khoản: GVCN, Học sinh, Tổ trưởng điểm danh, Admin, BGH, Phụ huynh.

> ⚠️ Khối demo + seed chỉ dùng cho dev/thử. **Xoá trước khi deploy production thật** (khối `DEMO_ACCOUNTS`
> trong `components/auth/LoginForm.tsx` và các phần đánh dấu DEMO trong `seed.sql`).

## Kết nối Supabase
- **Cloud (mặc định trong `.env.local`):** project riêng `viet-anh-class` (tách khỏi AI Tutor như PRD).
- **Local:** chạy `supabase start` rồi đổi `.env.local` sang config LOCAL (đã để sẵn comment trong file).
- Google SSO đã dựng **đầy đủ code + hạ tầng**, chỉ còn bước cắm Client ID/Secret —
  làm theo **`docs/google-sso-setup.md`** (runbook). Cấu hình dạng code: `supabase/config.toml`.

## Cấu trúc
- `app/[locale]/` — trang theo locale: `(auth)/login`, `(dashboard)/` (class, attendance, wig, meeting, report, admin, campus, student…).
- `components/` — UI: `shell/` (nav, intro guide, class picker), `attendance/`, `student/`, `report/`, `charts/`.
- `lib/supabase/` — client & server & middleware (guard quyền theo route).
- `lib/auth.ts` — định tuyến & RBAC theo vai trò.
- `supabase/migrations/0001…0017_*.sql` — schema + RLS + hàm/RPC (dán vào SQL Editor hoặc dùng Supabase CLI).
- `supabase/functions/` — edge functions: `invite-parent`, `attendance-reminders`.
- `supabase/seed.sql` — dữ liệu demo (2 cơ sở, lớp 6A1 + 7B1, học sinh, WIG, họp, mood).

## Tài liệu liên quan
- `PRD_Viet_Anh_Class_v2.md` — yêu cầu sản phẩm chi tiết + bộ prompt build.
- `../Wireframes_Viet_Anh_Class.html` — phác thảo màn hình.
- `../HUONG_DAN_TUNG_BUOC.md` — hướng dẫn từ số 0.
