-- KIỂM 0184 — SỬA/XOÁ thước đo dẫn dắt CÁ NHÂN của GVCN.
--
--   npm run sql -- scripts/test-sua-xoa-thuoc-gvcn.sql   (chạy SAU khi apply 0184)
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0184 thì chốt
-- chặn đỏ ngay (đã thử hai chiều 03/09: trước vá ① và ② đỏ đúng chỗ).
--
-- Ca kiểm:
--   ① GVCN SỬA tên thước cá nhân (da_tung_duyet=true vì 0181 tự duyệt) → 0184 mở, OK.
--   ② GVCN XOÁ thước cá nhân chưa có lượt → RLS mới cho, OK.
--   ③ Thước CỦA EM đã từng duyệt: em sửa nội dung vẫn BỊ đông cứng; em xoá vẫn BỊ chặn (luật cũ giữ).
--   ④ Thước GVCN ĐÃ CÓ LƯỢT: xoá bị th_truoc_xoa chặn ("kết thúc thay vì xoá") — vẫn giữ.
--   ⑤ Thước GVCN đã có lượt: đổi ĐƠN VỊ/cách đo bị th_truoc_sua chặn; đổi TÊN + NGÀY vẫn OK.

begin;

-- ── CHỐT CHẶN: chưa vá 0184 thì dừng ngay (policy delete chưa có vế is_class_teacher) ─────────
do $$
declare v_expr text;
begin
  select pg_get_expr(polqual, polrelid) into v_expr
  from pg_policy where polrelid = 'public.thuoc'::regclass and polname = 'rls_delete_thuoc';
  if v_expr is null or position('is_class_teacher' in v_expr) = 0 then
    raise exception 'CHUA VA 0184: rls_delete_thuoc chưa có vế chính-chủ-GVCN — chạy migration 0184 trước.';
  end if;
end $$;

create temporary table bc184 on commit drop as
with t as (select id lop, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  (select id from don_vi where lower(ma)='lan'  limit 1) dv,
  (select id from don_vi where lower(ma)='diem' limit 1) dv2,
  vn_week_start() t2
from t;
grant select on bc184 to authenticated;
create temporary table art184 (k text primary key, v uuid) on commit drop;
grant all on art184 to authenticated;

do $$ declare r bc184%rowtype; begin
  select * into r from bc184;
  if r.lop is null or r.gvcn is null or r.em1 is null or r.dv is null or r.dv2 is null then
    raise exception 'Thiếu lớp Test / GVCN / học sinh / đơn vị lan+diem — không chạy được bài kiểm.';
  end if;
end $$;

-- Mồi (vai postgres, auth.uid() null → th_truoc_them L6 giữ nguyên giá trị insert):
-- · thước EM đã-từng-duyệt (③) · thước GVCN có lượt (④⑤).
-- Dọn cam kết THẬT của GVCN trong tuần (trần 2/tuần sẽ cắn ca ⑥⑦) — rollback trả lại nguyên vẹn.
do $$ declare r bc184%rowtype; v uuid; begin
  select * into r from bc184;
  delete from cam_ket_xac_nhan where cam_ket_id in (select id from cam_ket where student_id = r.gvcn);
  delete from cam_ket where student_id = r.gvcn;
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan,
                     ky_tuan, pham_vi, ngay_ap_dung, tu_tuan, trang_thai, duyet, da_tung_duyet)
  values ('em', r.lop, r.em1, 'ZZTEST184-thuoc-em', 'cham', r.dv, 5, 1,
          1, 'tung_em', '{1,2,3,4,5}', r.t2, 'chay', 'duyet', true) returning id into v;
  insert into art184 values ('th_em', v);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan,
                     ky_tuan, pham_vi, ngay_ap_dung, tu_tuan, trang_thai, duyet, da_tung_duyet)
  values ('em', r.lop, r.gvcn, 'ZZTEST184-thuoc-gvcn-luot', 'cham', r.dv, 5, 1,
          1, 'tung_em', '{1,2,3,4,5}', r.t2, 'chay', 'duyet', true) returning id into v;
  insert into art184 values ('th_gv_luot', v);
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon)
  values (v, r.gvcn, r.t2, 1, 'tay');
end $$;

-- ═══════════ Từ đây RLS THẬT (vai authenticated) ═══════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- GVCN tạo thước cá nhân qua đường THẬT (đường 0181: tự duyet='duyet', da_tung_duyet=true).
do $$ declare r bc184%rowtype; v uuid; d text; dtd boolean; begin
  select * into r from bc184;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan,
                     ky_tuan, pham_vi, ngay_ap_dung, tu_tuan)
  values ('em', r.lop, r.gvcn, 'ZZTEST184-thuoc-gvcn', 'cham', r.dv, 3, 1,
          1, 'tung_em', '{1,3,5}', r.t2) returning id into v;
  insert into art184 values ('th_gv', v);
  select duyet, da_tung_duyet into d, dtd from thuoc where id = v;
  if d <> 'duyet' or not dtd then
    raise exception 'MOI HONG: thước GVCN phải tự duyệt (duyet=%, da_tung_duyet=%)', d, dtd;
  end if;
