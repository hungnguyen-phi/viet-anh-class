-- 0018 — Bịt các lỗ rò rỉ / leo thang đặc quyền trên dữ liệu học sinh (Audit Phase 1).
-- Áp lên project cloud eagsageokobtidpmxucx. An toàn chạy lại (drop if exists / create or replace).
-- KHÔNG đổi timezone ở đây (để migration C9 riêng) → giữ current_date cho khớp code hiện tại.

-- Đảm bảo các hàm helper (is_my_child, auth_role...) trong schema public được nhận diện
-- ngay lúc tạo function (SQL function kiểm tra thân hàm theo search_path của phiên).
set search_path = public;

-- ============================================================
-- Helper: quyền xem 1 học sinh (dùng chung cho mọi RPC báo cáo).
-- Thay cho guard cũ `auth_role() in ('admin','principal','teacher')` vốn chỉ kiểm
-- VAI TRÒ mà không kiểm QUAN HỆ → mọi GV/BGH đọc được mọi HS xuyên lớp/cơ sở.
-- ============================================================
create or replace function can_view_student(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_my_child(s)
      or is_my_student(s)
      or (auth_role() = 'principal' and exists (
            select 1 from enrollments e join classes c on c.id = e.class_id
            where e.student_id = s and e.is_active and c.campus_id = auth_campus()))
      or auth_role() = 'admin';
$$;
grant execute on function can_view_student(uuid) to authenticated;

-- ============================================================
-- C1 — attendance_records: HS chỉ đọc bản ghi CỦA MÌNH; tổ trưởng đọc lớp HÔM NAY.
-- (policy cũ att_student_select cho MỌI HS đọc điểm danh cả lớp).
-- ============================================================
drop policy if exists att_student_select on attendance_records;
create policy att_student_self on attendance_records for select
  using (student_id = auth.uid());
create policy att_leader_select on attendance_records for select
  using (is_attendance_leader(class_id) and date = current_date);

-- ============================================================
-- C2 — wigs: HS trong lớp chỉ thấy WIG LỚP + WIG CÁ NHÂN CỦA MÌNH,
-- không thấy WIG cá nhân của bạn (nhánh cũ is_class_student phủ mọi scope).
-- View wig_progress_v là security_invoker nên tự động thừa hưởng bản vá này
-- → cột actual/pct (tính bằng wig_actual DEFINER) không còn lộ được vì hàng đã bị lọc.
-- ============================================================
drop policy if exists wig_read on wigs;
create policy wig_read on wigs for select using (
  (is_class_student(class_id) and (scope = 'class' or student_id = auth.uid()))
  or staff_can_read_class(class_id)
  or (scope = 'student' and is_my_child(student_id))
);

-- lead_measures: tương tự — HS không đọc tiêu đề lead measure của WIG cá nhân bạn khác.
drop policy if exists lm_read on lead_measures;
create policy lm_read on lead_measures for select using (
  staff_can_read_class(wig_class(wig_id))
  or exists (
    select 1 from wigs w
    where w.id = lead_measures.wig_id
      and is_class_student(w.class_id)
      and (w.scope = 'class' or w.student_id = auth.uid())
  )
);

-- ============================================================
-- C3 — RPC báo cáo trẻ em: đổi guard sang can_view_student(s) (kiểm quan hệ thật).
-- ============================================================
create or replace function child_weeks(s uuid)
returns table(week_label text)
language sql stable security definer set search_path = public as $$
  select distinct w.period_label
  from wigs w
  where w.student_id = s and w.scope = 'student' and w.period = 'week'
    and w.period_label is not null
    and can_view_student(s)
  order by w.period_label desc;
$$;

create or replace function child_week_report(s uuid, wk text)
returns table(area wig_area, wig_actual numeric, wig_target numeric, wig_won boolean, leads_total int, leads_done int)
language sql stable security definer set search_path = public as $$
  with w as (
    select id, area, target_value
    from wigs
    where student_id = s and scope = 'student' and period = 'week' and period_label = wk
      and can_view_student(s)
  ),
  lp as (select lead_measure_id, sum(value) as total from lead_progress group by 1)
  select
    w.area,
    coalesce(sum(lp.total), 0) as wig_actual,
    max(w.target_value) as wig_target,
    coalesce(sum(lp.total), 0) >= max(w.target_value) as wig_won,
    count(lm.id)::int as leads_total,
    count(lm.id) filter (where coalesce(lp.total, 0) >= lm.target_value)::int as leads_done
  from w
  left join lead_measures lm on lm.wig_id = w.id
  left join lp on lp.lead_measure_id = lm.id
  group by w.area;
$$;

create or replace function child_class_progress(s uuid)
returns table(area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (select class_id from enrollments where student_id = s and is_active limit 1)
  select
    w.area,
    case when w.target_value > 0 then least(1, round(wig_actual(w.id) / w.target_value, 4)) else 0 end as pct,
    case
      when (case when w.target_value > 0 then least(1, wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (current_date-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end)
        then 'on_track'
      when (case when w.target_value > 0 then least(1, wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (current_date-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end) - 0.1
        then 'mid'
      else 'off_track'
    end as status
  from wigs w
  where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    and can_view_student(s);
$$;

-- ============================================================
-- C4 — classes: chặn GV/BGH tự đổi GVCN hoặc dời cơ sở của lớp (chỉ admin).
-- (policy class_teacher_update không khoá cột + grant full-row → GVCN tự leo quyền).
-- ============================================================
create or replace function protect_class_privileged_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.homeroom_teacher_id is distinct from old.homeroom_teacher_id
      or new.campus_id is distinct from old.campus_id)
     and coalesce(auth_role(), 'pending') <> 'admin' then
    raise exception 'Chỉ admin được đổi GVCN hoặc cơ sở của lớp';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_class_cols on classes;
create trigger trg_protect_class_cols before update on classes
  for each row execute function protect_class_privileged_cols();

-- ============================================================
-- HIGH — profiles.email: chặn user tự đổi email (chiếm chỗ email nhân sự).
-- ============================================================
create or replace function protect_profile_privileged_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.campus_id is distinct from old.campus_id
      or new.email is distinct from old.email)
     and coalesce(auth_role(), 'pending') <> 'admin' then
    raise exception 'Chỉ admin được đổi role/campus/email của hồ sơ';
  end if;
  return new;
end;
$$;

-- ============================================================
-- HIGH — scoreboard_entries: HS không đọc dòng điểm CÁ NHÂN của bạn cùng lớp.
-- ============================================================
drop policy if exists sb_class_read on scoreboard_entries;
create policy sb_class_read on scoreboard_entries for select using (
  class_id is not null
  and (
    is_class_teacher(class_id)
    or (is_class_student(class_id) and student_id is null)
    or (auth_role() = 'principal' and is_campus_class(class_id))
  )
);

-- ============================================================
-- HIGH — class_ranks(): chỉ trả kết quả cho lớp mà người gọi được phép xem
-- (trước đây mọi authenticated truyền class_id bất kỳ đọc được điểm+thứ hạng).
-- ============================================================
create or replace function class_ranks(c uuid)
returns table(
  score numeric,
  grade_rank int, grade_total int,
  level_rank int, level_total int,
  campus_rank int, campus_total int,
  global_rank int, global_total int
)
language sql stable security definer set search_path = public as $$
  with s as (select * from class_competition_scores()),
  ranked as (
    select
      class_id, score,
      rank() over (partition by grade order by score desc)::int as grade_rank,
      count(*) over (partition by grade)::int as grade_total,
      rank() over (partition by level order by score desc)::int as level_rank,
      count(*) over (partition by level)::int as level_total,
      rank() over (partition by campus_id order by score desc)::int as campus_rank,
      count(*) over (partition by campus_id)::int as campus_total,
      rank() over (order by score desc)::int as global_rank,
      count(*) over ()::int as global_total
    from s
  )
  select score, grade_rank, grade_total, level_rank, level_total, campus_rank, campus_total, global_rank, global_total
  from ranked
  where class_id = c
    and (staff_can_read_class(c) or is_class_student(c) or is_parent_of_class(c));
$$;

-- ============================================================
-- MEDIUM — tổ trưởng không đọc hồ sơ HS đã nghỉ (thêm is_active).
-- ============================================================
create or replace function is_classmate_via_leader(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from enrollments e_self
    join enrollments e_other on e_other.class_id = e_self.class_id
    where e_self.student_id = auth.uid()
      and e_self.is_attendance_leader and e_self.is_active
      and e_other.student_id = s and e_other.is_active
  );
$$;
