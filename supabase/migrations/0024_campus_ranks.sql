-- 0024 — Gộp N+1 ở /campus thành 1 RPC (Audit Phase 4 hiệu năng).
-- Trước: mỗi lớp gọi class_ranks() (quét class_competition_scores toàn hệ thống) + 1 count
--   → N lớp = N lần quét toàn cục → timeout khi nhiều lớp.
-- Sau: campus_ranks() tính class_competition_scores() ĐÚNG 1 LẦN + 1 aggregate điểm danh,
--   trả mọi lớp mà người gọi được xem (BGH = campus mình, admin = tất cả).
set search_path = public;

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
  where auth_role() = 'admin'
     or (auth_role() = 'principal' and c.campus_id = auth_campus())
  order by c.name;
$$;
revoke execute on function campus_ranks() from public, anon;
grant execute on function campus_ranks() to authenticated;
