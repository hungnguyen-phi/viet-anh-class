-- 0015 — Table-level privileges cho 'authenticated'.
-- Bug: các bảng vận hành có RLS nhưng THIẾU GRANT → PostgREST trả 42501 "permission denied",
-- khiến điểm danh/WIG/lead/họp/report đọc-ghi trực tiếp đều fail (chỉ view/RPC definer chạy được).
-- RLS vẫn là lớp chốt kiểm soát từng dòng; GRANT chỉ mở "cửa bảng" để RLS có hiệu lực.

-- Chỉ đọc (RLS/def-func lo phần ghi):
grant select on campuses to authenticated;
grant select on parent_invitations to authenticated;
grant select on scoreboard_entries to authenticated;
grant select on audit_log to authenticated;              -- RLS audit_admin_read: chỉ admin thấy

-- Đọc + ghi (RLS quyết định ai/hàng nào):
grant select, insert, update, delete on parent_links to authenticated;
grant select, insert, update, delete on attendance_records to authenticated;
grant select, insert, update, delete on wigs to authenticated;
grant select, insert, update, delete on lead_measures to authenticated;
grant select, insert, update, delete on lead_progress to authenticated;
grant select, insert, update, delete on wig_meetings to authenticated;

-- Phòng hờ các bảng lõi khác (idempotent nếu đã có):
grant select, insert, update, delete on enrollments to authenticated;
grant select, insert, update, delete on classes to authenticated;
