-- ============================================================
-- BỘ TEST RLS BẮT BUỘC (§12.3) — mô phỏng JWT từng vai trò trên DB.
-- Cách chạy 1 khối: chạy trong 1 transaction (set claims → set role → select).
-- Mỗi cột phải trả TRUE thì PASS. Đã verify PASS trên project pilot (2026-06).
-- Dùng dữ liệu seed: phụ huynh An (con hs01), hs02, GVCN co.lan, BGH bgh (VAGV),
--                    campus VAQ2 (7B1, hsq2) để test cô lập chéo campus.
-- ============================================================

-- 1) PHỤ HUYNH An — chỉ thấy con mình, không thấy HS/dữ liệu khác
begin;
select set_config('request.jwt.claims', (select json_build_object('sub',id,'role','authenticated')::text from profiles where email='phuhuynh.an@gmail.com'), true);
set local role authenticated;
select
  (select count(*) from profiles where role='student') = 1                                                        as parent_sees_1_student,
  not exists(select 1 from attendance_records ar where ar.student_id <> (select id from profiles where email='hs01@student.truongvietanh.com')) as parent_no_other_attendance,
  not exists(select 1 from wigs w where w.scope='student' and not is_my_child(w.student_id))                       as parent_no_other_wig,
  (select count(*) from classes) = 1                                                                              as parent_sees_1_class;
rollback;

-- 2) HỌC SINH hs02 (không phải leader) — chỉ thấy mình
begin;
select set_config('request.jwt.claims', (select json_build_object('sub',id,'role','authenticated')::text from profiles where email='hs02@student.truongvietanh.com'), true);
set local role authenticated;
select
  (select count(*) from profiles where role='student') = 1 as student_sees_self_only,
  (select count(*) from enrollments) = 1                   as student_1_enrollment,
  (select count(*) from classes) = 1                       as student_1_class;
rollback;

-- 3) GVCN Cô Lan — thấy HS lớp mình, không thấy lớp campus khác
begin;
select set_config('request.jwt.claims', (select json_build_object('sub',id,'role','authenticated')::text from profiles where email='co.lan@truongvietanh.com'), true);
set local role authenticated;
select
  (select count(*) from profiles where email like 'hs%@student.truongvietanh.com') = 25 as teacher_sees_class_students,
  exists(select 1 from classes where homeroom_teacher_id = auth.uid())                  as teacher_owns_class,
  not exists(select 1 from classes where name='7B1')                                    as teacher_no_other_campus_class;
rollback;

-- 4) BGH (campus VAGV) — thấy campus mình, KHÔNG thấy campus khác
begin;
select set_config('request.jwt.claims', (select json_build_object('sub',id,'role','authenticated')::text from profiles where email='bgh@truongvietanh.com'), true);
set local role authenticated;
select
  exists(select 1 from classes where name='6A1')    as principal_sees_own_campus,
  not exists(select 1 from classes where name='7B1') as principal_no_other_campus;
rollback;

-- 5) ẨN DANH — không thấy gì (chứng minh RLS là cổng, không phải app)
begin;
set local role anon;
select
  (select count(*) from profiles) = 0           as anon_no_profiles,
  (select count(*) from attendance_records) = 0 as anon_no_attendance,
  (select count(*) from classes) = 0            as anon_no_classes,
  (select count(*) from wigs) = 0               as anon_no_wigs;
rollback;
