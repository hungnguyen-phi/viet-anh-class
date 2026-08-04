-- Một lần tick đáng bao nhiêu đơn vị của WIG.
--
-- VẤN ĐỀ. Tiến độ WIG = tổng lượt tick, mà mỗi lượt tick luôn được tính là 1 — con số ấy nằm ngầm
-- trong mã, không ai khai được. Nên khi lead measure và WIG cha nói bằng hai đơn vị khác nhau thì
-- app cộng thẳng cái nọ vào cái kia.
--
-- Có thật trên production, lớp 7B1 (kiểm 2026-08-04):
--
--   WIG NĂM   Tăng số buổi đọc sách ở nhà        10 → 30 buổi
--     └─ WIG TUẦN  Đọc sách 3 buổi/1 tuần              0 → 3 buổi
--          └─ LEAD  Dành 30 phút mỗi tối để đọc sách       30 phút
--
-- Học sinh tick 3 lần là WIG tuần "3 buổi" đã thắng, trong khi việc dẫn dắt mới đi được 3/30.
-- Tệ hơn: việc ấy thuộc một WIG TUẦN, mà tuần chỉ có 7 ngày để tick — target 30 thì cả năm học
-- không ai đạt nổi. App không hé một lời nào về chuyện đó.
--
-- CÁCH SỬA. Khai tường minh: mỗi lần tick đáng bao nhiêu đơn vị của WIG.
--   - "Đọc sách mỗi tối" trong WIG tính bằng BUỔI      → 1  (mặc định, không phải đụng tới)
--   - "Đọc sách 30 phút mỗi tối" trong WIG tính bằng PHÚT → 30
--
-- Mặc định 1 nên KHÔNG dòng nào đổi số sau migration này (đã đối chiếu trước khi chạy). Nó chỉ mở
-- ra khả năng khai đúng, không ép ai theo mô hình nào — chuyện tách hẳn lag/lead để sau, khi có
-- dữ liệu thật của vài tuần dùng mà quyết.

set search_path = public;

alter table lead_measures
  add column if not exists unit_per_tick numeric not null default 1;

alter table lead_measures drop constraint if exists lead_measures_unit_per_tick_check;
alter table lead_measures add constraint lead_measures_unit_per_tick_check
  check (unit_per_tick > 0);

comment on column lead_measures.unit_per_tick is
  'Một lượt tick đáng bao nhiêu đơn vị của WIG cha. Mặc định 1 (mỗi lần tick = 1 đơn vị). Đặt 30 khi WIG đo bằng phút mà mỗi tối làm 30 phút. Xem 0076.';

-- ============================================================
-- private.wig_actual — nhân hệ số khi cộng
-- ============================================================
-- Giữ nguyên hai thứ đã có từ 0075: cộng đệ quy toàn cây WIG con, và mỗi WIG chỉ nhận tick nằm
-- trong khoảng ngày của CHÍNH NÓ. Chỉ thêm phép nhân hệ số.
--
-- Nhân ở đây chứ không ghi sẵn vào lead_progress.value lúc tick: sửa hệ số về sau thì mọi lượt
-- tick cũ tự tính lại theo, không phải đi vá dữ liệu lịch sử. Đổi lại là mất khả năng ghi giá trị
-- khác nhau cho từng lượt — nhưng giao diện tick vốn chỉ có bật/tắt, chưa bao giờ nhập số.
create or replace function private.wig_actual(w uuid) returns numeric
  language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id, start_date, end_date from wigs where id = w
    union all
    select c.id, c.start_date, c.end_date
    from wigs c join descendants d on c.parent_wig_id = d.id
  )
  select coalesce(sum(lp.value * lm.unit_per_tick), 0)
  from descendants d
  join lead_measures lm on lm.wig_id = d.id
  join lead_progress lp
    on lp.lead_measure_id = lm.id
   and lp.logged_date between d.start_date and d.end_date;
$$;
revoke all on function private.wig_actual(uuid) from public;
grant execute on function private.wig_actual(uuid) to authenticated, service_role;

-- ============================================================
-- class_lead_board — tổng của lớp cũng phải nhân hệ số
-- ============================================================
-- Giữ nguyên cửa sổ tuần đã siết ở 0074; chỉ đổi phép cộng. `my_dates` và `contributors` không
-- đụng tới: chúng đếm NGÀY và NGƯỜI, không phải đơn vị của WIG.
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
    l.id, l.title, l.target_value, l.unit, l.active_weekdays,
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
             '{}'::date[])
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.title;
$$;
revoke all on function class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function class_lead_board(uuid, date, uuid) to authenticated;

-- ============================================================
-- lead_measure_canh_bao — hai chỗ đặt sai mà app đang im lặng
-- ============================================================
-- Trả về cảnh báo cho từng lead measure, để giao diện nói thẳng thay vì bắt giáo viên tự đối
-- chiếu ngày tháng trong đầu. Đây là CẢNH BÁO, không phải rào chắn: dữ liệu cũ vẫn chạy, người
-- dùng vẫn lưu được — chỉ là từ nay họ nhìn thấy.
--
--   lech_don_vi : lead và WIG cha nói bằng hai đơn vị khác nhau mà hệ số vẫn là 1
--                 → đang cộng cái nọ vào cái kia.
--   qua_nhieu   : số lượt tick cần có > số ngày thật sự tick được trong kỳ
--                 → mục tiêu không thể đạt dù làm hết sức.
--
-- `so_ngay_tick_duoc` đếm đúng những ngày trong kỳ có thứ nằm trong active_weekdays — cùng luật
-- mà RLS dùng để chặn tick (lead_day_ok, 0073), nên con số này là trần thật, không phải ước lượng.
create or replace function lead_measure_canh_bao(p_wig uuid)
returns table(
  lead_measure_id uuid,
  so_tick_can numeric,
  so_ngay_tick_duoc int,
  lech_don_vi boolean,
  qua_nhieu boolean
)
language sql stable security invoker set search_path = public as $$
  select
    lm.id,
    ceil(lm.target_value / lm.unit_per_tick) as so_tick_can,
    (select count(*)::int
       from generate_series(w.start_date, w.end_date, interval '1 day') g
      where extract(isodow from g)::smallint = any(lm.active_weekdays)) as so_ngay_tick_duoc,
    (lm.unit is not null and w.unit is not null
      and lower(btrim(lm.unit)) <> lower(btrim(w.unit))
      and lm.unit_per_tick = 1) as lech_don_vi,
    ceil(lm.target_value / lm.unit_per_tick) >
      (select count(*)
         from generate_series(w.start_date, w.end_date, interval '1 day') g
        where extract(isodow from g)::smallint = any(lm.active_weekdays)) as qua_nhieu
  from lead_measures lm
  join wigs w on w.id = lm.wig_id
  where lm.wig_id = p_wig;
$$;
revoke all on function lead_measure_canh_bao(uuid) from public, anon;
grant execute on function lead_measure_canh_bao(uuid) to authenticated;
