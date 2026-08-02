-- 0073 — WIG LỚP thắng/thua tính TỪ TICK THẬT CỦA HỌC SINH, không phải giáo viên tự gõ.
--
-- Vì sao: trước bản này, số liệu của WIG lớp đến từ nút "Ghi +" mà GVCN tự bấm (logProgress →
-- lead_progress với student_id NULL). Kiểm trên production ngày 2026-08-02: 27/27 dòng tiến độ
-- của WIG lớp là do giáo viên gõ, KHÔNG dòng nào đến từ tick của học sinh. Nên lớp nào cũng
-- "thắng" — cái bảng thắng/thua ấy chỉ đang phản chiếu lại chính tay người bấm.
--
-- 4DX Discipline 3 nói ngược lại: scoreboard phải do CHÍNH ĐỘI tạo ra bằng hành động thật, thì
-- nhìn vào mới biết mình đang thắng hay thua. Vậy: học sinh tick thẳng vào lead measure của WIG
-- LỚP, wig_actual() cộng lên như cũ, và thắng = đủ target tuyệt đối (giữ nguyên công thức, chỉ
-- đổi NGUỒN của con số).
--
-- Điểm cần biết: khoá ngoại đã đủ để làm việc này, không cần bảng nối nào. lead_progress vốn có
-- student_id, và RLS rls_insert_lead_progress (0048) đã cho một em thuộc lớp ghi vào BẤT KỲ lead
-- measure nào của lớp — kể cả của WIG scope='class'. Thứ còn thiếu chỉ là: giao diện cho em thấy
-- việc chung của lớp, và một cấu hình "việc này áp dụng những thứ mấy".
set search_path = public;

-- ============================================================
-- 1) Ngày áp dụng của từng lead measure
-- ============================================================
-- Không có bảng ngày-nghỉ nào cả (quyết định của chủ dự án 2026-08-02): giáo viên tự chọn thứ
-- khi tạo việc là đủ, đỡ một bảng phải khai báo và bảo trì. Việc học ngày thường thì chọn T2–T6;
-- việc cuối tuần ("đọc sách cùng bố mẹ") thì chọn T7/CN — mỗi lead measure tự quyết tần suất của
-- nó, đúng tinh thần 4DX (mỗi lead measure đo MỘT hành vi cụ thể).
--
-- Mặc định để CẢ 7 THỨ, không phải T2–T6: các lead measure đang có ngoài production đã được tick
-- vào cả T7/CN: siết mặc định xuống 5 ngày là làm hỏng dữ liệu cũ. Form tạo mới thì tích sẵn
-- T2–T6 — chỗ đặt mặc định thông minh là giao diện, không phải cột.
alter table lead_measures
  add column if not exists active_weekdays smallint[] not null default '{1,2,3,4,5,6,7}';

alter table lead_measures drop constraint if exists lead_measures_active_weekdays_check;
alter table lead_measures add constraint lead_measures_active_weekdays_check
  check (
    array_length(active_weekdays, 1) between 1 and 7
    and active_weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]
  );

comment on column lead_measures.active_weekdays is
  'ISO dow (1=T2..7=CN) — những thứ trong tuần mà việc này được tick. RLS chặn tick ngoài các thứ này.';

-- ============================================================
-- 2) RLS: không tick được vào thứ mà việc đó không áp dụng
-- ============================================================
create or replace function lead_day_ok(lm uuid, d date) returns boolean
  language sql stable security definer set search_path = public as $$
  select extract(isodow from d)::smallint = any(
    coalesce(
      (select l.active_weekdays from lead_measures l where l.id = lm),
      '{1,2,3,4,5,6,7}'::smallint[]
    )
  );
$$;
revoke all on function lead_day_ok(uuid, date) from public, anon;
grant execute on function lead_day_ok(uuid, date) to authenticated;

-- Chỉ thêm MỘT vế vào chính sách của học sinh; các vế cũ (đúng mình, đúng lớp, trong tuần, không
-- vượt hôm nay, tuần chưa chốt) giữ nguyên từ 0046/0048.
-- GVCN/Admin không đổi: rls_all_lead_progress vẫn sửa/xoá được mọi ngày để chữa sai sót.
drop policy if exists rls_insert_lead_progress on public.lead_progress;
create policy rls_insert_lead_progress on public.lead_progress as permissive for insert to public
  with check (
    student_id = (select auth.uid())
    and logged_by = (select auth.uid())
    and is_class_student(lead_class(lead_measure_id))
    and logged_date >= (select vn_week_start())
    and logged_date <= (select vn_today())
    and tick_open(lead_class(lead_measure_id))
    and lead_day_ok(lead_measure_id, logged_date)
  );

