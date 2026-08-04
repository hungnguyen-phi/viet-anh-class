-- Báo cáo phụ huynh: bộ chọn tuần nói bằng NGÀY, không bằng mã "W31-2026".
--
-- VÌ SAO. Nhãn tuần ISO đã bị gỡ khỏi thanh nav từ đợt trước, đúng vì lý do người thử nói thẳng:
-- "Có chữ W31-2026 không biết là gì? Mình nghĩ là tuần 31 của năm 2026 nhưng không biết dùng để
-- làm gì". Đoán đúng mà vẫn không dùng được. Vậy mà ở trang Báo cáo — trang của PHỤ HUYNH, người
-- xa thuật ngữ nhà trường nhất — cái mã ấy vẫn là toàn bộ nội dung của bộ chọn tuần: một dãy nút
-- "W31-2026 W30-2026 W29-2026…" dài thêm mỗi tuần.
--
-- child_weeks() chỉ trả về NHÃN, nên giao diện không có gì khác để hiện. Nay trả thêm hai đầu mốc
-- ngày — thứ ai cũng đọc được — còn nhãn giữ lại làm khoá tra cứu cho child_week_report().
--
-- Đổi kiểu trả về nên phải drop trước; create or replace không đổi được returns table.

set search_path = public;

drop function if exists child_weeks(uuid);

create function child_weeks(s uuid)
returns table(week_label text, week_start date, week_end date)
language sql stable security definer set search_path = public as $$
  select
    w.period_label,
    min(w.start_date) as week_start,
    max(w.end_date)   as week_end
  from wigs w
  where w.student_id = s and w.scope = 'student' and w.period = 'week'
    and w.period_label is not null
    and can_view_student(s)
  group by w.period_label
  order by min(w.start_date) desc;
$$;

revoke all on function child_weeks(uuid) from public, anon;
grant execute on function child_weeks(uuid) to authenticated;

comment on function child_weeks(uuid) is
  'Các tuần có WIG cá nhân của một em, mới nhất trước. Trả kèm NGÀY để giao diện hiện "28/07 – 03/08" thay cho mã W31-2026 (0083).';
