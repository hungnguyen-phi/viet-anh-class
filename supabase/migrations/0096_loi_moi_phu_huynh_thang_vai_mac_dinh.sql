-- LỜI MỜI PHỤ HUYNH PHẢI THẮNG VAI MẶC ĐỊNH "CHỜ CẤP QUYỀN" CỦA MIỀN EMAIL.
--
-- Chủ dự án chọn 2 phụ huynh thử ngay trong danh sách email của trường. Với bản trước thì cách ấy
-- KHÔNG chạy, và hỏng theo kiểu không ai đoán ra:
--
--   handle_new_user tra MIỀN trước. Miền truongvietanh.com có vai mặc định 'pending'. Vì
--   `v_role` đã khác null nên cả nhánh kiểm parent_invitations bị bỏ qua sạch — người được mời
--   làm phụ huynh đăng nhập vào chỉ thấy màn "Tài khoản chưa được cấp quyền", trong khi lời mời
--   nằm sờ sờ trong bảng.
--
-- 'pending' không phải một VAI, nó là chỗ đứng tạm cho người chưa ai gán gì. Một lời mời cụ thể
-- thì luôn nói nhiều hơn một mặc định "chưa biết là ai" — nên từ nay lời mời thắng. Đúng cách
-- pending_user_grants vẫn làm từ trước; parent_invitations bị bỏ quên khỏi luật ấy.
--
-- KHÔNG đụng tới các miền có vai mặc định THẬT (student.truongvietanh.com → 'student'): ở đó
-- mặc định là một khẳng định, không phải chỗ đứng tạm. Một em học sinh có email trong miền học
-- sinh mà lỡ bị mời làm phụ huynh thì vẫn là học sinh — và đó mới là điều đúng.
--
-- Chép lại nguyên thân hàm vì `create or replace` cần cả định nghĩa; chỉ đúng một mệnh đề đổi.
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

  -- ĐÂY là mệnh đề đã đổi: trước đây chỉ `if v_role is null then`.
  -- Nay 'pending' cũng được coi là "chưa biết là ai", nên lời mời phụ huynh có tiếng nói.
  if v_role is null or v_role = 'pending' then
    if exists (select 1 from parent_invitations where lower(email) = v_email and status in ('pending','accepted')) then
      v_role := 'parent';
    elsif v_role is null then
      v_role := 'pending';
    end if;
  end if;

  -- Lời mời có chỉ định vai thì vẫn thắng tất cả, như cũ.
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
      update classes set homeroom_teacher_id = new.id
      where id = v_grant.class_id and homeroom_teacher_id is null;
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
  'Gán vai + lớp/con khi ai đó đăng nhập lần đầu. Thứ tự tiếng nói: lời mời có chỉ định vai '
  '(pending_user_grants) > lời mời phụ huynh (parent_invitations, từ 0096 thắng cả vai mặc định '
  '''pending'' của miền) > vai mặc định của miền email.';
