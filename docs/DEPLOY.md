# Deploy — Viet Anh Class (Next.js standalone → VPS container)

Runbook cụ thể cho dự án này, bám theo `DEPLOY-PLAYBOOK.md` (build ở CI → GHCR → Coolify pull chạy).
File repo đã tạo sẵn: `Dockerfile`, `.dockerignore`, `.github/workflows/deploy.yml`,
`app/api/health/route.ts`, và `output: 'standalone'` trong `next.config.ts`.

> ⚠️ **CẬP NHẬT GO-LIVE (2026-07-25).** Ghi chú audit 2026-07-22 chấm production **35/100**: RLS còn
> rò dữ liệu học sinh (trẻ em), mất điểm danh, WIG cá nhân lỗi. **Đã viết xong migration
> `supabase/migrations/0037_audit_fixes_100.sql` + fix code vá toàn bộ các lỗi cụ thể đã xác nhận**
> (mất điểm danh do RPC `mark_attendance_on` drift chưa có migration, timezone `student_checkin()`
> dùng `current_date` UTC thay vì `vn_today()`, storage `class-covers` không kiểm chủ sở hữu lớp,
> "Duyệt & gỡ tick" xoá nhầm toàn bộ lịch sử tick thay vì 1 lượt, thiếu GRANT `pending_user_grants`).
> **CHƯA áp migration này lên Supabase production** — cần tự chạy `supabase db push` (hoặc dán
> `0037_audit_fixes_100.sql` vào SQL Editor) trước khi coi là đã khắc phục trên môi trường thật.

---

## 1. Biến môi trường — chỗ đặt quyết định đúng/sai

| Biến | Loại | Đặt ở đâu | Vì sao |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public, **build-time** | GitHub **Secret** → build-arg (đã nối trong workflow) | `NEXT_PUBLIC_*` bị **nội tuyến lúc `next build`**, không đọc lúc chạy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public, **build-time** | GitHub **Secret** → build-arg | như trên (anon key vốn public, RLS bảo vệ dữ liệu) |
| `SUPABASE_SERVICE_ROLE_KEY` | **bí mật, runtime** | **Coolify → Environment variables** | server-only (cổng IP check-in). **KHÔNG** bake vào image, KHÔNG là build-arg |
| `PORT` | runtime | Coolify (`8080`) | khớp `EXPOSE 8080` / healthcheck |
| `NEXT_PUBLIC_ENABLE_DEMO` | — | **KHÔNG set ở production** | có set = hiện khối demo login. Bỏ trống = ẩn |

> Nên set **cả 3 biến Supabase** trong Coolify runtime (URL + anon + service_role) cho chắc, dù 2 biến
> `NEXT_PUBLIC_*` đã bake lúc build — phòng khi có chỗ đọc `process.env` động phía server.

---

## 2. GitHub — Secrets & Variables
`Settings → Secrets and variables → Actions`

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` (project VAC production) |
| Secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key của project đó |
| Variable | `DEPLOY_ON` | `true` khi đã dựng xong Coolify (chưa có thì để trống → chỉ build+push) |
| Secret | `DEPLOY_HOOK_URL` | URL Coolify, vd `https://coolify.<domain>` |
| Secret | `DEPLOY_TOKEN` | API token Coolify |
| Secret | `DEPLOY_APP_ID` | UUID app trên Coolify |

Đẩy image lên GHCR dùng `GITHUB_TOKEN` sẵn (`packages: write` đã khai trong workflow) — không cần token riêng.

> ✅ Lấy `<ref>` production trong `.env.local` (dòng `NEXT_PUBLIC_SUPABASE_URL`). Theo ghi chú dự án,
> project cloud VAC là `eagsageokobtidpmxucx` — **kiểm tra lại** để không nhầm với project AI Tutor.

---

## 3. Coolify (VPS) — resource kiểu **Docker Image**
1. **+ New Resource → Docker Image** (KHÔNG phải "from Git" — để CI build, VPS chỉ pull).
2. Image: `ghcr.io/<owner>/viet-anh-class:latest`. GHCR để Private → thêm **Registry Credential**
   (Personal Access Token quyền `read:packages`).
3. **Environment variables** (mục §1): `SUPABASE_SERVICE_ROLE_KEY`, `PORT=8080`, và 2 biến
   `NEXT_PUBLIC_SUPABASE_*`. **KHÔNG** thêm `NEXT_PUBLIC_ENABLE_DEMO`.
