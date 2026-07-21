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

-- Admin test (đăng nhập nhanh bằng magic link).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@truongvietanh.com', now(), '{"full_name":"Admin Test"}'::jsonb, now(), now()
where not exists (select 1 from auth.users where email = 'admin@truongvietanh.com');
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
where email = 'admin@truongvietanh.com';
alter table profiles disable trigger trg_protect_profile_cols;
update profiles set role = 'admin' where email = 'admin@truongvietanh.com';
alter table profiles enable trigger trg_protect_profile_cols;

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

-- ============================================================
-- DEMO LOGIN (tạm — XOÁ trước khi deploy production).
-- Đặt mật khẩu 'demo1234' + xác nhận email cho 5 tài khoản đại diện 5 vai trò,
-- để nút "đăng nhập nhanh" trên trang login hoạt động (signInWithPassword).
-- ============================================================
update auth.users set
  encrypted_password = extensions.crypt('demo1234', extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now())
where email in (
  'co.lan@truongvietanh.com',          -- teacher (GVCN 6A1)
  'hs01@student.truongvietanh.com',    -- student (tổ trưởng điểm danh)
  'admin@truongvietanh.com',           -- admin
  'bgh@truongvietanh.com',             -- principal (BGH VAGV)
  'phuhuynh.an@gmail.com'              -- parent (đã liên kết hs01)
);

-- ============================================================
-- DEMO (tạm — xoá trước production): WIG cá nhân cho hs01
-- 4 lĩnh vực × (năm + tuần W29/W30) + lead measure + tiến độ,
-- số liệu cố ý tạo đủ 4 trạng thái on/mid/off-track để demo
-- nhiệt kế cảm xúc + pip thắng/thua + nút tick/hoàn tác.
-- ============================================================
do $$
declare
  sid uuid; cid uuid;
  yw uuid; w29 uuid; w30 uuid; lm29 uuid; lm30 uuid;
  v_area text; v_title text; v_unit text; p29 int; p30 int;
  i int;
begin
  select id into sid from profiles where email = 'hs01@student.truongvietanh.com';
  select id into cid from classes where name = '6A1' and school_year = '2026-2027' limit 1;
  if sid is null or cid is null then return; end if;
  -- Idempotent: đã có WIG cá nhân thì thôi.
  if exists (select 1 from wigs where student_id = sid and scope = 'student') then return; end if;

  for v_area, v_title, v_unit, p29, p30 in
    select * from (values
      ('knowledge', 'Buổi tutor Toán',      'buổi', 5, 1),
      ('skills',    'Hành vi văn hoá tốt',  'lần',  2, 0),
      ('english',   'Học 10 từ vựng mới',   'lần',  1, 0),
      ('physical',  'Buổi tập thể thao',    'buổi', 5, 1)
    ) v(a, t, u, x, y)
  loop
    insert into wigs (class_id, student_id, scope, area, period, period_label, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'year', '2026-2027', 40, v_unit, date '2026-06-01', date '2027-05-31')
    returning id into yw;

    insert into wigs (class_id, student_id, scope, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'week', 'W29-2026', yw, 5, v_unit, date '2026-07-13', date '2026-07-19')
    returning id into w29;

    insert into wigs (class_id, student_id, scope, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'week', 'W30-2026', yw, 5, v_unit, date '2026-07-20', date '2026-07-26')
    returning id into w30;

    insert into lead_measures (wig_id, title, target_value, unit) values (w29, v_title, 5, v_unit) returning id into lm29;
    insert into lead_measures (wig_id, title, target_value, unit) values (w30, v_title, 5, v_unit) returning id into lm30;

    -- Tuần trước (W29): bản ghi đã quá 24h → khoá (demo ổ khoá).
    for i in 1..p29 loop
      insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by, created_at)
      values (lm29, sid, 1, date '2026-07-13' + (i - 1), sid, (date '2026-07-13' + (i - 1))::timestamptz + interval '8 hours');
    end loop;

    -- Hôm nay (W30): còn trong cửa sổ 24h → hiện nút Hoàn tác.
    for i in 1..p30 loop
      insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by, created_at)
      values (lm30, sid, 1, current_date, sid, now() - interval '2 hours');
    end loop;
  end loop;
end $$;

