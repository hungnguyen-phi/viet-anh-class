-- 0191 — VỎ TRANG (layout) MỘT LƯỢT ĐI CSDL (đo 04/09/2026, M3, sau 0189/0190)
--
-- Layout (dashboard) chạy trên MỌI trang sau đăng nhập và đang bắn 3 lượt PostgREST theo NGƯỜI XEM:
-- đếm chuông (notifications), cờ tổ trưởng điểm danh (enrollments), số tin nhắn phụ huynh↔GV
-- (pt_unread_total — chỉ vai có kênh). Thuần CSDL mỗi câu 0–5 ms nhưng mỗi lượt là một vòng đi-về
-- + một kết nối pooler (PostgREST 14.5 giữ ~7–11 kết nối, max_connections 60). Với /student sau
-- 0189 chỉ còn 1 lượt nội dung, ba lượt vỏ trang này chiếm 3/4 số lượt của cả trang → gộp một hàm.
--
-- SECURITY INVOKER: đọc notifications/enrollments qua RLS y hệt từng câu (rls_select_notifications
-- = user_id = auth.uid(); enrollments có is_attendance_leader/…); pt_unread_total gọi nguyên như cũ
-- (tự lọc theo auth.uid()). Không đè hàm nào. Luật 0187: grant execute đích danh.
--
-- Đối chiếu live 04/09: chưa có trang_layout; pt_unread_total(0 tham số) đang có; index
-- idx_notifications_user (user_id, created_at desc) đủ cho đếm chưa đọc.

create or replace function public.trang_layout()
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_chuong int := 0;
  v_to_truong boolean := false;
  v_tin int := 0;
begin
  if v_uid is null then return null; end if;
  select role::text into v_role from profiles where id = v_uid;

  select count(*) into v_chuong from notifications where user_id = v_uid and read = false;

  select exists (
    select 1 from enrollments e
    where e.student_id = v_uid and e.is_active and e.is_attendance_leader
  ) into v_to_truong;

  -- Chỉ vai có kênh liên lạc mới đếm tin nhắn (học sinh luôn 0 — trước đây vẫn bị hỏi).
  if v_role in ('parent', 'teacher', 'admin') then
    select coalesce(public.pt_unread_total(), 0) into v_tin;
  end if;

  return jsonb_build_object('chuong', v_chuong, 'toTruong', v_to_truong, 'tinNhan', v_tin);
end $$;

revoke execute on function public.trang_layout() from public, anon;
grant execute on function public.trang_layout() to authenticated, service_role;
