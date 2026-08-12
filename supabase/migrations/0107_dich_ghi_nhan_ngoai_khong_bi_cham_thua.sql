-- ĐÍCH GHI NHẬN NGOÀI KHÔNG BỊ CHẤM THUA — nốt ba chỗ 0101 bỏ sót.
--
-- 0101 đã dạy `wig_progress_v` và 0100 đã dạy `class_competition_scores` một luật: đích
-- `measure_by = 'manual'` sống NGOÀI app (điểm trung bình môn, kết quả kỳ thi), `private.wig_actual`
-- không đếm được nó nên trả 0 vĩnh viễn — chỗ duy nhất nói thật là `achieved_at`.
--
-- Nhưng luật ấy chỉ được áp ở hai nơi. Ba hàm còn lại vẫn so `wig_actual >= target_value`, tức là
-- CHẤM THUA một mục tiêu chỉ vì app không có cách đếm nó:
--
--   · school_wig_rollup   — bảng BGH nhìn. WIG manual kéo `wigs_won` xuống và `avg_pct` về 0.
--                           Hiệu trưởng đọc thấy lớp 0% rồi đi nhắc giáo viên về một chuyện
--                           không có thật. Buộc tội bằng con số bịa.
--   · child_week_report   — báo cáo tuần gửi PHỤ HUYNH. Mục tiêu tuần manual của em luôn "chưa
--                           thắng", kể cả khi cô đã ghi nhận đạt.
--   · child_class_progress— vòng tiến độ lĩnh vực của lớp trên màn của em: 0% và có thể gắn nhãn
--                           `off_track` oan.
--
-- (class_scoreboard cộng điểm thi đua thuần từ lượt tick — WIG manual đóng góp 0 hạng mục. Không
-- chấm thua ai nên để nguyên: điểm thi đua theo thiết kế là điểm của hành vi tick.)
--
-- Cách sửa giống hệt 0101: rẽ nhánh theo `measure_by`, manual thì nhìn `achieved_at`.

