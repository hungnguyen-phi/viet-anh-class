-- PHỤ HUYNH MẤT QUYỀN ĐỌC LỚP NGAY KHI CON RỜI LỚP (0060)
--
--   npm run sql -- scripts/test-rls-parent-active.sql
--
-- ── VÌ SAO BỘ NÀY TỰ DỰNG LẤY CẢNH ────────────────────────────────────────────────────────
--
-- Bản cũ neo cứng hai UUID phụ huynh và lớp '7B1'. Khi những hàng ấy không còn, bộ kiểm KHÔNG
-- đỏ đúng chỗ: mấy phép ĐO CHẶN ("con đã rời thì đọc được 0 dòng") vẫn xanh — nhưng xanh vì
-- người phụ huynh ấy không tồn tại, chứ không phải vì RLS chặn. Một bộ kiểm xanh nhờ dữ liệu
-- rỗng là bộ kiểm nói dối, và nó nói dối đúng vào luật giữ kín dữ liệu trẻ con.
--
-- Nên ở đây mọi nhân vật đều được tạo trong chính transaction rồi ROLLBACK: hai phụ huynh, hai
-- người con khác nhà, và một tiết trong thời khoá biểu. Cả trường hiện KHÔNG lớp nào có tiết TKB
-- nào — bám dữ liệu thật thì phép đo TKB vĩnh viễn vô nghĩa.
--
-- Phép đo phụ huynh thứ hai mới là phép đắt nhất: gỡ quyền của một nhà không được gỡ nhầm của
-- nhà bên cạnh. Muốn hỏi được câu đó thì phải có đủ HAI nhà thật trong lớp.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  lop  uuid; hs1 uuid; hs2 uuid; mon uuid; ten_mon text;
  ph1  uuid := gen_random_uuid();
  ph2  uuid := gen_random_uuid();
  n int;
begin
  -- Một lớp đang hoạt động có ít nhất hai em (hai em khác nhau thì mới có hai nhà) VÀ cơ sở của
  -- lớp ấy đã khai ít nhất một môn. Điều kiện thứ hai không thừa: subject_fits_class đòi môn phải
  -- cùng cơ sở với lớp, mà có cơ sở đến giờ vẫn chưa khai môn nào — chọn trúng lớp ấy thì bộ kiểm
  -- nổ ngay ở khâu dựng cảnh, không phải ở điều đang muốn hỏi.
  select e.class_id into lop
  from enrollments e join classes c on c.id = e.class_id
  where e.is_active and c.is_active
    and exists (select 1 from subjects s
                where s.is_active and (s.campus_id is null or s.campus_id = c.campus_id))
  group by e.class_id having count(*) >= 2
  limit 1;

  if lop is null then
    insert into kq values ('Tiền đề', 'một lớp có từ 2 em đang học', 'KHÔNG CÓ — CHƯA KIỂM ĐƯỢC');
    return;
  end if;

  select student_id into hs1 from enrollments
   where class_id = lop and is_active order by student_id limit 1;
  select student_id into hs2 from enrollments
   where class_id = lop and is_active and student_id <> hs1 order by student_id limit 1;

  -- Hai phụ huynh THẬT, dựng bằng ĐÚNG ĐƯỜNG NGƯỜI TA VÀO: mời trước, rồi đăng nhập. Trigger
  -- handle_new_user tự cấp vai 'parent' và tự nối cha–con.
  --
  -- Không đi tắt bằng `update profiles set role='parent'`: bảng profiles có chốt chặn "chỉ admin
  -- mới đổi được vai", và chốt ấy chặn cả quyền postgres. Đi tắt cũng đồng nghĩa phép kiểm dựng
  -- ra một tài khoản không giống bất kỳ tài khoản nào ngoài đời.
  insert into parent_invitations (email, student_id, status) values
    ('kiem.ph1@example.com', hs1, 'pending'),
    ('kiem.ph2@example.com', hs2, 'pending');

  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role) values
    (ph1, 'kiem.ph1@example.com', '{"full_name":"Phụ Huynh Kiểm 1"}'::jsonb,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ph2, 'kiem.ph2@example.com', '{"full_name":"Phụ Huynh Kiểm 2"}'::jsonb,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  -- Cảnh có dựng đúng không thì hỏi thẳng, đừng tin: nếu vai hay mối nối không sinh ra thì mọi
  -- phép đo bên dưới sẽ xanh vì rỗng — đúng cái bẫy bản cũ đã sập.
  select count(*) into n from profiles p join parent_links pl on pl.parent_id = p.id
   where p.id in (ph1, ph2) and p.role = 'parent';
  insert into kq values ('Tiền đề · hai phụ huynh vào đúng vai và đúng con', '2 dòng', n || ' dòng');

  -- Một tiết TKB để câu hỏi "phụ huynh đọc được TKB không" có gì mà đọc. Môn phải LẤY TỪ DANH
  -- MỤC CỦA ĐÚNG CƠ SỞ ấy — bảng có chốt chặn môn lạ, và một cái tên bịa sẽ làm cả bộ kiểm nổ
  -- giữa chừng thay vì trả lời câu đang hỏi.
  select s.id, s.name into mon, ten_mon
  from subjects s join classes c on c.id = lop
  where s.is_active and (s.campus_id is null or s.campus_id = c.campus_id)
  order by s.sort_order nulls last limit 1;

  insert into timetable_slots (class_id, day_of_week, period_no, subject, subject_id)
  values (lop, 2, 1, ten_mon, mon);

  -- ── TRƯỚC: con đang học → đọc được lớp + TKB ────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', ph1, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select count(*) into n from classes where id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐANG học · phụ huynh đọc lớp', '1 dòng', n || ' dòng');

  perform set_config('role','authenticated', true);
  select count(*) into n from timetable_slots where class_id = lop;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐANG học · phụ huynh đọc TKB', '>0 dòng',
    (case when n > 0 then '>0' else '0' end) || ' dòng');

  -- Con rời lớp — đúng như unenroll_student làm: chỉ tắt cờ, không xoá.
  update enrollments set is_active = false where student_id = hs1 and class_id = lop;

  -- ── SAU: phải mất sạch quyền ────────────────────────────────────────────────────────────
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

  perform set_config('role','authenticated', true);
  select case when is_parent_of_class(lop) then 1 else 0 end into n;
  perform set_config('role','postgres', true);
  insert into kq values ('Con ĐÃ RỜI · is_parent_of_class()', '0 dòng', n || ' dòng');

  -- ── NHÀ BÊN CẠNH KHÔNG BỊ GỠ THEO ───────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', ph2, 'role','authenticated')::text, true);
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

select count(*) filter (where ky_vong = thuc_te) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(ky_vong = thuc_te) as tat_ca_dat
from kq;

rollback;
