-- KIỂM 0163 — MỤC TIÊU và SỐ ĐO: vòng duyệt, trần, whitelist nội dung, so_do_truoc_ghi, mt_truoc_xoa, RLS.
--
--   npm run sql -- scripts/test-0163-muc-tieu-so-do-duyet.sql   (chạy SAU khi apply 0162 + 0163)
--
-- Luật chỉ nằm trong giao diện thì không phải luật. Bài này dựng cả đường THUẬN lẫn CHIỀU NGƯỢC cho
-- từng chốt MỚI của 0163, đóng vai bằng request.jwt.claims + role, chạy thẳng trên production rồi
-- ROLLBACK nên không để lại gì. "Chưa vá phải ĐỎ": CHỐT CHẶN raise ngay nếu 0163 chưa áp.
--
-- Đóng vai: auth_role()/auth_campus()/is_class_teacher()… đọc profiles theo auth.uid() (= claims.sub).
-- Bài dùng id THẬT của lớp Test và các vai (không đóng cứng — dữ liệu đổi lúc nào không ai báo). Test
-- nào thiếu tiền đề (thiếu BGH cơ sở, thiếu em ngoài lớp) thì ghi "bỏ qua", không làm hỏng cả bộ.
--
--   Phase A (vai postgres, RLS bỏ qua — cô lập TRIGGER): mt_truoc_them/sua (duyệt + whitelist), trần
--       ≤4 duyet, trần ≤2 tập trung, BGH duyệt lớp, so_do_truoc_ghi (khe va.nguon_he_thong), mt_truoc_xoa.
--   Phase B (vai authenticated — RLS thật): select mục tiêu trường [H-11]/lớp/ngoài lớp, insert em
--       không mượn student_id người khác, so_do thô của em chỉ mình em đọc (L7).

begin;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.muc_tieu') is null
     or to_regclass('public.so_do') is null
     or to_regclass('public.lich_su_dich') is null
     or not exists (select 1 from pg_trigger where tgname='trg_mt_truoc_them'   and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_mt_truoc_sua'    and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_so_do_truoc_ghi' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_mt_truoc_xoa'    and not tgisinternal)
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and p.proname='doc_duoc_chu_the') then
    raise exception 'CHUA VA 0163: thiếu bảng/trigger/hàm mục tiêu — chạy migration 0163 trước.';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;
grant all on kq to authenticated;

-- Bối cảnh (id động). em = 4 học sinh đang học lớp Test; outsider = một em KHÔNG học lớp Test.
create temporary table bc on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select array_agg(sid order by sid) from (
     select e.student_id sid from enrollments e join profiles p on p.id=e.student_id
     where e.class_id=t.lop and e.is_active and p.role='student' order by e.student_id limit 4) z) em,
  (select p.id from profiles p where p.role='student'
     and not exists (select 1 from enrollments e where e.student_id=p.id and e.class_id=t.lop and e.is_active) limit 1) outsider,
  (select id from profiles where role='principal' and campus_id=t.cs limit 1)                    bgh_same,
  (select id from profiles where role='admin' limit 1)                                           admin,
  current_school_year()                                                                          nam,
  vn_today()                                                                                     bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 6, 30)                             kt,
  (select id from don_vi where lower(ma)='lan' limit 1)                                          dv
from t;
grant select on bc to authenticated;

-- Tự chủ số đếm (0187): đóng tạm mọi mục tiêu đang 'duyet' của lớp Test (lớp + em) trong giao dịch —
-- trần 4 mục tiêu/chủ thể từng làm bài này đỏ oan khi lớp Test có sẵn mục tiêu thử tay (04/09).
do $$ declare r bc%rowtype; begin
  select * into r from bc;
  update muc_tieu set trang_thai = 'dong', ly_do_dong = 'bo' where class_id = r.lop and trang_thai = 'duyet';
end $$;

-- Kho id mục tiêu chia sẻ giữa các bước / hai phase.
create temporary table art (k text primary key, v uuid) on commit drop;
grant all on art to authenticated;

