-- ============================================================
-- RLS SECURITY REGRESSION TEST — dữ liệu trẻ em (Audit Phase 3)
-- Chứng minh các lỗ C1–C4 + rò scoreboard/mood + tick vô hạn ĐÃ bị chặn.
-- Cách chạy: dán vào Supabase SQL Editor (project viet-anh-class) và Run,
--   HOẶC qua MCP execute_sql. Cần dữ liệu seed demo (co.lan/hs01/hs02/phuhuynh.an…).
-- Mỗi khối tự tra UUID theo EMAIL (không hardcode) → chạy được trên mọi lần seed lại.
-- Cách impersonate: tra UUID (role postgres) → lưu vào GUC → set jwt.claims + role authenticated.
-- Mỗi test in kèm cột "want" (giá trị kỳ vọng) để tự đối chiếu.
-- ============================================================

-- ---------- Khối 1: HỌC SINH hs02 KHÔNG đọc được dữ liệu của bạn hs01 ----------
begin;
select set_config('t.hs01', (select id::text from profiles where email='hs01@student.truongvietanh.com'), true);
select set_config('t.hs02', (select id::text from profiles where email='hs02@student.truongvietanh.com'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.hs02'), 'role','authenticated')::text, true);
set local role authenticated;

select 'C2  hs02 đọc WIG cá nhân hs01'          as test, 0 as want, count(*) as got from wig_progress_v where student_id=current_setting('t.hs01')::uuid and scope='student'
union all select 'C2c hs02 đọc WIG của chính mình', 12,     count(*) from wig_progress_v where student_id=current_setting('t.hs02')::uuid and scope='student'
union all select 'leak hs02 đọc mood hs01',          0,      count(*) from mood_checkins  where student_id=current_setting('t.hs01')::uuid
union all select 'C1  hs02 đọc điểm danh hs01',       0,      count(*) from attendance_records where student_id=current_setting('t.hs01')::uuid
union all select 'C3  hs02 gọi child_week_report(hs01)', 0,   count(*) from child_week_report(current_setting('t.hs01')::uuid, 'W30-2026');
rollback;

-- ---------- Khối 2: PHỤ HUYNH chỉ thấy CON MÌNH (an ↔ hs01), không thấy hs02 ----------
begin;
select set_config('t.hs01', (select id::text from profiles where email='hs01@student.truongvietanh.com'), true);
select set_config('t.hs02', (select id::text from profiles where email='hs02@student.truongvietanh.com'), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where email='phuhuynh.an@gmail.com'), 'role','authenticated')::text, true);
set local role authenticated;

select 'C3  PH đọc báo cáo CON MÌNH hs01' as test, 'want>0' as want, count(*) as got from child_week_report(current_setting('t.hs01')::uuid, 'W30-2026')
union all select 'C3  PH đọc báo cáo hs02 (không phải con)', 'want 0', count(*) from child_week_report(current_setting('t.hs02')::uuid, 'W30-2026')
union all select 'PH đọc mood con mình hs01', 'want>0', count(*) from mood_checkins where student_id=current_setting('t.hs01')::uuid
union all select 'PH đọc mood hs02 (không phải con)', 'want 0', count(*) from mood_checkins where student_id=current_setting('t.hs02')::uuid;
rollback;

-- ---------- Khối 3: class_ranks không xuyên lớp (hs02 xem hạng lớp không thuộc) ----------
begin;
select set_config('t.c6a1', (select id::text from classes where name='6A1' order by school_year desc limit 1), true);
select set_config('t.c7b1', (select id::text from classes where name='7B1' order by school_year desc limit 1), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where email='hs02@student.truongvietanh.com'), 'role','authenticated')::text, true);
set local role authenticated;

select 'class_ranks hs02 xem lớp MÌNH 6A1' as test, 'want>0' as want, count(*) as got from class_ranks(current_setting('t.c6a1')::uuid)
union all select 'class_ranks hs02 xem 7B1 (không thuộc)', 'want 0', count(*) from class_ranks(current_setting('t.c7b1')::uuid);
rollback;

-- ---------- Khối 4: C4 — GVCN KHÔNG tự đổi GVCN/cơ sở lớp (trigger chặn) ----------
begin;
select set_config('t.c6a1', (select id::text from classes where name='6A1' order by school_year desc limit 1), true);
select set_config('t.hs02', (select id::text from profiles where email='hs02@student.truongvietanh.com'), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where email='co.lan@truongvietanh.com'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_blocked boolean := false; v_msg text;
begin
  begin
    update classes set homeroom_teacher_id = current_setting('t.hs02')::uuid where id = current_setting('t.c6a1')::uuid;
  exception when others then v_blocked := true; v_msg := sqlerrm; end;
  create temp table _r(test text, want text, pass boolean, detail text) on commit drop;
  insert into _r values ('C4 GVCN tự đổi GVCN lớp', 'blocked', v_blocked, coalesce(v_msg,'KHÔNG chặn — LỖ HỔNG'));
end $$;
select * from _r;
rollback;

-- ---------- Khối 5: 0020 — học sinh KHÔNG tick 1 lead measure 2 lần/ngày ----------
begin;
select set_config('t.hs01', (select id::text from profiles where email='hs01@student.truongvietanh.com'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.hs01'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_lm uuid; v_blocked boolean := false;
begin
  select lm.id into v_lm from lead_measures lm
    join lead_progress lp on lp.lead_measure_id = lm.id
    where lp.student_id = current_setting('t.hs01')::uuid and lp.logged_date = vn_today() limit 1;
  create temp table _r(test text, want text, pass boolean, detail text) on commit drop;
  if v_lm is null then
    insert into _r values ('0020 tick 2 lần/ngày', 'blocked', null, 'chưa có lead đã tick hôm nay để test');
    return;
  end if;
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value)
      values (v_lm, current_setting('t.hs01')::uuid, current_setting('t.hs01')::uuid, 1);
  exception when unique_violation then v_blocked := true; end;
  insert into _r values ('0020 hs01 tick lại lead đã tick hôm nay', 'blocked', v_blocked, case when v_blocked then 'unique 1 lần/ngày' else 'KHÔNG chặn — LỖ' end);
end $$;
select * from _r;
rollback;
