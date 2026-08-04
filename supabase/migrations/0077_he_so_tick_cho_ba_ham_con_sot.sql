-- Ba hàm còn cộng tick mà quên nhân hệ số (vá tiếp 0076).
--
-- 0076 thêm lead_measures.unit_per_tick và dạy hai chỗ đọc nó: private.wig_actual và
-- class_lead_board. Nhưng rà lại toàn CSDL thì còn BA hàm khác vẫn cộng lead_progress.value trần:
--
--   child_week_report   — báo cáo phụ huynh
--   class_scoreboard    — bảng điểm thi đua 4 hạng mục của lớp
--   school_wig_rollup   — bảng ban giám hiệu
--
-- Hôm nay chưa ai đặt hệ số khác 1 nên chưa lệch. Nhưng ngày đầu tiên có người khai 30, thanh tiến
-- độ WIG sẽ hiện 90 trong khi bảng BGH và báo cáo phụ huynh hiện 3 — đúng thứ bệnh "hai nguồn sự
-- thật" mà 0074/0075 vừa dẹp xong hôm qua. Thêm một khái niệm vào mô hình mà không rà hết nơi
-- tiêu thụ nó thì chính mình gieo lại đúng con bệnh vừa chữa.
--
-- Không dòng nào đổi số sau migration này (mọi unit_per_tick đang là 1, đã đối chiếu trước khi chạy).

set search_path = public;

-- ============================================================
-- 0) class_lead_board — trả thêm unit_per_tick cho phía giao diện
-- ============================================================
-- class_total đã được nhân hệ số trong SQL từ 0076, nên bảng tick của học sinh đọc ra con số đúng.
-- Nhưng lúc em BẤM, giao diện nhích tổng lên ngay không chờ máy chủ (useOptimistic trong
-- LeadTicker) — và nó đang nhích 1. Với hệ số 30 thì con số nhảy sai một nhịp rồi mới về đúng khi
-- dữ liệu thật tới: em bấm xong thấy tỷ số giật, tưởng máy đếm nhầm.
--
-- Đổi kiểu trả về nên phải drop trước; create or replace không đổi được returns table.
drop function if exists class_lead_board(uuid, date, uuid);

create function class_lead_board(
  p_class uuid,
  p_week_start date default null,
  p_student uuid default null
)
returns table(
  lead_measure_id uuid,
  title text,
  target_value numeric,
  unit text,
  active_weekdays smallint[],
  unit_per_tick numeric,
  wig_id uuid,
  wig_title text,
  area text,
  class_total numeric,
  contributors bigint,
  class_size bigint,
  my_dates date[]
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  me as (
    select case
      when p_student is not null and (staff_can_read_class(p_class) or is_my_child(p_student))
        then p_student
      else (select auth.uid())
    end as sid
  ),
  lms as (
    select lm.id, lm.title, lm.target_value, lm.unit, lm.active_weekdays, lm.unit_per_tick,
           lm.wig_id, w.title as wig_title, w.area::text as area
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  )
  select
    l.id, l.title, l.target_value, l.unit, l.active_weekdays, l.unit_per_tick,
    l.wig_id, l.wig_title, l.area,
    coalesce((select sum(lp.value) * l.unit_per_tick from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             0),
    coalesce((select count(distinct lp.student_id) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id is not null
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             0),
    (select count(*) from enrollments e where e.class_id = p_class and e.is_active),
    coalesce((select array_agg(lp.logged_date order by lp.logged_date) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::date[])
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.title;
$$;
revoke all on function class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function class_lead_board(uuid, date, uuid) to authenticated;

-- ============================================================
-- 1) child_week_report — con số phụ huynh đọc
-- ============================================================
-- Giữ nguyên cửa sổ ngày đã siết ở 0075; chỉ nhân thêm hệ số.
create or replace function child_week_report(s uuid, wk text)
returns table(area wig_area, wig_actual numeric, wig_target numeric, wig_won boolean, leads_total int, leads_done int)
language sql stable security definer set search_path = public as $$
  with w as (
    select id, area, target_value, start_date, end_date
    from wigs
    where student_id = s and scope = 'student' and period = 'week' and period_label = wk
      and can_view_student(s)
  ),
  lm as (
    select w.id as wig_id, w.area, w.target_value as wig_target,
           lmm.id as lead_id, lmm.target_value as lead_target,
           coalesce((
             select sum(lp.value) * lmm.unit_per_tick from lead_progress lp
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

-- ============================================================
-- 2) class_scoreboard — điểm thi đua 4 hạng mục
-- ============================================================
-- Giữ nguyên phạm vi và quyền của 0028. `points` là tổng tick nên phải quy về đơn vị của WIG,
-- nếu không thì một lớp khai hệ số 30 sẽ có điểm thi đua gấp 30 lần lớp bên cạnh cho cùng công sức.
create or replace function class_scoreboard(p_class uuid)
returns table(category text, sub_category text, points numeric, lead_count bigint)
language sql stable security definer set search_path = public as $$
  select
    w.area::text as category,
    lm.sub_category,
    coalesce(sum(lp.value * lm.unit_per_tick), 0) as points,
    count(distinct lm.id) as lead_count
  from wigs w
  join lead_measures lm on lm.wig_id = w.id
  left join lead_progress lp on lp.lead_measure_id = lm.id
  where w.class_id = p_class
    and w.scope = 'class'
    and (staff_can_read_class(p_class) or is_class_student(p_class) or is_parent_of_class(p_class))
  group by w.area, lm.sub_category;
$$;
revoke execute on function class_scoreboard(uuid) from anon;
grant execute on function class_scoreboard(uuid) to authenticated;

-- ============================================================
-- 3) school_wig_rollup — bảng ban giám hiệu
-- ============================================================
-- Giữ nguyên mọi thứ 0075 đã sửa (cả hai cột dùng chung cửa sổ tuần, CTE ticks ràng cả hai đầu);
-- chỉ nhân hệ số ở chỗ tính `actual`. Cột tick_students/tick_count KHÔNG nhân — chúng đếm NGƯỜI
-- và LƯỢT, không phải đơn vị của WIG.
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
             select sum(lp.value * lm.unit_per_tick)
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
