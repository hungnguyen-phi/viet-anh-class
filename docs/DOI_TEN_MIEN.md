# Đổi tên miền: class.vietanh.org → class.truongvietanh.com

Ngày làm: **31/08/2026**. Người làm phần hạ tầng: chủ dự án (alex@truongvietanh.com).

Phần trong repo (code, tài liệu, bộ kiểm) đã sửa xong ở nhánh
`sua-nho/doi-ten-mien-class-truongvietanh`. Trang này là phần **bấm tay bên ngoài repo** — làm
đúng thứ tự dưới đây, vì sai thứ tự thì có một khoảng vài phút cả trường không đăng nhập được.

Nguyên tắc: **miền cũ không chết, nó chuyển hướng 308 sang miền mới**. Ai còn bookmark cũ, còn
magic link gửi hôm trước, còn link dán trong Zalo nhóm phụ huynh — vẫn vào được.

---

## Vì sao phải làm cả 8 bước, không bỏ bước nào

Tên miền của app xuất hiện ở **năm** nơi độc lập nhau; đổi thiếu một nơi thì hỏng đúng một luồng:

| Nơi | Đổi thiếu thì hỏng gì |
|---|---|
| DNS + Coolify | Trang không mở được |
| `NEXT_PUBLIC_SITE_URL` / `lib/site.ts` (nội tuyến lúc build) | Redirect sau đăng nhập văng về miền cũ |
| Supabase → Auth → URL Configuration | Bấm magic link / Google SSO xong bị đá về miền cũ hoặc báo lỗi redirect |
| Hub (`os.truongvietanh.com`) → phiếu đăng ký app | Nhúng vào Hub hiện khung trắng, đăng nhập qua Hub báo `invalid_grant` |
| Cloudflare (bản ghi + rule 308 cho miền cũ) | Link cũ chết |

---

## Thứ tự làm

### 1. Cloudflare — dựng bản ghi mới TRƯỚC

Trong zone `truongvietanh.com`:

- Bản ghi **A**: `class` → **IP VPS** (đúng IP mà `class.vietanh.org` đang trỏ tới), **Proxy = ON**
  (đám mây màu cam).

Chưa đụng gì tới miền cũ ở bước này. App vẫn chạy bình thường trên miền cũ.

### 2. Coolify — gắn thêm miền mới vào app đang chạy

Coolify → application của app → **Domains**: để **cả hai**, cách nhau bởi dấu phẩy:

```
https://class.truongvietanh.com,https://class.vietanh.org
```

Có `https://` ở đầu mỗi cái, nếu không proxy sinh cấu hình sai ("no available server"). Đợi
Coolify cấp xong chứng chỉ TLS cho miền mới rồi mở thử `https://class.truongvietanh.com/api/health`
— phải trả `{"status":"ok", ...}`. Lúc này hai miền cùng phục vụ một app, chưa ai bị ảnh hưởng.

### 3. Supabase → Authentication → URL Configuration

Project `eagsageokobtidpmxucx` (VAC — **không** phải project AI Tutor).

- **Site URL**: `https://class.truongvietanh.com`
- **Redirect URLs**: thêm `https://class.truongvietanh.com/**`, và **giữ nguyên**
  `https://class.vietanh.org/**` cho tới hết ngày mai — magic link đã gửi đi trước hôm nay vẫn
  mang `redirect_to` miền cũ, xoá sớm là những link đó chết ngay trong tay người dùng.

Sửa trên **Dashboard**, không phải `supabase/config.toml`: file đó chỉ có tác dụng khi chạy
`supabase config push`. (File trong repo đã sửa cho khớp, để hai bên không lệch nhau.)

### 4. Google Cloud Console (nếu vẫn bật Google SSO)

Chỗ này **thường không phải sửa**: Google redirect về
`https://eagsageokobtidpmxucx.supabase.co/auth/v1/callback`, không phải về miền app. Chỉ vào
kiểm cho chắc — OAuth client → **Authorized redirect URIs** phải vẫn là URL Supabase ở trên.
Nếu có ai đó từng thêm `https://class.vietanh.org/...` vào **Authorized JavaScript origins** thì
thêm miền mới vào cạnh nó.

### 5. Merge nhánh code, chờ deploy

