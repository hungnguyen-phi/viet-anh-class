-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0122 — MỌI ĐƯỜNG ĐỌC CHUYỂN TỪ "WIG TUẦN" SANG "CAM KẾT TUẦN"
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0121 dựng bảng commitments và khoá wigs về đúng cấp năm. Nhưng sáu hàm đọc vẫn đang tìm
-- `wigs where period = 'week'` — nay không còn dòng nào như thế, nên nếu dừng ở 0121 thì mọi
-- bảng việc tuần, ma trận tick, báo cáo phụ huynh và bảng nhịp WIG toàn trường đều trả về RỖNG
-- mà không báo lỗi gì. Đúng kiểu hỏng im lặng mà repo này đã dính vài lần.
--
-- Đã đọc bản đang chạy trên production trước khi viết lại từng hàm (luật của dự án).

-- ── 0. SỬA MỘT CHỖ CỦA 0121 ────────────────────────────────────────────────────────────────
-- tuan_da_chot phải đòi buổi họp ĐÃ CHỐT, y như tuan_da_hop vẫn đòi. Bản ở 0121 chỉ hỏi "có
-- dòng biên bản chưa" — mà biên bản được tạo từ lúc mở phòng họp, nên cam kết sẽ bị khoá ngay
-- khi cô vừa mở phòng, trước cả khi họp.
create or replace function tuan_da_chot(p_class uuid, p_student uuid, p_week date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from wig_meetings m
    where m.class_id = p_class
      and m.week_start = p_week
      and m.student_id is not distinct from p_student
      and m.chot_at is not null
  );
$$;

