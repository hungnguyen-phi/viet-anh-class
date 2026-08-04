-- Bảng tổng hợp của ban giám hiệu: phân biệt "chưa đặt mục tiêu" với "đặt rồi mà chưa chạy".
--
-- VÌ SAO. Cột "Điểm thi đua" trên /campus hiện số 0 cho CẢ HAI trường hợp:
--   · lớp chưa đặt mục tiêu năm nào  → chưa vào cuộc, việc cần làm là NGỒI XUỐNG ĐẶT MỤC TIÊU
--   · lớp đặt rồi nhưng chưa tiến    → đã vào cuộc, việc cần làm là XEM VÌ SAO CHƯA CHẠY
-- Hai chuyện khác hẳn nhau, hai lời nhắc khác hẳn nhau, một con số. Hiệu trưởng nhìn bảng không
-- có cách nào tách ra, nên hoặc nhắc oan, hoặc bỏ sót.
--
-- Bảng WIG ngay bên dưới trên cùng trang ấy ĐÃ phân biệt được (nó hiện dấu "—" cho lớp chưa đặt).
-- Đây đúng kiểu bệnh đã chẩn đúng ở một chỗ rồi quên áp cho chỗ còn lại.
--
-- Thêm `wig_count` = số mục tiêu NĂM đang có của lớp trong năm học này. 0 nghĩa là chưa vào cuộc.
-- Đổi kiểu trả về nên phải drop trước.

set search_path = public;

drop function if exists campus_rollup();

create function campus_rollup()
returns table(
  class_id uuid, class_name text, school_year text,
  grade_id uuid, grade_name text, grade_sort int,
  score numeric, att_today bigint, student_count bigint,
  wig_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  -- Thân hàm chép TỪ BẢN ĐANG CHẠY (pg_proc.prosrc), không phải từ migration 0049: hai bản đã
  -- lệch nhau ở mệnh đề WHERE (bản thật lọc thêm `c.school_year = current_school_year()` và siết
  -- vai principal). Chép nhầm nguồn là lặng lẽ đổi phạm vi bảng của cả ban giám hiệu.
  with scores as (select * from class_competition_scores()),
  att as (select class_id, count(*) as n from attendance_records where date = vn_today() group by class_id),
  enr as (select class_id, count(*) as n from enrollments where is_active group by class_id),
  wig as (
    -- Chỉ đếm mục tiêu NĂM: đó là mắt xích đầu của chuỗi năm → tháng → tuần, không có nó thì
    -- không có gì bên dưới cả.
    select w.class_id, count(*) as n
    from wigs w
    where w.scope = 'class' and w.period = 'year'
    group by w.class_id
  )
  select c.id, c.name, c.school_year, c.grade_id,
         coalesce(g.name, c.grade, '—'), coalesce(g.sort_order, 9999),
         coalesce(s.score, 0), coalesce(att.n, 0), coalesce(enr.n, 0),
         coalesce(wig.n, 0)
  from classes c
  left join grades g on g.id = c.grade_id
  left join scores s on s.class_id = c.id
  left join att    on att.class_id = c.id
  left join enr    on enr.class_id = c.id
  left join wig    on wig.class_id = c.id
  where c.school_year = current_school_year() and c.is_active
    and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  order by coalesce(g.sort_order, 9999), c.name;
$$;

revoke all on function campus_rollup() from public, anon;
grant execute on function campus_rollup() to authenticated;

comment on function campus_rollup() is
  'Bảng tổng hợp lớp cho ban giám hiệu. wig_count = số mục tiêu NĂM của lớp; 0 = lớp chưa vào cuộc, khác hẳn với "đã đặt mà điểm 0" (0084).';
