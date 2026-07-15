-- 0013 — Hardening (M8).
-- LƯU Ý QUAN TRỌNG: KHÔNG revoke EXECUTE các helper dùng trong RLS policy.
-- Khi query 1 bảng, MỌI policy permissive đều được đánh giá → role anon/authenticated CẦN
-- EXECUTE trên các hàm đó (đã kiểm chứng: revoke auth_campus làm "permission denied").
-- Chỉ revoke an toàn các hàm KHÔNG xuất hiện trong policy:
--   - trigger functions (chạy không cần caller execute)
--   - hàm chỉ được gọi nội bộ bởi 1 SECURITY DEFINER khác (postgres có execute)
-- Việc gỡ hết cảnh báo còn lại cần dời helper sang schema 'private' (tái tạo policy) — để ở vòng sau.

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function protect_profile_privileged_cols() from public, anon, authenticated;
revoke execute on function class_competition_scores() from public, anon, authenticated;

-- Public bucket không cần policy SELECT rộng (URL công khai /object/public vẫn truy cập object).
drop policy if exists class_covers_public_read on storage.objects;
