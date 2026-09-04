-- KIỂM 0187 — đợt sửa audit 04/09 (một file, hai chiều).
--
--   npm run sql -- scripts/test-0187-audit.sql   (chạy SAU khi apply 0187)
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0187 thì đỏ NGAY ở
-- ca ① (anon vẫn gọi được viec_bang → lỗ rò thật, không phải chốt giả).
--
-- Ca kiểm:
--   ① anon KHÔNG gọi được viec_bang / nguoi_duyet (lỗ rò CHẶN).          ② HS không gọi được lan_cam_ket_tuan.
--   ③ pg_default_acl hàm public không còn anon/authenticated; 0 hàm public anon gọi được.
--   ④ bang_lop_em (1 viec_bang/em) = đếm thẳng từng em.                    ⑤ thi_dua_lop (đệm) = thi_dua_ba_so tính thẳng, gọi 2 lần như nhau.
--   ⑥ co_so_tong_hop (admin) khớp thi_dua_ba_so cho lớp Test.             ⑦ RPC mảng = gọi từng cái.
--   ⑧ bo_dau + cột full_name_khong_dau + index trigram.                    ⑨ BGH đọc được em trong cơ sở; đổi cơ sở thì không.
--   ⑩ unique mục tiêu lớp chặn tên trùng (23505).                         ⑪ lac_muc_tieu = (muc_tieu_id is null).
--   ⑫ dọn nền: publication, trigger hub tắt, thông báo cũ = 0, thước lớp cũ đóng, cron + bảng đệm có.

begin;

-- Bối cảnh id thật (lớp Test).
create temporary table bc187 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  (select id from profiles where email like 'test2.bgh@%' limit 1)                     bgh,
  (select id from profiles where email like 'test3.admin@%' limit 1)                   adm,
  (select id from campuses where id <> t.cs limit 1)                                   cs_khac,
  current_school_year()                                                                nam,
  vn_today()                                                                           bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 6, 30)                   kt,
  (select id from don_vi where lower(ma)='lan' limit 1)                                dv
from t;
grant select on bc187 to public;

do $$ declare r bc187%rowtype; begin
  select * into r from bc187;
  if r.lop is null or r.gvcn is null or r.em1 is null or r.bgh is null or r.adm is null or r.dv is null then
    raise exception 'Thiếu lớp Test / GVCN / học sinh / BGH test2 / admin test3 / đơn vị lan — không chạy được bài kiểm.';
  end if;
end $$;

-- ① ANON — chốt chặn thật: chưa áp 0187 thì anon vẫn thấy dòng → đỏ ngay đây.
do $$ declare r bc187%rowtype; n int; begin
  select * into r from bc187;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  begin
    select count(*) into n from public.viec_bang(r.em1);
    if n > 0 then raise exception 'CHUA VA 0187 / LỖ RÒ: anon gọi viec_bang ra % dòng dữ liệu học sinh', n; end if;
  exception when insufficient_privilege then null;   -- đúng ý: bị chặn
  end;
  begin
    select count(*) into n from public.nguoi_duyet();
    if n > 0 then raise exception 'LỖ RÒ: anon gọi nguoi_duyet ra % dòng tên/email admin', n; end if;
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);
end $$;

-- Không gọi được hàm nào nữa: đếm hàm public mà anon còn EXECUTE.
do $$ declare n int; begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'anon còn EXECUTE được % hàm public', n; end if;
end $$;

-- ② HỌC SINH gọi lan_cam_ket_tuan (ghi hàng loạt) → phải bị chặn.
do $$ declare r bc187%rowtype; ok boolean := false; begin
  select * into r from bc187;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  begin
    perform public.lan_cam_ket_tuan();
  exception when insufficient_privilege then ok := true;
  end;
  perform set_config('role', 'none', true);
  if not ok then raise exception 'Học sinh vẫn gọi được lan_cam_ket_tuan()'; end if;
end $$;

-- ③ ACL mặc định của hàm public: không còn anon/authenticated.
do $$ declare a aclitem[]; begin
  select defaclacl into a from pg_default_acl
  where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f';
  if a::text ~ '(anon|authenticated)=' then raise exception 'pg_default_acl hàm public vẫn cấp cho anon/authenticated: %', a; end if;
end $$;

-- ═══════════ Từ đây RLS THẬT (vai authenticated) ═══════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ④ bang_lop_em (GVCN) = đếm thẳng từng em qua viec_bang.
do $$ declare r bc187%rowtype; x record; t1 int; t2 int; k int := 0; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  for x in select * from public.bang_lop_em(r.lop) loop
    k := k + 1;
    select count(*) filter (where vb.chi_xem = false), count(*) filter (where vb.trang_thai in ('dat','dang_thang','dang_giu'))
      into t1, t2 from public.viec_bang(x.student_id) vb;
    if x.thuoc_tong is distinct from t1 or x.thuoc_dat is distinct from t2 then
      raise exception 'bang_lop_em lệch viec_bang cho em %: (%, %) vs (%, %)', x.student_id, x.thuoc_tong, x.thuoc_dat, t1, t2;
    end if;
  end loop;
  if k = 0 then raise exception 'bang_lop_em trả 0 dòng cho lớp Test'; end if;
