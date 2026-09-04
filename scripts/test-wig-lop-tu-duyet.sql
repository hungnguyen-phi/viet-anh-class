-- KIỂM 0186 — GVCN tạo mục tiêu LỚP = hiệu lực ngay.
--
--   npm run sql -- scripts/test-wig-lop-tu-duyet.sql   (chạy SAU khi apply 0186)
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0186 thì chốt
-- chặn đỏ ngay (hai chiều đã thử 04/09: chưa vá → CA1 cũng đỏ vì trang_thai ra 'gui').
--
-- Ca kiểm:
--   ① GVCN tạo mục tiêu cap='lop' (vai authenticated, RLS thật) → trang_thai='duyet' ngay,
--      duyet_boi = chính GVCN.
--   ② HS KHÔNG tạo được mục tiêu lớp (RLS chặn như cũ).
--   ③ GVCN sửa NỘI DUNG mục tiêu lớp đã duyệt → KHÔNG rơi về 'gui' (v_duyet ∧ v_ghi giữ trạng thái).
--   ④ Trần 4 mục tiêu 'duyet'/chủ thể/năm vẫn chặn cái thứ 5.

begin;

-- ── CHỐT CHẶN: chưa vá 0186 thì dừng ngay ────────────────────────────────────────────────────
do $$
begin
  if (select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'duyet_duoc_chu_the') not like '%0186%' then
    raise exception 'CHUA VA 0186: duyet_duoc_chu_the chưa có vế GVCN tự duyệt mục tiêu lớp — chạy migration 0186 trước.';
  end if;
end $$;

-- Bối cảnh id thật của lớp Test.
create temporary table bc186 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  current_school_year()                                              nam,
  vn_today()                                                         bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 6, 30) kt,
  (select id from don_vi where lower(ma)='lan' limit 1)              dv
from t;
grant select on bc186 to authenticated;
create temporary table art186 (k text primary key, v uuid) on commit drop;
grant all on art186 to authenticated;

do $$ declare r bc186%rowtype; begin
  select * into r from bc186;
  if r.lop is null or r.gvcn is null or r.em1 is null or r.dv is null then
    raise exception 'Thiếu lớp Test / GVCN / học sinh / đơn vị lan — không chạy được bài kiểm.';
  end if;
end $$;

-- Dọn chỗ trước khi đếm trần: đóng tạm các mục tiêu lớp Test đang 'duyet' (trong giao dịch,
-- rollback trả lại) để bài kiểm tự chủ số đếm.
do $$ declare r bc186%rowtype; begin
  select * into r from bc186;
  update muc_tieu set trang_thai = 'dong', ly_do_dong = 'bo'
  where cap = 'lop' and class_id = r.lop and trang_thai = 'duyet';
end $$;

-- ═══════════ Từ đây RLS THẬT (vai authenticated) ═══════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ① GVCN tạo mục tiêu LỚP → tự duyệt ngay, chữ ký là chính GVCN.
do $$ declare r bc186%rowtype; v uuid; tt text; boi uuid; begin
  select * into r from bc186;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('lop', r.cs, r.lop, null, r.nam, 'ZZTEST186-wig-lop-1', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 50, r.dv, r.bd, r.kt, 'ghi_tay', 'gui')
  returning id, trang_thai, duyet_boi into v, tt, boi;
  if tt is distinct from 'duyet' then raise exception 'CA1 HỎNG: mong duyet ngay, ra %', tt; end if;
  if boi is distinct from r.gvcn then raise exception 'CA1 HỎNG: duyet_boi mong GVCN, ra %', boi; end if;
  insert into art186 values ('g1', v);
  raise notice 'CA1 OK — GVCN tạo mục tiêu lớp = hiệu lực ngay';
end $$;

-- ② HS KHÔNG tạo được mục tiêu lớp.
do $$ declare r bc186%rowtype; begin
  select * into r from bc186;
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  begin
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                          chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('lop', r.cs, r.lop, null, r.nam, 'ZZTEST186-hs-lop', 'knowledge', 'do_luong', 'toi',
            'tang', 0, 50, r.dv, r.bd, r.kt, 'ghi_tay', 'gui');
    raise exception 'CA2 HỎNG: học sinh tạo được mục tiêu lớp!';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'CA2 OK — học sinh bị chặn như cũ';
  end;
end $$;

-- ③ GVCN sửa nội dung mục tiêu lớp đã duyệt → giữ 'duyet'.
do $$ declare r bc186%rowtype; tt text; begin
  select * into r from bc186;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  update muc_tieu set ten = 'ZZTEST186-wig-lop-1-doi-ten'
  where id = (select v from art186 where k='g1')
  returning trang_thai into tt;
  if tt is distinct from 'duyet' then raise exception 'CA3 HỎNG: sửa nội dung mong giữ duyet, ra %', tt; end if;
  raise notice 'CA3 OK — GVCN sửa nội dung không rơi về gui';
end $$;

-- ④ Trần 4 'duyet'/chủ thể/năm: thêm 3 nữa (=4) rồi cái thứ 5 phải bị chặn.
do $$ declare r bc186%rowtype; i int; begin
  select * into r from bc186;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  for i in 2..4 loop
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                          chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('lop', r.cs, r.lop, null, r.nam, 'ZZTEST186-wig-lop-' || i, 'knowledge', 'do_luong', 'toi',
            'tang', 0, 50, r.dv, r.bd, r.kt, 'ghi_tay', 'gui');
  end loop;
  begin
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                          chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
    values ('lop', r.cs, r.lop, null, r.nam, 'ZZTEST186-wig-lop-5', 'knowledge', 'do_luong', 'toi',
            'tang', 0, 50, r.dv, r.bd, r.kt, 'ghi_tay', 'gui');
    raise exception 'CA4 HỎNG: cái thứ 5 vẫn lọt trần!';
  exception
    when check_violation then
      raise notice 'CA4 OK — trần 4 mục tiêu vẫn chặn';
  end;
end $$;

rollback;