-- ── 1. BẢNG VIỆC CHUNG CỦA LỚP ─────────────────────────────────────────────────────────────
-- Nguồn nay là CAM KẾT của lớp trong tuần đang xem (student_id is null), thay cho WIG tuần.
-- Trả thêm cam kết mẹ và V/X của nó: màn hình phải gom việc theo cam kết, và phải biết cam kết
-- ấy đã được chấm chưa.
drop function if exists public.class_lead_board(uuid, date, uuid);
create function public.class_lead_board(p_class uuid, p_week_start date default null, p_student uuid default null)
returns table(
  lead_measure_id uuid,
  title text,
  target_value numeric,
  unit text,
  active_weekdays smallint[],
  unit_per_tick numeric,
  wig_id uuid,
  wig_title text,
  area text,
  class_total numeric,
  contributors bigint,
  class_size bigint,
  my_dates date[],
  my_total numeric,
  students_done bigint,
  nhap_luong boolean,
  my_values jsonb,
  commitment_id uuid,
  commitment_title text,
  verdict text
)
language sql
stable
security definer
set search_path to 'public'
as $$
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
           lm.nhap_luong, lm.wig_id, w.title as wig_title, c.area::text as area,
           w.baseline as wig_baseline, kieu_don_vi(lm.unit) as kieu,
           c.id as cam_ket, c.title as cam_ket_ten, c.verdict
    from lead_measures lm
    join commitments c on c.id = lm.commitment_id
    join wigs w on w.id = c.wig_id
    where c.class_id = p_class
      and c.student_id is null
      and c.week_start = (select monday from wk)
  ),
  theo_em as (
    select l.id as lead_id, lp.student_id,
           case
             when l.kieu = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
             else sum(lp.value) * l.unit_per_tick
           end as gia
    from lms l
    join lead_progress lp
      on lp.lead_measure_id = l.id
     and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
    where lp.student_id is not null
    group by l.id, l.kieu, l.unit_per_tick, lp.student_id
  )
  select
    l.id, l.title, l.target_value, l.unit, l.active_weekdays, l.unit_per_tick,
    l.wig_id, l.wig_title, l.area,
    coalesce(
      case when l.kieu = 'do'
        then (select round(avg(t.gia), 2) from theo_em t where t.lead_id = l.id)
        else (select sum(t.gia) from theo_em t where t.lead_id = l.id)
      end, 0),
    coalesce((select count(*) from theo_em t where t.lead_id = l.id), 0),
    (select count(*) from enrollments e where e.class_id = p_class and e.is_active),
    coalesce((select array_agg(lp.logged_date order by lp.logged_date) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::date[]),
    coalesce((select t.gia from theo_em t where t.lead_id = l.id and t.student_id = (select sid from me)), 0),
    coalesce((select count(*) from theo_em t
              where t.lead_id = l.id and toi_dich(t.gia, l.target_value, l.wig_baseline)), 0),
    coalesce(l.nhap_luong, false),
    coalesce((select jsonb_object_agg(lp.logged_date::text, lp.value) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::jsonb),
    l.cam_ket, l.cam_ket_ten, l.verdict
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.cam_ket_ten, l.title;
$$;
revoke all on function public.class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function public.class_lead_board(uuid, date, uuid) to authenticated, service_role;

-- ── 2. MA TRẬN (EM × VIỆC) ─────────────────────────────────────────────────────────────────
drop function if exists public.class_tick_matrix(uuid, date);
create function public.class_tick_matrix(p_class uuid, p_week_start date default null)
returns table(
  student_id uuid, student_name text, lead_measure_id uuid, lead_title text,
  active_weekdays smallint[], wig_id uuid, wig_title text, area text, ticked_dates date[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  studs as (
    select e.student_id as sid, ten_hien_thi(p.full_name, p.email) as sname
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.class_id = p_class and e.is_active
  ),
  lms as (
    select lm.id, lm.title, lm.active_weekdays, lm.wig_id,
           w.title as wig_title, c.area::text as area, c.title as cam_ket_ten
    from lead_measures lm
    join commitments c on c.id = lm.commitment_id
    join wigs w on w.id = c.wig_id
    where c.class_id = p_class
      and c.student_id is null
      and c.week_start = (select monday from wk)
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
  group by s.sid, s.sname, l.id, l.title, l.active_weekdays, l.wig_id, l.wig_title, l.area, l.cam_ket_ten
  order by s.sname, l.cam_ket_ten, l.title;
$$;
revoke all on function public.class_tick_matrix(uuid, date) from public, anon;
grant execute on function public.class_tick_matrix(uuid, date) to authenticated, service_role;

-- ── 3. BÁO CÁO TUẦN CHO PHỤ HUYNH ──────────────────────────────────────────────────────────
-- THẮNG/THUA NAY LÀ Ý NGƯỜI, KHÔNG PHẢI PHÉP SO. Cột wig_won trước đây so tổng tick với đích;
-- nay nó đọc thẳng V/X mà cô và con đã chấm trong buổi họp. Chưa chấm thì chưa thắng — và đó là
-- câu trả lời đúng, không phải thiếu dữ liệu.
drop function if exists public.child_week_report(uuid, text);
create function public.child_week_report(s uuid, wk text)
returns table(area wig_area, wig_actual numeric, wig_target numeric, wig_won boolean,
              leads_total integer, leads_done integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with c as (
    select cm.*
    from commitments cm
    where cm.student_id = s
      and 'W' || to_char(cm.week_start, 'IW') || '-' || to_char(cm.week_start, 'IYYY') = wk
      and can_view_student(s)
  ),
  viec as (
    select c.id as cam_ket, c.area, c.verdict, c.week_start,
           lm.id as lead_id, lm.target_value as lead_target, lm.unit, lm.unit_per_tick,
           coalesce((
             select case
               when kieu_don_vi(lm.unit) = 'do'
                 then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
               else sum(lp.value) * lm.unit_per_tick
             end
             from lead_progress lp
             where lp.lead_measure_id = lm.id
               and lp.student_id = s
               and lp.logged_date between c.week_start and c.week_start + 6
           ), 0) as duoc
    from c
    left join lead_measures lm on lm.commitment_id = c.id
  )
  select
    v.area,
    coalesce(sum(v.duoc), 0),
    coalesce(sum(v.lead_target), 0),
    bool_or(v.verdict = 'win'),
    count(v.lead_id)::int,
    count(v.lead_id) filter (where v.duoc >= v.lead_target)::int
  from viec v
  group by v.area;
$$;
revoke all on function public.child_week_report(uuid, text) from public, anon;
grant execute on function public.child_week_report(uuid, text) to authenticated, service_role;

-- ── 4. NHỮNG TUẦN CON ĐÃ CÓ CAM KẾT ────────────────────────────────────────────────────────
drop function if exists public.child_weeks(uuid);
create function public.child_weeks(s uuid)
returns table(week_label text, week_start date, week_end date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select distinct
    'W' || to_char(c.week_start, 'IW') || '-' || to_char(c.week_start, 'IYYY'),
    c.week_start,
    c.week_start + 6
  from commitments c
  where c.student_id = s and can_view_student(s)
  order by 2 desc;
$$;
revoke all on function public.child_weeks(uuid) from public, anon;
grant execute on function public.child_weeks(uuid) to authenticated, service_role;

-- ── 5. NHỊP WIG TOÀN TRƯỜNG ────────────────────────────────────────────────────────────────
-- "THẮNG" nay đếm cam kết được chấm V. "TIẾN ĐỘ" thôi là trung bình phần trăm suy từ tick — nó
-- là TỈ LỆ VIỆC DẪN DẮT CHẠM CHỈ TIÊU trong tuần, đúng thứ mô hình mới thật sự đo được.
drop function if exists public.school_wig_rollup(date);
create function public.school_wig_rollup(p_week_start date default null)
returns table(
  class_id uuid, class_name text, grade_name text, grade_sort integer, teacher_name text,
  wigs_total bigint, wigs_won bigint, avg_pct numeric,
  tick_students bigint, tick_count bigint, student_count bigint,
  muc_tieu_em bigint, muc_tieu_em_tu_dat bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
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
  cam_ket as (
    select cm.id, cm.class_id, cm.verdict
    from commitments cm
    where cm.student_id is null
      and cm.week_start = (select monday from wk)
      and cm.class_id in (select id from cls)
  ),
  agg as (
    select class_id,
           count(*) as wigs_total,
           count(*) filter (where verdict = 'win') as wigs_won
    from cam_ket group by class_id
  ),
  -- Việc dẫn dắt của tuần: đã có bao nhiêu em chạm chỉ tiêu.
  viec as (
    select k.class_id, lm.id as lead_id, lm.target_value, lm.unit, lm.unit_per_tick
    from cam_ket k join lead_measures lm on lm.commitment_id = k.id
  ),
  dat as (
    select v.class_id, v.lead_id,
           coalesce((
             select case when kieu_don_vi(v.unit) = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
               else sum(lp.value) * v.unit_per_tick end
             from lead_progress lp
             where lp.lead_measure_id = v.lead_id
               and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
           ), 0) >= v.target_value as xong
    from viec v
  ),
  pct as (
    select class_id, round(avg(case when xong then 1 else 0 end), 4) as avg_pct
    from dat group by class_id
  ),
  ticks as (
    select k.class_id,
           count(distinct lp.student_id) as tick_students,
           count(lp.id) as tick_count
    from cam_ket k
    join lead_measures lm on lm.commitment_id = k.id
    join lead_progress lp on lp.lead_measure_id = lm.id
    where lp.student_id is not null
      and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
    group by k.class_id
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
         coalesce(a.wigs_total, 0), coalesce(a.wigs_won, 0), coalesce(pc.avg_pct, 0),
         coalesce(t.tick_students, 0), coalesce(t.tick_count, 0), coalesce(e.n, 0),
         coalesce(m.muc_tieu_em, 0), coalesce(m.muc_tieu_em_tu_dat, 0)
  from cls c
  left join agg   a  on a.class_id = c.id
  left join pct   pc on pc.class_id = c.id
  left join ticks t  on t.class_id = c.id
  left join enr   e  on e.class_id = c.id
  left join emwig m  on m.class_id = c.id
  order by c.grade_sort, c.name;
$$;
revoke all on function public.school_wig_rollup(date) from public, anon;
grant execute on function public.school_wig_rollup(date) to authenticated, service_role;

-- ── 6. HAI HÀM NHỎ ĐI THEO ─────────────────────────────────────────────────────────────────
-- Hỏi thẳng cam kết thay vì đi vòng qua wig: cam kết mới là thứ giữ lớp của một việc.
create or replace function lead_class(lm uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.class_id from lead_measures l join commitments c on c.id = l.commitment_id where l.id = lm;
$$;

-- Cảnh báo "việc này đòi nhiều lượt tick hơn số ngày có thể tick" nay tính theo TUẦN của cam kết,
-- không theo khoảng ngày của một WIG tuần (đã không còn).
drop function if exists public.lead_measure_canh_bao(uuid);
create function public.lead_measure_canh_bao(p_commitment uuid)
returns table(lead_measure_id uuid, so_tick_can numeric, so_ngay_tick_duoc integer,
              so_nguoi_tick integer, tran_luot_tick integer, lech_don_vi boolean, qua_nhieu boolean)
language sql
stable
set search_path to 'public'
as $$
  with x as (
    select
      lm.id,
      ceil(lm.target_value / lm.unit_per_tick) as tick_can,
      (select count(*)::int
         from generate_series(c.week_start, c.week_start + 6, interval '1 day') g
        where extract(isodow from g)::smallint = any(lm.active_weekdays)) as so_ngay,
      case
        when c.student_id is null
          then greatest((select count(*)::int from enrollments e
                         where e.class_id = c.class_id and e.is_active), 1)
        else 1
      end as so_nguoi,
      (lm.unit is not null and w.unit is not null
        and private.bo_dau(lm.unit) <> private.bo_dau(w.unit)
        and lm.unit_per_tick = 1) as lech
    from lead_measures lm
    join commitments c on c.id = lm.commitment_id
    join wigs w on w.id = c.wig_id
    where lm.commitment_id = p_commitment
  )
  select id, tick_can, so_ngay, so_nguoi, so_ngay, lech, tick_can > so_ngay
  from x;
$$;
revoke all on function public.lead_measure_canh_bao(uuid) from public, anon;
grant execute on function public.lead_measure_canh_bao(uuid) to authenticated, service_role;
