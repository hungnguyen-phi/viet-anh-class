-- KIỂM 0189: trang_wig / trang_student — cùng dữ liệu như gọi từng câu; RLS invoker giữ nguyên.
-- Chạy trên production, TỰ ROLLBACK. Chưa áp 0189 → đỏ ngay CA1 (hàm không tồn tại).
begin;
do $$
declare
  v_gv uuid := (select id from profiles where email = 'tunhien01@truongvietanh.com');
  v_hs uuid := (select id from profiles where email = 'test1.hs@student.truongvietanh.com');
  v_lop uuid := (select id from classes where name = 'Test' and is_active limit 1);
  v_campus uuid := (select campus_id from classes where id = (select id from classes where name = 'Test' and is_active limit 1));
  v_mon date := date_trunc('week', current_date)::date;
  j jsonb; n1 int; n2 int; n3 int;
begin
  -- Giả phiên GVCN (authenticated) — RLS thật.
  perform set_config('request.jwt.claims', json_build_object('sub', v_gv, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_gv::text, true);
  set local role authenticated;

  -- CA1: hàm có, trả jsonb có đủ khoá.
  j := public.trang_wig(v_lop, v_mon, v_gv, v_campus, 8);
  if j is null or not (j ? 'mtRows' and j ? 'enrolled' and j ? 'lichSu' and j ? 'thiDua') then
    raise exception 'CA1 trang_wig thiếu khoá: %', (select string_agg(k, ',') from jsonb_object_keys(j) k);
  end if;
  -- CA2: đếm mục tiêu lớp = đếm trực tiếp qua muc_tieu_v (cùng RLS).
  n1 := jsonb_array_length(j->'mtRows');
  select count(*) into n2 from muc_tieu_v where class_id = v_lop and cap = 'lop' and trang_thai <> 'dong';
  if n1 <> n2 then raise exception 'CA2 mtRows % <> muc_tieu_v %', n1, n2; end if;
  -- CA3: enrolled = enrollments active.
  n1 := jsonb_array_length(j->'enrolled');
  select count(*) into n2 from enrollments where class_id = v_lop and is_active;
  if n1 <> n2 then raise exception 'CA3 enrolled % <> %', n1, n2; end if;
  -- CA4: thiDua khớp thi_dua_lop.
  select count(*) into n2 from public.thi_dua_lop(v_lop);
  if jsonb_array_length(j->'thiDua') <> n2 then raise exception 'CA4 thiDua'; end if;
  -- CA5: lịch sử: mỗi mục tiêu có số đều có dòng.
  n1 := (select count(distinct (e->>'muc_tieu_id')) from jsonb_array_elements(j->'lichSu') e);
  select count(*) into n2 from muc_tieu_v where ((class_id = v_lop and cap = 'lop') or (cap = 'em' and student_id = v_gv and class_id = v_lop))
    and trang_thai <> 'dong' and (pct is not null or so is not null);
  if n1 <> n2 then raise exception 'CA5 lichSu % mục tiêu <> % có số', n1, n2; end if;

  -- CA6: HS xem trang của mình — khoá đủ, muc_tieu khớp.
  perform set_config('request.jwt.claims', json_build_object('sub', v_hs, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_hs::text, true);
  j := public.trang_student(v_hs, v_mon, current_date, 'W' || to_char(v_mon, 'IW-IYYY'));
  if j is null or not (j ? 'student' and j ? 'mucTieu' and j ? 'viec' and j ? 'camKet' and j ? 'tuan12') then
    raise exception 'CA6 trang_student thiếu khoá';
  end if;
  n1 := jsonb_array_length(j->'mucTieu');
  select count(*) into n2 from muc_tieu_v where student_id = v_hs and cap = 'em';
  if n1 <> n2 then raise exception 'CA6 mucTieu % <> %', n1, n2; end if;
  n1 := jsonb_array_length(j->'viec');
  select count(*) into n2 from public.viec_bang(v_hs);
  if n1 <> n2 then raise exception 'CA6 viec % <> %', n1, n2; end if;
  -- CA7: RLS invoker — HS xem trang của em KHÁC lớp thì profiles/muc_tieu rỗng (không lộ).
  j := public.trang_student((select id from profiles where role = 'student' and id <> v_hs
                              and not exists (select 1 from enrollments e where e.student_id = profiles.id and e.class_id = v_lop) limit 1),
                            v_mon, current_date, 'x');
  if j is not null and (j->'student') is not null and (j->'student') <> 'null'::jsonb then
    raise exception 'CA7 HS đọc được hồ sơ em khác lớp qua trang_student';
  end if;
  -- CA8: anon → null.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  set local role anon;
  begin
    j := public.trang_wig(v_lop, v_mon, null, v_campus, 8);
    if j is not null then raise exception 'CA8 anon gọi trang_wig ra dữ liệu'; end if;
  exception when insufficient_privilege then null; -- revoke đúng cũng là đạt
  end;
  raise notice 'test-0189: 8/8 ĐẠT';
end $$;
rollback;
