-- TEST 0188 — BGH đọc được hồ sơ học sinh trong cơ sở mình (campus_id đã điền), không đọc em cơ sở khác.
-- Tự rollback. Chạy TRƯỚC 0188 phải đỏ ở CA1 (em lớp Test campus_id NULL → 0 dòng).
begin;

do $$
declare
  v_bgh uuid; v_campus uuid; v_em uuid; v_em_khac uuid; v_n int;
begin
  -- BGH có campus (test2.bgh — lớp Test cùng cơ sở)
  select id, campus_id into v_bgh, v_campus from profiles where email = 'test2.bgh@truongvietanh.com';
  if v_bgh is null or v_campus is null then raise exception 'TEST-0188: thiếu BGH test2.bgh có campus'; end if;
  select id into v_em from profiles where email = 'test1.hs@student.truongvietanh.com';
  -- một em ở cơ sở KHÁC (qua lớp), nếu có
  select p.id into v_em_khac
  from profiles p join enrollments e on e.student_id = p.id and e.is_active
  join classes k on k.id = e.class_id
  where p.role = 'student' and k.campus_id <> v_campus limit 1;

  -- Giả phiên BGH
  perform set_config('request.jwt.claims', json_build_object('sub', v_bgh, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_bgh::text, true);
  set local role authenticated;

  -- CA1: BGH đọc được em lớp Test (cùng cơ sở)
  select count(*) into v_n from profiles where id = v_em;
  if v_n <> 1 then
    raise exception 'TEST-0188 CA1: BGH đọc em lớp Test ra % dòng (cần 1) — campus_id chưa điền?', v_n;
  end if;

  -- CA2: em cơ sở khác → 0 dòng
  if v_em_khac is not null then
    select count(*) into v_n from profiles where id = v_em_khac;
    if v_n <> 0 then raise exception 'TEST-0188 CA2: BGH đọc được em cơ sở khác (% dòng)', v_n; end if;
  end if;

  reset role;
  -- CA3: trigger — ghi danh mới điền campus cho hồ sơ trống (dùng em có sẵn, xoá campus rồi tái kích).
  -- Xoá campus_id phải mượn danh admin (protect_profile_privileged_cols).
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', (select id from profiles where role = 'admin' order by created_at limit 1)::text, true);
  update profiles set campus_id = null where id = v_em;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  update enrollments set is_active = is_active where student_id = v_em and is_active;
  select count(*) into v_n from profiles where id = v_em and campus_id = v_campus;
  if v_n <> 1 then raise exception 'TEST-0188 CA3: trigger không điền lại campus_id'; end if;

  raise notice 'TEST-0188: 3 ca ĐẠT';
end $$;

rollback;
