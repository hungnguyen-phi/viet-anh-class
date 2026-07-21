-- 0014 — Báo cáo phụ huynh theo tuần (PRD §6.2 màn 7).
-- Phụ huynh KHÔNG có RLS đọc lead_measures → dùng RPC security definer, guard is_my_child.

-- Danh sách nhãn tuần có WIG cá nhân của em (mới nhất trước) — cho bộ lọc tuần.
create or replace function child_weeks(s uuid)
returns table(week_label text)
language sql stable security definer set search_path = public as $$
  select distinct w.period_label
  from wigs w
  where w.student_id = s and w.scope = 'student' and w.period = 'week'
    and w.period_label is not null
    and (is_my_child(s) or auth_role() in ('admin', 'principal', 'teacher'))
  order by w.period_label desc;
$$;
grant execute on function child_weeks(uuid) to authenticated;

-- LM hoàn thành/tổng + WIG thắng theo 4 lĩnh vực, cho 1 tuần cụ thể của em.
create or replace function child_week_report(s uuid, wk text)
returns table(
  area wig_area,
  wig_actual numeric,
  wig_target numeric,
  wig_won boolean,
  leads_total int,
  leads_done int
)
language sql stable security definer set search_path = public as $$
  with w as (
    select id, area, target_value
    from wigs
    where student_id = s and scope = 'student' and period = 'week' and period_label = wk
      and (is_my_child(s) or auth_role() in ('admin', 'principal', 'teacher'))
  ),
  lp as (
    select lead_measure_id, sum(value) as total from lead_progress group by 1
  )
  select
    w.area,
    coalesce(sum(lp.total), 0) as wig_actual,
    max(w.target_value) as wig_target,
    coalesce(sum(lp.total), 0) >= max(w.target_value) as wig_won,
    count(lm.id)::int as leads_total,
    count(lm.id) filter (where coalesce(lp.total, 0) >= lm.target_value)::int as leads_done
  from w
  left join lead_measures lm on lm.wig_id = w.id
  left join lp on lp.lead_measure_id = lm.id
  group by w.area;
$$;
grant execute on function child_week_report(uuid, text) to authenticated;