-- DEMO (tạm): biên bản họp WIG cá nhân Coach×Buddy cho hs01, tuần W29.
do $$
declare sid uuid; cid uuid; coach uuid;
begin
  select id into sid from profiles where email = 'hs01@student.truongvietanh.com';
  select id into cid from classes where name = '6A1' and school_year = '2026-2027' limit 1;
  select id into coach from profiles where email = 'co.lan@truongvietanh.com';
  if sid is null or cid is null then return; end if;
  if exists (select 1 from wig_meetings where student_id = sid and week_label = 'W29-2026') then return; end if;
  insert into wig_meetings (class_id, student_id, week_label, coach_id, buddy_id, results, commitments, next_actions)
  values (
    cid, sid, 'W29-2026', coach, sid,
    'Tuần này em tiến bộ rõ ở Kiến thức và Thể chất (đạt mục tiêu). Kỹ năng và Tiếng Anh còn chậm do nghỉ 1 buổi.',
    'Cam kết đi học đầy đủ, làm bài tutor Toán đều mỗi ngày.',
    'Tuần sau: giữ 5 buổi tutor Toán, thêm 3 buổi luyện nói tiếng Anh, hoàn thành 2 hành vi văn hoá.'
  );
end $$;

-- DEMO (tạm — xoá trước production): WIG cá nhân cho hs02 (HỌC SINH THƯỜNG, không tổ trưởng).
-- Tiến bộ cao hơn hs01 → nhiệt kế cảm xúc ra mức vui, tạo tương phản khi demo.
do $$
declare
  sid uuid; cid uuid; coach uuid;
  yw uuid; w29 uuid; w30 uuid; lm29 uuid; lm30 uuid;
  v_area text; v_title text; v_unit text; p29 int; p30 int;
  i int;
begin
  select id into sid from profiles where email = 'hs02@student.truongvietanh.com';
  select id into cid from classes where name = '6A1' and school_year = '2026-2027' limit 1;
  select id into coach from profiles where email = 'co.lan@truongvietanh.com';
  if sid is null or cid is null then return; end if;
  if exists (select 1 from wigs where student_id = sid and scope = 'student') then return; end if;

  for v_area, v_title, v_unit, p29, p30 in
    select * from (values
      ('knowledge', 'Buổi tutor Toán',      'buổi', 5, 4),
      ('skills',    'Hành vi văn hoá tốt',  'lần',  5, 3),
      ('english',   'Học 10 từ vựng mới',   'lần',  4, 3),
      ('physical',  'Buổi tập thể thao',    'buổi', 5, 4)
    ) v(a, t, u, x, y)
  loop
    insert into wigs (class_id, student_id, scope, area, period, period_label, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'year', '2026-2027', 40, v_unit, date '2026-06-01', date '2027-05-31')
    returning id into yw;

    insert into wigs (class_id, student_id, scope, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'week', 'W29-2026', yw, 5, v_unit, date '2026-07-13', date '2026-07-19')
    returning id into w29;

    insert into wigs (class_id, student_id, scope, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date)
    values (cid, sid, 'student', v_area::wig_area, 'week', 'W30-2026', yw, 5, v_unit, date '2026-07-20', date '2026-07-26')
    returning id into w30;

    insert into lead_measures (wig_id, title, target_value, unit) values (w29, v_title, 5, v_unit) returning id into lm29;
    insert into lead_measures (wig_id, title, target_value, unit) values (w30, v_title, 5, v_unit) returning id into lm30;

    for i in 1..p29 loop
      insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by, created_at)
      values (lm29, sid, 1, date '2026-07-13' + (i - 1), sid, (date '2026-07-13' + (i - 1))::timestamptz + interval '8 hours');
    end loop;

    for i in 1..p30 loop
      insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by, created_at)
      values (lm30, sid, 1, current_date, sid, now() - interval '2 hours');
    end loop;
  end loop;

  -- Một biên bản họp cá nhân cho phong phú (buddy = hs01).
  if not exists (select 1 from wig_meetings where student_id = sid and week_label = 'W29-2026') then
    insert into wig_meetings (class_id, student_id, week_label, coach_id, buddy_id, results, commitments, next_actions)
    values (
      cid, sid, 'W29-2026', coach,
      (select id from profiles where email = 'hs01@student.truongvietanh.com'),
      'Em học rất đều tuần này, cả 4 lĩnh vực đều tiến bộ tốt. Giữ phong độ nhé!',
      'Đi học đầy đủ, làm bài tập về nhà đúng hạn.',
      'Tuần sau thử giúp đỡ một bạn trong nhóm để rèn kỹ năng.'
    );
  end if;
end $$;

