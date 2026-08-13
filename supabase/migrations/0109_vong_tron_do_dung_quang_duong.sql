-- VÒNG TRÒN ĐO ĐÚNG QUÃNG ĐƯỜNG — và trần của việc tính theo TUẦN, không theo cả kỳ.
--
-- Chủ dự án bắt được 13/08/2026: mục tiêu "từ 7 đến 9 tiết", em tick 2 lượt — tức đã đi hết quãng —
-- mà vòng tròn hiện 22%. Bỏ một tick còn 11%, thêm một tick lên 33%. Đúng dãy 1/9, 2/9, 3/9.
--
-- ── LỖI 1: pct BỎ QUA baseline ──────────────────────────────────────────────────────────────
--
-- `wig_progress_v` tính `pct = wig_actual / target_value`. Nhưng `target_value` là ĐÍCH, không
-- phải QUÃNG PHẢI ĐI. Em cam kết đi từ 7 lên 9 thì quãng là 2; chia cho 9 là bắt em đi lại cả
-- đoạn đường em đã đứng sẵn trên đó.
--
-- Hệ quả không chỉ là con số xấu: vòng tròn ấy KHÔNG BAO GIỜ đầy được. Em làm đúng mọi thứ mình
-- hứa, app vẫn báo 22%. Đây là cùng một tội với §5.0 — app bày ra một con số nó không có quyền
-- bày — chỉ khác là lần này nó bịa theo hướng làm em thấy mình kém hơn thực tế.
--
-- Chính mã sinh mốc tháng của em (student/actions.ts) đã tính ĐÚNG từ đầu: nó rải
-- `target_value - baseline`. Nên hai chỗ trong cùng một hệ đang nói hai thứ khác nhau về cùng một
-- mục tiêu: mốc tháng cộng lại ra 2, còn vòng tròn đo theo 9.
--
-- ── LỖI 2: trần của wig_actual tính theo CẢ KỲ ──────────────────────────────────────────────
--
-- `wig_actual` kẹp phần đóng góp của mỗi em ở `lead_measures.target_value` — nhưng con số ấy là
-- NHỊP MỘT TUẦN ("4 lượt/tuần"), còn phép kẹp lại áp cho toàn bộ kỳ của mục tiêu.
--
-- Với WIG lớp thì vô hại: việc treo dưới mốc TUẦN, kỳ của nó đúng bằng một tuần, kẹp một tuần là
-- đúng ý ("một em không góp quá phần của mình"). Nhưng từ 0100 mục tiêu của EM là mục tiêu NĂM và
-- việc treo thẳng dưới nó — nên phép kẹp biến thành "cả năm chỉ được góp tối đa 4". Mục tiêu năm
-- "từ 0 đến 50 bài" với việc 4 lượt/tuần sẽ đứng ở 8% vĩnh viễn, dù em không bỏ tuần nào.
--
-- Sửa: gom thêm theo TUẦN của lượt tick. Ý nghĩa của trần giữ nguyên — "mỗi tuần một em góp tối đa
-- phần của mình" — và với việc treo dưới mốc tuần thì kết quả không đổi một đơn vị nào.
--
-- ── SỨC CÔNG PHÁ ────────────────────────────────────────────────────────────────────────────
--
-- Đã đếm trước khi sửa (13/08/2026): 69/69 WIG của lớp có baseline 0 hoặc null, đúng 1 WIG của học
-- sinh có baseline > 0 — chính cái đang hiển thị sai. Nên phép sửa baseline không làm xê dịch một
-- con số nào của lớp, của thi đua, hay của bảng BGH.

-- Một định nghĩa duy nhất cho "quãng phải đi", để bốn chỗ dưới đây không trôi khỏi nhau.
-- baseline null hoặc 0 → quãng đúng bằng đích (mọi WIG lớp đang ở nhánh này).
-- baseline >= đích → 0; form đã chặn từ trước, ở đây chỉ để không chia cho số âm.
create or replace function private.quang_duong(dich numeric, dang_o numeric)
returns numeric language sql immutable as $$
  select greatest(coalesce(dich, 0) - coalesce(dang_o, 0), 0);
$$;

comment on function private.quang_duong(numeric, numeric) is
  'Quãng em/lớp phải đi = đích - chỗ đang đứng. Mẫu số của MỌI phép tính phần trăm tiến độ. '
  'Chia cho `target_value` là bắt người ta đi lại cả đoạn đã đứng sẵn trên đó.';

