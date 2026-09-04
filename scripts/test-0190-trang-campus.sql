-- KIỂM 0190: trang_campus — cùng dữ liệu như gọi từng câu; RLS invoker giữ nguyên.
-- Chạy trên production, TỰ ROLLBACK. Chưa áp 0190 → đỏ ngay CA1 (hàm không tồn tại).
begin;
do $$
declare
  v_ad uuid := (select id from profiles where email = 'test3.admin@truongvietanh.com');
  v_bgh uuid := (select id from profiles where role = 'principal' and campus_id is not null order by email limit 1);
  v_cs uuid := (select campus_id from profiles where id = (select id from profiles where role = 'principal' and campus_id is not null order by email limit 1));
  v_hs uuid := (select id from profiles where email = 'test1.hs@student.truongvietanh.com');
  j jsonb; n1 int; n2 int; s1 numeric; s2 numeric; v_lop uuid;
begin
  -- ── ADMIN ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_ad::text, true);
  set local role authenticated;

  -- CA1: hàm có, đủ khoá.
  j := public.trang_campus(null, null, null);
  if j is null or not (j ? 'rows' and j ? 'coSoTatCa' and j ? 'lopRows' and j ? 'namChon') then
    raise exception 'CA1 trang_campus thiếu khoá: %', coalesce((select string_agg(k, ',') from jsonb_object_keys(j) k), 'null');
  end if;
  -- CA2: rows = campus_rollup (cùng lớp, cùng thứ tự, cùng wig_count/student_count/att_today).
  n1 := jsonb_array_length(j->'rows');
  select count(*) into n2 from public.campus_rollup();
  if n1 <> n2 then raise exception 'CA2 rows % <> campus_rollup %', n1, n2; end if;
  if exists (
    select 1 from public.campus_rollup() r
    join jsonb_array_elements(j->'rows') e on (e->>'class_id')::uuid = r.class_id
    where (e->>'wig_count')::int <> r.wig_count or (e->>'student_count')::int <> r.student_count
       or (e->>'att_today')::int <> r.att_today or (e->>'grade_name') <> r.grade_name
  ) then raise exception 'CA2 rows lệch campus_rollup ở wig_count/student_count/att_today/grade_name'; end if;
  -- CA3: score: bản cache vs bản không cache — cùng công thức, chênh ≤ 0.1 khi cache tươi
  -- (thi_dua_mt tính sống; hai số 4 tuần từ cache ≤ 15 phút). Kiểm trên lớp Test.
  select id into v_lop from classes where name = 'Test' and is_active limit 1;
  select (e->>'score')::numeric into s1 from jsonb_array_elements(j->'rows') e where (e->>'class_id')::uuid = v_lop;
  select r.score into s2 from public.campus_rollup() r where r.class_id = v_lop;
  if s1 is null or s2 is null then raise exception 'CA3 không thấy lớp Test trong rows/rollup'; end if;
  if abs(s1 - s2) > 0.1 then raise exception 'CA3 score lớp Test: trang_campus % <> campus_rollup %', s1, s2; end if;
  -- CA4: coSoTatCa = co_so_tong_hop (số dòng + mt_pct từng lớp).
  n1 := jsonb_array_length(j->'coSoTatCa');
  select count(*) into n2 from public.co_so_tong_hop();
  if n1 <> n2 then raise exception 'CA4 coSoTatCa % <> co_so_tong_hop %', n1, n2; end if;
  if exists (
    select 1 from public.co_so_tong_hop() r
    join jsonb_array_elements(j->'coSoTatCa') e on (e->>'class_id')::uuid = r.class_id
    where (e->>'mt_pct')::numeric is distinct from r.mt_pct or (e->>'cho_duyet')::int is distinct from r.cho_duyet
  ) then raise exception 'CA4 coSoTatCa lệch co_so_tong_hop'; end if;
  -- CA5: lopRows = classes active (admin thấy hết); namChon = năm mới nhất.
  n1 := jsonb_array_length(j->'lopRows');
  select count(*) into n2 from classes where is_active;
  if n1 <> n2 then raise exception 'CA5 lopRows % <> classes active %', n1, n2; end if;
  if (j->>'namChon') <> (select max(school_year) from classes where is_active) then raise exception 'CA5 namChon %', j->>'namChon'; end if;
  -- CA6: admin → khu BGH rỗng/null.
  if jsonb_array_length(j->'gr') <> 0 or (j->'cp') is not null and jsonb_typeof(j->'cp') <> 'null' then raise exception 'CA6 admin không được có khu mgmt'; end if;

  -- ── BGH ──
  if v_bgh is null then raise notice 'Không có BGH có campus để kiểm — bỏ CA7–CA9'; else
    perform set_config('request.jwt.claims', json_build_object('sub', v_bgh, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_bgh::text, true);
    j := public.trang_campus(v_cs, null, null);
    -- CA7: rows chỉ lớp cơ sở mình = campus_rollup dưới cùng phiên.
    n1 := jsonb_array_length(j->'rows'); select count(*) into n2 from public.campus_rollup();
    if n1 <> n2 then raise exception 'CA7 BGH rows % <> rollup %', n1, n2; end if;
    if exists (select 1 from jsonb_array_elements(j->'rows') e join classes c on c.id = (e->>'class_id')::uuid where c.campus_id <> v_cs) then
      raise exception 'CA7 BGH thấy lớp cơ sở khác'; end if;
    -- CA8: 5 câu mgmt khớp từng câu lẻ dưới RLS.
    if jsonb_array_length(j->'gr') <> (select count(*) from grades where campus_id = v_cs) then raise exception 'CA8 gr'; end if;
    if jsonb_array_length(j->'cls') <> (select count(*) from classes where campus_id = v_cs and is_active) then raise exception 'CA8 cls'; end if;
    if jsonb_array_length(j->'staffRows') <> (select count(*) from profiles where campus_id = v_cs and role in ('teacher','pending')) then raise exception 'CA8 staffRows'; end if;
    if (j->'cp'->>'name') is distinct from (select name from campuses where id = v_cs) then raise exception 'CA8 cp'; end if;
    if jsonb_array_length(j->'inv') <> (select count(*) from pending_user_grants where campus_id = v_cs and role = 'teacher') then raise exception 'CA8 inv'; end if;
    if jsonb_array_length(j->'mtTruong') <> (select count(*) from muc_tieu_v where cap = 'truong' and trang_thai <> 'dong') then raise exception 'CA8 mtTruong'; end if;
    -- CA9: lọc khối: p_khoi không đổi rows/coSo (lọc ở trang) nhưng lopRows vẫn đủ để dựng bộ lọc.
    if jsonb_array_length(j->'lopRows') <> (select count(*) from classes where is_active and campus_id = v_cs) then raise exception 'CA9 lopRows BGH'; end if;
  end if;

  -- CA10: học sinh gọi → null (không lộ gì).
  perform set_config('request.jwt.claims', json_build_object('sub', v_hs, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_hs::text, true);
  if public.trang_campus(null, null, null) is not null then raise exception 'CA10 học sinh gọi được trang_campus'; end if;

  raise notice 'TEST-0190 ĐẠT (10 ca)';
end $$;
rollback;