end $$;

-- ⑤ thi_dua_lop (đệm) = thi_dua_ba_so tính thẳng; gọi lần hai (đệm nóng) vẫn y hệt.
do $$ declare r bc187%rowtype; a record; b record; c record; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  select * into a from public.thi_dua_lop(r.lop);
  select * into b from public.thi_dua_lop(r.lop);
  perform set_config('role', 'none', true);
  select * into c from private.thi_dua_ba_so(r.lop);
  if not exists (select 1 from private.diem_tuan_cache where class_id = r.lop) then raise exception 'diem_tuan_cache chưa được ghi sau thi_dua_lop'; end if;
  perform set_config('role', 'authenticated', true);
  if (a.diem_muc_tieu, a.diem_thuoc, a.diem_cam_ket) is distinct from (c.diem_muc_tieu, c.diem_thuoc, c.diem_cam_ket) then
    raise exception 'thi_dua_lop (đệm) % lệch thi_dua_ba_so %', row(a.*), row(c.*);
  end if;
  if (a.*) is distinct from (b.*) then raise exception 'thi_dua_lop gọi hai lần ra hai kết quả: % vs %', row(a.*), row(b.*); end if;
end $$;

-- ⑥ co_so_tong_hop (admin) có lớp Test và khớp thi_dua_ba_so.
do $$ declare r bc187%rowtype; x record; c record; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.adm::text)::text, true);
  select * into x from public.co_so_tong_hop() h where h.class_id = r.lop;
  if x.class_id is null then raise exception 'co_so_tong_hop không có lớp Test'; end if;
  perform set_config('role', 'none', true);
  select * into c from private.thi_dua_ba_so(r.lop);
  perform set_config('role', 'authenticated', true);
  if x.thuoc_dat_pct is distinct from c.diem_thuoc or x.ck_giu_pct is distinct from c.diem_cam_ket or x.mt_pct is distinct from c.diem_muc_tieu then
    raise exception 'co_so_tong_hop (%, %, %) lệch thi_dua_ba_so (%, %, %)', x.mt_pct, x.thuoc_dat_pct, x.ck_giu_pct, c.diem_muc_tieu, c.diem_thuoc, c.diem_cam_ket;
  end if;
end $$;

-- ⑦ RPC mảng = gọi từng cái (GVCN, mục tiêu lớp Test + thước của chính GVCN).
do $$ declare r bc187%rowtype; ids uuid[]; n1 int; n2 int; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  select array_agg(id) into ids from muc_tieu where cap = 'lop' and class_id = r.lop and trang_thai = 'duyet';
  if ids is not null then
    select count(*) into n1 from public.muc_tieu_lich_su_tuan_nhieu(ids) m;
    select count(*) into n2 from unnest(ids) u cross join lateral public.muc_tieu_lich_su_tuan(u) l;
    if n1 <> n2 or n1 = 0 then raise exception 'muc_tieu_lich_su_tuan_nhieu ra % dòng, gọi lẻ ra %', n1, n2; end if;
    if exists (
      select 1 from public.muc_tieu_lich_su_tuan_nhieu(ids) m
      full join (select u as muc_tieu_id, l.* from unnest(ids) u cross join lateral public.muc_tieu_lich_su_tuan(u) l) s
        on s.muc_tieu_id = m.muc_tieu_id and s.tuan_ket = m.tuan_ket and s.so is not distinct from m.so
      where s.muc_tieu_id is null or m.muc_tieu_id is null)
    then raise exception 'muc_tieu_lich_su_tuan_nhieu lệch bản gọi lẻ'; end if;
  end if;
  select array_agg(id) into ids from thuoc where chu_the = 'em' and student_id = r.gvcn and trang_thai <> 'dong';
  if ids is not null then
    select count(*) into n1 from public.thuoc_12_tuan_nhieu(ids, r.gvcn) t;
    select count(*) into n2 from unnest(ids) u cross join lateral public.thuoc_12_tuan(u, r.gvcn) l;
    if n1 <> n2 or n1 = 0 then raise exception 'thuoc_12_tuan_nhieu ra % dòng, gọi lẻ ra %', n1, n2; end if;
  end if;
end $$;

-- ⑧ bỏ dấu.
do $$ begin
  if public.bo_dau('Nguyễn Hùng Đạt') <> 'nguyen hung dat' then raise exception 'bo_dau sai: %', public.bo_dau('Nguyễn Hùng Đạt'); end if;
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'full_name_khong_dau') then raise exception 'thiếu cột profiles.full_name_khong_dau'; end if;
  if not exists (select 1 from pg_indexes where indexname = 'idx_profiles_ten_khong_dau_trgm') then raise exception 'thiếu index trigram'; end if;
