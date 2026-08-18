-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0147 — PRD v3 ĐỢT E: METRICS — SỐ & TỶ LỆ HOÀN THÀNH LEAD, THẮNG/THUA CAM KẾT (mục 6.3)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Bốn chỉ số PRD đòi, ở cả cấp lớp lẫn từng em, theo tuần và luỹ kế:
--   lead measure  — số đã hoàn thành / tổng, và %
--   weekly commitment — số thắng / thua / tổng, và % thắng
--
-- "Hoàn thành" của một lead dùng ĐÚNG thước đo của máy gợi ý V/X (cam_ket_goi_y, 0121):
-- đạt chỉ tiêu tuần của chính nó — đơn vị 'do' lấy số mới nhất, còn lại cộng lượt × hệ số.
-- Không phát minh thước thứ hai: hai chỗ đo hai kiểu là bảng số và phòng họp cãi nhau.
--
-- View security_invoker: RLS của commitments/lead_measures/lead_progress quyết ai thấy dòng nào
-- — em thấy của mình + của lớp, GVCN thấy cả lớp, đúng như dữ liệu gốc.

create or replace view lead_tuan_v with (security_invoker = true) as
select lm.id as lead_id,
       c.id as commitment_id,
       c.class_id,
       c.student_id,                 -- null = việc của cam kết cấp lớp
       c.week_start,
       lm.target_value,
       coalesce((
         select case
           when kieu_don_vi(lm.unit) = 'do'
             then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
           else sum(lp.value) * lm.unit_per_tick
         end
         from lead_progress lp
         where lp.lead_measure_id = lm.id
           and lp.logged_date between c.week_start and c.week_start + 6
           and (c.student_id is null or lp.student_id = c.student_id)
       ), 0) as duoc
from lead_measures lm
join commitments c on c.id = lm.commitment_id;

create or replace view metrics_tuan_v with (security_invoker = true) as
with l as (
  select class_id, student_id, week_start,
         count(*) as tong_lead,
         count(*) filter (where duoc >= target_value) as lead_xong
  from lead_tuan_v
  group by 1, 2, 3
),
k as (
  select class_id, student_id, week_start,
         count(*) as tong_ck,
         count(*) filter (where verdict = 'win') as ck_thang,
         count(*) filter (where verdict = 'lose') as ck_thua
  from commitments
  group by 1, 2, 3
)
-- FULL JOIN bằng "is not distinct from": student_id null (dòng cấp lớp) phải KHỚP với null,
-- không thì mỗi tuần của lớp tách thành hai dòng — một mang lead, một mang cam kết.
select coalesce(l.class_id, k.class_id) as class_id,
       coalesce(l.student_id, k.student_id) as student_id,
       coalesce(l.week_start, k.week_start) as week_start,
       coalesce(l.tong_lead, 0) as tong_lead,
       coalesce(l.lead_xong, 0) as lead_xong,
       coalesce(k.tong_ck, 0) as tong_ck,
       coalesce(k.ck_thang, 0) as ck_thang,
       coalesce(k.ck_thua, 0) as ck_thua
from l
full join k on k.class_id = l.class_id
           and k.week_start = l.week_start
           and k.student_id is not distinct from l.student_id;

grant select on lead_tuan_v, metrics_tuan_v to authenticated;