-- ── 1. TRẦN THEO TUẦN ───────────────────────────────────────────────────────────────────────
create or replace function private.wig_actual(w uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id, class_id, scope, student_id, start_date, end_date
    from wigs where id = w
    union all
    select c.id, c.class_id, c.scope, c.student_id, c.start_date, c.end_date
    from wigs c
    join descendants d on c.parent_wig_id = d.id
    where c.scope = d.scope
  ),
  viec as (
    select d.class_id, d.scope, d.student_id, d.start_date, d.end_date,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  theo_em as (
    select v.lead_id, v.class_id, v.scope,
           -- TRẦN THEO TUẦN. `lead_measures.target_value` là nhịp MỘT TUẦN ("4 lượt/tuần"), nên
           -- kẹp nó lên tổng của cả kỳ là biến "mỗi tuần tối đa 4" thành "cả năm tối đa 4". Với
           -- việc treo dưới mốc tuần thì gom thêm theo tuần không đổi gì (kỳ vốn đã là một tuần);
           -- với mục tiêu NĂM của em — nơi việc treo thẳng dưới nó từ 0100 — đây là chỗ vỡ.
           case
             when v.target_value > 0
               then least(sum(lp.value) * v.unit_per_tick, v.target_value)
             else sum(lp.value) * v.unit_per_tick
           end as gop
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
     -- Mục tiêu của em chỉ đếm lượt tick của CHÍNH EM. WIG của lớp (student_id null) đếm hết.
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit_per_tick, lp.student_id,
             vn_week_start(lp.logged_date)
  )
  -- TỔNG, không chia. Xem ghi chú (a) ở trên.
  select coalesce(sum(t.gop), 0) from theo_em t;
$$;

-- ── 2. VIEW TIẾN ĐỘ ─────────────────────────────────────────────────────────────────────────
-- Giữ nguyên mọi cột (BangTienDo, StudentScoreboard, MeetingScoreboard đều đọc thẳng view này).
-- Chỉ đổi MẪU SỐ của `pct` và của `status`.
create or replace view public.wig_progress_v as
  select w.id as wig_id, w.class_id, w.student_id, w.scope, w.area, w.period, w.period_label,
         w.target_value, w.unit, w.start_date, w.end_date,
         x.a as actual,
         case
           when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
           when q.d > 0 then least(1, round(x.a / q.d, 4))
           else 0
         end as pct,
         case
           when (w.end_date - w.start_date) > 0
             then least(1, greatest(0, round((vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric, 4)))
           else 1
         end as expected_pct,
         case
           when w.measure_by = 'manual' then
             case when w.achieved_at is not null then 'on_track' else 'mid' end
           when (case when q.d > 0 then least(1, x.a / q.d) else 0 end)
              >= (case when (w.end_date - w.start_date) > 0
                       then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric))
                       else 1 end)
             then 'on_track'
           when (case when q.d > 0 then least(1, x.a / q.d) else 0 end)
              >= (case when (w.end_date - w.start_date) > 0
                       then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric))
                       else 1 end) - 0.1
             then 'mid'
           else 'off_track'
         end as status,
         w.measure_by, w.achieved_at
  from wigs w
  cross join lateral (select private.wig_actual(w.id) as a) x
  cross join lateral (select private.quang_duong(w.target_value, w.baseline) as d) q;

-- ── 3+4. HAI HÀM CÒN LẠI CÓ CHIA PHẦN TRĂM ──────────────────────────────────────────────────
-- 0107 vừa dạy chúng luật `measure_by='manual'`; nay dạy nốt luật quãng đường. Sửa cả hai trong
-- cùng một bản để không lặp lại đúng cái bệnh của repo này — chẩn đúng một chỗ rồi quên chỗ còn
-- lại. Hôm nay chúng chỉ đụng WIG lớp (baseline 0) nên không đổi số nào, nhưng luật thì phải một.
create or replace function public.child_class_progress(s uuid)
returns table (area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (select class_id from enrollments where student_id = s and is_active limit 1)
  select
    w.area,
    case when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
         when private.quang_duong(w.target_value, w.baseline) > 0
           then least(1, round(private.wig_actual(w.id) / private.quang_duong(w.target_value, w.baseline), 4))
         else 0 end as pct,
    case
      when w.measure_by = 'manual' then
        case when w.achieved_at is not null then 'on_track' else 'mid' end
      when (case when private.quang_duong(w.target_value, w.baseline) > 0
                 then least(1, private.wig_actual(w.id) / private.quang_duong(w.target_value, w.baseline))
                 else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end)
        then 'on_track'
      when (case when private.quang_duong(w.target_value, w.baseline) > 0
                 then least(1, private.wig_actual(w.id) / private.quang_duong(w.target_value, w.baseline))
                 else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end) - 0.1
        then 'mid'
      else 'off_track'
    end as status
  from wigs w
  where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    and can_view_student(s);
$$;

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
  ww as (
    select w.class_id,
           case when w.measure_by = 'manual' then (w.achieved_at is not null)
                else (private.quang_duong(w.target_value, w.baseline) > 0
                      and private.wig_actual(w.id) >= private.quang_duong(w.target_value, w.baseline)) end as dat,
           case when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
                when private.quang_duong(w.target_value, w.baseline) > 0
                  then least(1, private.wig_actual(w.id) / private.quang_duong(w.target_value, w.baseline))
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

-- ── 5. ĐIỂM THI ĐUA CỦA TRƯỜNG ──────────────────────────────────────────────────────────────
-- Chỗ thứ năm chia phần trăm từ `wig_actual`. Bỏ sót nó là để hai bảng cùng nói về một lớp bằng
-- hai con số khác nhau — bảng BGH đọc quãng đường, bảng thi đua đọc đích.
create or replace function public.class_competition_scores()
returns table(class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.campus_id, c.grade,
    case when c.grade ~ '^[0-9]+$' then
      case when c.grade::int between 1 and 5 then 'primary'
           when c.grade::int between 6 and 9 then 'secondary'
           else 'high' end
      else 'unknown' end as level,
    coalesce(round(avg(
      case
        when w.measure_by = 'manual'
          then case when w.achieved_at is not null then 1 else 0 end
        when private.quang_duong(w.target_value, w.baseline) > 0
          then least(1, private.wig_actual(w.id) / private.quang_duong(w.target_value, w.baseline))
        else 0
      end
    ) * 100, 1), 0) as score
  from classes c
  left join wigs w
    on w.class_id = c.id and w.scope = 'class' and w.period = 'year' and w.status = 'approved'
  where c.school_year = current_school_year()
    and c.is_active
  group by c.id, c.campus_id, c.grade;
$$;
