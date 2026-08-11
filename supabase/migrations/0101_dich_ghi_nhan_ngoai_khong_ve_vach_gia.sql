-- ════════════════════════════════════════════════════════════════════════════
-- 0101 — ĐÍCH GHI NHẬN NGOÀI THÌ ĐỪNG VẼ VẠCH GIẢ
-- ════════════════════════════════════════════════════════════════════════════
--
-- 0100 chia mục tiêu làm hai kiểu (docs/MO_HINH_WIG.md §5.0):
--   · measure_by = 'tick'   — đích đếm được ("1200 bài"), máy đếm từ lead_progress.
--   · measure_by = 'manual' — đích ghi nhận ngoài ("điểm TB 8,0"), cô và trò tự theo dõi.
--
-- Nhưng `wig_progress_v` — nơi MỌI màn hình lấy `pct` và `status` — vẫn tính như nhau cho cả hai.
-- Nghĩa là một mục tiêu "điểm trung bình 6,5 → 8,0" sẽ hiện một con số phần trăm suy ra từ số
-- lượt tick, tức là suy ra từ một thứ chẳng liên quan gì tới điểm. Đó không phải sai số, đó là
-- bịa: app KHÔNG có dữ liệu điểm môn (bảng điểm 0 dòng ngày 11/08/2026).
--
-- ── VÌ SAO SỬA Ở VIEW, KHÔNG ĐI VÁ SÁU MÀN HÌNH ─────────────────────────────────────────────
--
-- Sáu chỗ đang vẽ vạch tiến độ đều đọc từ view này. Vá từng chỗ là sáu cơ hội để sót một, và chỗ
-- sót ấy sẽ nói dối tiếp mà không ai biết — đúng cái bệnh "chẩn đúng một chỗ rồi quên chỗ còn
-- lại" mà dự án đã dính. Sửa ở nguồn thì không có chỗ nào để sót.
--
-- ── VÌ SAO KHÔNG TRẢ NULL ───────────────────────────────────────────────────────────────────
--
-- Cách "sạch" là để pct = null cho đích manual rồi bắt mọi màn tự xử. Nhưng mã hiện tại đầy
-- `Number(w.pct ?? 0)` và `pct * 100` — null lọt vào là ra `NaN%` trên màn hình học sinh. Đổi một
-- lời nói dối lấy một chữ NaN thì không phải là tiến bộ.
--
-- Nên: đích manual có đúng HAI trạng thái, và cả hai đều thật.
--     chưa tick "đã đạt" → 0
--     đã tick  "đã đạt" → 1
-- Vạch chạy từ trống sang đầy đúng lúc cô hoặc trò xác nhận đạt, không nhúc nhích lung tung ở
-- giữa. Màn hình cũ không phải sửa một dòng nào mà vẫn hết bịa.
--
-- Kèm theo, view mang luôn `measure_by` và `achieved_at` xuống để màn nào muốn hiện "Đã đạt /
-- Chưa đạt" thay cho thanh phần trăm thì có sẵn dữ liệu, không phải hỏi thêm một vòng.

create or replace view wig_progress_v as
select
  w.id as wig_id,
  w.class_id,
  w.student_id,
  w.scope,
  w.area,
  w.period,
  w.period_label,
  w.target_value,
  w.unit,
  w.start_date,
  w.end_date,
  x.a as actual,
  case
    when w.measure_by = 'manual' then (case when w.achieved_at is not null then 1 else 0 end)::numeric
    when w.target_value > 0 then least(1, round(x.a / w.target_value, 4))
    else 0
  end as pct,
  case
    when (w.end_date - w.start_date) > 0
      then least(1, greatest(0, round((vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric, 4)))
    else 1
  end as expected_pct,
  case
    -- Đích ghi nhận ngoài: chỉ có đạt hay chưa. KHÔNG chấm "chậm nhịp" — không ai đo được nhịp
    -- của một thứ mà app không giữ số liệu, và gắn nhãn đỏ cho một em vì thế là chấm oan.
    when w.measure_by = 'manual' then
      case when w.achieved_at is not null then 'on_track' else 'mid' end
    when case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end
         >= case
              when (w.end_date - w.start_date) > 0
                then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric))
              else 1
            end
      then 'on_track'
    when case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end
         >= (case
               when (w.end_date - w.start_date) > 0
                 then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date)::numeric))
               else 1
             end - 0.1)
      then 'mid'
    else 'off_track'
  end as status,
  -- HAI CỘT MỚI PHẢI ĐỨNG CUỐI. `create or replace view` không cho đổi tên hay thứ tự cột đã có —
  -- chèn vào giữa là Postgres từ chối thẳng ("cannot change name of view column"). Muốn chèn giữa
  -- thì phải DROP view, mà DROP là mất mọi GRANT và mọi thứ đang phụ thuộc vào nó.
  w.measure_by,
  w.achieved_at
from wigs w
cross join lateral (select private.wig_actual(w.id) as a) x;