4. **Port**: app nghe `8080` (đã `EXPOSE`).
5. **Domain**: gắn `https://<your-domain>` (có `https://` để proxy sinh middleware đúng).
6. **Healthcheck**: Dockerfile đã có (`/api/health`, `start-period=40s`) — đủ cho app boot.

---

## 4. Tên miền + TLS (Cloudflare)
- Bản ghi **A**: `<your-domain>` → IP VPS, **Proxy = ON**.
- SSL/TLS mode **Full**.
- Cloudflare timeout ~100s → tác vụ dài (báo cáo nặng, gửi nhắc điểm danh) nên **chạy nền/edge function**
  kẻo dính lỗi **524**.

---

## 5. Supabase production — BẮT BUỘC trước khi mở cho người dùng thật
1. **Migrations**: áp `supabase/migrations/0001…00xx_*.sql` lên project production
   (`supabase db push` hoặc dán vào SQL Editor). Không có schema = app trắng/lỗi.
2. **KHÔNG chạy `supabase/seed.sql`** trên production (đó là dữ liệu demo + mật khẩu `demo1234`).
3. **Edge functions**: deploy `invite-parent`, `attendance-reminders` (`supabase functions deploy ...`).
   Đặt secret cho function nếu cần (service role, SMTP…).
4. **Auth → URL Configuration**: đặt **Site URL** = `https://<your-domain>` và thêm **Redirect URLs**
   cho domain production — nếu không, đăng nhập/Google SSO/magic link sẽ redirect sai.
5. **Google SSO**: cắm Client ID/Secret theo `docs/google-sso-setup.md`; thêm domain production vào
   Authorized redirect URIs bên Google Cloud Console.
6. **Storage**: `next.config.ts` đã cho ảnh `*.supabase.co` — kiểm bucket/policy ảnh bìa lớp, avatar.

---

## 6. Lần deploy đầu
1. Đặt xong Secrets §2 (ít nhất 2 biến `NEXT_PUBLIC_SUPABASE_*`).
2. `git push` nhánh `main` → tab **Actions** chạy `build-and-push` → image lên
   `ghcr.io/<owner>/viet-anh-class:latest`. (`DEPLOY_ON` chưa `true` → job `deploy` bỏ qua, đúng ý.)
3. Dựng Coolify §3, rồi set `DEPLOY_ON=true` + 3 secret `DEPLOY_*`.
4. Push lại (hoặc **Run workflow** thủ công / bấm Deploy trong Coolify) → platform pull & chạy.
5. Mở `https://<your-domain>`. Kiểm `https://<your-domain>/api/health` trả `{"status":"ok"}`.

---

## 7. Checklist go-live nhanh
- [ ] 2 secret `NEXT_PUBLIC_SUPABASE_*` đã đặt (build-arg) — đúng project production.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` đặt ở **Coolify runtime**, KHÔNG trong image/CI.
- [ ] KHÔNG set `NEXT_PUBLIC_ENABLE_DEMO` → khối demo ẩn.
- [ ] Migrations đã áp; **KHÔNG** seed demo lên production.
- [ ] Edge functions đã deploy.
- [ ] Supabase Auth Site URL + Redirect URLs trỏ domain production.
- [ ] Cloudflare A record + Proxy ON + SSL Full.
- [ ] `/api/health` xanh; container healthy trong Coolify.
- [ ] ⚠️ (Khuyến nghị) RLS/audit đã vá trước khi mở cho phụ huynh/học sinh thật.

---

## 8. Sự cố nhanh
| Triệu chứng | Xử lý |
|---|---|
| Push xong không deploy | `DEPLOY_ON` chưa `true`, hoặc thiếu secret `DEPLOY_*`. Xem log job `deploy`. |
| App chạy nhưng không kết nối Supabase | Quên set 2 build-arg `NEXT_PUBLIC_*` → bundle client rỗng URL/key. Set secret rồi **build lại**. |
| Check-in cảm xúc/điểm danh lỗi | Thiếu `SUPABASE_SERVICE_ROLE_KEY` ở Coolify runtime. |
| Đăng nhập redirect sai | Supabase Auth Site URL/Redirect URLs chưa trỏ domain production. |
| Proxy "no available server" | Domain thiếu `https://`. Sửa thành `https://<your-domain>`. |
| Tác vụ dài lỗi `524` | Cloudflare timeout (~100s). Chạy nền / tách qua edge function. |
| `docker pull ... denied` | GHCR Private, Coolify thiếu Registry Credential `read:packages`. |
| Vẫn thấy nút demo login | Đã lỡ set `NEXT_PUBLIC_ENABLE_DEMO=1` lúc build/runtime → bỏ đi, build lại. |