end $$;

-- ① GVCN SỬA thước cá nhân (tên + ngày) dù da_tung_duyet=true → 0184 mở đông cứng chính chủ.
do $$ declare r bc184%rowtype; v uuid; n int; begin
  select * into r from bc184;
  select a.v into v from art184 a where k='th_gv';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  update thuoc set ten = 'ZZTEST184-thuoc-gvcn-sua', ngay_ap_dung = '{2,4}', chi_tieu_ky = 2 where id = v;
  select count(*) into n from thuoc where id = v and ten = 'ZZTEST184-thuoc-gvcn-sua';
  if n <> 1 then raise exception 'CA1 HONG: GVCN không sửa được thước cá nhân của mình'; end if;
end $$;

-- ② GVCN XOÁ thước cá nhân chưa có lượt → RLS mới cho qua.
do $$ declare r bc184%rowtype; v uuid; n int; begin
  select * into r from bc184;
  select a.v into v from art184 a where k='th_gv';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  delete from thuoc where id = v;
  select count(*) into n from thuoc where id = v;
  if n <> 0 then raise exception 'CA2 HONG: GVCN không xoá được thước cá nhân chưa có lượt'; end if;
end $$;

-- ③ Của EM đã-từng-duyệt: em sửa nội dung phải BỊ chặn (đông cứng giữ nguyên); xoá phải 0 dòng.
do $$ declare r bc184%rowtype; v uuid; n int; begin
  select * into r from bc184;
  select a.v into v from art184 a where k='th_em';
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  begin
    update thuoc set ten = 'ZZTEST184-doi-ten' where id = v;
    raise exception 'CA3 HONG: em sửa được thước đã-từng-duyệt (đông cứng phải giữ)';
  exception when others then
    if sqlerrm like 'CA3 HONG%' then raise; end if;   -- chặn đúng: nuốt lỗi 42501 của trigger
  end;
  delete from thuoc where id = v;
  select count(*) into n from thuoc where id = v;
  if n <> 1 then raise exception 'CA3 HONG: em xoá được thước đã-từng-duyệt'; end if;
end $$;

-- ④ Thước GVCN ĐÃ CÓ LƯỢT: xoá phải bị th_truoc_xoa chặn.
do $$ declare r bc184%rowtype; v uuid; begin
  select * into r from bc184;
  select a.v into v from art184 a where k='th_gv_luot';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  begin
    delete from thuoc where id = v;
    raise exception 'CA4 HONG: xoá được thước đã có lượt (phải kết thúc thay vì xoá)';
  exception when others then
    if sqlerrm like 'CA4 HONG%' then raise; end if;
  end;
end $$;

-- ⑤ Thước GVCN đã có lượt: đổi ĐƠN VỊ bị chặn; đổi TÊN + NGÀY vẫn OK.
do $$ declare r bc184%rowtype; v uuid; n int; begin
  select * into r from bc184;
  select a.v into v from art184 a where k='th_gv_luot';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  begin
    update thuoc set don_vi_id = r.dv2, cach_ghi = 'dien_so', moi_lan = null where id = v;
    raise exception 'CA5 HONG: đổi được đơn vị/cách đo khi đã có lượt';
  exception when others then
    if sqlerrm like 'CA5 HONG%' then raise; end if;
  end;
  update thuoc set ten = 'ZZTEST184-doi-ten-ok', ngay_ap_dung = '{1,2,3}', chi_tieu_ky = 3 where id = v;
  select count(*) into n from thuoc where id = v and ten = 'ZZTEST184-doi-ten-ok';
  if n <> 1 then raise exception 'CA5 HONG: không đổi được tên/ngày dù được phép'; end if;
end $$;

-- ⑥⑦ VÁ KÈM 0184 (lỗ cột GENERATED của ck_truoc_sua): chấm xong phải BỎ CHẤM được và SỬA SỐ ĐẠT
--    được trên dòng đã chấm (trước vá: "Cam kết đã chấm rồi" chặn oan mọi update).
do $$ declare r bc184%rowtype; v uuid; kq text; sd numeric; begin
  select * into r from bc184;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau)
  values ('em', r.lop, r.gvcn, 'ZZTEST184-camket', 3, r.dv, 1, r.t2) returning id into v;
  update cam_ket set ket_qua = 'thua', so_dat = 2 where id = v;              -- chấm
  update cam_ket set so_dat = 3 where id = v;                                -- ⑦ sửa số trên dòng đã chấm
  select so_dat into sd from cam_ket where id = v;
  if sd is distinct from 3 then raise exception 'CA7 HONG: không sửa được số đạt trên dòng đã chấm (so_dat=%)', sd; end if;
  update cam_ket set ket_qua = null, so_dat = null where id = v;             -- ⑥ bỏ chấm
  select ket_qua into kq from cam_ket where id = v;
  if kq is not null then raise exception 'CA6 HONG: không bỏ chấm được (ket_qua=%)', kq; end if;
end $$;

rollback;
