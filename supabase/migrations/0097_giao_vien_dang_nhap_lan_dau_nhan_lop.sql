-- GIÁO VIÊN ĐƯỢC MỜI KHÔNG ĐĂNG NHẬP ĐƯỢC LẦN ĐẦU — "Database error saving new user".
--
-- Cô Kim Phượng bấm đăng nhập Google, bị đá về trang login kèm
--   error_code=unexpected_failure & error_description=Database+error+saving+new+user
--
-- Dựng lại đúng cảnh ấy trên production (tạo tài khoản thật trong transaction rồi rollback) thì
-- lộ nguyên văn:  P0001 · "Chỉ admin được đổi GVCN hoặc cơ sở của lớp".
--
-- HAI CHỐT CHẶN CỦA CHÍNH MÌNH ĐẤM NHAU:
--
--   · handle_new_user, khi thấy lời mời vai giáo viên có kèm lớp, tự gán:
--         update classes set homeroom_teacher_id = new.id where id = ... and homeroom_teacher_id is null;
--   · trg_protect_class_cols (0018) chặn mọi thay đổi cột homeroom_teacher_id trừ khi
--     auth_role() = 'admin'. Chốt ấy sinh ra để giáo viên không tự phong mình chủ nhiệm lớp khác.
--
-- Lúc đăng nhập lần đầu thì KHÔNG CÓ phiên nào cả: auth.uid() rỗng, auth_role() rỗng, coalesce
-- thành 'pending'. Chốt chặn nhìn thấy "không phải admin" và ném lỗi — mà nó ném ngay giữa
-- transaction tạo tài khoản, nên Supabase cuộn ngược tất cả và trả về đúng câu vô nghĩa kia.
--
-- Không ai gặp trước đây vì hai lớp cũ được quản trị viên phân tay, không đi qua đường này. Đợt
-- vận hành thật là lần đầu có giáo viên tự nhận lớp lúc đăng nhập — nên lần đầu lỗi lộ ra.
--
-- CÁCH SỬA: không gỡ chốt, không nới cho 'pending' đi qua (nới thế là ai chưa có vai cũng đổi
-- được GVCN). Mở đúng MỘT khe hẹp: handle_new_user bật một cờ chỉ sống trong transaction của
-- chính nó, chốt chặn thấy cờ ấy thì cho qua. Ngoài transaction đó cờ không tồn tại, và người
-- dùng qua API không có đường nào bật được nó.
set search_path = public;

-- ── 1. CHỐT CHẶN: THÊM ĐÚNG MỘT LỐI ĐI CÓ TÊN ─────────────────────────────────────────────
create or replace function protect_class_privileged_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.homeroom_teacher_id is distinct from old.homeroom_teacher_id
      or new.campus_id is distinct from old.campus_id)
     and coalesce(auth_role(), 'pending') <> 'admin'
     -- Lối đi duy nhất: chính handle_new_user đang gán lớp cho giáo viên vừa đăng nhập lần đầu.
     -- Cờ đặt bằng set_config(..., true) nên chỉ sống trong transaction ấy, không rò ra ngoài.
     and coalesce(current_setting('app.gan_lop_khi_dang_ky', true), '') <> '1' then
    raise exception 'Chỉ admin được đổi GVCN hoặc cơ sở của lớp';
  end if;
  return new;
end;
$$;

-- ── 2. HÀM TẠO NGƯỜI DÙNG: BẬT CỜ ĐÚNG LÚC GÁN LỚP, TẮT NGAY SAU ──────────────────────────
-- Chép lại nguyên thân hàm vì `create or replace` cần cả định nghĩa; chỉ thêm hai dòng bật/tắt cờ.
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
      -- Chỉ nhận lớp khi CHƯA AI chủ nhiệm — giáo viên không cướp lớp của nhau.
      perform set_config('app.gan_lop_khi_dang_ky', '1', true);
      update classes set homeroom_teacher_id = new.id
      where id = v_grant.class_id and homeroom_teacher_id is null;
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

comment on function protect_class_privileged_cols() is
  'Chặn đổi GVCN / cơ sở của lớp: chỉ quản trị viên. Ngoại lệ duy nhất là lúc handle_new_user gán '
  'lớp cho giáo viên vừa đăng nhập lần đầu — nhận diện bằng cờ app.gan_lop_khi_dang_ky, chỉ sống '
  'trong transaction ấy (0097).';
