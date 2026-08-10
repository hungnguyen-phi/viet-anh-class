-- ════════════════════════════════════════════════════════════════════════════
-- 0098 — MỖI EM MỘT BỘ ĐẾM RIÊNG
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án bắt được (10/08/2026): "acc claudia tick xong được 1/3, mà tôi vào acc alex, thì
-- tick xong lại thành 2/3 là sai rồi, mỗi học sinh phải là 1 leadmeasure riêng, claudia phải
-- tick đủ 3, alex phải tick đủ 3, thì gvcn mới thắng."
--
-- ĐÚNG LÀ SAI. Từ 0073 tới nay, target_value của một việc (lead measure) được hiểu là MỤC TIÊU
-- CỦA CẢ LỚP, và mọi lượt tick của mọi em cộng vào một bộ đếm chung. Giáo viên thì gõ vào ô tên
-- việc đúng ý mình: "Làm bài tập về nhà mỗi em 3 bài" — tức là mục tiêu CỦA MỖI EM. Hai cách
-- hiểu ấy cho ra hai con số khác hẳn nhau, và cái app hiển thị là con số không ai định đặt:
-- lớp 30 em thì 3 lượt tick của 3 em đầu tiên đã "thắng", 27 em còn lại không cần làm gì.
--
-- Từ nay: target_value LÀ MỤC TIÊU CỦA MỖI EM.
--   · Em đạt việc khi tổng tick của CHÍNH EM (đã nhân hệ số) ≥ target_value.
--   · Lớp thắng việc khi TẤT CẢ các em đang học đều đạt.
--   · Một em chăm tick gấp đôi KHÔNG gánh được phần bạn — phần vượt bị chặn trần.
--
-- Ba hàm dưới đây là ba chỗ đang cộng dồn; sửa một chỗ mà quên hai chỗ kia thì màn hình học sinh
-- nói một đằng, bảng thi đua của hiệu trưởng nói một nẻo (đúng cái bệnh "hai nguồn sự thật" đã
-- gây sự cố 7B1). class_tick_matrix và child_week_report không có trong danh sách vì chúng vốn
-- đã đọc theo từng em.

