-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0154 — KHÔNG CÒN HỌP LỚP: TICK KHOÁ THEO CHỮ KÝ PDR CỦA CHÍNH EM
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 19/08/2026: "bây giờ ko còn họp lớp nữa đâu, chỉ còn họp với buddy thôi", và chốt
-- ba đường: (1) tick khoá khi EM GHI NHẬN biên bản PDR tuần đó — không còn cú "Chốt" của cô;
-- (2) thắng/thua cam kết do em tự chấm ở câu 2 PDR; (3) họp lớp chỉ ẨN giao diện, dữ liệu
-- biên bản cũ giữ nguyên.
--
-- Phần CSDL của quyết định ấy nằm ở đây: khoá tick không thể chỉ là chuyện giao diện — RLS của
-- lead_progress mới là chốt thật. Luật cũ `tuan_da_hop` (tuần chốt bằng buổi họp lớp) GIỮ
-- NGUYÊN trong policy: các tuần đã chốt từ trước vẫn khoá đúng như đã khoá; nó chỉ không còn
-- được kích hoạt thêm vì nút "Chốt" đã ẩn. Luật mới đứng CẠNH nó: em đã ký PDR buddy của tuần
-- nào thì tick tuần đó của CHÍNH EM đóng — ký là chữ ký, ký xong còn sửa số được thì chữ ký
-- vô nghĩa (cùng triết lý pdr_student_update ở 0146). GVCN sửa hộ vẫn đi qua rls_all_lead_progress
-- (policy OR), không bị đụng.

create or replace function public.pdr_da_ky(p_student uuid, d date)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from pdr_meetings m
    where m.student_id = p_student
      and m.type = 'buddy'
      and m.acknowledged_at is not null
      -- Cùng cách đắp nhãn với isoWeekLabel ở lib/dates: 'W' + tuần ISO 2 chữ số + năm ISO.
      and m.week_label = 'W' || lpad(to_char(d, 'IW'), 2, '0') || '-' || to_char(d, 'IYYY')
  );
$$;
revoke all on function public.pdr_da_ky(uuid, date) from public, anon;
grant execute on function public.pdr_da_ky(uuid, date) to authenticated;

-- Ba policy phía HỌC SINH đắp thêm "and not pdr_da_ky(...)". Chép đúng biểu thức đang chạy
-- trên production (đọc pg_policy 19/08/2026 trước khi đè — bài học 0? lần lệch migration).
drop policy if exists rls_insert_lead_progress on lead_progress;
create policy rls_insert_lead_progress on lead_progress for insert
  with check (
    student_id = (select auth.uid())
    and logged_by = (select auth.uid())
    and is_class_student(lead_class(lead_measure_id))
    and logged_date >= (select vn_week_start())
    and logged_date <= (select vn_today())
    and lead_day_ok(lead_measure_id, logged_date)
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
    and not pdr_da_ky(student_id, logged_date)
  );

drop policy if exists rls_update_lead_progress on lead_progress;
create policy rls_update_lead_progress on lead_progress for update
  using (
    logged_by = (select auth.uid())
    and logged_date >= (select vn_week_start())
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
    and not pdr_da_ky(student_id, logged_date)
  )
  with check (
    logged_by = (select auth.uid())
    and logged_date >= (select vn_week_start())
    and logged_date <= (select vn_today())
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
    and not pdr_da_ky(student_id, logged_date)
  );

drop policy if exists rls_delete_lead_progress on lead_progress;
create policy rls_delete_lead_progress on lead_progress for delete
  using (
    logged_by = (select auth.uid())
    and logged_date >= (select vn_week_start())
    and not tuan_da_hop(lead_class(lead_measure_id), logged_date)
    and not pdr_da_ky(student_id, logged_date)
  );