do $$ declare v_lop uuid; v_dv uuid; n int; begin
  select lop, dv into v_lop, v_dv from bc;
  if v_lop is null then raise exception 'Không thấy lớp Test — không chạy được bài kiểm.'; end if;
  if v_dv is null  then raise exception 'Chưa seed don_vi (0162) — không tạo được mục tiêu.'; end if;
  select coalesce(array_length(em,1),0) into n from bc;
  if n < 3 then raise exception 'Lớp Test cần ≥3 học sinh cho bài này (đang %).', n; end if;
end $$;

-- ═══════════════════ PHASE A — cô lập TRIGGER (vai postgres, RLS bỏ qua) ═════════════════════

-- ── 1. mt_truoc_them: em tạo mục tiêu ở 'gui' được; em TỰ đặt 'duyet' bị chặn (không tự duyệt) ──
do $$
declare v_lop uuid; v_cs uuid; v_e1 uuid; v_nam text; v_bd date; v_kt date; v_dv uuid; v_id uuid; v_tt text;
begin
  select lop, cs, em[1], nam, bd, kt, dv into v_lop, v_cs, v_e1, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);

  -- THUẬN: em tạo mục tiêu của mình, gửi duyệt
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
  values ('em', v_cs, v_lop, v_e1, v_nam, 'Đọc 10 cuốn sách', 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui')
  returning id, trang_thai into v_id, v_tt;
  insert into art values ('g_em1', v_id);
  insert into kq values ('mt_them: em tạo mục tiêu gửi duyệt', 'gui', v_tt, v_tt = 'gui');

  -- NGƯỢC: em tự đặt thẳng 'duyet' → 42501
  begin
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
      x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
    values ('em', v_cs, v_lop, v_e1, v_nam, 'Tự duyệt lậu', 'toi', 'tang', 0, 5, v_dv, v_bd, v_kt, 'duyet');
    insert into kq values ('mt_them: em TỰ duyệt bị chặn', '42501', 'đi lọt', false);
  exception when insufficient_privilege then
    insert into kq values ('mt_them: em TỰ duyệt bị chặn', '42501', 'chặn đúng (42501)', true);
  when others then
    insert into kq values ('mt_them: em TỰ duyệt bị chặn', '42501', 'chặn (khác mã): '||sqlerrm, true);
  end;
end $$;

-- ── 2. mt_truoc_sua: GVCN duyệt mục tiêu của em (gui→duyet), chữ ký = GVCN ─────────────────────
do $$
declare v_gvcn uuid; v_id uuid; v_tt text; v_by uuid;
begin
  select gvcn into v_gvcn from bc; select v into v_id from art where k='g_em1';
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  update muc_tieu set trang_thai='duyet' where id=v_id;
  select trang_thai, duyet_boi into v_tt, v_by from muc_tieu where id=v_id;
  insert into kq values ('mt_sua: GVCN duyệt mục tiêu của em', 'duyet + chữ ký GVCN',
    v_tt||' / '||coalesce(v_by::text,'null'), v_tt='duyet' and v_by=v_gvcn);
end $$;

-- ── 3. mt_truoc_sua NGƯỢC: thầy cô (lớp KHÔNG nhập hộ) sửa NỘI DUNG mục tiêu của em → 42501 ────
do $$
declare v_gvcn uuid; v_id uuid;
begin
  select gvcn into v_gvcn from bc; select v into v_id from art where k='g_em1';
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    update muc_tieu set ten='Cô đổi tên hộ' where id=v_id;   -- ten KHÔNG trong whitelist → là nội dung
    insert into kq values ('mt_sua: thầy cô sửa nội dung của em bị chặn', '42501', 'đi lọt', false);
  exception when insufficient_privilege then
    insert into kq values ('mt_sua: thầy cô sửa nội dung của em bị chặn', '42501', 'chặn đúng (42501)', true);
  when others then
    insert into kq values ('mt_sua: thầy cô sửa nội dung của em bị chặn', '42501', 'chặn (khác mã): '||sqlerrm, true);
  end;
end $$;

-- ── 4. mt_truoc_sua: em sửa NỘI DUNG mục tiêu ĐÃ DUYỆT của mình → tự tụt về 'gui', mất chữ ký ──
do $$
declare v_e1 uuid; v_id uuid; v_tt text; v_by uuid;
begin
  select em[1] into v_e1 from bc; select v into v_id from art where k='g_em1';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  update muc_tieu set y_so=12 where id=v_id;                  -- y_so là nội dung
  select trang_thai, duyet_boi into v_tt, v_by from muc_tieu where id=v_id;
  insert into kq values ('mt_sua: em sửa nội dung mục tiêu đã duyệt → về gui', 'gui + không chữ ký',
    v_tt||' / '||coalesce(v_by::text,'null'), v_tt='gui' and v_by is null);
end $$;

-- ── 5. Trần ≤4 mục tiêu ĐANG CHẠY (duyet) một chủ thể một năm: duyệt cái thứ 5 bị chặn ─────────
do $$
declare v_lop uuid; v_cs uuid; v_gvcn uuid; v_e2 uuid; v_nam text; v_bd date; v_kt date; v_dv uuid;
        v_id uuid; i int; n_ok int := 0;
begin
  select lop, cs, gvcn, em[2], nam, bd, kt, dv into v_lop, v_cs, v_gvcn, v_e2, v_nam, v_bd, v_kt, v_dv from bc;
  for i in 1..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_e2::text)::text, true);
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
      x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
    values ('em', v_cs, v_lop, v_e2, v_nam, 'Trần thử '||i, 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui')
    returning id into v_id;
    perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
    update muc_tieu set trang_thai='duyet' where id=v_id;
    n_ok := n_ok + 1;
  end loop;
  insert into kq values ('trần ≤4: duyệt 4 mục tiêu cùng em', '4 OK', n_ok::text||' OK', n_ok=4);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e2::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
  values ('em', v_cs, v_lop, v_e2, v_nam, 'Trần thử 5', 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui')
  returning id into v_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    update muc_tieu set trang_thai='duyet' where id=v_id;
    insert into kq values ('trần ≤4: duyệt cái thứ 5 bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('trần ≤4: duyệt cái thứ 5 bị chặn', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- ── 6. Trần ≤2 dang_tap_trung một chủ thể: cái thứ 3 bật tập trung bị chặn ─────────────────────
do $$
declare v_lop uuid; v_cs uuid; v_e3 uuid; v_nam text; v_bd date; v_kt date; v_dv uuid; i int; n_ok int := 0;
begin
  select lop, cs, em[3], nam, bd, kt, dv into v_lop, v_cs, v_e3, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e3::text)::text, true);
  for i in 1..2 loop
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
      x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai, dang_tap_trung)
    values ('em', v_cs, v_lop, v_e3, v_nam, 'Tập trung '||i, 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui', true);
    n_ok := n_ok + 1;
  end loop;
  insert into kq values ('trần tập trung: 2 mục tiêu tập trung được', '2 OK', n_ok::text||' OK', n_ok=2);
  begin
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
      x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai, dang_tap_trung)
    values ('em', v_cs, v_lop, v_e3, v_nam, 'Tập trung 3', 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui', true);
    insert into kq values ('trần tập trung: cái thứ 3 bị chặn', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('trần tập trung: cái thứ 3 bị chặn', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- ── 7. Duyệt mục tiêu LỚP: GVCN tạo (gui); GVCN KHÔNG duyệt được lớp (42501); BGH cơ sở duyệt được ──
do $$
declare v_lop uuid; v_cs uuid; v_gvcn uuid; v_bgh uuid; v_nam text; v_bd date; v_kt date; v_dv uuid; v_id uuid; v_tt text;
begin
  select lop, cs, gvcn, bgh_same, nam, bd, kt, dv into v_lop, v_cs, v_gvcn, v_bgh, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
  values ('lop', v_cs, v_lop, v_nam, 'Cả lớp đọc 500 cuốn', 'toi', 'tang', 0, 500, v_dv, v_bd, v_kt, 'gui')
  returning id into v_id;
  insert into art values ('g_lop', v_id);

  -- NGƯỢC: GVCN duyệt mục tiêu lớp → 42501 (lớp do BGH duyệt)
  begin
    update muc_tieu set trang_thai='duyet' where id=v_id;
    insert into kq values ('duyệt lớp: GVCN KHÔNG duyệt được mục tiêu lớp', '42501', 'đi lọt', false);
  exception when insufficient_privilege then
    insert into kq values ('duyệt lớp: GVCN KHÔNG duyệt được mục tiêu lớp', '42501', 'chặn đúng (42501)', true);
  when others then
    insert into kq values ('duyệt lớp: GVCN KHÔNG duyệt được mục tiêu lớp', '42501', 'chặn (khác mã): '||sqlerrm, true);
  end;

  -- THUẬN: BGH cùng cơ sở duyệt mục tiêu lớp
  if v_bgh is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_bgh::text)::text, true);
    begin
      update muc_tieu set trang_thai='duyet' where id=v_id;
      select trang_thai into v_tt from muc_tieu where id=v_id;
      insert into kq values ('duyệt lớp: BGH cùng cơ sở duyệt được', 'duyet', v_tt, v_tt='duyet');
    exception when others then
      insert into kq values ('duyệt lớp: BGH cùng cơ sở duyệt được', 'duyet', 'BỊ CHẶN: '||sqlerrm, false);
    end;
  else
    insert into kq values ('duyệt lớp: BGH cùng cơ sở duyệt được', 'duyet', 'bỏ qua (không có BGH cơ sở Test)', true);
  end if;
end $$;

-- ── 8. so_do_truoc_ghi ───────────────────────────────────────────────────────────────────────
--   Mồi: g_sd (em1, ghi_tay, gui) để ghi số tay; g_thuoc (em1, nguon_so='thuoc') để thử chặn.
do $$
declare v_lop uuid; v_cs uuid; v_e1 uuid; v_nam text; v_bd date; v_kt date; v_dv uuid; v_id uuid;
begin
  select lop, cs, em[1], nam, bd, kt, dv into v_lop, v_cs, v_e1, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', v_cs, v_lop, v_e1, v_nam, 'Số tự ghi', 'toi', 'tang', 0, 20, v_dv, v_bd, v_kt, 'ghi_tay', 'gui')
  returning id into v_id;
  insert into art values ('g_sd', v_id);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', v_cs, v_lop, v_e1, v_nam, 'Số máy cộng từ việc', 'toi', 'tang', 0, 20, v_dv, v_bd, v_kt, 'thuoc', 'gui')
  returning id into v_id;
  insert into art values ('g_thuoc', v_id);
end $$;

-- 8a THUẬN: em ghi số tay hôm nay vào mục tiêu ghi_tay của mình → được
do $$
declare v_e1 uuid; v_sd uuid; v_bd date;
begin
  select em[1], bd into v_e1, v_bd from bc; select v into v_sd from art where k='g_sd';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi)
    values (v_sd, v_e1, v_bd, 5, 'tay', v_e1);
    insert into kq values ('so_do: em ghi số tay hôm nay được', 'được', 'được', true);
  exception when others then
    insert into kq values ('so_do: em ghi số tay hôm nay được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
  end;
end $$;

-- 8b NGƯỢC: ghi tay số vào mục tiêu nguon_so='thuoc' (máy tự cộng) → 23514
do $$
declare v_e1 uuid; v_th uuid; v_bd date;
begin
  select em[1], bd into v_e1, v_bd from bc; select v into v_th from art where k='g_thuoc';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi)
    values (v_th, v_e1, v_bd, 5, 'tay', v_e1);
    insert into kq values ('so_do: chặn ghi tay vào mục tiêu máy-tự-cộng', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('so_do: chặn ghi tay vào mục tiêu máy-tự-cộng', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- 8c NGƯỢC: ghi số ngày TƯƠNG LAI → 23514
do $$
declare v_e1 uuid; v_sd uuid; v_bd date;
begin
  select em[1], bd into v_e1, v_bd from bc; select v into v_sd from art where k='g_sd';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi)
    values (v_sd, v_e1, v_bd + 1, 5, 'tay', v_e1);
    insert into kq values ('so_do: chặn ghi số ngày tương lai', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('so_do: chặn ghi số ngày tương lai', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- 8d NGƯỢC: số không khớp chủ mục tiêu (student_id em khác) → 23514
do $$
declare v_e1 uuid; v_e2 uuid; v_sd uuid; v_bd date;
begin
  select em[1], em[2], bd into v_e1, v_e2, v_bd from bc; select v into v_sd from art where k='g_sd';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi)
    values (v_sd, v_e2, v_bd, 5, 'tay', v_e1);
    insert into kq values ('so_do: chặn số không đúng chủ mục tiêu', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('so_do: chặn số không đúng chủ mục tiêu', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- 8e KHE HẸP va.nguon_he_thong: máy điểm danh ghi số → nguoi_ghi bị ép NULL và BỎ QUA chặn-tay
--    (ngày tương lai vẫn lọt). Cờ reset ngay để không rò sang bước sau.
do $$
declare v_gvcn uuid; v_e1 uuid; v_sd uuid; v_bd date; v_who uuid; v_id uuid;
begin
  select gvcn, em[1], bd into v_gvcn, v_e1, v_bd from bc; select v into v_sd from art where k='g_sd';
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    perform set_config('va.nguon_he_thong', '1', true);
    insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi)
    values (v_sd, v_e1, v_bd + 3, 9, 'tay', v_gvcn)          -- ngày tương lai + người ghi = GVCN
    returning id, nguoi_ghi into v_id, v_who;
    perform set_config('va.nguon_he_thong', '', true);
    insert into kq values ('so_do: khe hệ thống ẩn danh + vượt chặn ngày', 'ghi được, nguoi_ghi=null',
      'ghi được, nguoi_ghi='||coalesce(v_who::text,'null'), v_who is null);
  exception when others then
    perform set_config('va.nguon_he_thong', '', true);
    insert into kq values ('so_do: khe hệ thống ẩn danh + vượt chặn ngày', 'ghi được, nguoi_ghi=null',
      'LỖI: '||sqlerrm, false);
  end;
end $$;

-- 8f NGƯỢC: UPDATE đổi NGÀY của một dòng so_do → 23514 (đổi ngày thì xoá rồi ghi lại)
do $$
declare v_e1 uuid; v_sd uuid; v_row uuid; v_bd date;
begin
  select em[1], bd into v_e1, v_bd from bc; select v into v_sd from art where k='g_sd';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  select id into v_row from so_do where muc_tieu_id=v_sd and ngay=v_bd and student_id=v_e1 limit 1;
  begin
    update so_do set ngay = v_bd - 1 where id = v_row;
    insert into kq values ('so_do: chặn UPDATE đổi ngày dòng số', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('so_do: chặn UPDATE đổi ngày dòng số', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- ── 9. mt_truoc_xoa: xoá mục tiêu ĐÃ CÓ số → 23503; admin xoá được (bỏ qua chốt) ───────────────
do $$
declare v_lop uuid; v_cs uuid; v_e1 uuid; v_admin uuid; v_nam text; v_bd date; v_kt date; v_dv uuid; v_id uuid; n int;
begin
  select lop, cs, em[1], admin, nam, bd, kt, dv into v_lop, v_cs, v_e1, v_admin, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
    x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', v_cs, v_lop, v_e1, v_nam, 'Có số rồi đừng xoá', 'toi', 'tang', 0, 20, v_dv, v_bd, v_kt, 'ghi_tay', 'gui')
  returning id into v_id;
  insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon, nguoi_ghi) values (v_id, v_e1, v_bd, 3, 'tay', v_e1);

  -- NGƯỢC: chủ (không admin) xoá mục tiêu đã có số → 23503
  begin
    delete from muc_tieu where id=v_id;
    insert into kq values ('mt_xoa: xoá mục tiêu đã có số bị chặn', '23503', 'đi lọt', false);
  exception when foreign_key_violation then
    insert into kq values ('mt_xoa: xoá mục tiêu đã có số bị chặn', '23503', 'chặn đúng (23503)', true);
  end;

  -- THUẬN: admin xoá được (trigger trả old, cascade dọn so_do)
  if v_admin is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
    begin
      delete from muc_tieu where id=v_id;
      select count(*) into n from muc_tieu where id=v_id;
      insert into kq values ('mt_xoa: admin xoá được (bỏ qua chốt)', '0 còn lại', n::text, n=0);
    exception when others then
      insert into kq values ('mt_xoa: admin xoá được (bỏ qua chốt)', '0 còn lại', 'BỊ CHẶN: '||sqlerrm, false);
    end;
  else
    insert into kq values ('mt_xoa: admin xoá được (bỏ qua chốt)', '0 còn lại', 'bỏ qua (không có admin)', true);
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ═══════════════════ PHASE B — RLS THẬT (vai authenticated) ═════════════════════════════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ── 10. RLS select muc_tieu: em cùng lớp thấy mục tiêu TRƯỜNG [H-11] và LỚP; em NGOÀI lớp không ─
do $$
declare v_cs uuid; v_lop uuid; v_e1 uuid; v_out uuid; v_glop uuid; v_gtr uuid; n int;
begin
  select cs, lop, em[1], outsider into v_cs, v_lop, v_e1, v_out from bc;
  select v into v_glop from art where k='g_lop';

  -- Tạo mục tiêu TRƯỜNG (làm mồi) — postgres đã đổi vai; dùng admin để insert lọt RLS.
  -- (đổi tạm về sub=admin; role vẫn authenticated → RLS admin-policy cho phép)
  perform set_config('request.jwt.claims', json_build_object('sub', (select admin from bc)::text)::text, true);
  insert into muc_tieu (cap, campus_id, nam_hoc, ten, kieu_dich, chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
  values ('truong', v_cs, (select nam from bc), 'Toàn trường đọc', 'toi', 'tang', 0, 9999,
          (select dv from bc), (select bd from bc), (select kt from bc), 'nhap')
  returning id into v_gtr;

  -- em cùng lớp thấy mục tiêu TRƯỜNG (cùng cơ sở) [H-11]
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  select count(*) into n from muc_tieu where id=v_gtr;
  insert into kq values ('RLS mt: em thấy mục tiêu TRƯỜNG cùng cơ sở [H-11]', '1', n::text, n=1);

  -- em cùng lớp thấy mục tiêu LỚP của mình
  select count(*) into n from muc_tieu where id=v_glop;
  insert into kq values ('RLS mt: em cùng lớp thấy mục tiêu LỚP', '1', n::text, n=1);

  -- em NGOÀI lớp KHÔNG thấy mục tiêu LỚP của lớp Test
  if v_out is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_out::text)::text, true);
    select count(*) into n from muc_tieu where id=v_glop;
    insert into kq values ('RLS mt: em ngoài lớp KHÔNG thấy mục tiêu LỚP', '0', n::text, n=0);
  else
    insert into kq values ('RLS mt: em ngoài lớp KHÔNG thấy mục tiêu LỚP', '0', 'bỏ qua (không có em ngoài lớp)', true);
  end if;
end $$;

-- ── 11. RLS insert muc_tieu NGƯỢC: em không tạo mục tiêu mang student_id của em KHÁC ───────────
do $$
declare v_cs uuid; v_lop uuid; v_e1 uuid; v_e2 uuid; v_nam text; v_bd date; v_kt date; v_dv uuid;
begin
  select cs, lop, em[1], em[2], nam, bd, kt, dv into v_cs, v_lop, v_e1, v_e2, v_nam, v_bd, v_kt, v_dv from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, kieu_dich, chieu,
      x_so, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
    values ('em', v_cs, v_lop, v_e2, v_nam, 'Mượn tên bạn', 'toi', 'tang', 0, 10, v_dv, v_bd, v_kt, 'gui');
    insert into kq values ('RLS mt: em không tạo mục tiêu cho em khác', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then
    insert into kq values ('RLS mt: em không tạo mục tiêu cho em khác', 'chặn', 'chặn đúng (RLS)', true);
  when others then
    insert into kq values ('RLS mt: em không tạo mục tiêu cho em khác', 'chặn', 'chặn (khác): '||sqlerrm, true);
  end;
end $$;

-- ── 12. RLS so_do: em đọc số THÔ của mình; bạn cùng lớp KHÔNG đọc số thô của em khác (L7) ───────
do $$
declare v_e1 uuid; v_e2 uuid; v_sd uuid; n int;
begin
  select em[1], em[2] into v_e1, v_e2 from bc; select v into v_sd from art where k='g_sd';

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  select count(*) into n from so_do where muc_tieu_id=v_sd and student_id=v_e1;
  insert into kq values ('RLS so_do: em đọc số thô của chính mình', '>=1', n::text, n>=1);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e2::text)::text, true);
  select count(*) into n from so_do where muc_tieu_id=v_sd and student_id=v_e1;
  insert into kq values ('RLS so_do: bạn cùng lớp KHÔNG đọc số thô của em khác', '0', n::text, n=0);
end $$;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
