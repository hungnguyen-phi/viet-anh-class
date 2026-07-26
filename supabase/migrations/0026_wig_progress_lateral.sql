-- 0026 — wig_progress_v gọi wig_actual() 1 LẦN/dòng (LATERAL) thay vì 6 lần → ~6x nhẹ hơn.
-- Đồng thời đổi current_date (UTC) sang vn_today() cho nhịp expected_pct đúng giờ VN.
-- (File này được khôi phục 2026-07-26 từ supabase_migrations.schema_migrations của project
--  eagsageokobtidpmxucx: migration đã áp lên DB từ 2026-07-22 nhưng chưa từng commit vào git.)
set search_path = public;

create or replace view wig_progress_v with (security_invoker = true) as
select
  w.id as wig_id, w.class_id, w.student_id, w.scope, w.area, w.period, w.period_label,
  w.target_value, w.unit, w.start_date, w.end_date,
  x.a as actual,
  case when w.target_value > 0 then least(1, round(x.a / w.target_value, 4)) else 0 end as pct,
  case when (w.end_date - w.start_date) > 0
       then least(1, greatest(0, round((vn_today() - w.start_date)::numeric / (w.end_date - w.start_date), 4)))
       else 1 end as expected_pct,
  case
    when (case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end)
      then 'on_track'
    when (case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end) - 0.1
      then 'mid'
    else 'off_track'
  end as status
from wigs w
cross join lateral (select wig_actual(w.id) as a) x;

grant select on wig_progress_v to authenticated;
