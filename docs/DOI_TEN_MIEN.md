# Đổi tên miền: class.vietanh.org → class.truongvietanh.com

Ngày làm: **31/08/2026**. Người làm phần hạ tầng: chủ dự án (alex@truongvietanh.com).

Phần trong repo (code, tài liệu, bộ kiểm) đã sửa xong ở nhánh
`sua-nho/doi-ten-mien-class-truongvietanh`. Trang này là phần **bấm tay bên ngoài repo** — làm
đúng thứ tự dưới đây, vì sai thứ tự thì có một khoảng vài phút cả trường không đăng nhập được.

**ĐÃ LÀM XONG 31/08/2026.** Giữ trang này làm bản ghi chép, và làm mẫu cho lần đổi sau.

Nguyên tắc: **miền cũ bị cắt hẳn, KHÔNG chuyển hướng**. Bản đầu định dựng rule 308 ở Cloudflare
cho link cũ vẫn vào được; chủ dự án chọn cắt thẳng cho gọn (xem bước 6). Hệ quả đã biết và đã
chấp nhận: bookmark cũ, magic link đã gửi, địa chỉ in trong sổ tay vận hành, link dán trong nhóm
Zalo phụ huynh — **chết hết**, phải chủ động báo địa chỉ mới cho 700 người.

Điều KHÔNG được làm: để hai miền cùng sống mà không có chuyển hướng. Đó không phải "trạng thái
trung gian an toàn", đó là **vòng lặp đăng nhập** — xem bước 6.

---

## Vì sao phải làm cả 8 bước, không bỏ bước nào

Tên miền của app xuất hiện ở **năm** nơi độc lập nhau; đổi thiếu một nơi thì hỏng đúng một luồng:

| Nơi | Đổi thiếu thì hỏng gì |
|---|---|
| DNS + Coolify | Trang không mở được |
| `NEXT_PUBLIC_SITE_URL` / `lib/site.ts` (nội tuyến lúc build) | Redirect sau đăng nhập văng về miền cũ |
| Supabase → Auth → URL Configuration | Bấm magic link / Google SSO xong bị đá về miền cũ hoặc báo lỗi redirect |
| Hub (`os.truongvietanh.com`) → phiếu đăng ký app | Nhúng vào Hub hiện khung trắng, đăng nhập qua Hub báo `invalid_grant` |
| Cloudflare (bản ghi DNS) | Trang không mở được / link cũ vẫn sống nửa vời |

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
image mới chưa chạy, app vẫn tự coi mình là `class.vietanh.org` — cắt miền cũ sớm là cắt đúng
miền đang phục vụ người dùng.

### 6. Cắt hẳn miền cũ

**Bước này bắt buộc, không được bỏ dở ở trạng thái "để hai miền cùng chạy".**

1. Coolify → application → **Domains**: xoá vế `,https://class.vietanh.org`, chỉ còn
   `https://class.truongvietanh.com` → Save → **Restart**.
2. Cloudflare → zone `vietanh.org` → DNS: **xoá bản ghi `class`**. Để lại thì người vào link cũ
   gặp lỗi 503 khó hiểu của proxy; xoá đi thì trình duyệt báo thẳng "không tìm thấy địa chỉ".
3. Báo địa chỉ mới cho toàn trường. Sổ tay vận hành in ra giấy đang ghi địa chỉ cũ
   (`scripts/tao-so-tay-van-hanh.mjs`) — in lại hoặc dán đè.

**VÌ SAO KHÔNG ĐƯỢC ĐỂ HAI MIỀN CÙNG SỐNG.** Nghe thì có vẻ "an toàn hơn, ai vào đâu cũng được".
Thực tế là vòng lặp đăng nhập, đọc thẳng trong `app/[locale]/(auth)/auth/callback/route.ts:15,55`:

1. Ai bấm magic link / đăng nhập Google **bắt đầu từ miền cũ** → callback chạy trên host cũ, đặt
   cookie phiên **cho miền cũ**;
2. dòng cuối redirect về `${origin}`, mà `publicOrigin()` không còn nhận miền cũ → đá sang miền mới;
3. sang miền mới thì **không có cookie** → middleware đá về `/login`;
4. đăng nhập lại → quay về bước 1.

