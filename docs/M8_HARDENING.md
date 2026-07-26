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

### 1. Cảnh báo "SECURITY DEFINER function executable" (đo lại 2026-07-26: 27 hàm anon + 31 hàm authenticated)
Đây là các helper RLS (`auth_role`, `auth_campus`, `is_my_child`, `is_class_teacher`, `staff_can_*`,
`wig_class`, `lead_class`, `wig_actual`, …) + các hàm app gọi qua RPC (`class_ranks`,
`child_class_progress`, `log_audit`, `app_today`). Tất cả **cần EXECUTE** nên không revoke được.
- **Mức độ**: WARN (không phải lỗ hổng) cho **phần lớn** — chỉ trả về ngữ cảnh quyền của CHÍNH người gọi
  (boolean own-context) hoặc dữ liệu đã gated (`child_class_progress` chặn bằng `can_view_student`,
  `class_ranks`/`class_scoreboard` đã kiểm quan hệ lớp), RLS vẫn là cổng.
- ⚠️ **Trừ 2 ngoại lệ có thật** — xem §5. Câu "không lộ dữ liệu bảng của người khác" ở bản cũ của mục này
  là **sai** với `wig_actual`.
- **Cách gỡ triệt để**: dời toàn bộ helper sang schema `private` (không expose qua PostgREST) và
  **tái tạo ~40 RLS policy** trỏ tới `private.*`. Rủi ro cao → nên làm trong **vòng review RLS độc lập
  của IT trường** (§12.5) với đầy đủ policy trước mắt.

### 2. `pg_net` trong schema public (WARN)
Dùng cho cron nhắc điểm danh. Dời schema có thể làm hỏng `net.http_post` của cron → để nguyên, xử lý khi
review hạ tầng.

### 3. Bật trong Dashboard ([NGƯỜI])
- **Authentication → Providers → Google** + **Auth Hook "Before User Created"** (`restrict_signup_by_email_domain`):
  đã có cấu hình dạng IaC trong `supabase/config.toml` (`[auth.external.google]`, `[auth.hook.before_user_created]`)
  — chạy `supabase config push` để áp (cần secret Google trong biến môi trường CLI, xem
  `docs/google-sso-setup.md`). Vẫn có thể bật tay trên Dashboard nếu không dùng CLI.
- **Authentication → Emails → Custom SMTP** (đăng nhập email + đã cấu hình cho reminder) — chưa có trong `config.toml`, vẫn cần bật tay.
- **Authentication → Policies → Leaked Password Protection**: bật (WARN advisor) — chưa có trong `config.toml`, vẫn cần bật tay.
- **Database → Backups → Point-in-Time Recovery**: bật (có thể cần gói trả phí) — chỉ bật được qua Dashboard.

### 4. Trước go-live
- **Xoá dữ liệu seed giả** (lớp 6A1/8A2/7B1, HS demo, BGH/parent demo) trước khi nhập dữ liệu thật.
- **Vòng review RLS & phân quyền độc lập của IT trường** (§12.5) — cổng bắt buộc; đính kèm bằng chứng
  `tests/rls/rls_isolation.sql` (đã PASS).

### 5. Hai hàm DEFINER **thiếu guard** — phát hiện 2026-07-26, CHƯA vá
Khác với phần còn lại của §1, hai hàm này không có kiểm quan hệ nào bên trong:

| Hàm | Vấn đề | Mức độ |
|---|---|---|
| `wig_actual(w uuid)` | DEFINER, **không guard**. Ai biết UUID của một WIG (kể cả WIG cá nhân của HS khác) đều đọc được tổng tiến độ, gọi thẳng `/rest/v1/rpc/wig_actual`. `anon` cũng gọi được. Ghi chú ở `0018_security_hardening.sql:37-39` nói view `wig_progress_v` đã che — **chỉ đúng khi đi qua view**, không đúng khi gọi RPC trực tiếp. | THẤP–TRUNG (rò số liệu, cần biết UUID; không phải PII) |
| `log_audit(p_action, p_detail)` | DEFINER, không guard → mọi role ghi được dòng tuỳ ý vào `audit_log` (`anon` ghi với `actor_id = null`). Làm nhiễu/giả mạo nhật ký kiểm toán. | THẤP (không rò dữ liệu) |

**Không sửa được bằng cách revoke đơn thuần**: `wig_progress_v` là `security_invoker` nên người gọi
**phải** có EXECUTE trên `wig_actual`. Hướng vá đúng:
1. `revoke execute on function wig_actual(uuid) from anon;` — đóng ngay đường chưa đăng nhập (an toàn,
   `anon` không dùng view này).
2. Thêm guard trong thân hàm cho `authenticated`: cần bao đủ **cả 3 nhóm người đọc hợp lệ** (`staff_can_read_class`,
   `is_class_student`, `is_parent_of_class`) vì `child_class_progress` gọi `wig_actual` thay mặt PHỤ HUYNH
   — guard hẹp quá sẽ **làm hỏng báo cáo tuần của phụ huynh**. Cần test lại `child_class_progress` +
   `wig_progress_v` sau khi thêm.
3. `log_audit`: chặn `anon` (`revoke ... from anon`) và/hoặc whitelist `p_action`.
