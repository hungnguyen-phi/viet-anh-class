-- 0060 — Bịt lỗ: phụ huynh vẫn đọc được lớp CŨ sau khi con đã rời lớp.
--
-- LỖI: is_parent_of_class() không lọc enrollments.is_active.
--
--   select exists(
--     select 1 from enrollments e join parent_links pl on pl.student_id = e.student_id
--     where e.class_id = c and pl.parent_id = auth.uid()   -- <— thiếu "and e.is_active"
--   );
--
-- Đối chiếu hàm anh em ngay bên cạnh trong 0003 — is_class_student() CÓ lọc `and is_active`.
-- Nên đây là chỗ sót, không phải chủ ý.
--
-- HẬU QUẢ: con chuyển lớp hoặc thôi học thì unenroll_student chỉ đặt is_active = false (cố ý —
-- không xoá dữ liệu). Từ giây đó:
--   - HỌC SINH mất quyền đọc lớp cũ NGAY (is_class_student lọc đúng),
--   - nhưng BỐ MẸ EM VẪN ĐỌC ĐƯỢC lớp cũ VĨNH VIỄN.
-- Cụ thể đang rò qua ba policy: classes, timetable_slots, timetable_overrides — tức là phụ
-- huynh của một em đã rời trường vẫn xem được thời khoá biểu lớp cũ mãi mãi.
--
-- VÌ SAO SỬA NGAY BÂY GIỜ: đợt này thêm báo bài và ALBUM ẢNH LỚP, cả hai đều dựa trên
-- is_parent_of_class. Nếu để nguyên, cùng một lỗ sẽ chuyển từ "rò thời khoá biểu" thành "rò ảnh
-- khuôn mặt của những đứa trẻ mà người xem không còn liên quan gì". Phải bịt trước khi đắp
-- tính năng lên trên.
--
-- PHẠM VI: chỉ sửa MỘT hàm, không đụng policy nào. Ba policy đang gọi nó tự siết theo.
-- Đây là siết chặt quyền, không nới — không ai mất quyền mà đáng lẽ phải có.

create or replace function is_parent_of_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments e
    join parent_links pl on pl.student_id = e.student_id
    where e.class_id = c
      and e.is_active            -- <— chỗ sót đã bịt
      and pl.parent_id = auth.uid()
  );
$$;
