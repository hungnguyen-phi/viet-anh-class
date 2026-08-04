-- Họp xong là chốt tick. Bỏ ô "Chốt tick tuần vào [thứ]".
--
-- VÌ SAO BỎ. 0046 cho mỗi lớp khai trước một ngày chốt (mặc định Chủ Nhật), sau ngày ấy học sinh
-- không sửa tick được nữa — để buổi họp đọc số đã chốt. Nhưng nó bắt giáo viên ĐOÁN TRƯỚC ngày
-- họp rồi khai vào một ô cấu hình, và đoán sai thì hỏng cả hai chiều: đặt sớm thì khoá khi lớp
-- chưa họp, đặt muộn thì họp xong tick vẫn chạy và con số vừa bàn đã đổi.
--
-- Chủ dự án nói thẳng (2026-08-04): "khi nào họp là coi như chốt tick luôn". Đúng hơn hẳn — mốc
-- chốt gắn với việc THẬT SỰ XẢY RA thay vì một lời hứa khai trước. Không phải cấu hình gì cả.
--
-- LUẬT MỚI: tick của một tuần khoá lại khi lớp ĐÃ GHI NHẬN BUỔI HỌP cho chính tuần ấy — tức có
-- dòng trong wig_meeting_notes (0079) hoặc có biên bản trong wig_meetings (0080), cả hai đều đã
-- khoá theo NGÀY nên tra chính xác.
--
-- Giữ nguyên mọi vế cũ: đúng mình, đúng lớp, trong tuần hiện tại, không vượt hôm nay, đúng thứ
-- áp dụng. GVCN/Admin vẫn sửa được mọi ngày (rls_all_lead_progress) để chữa sai sót — kể cả sau
-- khi họp, vì đôi khi chính buổi họp phát hiện ra một lượt tick ghi nhầm.
--
-- Cột classes.tick_lock_dow GIỮ LẠI (không xoá) — dữ liệu cũ vô hại, và xoá cột là việc không
-- hoàn tác được. Nó chỉ thôi được dùng.

set search_path = public;

-- ============================================================
-- tuan_da_hop — tuần chứa ngày `d` đã được lớp tổng kết chưa
-- ============================================================
-- date_trunc('week', …) của Postgres lấy THỨ HAI, đúng quy ước tuần ISO mà cả app đang dùng.
create or replace function tuan_da_hop(p_class uuid, d date) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wig_meeting_notes n
    where n.class_id = p_class and n.week_start = date_trunc('week', d)::date
  ) or exists (
    select 1 from wig_meetings m
    where m.class_id = p_class and m.student_id is null
      and m.week_start = date_trunc('week', d)::date
  );
$$;
revoke all on function tuan_da_hop(uuid, date) from public, anon;
grant execute on function tuan_da_hop(uuid, date) to authenticated;

comment on function tuan_da_hop(uuid, date) is
  'Lớp đã ghi nhận buổi họp cho tuần chứa ngày này chưa. Đã họp = tick tuần ấy chốt lại (0081, thay tick_open của 0046).';

-- ============================================================
-- Ba chính sách ghi của HỌC SINH: thay tick_open bằng "chưa họp"
-- ============================================================
-- Chép lại nguyên văn các vế cũ từ 0048/0073 để không đánh rơi vế nào; chỉ đổi đúng một điều kiện.
drop policy if exists rls_insert_lead_progress on public.lead_progress;
create policy rls_insert_lead_progress on public.lead_progress as permissive for INSERT to public
  with check (
    (student_id = (select auth.uid()))
    and (logged_by = (select auth.uid()))
    and is_class_student(lead_class(lead_measure_id))
    and (logged_date >= (select vn_week_start()))
    and (logged_date <= (select vn_today()))
    and lead_day_ok(lead_measure_id, logged_date)
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
  );

drop policy if exists rls_update_lead_progress on public.lead_progress;
create policy rls_update_lead_progress on public.lead_progress as permissive for UPDATE to public
  using (
    (logged_by = (select auth.uid()))
    and (logged_date >= (select vn_week_start()))
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
  )
  with check (
    (logged_by = (select auth.uid()))
    and (logged_date >= (select vn_week_start()))
    and (logged_date <= (select vn_today()))
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
  );

drop policy if exists rls_delete_lead_progress on public.lead_progress;
create policy rls_delete_lead_progress on public.lead_progress as permissive for DELETE to public
  using (
    (logged_by = (select auth.uid()))
    and (logged_date >= (select vn_week_start()))
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
  );

comment on column classes.tick_lock_dow is
  'KHÔNG CÒN DÙNG từ 0081 — mốc chốt tick nay là "lớp đã ghi nhận buổi họp cho tuần đó". Giữ cột để không phá dữ liệu cũ.';
