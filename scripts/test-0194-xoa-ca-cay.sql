-- KIỂM 0194 — xoá mục tiêu là xoá cả cây (cam kết, thước đo, lượt ghi đi theo).
--
--   npm run sql -- scripts/test-0194-xoa-ca-cay.sql
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0194 thì CHỐT CHẶN
-- đỏ ngay (và nếu chạy ép, ca ② cũng đỏ vì trigger cũ chặn "Còn cam kết đang neo").
--
-- Ca kiểm:
--   ① Mồi (vai postgres): mục tiêu cá nhân của GVCN lớp Test đã duyệt + 1 cam kết hiệu lực + 1 thước
--      + 1 lượt ghi trên thước ấy.
--   ② Vai authenticated (RLS thật, jwt = GVCN): DELETE mục tiêu → phải thành công, và cam kết /
--      thước / lượt của nó biến mất.
--   ③ Vai authenticated jwt = học sinh khác: DELETE mục tiêu của GVCN → 0 dòng (RLS vẫn chặn).

begin;

do $$
begin
  if position('delete from luot' in pg_get_functiondef('private.mt_truoc_xoa'::regproc)) = 0 then
    raise exception 'CHUA VA 0194: private.mt_truoc_xoa còn bản chặn — chạy migration 0194 trước.';
  end if;
end $$;

create temporary table bc194 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  current_school_year() nam, vn_today() bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 6, 30) kt,
  (select id from don_vi where lower(ma)='lan' limit 1) dv
from t;
grant select on bc194 to authenticated;
create temporary table art194 (k text primary key, v uuid) on commit drop;
grant all on art194 to authenticated;

-- ① Mồi cả cây (vai postgres: RLS bỏ qua, auth.uid() null).
do $$ declare r bc194%rowtype; g uuid; ck uuid; th uuid; begin
  select * into r from bc194;
  if r.lop is null or r.gvcn is null or r.em1 is null or r.dv is null then
    raise exception 'Thiếu lớp Test / GVCN / học sinh / đơn vị lan — không chạy được bài kiểm.';
  end if;
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.cs, r.lop, r.gvcn, r.nam, 'ZZTEST194-muc-tieu', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 10, r.dv, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into g;
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id)
  values ('em', r.lop, r.gvcn, 'ZZTEST194-cam-ket', 4, r.dv, 1, vn_week_start(), g) returning id into ck;
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan,
                     ngay_ap_dung, chieu_dich, gop, ky_tuan, pham_vi, tu_tuan, cam_ket_id)
  values ('em', r.lop, r.gvcn, 'ZZTEST194-thuoc', 'cham', r.dv, 5, 1, array[1,2,3,4,5], 'it_nhat', 'tong', 1,
          'tung_em', vn_week_start(), ck) returning id into th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi) values (th, r.gvcn, vn_today(), 1, r.gvcn);
  insert into art194 values ('g', g), ('ck', ck), ('th', th);
  raise notice 'CA1 OK — mồi mục tiêu + cam kết + thước + lượt';
end $$;

-- ═══════════ Từ đây RLS THẬT (vai authenticated) ═══════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ③ Học sinh khác KHÔNG xoá được mục tiêu của GVCN (RLS): 0 dòng, và cây còn nguyên.
do $$ declare r bc194%rowtype; n int; begin
  select * into r from bc194;
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  delete from muc_tieu where id = (select v from art194 where k='g');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'CA3 HỎNG: học sinh khác xoá được mục tiêu của thầy cô!'; end if;
  -- Đếm bằng vai postgres: RLS cam_ket giấu hàng của thầy cô với em → đếm bằng vai em là báo sai oan.
  perform set_config('role', 'postgres', true);
  if not exists (select 1 from cam_ket where id = (select v from art194 where k='ck')) then
    raise exception 'CA3 HỎNG: cam kết bị dọn dù mục tiêu không xoá được';
  end if;
  raise notice 'CA3 OK — người khác không xoá được, cây còn nguyên';
end $$;

-- ② Chủ mục tiêu xoá → cả cây biến mất.
do $$ declare r bc194%rowtype; n int; begin
  select * into r from bc194;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  delete from muc_tieu where id = (select v from art194 where k='g');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'CA2 HỎNG: chủ mục tiêu không xoá được (row_count=%)', n; end if;
  perform set_config('role', 'postgres', true);
  if exists (select 1 from cam_ket where id = (select v from art194 where k='ck')) then raise exception 'CA2 HỎNG: cam kết còn'; end if;
  if exists (select 1 from thuoc where id = (select v from art194 where k='th')) then raise exception 'CA2 HỎNG: thước còn'; end if;
  if exists (select 1 from luot where thuoc_id = (select v from art194 where k='th')) then raise exception 'CA2 HỎNG: lượt còn'; end if;
  raise notice 'CA2 OK — xoá mục tiêu, cam kết + thước + lượt đi theo';
end $$;

rollback;
