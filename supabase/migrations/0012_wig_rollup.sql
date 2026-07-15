-- 0012 — Rollup tiến độ WIG: lead measure gắn vào WIG TUẦN; WIG NĂM = tổng các WIG tuần con.
-- wig_actual(w) = tổng lead_progress của lead measures thuộc w HOẶC thuộc các WIG con (parent_wig_id=w).

create or replace function wig_actual(w uuid) returns numeric
  language sql stable security definer set search_path = public as $$
  select coalesce(sum(lp.value), 0)
  from lead_measures lm
  join lead_progress lp on lp.lead_measure_id = lm.id
  where lm.wig_id = w
     or lm.wig_id in (select id from wigs c where c.parent_wig_id = w);
$$;
grant execute on function wig_actual(uuid) to authenticated;

-- View tiến độ dùng rollup.
create or replace view wig_progress_v with (security_invoker = true) as
select
  w.id as wig_id, w.class_id, w.student_id, w.scope, w.area, w.period, w.period_label,
  w.target_value, w.unit, w.start_date, w.end_date,
  wig_actual(w.id) as actual,
  case when w.target_value > 0 then least(1, round(wig_actual(w.id) / w.target_value, 4)) else 0 end as pct,
  case when (w.end_date - w.start_date) > 0
       then least(1, greatest(0, round((current_date - w.start_date)::numeric / (w.end_date - w.start_date), 4)))
       else 1 end as expected_pct,
  case
    when (case when w.target_value > 0 then least(1, wig_actual(w.id) / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (current_date - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end)
      then 'on_track'
    when (case when w.target_value > 0 then least(1, wig_actual(w.id) / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (current_date - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end) - 0.1
      then 'mid'
    else 'off_track'
  end as status
from wigs w;

-- Điểm thi đua = TB % các WIG NĂM (đã rollup) của lớp.
create or replace function class_competition_scores()
returns table(class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.campus_id, c.grade,
    case when c.grade ~ '^[0-9]+$' then
      case when c.grade::int between 1 and 5 then 'primary'
           when c.grade::int between 6 and 9 then 'secondary'
           else 'high' end
      else 'unknown' end as level,
    coalesce(round(avg(case when w.target_value > 0 then least(1, wig_actual(w.id) / w.target_value) else 0 end) * 100, 1), 0) as score
  from classes c
  left join wigs w on w.class_id = c.id and w.scope = 'class' and w.period = 'year'
  group by c.id, c.campus_id, c.grade;
$$;

-- Báo cáo phụ huynh: tiến độ WIG năm (rollup) của lớp con.
create or replace function child_class_progress(s uuid)
returns table(area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (select class_id from enrollments where student_id = s and is_active limit 1)
  select
    w.area,
    case when w.target_value > 0 then least(1, round(wig_actual(w.id) / w.target_value, 4)) else 0 end as pct,
    case
      when (case when w.target_value > 0 then least(1, wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (current_date-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end)
        then 'on_track'
      when (case when w.target_value > 0 then least(1, wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (current_date-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end) - 0.1
        then 'mid'
      else 'off_track'
    end as status
  from wigs w
  where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    and (is_my_child(s) or auth_role() in ('admin','principal','teacher'));
$$;
