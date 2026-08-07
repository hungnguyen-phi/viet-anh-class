-- BAN GIÁM HIỆU DỰNG ĐƯỢC DANH SÁCH HỌC SINH TRONG CƠ SỞ MÌNH.
--
-- Chủ dự án: "admin tạo cơ sở, nhưng bgh thì phải là tạo tkb, tạo khối, lớp.. học sinh chứ".
--
-- Đúng, và ba phần tư việc ấy BGH ĐÃ làm được từ trước: khối (0049), lớp (0049), thời khoá biểu
-- (0057), môn học. Chỉ còn HỌC SINH là kẹt, mà kẹt ở ba chỗ rời nhau nên nhìn từ ngoài không ra:
--
--   · enroll_student_by_email  — chỉ nhận GVCN của lớp hoặc admin
--   · unenroll_student         — cũng vậy
--   · can_manage_student_email — cửa vào student_details (họ tên, mã HS, ngày sinh, SĐT phụ
--                                huynh, ghi chú), cũng chỉ mở cho GVCN và admin
--
-- Buồn cười là invite_student_to_class thì ĐÃ mở cho BGH. Nên trước bản này, BGH mời được một em
-- CHƯA có tài khoản, nhưng em đã có tài khoản thì không ghi danh được; và mời xong cũng không
-- điền nổi họ tên cho em ấy. Nửa vời kiểu đó tệ hơn cấm hẳn: người dùng làm được bước một rồi
-- đâm vào tường ở bước hai, không ai đoán được vì sao.
--
-- PHẠM VI: đúng cơ sở của mình (auth_campus()), không phải cả trường. Giống hệt trần đã đặt cho
-- BGH ở 0049 và 0057 — thêm một vai vào cùng một cái khuôn, không mở khuôn rộng ra.
--
-- CÓ MỞ CẢ NGÀY SINH VÀ SĐT PHỤ HUYNH, và đây là quyết định có chủ đích của chủ dự án chứ không
-- phải hệ quả kỹ thuật. 0058 từng cố ý đóng cửa này với BGH theo nguyên tắc tối thiểu hoá của
-- docs/DATA_GOVERNANCE.md. Nay BGH là người nhập danh sách đầu năm, mà nhập danh sách thì phải
-- nhập được ngày sinh — đóng cửa ấy nghĩa là bắt họ nhập một nửa rồi nhờ giáo viên nhập nốt.
set search_path = public;

-- ── 1. CỬA VÀO THÔNG TIN NHẬN DIỆN HỌC SINH ───────────────────────────────────────────────
-- Giữ nguyên hai nhánh cũ (admin, GVCN của lớp em đó), thêm hai nhánh cho BGH: em đang học
-- trong cơ sở mình, và em mới chỉ được mời vào một lớp của cơ sở mình.
create or replace function can_manage_student_email(p_email text) returns boolean
  language sql stable security definer set search_path = public as $$
  select
    auth_role() = 'admin'
    -- em đã có tài khoản và đang học lớp mình chủ nhiệm
    or exists (
      select 1
      from profiles p
      join enrollments e on e.student_id = p.id and e.is_active
      join classes c on c.id = e.class_id
      where lower(p.email) = lower(p_email) and c.homeroom_teacher_id = auth.uid()
    )
    -- em chỉ mới được mời vào lớp mình chủ nhiệm (chưa đăng nhập lần nào)
    or exists (
      select 1
      from pending_user_grants g
      join classes c on c.id = g.class_id
      where lower(g.email) = lower(p_email) and c.homeroom_teacher_id = auth.uid()
    )
    -- BGH: em đang học một lớp trong cơ sở mình
    or (
      auth_role() = 'principal'
      and exists (
        select 1
        from profiles p
        join enrollments e on e.student_id = p.id and e.is_active
        join classes c on c.id = e.class_id
        where lower(p.email) = lower(p_email) and c.campus_id = auth_campus()
      )
    )
    -- BGH: em mới được mời vào một lớp trong cơ sở mình
    or (
      auth_role() = 'principal'
      and exists (
        select 1
        from pending_user_grants g
        join classes c on c.id = g.class_id
        where lower(g.email) = lower(p_email) and c.campus_id = auth_campus()
      )
    );
$$;

comment on function can_manage_student_email(text) is
  'Ai được xem/sửa thông tin nhận diện của một học sinh: quản trị viên · GVCN của lớp em đó · '
  'ban giám hiệu của cơ sở chứa lớp em đó (mở từ 0094).';

-- ── 2. GHI DANH EM ĐÃ CÓ TÀI KHOẢN ────────────────────────────────────────────────────────
-- Chép lại nguyên thân hàm, chỉ nới đúng mệnh đề quyền. `create or replace` cần cả định nghĩa.
create or replace function enroll_student_by_email(p_class uuid, p_email text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền ghi danh cho lớp này';
  end if;
  select id into v_student from profiles
    where lower(email) = lower(p_email) and role = 'student';
  if v_student is null then
    return 'not_found';
  end if;
  -- Một em chỉ học một lớp: vào lớp mới thì tắt lớp cũ.
  update enrollments set is_active = false
    where student_id = v_student and is_active and class_id <> p_class;
  insert into enrollments (class_id, student_id, is_active)
    values (p_class, v_student, true)
    on conflict (class_id, student_id) do update set is_active = true;
  return 'ok';
end $$;

-- ── 3. CHO EM RỜI LỚP ─────────────────────────────────────────────────────────────────────
-- Mở cho BGH cùng lúc với ghi danh. Chỉ mở một chiều là dựng được danh sách mà không sửa nổi
-- khi gõ nhầm — lại đúng cái nửa vời mà bản này sinh ra để dẹp.
create or replace function unenroll_student(p_class uuid, p_student uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền';
  end if;
  -- Rời lớp là TẮT CỜ, không xoá dữ liệu: điểm danh, WIG, biên bản họp của em vẫn còn nguyên.
  update enrollments set is_active = false, is_attendance_leader = false
    where class_id = p_class and student_id = p_student;
end $$;
