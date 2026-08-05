-- 0088 — Cơ sở liên cấp, nhịp 2: bỏ hẳn `campuses.level`
--
-- Chỉ chạy SAU KHI bản code đọc `levels` đã lên production và xác nhận chạy (commit 1febdbf,
-- test-admin-man.mjs 20/20 trên class.vietanh.org). 0087 đã thêm `levels` và một trigger đồng bộ
-- hai chiều để bản code cũ sống qua lúc deploy; giờ không còn ai đọc `level` nữa nên gỡ cả hai.
--
-- VÌ SAO PHẢI GỠ chứ không để đó cho lành: hai cột cùng mô tả một sự thật là hai nguồn sự thật.
-- Chỉ cần một chỗ nào đó còn ghi `level` mà quên `levels` (hoặc ngược lại) là dữ liệu lệch nhau
-- âm thầm, và cái lệch ấy chỉ lộ ra khi có người dùng thật nhìn thấy nhãn sai. Dự án này đã dính
-- đúng kiểu ấy một lần rồi.

drop trigger if exists campus_sync_level on campuses;
drop function if exists trg_campus_sync_level();

-- Trigger sinh khối không còn cần theo dõi cột `level`.
drop trigger if exists campus_seed_grades on campuses;
create trigger campus_seed_grades
  after insert or update of levels on campuses
  for each row execute function trg_seed_grades();

-- Hàm RPC một-cấp của hiệu trưởng: đã thay bằng set_my_campus_levels(school_level[]) ở 0087.
drop function if exists set_my_campus_level(school_level);

alter table campuses drop column if exists level;

-- standard_grade_numbers(school_level) GIỮ LẠI: standard_grade_numbers_multi() gọi nó cho từng
-- cấp. Nó vẫn là nguồn sự thật của dải khối chuẩn mỗi cấp.
