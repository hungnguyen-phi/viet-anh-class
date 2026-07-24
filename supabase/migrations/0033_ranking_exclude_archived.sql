-- 0033 — Audit #1: xếp hạng bỏ qua lớp đã LƯU-TRỮ (is_active=false).
-- Trước đây lớp archive vẫn hiện ở /campus và làm phồng tổng số (grade/level/campus/global_total)
-- của mọi lớp khác. Thêm lọc c.is_active vào hàm nền + hàm campus_ranks.
-- class_ranks() dựng trên class_competition_scores() nên chỉ cần lọc ở hàm nền là đủ cho rank/total.

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
  where c.school_year = current_school_year()
    and c.is_active
  group by c.id, c.campus_id, c.grade;
$$;

create or replace function campus_ranks()
returns table(class_id uuid, name text, school_year text, score numeric, att_today bigint)
language sql stable security definer set search_path = public as $$
  with scores as (select * from class_competition_scores()),
  att as (
    select class_id, count(*) as n
    from attendance_records
    where date = vn_today()
    group by class_id
  )
  select c.id, c.name, c.school_year, coalesce(s.score, 0), coalesce(att.n, 0)
  from classes c
  left join scores s on s.class_id = c.id
  left join att    on att.class_id = c.id
  where c.school_year = current_school_year()
    and c.is_active
    and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  order by c.name;
$$;