```bash
gh pr create --fill        # rồi merge
# ~6 phút sau:
curl -s https://class.truongvietanh.com/api/health    # {"commit":"<SHA vừa merge>"}
```

**Phải đợi bước này xong mới sang bước 6.** `NEXT_PUBLIC_SITE_URL` nội tuyến lúc build: chừng nào
image mới chưa chạy, app vẫn tự coi mình là `class.vietanh.org` — bật 308 sớm là mọi redirect nội
bộ chạy vòng tròn giữa hai miền.

### 6. Cloudflare — bật chuyển hướng 308 cho miền cũ

Zone `vietanh.org` → **Rules → Redirect Rules → Create rule**:

- Tên: `class cũ → class.truongvietanh.com`
- Khi: `Hostname equals class.vietanh.org`
- Thì: **Dynamic redirect**
  - Expression: `concat("https://class.truongvietanh.com", http.request.uri.path)`
  - **Preserve query string: ON** ← bắt buộc. Magic link mang token trong query
    (`?token_hash=…`); mất query là link đăng nhập chết.
  - Status: **308** (giữ nguyên method, không cache vĩnh viễn như 301)

Rule này chạy ở biên Cloudflare, **trước** khi request tới app — nên không request nào còn tới app
với `Host: class.vietanh.org`, không có chuyện cookie đặt trên miền này rồi lại nhảy sang miền kia.

Bật xong thì gỡ `https://class.vietanh.org` khỏi ô Domains của Coolify (bước 2) cho gọn.

### 7. Báo Hub cập nhật phiếu đăng ký app

Gửi cho người phụ trách Hub (`os.truongvietanh.com`) đúng ba dòng này:

```
app: viet-anh-class
origin mới:        https://class.truongvietanh.com   (thay https://class.vietanh.org)
URL nhúng mới:     https://class.truongvietanh.com/vi
redirectUris:      https://class.truongvietanh.com/**
```

Chưa đổi bên Hub thì: khung nhúng vẫn hiện được (nhờ 308), nhưng bắt tay đăng nhập có thể bị Hub
từ chối vì origin không khớp phiếu đăng ký. `HUB_APP_ID` **không** đổi.

### 8. Kiểm lại — nhìn tận mắt, không suy đoán

- [ ] `https://class.truongvietanh.com/api/health` trả đúng SHA vừa merge
- [ ] Mở `https://class.vietanh.org/vi/login` → nhảy sang miền mới, còn nguyên đường dẫn
- [ ] Đăng nhập thật bằng `test1.hs@student.truongvietanh.com` (lớp **Test**, đừng đụng lớp thật)
      → vào thẳng màn của em, không văng ra `/login` lần nữa
- [ ] Đăng nhập bằng Google với một tài khoản `@truongvietanh.com`
- [ ] Mở app **trong khung Hub** → HubEmbedGate bắt tay xong, không đứng ở màn đăng nhập
- [ ] DevTools → Application → Cookies trên `class.truongvietanh.com`: chỉ có `sb-...-auth-token`
      và `NEXT_LOCALE`. **Không** còn dòng `auth=` của Coolify (xem `docs/COOLIFY_TEN_MIEN.md` —
      chính việc đổi miền lần này đã dập rủi ro đó)
- [ ] `node scripts/test-mobile.mjs` rồi **nhìn ảnh**

### Sau 24 giờ

- Xoá `https://class.vietanh.org/**` khỏi Supabase Redirect URLs (và khỏi
  `supabase/config.toml`) — mọi magic link cũ đã hết hạn.
- **Giữ rule 308 vĩnh viễn.** Nó gần như không tốn gì, mà link cũ thì nằm rải rác trong sổ tay
  vận hành in ra giấy, tin nhắn Zalo, email gửi phụ huynh.

---

## Nếu phải quay lại miền cũ

Còn nguyên đường lui trong vòng vài phút, miễn là chưa qua "sau 24 giờ":

1. Tắt rule 308 ở bước 6.
2. Supabase Site URL đặt lại `https://class.vietanh.org`.
3. Đặt biến build `NEXT_PUBLIC_SITE_URL=https://class.vietanh.org` trong GitHub → Variables rồi
   chạy lại workflow deploy — **không cần revert code**, biến môi trường thắng giá trị mặc định
   trong `lib/site.ts`.
