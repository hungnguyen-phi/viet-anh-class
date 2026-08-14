-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0114 — GỘP LẤY SỐ CUỐI, VÀ TRẢ VỀ SỐ CỦA TỪNG NGÀY
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0113 dựng ba hàm nền nhưng chưa ai gọi. Bản này mắc chúng vào hai chỗ cộng số thật.
--
-- ── MỘT CÂU HỎI PHẢI TRẢ LỜI TRƯỚC: LỚP "ĐANG Ở" BAO NHIÊU KG? ──────────────────────────────
--
-- Với "làm bài tập" thì số của lớp là TỔNG — 30 em góp mỗi em vài bài, cộng lại có nghĩa. Với
-- cân nặng thì tổng cân nặng cả lớp là một con số không ai cần. Mỗi em có cân nặng riêng, và
-- câu hỏi thật của lớp là "bao nhiêu em đã tới đích" — thứ class_lead_board vẫn luôn đếm.
--
-- Nên với đơn vị đo lại, số của LỚP ở đây là TRUNG BÌNH số mới nhất của các em. Giao diện phải
-- gọi đúng tên nó là trung bình; nếu bày trần trụi "36,2 / 50 kg" thì người đọc tưởng đó là một
-- con số cộng dồn đang tiến tới 50.
--
-- Còn số của TỪNG EM thì đơn giản: số mới nhất em ghi trong kỳ ấy.

-- ── 1. wig_actual — nguồn của mọi vòng tròn phần trăm ───────────────────────────────────────
-- Đã đọc bản đang chạy trên production trước khi viết lại (luật của dự án). Phần thay đổi:
--   · CTE `viec` mang thêm `lm.unit` để biết kiểu đơn vị;
--   · gộp trong một tuần: 'do' lấy dòng mới nhất, còn lại thì cộng;
--   · gộp NGANG các tuần: 'do' KHÔNG cộng — 36kg tuần này với 36,5kg tuần sau không phải 72,5.
--     Lấy trung bình của các em, mà mỗi em lấy số mới nhất của em.
create or replace function private.wig_actual(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
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
           lm.id as lead_id, lm.target_value, lm.unit_per_tick, lm.unit
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  -- Một dòng cho mỗi (việc, em, tuần).
  theo_tuan as (
    select v.lead_id, v.class_id, v.scope, v.target_value, v.unit,
           lp.student_id,
           vn_week_start(lp.logged_date) as tuan,
           case
             when kieu_don_vi(v.unit) = 'do'
               -- SỐ MỚI NHẤT trong tuần ấy, không nhân hệ số: đơn vị đo lại luôn có
               -- unit_per_tick = 1 (server ép khi bật ô điền số), và nhân vào thì sai thang.
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
             else sum(lp.value) * v.unit_per_tick
           end as gia
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit, v.unit_per_tick,
             lp.student_id, vn_week_start(lp.logged_date)
  ),
  -- Đơn vị ĐO LẠI: một dòng cho mỗi (việc, em) — số mới nhất của em trong cả kỳ.
  do_theo_em as (
    select distinct on (t.lead_id, t.student_id) t.lead_id, t.student_id, t.gia
    from theo_tuan t
    where kieu_don_vi(t.unit) = 'do'
    order by t.lead_id, t.student_id, t.tuan desc
  ),
  -- Đơn vị CỘNG DỒN: giữ nguyên luật cũ, kể cả trần "mỗi em một bộ đếm" của WIG lớp (0098).
  cong_don as (
    select coalesce(sum(
      case
        when t.scope = 'class' and t.target_value > 0 then least(t.gia, t.target_value)
        else t.gia
      end
    ), 0) as tong
    from theo_tuan t
    where kieu_don_vi(t.unit) <> 'do'
  )
  select case
    when exists (select 1 from do_theo_em)
      -- Mục tiêu của EM: đúng một dòng, chính là số của em. Mục tiêu của LỚP: trung bình các em.
      then (select round(avg(gia), 2) from do_theo_em)
    else (select tong from cong_don)
  end;
$$;

-- ── 2. class_lead_board — bảng việc chung của lớp ──────────────────────────────────────────
-- Ba thay đổi:
--   · `my_total` và `class_total` gộp theo kiểu đơn vị (đo lại thì lấy số cuối / trung bình);
--   · `students_done` hỏi toi_dich() thay vì `>=`, để đích đi xuống (giảm cân) không bị tính ngược;
--   · TRẢ THÊM `my_values` — số của từng ngày em đã ghi. Trước đây chỉ trả `my_dates`, nên ô điền
--     số không có gì để hiện lại: em gõ 35,4 hôm qua, hôm nay mở ra thấy ô trống.
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
  my_values jsonb
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
           lm.nhap_luong, lm.wig_id, w.title as wig_title, w.area::text as area,
           w.baseline as wig_baseline, kieu_don_vi(lm.unit) as kieu
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  ),
  -- Số của TỪNG EM cho mỗi việc, trong tuần đang xem.
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
    -- Số của LỚP: cộng dồn thì cộng, đo lại thì trung bình (xem đầu tệp).
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
    -- ĐÃ TỚI ĐÍCH CHƯA, theo hướng của đích — không phải ">=" cứng.
    coalesce((select count(*) from theo_em t
              where t.lead_id = l.id and toi_dich(t.gia, l.target_value, l.wig_baseline)), 0),
    coalesce(l.nhap_luong, false),
    -- Số của từng ngày, để ô điền số hiện lại đúng thứ em đã gõ. {"2026-08-12": 35.4, …}
    coalesce((select jsonb_object_agg(lp.logged_date::text, lp.value) from lead_progress lp
              where lp.lead_measure_id = l.id
                and lp.student_id = (select sid from me)
                and lp.logged_date between (select monday from wk) and (select monday from wk) + 6),
             '{}'::jsonb)
  from lms l
  where is_class_student(p_class) or staff_can_read_class(p_class) or is_parent_of_class(p_class)
  order by l.title;
$$;
revoke all on function public.class_lead_board(uuid, date, uuid) from public, anon;
grant execute on function public.class_lead_board(uuid, date, uuid) to authenticated, service_role;
