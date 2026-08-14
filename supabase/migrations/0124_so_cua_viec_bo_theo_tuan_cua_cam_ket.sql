-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0124 — SỐ CỦA MỘT VIỆC CHỈ TÍNH TRONG TUẦN CỦA CAM KẾT NÓ THUỘC VỀ
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Bắt được bằng phép kiểm "mỗi em một bộ đếm" sau khi đổi mô hình: một lượt tick ghi vào NGÀY
-- NGOÀI tuần của cam kết vẫn cộng vào mục tiêu năm.
--
-- Ở mô hình cũ chuyện đó không xảy ra được: việc treo dưới WIG TUẦN, mà wig_actual lọc lượt tick
-- theo đúng khoảng ngày của WIG ấy — bảy ngày. Nay việc treo dưới CAM KẾT còn `wig_id` trỏ thẳng
-- lên mục tiêu NĂM, nên khoảng lọc bỗng rộng ra thành cả năm học.
--
-- Một việc dẫn dắt là lời hứa của MỘT TUẦN ("nộp bài Toán trước 21h, tuần này"). Lượt tick rơi
-- ngoài tuần ấy không thuộc về nó — và cái trần "mỗi em một bộ đếm" (0098) cũng chỉ có nghĩa
-- trong phạm vi một tuần. Nên bó lại theo tuần của cam kết.
create or replace function private.wig_actual_so(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  with viec as (
    select c.class_id, c.student_id, c.week_start,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick, lm.unit,
           w2.scope
    from wigs w2
    join commitments c on c.wig_id = w2.id
    join lead_measures lm on lm.commitment_id = c.id
    where w2.id = w
  ),
  theo_tuan as (
    select v.lead_id, v.scope, v.target_value, v.unit, lp.student_id,
           case
             when kieu_don_vi(v.unit) = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
             else sum(lp.value) * v.unit_per_tick
           end as gia
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     -- ĐÚNG BẢY NGÀY CỦA CAM KẾT. Đây là chỗ 0121 làm rộng ra mà không ai để ý.
     and lp.logged_date between v.week_start and v.week_start + 6
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.scope, v.target_value, v.unit, v.unit_per_tick, lp.student_id
  ),
  do_theo_em as (
    select distinct on (t.lead_id, t.student_id) t.lead_id, t.student_id, t.gia
    from theo_tuan t
    where kieu_don_vi(t.unit) = 'do'
    order by t.lead_id, t.student_id, t.gia desc
  ),
  cong_don as (
    select coalesce(sum(
      -- TRẦN MỖI EM MỘT BỘ ĐẾM (0098): một em làm gấp đôi phần mình không kéo cả lớp về đích hộ.
      case when t.scope = 'class' and t.target_value > 0 then least(t.gia, t.target_value)
           else t.gia end
    ), 0) as tong
    from theo_tuan t
    where kieu_don_vi(t.unit) <> 'do'
  )
  select case
    when exists (select 1 from do_theo_em) then (select round(avg(gia), 2) from do_theo_em)
    else (select tong from cong_don)
  end;
$$;
