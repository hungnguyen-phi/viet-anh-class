-- Kiểm 0060: phụ huynh mất quyền đọc lớp ngay khi con rời lớp.
-- Chạy trong transaction rồi ROLLBACK.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  ph1   uuid := '5fbca2bf-9797-4c53-a42e-62199332bb55'; -- test1.ph, con = test1.hs (lớp 7B1)
  hs1   uuid := 'f10395c6-9975-4292-a7d8-778a7c72c478';
  lop   uuid;
  n int;
begin
  select id into lop from classes where name = '7B1';

  -- TRƯỚC: con đang học → phụ huynh đọc được lớp + TKB
  perform set_config('request.jwt.claims',
    json_build_object('sub', ph1, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select count(*) into n from classes where id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐANG học · phụ huynh đọc lớp', '1 dòng', n || ' dòng');

  perform set_config('role','authenticated', true);
  select count(*) into n from timetable_slots where class_id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐANG học · phụ huynh đọc TKB', '>0 dòng', (case when n>0 then '>0' else '0' end) || ' dòng');

  -- Con rời lớp (đúng như unenroll_student làm: chỉ tắt cờ, không xoá)
  update enrollments set is_active = false where student_id = hs1 and class_id = lop;

  -- SAU: phải mất sạch quyền
  perform set_config('role','authenticated', true);
  select count(*) into n from classes where id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐÃ RỜI · phụ huynh đọc lớp', '0 dòng', n || ' dòng');

  perform set_config('role','authenticated', true);
  select count(*) into n from timetable_slots where class_id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐÃ RỜI · phụ huynh đọc TKB', '0 dòng', n || ' dòng');

  perform set_config('role','authenticated', true);
  select count(*) into n from timetable_overrides o
    join timetable_slots s on s.id = o.slot_id where s.class_id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐÃ RỜI · phụ huynh đọc ngoại lệ TKB', '0 dòng', n || ' dòng');

  -- Hàm trực tiếp
  perform set_config('role','authenticated', true);
  select case when is_parent_of_class(lop) then 1 else 0 end into n;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐÃ RỜI · is_parent_of_class()', '0 dòng', n || ' dòng');

  -- Học sinh khác trong lớp KHÔNG bị ảnh hưởng: phụ huynh 2 vẫn đọc được
  perform set_config('request.jwt.claims',
    json_build_object('sub','c03a5c74-a983-4cdf-99a0-b8d578eb95eb','role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select count(*) into n from classes where id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Phụ huynh KHÁC (con còn học) vẫn đọc được', '1 dòng', n || ' dòng');

  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims','',true);
end $$;

select buoc, ky_vong, thuc_te,
       case when ky_vong = thuc_te then 'OK' else 'SAI' end as ket_luan
from kq;

rollback;
