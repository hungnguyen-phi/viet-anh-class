-- 0009 — View tiến độ + dự báo WIG (gap c). security_invoker → tôn trọng RLS của người gọi.
-- pct = thực tế / target; expected_pct = tỷ lệ thời gian đã trôi qua; status = on/mid/off track.
create view wig_progress_v with (security_invoker = true) as
select
  g.*,
  case
    when g.pct >= g.expected_pct then 'on_track'
    when g.pct >= g.expected_pct - 0.1 then 'mid'
    else 'off_track'
  end as status
from (
  select
    w.id as wig_id,
    w.class_id,
    w.student_id,
    w.scope,
    w.area,
    w.period,
    w.period_label,
    w.target_value,
    w.unit,
    w.start_date,
    w.end_date,
    coalesce(sum(lp.value), 0) as actual,
    case
      when w.target_value > 0
      then least(1, round(coalesce(sum(lp.value), 0) / w.target_value, 4))
      else 0
    end as pct,
    case
      when (w.end_date - w.start_date) > 0
      then least(1, greatest(0, round((current_date - w.start_date)::numeric / (w.end_date - w.start_date), 4)))
      else 1
    end as expected_pct
  from wigs w
  left join lead_measures lm on lm.wig_id = w.id
  left join lead_progress lp on lp.lead_measure_id = lm.id
  group by w.id
) g;

grant select on wig_progress_v to authenticated;
