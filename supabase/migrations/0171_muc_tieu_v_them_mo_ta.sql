-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0171 — muc_tieu_v gồm cả cột mo_ta (0170)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- View muc_tieu_v (0166) dùng `select m.*`, nhưng Postgres CHỐT danh sách cột lúc tạo view — cột
-- `mo_ta` thêm ở 0170 (sau khi view đã tạo) KHÔNG tự lọt vào. Màn của em đọc mục tiêu qua view này,
-- nên chế độ SỬA sẽ không thấy mô tả cũ nếu view thiếu cột.
--
-- `create or replace view` không thêm được cột vào GIỮA (m.* nở ra chèn mo_ta trước các cột join)
-- nên phải drop rồi tạo lại. An toàn: đã kiểm pg_depend 02/09 — KHÔNG view nào phụ thuộc muc_tieu_v
-- (các hàm select từ nó tự phân giải lại lúc gọi). Định nghĩa chép NGUYÊN VĂN từ 0166, chỉ khác là
-- `m.*` nay tự gồm mo_ta. Giữ security_invoker=true và grant như cũ.

drop view if exists muc_tieu_v;
create view muc_tieu_v with (security_invoker = true) as
select m.*,
  dv.nhan_vi as ten_don_vi,
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.so end as so,
  h.nguon, h.ngay_nguon, h.so_nguon, h.x, h.y, h.le_ra,
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.pct end as pct,
  h.dat, h.trang_thai as trang_thai_do, h.ky_tu, h.ky_den, h.so_ky_giu, h.so_ky_xet, h.tu_so, h.mau_so
from muc_tieu m
left join don_vi dv on dv.id = m.don_vi_id
left join lateral private.so_hien_tai(m.id) h on true;
revoke all on muc_tieu_v from anon;
grant select on muc_tieu_v to authenticated;
