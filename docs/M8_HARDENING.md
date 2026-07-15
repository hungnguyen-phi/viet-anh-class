# M8 — Hardening: trạng thái & việc còn lại

## Đã làm (migration 0013, áp dụng trên DB)
- **Revoke EXECUTE** (public/anon/authenticated) cho các hàm KHÔNG dùng trong RLS policy → gỡ cảnh báo:
  - `handle_new_user()`, `protect_profile_privileged_cols()` (trigger — chạy không cần caller execute, đã test).
  - `class_competition_scores()` (chỉ gọi nội bộ bởi `class_ranks`, định-nghĩa-viên).
- **Drop policy `class_covers_public_read`** trên `storage.objects` (public bucket vẫn truy cập object qua URL `/object/public`, không cần policy SELECT rộng).
- Đã **kiểm chứng lại** sau thay đổi: RLS (GVCN 25 HS, parent 1 con), view `wig_progress_v`, trigger signup đều chạy đúng.

## Phát hiện quan trọng (ghi lại để không lặp lỗi)
> **KHÔNG revoke EXECUTE các helper dùng trong RLS policy.** Khi query 1 bảng, MỌI policy permissive
> được đánh giá → role `anon`/`authenticated` phải có EXECUTE trên các hàm trong policy. Revoke sẽ gây
> `permission denied for function ...`. (Đã xảy ra với `auth_campus` và đã khôi phục.)

## Còn lại — cần làm thủ công ([NGƯỜI]) hoặc refactor có chủ đích

### 1. Cảnh báo "SECURITY DEFINER function executable" (còn ~14 hàm)
Đây là các helper RLS (`auth_role`, `auth_campus`, `is_my_child`, `is_class_teacher`, `staff_can_*`,
`wig_class`, `lead_class`, `wig_actual`, …) + 4 hàm app gọi qua RPC (`class_ranks`,
`child_class_progress`, `log_audit`, `app_today`). Tất cả **cần EXECUTE** nên không revoke được.
- **Mức độ**: WARN (không phải lỗ hổng). Các hàm chỉ trả về ngữ cảnh quyền của CHÍNH người gọi
  (boolean own-context) hoặc dữ liệu đã gated (`child_class_progress` chặn bằng `is_my_child`), không lộ
  dữ liệu bảng của người khác (RLS vẫn là cổng).
- **Cách gỡ triệt để**: dời toàn bộ helper sang schema `private` (không expose qua PostgREST) và
  **tái tạo ~40 RLS policy** trỏ tới `private.*`. Rủi ro cao → nên làm trong **vòng review RLS độc lập
  của IT trường** (§12.5) với đầy đủ policy trước mắt.

### 2. `pg_net` trong schema public (WARN)
Dùng cho cron nhắc điểm danh. Dời schema có thể làm hỏng `net.http_post` của cron → để nguyên, xử lý khi
review hạ tầng.

### 3. Bật trong Dashboard ([NGƯỜI])
- **Authentication → Providers → Google** (đăng nhập GV/HS) + **Auth Hook "Before User Created"** → `restrict_signup_by_email_domain`.
- **Authentication → Emails → Custom SMTP** (đăng nhập email + đã cấu hình cho reminder).
- **Authentication → Policies → Leaked Password Protection**: bật (WARN advisor).
- **Database → Backups → Point-in-Time Recovery**: bật (có thể cần gói trả phí).

### 4. Trước go-live
- **Xoá dữ liệu seed giả** (lớp 6A1/8A2/7B1, HS demo, BGH/parent demo) trước khi nhập dữ liệu thật.
- **Vòng review RLS & phân quyền độc lập của IT trường** (§12.5) — cổng bắt buộc; đính kèm bằng chứng
  `tests/rls/rls_isolation.sql` (đã PASS).
