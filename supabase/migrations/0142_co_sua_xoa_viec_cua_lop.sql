-- CÔ SỬA / XOÁ VIỆC DẪN DẮT CỦA LỚP — khi tuần chưa chốt.
--
-- Chủ dự án 16/08/2026: "ko thấy xóa sửa cam kết tuần/lead measure của gvcn nữa". 0129 khoá việc
-- dẫn dắt cho MỌI người trừ quản trị — đúng với việc của em (nay em tự sửa việc của mình, 0141),
-- nhưng việc CỦA LỚP là cô đặt, cô tick; cô gõ nhầm mà không sửa được, phải gọi quản trị, là vô lý.
-- Cam kết của lớp thì rls_cam_ket_gvcn đã cho cô toàn quyền từ 0121; đây chỉ mở nốt tầng việc.
set search_path = public;

drop policy if exists rls_sua_viec_cua_lop on lead_measures;
create policy rls_sua_viec_cua_lop on lead_measures for update
  using (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id is null
        and staff_can_manage_class(c.class_id)
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  )
  with check (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id is null
        and staff_can_manage_class(c.class_id)
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  );

drop policy if exists rls_xoa_viec_cua_lop on lead_measures;
create policy rls_xoa_viec_cua_lop on lead_measures for delete
  using (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id is null
        and staff_can_manage_class(c.class_id)
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  );
