-- 0056 — GVCN mời được học sinh CHƯA CÓ TÀI KHOẢN vào lớp.
--
-- VẤN ĐỀ (người thử vai quản trị báo): ghi danh học sinh chỉ chạy khi email đó ĐÃ tồn tại sẵn
-- trong profiles với role='student'. Gõ email khác thì báo "Không tìm thấy học sinh… yêu cầu em
-- đăng nhập tạo tài khoản học sinh trước" rồi hết đường. Luồng bị ngược: giáo viên phải chờ
-- từng em tự đăng nhập xong mới lập được danh sách lớp.
--
-- Hạ tầng để làm đúng ĐÃ CÓ SẴN từ 0008: bảng pending_user_grants giữ (email, role, class_id),
-- và trigger handle_new_user tự ghi danh em vào đúng lớp ngay lần đăng nhập đầu. Cái thiếu chỉ
-- là QUYỀN: RLS của bảng đó mở cho admin và hiệu trưởng, không có giáo viên — nên GVCN, đúng
-- người đang lập danh sách lớp, lại là người duy nhất không dùng được.
--
-- Cách chữa: một hàm SECURITY DEFINER hẹp, tự kiểm quyền theo ĐÚNG LỚP, thay vì nới RLS của cả
-- bảng cho vai teacher. Nới RLS sẽ cho giáo viên đụng tới mọi lời mời của mọi lớp — kể cả lời
-- mời vai admin/hiệu trưởng — rủi ro lớn hơn nhiều so với cái lợi.
create or replace function invite_student_to_class(p_class uuid, p_email text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_campus uuid;
begin
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return 'bad_email';
  end if;

  -- Chỉ được mời vào lớp mà mình có quyền: GVCN của chính lớp đó, hiệu trưởng cùng cơ sở,
  -- hoặc quản trị viên. Kiểm ngay trong hàm vì SECURITY DEFINER đã bỏ qua RLS.
  select c.campus_id into v_campus
  from classes c
  where c.id = p_class
    and (
      c.homeroom_teacher_id = auth.uid()
      or auth_role() = 'admin'
      or (auth_role() = 'principal' and c.campus_id = auth_campus())
    );
  if v_campus is null then
    return 'forbidden';
  end if;

  -- Đã có tài khoản rồi thì không phải mời — để phía gọi ghi danh thẳng.
  if exists (select 1 from profiles where lower(email) = v_email and role = 'student') then
    return 'exists';
  end if;

  -- Email đang chờ ở một vai KHÁC (vd đã mời làm giáo viên) → không âm thầm đổi vai người ta.
  if exists (select 1 from pending_user_grants g where lower(g.email) = v_email and g.role <> 'student') then
    return 'other_role';
  end if;

  insert into pending_user_grants (email, role, class_id, campus_id, invited_by)
  values (v_email, 'student', p_class, v_campus, auth.uid())
  on conflict (email) do update
    set role = 'student', class_id = excluded.class_id, campus_id = excluded.campus_id;

  return 'invited';
end $$;

revoke all on function invite_student_to_class(uuid, text) from public, anon;
grant execute on function invite_student_to_class(uuid, text) to authenticated;
