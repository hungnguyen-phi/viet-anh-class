-- 0025 — Xếp hạng thi đua CHỈ trong năm học hiện tại (Audit Phase 2/3).
-- Trước: class_competition_scores() gộp mọi năm học → mẫu số ('Nhóm #x/y') phồng mỗi năm,
--   lớp năm cũ vẫn tính vào thứ hạng. Sau: chỉ so các lớp cùng năm học hiện tại (theo giờ VN).
set search_path = public;

-- Năm học VN hiện tại. Mốc chuyển ở tháng 6 (hè = chuẩn bị năm mới) — khớp schoolYearLabel (lib/dates.ts).
-- Dạng '2026-2027'.
create or replace function current_school_year() returns text
  language sql stable set search_path = public as $$
  select case
    when extract(month from vn_today()) >= 6
      then extract(year from vn_today())::text || '-' || (extract(year from vn_today()) + 1)::text
    else (extract(year from vn_today()) - 1)::text || '-' || extract(year from vn_today())::text
  end;
$$;
grant execute on function current_school_year() to authenticated, anon;

-- Chỉ chấm điểm lớp của NĂM HỌC HIỆN TẠI.
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
  group by c.id, c.campus_id, c.grade;
$$;
revoke execute on function class_competition_scores() from public, anon, authenticated;

-- /campus cũng chỉ liệt kê lớp năm học hiện tại.
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
    and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  order by c.name;
$$;
revoke execute on function campus_ranks() from public, anon;
grant execute on function campus_ranks() to authenticated;