end $$;

-- ⑨ BGH đọc em trong cơ sở; đổi cơ sở thì không.
do $$ declare r bc187%rowtype; n int; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.bgh::text)::text, true);
  if not coalesce(public.can_view_student(r.em1), false) then raise exception 'BGH cùng cơ sở không xem được em'; end if;
  select count(*) into n from muc_tieu where student_id = r.em1;   -- RLS thật, không được lỗi
  if r.cs_khac is not null then
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', json_build_object('sub', r.adm::text)::text, true);
    update profiles set campus_id = r.cs_khac where id = r.bgh;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', r.bgh::text)::text, true);
    if coalesce(public.can_view_student(r.em1), false) then raise exception 'BGH cơ sở KHÁC vẫn xem được em'; end if;
  end if;
end $$;

-- ⑩ unique mục tiêu lớp.
do $$ declare r bc187%rowtype; v_ten text; ok boolean := false; begin
  select * into r from bc187;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  select ten into v_ten from muc_tieu where cap = 'lop' and class_id = r.lop and trang_thai <> 'dong' limit 1;
  if v_ten is null then
    v_ten := 'KIEM0187 lớp đọc 9 lần';
    insert into muc_tieu (cap, campus_id, class_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich, chieu, don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so)
    values ('lop', r.cs, r.lop, r.nam, v_ten, 'knowledge', 'do_luong', 'toi', 'tang', r.dv, 0, 9, r.bd, r.kt, 'ghi_tay');
  end if;
  begin
    insert into muc_tieu (cap, campus_id, class_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich, chieu, don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so)
    values ('lop', r.cs, r.lop, r.nam, upper(v_ten), 'knowledge', 'do_luong', 'toi', 'tang', r.dv, 0, 9, r.bd, r.kt, 'ghi_tay');
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'Mục tiêu lớp trùng tên (chỉ khác hoa/thường) vẫn tạo được'; end if;
end $$;

-- ⑪ lac_muc_tieu theo muc_tieu_id.
do $$ declare r bc187%rowtype; v_lac boolean; v_mt uuid; begin
  select * into r from bc187;
  perform set_config('role', 'none', true);
  -- dọn trần 2/tuần: HUỶ (không delete — xoá cascade sang thước có lượt bị th_truoc_xoa chặn)
  update cam_ket set trang_thai = 'huy' where chu_the = 'em' and student_id = r.gvcn and trang_thai = 'hieu_luc';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_tuan, tuan_bat_dau)
  values ('em', r.lop, r.gvcn, 'KIEM0187 hứa suông', 1, vn_week_start(r.bd)) returning lac_muc_tieu into v_lac;
  if v_lac is not true then raise exception 'cam kết không mục tiêu phải lac_muc_tieu = true'; end if;
  select id into v_mt from muc_tieu where cap = 'em' and student_id = r.gvcn and trang_thai = 'duyet' limit 1;
  if v_mt is not null then
    insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_tuan, tuan_bat_dau, muc_tieu_id)
    values ('em', r.lop, r.gvcn, 'KIEM0187 hứa có đích', 1, vn_week_start(r.bd), v_mt) returning lac_muc_tieu into v_lac;
    if v_lac is not false then raise exception 'cam kết có mục tiêu phải lac_muc_tieu = false'; end if;
  end if;
end $$;

-- ⑫ dọn nền.
do $$ begin
  perform set_config('role', 'none', true);
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'parent_teacher_messages') then raise exception 'parent_teacher_messages vẫn trong publication'; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'attendance_records') then raise exception 'attendance_records BỊ RỚT khỏi publication — AttendanceTable cần realtime!'; end if;
  if (select tgenabled from pg_trigger where tgname = 'trg_hub_hang_doi_luot') <> 'D' then raise exception 'trigger hub chưa tắt'; end if;
  if exists (select 1 from notifications where title ~ '^(Cô đã ghi biên bản họp WIG|Có biên bản họp WIG|Buddy nhắn bạn)') then raise exception 'thông báo cũ còn'; end if;
  if exists (select 1 from thuoc where chu_the = 'lop' and pham_vi = 'ca_doi' and trang_thai <> 'dong') then raise exception 'thước lớp cũ chưa đóng'; end if;
  if not exists (select 1 from cron.job where jobname = 'tinh-diem-tuan') then raise exception 'thiếu cron tinh-diem-tuan'; end if;
  if not exists (select 1 from pg_tables where schemaname = 'private' and tablename = 'diem_tuan_cache') then raise exception 'thiếu bảng đệm'; end if;
  if (select prosecdef from pg_proc where proname = 'cam_ket_v') is not null then null; end if;
  if (select reloptions::text from pg_class where oid = 'public.cam_ket_v'::regclass) !~ 'security_invoker=true' then raise exception 'cam_ket_v MẤT security_invoker — lỗ rò 18/08 quay lại'; end if;
end $$;

rollback;
