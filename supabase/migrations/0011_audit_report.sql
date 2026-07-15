-- 0011 — Audit log (§12.4) + helper báo cáo phụ huynh.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table audit_log enable row level security;
create policy audit_admin_read on audit_log for select using (auth_role() = 'admin');
create index idx_audit_created on audit_log (created_at desc);

-- Ghi audit (security definer → bỏ qua RLS, actor = người gọi).
create or replace function log_audit(p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, detail) values (auth.uid(), p_action, p_detail);
$$;
grant execute on function log_audit(text, jsonb) to authenticated;

-- Tiến độ WIG năm (4 lĩnh vực) của LỚP của 1 học sinh — chỉ phụ huynh của em đó / nhân sự xem được.
create or replace function child_class_progress(s uuid)
returns table(area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (
    select class_id from enrollments where student_id = s and is_active limit 1
  ),
  prog as (
    select
      w.area,
      case when w.target_value > 0 then least(1, round(coalesce(sum(lp.value), 0) / w.target_value, 4)) else 0 end as pct,
      case when (w.end_date - w.start_date) > 0
           then least(1, greatest(0, round((current_date - w.start_date)::numeric / (w.end_date - w.start_date), 4)))
           else 1 end as expected
    from wigs w
    left join lead_measures lm on lm.wig_id = w.id
    left join lead_progress lp on lp.lead_measure_id = lm.id
    where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    group by w.id
  )
  select area, pct,
    case when pct >= expected then 'on_track' when pct >= expected - 0.1 then 'mid' else 'off_track' end
  from prog
  where is_my_child(s) or auth_role() in ('admin', 'principal', 'teacher');
$$;
grant execute on function child_class_progress(uuid) to authenticated;
