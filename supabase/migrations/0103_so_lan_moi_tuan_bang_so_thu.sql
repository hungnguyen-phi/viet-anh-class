-- ════════════════════════════════════════════════════════════════════════════
-- 0103 — SỐ LẦN MỖI TUẦN = SỐ THỨ ĐÃ CHỌN (chữa dữ liệu đang lệch)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án bắt lỗi 12/08/2026: "đặt 5 ngày vẫn là 3, sau đó tick 1 ngày lên 1/3, vậy 5 ngày thì
-- sao, cái mấy lần trên tuần rất vô lí".
--
-- Đúng, và nó vô lí ở tầng số học chứ không phải ở tầng chữ nghĩa. uq_lead_progress_daily (0020)
-- chỉ cho MỘT lượt tick mỗi (việc, em, ngày), nên số lần tối đa trong một tuần đúng bằng số thứ
-- được bật. Form cũ hỏi hai chỗ rời nhau — "mấy lần/tuần" và "những thứ con làm" — nên sinh ra hai
-- kiểu bản ghi không bao giờ đọc được:
--   · chọn 5 thứ, đích 3  → tick đủ cả tuần vẫn hiện 5/3, và vạch tiến độ vượt 100%
--   · chọn 3 thứ, đích 7  → em không bỏ buổi nào mà vạch không bao giờ đầy
--
-- Form đã bỏ hẳn ô ấy (số lần nay suy ra từ số thứ). File này chữa những dòng ĐÃ ghi theo luật cũ.
--
-- CHỈ ĐỘNG VÀO VIỆC CỦA EM. Việc của lớp có unit_per_tick khác 1 ("mỗi em 3 bài" — một lượt tick
-- ăn 3 đơn vị), ở đó target_value là tổng đơn vị chứ không phải số lần, nên đồng bộ theo số thứ sẽ
-- là phá chứ không phải chữa.

update lead_measures lm
set target_value = array_length(lm.active_weekdays, 1)
from wigs w
where w.id = lm.wig_id
  and w.scope = 'student'
  and coalesce(lm.unit_per_tick, 1) = 1
  and lm.active_weekdays is not null
  and array_length(lm.active_weekdays, 1) > 0
  and lm.target_value is distinct from array_length(lm.active_weekdays, 1);