-- ── 1. BẢNG BGH ─────────────────────────────────────────────────────────────────────────────
create or replace function public.school_wig_rollup(p_week_start date default null)
returns table (
  class_id uuid, class_name text, grade_name text, grade_sort int, teacher_name text,
  wigs_total bigint, wigs_won bigint, avg_pct numeric,
  tick_students bigint, tick_count bigint, student_count bigint,
  muc_tieu_em bigint, muc_tieu_em_tu_dat bigint
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  cls as (
    select c.id, c.name,
           coalesce(g.name, c.grade, '—') as grade_name,
           coalesce(g.sort_order, 9999) as grade_sort,
           coalesce(p.full_name, p.email) as teacher_name,
           c.campus_id
    from classes c
    left join grades g on g.id = c.grade_id
    left join profiles p on p.id = c.homeroom_teacher_id
    where c.school_year = current_school_year()
      and c.is_active
      and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  ),
  -- `dat` = mục tiêu này coi như thắng chưa, `pct` = phần trăm để lấy trung bình. Manual chỉ có
  -- hai giá trị 0/1 — đúng như nó vốn thế: một con số ngoài app thì hoặc đạt hoặc chưa.
  ww as (
    select w.class_id,
           case when w.measure_by = 'manual' then (w.achieved_at is not null)
                else (w.target_value > 0 and private.wig_actual(w.id) >= w.target_value) end as dat,
           case when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
                when w.target_value > 0 then least(1, private.wig_actual(w.id) / w.target_value)
                else 0 end as pct
    from wigs w
    where w.scope = 'class' and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
      and w.class_id in (select id from cls)
  ),
  agg as (
    select class_id,
           count(*) as wigs_total,
           count(*) filter (where dat) as wigs_won,
           round(avg(pct), 4) as avg_pct
    from ww group by class_id
  ),
  ticks as (
    select w.class_id,
           count(distinct lp.student_id) as tick_students,
           count(lp.id) as tick_count
    from wigs w
    join lead_measures lm on lm.wig_id = w.id
    join lead_progress lp on lp.lead_measure_id = lm.id
    where w.scope = 'class' and w.period = 'week'
      and lp.student_id is not null
      and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
      and w.class_id in (select id from cls)
    group by w.class_id
  ),
  emwig as (
    select e.class_id,
           count(*) as muc_tieu_em,
           count(*) filter (where w.set_by = 'student') as muc_tieu_em_tu_dat
    from wigs w
    join enrollments e on e.student_id = w.student_id and e.is_active
    where w.scope = 'student' and w.period = 'year' and w.status = 'approved'
      and e.class_id in (select id from cls)
    group by e.class_id
  ),
  enr as (select class_id, count(*) as n from enrollments where is_active group by class_id)
  select c.id, c.name, c.grade_name, c.grade_sort, c.teacher_name,
         coalesce(a.wigs_total, 0), coalesce(a.wigs_won, 0), coalesce(a.avg_pct, 0),
         coalesce(t.tick_students, 0), coalesce(t.tick_count, 0), coalesce(e.n, 0),
         coalesce(m.muc_tieu_em, 0), coalesce(m.muc_tieu_em_tu_dat, 0)
  from cls c
  left join agg   a on a.class_id = c.id
  left join ticks t on t.class_id = c.id
  left join enr   e on e.class_id = c.id
  left join emwig m on m.class_id = c.id
  order by c.grade_sort, c.name;
$$;

-- ── 2. BÁO CÁO TUẦN GỬI PHỤ HUYNH ───────────────────────────────────────────────────────────
-- Chữ ký giữ nguyên (report/page.tsx đọc đúng sáu cột này). `wig_actual` với mục tiêu manual vẫn
-- là 0 — đúng, vì app thật sự không đếm gì; chỉ `wig_won` là thôi nói dối.
create or replace function public.child_week_report(s uuid, wk text)
returns table (area wig_area, wig_actual numeric, wig_target numeric, wig_won boolean,
               leads_total int, leads_done int)
language sql stable security definer set search_path = public as $$
  with w as (
    select id, area, target_value, start_date, end_date, measure_by, achieved_at
    from wigs
    where student_id = s and scope = 'student' and period = 'week' and period_label = wk
      and can_view_student(s)
  ),
  lm as (
    select w.id as wig_id, w.area, w.target_value as wig_target,
           w.measure_by, w.achieved_at,
           lmm.id as lead_id, lmm.target_value as lead_target,
           coalesce((
             select sum(lp.value) * lmm.unit_per_tick from lead_progress lp
             where lp.lead_measure_id = lmm.id
               and lp.logged_date between w.start_date and w.end_date
           ), 0) as total
    from w
    left join lead_measures lmm on lmm.wig_id = w.id
  )
  select
    lm.area,
    coalesce(sum(lm.total), 0) as wig_actual,
    max(lm.wig_target) as wig_target,
    case when bool_or(lm.measure_by = 'manual')
         then bool_or(lm.achieved_at is not null)
         else coalesce(sum(lm.total), 0) >= max(lm.wig_target) end as wig_won,
    count(lm.lead_id)::int as leads_total,
    count(lm.lead_id) filter (where lm.total >= lm.lead_target)::int as leads_done
  from lm
  group by lm.area;
$$;

-- ── 3. VÒNG TIẾN ĐỘ LĨNH VỰC CỦA LỚP ────────────────────────────────────────────────────────
-- Manual: pct 0/1 theo achieved_at, và KHÔNG chấm `off_track` — chưa đạt giữa năm không phải là
-- đang tụt, chỉ là chưa tới ngày đo (cùng lối 0101 đã chọn cho wig_progress_v).
create or replace function public.child_class_progress(s uuid)
returns table (area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (select class_id from enrollments where student_id = s and is_active limit 1)
  select
    w.area,
    case when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
         when w.target_value > 0 then least(1, round(private.wig_actual(w.id) / w.target_value, 4))
         else 0 end as pct,
    case
      when w.measure_by = 'manual' then
        case when w.achieved_at is not null then 'on_track' else 'mid' end
      when (case when w.target_value > 0 then least(1, private.wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end)
        then 'on_track'
      when (case when w.target_value > 0 then least(1, private.wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end) - 0.1
        then 'mid'
      else 'off_track'
    end as status
  from wigs w
  where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    and can_view_student(s);
$$;
