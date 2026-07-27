-- 0045 — Thêm 2 loại yêu cầu-sửa: xin TICK BÙ và xin ĐỔI TÊN lead measure.
--
-- Bối cảnh: 0039 đã cho học sinh tự tick/bỏ tick TRONG NGÀY, nên 'undo_tick' giờ chỉ còn cần cho
-- tick của ngày ĐÃ QUA. Nhưng còn hai nhu cầu thật chưa có đường nào:
--   * add_tick    — hôm qua có làm mà quên tick, xin GVCN ghi bù (không tự làm được: RLS
--                   lp_student_insert khoá logged_date = vn_today()).
--   * rename_lead — tên việc do GVCN đặt chung; em muốn đổi cho khớp việc thật của mình
--                   (vd "Buổi học / tutor" → "Buổi tutor Toán"). Không tự sửa được: lead_measures
--                   chỉ có lm_manage = staff_can_manage_class.
--
-- Vẫn giữ nguyên nguyên tắc: GVCN là người DUYỆT (0034 + 0040). Đây chỉ là mở thêm loại yêu cầu,
-- không mở thêm quyền cho học sinh.
--
-- ref_id: với add_tick/rename_lead thì trỏ tới lead_measures(id) — giống undo_tick.
-- Nội dung cụ thể (ngày cần tick bù, tên mới) đi trong `message` vì bảng không có cột riêng và
-- thêm cột cho mỗi loại sẽ phình vô ích; GVCN đọc rồi áp bằng tay ở trang WIG.
set search_path = public;

alter table edit_requests drop constraint if exists edit_requests_kind_check;
alter table edit_requests add constraint edit_requests_kind_check
  check (kind in ('undo_tick', 'add_tick', 'change_target', 'rename_lead', 'other'));

comment on column edit_requests.kind is
  'undo_tick = gỡ tick ngày đã qua | add_tick = xin tick bù | change_target = đổi mục tiêu | rename_lead = đổi tên việc | other';
