-- CHUYỂN LỚP: chỉ quản trị / GVCN lớp nhận / hiệu trưởng cơ sở mới thực thi được (0160)
--
--   npm run sql -- scripts/test-chuyen-lop-quyen.sql
--
-- Tự rollback. CHẠY TRƯỚC KHI 0160 LÊN thì phải THẤY BÁO SAI: bản đang chạy (0151) không kiểm
-- quyền, nên một tài khoản đăng nhập thường (đóng vai một học sinh) gọi apply_class_transfer vẫn
-- chuyển được lớp — phép kiểm sẽ đỏ ở bước ①. Sau khi 0160 lên, cả bốn bước xanh.
--
-- Vì sao kiểm ở tầng RPC chứ không qua giao diện: lỗ nằm ở chỗ gọi THẲNG hàm, đường mà giao diện
-- không đi qua. Mọi phép đóng vai bằng set_config('request.jwt.claims', ...) như các test khác.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

-- Dàn cảnh: một em thật ở lớp Test, và một lớp đích KHÁC đang hoạt động cùng cơ sở.
create table canh as
select
  (select e.student_id
     from enrollments e join classes c on c.id = e.class_id
    where c.name = 'Test' and c.is_active and e.is_active
    order by e.student_id limit 1) as em,
  (select c.id from classes c where c.name = 'Test' and c.is_active limit 1) as lop_test,
  (select c2.id from classes c2
     join classes ct on ct.name = 'Test' and ct.is_active
    where c2.is_active and c2.campus_id = ct.campus_id and c2.name <> 'Test'
    order by c2.created_at limit 1) as lop_dich,
  (select c.homeroom_teacher_id from classes c where c.name = 'Test' and c.is_active limit 1) as gvcn_test;
grant all on kq, canh to authenticated;

do $$
begin
  if (select em from canh) is null then raise exception 'Lớp Test chưa có em nào đang học'; end if;
  if (select lop_dich from canh) is null then
    raise exception 'Cần một lớp đang hoạt động khác Test cùng cơ sở để thử chuyển';
  end if;
end $$;

-- ① NGƯỜI KHÔNG PHẬN SỰ (đóng vai chính em bị chuyển — vai "authenticated" thường): PHẢI bị chặn.
--    Trước 0160 bước này ĐỎ (hàm cũ cho chạy). Sau 0160 xanh (42501).
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select em from canh), 'role', 'authenticated')::text, true);
do $$
begin
  perform apply_class_transfer((select em from canh), (select lop_dich from canh));
  insert into kq values ('Học sinh tự gọi RPC chuyển lớp', 'bị chặn', 'CHẠY ĐƯỢC — lỗ mở', false);
exception
  when insufficient_privilege then
    insert into kq values ('Học sinh tự gọi RPC chuyển lớp', 'bị chặn', 'bị chặn (42501)', true);
  when others then
    -- Nếu vai authenticated không có execute (sau khi 0160 thu hồi) → cũng là "bị chặn", đúng ý.
    insert into kq values ('Học sinh tự gọi RPC chuyển lớp', 'bị chặn',
      'bị chặn (' || sqlstate || ')', sqlstate in ('42501', '42883'));
end $$;
reset role;

-- ② QUẢN TRỊ: PHẢI qua được lớp kiểm quyền (không nhận 42501). Ta chỉ cần khẳng định KHÔNG bị
--    chặn bởi quyền — để hàm chạy thật rồi rollback là an toàn (cả transaction bị huỷ ở cuối).
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select em from canh), 'role', 'authenticated', 'user_role', 'admin')::text, true);
-- Lưu ý: auth_role() đọc từ profiles, không từ claim — nên đóng vai admin THẬT bằng một hồ sơ admin.
reset role;

do $$
declare v_admin uuid;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  if v_admin is null then
    insert into kq values ('Quản trị chuyển lớp', 'qua được', 'BỎ QUA — không có hồ sơ admin', true);
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  -- Chạy dưới quyền định-nghĩa-viên của hàm (SECURITY DEFINER) — role phiên không cần execute.
  perform apply_class_transfer((select em from canh), (select lop_dich from canh));
  insert into kq values ('Quản trị chuyển lớp', 'qua được', 'qua được', true);
exception
  when insufficient_privilege then
    insert into kq values ('Quản trị chuyển lớp', 'qua được', 'bị chặn oan (42501)', false);
end $$;

-- ③ GVCN LỚP NHẬN: cũng phải qua được (đây là đường decide hợp lệ).
do $$
declare v_gvcn_dich uuid;
begin
  select c.homeroom_teacher_id into v_gvcn_dich from classes c where c.id = (select lop_dich from canh);
  if v_gvcn_dich is null then
    insert into kq values ('GVCN lớp nhận chuyển lớp', 'qua được', 'BỎ QUA — lớp đích chưa có GVCN', true);
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_gvcn_dich, 'role', 'authenticated')::text, true);
  perform apply_class_transfer((select em from canh), (select lop_dich from canh));
  insert into kq values ('GVCN lớp nhận chuyển lớp', 'qua được', 'qua được', true);
exception
  when insufficient_privilege then
    insert into kq values ('GVCN lớp nhận chuyển lớp', 'qua được', 'bị chặn oan (42501)', false);
end $$;

-- ④ GVCN LỚP KHÁC (không phải lớp nhận): PHẢI bị chặn — không ai được đẩy em vào lớp mình không quản.
do $$
declare v_gvcn_khac uuid;
begin
  select c.homeroom_teacher_id into v_gvcn_khac
    from classes c
   where c.homeroom_teacher_id is not null
     and c.id <> (select lop_dich from canh)
     and c.id <> (select lop_test from canh)
   limit 1;
  if v_gvcn_khac is null then
    insert into kq values ('GVCN lớp khác chuyển lớp', 'bị chặn', 'BỎ QUA — không đủ GVCN để thử', true);
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_gvcn_khac, 'role', 'authenticated')::text, true);
  perform apply_class_transfer((select em from canh), (select lop_dich from canh));
  insert into kq values ('GVCN lớp khác chuyển lớp', 'bị chặn', 'CHẠY ĐƯỢC — lỗ mở', false);
exception
  when insufficient_privilege then
    insert into kq values ('GVCN lớp khác chuyển lớp', 'bị chặn', 'bị chặn (42501)', true);
end $$;

select buoc, mong_doi, thuc_te, case when dat then 'ĐẠT' else '*** SAI ***' end as ket from kq;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong from kq;

rollback;
