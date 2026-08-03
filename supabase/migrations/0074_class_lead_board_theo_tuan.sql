-- class_lead_board: tổng của TUẦN, không phải tổng mọi thời kỳ.
--
-- VẤN ĐỀ. Bản 0073 lọc DANH SÁCH việc theo tuần (start_date/end_date giao với cửa sổ tuần) nhưng
-- hai con số kèm theo thì không:
--
--     sum(lp.value)                  from lead_progress where lead_measure_id = l.id
--     count(distinct lp.student_id)  from lead_progress where lead_measure_id = l.id
--
-- Không có `logged_date between monday and monday+6`. Cùng hàm ấy, cột my_dates ngay bên dưới thì
-- CÓ lọc — nên trong một dòng kết quả có hai thước đo khác nhau: ô vàng vẽ theo tuần, còn con số
-- tổng thì cộng tất cả.
--
-- VÌ SAO SỬA BÂY GIỜ. Cho tới hôm nay chuyện đó vô hại: mỗi lead measure thuộc đúng một WIG tuần,
-- và RLS chỉ cho học sinh tick trong tuần hiện tại, nên tick của một việc chỉ nằm gọn trong tuần
-- của nó. Kiểm trên production 2026-08-03: 0/22 WIG tuần có tick trải quá một tuần lịch.
--
-- Nhưng trang /wig vừa có nút ← → để xem tuần cũ, nên con số này bắt đầu được đọc ở ngữ cảnh
-- "tuần đã qua" — và GVCN thì tick/sửa được mọi ngày (lp_staff_manage không giới hạn ngày, xem
-- 0046). Chỉ cần một lượt sửa tay bắc qua hai tuần là bảng lặng lẽ cộng nhầm, đúng kiểu sai số
-- không ai nhìn ra vì nó vẫn là một con số hợp lý.
--
-- Vì hiện chưa có dòng nào trải tuần, thay đổi này KHÔNG làm đổi bất kỳ con số nào đang hiển thị
-- — nó chỉ đóng cửa trước khi có người đi qua.
--
-- Giữ nguyên chữ ký, kiểu trả về và phần kiểm quyền: chỗ gọi (ClassTickBoard, StudentScoreboard)
-- không phải sửa gì.

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
    -- CHỈ tick trong tuần đang hỏi — cùng cửa sổ với my_dates và với class_tick_matrix.
    coalesce((select sum(lp.value) from lead_progress lp
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
