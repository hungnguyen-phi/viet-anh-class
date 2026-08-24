# CLAUDE.md — luật của dự án Việt Anh Class

File này là thứ Claude đọc đầu mỗi phiên. Nó không phải tài liệu giới thiệu; nó là **những điều
làm sai thì hỏng thật** — hỏng ở đây nghĩa là 700 học sinh và giáo viên đang dùng app thấy hỏng.

App đang **chạy thật** tại https://class.vietanh.org. Đẩy lên `main` là **deploy thẳng production**,
không có bước duyệt, không có staging. Đọc kỹ mục "Git" trước khi commit bất cứ thứ gì.

---

## 1. Hai luật không được phá

**① Không đổi bản sắc đã có.** Navy `#26275d` + gold `#f9dd0e`, font Baloo 2 + Nunito, nền trắng —
đã chốt. Cấm đổi màu, đổi font, đổi bố cục trang đăng nhập, "làm mới" giao diện. Cải thiện là
*trong* hệ này. Thêm màn mới thì tái dùng đúng token và component đang có (`components/ui/`).

**② Chữ trên màn phải để học sinh lớp 5 đọc hiểu ngay.** Cấm biệt ngữ:

| Đừng viết | Viết |
|---|---|
| lead / lead measure | Việc |
| luỹ kế | Từ đầu tới giờ |
| cô (trống không) | thầy cô |
| WIG (trên màn của em) | Mục tiêu |

Mọi chuỗi mới phải có **cả `messages/vi.json` và `messages/en.json`** — tiếng Việt là ngôn ngữ thứ
nhất, nhãn tiếng Việt dài hơn tiếng Anh 20–30%, thử bề rộng bằng chuỗi tiếng Việt thật.

## 2. Đọc trước khi sửa

| Sửa gì | Đọc trước |
|---|---|
| Bất cứ thứ gì về giao diện | `PRODUCT.md` — người dùng, tính cách, nguyên tắc thiết kế |
| Mục tiêu / cam kết / tick | `docs/MO_HINH_WIG.md` |
| Ai thấy gì, ai làm được gì | `docs/ROLE_MATRIX.md` |
| Dữ liệu học sinh, LLM | `docs/DATA_GOVERNANCE.md` |
| Hạ tầng, biến môi trường | `docs/DEPLOY.md` |

## 3. Bản đồ: màn hình → file

```
Màn của học sinh        app/[locale]/(dashboard)/student/   + components/student/
  · mục tiêu 4 ô          components/student/MucTieuCuaCon.tsx · FormMucTieu.tsx
  · cam kết + tick        components/wig/CamKetCuaEm.tsx · SuaCamKet.tsx · LeadTicker
  · họp PDR với buddy     components/student/HopPdr.tsx + student/pdr-actions.ts
Màn WIG của giáo viên   app/[locale]/(dashboard)/wig/      + components/wig/
  · bảng các em, nút Duyệt  components/wig/BangCacEm.tsx · NutDuyet.tsx
Điểm danh               app/[locale]/(dashboard)/attendance/ + components/attendance/
Quản trị / cơ sở        app/[locale]/(dashboard)/admin · campus · subjects
Quyền theo route        middleware.ts + lib/supabase/middleware.ts + lib/auth.ts
Chuỗi hiển thị          messages/vi.json · messages/en.json
CSDL                    supabase/migrations/0001…0155_*.sql
```

## 4. Dữ liệu: đây là production, có dữ liệu trẻ em thật

- **Chỉ thử trên lớp `Test`.** Tài khoản: `test1.hs@student.truongvietanh.com` (học sinh),
  `tunhien01@truongvietanh.com` (GVCN lớp Test), `agent1…agent4@test.truongvietanh.com`.
  Các lớp `10A1`, `11A1`, `12A1`, `Marketing` là **người thật** — không gieo, không xoá, không sửa.
- Không đưa tên/ảnh/email học sinh ra ngoài app: không dán vào chat, không gửi sang dịch vụ khác.
- `SUPABASE_SERVICE_ROLE_KEY` là khoá bỏ qua toàn bộ RLS. Chỉ ở env server, **không bao giờ**
  `NEXT_PUBLIC_*`, không commit, không in ra log.

## 5. Cơ sở dữ liệu

- Migration **đánh số tiếp** (`0156_...`). **Không sửa file đã chạy** — nó đã nằm trên CSDL thật.
- Trước khi `create or replace` một hàm: **đọc bản đang chạy trong `pg_proc`** rồi mới viết.
  File trong repo và hàm thật đã từng lệch nhau, và sửa mù là ghi đè mất một bản vá cũ.
