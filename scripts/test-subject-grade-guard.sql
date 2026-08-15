-- Kiểm migration 0070: không gắn được môn sai khối, và gieo bộ môn thì gieo đúng khối.
-- Chạy trong transaction rồi ROLLBACK.
begin;

create temp table kq (nhom text, buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  qtv  uuid; gvcn uuid; co_so uuid;
  lop7 uuid;
  m_ly uuid; m_toan uuid; m_tin uuid;
  n int;
begin
  -- LỚP KHỐI 7 THẬT bất kỳ. Trước đây bám cứng tên '7B1' — lớp ấy đã không còn (dọn cùng đợt đổi
  -- mô hình WIG), và không cơ sở nào hiện có SẴN một lớp khối 7. Dựng TẠM một lớp bên trong chính
  -- giao dịch này (kết thúc bằng ROLLBACK ở cuối file) là cách duy nhất giữ đúng ý bài kiểm gốc —
  -- "khối 7 học đúng 9 môn" — mà không phụ thuộc dữ liệu production tình cờ có sẵn lớp ấy hay không.
  select id into qtv from profiles where role = 'admin' limit 1;
  select c.homeroom_teacher_id, c.campus_id into gvcn, co_so
  from classes c where c.is_active and c.homeroom_teacher_id is not null limit 1;
  if qtv is null or gvcn is null then
    insert into kq values ('DỰNG', 'Có admin và GVCN để thử', 'có', 'KHÔNG CÓ');
    return;
  end if;

  insert into classes (campus_id, name, school_year, grade_id, homeroom_teacher_id, is_active)
  select co_so, 'KIỂM · khối 7 tạm', current_school_year(),
         (select id from grades where campus_id = co_so and sort_order = 7), gvcn, true
  returning id into lop7;

  select id into m_ly   from subjects where code = 'LY'   and campus_id is null; -- lớp 10-12
  select id into m_toan from subjects where code = 'TOAN' and campus_id is null; -- lớp 6-12
  select id into m_tin  from subjects where code = 'TIN'  and campus_id is null; -- chưa khai lớp

  -- ── GẮN MÔN VÀO LỚP ──
  -- Vật lí (lớp 10-12) vào lớp khối 7 → phải bị chặn
  perform set_config('request.jwt.claims',
    json_build_object('sub', gvcn, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    insert into class_subjects (class_id, subject_id) values (lop7, m_ly);
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Vật lí (lớp 10-12) vào lớp khối 7','chặn','GẮN ĐƯỢC — SAI');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Vật lí (lớp 10-12) vào lớp khối 7','chặn','chặn');
  end;

  -- Toán (lớp 6-12) vào lớp khối 7 → phải được
  perform set_config('role','authenticated', true);
  begin
    insert into class_subjects (class_id, subject_id) values (lop7, m_toan)
    on conflict do nothing;
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Toán (lớp 6-12) vào lớp khối 7','được','được');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Toán (lớp 6-12) vào lớp khối 7','được','BỊ CHẶN');
  end;

  -- Tin học (CHƯA KHAI LỚP) vào lớp khối 7 → phải được, đây là lối thoát có chủ đích
  perform set_config('role','authenticated', true);
  begin
    insert into class_subjects (class_id, subject_id) values (lop7, m_tin)
    on conflict do nothing;
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Tin học (chưa khai lớp)','được','được');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','GVCN gắn Tin học (chưa khai lớp)','được','BỊ CHẶN');
  end;

  -- Quản trị viên VƯỢT được (ngoại lệ có chủ đích, xem comment migration)
  perform set_config('request.jwt.claims',
    json_build_object('sub', qtv, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    insert into class_subjects (class_id, subject_id) values (lop7, m_ly);
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','Quản trị viên vượt được (ngoại lệ có chủ đích)','được','được');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GẮN MÔN','Quản trị viên vượt được (ngoại lệ có chủ đích)','được','BỊ CHẶN');
  end;
  delete from class_subjects where class_id = lop7 and subject_id = m_ly;

  -- ── GIEO BỘ MÔN CHO LỚP ──
  delete from class_subjects where class_id = lop7;

  perform set_config('request.jwt.claims',
    json_build_object('sub', gvcn, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select seed_class_subjects(lop7) into n;
  perform set_config('role','postgres', true);

  -- Khối 7 học: Toán, Văn, Anh, KHTN, GDCD, Công nghệ = 6 môn có khai lớp
  --            + Oxford English, Lịch sử và Địa lí, Tin học = 3 môn chưa khai lớp
  --            = 9 môn. KHÔNG có Vật lí, Hoá, Sinh, Địa lí, GDKT-PL (5 môn cấp ba).
  insert into kq values ('GIEO','Gieo bộ môn cho lớp khối 7 ra đúng 9 môn', '9 môn', n || ' môn');

  select count(*) into n from class_subjects cs
   join subjects s on s.id = cs.subject_id
   where cs.class_id = lop7 and s.code in ('LY','HOA','SINH','GDKTPL');
  insert into kq values ('GIEO','Không lọt môn cấp ba nào vào lớp khối 7','0 môn', n || ' môn');

  select count(*) into n from class_subjects cs
   join subjects s on s.id = cs.subject_id
   where cs.class_id = lop7 and s.code in ('TIN','LSDL','OXENG');
  insert into kq values ('GIEO','Ba môn chưa khai lớp VẪN được gieo','3 môn', n || ' môn');

  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims','',true);
end $$;

select nhom, buoc, ky_vong, thuc_te,
       case when ky_vong = thuc_te then 'OK' else 'SAI' end as ket_luan
from kq;

select count(*) filter (where ky_vong <> thuc_te) as so_sai, count(*) as tong from kq;

rollback;
