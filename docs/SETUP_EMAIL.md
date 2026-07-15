# Thiết lập Email nhắc điểm danh (SMTP trường)

App đã có sẵn: Edge Function `attendance-reminders` + 3 lịch cron (09:00 / 12:00 / 16:00 giờ VN)
tự dò lớp **chưa điểm danh hôm nay** và gửi email cho **GVCN + trưởng điểm danh** của lớp đó.

Để email gửi được, cần nạp **secrets** (không đưa mật khẩu cho ai — bạn tự đặt trong dashboard).

## 1. Đặt secrets cho Edge Function
Dashboard → Project Settings → **Edge Functions → Secrets** (hoặc `supabase secrets set`):

| Secret | Giá trị |
| :-- | :-- |
| `CRON_SECRET` | `<CRON_SECRET>` (đã tạo sẵn trong Vault — phải khớp) |
| `SMTP_HOST` | vd `smtp.gmail.com` (Google Workspace) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | tài khoản gửi, vd `no-reply@truongvietanh.com` |
| `SMTP_PASS` | App Password / mật khẩu SMTP |
| `SMTP_FROM` | địa chỉ hiển thị người gửi (thường = SMTP_USER) |

> Google Workspace: tạo **App Password** (cần bật 2FA) hoặc dùng **SMTP relay** của Workspace.

## 2. (Khuyến nghị) Dùng chính SMTP này cho email đăng nhập
Authentication → **Emails → SMTP Settings** → bật Custom SMTP, điền cùng thông tin trên.
→ Việc này **đồng thời sửa lỗi magic-link không tới** (email mặc định của Supabase bị Workspace chặn).

## 3. Kiểm thử ngay (không cần đợi tới giờ cron)
Sau khi đặt secrets, gọi thử hàm:
```bash
curl -X POST "https://iycuuhrnuavmywabdxqd.supabase.co/functions/v1/attendance-reminders" \
  -H "x-cron-secret: <CRON_SECRET>"
```
- Chưa đặt SMTP → trả `{"smtp":"not_configured","unmarked_classes":N,...}` (logic dò lớp vẫn chạy).
- Đã đặt SMTP → trả `{"smtp":"sent","emails_sent":N}` và email được gửi.

## 4. Cơ chế
- Lịch cron (UTC): `0 2 * * *`, `0 5 * * *`, `0 9 * * *` = 09:00/12:00/16:00 giờ VN.
- Mỗi lần chạy: lớp nào đã có điểm danh hôm nay → bỏ qua; lớp chưa có → gửi nhắc.
- Vì cả 3 mốc đều kiểm tra lại, nếu 09:00 chưa điểm danh thì 12:00 và 16:00 vẫn nhắc tiếp cho tới khi điểm danh xong.
- Người nhận: GVCN (`classes.homeroom_teacher_id`) + các trưởng điểm danh (`enrollments.is_attendance_leader`).
