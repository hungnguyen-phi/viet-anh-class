-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0174 — GRANT execute private.so_hien_tai cho authenticated (sửa lỗi muc_tieu_v không đọc được)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- muc_tieu_v là view security_invoker (đúng, để RLS của muc_tieu áp cho người gọi). Nhưng nó gọi
-- private.so_hien_tai(m.id) trong lateral join, mà authenticated KHÔNG có quyền EXECUTE hàm đó
-- (PUBLIC execute từng bị revoke lúc siết bảo mật, và chưa cấp lại). Hệ quả: MỌI truy vấn
-- muc_tieu_v của người dùng đăng nhập đều "permission denied for function so_hien_tai" — không ai
-- (kể cả chính chủ) đọc được mục tiêu nào. Lỗi ẩn vì trước đây không tạo nổi mục tiêu để hiện.
--
-- Cấp EXECUTE cho authenticated là AN TOÀN: hàm nằm ở schema `private`, KHÔNG được PostgREST bày
-- ra làm RPC, nên không thể gọi trực tiếp qua API. Chỉ view (chạy dưới quyền người gọi) gọi được,
-- và view chỉ gọi cho những dòng muc_tieu mà RLS đã cho người ấy thấy. Không mở rò rỉ mới.

grant execute on function private.so_hien_tai(uuid, date, integer) to authenticated;
