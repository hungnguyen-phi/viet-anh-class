-- KIỂM 0195 — xoá / huỷ cam kết dọn cả cây thước đo + lượt ghi.
--
--   npm run sql -- scripts/test-0195-xoa-cam-ket.sql
--
-- Giao dịch ROLLBACK trên production. CHƯA áp 0195 → chốt chặn đỏ ngay.
-- Ca kiểm:
--   ① Mồi (postgres): cam kết của học sinh lớp Test (đã có mục tiêu duyệt hay không đều được) + 1 thước
--      đã duyệt + 1 lượt ghi.
--   ② Học sinh khác gọi huy_cam_ket_ca_cay → 42501, cây còn nguyên.
--   ③ Chính em gọi huy_cam_ket_ca_cay → cam kết 'huy', thước + lượt biến mất.
--   ④ Mồi lại bộ mới, chính em DELETE cam_ket (đường "Xoá" ở cam kết lạc) → thành công, thước + lượt đi theo.

begin;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'huy_cam_ket_ca_cay')
     or position('delete from luot' in pg_get_functiondef('private.th_truoc_xoa'::regproc)) = 0 then
    raise exception 'CHUA VA 0195: thiếu huy_cam_ket_ca_cay hoặc th_truoc_xoa còn bản chặn — chạy migration 0195 trước.';
  end if;
end $$;

create temporary table bc195 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id offset 1 limit 1) em2,
  (select id from don_vi where lower(ma)='lan' limit 1) dv
from t;
grant select on bc195 to authenticated;
create temporary table art195 (k text primary key, v uuid) on commit drop;
grant all on art195 to authenticated;

create or replace function pg_temp.moi195(p_k text) returns void language plpgsql as $$
declare r bc195%rowtype; ck uuid; th uuid; begin
  select * into r from bc195;
  -- dọn trần 2 cam kết/tuần của em trong giao dịch
  update cam_ket set trang_thai = 'huy' where student_id = r.em1 and class_id = r.lop and tuan_bat_dau >= vn_week_start() and trang_thai = 'hieu_luc' and ket_qua is null;
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau)
  values ('em', r.lop, r.em1, 'ZZTEST195-' || p_k, 3, r.dv, 1, vn_week_start()) returning id into ck;
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan, ngay_ap_dung, chieu_dich, gop, ky_tuan, pham_vi, tu_tuan, cam_ket_id, duyet)
  values ('em', r.lop, r.em1, 'ZZTEST195-thuoc-' || p_k, 'cham', r.dv, 5, 1, array[1,2,3,4,5,6,7], 'it_nhat', 'tong', 1, 'tung_em', vn_week_start(), ck, 'duyet') returning id into th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (th, r.em1, vn_today(), 1, r.em1);
  insert into art195 values ('ck_' || p_k, ck), ('th_' || p_k, th);
end $$;

-- ① Mồi (postgres).
do $$ declare r bc195%rowtype; begin
  select * into r from bc195;
  if r.lop is null or r.em1 is null or r.em2 is null or r.dv is null then
    raise exception 'Thiếu lớp Test / 2 học sinh / đơn vị lan — không chạy được bài kiểm.';
  end if;
  perform pg_temp.moi195('a');
  raise notice 'CA1 OK — mồi cam kết + thước duyệt + lượt';
end $$;

do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ② Em khác không huỷ được.
do $$ declare r bc195%rowtype; begin
  select * into r from bc195;
  perform set_config('request.jwt.claims', json_build_object('sub', r.em2::text)::text, true);
  begin
    perform huy_cam_ket_ca_cay((select v from art195 where k='ck_a'));
    raise exception 'CA2 HỎNG: em khác huỷ được cam kết của bạn!';
  exception when insufficient_privilege then
    raise notice 'CA2 OK — em khác bị chặn';
  end;
  perform set_config('role', 'postgres', true);
  if not exists (select 1 from thuoc where id = (select v from art195 where k='th_a')) then raise exception 'CA2 HỎNG: thước bị dọn dù bị chặn'; end if;
end $$;

-- ③ Chính em huỷ → 'huy', thước + lượt biến mất.
do $$ declare r bc195%rowtype; tt text; begin
  select * into r from bc195;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  perform huy_cam_ket_ca_cay((select v from art195 where k='ck_a'));
  perform set_config('role', 'postgres', true);
  select trang_thai into tt from cam_ket where id = (select v from art195 where k='ck_a');
  if tt is distinct from 'huy' then raise exception 'CA3 HỎNG: cam kết không thành huy (%)', tt; end if;
  if exists (select 1 from thuoc where id = (select v from art195 where k='th_a')) then raise exception 'CA3 HỎNG: thước còn'; end if;
  if exists (select 1 from luot where thuoc_id = (select v from art195 where k='th_a')) then raise exception 'CA3 HỎNG: lượt còn'; end if;
  raise notice 'CA3 OK — huỷ cam kết, thước + lượt đi theo';
end $$;

-- ④ Chính em DELETE cam kết (đường Xoá) → thước + lượt đi theo nhờ th_truoc_xoa mới.
do $$ declare r bc195%rowtype; n int; begin
  select * into r from bc195;
  perform pg_temp.moi195('b');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  delete from cam_ket where id = (select v from art195 where k='ck_b');
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  if n <> 1 then raise exception 'CA4 HỎNG: em không xoá được cam kết (row_count=%)', n; end if;
  if exists (select 1 from thuoc where id = (select v from art195 where k='th_b')) then raise exception 'CA4 HỎNG: thước còn'; end if;
  if exists (select 1 from luot where thuoc_id = (select v from art195 where k='th_b')) then raise exception 'CA4 HỎNG: lượt còn'; end if;
  raise notice 'CA4 OK — xoá cam kết, thước + lượt đi theo';
end $$;

rollback;
