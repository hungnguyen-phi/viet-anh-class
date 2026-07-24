-- 0023 — Siết quyền EXECUTE cho 3 RPC nhạy cảm (xoá user / ghi danh / rời lớp).
-- Postgres mặc định GRANT EXECUTE cho PUBLIC → anon vẫn gọi được (dù guard nội bộ chặn).
-- Revoke khỏi PUBLIC + anon, chỉ để authenticated (guard bên trong quyết định admin/GVCN).
-- Các RPC này KHÔNG dùng trong RLS policy nên revoke an toàn, không phá phân quyền.
set search_path = public;

revoke execute on function admin_delete_user(uuid)             from public, anon;
revoke execute on function enroll_student_by_email(uuid, text) from public, anon;
revoke execute on function unenroll_student(uuid, uuid)        from public, anon;

grant execute on function admin_delete_user(uuid)             to authenticated;
grant execute on function enroll_student_by_email(uuid, text) to authenticated;
grant execute on function unenroll_student(uuid, uuid)        to authenticated;
