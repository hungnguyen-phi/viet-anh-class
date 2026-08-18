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

### 1. Cảnh báo "SECURITY DEFINER function executable" (đo lại sau `0038`: 25 hàm anon + 30 hàm authenticated)
Đây là các helper RLS (`auth_role`, `auth_campus`, `is_my_child`, `is_class_teacher`, `staff_can_*`,
`wig_class`, `lead_class`, …) + các hàm app gọi qua RPC (`class_ranks`,
`child_class_progress`, `log_audit`, `app_today`). Tất cả **cần EXECUTE** nên không revoke được.
(`wig_actual` đã rời danh sách này — xem §5.)
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

### 5. Hai hàm DEFINER thiếu guard — phát hiện 2026-07-26, ✅ **ĐÃ VÁ bằng `0038`**

| Hàm | Vấn đề (trước 0038) | Cách vá |
|---|---|---|
| `wig_actual(w uuid)` | DEFINER, **không guard**. Ai biết UUID của một WIG (kể cả WIG cá nhân của HS khác) đều đọc được tổng tiến độ, gọi thẳng `/rest/v1/rpc/wig_actual`; `anon` cũng gọi được. Ghi chú ở `0018_security_hardening.sql:37-39` nói view `wig_progress_v` đã che — **chỉ đúng khi đi qua view**. | Chuyển sang schema **`private`** (PostgREST chỉ expose `public` + `graphql_public`) → **không còn endpoint RPC**. `anon` không có USAGE trên `private` và không có EXECUTE → đóng 2 lớp. |
| `log_audit(p_action, p_detail)` | DEFINER, không guard → mọi role ghi được dòng tuỳ ý vào `audit_log` (`anon` ghi với `actor_id = null`). | `revoke ... from public, anon` + thân hàm chỉ ghi `where auth.uid() is not null`, `left(p_action, 200)`. |

> ⚠️ **Bẫy đã tránh — đừng thêm guard vào thân `wig_actual`.** `class_competition_scores()` dùng nó để
> tính điểm thi đua của **MỌI lớp**, mà `class_ranks`/`campus_ranks` cho phép cả HS trong lớp gọi →
> guard theo quan hệ lớp sẽ trả `0` cho các lớp khác và **làm sai bảng xếp hạng**. Cũng **không** revoke
> được khỏi `authenticated`: `wig_progress_v` là `security_invoker` nên **người gọi** phải có EXECUTE.
> Ẩn khỏi API là cách đóng đúng chỗ mà không đổi hành vi.

**Đã kiểm chứng sau khi áp `0038`** (trên DB thật, mọi test bọc trong `begin … rollback`):
- 27/27 WIG: `private.wig_actual` khớp **tuyệt đối** phép tính độc lập (tổng 307 = 307, 0 sai lệch).
- `class_competition_scores()` vẫn ra điểm (6A1 = 62.3) → xếp hạng không chết.
- `wig_progress_v` chạy được dưới role `authenticated` thật (RLS lọc còn 3 dòng, `actual` tính đủ) →
  USAGE/EXECUTE trên `private` là đủ.
- `child_class_progress` với phiên PHỤ HUYNH: 3 dòng, `status` hợp lệ → đường báo cáo phụ huynh còn nguyên.
- `has_function_privilege('anon', …)` = **false** cho cả `log_audit` và `private.wig_actual`;
  `public.wig_actual` đã không còn tồn tại; `log_audit` không có phiên → ghi **0** dòng, có phiên → ghi đúng 1 dòng.
- Advisor bảo mật: **0 ERROR, 56 WARN** (trước 59).

**Vá kèm**: `child_class_progress` còn dùng `current_date` (UTC) cho nhịp `on_track/mid/off_track` —
`0026` đã sửa cho view nhưng bỏ sót hàm này → đã đổi sang `vn_today()`.

**Phần còn tồn (đã cân nhắc, KHÔNG vá vì không khai thác được qua API):**
- User **đã đăng nhập** vẫn ghi được dòng rác vào `audit_log` (luôn mang `actor_id` của chính họ, không
  giả mạo được người khác). Muốn chặn hẳn thì cần rate-limit ở tầng app/gateway.
- `anon`/`authenticated` có grant `TRUNCATE`/`REFERENCES`/`TRIGGER` trên các bảng `public` (mặc định của
  Supabase). **`TRUNCATE` không chịu RLS** — nhưng PostgREST không phát lệnh `TRUNCATE`, mà kết nối
  Postgres trực tiếp lại cần mật khẩu DB (JWT `anon` không dùng được) → không có đường khai thác.
  Nếu muốn sạch: `revoke truncate, references, trigger on all tables in schema public from anon, authenticated;`
- `can_manage_class_cover(text)` (thêm ở `0037`) vẫn để `anon` gọi được do grant mặc định của PostgreSQL;
  trả `false` cho mọi phiên chưa đăng nhập nên vô hại.

## Chống giả IP cho cổng check-in (audit 18/08/2026)

Cổng IP check-in (`ip_allowed`) đọc IP từ `cf-connecting-ip`. Nếu cổng origin (IP VPS) còn
truy cập được TRỰC TIẾP — không qua Cloudflare — kẻ tấn công tự đặt header `cf-connecting-ip:
<một IP trong dải trường>` rồi gọi thẳng, giả được "đang ở trường" và ghi điểm danh khống.

Hiện tại lỗ này CHƯA khai thác được vì trường chưa bật dải IP nào (cổng coi mọi nơi là "trong
trường"). Trước khi BẬT cổng IP thật, phải bịt origin bằng MỘT trong ba cách:

1. **Bí mật dùng chung (đã hỗ trợ trong mã, dễ nhất):**
   - Đặt env `CF_PROXY_SECRET=<chuỗi ngẫu nhiên dài>` cho container.
   - Ở Cloudflare → Rules → Transform Rules → Modify Request Header: thêm
     `x-cf-verify: <đúng chuỗi trên>` cho mọi request tới domain.
   - `lib/ip.ts` chỉ tin `cf-connecting-ip` khi header `x-cf-verify` khớp; gọi thẳng origin
     (không có header) sẽ không giả được IP.
2. **Cloudflare Authenticated Origin Pulls (mTLS):** origin chỉ nhận TLS từ Cloudflare.
3. **Firewall VPS:** chỉ mở 443 cho dải IP Cloudflare (https://www.cloudflare.com/ips).

Khuyến nghị làm CẢ (1) và (3) khi go-live cổng IP.
