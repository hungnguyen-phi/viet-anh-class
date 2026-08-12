-- ════════════════════════════════════════════════════════════════════════════
-- 0105 — GÁN LỚP LÚC ĐĂNG NHẬP LẦN ĐẦU: ĐỀ ĐÃ CHỌN THÌ PHẢI ĐI, KHÔNG ĐƯỢC LẶNG THINH
-- ════════════════════════════════════════════════════════════════════════════
--
-- BUG THẬT (chủ dự án báo 12/08/2026): admin đang kiêm GVCN của một lớp (homeroom_teacher_id =
-- chính admin), mời một giáo viên mới và chọn đúng lớp đó trong form mời. Giáo viên mới đăng nhập
-- lần đầu → "không có lớp".
--
-- NGUYÊN NHÂN — 0097 viết:
--     update classes set homeroom_teacher_id = new.id
--     where id = v_grant.class_id and homeroom_teacher_id is null;
--
-- Điều kiện `homeroom_teacher_id is null` chỉ đúng khi lớp CHƯA từng có ai — sai với đúng ca này:
-- lớp ĐANG có admin đứng tên. Câu UPDATE không khớp WHERE, không đổi gì, nhưng dòng
-- `pending_user_grants` vẫn bị xoá (0097 dòng "delete from pending_user_grants" chạy vô điều
-- kiện) — người mời tưởng đã gán xong, giáo viên mới thì mất trắng lớp, không còn dấu vết gì để
-- biết chuyện gì đã xảy ra.
--
-- Ý đồ ban đầu của "is null" là chống HAI giáo viên cùng nhận một lớp nếu cả hai đăng nhập gần
-- nhau — nhưng route DUY NHẤT tạo ra `pending_user_grants` với vai giáo viên là `inviteUser`,
-- CHỈ admin gọi được (requireRole(['admin'])). Admin chọn lớp trong form mời chính là MỘT QUYẾT
-- ĐỊNH TƯỜNG MINH "lớp này giao cho người này" — không phải một phỏng đoán cần phòng ngừa. Đúng
-- luồng "GVCN sửa tay" (assignGvcn, actions.ts:323) đã ghi đè vô điều kiện từ trước tới giờ; luồng
-- mời-rồi-tự-nhận-lúc-đăng-nhập phải xử sự giống hệt, không phải một luật ngầm khác.
--
-- SỬA: bỏ điều kiện `is null`. Chép lại nguyên thân hàm handle_new_user (0097), chỉ đổi đúng một
-- câu UPDATE.
set search_path = public;

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_role user_role;
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_grant pending_user_grants%rowtype;
  v_has_grant boolean := false;
begin
  select default_role into v_role from signup_email_domains where domain = v_domain;

  -- Lời mời phụ huynh thắng vai mặc định 'pending' của miền (0096).
  if v_role is null or v_role = 'pending' then
    if exists (select 1 from parent_invitations where lower(email) = v_email and status in ('pending','accepted')) then
      v_role := 'parent';
    elsif v_role is null then
      v_role := 'pending';
    end if;
  end if;

  -- Lời mời có chỉ định vai thì thắng tất cả.
  select * into v_grant from pending_user_grants where lower(email) = v_email;
  v_has_grant := v_grant.email is not null;
  if v_has_grant then v_role := v_grant.role; end if;

  insert into profiles (id, email, full_name, role, campus_id)
  values (new.id, new.email, v_full_name, v_role,
          case when v_has_grant then v_grant.campus_id else null end)
  on conflict (id) do nothing;

  if v_has_grant then
    if v_grant.role = 'teacher' and v_grant.class_id is not null then
      -- Admin đã chọn đúng lớp này trong form mời (inviteUser, chỉ admin gọi được) — ghi đè
      -- thẳng, không hỏi "đã có ai chưa". Cùng luật với assignGvcn (sửa tay) — hai đường ghi
      -- cùng một cột thì phải cùng một luật, không phải một cái ghi đè, một cái e dè (0105).
      perform set_config('app.gan_lop_khi_dang_ky', '1', true);
      update classes set homeroom_teacher_id = new.id where id = v_grant.class_id;
      perform set_config('app.gan_lop_khi_dang_ky', '', true);
    elsif v_grant.role = 'student' and v_grant.class_id is not null then
      insert into enrollments (class_id, student_id) values (v_grant.class_id, new.id)
      on conflict (class_id, student_id) do nothing;
    elsif v_grant.role = 'parent' and v_grant.student_id is not null then
      insert into parent_links (parent_id, student_id, relationship)
      values (new.id, v_grant.student_id, 'guardian')
      on conflict (parent_id, student_id) do nothing;
    end if;
    delete from pending_user_grants where lower(email) = v_email;
  end if;

  if v_role = 'parent' then
    insert into parent_links (parent_id, student_id, relationship)
    select new.id, pi.student_id, 'guardian'
    from parent_invitations pi
    where lower(pi.email) = v_email and pi.status in ('pending','accepted')
    on conflict (parent_id, student_id) do nothing;
    update parent_invitations set status = 'accepted'
    where lower(email) = v_email and status = 'pending';
  end if;

  return new;
end $$;

comment on function handle_new_user() is
  'Trigger đăng ký lần đầu: gán vai + lớp theo pending_user_grants. Giáo viên có lớp trong lời mời '
  'được GHI ĐÈ homeroom_teacher_id vô điều kiện — admin đã chọn tường minh lúc mời (0105), không '
  'còn phòng ngừa "lớp đã có ai chưa" như 0097.';
