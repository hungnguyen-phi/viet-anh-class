-- 0052 — Chốt: WIG bắt buộc có tên
--
-- 0051 để `title` nullable có chủ ý: lúc đó bản đang chạy trên production chưa biết cột này,
-- đặt NOT NULL ngay sẽ làm hỏng chức năng tạo WIG trong khoảng vài phút chờ deploy.
-- Bản mới (commit ea6c238) đã lên và mọi đường ghi WIG đều đặt title:
--   • createYearWig / createWig  — bắt buộc ở tầng validation
--   • student/actions.ts         — 3 chỗ, lấy DEFAULT_WIG_TITLE theo lĩnh vực
-- Giờ chốt được ràng buộc ở tầng DB, để không đường nào lách được nữa.

update wigs w
set title = coalesce(
  nullif(btrim(w.note), ''),
  (select ac.label_vi from area_config ac where ac.area = w.area),
  'Mục tiêu'
)
where w.title is null or btrim(w.title) = '';

alter table wigs alter column title set not null;
