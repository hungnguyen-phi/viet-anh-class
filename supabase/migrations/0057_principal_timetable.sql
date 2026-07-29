-- 0057 — Hiệu trưởng (ban giám hiệu) được sửa THỜI KHOÁ BIỂU của các lớp trong cơ sở mình.
--
-- Người thử vai ban giám hiệu (vòng 2) nêu đúng vấn đề nghiệp vụ: "vì sao ban giám hiệu không
-- điều chỉnh TKB được, vì BGH là người lập TKB các lớp mà". Thực tế trường học đúng như vậy —
-- thời khoá biểu do ban giám hiệu xếp, giáo viên chỉ đổi ngoại lệ (thi, thực hành, dạy thay).
--
-- Hiện trạng: cả hai bảng đều dùng staff_can_manage_class(), mà hàm đó chỉ gồm GVCN + admin.
--
-- VÌ SAO KHÔNG SỬA THẲNG staff_can_manage_class: hàm đó còn chi phối `wigs` và `lead_progress`.
-- Thêm hiệu trưởng vào đó là vô tình cho họ sửa mục tiêu và tiến độ của mọi lớp trong cơ sở —
-- vượt xa cái đang cần, và đụng thẳng vào dữ liệu học tập của học sinh. Nên thêm policy RIÊNG
-- cho hai bảng thời khoá biểu, giới hạn đúng cơ sở của hiệu trưởng đó.

create policy rls_principal_manage_timetable_slots on timetable_slots
  for all
  using (
    (select auth_role()) = 'principal'
    and exists (select 1 from classes c where c.id = timetable_slots.class_id
                and c.campus_id = (select auth_campus()))
  )
  with check (
    (select auth_role()) = 'principal'
    and exists (select 1 from classes c where c.id = timetable_slots.class_id
                and c.campus_id = (select auth_campus()))
  );

create policy rls_principal_manage_timetable_overrides on timetable_overrides
  for all
  using (
    (select auth_role()) = 'principal'
    and exists (
      select 1 from timetable_slots s
      join classes c on c.id = s.class_id
      where s.id = timetable_overrides.slot_id and c.campus_id = (select auth_campus())
    )
  )
  with check (
    (select auth_role()) = 'principal'
    and exists (
      select 1 from timetable_slots s
      join classes c on c.id = s.class_id
      where s.id = timetable_overrides.slot_id and c.campus_id = (select auth_campus())
    )
  );
