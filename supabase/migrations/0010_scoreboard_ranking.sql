-- 0010 — Điểm thi đua + xếp hạng lớp (gap d: grade/level/campus/group).
-- Điểm lớp = trung bình % hoàn thành các WIG lớp (×100). Hàm SECURITY DEFINER để xếp hạng
-- xuyên lớp (so sánh toàn hệ thống) nhưng chỉ trả về thứ hạng của 1 lớp được hỏi.

create or replace function class_competition_scores()
returns table(class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql stable security definer set search_path = public as $$
  with wig_pct as (
    select
      w.class_id,
      w.target_value,
      coalesce((
        select sum(lp.value)
        from lead_measures lm
        join lead_progress lp on lp.lead_measure_id = lm.id
        where lm.wig_id = w.id
      ), 0) as actual
    from wigs w
    where w.scope = 'class'
  )
  select
    c.id,
    c.campus_id,
    c.grade,
    case
      when c.grade ~ '^[0-9]+$' then
        case
          when c.grade::int between 1 and 5 then 'primary'
          when c.grade::int between 6 and 9 then 'secondary'
          else 'high'
        end
      else 'unknown'
    end as level,
    coalesce(round(avg(case when wp.target_value > 0 then least(1, wp.actual / wp.target_value) else 0 end) * 100, 1), 0) as score
  from classes c
  left join wig_pct wp on wp.class_id = c.id
  group by c.id, c.campus_id, c.grade;
$$;

create or replace function class_ranks(c uuid)
returns table(
  score numeric,
  grade_rank int, grade_total int,
  level_rank int, level_total int,
  campus_rank int, campus_total int,
  global_rank int, global_total int
)
language sql stable security definer set search_path = public as $$
  with s as (select * from class_competition_scores()),
  ranked as (
    select
      class_id, score,
      rank() over (partition by grade order by score desc)::int as grade_rank,
      count(*) over (partition by grade)::int as grade_total,
      rank() over (partition by level order by score desc)::int as level_rank,
      count(*) over (partition by level)::int as level_total,
      rank() over (partition by campus_id order by score desc)::int as campus_rank,
      count(*) over (partition by campus_id)::int as campus_total,
      rank() over (order by score desc)::int as global_rank,
      count(*) over ()::int as global_total
    from s
  )
  select score, grade_rank, grade_total, level_rank, level_total, campus_rank, campus_total, global_rank, global_total
  from ranked where class_id = c;
$$;

grant execute on function class_ranks(uuid) to authenticated;
revoke execute on function class_competition_scores() from anon, authenticated;
