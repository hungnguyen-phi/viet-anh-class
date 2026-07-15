# Viet Anh Class

App lãnh đạo lớp học theo khung 4DX cho Trường Việt Anh.
Stack: **Next.js + Supabase + Vercel**.

## Chạy thử trên máy
1. Cài Node.js (xem `../HUONG_DAN_TUNG_BUOC.md`).
2. Mở thư mục này trong VS Code, mở Terminal và chạy:
   ```bash
   npm install
   cp .env.example .env.local   # rồi điền key Supabase
   npm run dev
   ```
3. Mở http://localhost:3000

## Cấu trúc
- `app/` — các trang (page.tsx = Trang lớp, login/ = đăng nhập)
- `lib/supabase/` — kết nối Supabase (client & server)
- `middleware.ts` — chặn route theo quyền (hoàn thiện ở Prompt 2)
- `supabase/migrations/0001_init.sql` — schema + RLS, dán vào Supabase SQL Editor

## Tài liệu liên quan
- `../PRD_Viet_Anh_Class_v2.md` — yêu cầu sản phẩm chi tiết + bộ prompt build
- `../Wireframes_Viet_Anh_Class.html` — phác thảo 8 màn hình
- `../HUONG_DAN_TUNG_BUOC.md` — hướng dẫn từ số 0
