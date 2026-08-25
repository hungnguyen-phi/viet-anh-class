-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0156 — HUB: BẢNG ÁNH XẠ DANH TÍNH (issuer, sub) → profiles
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Trường đang dựng một "Super App Hub" (hub.truongvietanh.com) — app này là một trong các "mini
-- app" cắm vào đó. Người dùng đăng nhập MỘT LẦN ở Hub; app không còn hệ đăng nhập riêng cho lượt
-- vào qua Hub (xem lib/hub/session-bridge.ts). Hub trả về một OIDC id_token có `sub` (mã người
-- dùng TRONG HUB) — khác hẳn `profiles.id` (mã người dùng TRONG APP NÀY, = auth.users.id).
--
-- LẦN ĐẦU một `sub` xuất hiện: khớp theo `id_token.email` với `profiles.email` (khoá join app này
-- vẫn luôn dùng), rồi CHÉP LẠI vào bảng này — mọi lượt sau tra thẳng (issuer, sub), không cần
-- email nữa. Bảng KHÔNG có cột `email` sống (chỉ có `email_at_link` để soi lại "sao lúc đó khớp
-- được" — email thật đổi thì đọc ở profiles.email, không đọc lại ở đây).
--
-- 1 profile ↔ 1 danh tính Hub (unique cả hai chiều): app này với Hub là CÙNG một trường, cùng một
-- người — không có lý do một người có hai `sub` khác nhau ở cùng một Hub. Nếu sau này Hub tự đổi ý
-- (vd liên bang hai IdP ra hai sub cho cùng một người) thì đó là chuyện của Hub, không phải chuyện
-- app này tự đoán trước — bỏ ràng buộc `unique(profile_id)` khi đó là một migration 1 dòng, không
-- phá gì.
create table if not exists hub_identities (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  sub text not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  email_at_link text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists hub_identities_issuer_sub_uidx on hub_identities(issuer, sub);
create unique index if not exists hub_identities_profile_uidx on hub_identities(profile_id);

-- CHỈ service_role — không hàng nào của bảng này lộ ra client. Mọi lượt đọc/ghi đi qua
-- lib/hub/identity.ts bằng createAdminClient(). RLS bật + KHÔNG có policy nào = mặc định từ chối
-- hết, kể cả người dùng đã đăng nhập; không cần liệt kê policy "cấm" vì Postgres đã cấm sẵn.
alter table hub_identities enable row level security;
revoke all on hub_identities from authenticated, anon;
