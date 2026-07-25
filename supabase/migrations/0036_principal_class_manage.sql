-- 0036 — BGH (principal) quản lý Lớp trong CƠ SỞ MÌNH.
-- Khối đã có grade_principal_manage (0030). Lớp: 0004 chỉ có class_principal_update (sửa/lưu-trữ).
-- Bổ sung insert/delete giới hạn campus của principal → tạo/xoá lớp trong phạm vi. Campus vẫn admin.
drop policy if exists class_principal_insert on classes;
create policy class_principal_insert on classes for insert
  with check (auth_role() = 'principal' and campus_id = auth_campus());

drop policy if exists class_principal_delete on classes;
create policy class_principal_delete on classes for delete
  using (auth_role() = 'principal' and campus_id = auth_campus());
