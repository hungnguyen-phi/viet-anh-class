-- 0032 — VÁ lỗ cấp quyền: Supabase mặc định cấp EXECUTE cho anon/authenticated trên
-- hàm mới, nên "revoke ... from public" ở 0031 chưa đủ. Nếu không vá, học sinh
-- (authenticated) có thể gọi THẲNG student_checkin qua /rest/v1/rpc với p_ip giả để
-- bỏ qua cổng IP. Thu hồi tường minh → chỉ service_role (server) gọi được.
revoke execute on function student_checkin(uuid, mood_level, text) from anon, authenticated;
revoke execute on function ip_allowed(text) from anon, authenticated;