-- ── 1. private.wig_actual — TIẾN ĐỘ CỦA MỘT MỤC TIÊU ────────────────────────────────────────
--
-- Đây là hàm gốc: điểm thi đua toàn trường (class_competition_scores), vòng tròn %, thanh tiến
-- độ năm/tháng/tuần đều đọc từ nó.
--
-- Công thức mới = TRUNG BÌNH MỨC ĐẠT CỦA MỖI EM, tính theo đúng đơn vị cũ:
--
--     với mỗi việc:  Σ(em)  min(tick của em × hệ số, mục tiêu mỗi em)  ÷  sĩ số
--
-- Chặn trần trước rồi mới chia: chặn trần là thứ khiến một em không gánh nổi phần bạn, còn chia
-- cho sĩ số giữ cho con số vẫn cùng đơn vị với mục tiêu GVCN đã gõ (3 bài vẫn là 3 bài, không
-- phải 6). Cả lớp đủ ⇒ đúng bằng mục tiêu ⇒ 100%, không bao giờ vượt.
--
-- WIG cá nhân (scope='student') chỉ có một em nên phép chia không áp dụng — mức đạt của em ấy
-- chính là tiến độ, vẫn chặn trần để không có ai "đạt 300%".
create or replace function private.wig_actual(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  with recursive descendants as (
    select id, class_id, scope, start_date, end_date from wigs where id = w
    union all
    select c.id, c.class_id, c.scope, c.start_date, c.end_date
    from wigs c join descendants d on c.parent_wig_id = d.id
  ),
  viec as (
    select d.class_id, d.scope, d.start_date, d.end_date,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  -- Mỗi (việc, em) một dòng: tổng của em, đã nhân hệ số và đã chặn trần ở mục tiêu mỗi em.
  -- Mục tiêu ≤ 0 là dữ liệu hỏng (không nên có) — khi ấy không chặn, giữ nguyên tổng để con số
  -- không âm thầm biến thành 0.
  theo_em as (
    select v.lead_id, v.class_id, v.scope,
           case
             when v.target_value > 0
               then least(sum(lp.value) * v.unit_per_tick, v.target_value)
             else sum(lp.value) * v.unit_per_tick
           end as gop
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit_per_tick, lp.student_id
  )
  select coalesce(sum(
    case
      when t.scope = 'class' then t.gop / greatest(
        (select count(*) from enrollments e where e.class_id = t.class_id and e.is_active), 1)
      else t.gop
    end
  ), 0)
  from theo_em t;
$function$;

-- ── 2. class_lead_board — BẢNG VIỆC CHUNG TRÊN MÀN HÌNH HỌC SINH ───────────────────────────
--
-- Thêm hai cột: my_total (tổng của chính em) và students_done (số em đã đạt đủ). Đó là hai con
-- số màn hình phải nói ra từ nay — "em 1/3" và "0/2 bạn đã đủ" — thay cho một tổng chung mà em
-- không biết phần nào là của mình.
--
-- class_total và contributors GIỮ LẠI: bảng của phòng họp và vài chỗ khác còn đọc, và tổng lớp
-- vẫn là con số có ích ("cả lớp đã làm 2 bài"). Chỉ có điều nó không còn là thước đo thắng thua.
--
-- Phải DROP rồi CREATE: Postgres không cho CREATE OR REPLACE khi đổi danh sách cột trả về.
-- Giữ nguyên tham số nên mọi lời gọi rpc() không phải sửa. Cấp lại quyền y như cũ.
drop function if exists public.class_lead_board(uuid, date, uuid);

create function public.class_lead_board(p_class uuid, p_week_start date default null, p_student uuid default null)
returns table(
  lead_measure_id uuid, title text, target_value numeric, unit text,
  active_weekdays smallint[], unit_per_tick numeric,
  wig_id uuid, wig_title text, area text,
  class_total numeric, contributors bigint, class_size bigint, my_dates date[],
  my_total numeric, students_done bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  me as (
    select case
      when p_student is not null and (staff_can_read_class(p_class) or is_my_child(p_student))
        then p_student
      else (select auth.uid())
    end as sid
  ),
  lms as (
    select lm.id, lm.title, lm.target_value, lm.unit, lm.active_weekdays, lm.unit_per_tick,
           lm.wig_id, w.title as wig_title, w.area::text as area
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  )
  select
    l.id, l.title, l.target_value, l.unit, l.active_weekdays, l.unit_per_tick,
    l.wig_id, l.wig_title, l.area,
    coalesce((select sum(lp.value) * l.unit_per_tick from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             0),
    coalesce((select count(distinct lp.student_id) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id is not null
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             0),
    (select count(*) from enrollments e where e.class_id = p_class and e.is_active),
    coalesce((select array_agg(lp.logged_date order by lp.logged_date) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::date[]),
    -- Tổng CỦA CHÍNH EM đang xem, cùng đơn vị với mục tiêu.
    coalesce((select sum(lp.value) * l.unit_per_tick from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             0),
    -- Số em ĐÃ ĐỦ. Đây mới là thước đo thắng thua: đủ hết = lớp thắng việc này.
    coalesce((select count(*) from (
                select lp.student_id
                from lead_progress lp
                where lp.lead_measure_id = l.id
                  and lp.student_id is not null
                  and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
                group by lp.student_id
                having sum(lp.value) * l.unit_per_tick >= l.target_value
              ) x), 0)
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.title;
$function$;

revoke all on function public.class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function public.class_lead_board(uuid, date, uuid) to authenticated, service_role;

-- ── 3. school_wig_rollup — BẢNG NHỊP WIG CỦA HIỆU TRƯỞNG ───────────────────────────────────
--
-- Bản cũ tự cộng lấy một tổng thô, tức là một BẢN SAO THỨ HAI của phép tính tiến độ. Nay gọi
-- thẳng private.wig_actual: một công thức, một chỗ sửa. Khoảng ngày không mất đi đâu — hàm ấy
-- dùng đúng start_date/end_date của WIG tuần, mà WIG tuần thì đã được lọc đúng tuần đang xem.
create or replace function public.school_wig_rollup(p_week_start date default null)
returns table(class_id uuid, class_name text, grade_name text, grade_sort integer,
              teacher_name text, wigs_total bigint, wigs_won bigint, avg_pct numeric,
              tick_students bigint, tick_count bigint, student_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
    select w.class_id, w.target_value, private.wig_actual(w.id) as actual
    from wigs w
    where w.scope = 'class' and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
      and w.class_id in (select id from cls)
  ),
  agg as (
    select class_id,
           count(*) as wigs_total,
           count(*) filter (where target_value > 0 and actual >= target_value) as wigs_won,
           round(avg(case when target_value > 0 then least(1, actual / target_value) else 0 end), 4) as avg_pct
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
  enr as (select class_id, count(*) as n from enrollments where is_active group by class_id)
  select c.id, c.name, c.grade_name, c.grade_sort, c.teacher_name,
         coalesce(a.wigs_total, 0), coalesce(a.wigs_won, 0), coalesce(a.avg_pct, 0),
         coalesce(t.tick_students, 0), coalesce(t.tick_count, 0), coalesce(e.n, 0)
  from cls c
  left join agg   a on a.class_id = c.id
  left join ticks t on t.class_id = c.id
  left join enr   e on e.class_id = c.id
  order by c.grade_sort, c.name;
$function$;

-- ── 4. lead_measure_canh_bao — TRẦN LƯỢT TICK GIỜ LÀ TRẦN CỦA MỘT EM ───────────────────────
--
-- 0076 nhân trần với sĩ số, vì hồi đó cả lớp cùng đổ vào một bộ đếm. Nay mỗi em phải tự đủ, nên
-- trần thật là "số ngày em tick được", không liên quan tới sĩ số: lớp 30 em cũng như lớp 3 em,
-- mục tiêu 10 lượt trong một tuần chỉ có 5 ngày học là không em nào đạt nổi.
--
-- Cột so_nguoi_tick giữ lại (app và test còn đọc) nhưng không còn dự phần vào phép tính.
create or replace function public.lead_measure_canh_bao(p_wig uuid)
returns table(lead_measure_id uuid, so_tick_can numeric, so_ngay_tick_duoc integer,
              so_nguoi_tick integer, tran_luot_tick integer, lech_don_vi boolean, qua_nhieu boolean)
language sql
stable
set search_path to 'public'
as $function$
  with x as (
    select
      lm.id,
      ceil(lm.target_value / lm.unit_per_tick) as tick_can,
      (select count(*)::int
         from generate_series(w.start_date, w.end_date, interval '1 day') g
        where extract(isodow from g)::smallint = any(lm.active_weekdays)) as so_ngay,
      case
        when w.scope = 'class'
          then greatest(
            (select count(*)::int from enrollments e where e.class_id = w.class_id and e.is_active),
            1)
        else 1
      end as so_nguoi,
      (lm.unit is not null and w.unit is not null
        and private.bo_dau(lm.unit) <> private.bo_dau(w.unit)
        and lm.unit_per_tick = 1) as lech
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where lm.wig_id = p_wig
  )
  select id, tick_can, so_ngay, so_nguoi, so_ngay, lech, tick_can > so_ngay
  from x;
$function$;
