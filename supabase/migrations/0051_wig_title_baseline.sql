-- 0051 — WIG có TÊN và MỐC XUẤT PHÁT
--
-- VẤN ĐỀ: bảng `wigs` chỉ có area + target_value + unit + kỳ. Không có chỗ nào nói mục tiêu đó
-- LÀ GÌ. Trên màn hình một WIG tuần hiện ra là "Tuần · Tuần 31 — 0/5 lần" — người đọc không thể
-- biết 5 lần đó là 5 lần gì. Đây là gốc của "chưa đủ, chưa trực quan".
--
-- 4DX phát biểu mục tiêu theo công thức "Từ X lên Y trước [thời hạn]". App đang có Y
-- (target_value) và thời hạn (start_date/end_date) nhưng thiếu cả TÊN lẫn X.
--
-- title    — câu phát biểu mục tiêu, vd "Tăng số bài tập về nhà nộp đúng hạn"
-- baseline — mốc X lúc bắt đầu, để hiện "Từ 18 → 25 bài" thay vì chỉ "25 bài"
alter table wigs add column title text;
alter table wigs add column baseline numeric;

comment on column wigs.title is
  'Câu phát biểu mục tiêu 4DX. Bắt buộc ở tầng ứng dụng; DB để nullable cho 27 dòng cũ.';
comment on column wigs.baseline is
  'Mốc xuất phát (X trong "Từ X lên Y"). NULL = chưa ghi nhận, giao diện chỉ hiện mục tiêu.';

-- Điền tên cho các WIG đã có: ưu tiên `note` nếu giáo viên đã ghi gì đó (3/27 dòng),
-- còn lại lấy nhãn lĩnh vực để không dòng nào hiện ra trống trơn.
update wigs w
set title = coalesce(
  nullif(btrim(w.note), ''),
  (select ac.label_vi from area_config ac where ac.area = w.area),
  'Mục tiêu'
)
where w.title is null;

-- CỐ Ý CHƯA đặt NOT NULL. Bản app đang chạy trên production chưa biết cột này; đặt NOT NULL
-- ngay bây giờ sẽ làm hỏng chức năng tạo WIG trong khoảng thời gian giữa lúc áp migration và
-- lúc deploy code mới. Sau khi bản mới lên, thêm một migration ngắn:
--     alter table wigs alter column title set not null;