Trang vẫn mở được, không có thông báo lỗi nào — nên kiểu hỏng này rất dễ tưởng là "mạng chậm".

Vậy chỉ có hai trạng thái đúng: **cắt hẳn** (mục này), hoặc **chuyển hướng 308** (mục dưới).
Không có ở giữa.

<details>
<summary>Phương án đã cân nhắc rồi bỏ: rule 308 giữ link cũ sống</summary>

Zone `vietanh.org` → **Rules → Redirect Rules → Create rule**:

- Khi: `Hostname equals class.vietanh.org`
- Thì: **Dynamic redirect**
  - Expression: `concat("https://class.truongvietanh.com", http.request.uri.path)`
  - **Preserve query string: ON** ← bắt buộc. Magic link mang token trong query
    (`?token_hash=…`); mất query là link đăng nhập chết.
  - Status: **308** (không phải 301 — 301 bị trình duyệt nhớ vĩnh viễn, sau muốn gỡ cũng không gỡ
    được khỏi máy người dùng). **Dynamic**, không phải Static — Static mất đường dẫn.

Đổi lại: mọi link cũ vẫn sống. Chủ dự án cân nhắc và chọn cắt hẳn cho gọn (31/08/2026). Ghi lại
đây để lần đổi tên miền sau khỏi phải nghĩ lại từ đầu.

</details>

### 7. Báo Hub cập nhật phiếu đăng ký app

Gửi cho người phụ trách Hub (`os.truongvietanh.com`) đúng ba dòng này:

```
app: viet-anh-class
origin mới:        https://class.truongvietanh.com   (thay https://class.vietanh.org)
URL nhúng mới:     https://class.truongvietanh.com/vi
redirectUris:      https://class.truongvietanh.com/**
```

Chưa đổi bên Hub là **Hub hỏng hẳn**: phiếu đăng ký còn trỏ miền cũ, mà miền cũ đã chết ở bước 6
— khung nhúng trắng. `HUB_APP_ID` **không** đổi.

### 8. Kiểm lại — nhìn tận mắt, không suy đoán

- [ ] `https://class.truongvietanh.com/api/health` trả đúng SHA vừa merge
- [ ] Mở `https://class.vietanh.org` → **không mở được** (đúng như thiết kế, đã cắt ở bước 6)
- [ ] Đăng nhập thật bằng `test1.hs@student.truongvietanh.com` (lớp **Test**, đừng đụng lớp thật)
      → vào thẳng màn của em, không văng ra `/login` lần nữa
- [ ] Đăng nhập bằng Google với một tài khoản `@truongvietanh.com`
- [ ] Mở app **trong khung Hub** → HubEmbedGate bắt tay xong, không đứng ở màn đăng nhập
- [ ] DevTools → Application → Cookies trên `class.truongvietanh.com`: chỉ có `sb-...-auth-token`
      và `NEXT_LOCALE`. **Không** còn dòng `auth=` của Coolify (xem `docs/COOLIFY_TEN_MIEN.md` —
      chính việc đổi miền lần này đã dập rủi ro đó)
- [ ] `node scripts/test-mobile.mjs` rồi **nhìn ảnh**

### Dọn nốt

- Xoá `https://class.vietanh.org/**` khỏi Supabase Redirect URLs. Không gấp: nó chỉ cho phép quay
  về một miền đã chết, để lại vô hại. `supabase/config.toml` trong repo đã bỏ dòng này.

---

## Nếu phải quay lại miền cũ

Đường lui vẫn còn, mất thêm vài phút so với lúc còn rule 308:

1. Dựng lại bản ghi DNS `class` ở zone `vietanh.org` và gắn lại miền đó vào Coolify (bước 6).
2. Supabase Site URL đặt lại `https://class.vietanh.org`.
3. Đặt biến build `NEXT_PUBLIC_SITE_URL=https://class.vietanh.org` trong GitHub → Variables rồi
   chạy lại workflow deploy — **không cần revert code**, biến môi trường thắng giá trị mặc định
   trong `lib/site.ts`.
