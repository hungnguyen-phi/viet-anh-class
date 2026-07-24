-- 0028 — 4DX trọn vẹn (mốc B): WIG cấp THÁNG (rollup đệ quy) + scoreboard 4 hạng mục.
set search_path = public;

-- ============================================================
-- wig_actual đệ quy: tổng lead_progress của WIG + MỌI hậu duệ (năm→tháng→tuần, bất kỳ độ sâu).
-- (Trước đây chỉ cộng 1 cấp con — không bắt được cháu khi có cấp tháng.)
-- ============================================================
create or replace function wig_actual(w uuid) returns numeric
  language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id from wigs where id = w
    union all
    select c.id from wigs c join descendants d on c.parent_wig_id = d.id
  )
  select coalesce(sum(lp.value), 0)
  from lead_measures lm
  join lead_progress lp on lp.lead_measure_id = lm.id
  where lm.wig_id in (select id from descendants);
$$;
grant execute on function wig_actual(uuid) to authenticated;

-- ============================================================
-- Sub-category cho lead measure (dùng cho hạng mục Kỹ năng: 5 Giá trị/7 Thói quen/DEAR/Thể chất/Khác).
-- ============================================================
alter table lead_measures add column if not exists sub_category text;

-- ============================================================
-- Bảng điểm 4 hạng mục của 1 lớp (Discipline 3). category = wig.area; sub_category từ lead_measures.
-- Tính realtime từ lead_progress (thay cho edge function trong PRD — realtime & đơn giản hơn).
-- ============================================================
create or replace function class_scoreboard(p_class uuid)
returns table(category text, sub_category text, points numeric, lead_count bigint)
language sql stable security definer set search_path = public as $$
  select
    w.area::text as category,
    lm.sub_category,
    coalesce(sum(lp.value), 0) as points,
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
