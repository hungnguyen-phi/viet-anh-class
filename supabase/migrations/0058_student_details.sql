-- 0058 — Thông tin nhận diện học sinh, điền được ngay lúc ghi danh.
--
-- VẤN ĐỀ (ban giám hiệu, mục 12): "chỉ có tên học sinh và mail... có thể ghi thêm các thông tin
-- khác ngoài mail HS". Đúng: ô ghi danh chỉ có MỘT trường là email, nên
--   (a) không phân biệt được hai em trùng tên,
--   (b) tệ hơn: học sinh đã mời mà chưa đăng nhập lần đầu thì KHÔNG hiện dòng nào trong Danh
--       sách lớp — mời 30 em vẫn thấy danh sách trống, giáo viên không biết đã mời ai.
--
-- KHOÁ THEO EMAIL, KHÔNG THEO student_id: đây là điểm thiết kế quan trọng. Lúc giáo viên điền
-- thông tin thì em học sinh THƯỜNG CHƯA CÓ tài khoản (chưa đăng nhập lần đầu) nên chưa có
-- profiles.id để trỏ tới. Email là thứ duy nhất tồn tại ở CẢ HAI trạng thái, và cũng chính là
-- khoá mà luồng mời (pending_user_grants) đang dùng. Khi em đăng nhập, trigger bên dưới tự nối
-- student_id vào để các truy vấn sau này đi theo id cho chắc.
create table if not exists student_details (
  email          text primary key,
  student_id     uuid references profiles(id) on delete set null,
  full_name      text,
  student_code   text,
  date_of_birth  date,
  parent_phone   text,
  note           text,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_student_details_student on student_details (student_id);
create index if not exists idx_student_details_code on student_details (student_code);

alter table student_details enable row level security;

-- Ai được xem/sửa: CHỈ giáo viên chủ nhiệm của lớp mà em đó đang học hoặc đang được mời vào,
-- và quản trị viên.
--
-- Vì sao hẹp như vậy: bảng này chứa ngày sinh và số điện thoại phụ huynh — dữ liệu liên lạc của
-- người thật. docs/DATA_GOVERNANCE.md đặt nguyên tắc "tối thiểu hoá", nên không mở cho hiệu
-- trưởng, không mở cho học sinh, không mở cho phụ huynh. Ai cần thì mở thêm sau, có chủ đích.
--
-- SECURITY DEFINER: phải tự kiểm quyền bên trong vì hàm bỏ qua RLS của các bảng nó đọc.
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
    );
$$;

revoke all on function can_manage_student_email(text) from public, anon;
grant execute on function can_manage_student_email(text) to authenticated;

create policy rls_manage_student_details on student_details
  for all
  using (can_manage_student_email(email))
  with check (can_manage_student_email(email));

-- Khi học sinh đăng nhập lần đầu, nối student_id + lấy họ tên đã điền sẵn làm tên hiển thị.
-- Lý do lấy tên: tên do giáo viên điền là tên THẬT trong danh sách lớp, đáng tin hơn tên
-- Google tự khai (nhiều em đặt nickname).
create or replace function link_student_details() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update student_details
     set student_id = new.id, updated_at = now()
   where lower(email) = lower(new.email) and student_id is null;

  update profiles p
     set full_name = d.full_name
    from student_details d
   where p.id = new.id
     and lower(d.email) = lower(new.email)
     and d.full_name is not null and d.full_name <> ''
     and (p.full_name is null or p.full_name = '');
  return new;
end $$;

drop trigger if exists on_profile_created_link_details on profiles;
create trigger on_profile_created_link_details
  after insert on profiles
  for each row execute function link_student_details();
