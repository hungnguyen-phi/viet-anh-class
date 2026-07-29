-- 0053 — Chỉ mục còn thiếu + gỡ chỉ mục trùng. Thuần hiệu năng, KHÔNG đụng RLS/quyền.
--
-- Vì sao chỉ làm chừng này mà không đụng tới cảnh báo "multiple permissive policies" (175 mục)
-- mà Supabase advisor báo: đã đo pg_stat_statements trên chính project này — query chậm nhất của
-- app là ~50ms, tức RLS CHƯA phải nút thắt ở quy mô hiện tại. Gộp/viết lại 175 policy là việc
-- đụng thẳng vào ranh giới dữ liệu học sinh, rủi ro rò dữ liệu cao hơn nhiều so với cái lợi đo
-- được. Để dành tới khi dữ liệu thật lớn lên và có số đo chứng minh RLS mới là chỗ nghẽn.

-- ── 1. Khoá ngoại chưa có chỉ mục ──────────────────────────────────────────────
-- Không có chỉ mục trên cột FK thì mỗi lần XOÁ/SỬA hàng cha, Postgres phải quét TOÀN BẢNG con
-- để kiểm ràng buộc. Nhẹ lúc bảng còn nhỏ, nhưng đúng vào những thao tác quản trị hay bị than
-- chậm (xoá người dùng, xoá cơ sở, xoá lớp) và tệ dần theo số hàng.
create index if not exists idx_edit_requests_requester on edit_requests (requester_id);
create index if not exists idx_edit_requests_resolved_by on edit_requests (resolved_by);
create index if not exists idx_pending_grants_invited_by on pending_user_grants (invited_by);
create index if not exists idx_pending_grants_campus on pending_user_grants (campus_id);
create index if not exists idx_school_networks_campus on school_networks (campus_id);
create index if not exists idx_wig_meetings_buddy_focus_lead on wig_meetings (buddy_focus_lead_id);

-- ── 2. Chỉ mục TRÙNG HỆT nhau ─────────────────────────────────────────────────
-- uq_meeting_class_week và wig_meetings_class_week_uidx phủ cùng một bộ cột. Giữ cả hai chỉ tổ
-- bắt Postgres cập nhật hai lần mỗi lần ghi biên bản họp, không thêm được gì khi đọc.
-- Bỏ cái do migration sau tạo ra, giữ tên gốc.
drop index if exists wig_meetings_class_week_uidx;
