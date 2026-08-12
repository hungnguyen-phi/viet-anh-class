-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0106 — BGH THẤY "BAO NHIÊU PHẦN TRĂM MỤC TIÊU DO CHÍNH EM ĐẶT", VÀ TRẦN 4 WIG LỚP CHẶN THẬT
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Hai việc, cùng một gốc: docs/MO_HINH_WIG.md nói ra một luật, mà CSDL thì chưa nói.
--
-- ── 1. `set_by` LÊN TỚI BGH ────────────────────────────────────────────────────────────────
--
-- §4 và §10.2 gọi tỉ lệ "mục tiêu do chính em đặt" là MỘT SỐ DUY NHẤT của BGH: mô hình này sống
-- hay chết nằm ở chỗ em có cầm bút hay không. Cô đặt hộ cả lớp thì mọi con số khác trên màn vẫn
-- xanh — số WIG đủ, tick đều, thi đua chạy — mà thứ chương trình muốn tạo ra thì không có.
--
-- Số ấy ĐÃ tính rồi, nhưng chỉ hiện trên màn GVCN (components/wig/TuongWig.tsx). Người cần nó
-- nhất lại không thấy: `school_wig_rollup` không trả `set_by` nên trang campus không có gì để vẽ.
--
-- ĐỌC pg_proc TRƯỚC KHI GHI (bài học đã ghi trong bộ nhớ dự án: repo từng lệch với hàm đang
-- chạy). Bản dưới đây chép NGUYÊN VĂN thân hàm đang chạy trên production ngày 12/08/2026, chỉ
-- thêm CTE `emwig` và hai cột cuối. Không đụng một chữ nào của phần cũ.
--
-- ── 2. TRẦN 4 WIG LỚP ──────────────────────────────────────────────────────────────────────
--
-- §3 nói trần phải chặn ở CSDL. `wigs_lop_ky_uidx` (0100) chặn TRÙNG (class_id, area, period,
-- period_label), nên với một nhãn kỳ cố định nó vô tình cũng chặn ở 4 — vì wig_area có đúng 4
-- giá trị. Nhưng đổi nhãn kỳ là đẻ thêm được: hai mục tiêu năm "2026–2027" và "2026-2027" khác
-- nhau đúng một dấu gạch, và trần bốc hơi. Đây là trigger đếm thật.
--
-- Bám mẫu private.chan_viec_thu_hai (0100): cùng kiểu trigger, cùng lối báo lỗi, cùng errcode.

-- ── 1. school_wig_rollup + hai cột mục tiêu của em ───────────────────────────────────────────
-- Đổi kiểu trả về ⇒ phải drop trước; create or replace không đổi được RETURNS TABLE.
drop function if exists public.school_wig_rollup(date);

create function public.school_wig_rollup(p_week_start date default null)
returns table(
  class_id uuid, class_name text, grade_name text, grade_sort integer, teacher_name text,
  wigs_total bigint, wigs_won bigint, avg_pct numeric,
  tick_students bigint, tick_count bigint, student_count bigint,
  -- MỚI: số mục tiêu năm đã duyệt của học sinh trong lớp, và trong đó bao nhiêu do CHÍNH EM đặt.
  -- Trả hai con số thô chứ không trả sẵn phần trăm: lớp chưa em nào đặt mục tiêu thì mẫu số là 0,
  -- và một cột "0%" không phân biệt được với "chưa có gì để tính". Màn hình quyết định cách nói.
  muc_tieu_em bigint, muc_tieu_em_tu_dat bigint
)
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
  -- MỤC TIÊU CỦA EM, theo lớp. Chỉ đếm cái ĐÃ DUYỆT: bản nháp và bản chờ duyệt chưa phải là một
  -- cam kết, gộp vào thì tỉ lệ đẹp lên nhờ những thứ chưa ai đồng ý.
  --
  -- Đi qua `enrollments` chứ không qua wigs.class_id: mục tiêu của em thuộc về EM, và em chuyển
  -- lớp giữa năm thì lớp mới mới là chỗ BGH đang nhìn.
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
$function$;

grant execute on function public.school_wig_rollup(date) to authenticated;

-- ── 2. TRẦN 4 WIG LỚP MỖI KỲ ─────────────────────────────────────────────────────────────────
--
-- ĐẾM THEO NGÀY GIAO NHAU, KHÔNG THEO period_label. Đây chính là chỗ đã hở: nhãn kỳ là một
-- chuỗi người gõ, nên "2026–2027" và "2026-2027" khác nhau đúng một dấu gạch và mọi phép đếm gom
-- theo nhãn liền tách chúng ra làm hai kỳ — trần bốc hơi trong khi trên màn hình vẫn là một năm
-- học. Ngày thì không nói dối được: hai mục tiêu năm phủ lên nhau về thời gian là hai mục tiêu
-- lớp đang chạy cùng lúc, bất kể ai gõ nhãn thế nào.
--
-- Chỉ đếm bản ĐÃ DUYỆT: WIG lớp do cô tạo nên mặc định đã là approved, nhưng lọc cho đúng ý §3
-- và để bản nháp (nếu sau này có) không ăn mất một suất.
--
-- KHÔNG áp cho tháng/tuần: một năm học có 12 mốc tháng và ~52 mốc tuần dưới MỖI mục tiêu năm,
-- app tự rải chúng (lib/wig-tao.ts sinhNhip). Trần 4DX là trần của MỤC TIÊU, không phải của mốc.
create or replace function private.chan_wig_lop_thu_nam()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dem int;
begin
  if new.scope is distinct from 'class' or new.period is distinct from 'year' then
    return new;
  end if;
  select count(*) into v_dem
  from wigs
  where scope = 'class'
    and period = 'year'
    and class_id = new.class_id
    and status = 'approved'
    and start_date <= new.end_date
    and end_date   >= new.start_date
    and id is distinct from new.id;
  if v_dem >= 4 then
    raise exception 'Mỗi lớp chỉ được có 4 mục tiêu năm (một cho mỗi lĩnh vực). Hãy xoá bớt trước khi thêm.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists chan_wig_lop_thu_nam on wigs;
create trigger chan_wig_lop_thu_nam
  before insert or update of class_id, period, start_date, end_date, scope, status on wigs
  for each row execute function private.chan_wig_lop_thu_nam();
