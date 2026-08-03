-- Tiến độ của một kỳ chỉ được tính bằng việc làm TRONG kỳ đó.
--
-- BỆNH CHUNG. 0074 đã vá class_lead_board, nhưng cùng một lỗi còn nằm ở bốn chỗ khác: chúng chọn
-- WIG theo tuần rồi lại cộng lead_progress KHÔNG lọc ngày. Hậu quả là trên cùng một dữ liệu, hai
-- màn hình ra hai con số — đúng loại lệch đã gây sự cố 7B1 ngày 03/08.
--
-- Vì sao chuyện "tick nằm ngoài kỳ" có thật chứ không phải giả thuyết:
--   - RLS chỉ chặn HỌC SINH tick ngoài tuần hiện tại (0073). GVCN/Admin sửa được mọi ngày
--     (lp_staff_manage, 0046) — và phải như vậy, để còn chữa sai sót.
--   - Dữ liệu cũ có sẵn từ trước khi 0073 siết ngày.
-- Kiểm production 2026-08-03: 4 dòng lead_progress nằm ngoài khoảng ngày của WIG chứa nó (WIG tuần
-- W29 13/07→19/07 nhưng tick ngày 23/07 và 27/07). Một trong số đó khiến WIG cá nhân "Học 10 từ
-- vựng mới" hiện 5/5 ĐẠT trong khi màn hình của em chỉ có 4 ô vàng — em thắng nhờ một lượt tick
-- không có ô nào trên màn hình.
--
-- SAU MIGRATION NÀY: 4 WIG cá nhân đó giảm đúng 4 lượt (đã đối chiếu trước khi chạy). Không dòng
-- lead_progress nào bị xoá — tick vẫn còn nguyên, chỉ thôi không được tính vào một kỳ mà nó không
-- thuộc về. Muốn nó được tính thì sửa lại ngày của tick, đó mới là chữa đúng chỗ.

set search_path = public;

-- ============================================================
-- 1) private.wig_actual — nền của wig_progress_v, class_ranks, điểm thi đua
-- ============================================================
-- Cộng đệ quy toàn cây WIG con là ĐÚNG và giữ nguyên (tiến độ năm = tổng các tuần). Chỗ sai là
-- không có cửa sổ ngày: mỗi WIG trong cây nay chỉ nhận tick nằm trong khoảng ngày của CHÍNH NÓ.
--
-- Với WIG năm có lead gắn thẳng, khoảng ấy là cả năm nên gần như không đổi gì. Với WIG tuần, nó
-- đúng bằng bảy ngày của tuần — cùng cửa sổ mà class_lead_board (0074) và class_tick_matrix đang
-- dùng để vẽ ô vàng. Từ đây thanh tiến độ và dải ô tick không thể nói hai chuyện khác nhau nữa.
create or replace function private.wig_actual(w uuid) returns numeric
  language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id, start_date, end_date from wigs where id = w
    union all
    select c.id, c.start_date, c.end_date
    from wigs c join descendants d on c.parent_wig_id = d.id
  )
  select coalesce(sum(lp.value), 0)
  from descendants d
  join lead_measures lm on lm.wig_id = d.id
  join lead_progress lp
    on lp.lead_measure_id = lm.id
   and lp.logged_date between d.start_date and d.end_date;
$$;
revoke all on function private.wig_actual(uuid) from public;
grant execute on function private.wig_actual(uuid) to authenticated, service_role;

