-- PHỤ HUYNH DÙNG EMAIL CỦA TRƯỜNG THÌ CÓ VÀO ĐƯỢC ĐÚNG VAI KHÔNG (migration 0096).
--
--   npm run sql -- scripts/test-phu-huynh-mail-truong.sql
--
-- Chủ dự án chọn phụ huynh thử ngay trong danh sách email của trường. Trước 0096 cách ấy hỏng
-- lặng lẽ: miền truongvietanh.com có vai mặc định 'pending' nên nhánh kiểm lời mời phụ huynh bị
-- bỏ qua sạch, người ta đăng nhập vào chỉ thấy "Tài khoản chưa được cấp quyền" trong khi lời mời
-- nằm sờ sờ trong bảng.
--
-- Bộ kiểm này KHÔNG đọc mã rồi suy. Nó tạo một tài khoản thật trong auth.users để trigger
-- handle_new_user chạy y như lúc người ta bấm đăng nhập Google, rồi soi vai và mối nối cha–con
-- đã sinh ra. Toàn bộ nằm trong transaction và ROLLBACK — không để lại tài khoản ma nào.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  v_hs uuid; v_ph uuid := gen_random_uuid(); v_hs_mien uuid := gen_random_uuid();
  v_vai text; v_so_con int;
begin
  -- Một học sinh đã có tài khoản để làm "con".
  select id into v_hs from profiles where role = 'student' limit 1;
  if v_hs is null then
    insert into kq values ('Tiền đề', 'có ít nhất 1 học sinh đã đăng nhập', 'KHÔNG CÓ — bỏ qua');
    return;
  end if;

  -- ── 1. EMAIL CỦA TRƯỜNG, ĐƯỢC MỜI LÀM PHỤ HUYNH ────────────────────────────────────────
  insert into parent_invitations (email, student_id, status)
  values ('kiem.ph@truongvietanh.com', v_hs, 'pending');

  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
  values (v_ph, 'kiem.ph@truongvietanh.com', '{"full_name":"Phụ Huynh Kiểm Thử"}'::jsonb,
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  select role::text into v_vai from profiles where id = v_ph;
  insert into kq values ('Email trường + lời mời phụ huynh → vai', 'parent', coalesce(v_vai, '(không tạo được hồ sơ)'));

  select count(*) into v_so_con from parent_links where parent_id = v_ph;
  insert into kq values ('… và được nối với đúng 1 người con', '1', v_so_con::text);

  select count(*) into v_so_con from parent_invitations
   where lower(email) = 'kiem.ph@truongvietanh.com' and status = 'accepted';
  insert into kq values ('… lời mời chuyển sang đã nhận', '1', v_so_con::text);

  -- ── 2. KHÔNG ĐƯỢC LÀM HỎNG ĐƯỜNG CŨ ────────────────────────────────────────────────────
  -- Miền học sinh có vai mặc định THẬT. Một em lỡ bị mời làm phụ huynh thì vẫn phải là học sinh.
  insert into parent_invitations (email, student_id, status)
  values ('kiem.em@student.truongvietanh.com', v_hs, 'pending');

  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
  values (v_hs_mien, 'kiem.em@student.truongvietanh.com', '{}'::jsonb,
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  select role::text into v_vai from profiles where id = v_hs_mien;
  insert into kq values ('Email miền học sinh dù có lời mời PH → vẫn là học sinh', 'student', coalesce(v_vai, '(không có)'));
end $$;

select buoc, ky_vong, thuc_te,
       case when ky_vong = thuc_te then 'ĐẠT' else 'SAI' end as ket_luan
  from kq;

rollback;
