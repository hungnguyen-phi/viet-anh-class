-- ============================================================
-- SEED DỮ LIỆU GIẢ (demo/dev) — KHÔNG dùng cho production thật (§12.1).
-- Tạo: 1 campus, lớp 6A1 (GVCN Cô Lan), 25 học sinh (hs01 = attendance leader),
--      phụ huynh An (đã liên kết hs01), phụ huynh Bình (mới mời).
-- Chạy trên DB sạch. auth.users insert sẽ kích hoạt trigger handle_new_user tạo profiles.
-- ============================================================

insert into campuses (name, code) values ('Việt Anh Gò Vấp', 'VAGV') on conflict (code) do nothing;

-- 25 học sinh (@student.truongvietanh.com → role 'student')
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  s.em, jsonb_build_object('full_name', s.fn), now(), now()
from (
  select 'hs' || lpad(g::text, 2, '0') || '@student.truongvietanh.com' as em,
         'Học sinh Demo ' || lpad(g::text, 2, '0') as fn
  from generate_series(1, 25) g
) s
where not exists (select 1 from auth.users u where u.email = s.em);

-- GVCN (@truongvietanh.com → role 'pending', nâng lên 'teacher' bên dưới)
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'co.lan@truongvietanh.com', '{"full_name":"Cô Lan"}'::jsonb, now(), now()
where not exists (select 1 from auth.users u where u.email = 'co.lan@truongvietanh.com');

-- Gán role/campus (tắt tạm trigger bảo vệ vì seed không có context admin)
alter table profiles disable trigger trg_protect_profile_cols;
update profiles set role = 'teacher', campus_id = (select id from campuses where code = 'VAGV')
where email = 'co.lan@truongvietanh.com';
update profiles set campus_id = (select id from campuses where code = 'VAGV')
where email like 'hs%@student.truongvietanh.com';
alter table profiles enable trigger trg_protect_profile_cols;

insert into classes (campus_id, name, grade, school_year, homeroom_teacher_id)
select c.id, '6A1', '6', '2026-2027', t.id
from campuses c, profiles t
where c.code = 'VAGV' and t.email = 'co.lan@truongvietanh.com'
  and not exists (select 1 from classes x where x.name = '6A1' and x.school_year = '2026-2027' and x.campus_id = c.id);

insert into enrollments (class_id, student_id, is_attendance_leader)
select cl.id, p.id, (p.email = 'hs01@student.truongvietanh.com')
from classes cl, profiles p
where cl.name = '6A1' and cl.school_year = '2026-2027'
  and p.email like 'hs%@student.truongvietanh.com'
on conflict (class_id, student_id) do nothing;

-- Mời phụ huynh TRƯỚC khi tạo user (để trigger nối parent_link khi họ đăng nhập)
insert into parent_invitations (email, student_id, status)
select 'phuhuynh.an@gmail.com', p.id, 'pending' from profiles p where p.email = 'hs01@student.truongvietanh.com'
on conflict (email, student_id) do nothing;
insert into parent_invitations (email, student_id, status)
select 'phuhuynh.binh@gmail.com', p.id, 'pending' from profiles p where p.email = 'hs02@student.truongvietanh.com'
on conflict (email, student_id) do nothing;

-- Phụ huynh An "đã đăng nhập" → trigger gán role parent + parent_link tới hs01
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'phuhuynh.an@gmail.com', '{"full_name":"Phụ huynh An"}'::jsonb, now(), now()
where not exists (select 1 from auth.users u where u.email = 'phuhuynh.an@gmail.com');

-- BẮT BUỘC: GoTrue scan các cột token là string không-null → user tạo bằng SQL phải set '' (không NULL),
-- nếu không sẽ lỗi "Database error finding user" khi đăng nhập/magic-link.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '');

-- WIG năm cấp lớp 6A1 (4 lĩnh vực) + lead measure + tiến độ demo (donut on/off-track).
insert into wigs (class_id, scope, area, period, period_label, target_value, unit, start_date, end_date, note)
select (select id from classes where name='6A1' and school_year='2026-2027' limit 1),
       'class', a.area::wig_area, 'year', '2026', a.target, a.unit, date '2026-01-01', date '2026-12-31', a.note
from (values
  ('knowledge', 200, 'buổi tutor', '80% học sinh đạt giỏi'),
  ('skills', 100, 'hành vi', '95% hành vi xây dựng văn hoá'),
  ('english', 50, 'buổi luyện nói', '95% tiến bộ AVQT 1 level'),
  ('physical', 100, 'buổi tập', '100% tiến bộ thể chất')
) as a(area, target, unit, note)
where not exists (
  select 1 from wigs w where w.class_id = (select id from classes where name='6A1' and school_year='2026-2027' limit 1)
    and w.scope='class' and w.period='year' and w.area = a.area::wig_area
);

insert into lead_measures (wig_id, title, target_value, unit)
select w.id, 'Tiến độ ' || w.area, w.target_value, w.unit
from wigs w
where w.class_id = (select id from classes where name='6A1' and school_year='2026-2027' limit 1)
  and w.scope='class' and w.period='year'
  and not exists (select 1 from lead_measures lm where lm.wig_id = w.id);

insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
select lm.id, null, p.val, current_date, (select id from profiles where email='co.lan@truongvietanh.com')
from lead_measures lm
join wigs w on w.id = lm.wig_id
join (values ('knowledge',144),('skills',40),('english',40),('physical',35)) as p(area, val) on p.area = w.area::text
where w.class_id = (select id from classes where name='6A1' and school_year='2026-2027' limit 1)
  and w.scope='class' and w.period='year'
  and not exists (select 1 from lead_progress lp where lp.lead_measure_id = lm.id);

-- BGH (principal) cho VAGV + campus thứ 2 (VAQ2) để test cô lập chéo campus.
insert into campuses (name, code) values ('Việt Anh Quận 2', 'VAQ2') on conflict (code) do nothing;
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated','authenticated','bgh@truongvietanh.com', now(), '{"full_name":"Thầy Hiệu trưởng"}'::jsonb, now(), now()
where not exists (select 1 from auth.users where email='bgh@truongvietanh.com');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated','authenticated','hsq2@student.truongvietanh.com', now(), '{"full_name":"Học sinh Quận 2"}'::jsonb, now(), now()
where not exists (select 1 from auth.users where email='hsq2@student.truongvietanh.com');
update auth.users set confirmation_token=coalesce(confirmation_token,''), recovery_token=coalesce(recovery_token,''),
  email_change_token_new=coalesce(email_change_token_new,''), email_change=coalesce(email_change,''),
  email_change_token_current=coalesce(email_change_token_current,''), phone_change=coalesce(phone_change,''),
  phone_change_token=coalesce(phone_change_token,''), reauthentication_token=coalesce(reauthentication_token,'');
alter table profiles disable trigger trg_protect_profile_cols;
update profiles set role='principal', campus_id=(select id from campuses where code='VAGV') where email='bgh@truongvietanh.com';
update profiles set campus_id=(select id from campuses where code='VAQ2') where email='hsq2@student.truongvietanh.com';
alter table profiles enable trigger trg_protect_profile_cols;
insert into classes (campus_id, name, grade, school_year)
select (select id from campuses where code='VAQ2'), '7B1', '7', '2026-2027'
where not exists (select 1 from classes where name='7B1' and school_year='2026-2027');
insert into enrollments (class_id, student_id)
select (select id from classes where name='7B1' and school_year='2026-2027' limit 1), (select id from profiles where email='hsq2@student.truongvietanh.com')
on conflict (class_id, student_id) do nothing;
