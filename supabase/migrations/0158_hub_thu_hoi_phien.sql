-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0158 — HUB: THU HỒI PHIÊN GẦN-TỨC-THÌ khi Hub báo đăng xuất (backchannel logout)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- lib/auth.ts CỐ Ý xác thực JWT CỤC BỘ (getClaims(), không gọi mạng) để mọi trang không phải
-- chờ một vòng Supabase mỗi lượt chuyển trang (xem comment ở đó). Cái giá của tốc độ ấy là: khi
-- Hub gọi vào app/api/hub/backchannel-logout báo "người này vừa đăng xuất bên Hub", app không có
-- sẵn cách nào lục ra và giết đúng phiên đó — phiên nằm trong cookie ở trình duyệt người dùng,
-- máy chủ không giữ token nào để thu hồi.
--
-- CÁCH GIẢI mà không phải quay lại gọi DB mỗi request cho MỌI người dùng (kể cả người chưa từng
-- qua Hub): ghi một dòng ở đây, rồi tiến trình Node giữ một kênh Supabase Realtime lắng nghe đúng
-- bảng này (lib/hub/revocation.ts) — nhận được là cập nhật một Set trong RAM ngay (< 1 giây,
-- thường vài trăm ms), và lib/auth.ts chỉ hỏi Set đó (O(1), không I/O). Xem lib/hub/revocation.ts
-- để biết vì sao chọn Realtime thay vì mở kết nối DATABASE_URL riêng (CLAUDE.md cấm biến đó ở môi
-- trường production).
create table if not exists hub_revoked_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  reason text not null default 'hub_backchannel_logout',
  revoked_at timestamptz not null default now()
);

create index if not exists hub_revoked_sessions_profile_idx on hub_revoked_sessions(profile_id, revoked_at);

alter table hub_revoked_sessions enable row level security;
revoke all on hub_revoked_sessions from authenticated, anon;

-- REPLICA IDENTITY FULL + đăng ký publication: xem giải thích đầy đủ ở 0111 (wig_meetings) — gói
-- INSERT vẫn cần replica identity đủ để Realtime gửi trọn hàng cho phía nhận (lib/hub/revocation.ts
-- chỉ cần đúng cột profile_id, nhưng bật FULL cho nhất quán với quy ước của dự án).
alter table hub_revoked_sessions replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hub_revoked_sessions'
  ) then
    execute 'alter publication supabase_realtime add table hub_revoked_sessions';
  end if;
end $$;