-- ============================================================
-- 2) school_wig_rollup — bảng BGH nhìn để biết lớp nào thắng
-- ============================================================
-- Hai bất đối xứng trong cùng một hàm, nằm cạnh nhau trên cùng một dòng của bảng:
--   - cột wigs_won/avg_pct đi qua wig_actual() → cộng mọi thời kỳ;
--   - cột tick_students/tick_count có lọc logged_date theo tuần.
-- Nên hiệu trưởng đọc được "thắng 100% nhưng 0/29 em tick" mà không có gì giải thích. Nay cả hai
-- dùng CÙNG cửa sổ tuần — đúng cửa sổ của class_lead_board, tức đúng thứ GVCN và học sinh nhìn.
--
-- Thêm: CTE `ticks` trước đây không lọc khoảng ngày của WIG, nên tick thuộc một WIG tuần khác vẫn
-- được đếm vào tuần đang xem. Nay ràng cả hai đầu.
create or replace function school_wig_rollup(p_week_start date default null)
returns table(
  class_id uuid,
  class_name text,
  grade_name text,
  grade_sort int,
  teacher_name text,
  wigs_total bigint,
  wigs_won bigint,
  avg_pct numeric,
  tick_students bigint,
  tick_count bigint,
  student_count bigint
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  cls as (
    select c.id, c.name,
           coalesce(g.name, c.grade, '—') as grade_name,
           coalesce(g.sort_order, 9999) as grade_sort,
           coalesce(p.full_name, p.email) as teacher_name,
           c.campus_id
    from classes c
    left join grades g on g.id = c.grade_id
    left join profiles p on p.id = c.homeroom_teacher_id
    where c.school_year = current_school_year()
      and c.is_active
      and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  ),
  ww as (
    select w.class_id, w.target_value,
           coalesce((
             select sum(lp.value)
             from lead_measures lm
             join lead_progress lp on lp.lead_measure_id = lm.id
             where lm.wig_id = w.id
               and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
           ), 0) as actual
    from wigs w
    where w.scope = 'class' and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
      and w.class_id in (select id from cls)
  ),
  agg as (
    select class_id,
           count(*) as wigs_total,
           count(*) filter (where target_value > 0 and actual >= target_value) as wigs_won,
           round(avg(case when target_value > 0 then least(1, actual / target_value) else 0 end), 4) as avg_pct
    from ww group by class_id
  ),
  -- Chỉ đếm tick THẬT của học sinh (student_id not null). Dòng giáo viên gõ tay thời trước
  -- 0073 có student_id NULL nên tự động không lọt vào cột này.
  ticks as (
    select w.class_id,
           count(distinct lp.student_id) as tick_students,
           count(lp.id) as tick_count
    from wigs w
    join lead_measures lm on lm.wig_id = w.id
    join lead_progress lp on lp.lead_measure_id = lm.id
    where w.scope = 'class' and w.period = 'week'
      and lp.student_id is not null
      and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
      -- Ràng nốt đầu còn lại: WIG cũng phải thuộc tuần đang xem, nếu không thì tick của một WIG
      -- tuần khác vẫn cộng vào đây trong khi cột wigs_won bên cạnh đã loại nó ra.
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
      and w.class_id in (select id from cls)
    group by w.class_id
  ),
  enr as (select class_id, count(*) as n from enrollments where is_active group by class_id)
  select c.id, c.name, c.grade_name, c.grade_sort, c.teacher_name,
         coalesce(a.wigs_total, 0), coalesce(a.wigs_won, 0), coalesce(a.avg_pct, 0),
         coalesce(t.tick_students, 0), coalesce(t.tick_count, 0), coalesce(e.n, 0)
  from cls c
  left join agg   a on a.class_id = c.id
  left join ticks t on t.class_id = c.id
  left join enr   e on e.class_id = c.id
  order by c.grade_sort, c.name;
$$;
revoke all on function school_wig_rollup(date) from public, anon;
grant execute on function school_wig_rollup(date) to authenticated;

-- ============================================================
-- 3) child_weeks — danh sách tuần trong báo cáo phụ huynh
-- ============================================================
-- `order by period_label desc` là sắp theo THỨ TỰ CHỮ trên chuỗi 'Wnn-YYYY'. Chữ 'W' đứng trước
-- số, nên 'W52-2026' > 'W05-2027': sang tháng 1, tuần mới nhất tụt xuống dưới tuần của tháng 12
-- năm cũ. Trang /report lấy weeks[0] làm tuần mặc định (report/page.tsx:92), nên từ đầu tháng 1
-- phụ huynh mở ra là thấy báo cáo của một tuần đã qua từ lâu mà không biết.
--
-- Sắp theo NGÀY THẬT của tuần. Nhãn vẫn là thứ trả về (giao diện và các RPC khác dùng nó), chỉ
-- đổi thứ tự — không đổi kiểu trả về nên chỗ gọi không phải sửa.
create or replace function child_weeks(s uuid)
returns table(week_label text)
language sql stable security definer set search_path = public as $$
  select w.period_label
  from wigs w
  where w.student_id = s and w.scope = 'student' and w.period = 'week'
    and w.period_label is not null
    and can_view_student(s)
  group by w.period_label
  order by max(w.start_date) desc;
$$;
revoke all on function child_weeks(uuid) from public, anon;
grant execute on function child_weeks(uuid) to authenticated;

-- ============================================================
-- 4) child_week_report — con số phụ huynh đọc cho MỘT tuần
-- ============================================================
-- CTE cũ: `lp as (select lead_measure_id, sum(value) from lead_progress group by 1)` — tổng của
-- MỌI thời kỳ, rồi gắn vào một WIG đã lọc theo period_label. Nên báo cáo "tuần W29" cộng cả lượt
-- tick làm ở W30, W31. Đây đúng là lỗi 0074 vừa vá cho class_lead_board, còn nguyên ở nhánh phụ
-- huynh — và phụ huynh là người ít có khả năng phát hiện số sai nhất.
create or replace function child_week_report(s uuid, wk text)
returns table(area wig_area, wig_actual numeric, wig_target numeric, wig_won boolean, leads_total int, leads_done int)
language sql stable security definer set search_path = public as $$
  with w as (
    select id, area, target_value, start_date, end_date
    from wigs
    where student_id = s and scope = 'student' and period = 'week' and period_label = wk
      and can_view_student(s)
  ),
  -- left join để WIG chưa có việc nào vẫn ra một dòng (giữ đúng hành vi cũ), và tổng của từng
  -- việc tính bằng truy vấn con có ràng ngày — không gộp trước rồi mới gắn vào WIG như bản cũ.
  lm as (
    select w.id as wig_id, w.area, w.target_value as wig_target,
           lmm.id as lead_id, lmm.target_value as lead_target,
           coalesce((
             select sum(lp.value) from lead_progress lp
             where lp.lead_measure_id = lmm.id
               and lp.logged_date between w.start_date and w.end_date
           ), 0) as total
    from w
    left join lead_measures lmm on lmm.wig_id = w.id
  )
  select
    lm.area,
    coalesce(sum(lm.total), 0) as wig_actual,
    max(lm.wig_target) as wig_target,
    coalesce(sum(lm.total), 0) >= max(lm.wig_target) as wig_won,
    count(lm.lead_id)::int as leads_total,
    count(lm.lead_id) filter (where lm.total >= lm.lead_target)::int as leads_done
  from lm
  group by lm.area;
$$;
revoke all on function child_week_report(uuid, text) from public, anon;
grant execute on function child_week_report(uuid, text) to authenticated;