-- ============================================================
-- 3) class_lead_board — VIỆC CHUNG CỦA LỚP tuần này
-- ============================================================
-- Dùng cho bảng tick của học sinh: em thấy việc chung, thấy TỔNG cả lớp đã góp bao nhiêu (chứ
-- không chỉ phần của mình), và những ngày chính em đã tick.
--
-- Phải là SECURITY DEFINER: RLS rls_select_lead_progress chỉ cho một em đọc dòng tick của CHÍNH
-- em. Nếu để invoker thì con số "cả lớp" hiện ra sẽ đúng bằng phần của em — mà cái đội cần nhìn
-- là TỶ SỐ CHUNG (Discipline 3). Bù lại chỉ trả về số tổng hợp, không lộ ai tick gì.
--
-- p_student: GVCN/phụ huynh xem hộ một em (trang /student/[id]). Người ngoài truyền id bừa thì
-- rơi về chính mình — không phải lỗi, chỉ là không xem trộm được.
create or replace function class_lead_board(
  p_class uuid,
  p_week_start date default null,
  p_student uuid default null
)
returns table(
  lead_measure_id uuid,
  title text,
  target_value numeric,
  unit text,
  active_weekdays smallint[],
  wig_id uuid,
  wig_title text,
  area text,
  class_total numeric,
  contributors bigint,
  -- Sĩ số đang học, để nói được "12/29 bạn đã góp" mà không cần một vòng hỏi nữa.
  class_size bigint,
  my_dates date[]
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  me as (
    select case
      when p_student is not null and (staff_can_read_class(p_class) or is_my_child(p_student))
        then p_student
      else (select auth.uid())
    end as sid
  ),
  lms as (
    select lm.id, lm.title, lm.target_value, lm.unit, lm.active_weekdays,
           lm.wig_id, w.title as wig_title, w.area::text as area
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      -- Khớp theo NGÀY chứ không theo period_label: nhãn kỳ là chữ người gõ, có thể bỏ trống
      -- hoặc gõ khác quy ước, còn start_date/end_date thì luôn có (CHECK ở 0002).
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  )
  select
    l.id, l.title, l.target_value, l.unit, l.active_weekdays,
    l.wig_id, l.wig_title, l.area,
    coalesce((select sum(lp.value) from lead_progress lp where lp.lead_measure_id = l.id), 0),
    coalesce((select count(distinct lp.student_id) from lead_progress lp
              where lp.lead_measure_id = l.id and lp.student_id is not null), 0),
    (select count(*) from enrollments e where e.class_id = p_class and e.is_active),
    coalesce((select array_agg(lp.logged_date order by lp.logged_date) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::date[])
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.title;
$$;
revoke all on function class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function class_lead_board(uuid, date, uuid) to authenticated;

-- ============================================================
-- 4) class_tick_matrix — GVCN nhìn CẢ LỚP: em nào tick việc gì, ngày nào
-- ============================================================
-- Trước bản này GVCN chỉ xem được lịch tick của MỘT em, và phải vào đúng trang /student/[id] của
-- em đó — 30 em là 30 lần bấm vào rồi quay ra. Không có màn hình nào trả lời được câu hỏi thật sự
-- của buổi họp WIG: "tuần này em nào chưa làm?".
--
-- Trả về đủ cặp (học sinh × việc) kể cả khi chưa tick lần nào — chính những ô TRỐNG mới là thứ
-- GVCN cần thấy; nếu chỉ trả về dòng đã tick thì em chưa làm gì sẽ biến mất khỏi bảng.
create or replace function class_tick_matrix(p_class uuid, p_week_start date default null)
returns table(
  student_id uuid,
  student_name text,
  lead_measure_id uuid,
  lead_title text,
  active_weekdays smallint[],
  wig_id uuid,
  wig_title text,
  area text,
  ticked_dates date[]
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  studs as (
    select e.student_id as sid, coalesce(p.full_name, p.email, e.student_id::text) as sname
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.class_id = p_class and e.is_active
  ),
  lms as (
    select lm.id, lm.title, lm.active_weekdays, lm.wig_id,
           w.title as wig_title, w.area::text as area
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  )
  select
    s.sid, s.sname, l.id, l.title, l.active_weekdays, l.wig_id, l.wig_title, l.area,
    coalesce(
      array_agg(lp.logged_date order by lp.logged_date) filter (where lp.id is not null),
      '{}'::date[]
    )
  from studs s
  cross join lms l
  left join lead_progress lp
         on lp.lead_measure_id = l.id
        and lp.student_id = s.sid
        and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
  where staff_can_read_class(p_class)
  group by s.sid, s.sname, l.id, l.title, l.active_weekdays, l.wig_id, l.wig_title, l.area
  order by s.sname, l.title;
$$;
revoke all on function class_tick_matrix(uuid, date) from public, anon;
grant execute on function class_tick_matrix(uuid, date) to authenticated;

-- ============================================================
-- 5) school_wig_rollup — BGH xem thắng/thua WIG theo LỚP và theo GVCN
-- ============================================================
-- campus_rollup() đã có điểm thi đua và điểm danh, nhưng không có nhịp 4DX: tuần này lớp nào
-- thắng mấy WIG, bao nhiêu em thật sự có tick. Phạm vi giới hạn y hệt campus_rollup: admin thấy
-- toàn trường, hiệu trưởng chỉ thấy cơ sở mình.
create or replace function school_wig_rollup(p_week_start date default null)
returns table(
  class_id uuid,
  class_name text,
  grade_name text,
  grade_sort int,
  teacher_name text,
  wigs_total bigint,
  wigs_won bigint,
  avg_pct numeric,
  tick_students bigint,
  tick_count bigint,
  student_count bigint
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
  -- Chỉ đếm tick THẬT của học sinh (student_id not null). Dòng giáo viên gõ tay thời trước
  -- 0073 có student_id NULL nên tự động không lọt vào cột này.
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
$$;
revoke all on function school_wig_rollup(date) from public, anon;
grant execute on function school_wig_rollup(date) to authenticated;