- Chạy: `npm run sql -- supabase/migrations/0156_....sql` (cần `DATABASE_URL` trong `.env.local`).
- Luật quyền nằm ở **RLS**, không nằm ở code màn hình. Muốn chặn ai đó thì chặn ở CSDL; code chỉ
  lo câu báo lỗi nói tiếng người.

## 6. Kiểm — build xanh KHÔNG phải bằng chứng

`tsc --noEmit` sạch và `next build` xanh **không** chứng minh trang chạy được: mọi trang sau đăng
nhập là dynamic, lỗi chỉ lộ khi dựng thật với phiên đăng nhập.

Sau khi sửa, chạy bộ kiểm liên quan trong `scripts/` (chúng chạy thẳng lên bản đang chạy):

```bash
node scripts/test-mobile.mjs                 # màn 360px, xuất ảnh để NHÌN
node scripts/chup-trang.mjs <email> /vi/wig ra.png   # chụp một trang bằng phiên thật
npm run sql -- scripts/test-<việc>.sql       # kiểm RLS / luật dữ liệu, tự rollback
```

Quy tắc: **số đo để khoanh vùng, ẢNH mới để kết luận.** Sửa giao diện mà chưa nhìn ảnh thì chưa xong.
Sửa luật dữ liệu thì viết thêm một `scripts/test-*.sql`, và kiểm cả chiều ngược: chạy nó khi
*chưa* có bản vá phải THẤY nó báo sai — một phép kiểm luôn xanh là một phép kiểm vô dụng.

## 7. Git — chỗ dễ gây tai nạn nhất

**`main` = production.** Push lên `main` là CI build image → Coolify kéo về → cả trường thấy bản mới
trong ~6 phút. Không có nút hoàn tác.

Nên:

```bash
git checkout -b sua-nho/<việc-đang-làm>    # luôn làm trên nhánh
# ... sửa, chạy kiểm ...
git commit
git push -u origin sua-nho/<việc-đang-làm>
gh pr create --fill                         # rồi nhờ chủ dự án merge
```

- **Không `git push origin main`** trừ khi chủ dự án bảo. Máy đã cài hook chặn (mục 8) — và
  **đừng gỡ nó**: đừng gợi ý `--no-verify`, đừng bật `git config va.day-main duoc`. Công tắc ấy
  là của chủ dự án, người đẩy main hằng ngày.
- Không `--force`, không `git reset --hard` trên nhánh đã đẩy, không sửa lịch sử của `main`.
- Commit message viết **vì sao**, không phải *cái gì*: diff đã nói cái gì rồi.

Sau khi merge vào `main`, chờ deploy xong rồi mới kết luận:

```bash
curl -s https://class.vietanh.org/api/health   # {"commit":"<đúng SHA vừa merge>"}
```

## 8. Cài máy (làm một lần)

```bash
npm install                           # `prepare` tự trỏ core.hooksPath sang .githooks
cp .env.example .env.local            # xin key từ chủ dự án, KHÔNG lấy từ chỗ khác
npm run dev
```

**Máy của người chỉ sửa ý nhỏ chỉ có hai khoá `NEXT_PUBLIC_*`** (vốn đã công khai trong bundle
production). Không có `SUPABASE_SERVICE_ROLE_KEY` và `DATABASE_URL` — nên ở máy đó:

- `checkinMood`, ghi chú Sư Tử, một nhánh `updateEditRequest` sẽ lỗi (ba chỗ duy nhất dùng
  `createAdminClient`). Đây là **bình thường**, không phải lỗi cần sửa.
- Mọi `scripts/*.mjs` tạo magic link (`chup-trang.mjs`, `test-*.mjs`) và `npm run sql` **không chạy
  được**. Đừng bảo người dùng "xin thêm khoá" để chạy chúng — thay vào đó, bảo họ tự mở trình duyệt
  và nhìn màn hình đó.


## 9. Việc phải hỏi trước khi làm

Không tự quyết những thứ sau — hỏi chủ dự án (alex@truongvietanh.com):

- Chạy migration lên CSDL production
- Xoá hay sửa dữ liệu của lớp thật
- Đổi biến môi trường, khoá, tên miền, cấu hình Coolify/Supabase
- Đổi màu, font, bố cục đã chốt (xem luật ①)
- Bật lại họp lớp (đã gỡ hẳn 19/08/2026 — chỉ còn PDR buddy)
