-- KIỂM 0162 — NỀN: đơn vị, tuần học, nhóm, mẫu mục tiêu, cột nhập hộ, tao_buddy_nhom chiếu nhom.
--
--   npm run sql -- scripts/test-0162-nen-nhom-mau-nhap-ho.sql   (chạy SAU khi apply 0162)
--
-- Luật chỉ nằm trong giao diện thì không phải luật: bài này dựng cả đường THUẬN lẫn CHIỀU NGƯỢC
-- cho từng chốt MỚI của 0162, đóng vai bằng request.jwt.claims + role, chạy thẳng trên production
-- rồi ROLLBACK nên không để lại gì. "Chưa vá phải ĐỎ": CHỐT CHẶN ở đầu raise ngay nếu 0162 chưa áp.
--
-- Đóng vai: auth_role()/auth_campus() đọc profiles theo auth.uid() (= claims.sub). Vì thế bài dùng
-- id THẬT của lớp Test và các vai (không đóng cứng — dữ liệu đổi lúc nào không ai báo). Test nào
-- thiếu tiền đề (ví dụ không có BGH cơ sở khác) thì ghi "bỏ qua", không làm hỏng cả bộ.
--
--   Phase A (vai postgres, RLS bỏ qua — cô lập TRIGGER): ntv_hop_le, mtm_tran_tam, protect_class(nhap_ho).
--   Phase B (vai authenticated — RLS thật): nhom_buddy_chi_may, RLS don_vi/nhom, tao_buddy_nhom chiếu nhom.

begin;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.don_vi') is null
     or to_regclass('public.nhom') is null
     or to_regclass('public.muc_tieu_mau') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='classes' and column_name='nhap_ho')
     or not exists (select 1 from pg_trigger where tgname='trg_ntv_hop_le'         and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_mtm_tran_tam'       and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_nhom_buddy_chi_may' and not tgisinternal) then
    raise exception 'CHUA VA 0162: thiếu bảng/cột/trigger nền — chạy migration 0162 trước.';
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
  (select id from profiles where role='principal' and campus_id is not null and campus_id<>t.cs limit 1) bgh_other,
  (select id from profiles where role='admin' limit 1)                                           admin
from t;
grant select on bc to authenticated;

-- Artefact chia sẻ giữa hai phase (id nhóm tạo ở Phase A, đọc lại ở Phase B).
create temporary table art (k text primary key, v uuid) on commit drop;
grant all on art to authenticated;

do $$ declare v_lop uuid; begin
  select lop into v_lop from bc;
  if v_lop is null then raise exception 'Không thấy lớp Test — không chạy được bài kiểm.'; end if;
end $$;

-- ═══════════════════ PHASE A — cô lập TRIGGER (vai postgres, RLS bỏ qua) ═════════════════════

-- ── 1. ntv_hop_le: chỉ thêm được HỌC SINH ĐANG HỌC lớp của nhóm ──────────────────────────────
do $$
declare v_lop uuid; v_em uuid; v_out uuid; v_to uuid;
begin
  select lop, em[1], outsider into v_lop, v_em, v_out from bc;
  insert into nhom (class_id, ten, loai) values (v_lop, 'Tổ kiểm thử', 'to') returning id into v_to;
  insert into art values ('to_nhom', v_to);
  begin
    insert into nhom_thanh_vien (nhom_id, student_id) values (v_to, v_em);
    insert into kq values ('ntv_hop_le: thêm em đang học lớp', 'thêm được', 'thêm được', true);
  exception when others then
    insert into kq values ('ntv_hop_le: thêm em đang học lớp', 'thêm được', 'LỖI: '||sqlerrm, false);
  end;
  begin
    insert into nhom_thanh_vien (nhom_id, student_id) values (v_to, v_out);
    insert into kq values ('ntv_hop_le: CHẶN em không học lớp', '23503', 'đi lọt', false);
  exception
    when foreign_key_violation then
      insert into kq values ('ntv_hop_le: CHẶN em không học lớp', '23503', 'chặn đúng (23503)', true);
    when others then
      insert into kq values ('ntv_hop_le: CHẶN em không học lớp', '23503', 'chặn (khác mã): '||sqlerrm, true);
  end;
end $$;

-- ── 2. mtm_tran_tam: tối đa 8 mẫu ĐANG DÙNG một lớp ─────────────────────────────────────────
do $$
declare v_lop uuid; i int;
begin
  select lop into v_lop from bc;
  for i in 1..8 loop
    insert into muc_tieu_mau (class_id, ten, linh_vuc) values (v_lop, 'Mẫu thử '||i, 'knowledge');
  end loop;
  insert into kq values ('mtm_tran_tam: 8 mẫu đầu vào được', '8 mẫu OK', '8 mẫu OK', true);
  begin
    insert into muc_tieu_mau (class_id, ten, linh_vuc) values (v_lop, 'Mẫu thử 9', 'knowledge');
    insert into kq values ('mtm_tran_tam: CHẶN mẫu thứ 9', '23514', 'đi lọt', false);
  exception when check_violation then
    insert into kq values ('mtm_tran_tam: CHẶN mẫu thứ 9', '23514', 'chặn đúng (23514)', true);
  end;
end $$;

-- ── 3. protect_class(nhap_ho): admin/BGH-cơ-sở bật được; thầy cô & BGH-cơ-sở-khác bị chặn. ────
--     Cột đặc quyền CŨ (homeroom_teacher_id) vẫn CHỈ admin — BGH cơ sở mình cũng không đụng được.
do $$
declare v_lop uuid; v_gvcn uuid; v_admin uuid; v_same uuid; v_other uuid;
begin
  select lop, gvcn, admin, bgh_same, bgh_other into v_lop, v_gvcn, v_admin, v_same, v_other from bc;

  -- (a) NGƯỢC: thầy cô (GVCN) bật nhap_ho -> chặn
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    update classes set nhap_ho = not nhap_ho where id = v_lop;
    insert into kq values ('protect_class: GVCN bật nhap_ho bị chặn', 'chặn', 'đi lọt', false);
  exception when others then
    insert into kq values ('protect_class: GVCN bật nhap_ho bị chặn', 'chặn', 'chặn đúng', true);
  end;

  -- (b) THUẬN: admin bật nhap_ho -> được
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  begin
    update classes set nhap_ho = not nhap_ho where id = v_lop;
    insert into kq values ('protect_class: admin bật nhap_ho được', 'được', 'được', true);
  exception when others then
    insert into kq values ('protect_class: admin bật nhap_ho được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
  end;

  -- (c) THUẬN: BGH cùng cơ sở bật nhap_ho -> được
  if v_same is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_same::text)::text, true);
    begin
      update classes set nhap_ho = not nhap_ho where id = v_lop;
      insert into kq values ('protect_class: BGH cùng cơ sở bật nhap_ho được', 'được', 'được', true);
    exception when others then
      insert into kq values ('protect_class: BGH cùng cơ sở bật nhap_ho được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
    end;
  else
    insert into kq values ('protect_class: BGH cùng cơ sở bật nhap_ho được', 'được', 'bỏ qua (không có BGH cơ sở Test)', true);
  end if;

  -- (d) NGƯỢC: BGH cơ sở KHÁC bật nhap_ho lớp Test -> chặn
  if v_other is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_other::text)::text, true);
    begin
      update classes set nhap_ho = not nhap_ho where id = v_lop;
      insert into kq values ('protect_class: BGH cơ sở KHÁC bị chặn', 'chặn', 'đi lọt', false);
    exception when others then
      insert into kq values ('protect_class: BGH cơ sở KHÁC bị chặn', 'chặn', 'chặn đúng', true);
    end;
  else
    insert into kq values ('protect_class: BGH cơ sở KHÁC bị chặn', 'chặn', 'bỏ qua (không có BGH cơ sở khác)', true);
  end if;

  -- (e) NGƯỢC (cột cũ): BGH cùng cơ sở đổi GVCN -> vẫn chặn (chỉ admin)
  if v_same is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_same::text)::text, true);
    begin
      update classes set homeroom_teacher_id = null where id = v_lop;
      insert into kq values ('protect_class: BGH đổi GVCN vẫn bị chặn', 'chặn', 'đi lọt', false);
    exception when others then
      insert into kq values ('protect_class: BGH đổi GVCN vẫn bị chặn', 'chặn', 'chặn đúng', true);
    end;
  end if;

  perform set_config('request.jwt.claims', '', true);
end $$;

-- Tạo sẵn một nhóm buddy (rỗng) làm mồi cho Phase B (insert as postgres — trigger chặn ở update/delete).
do $$ declare v_lop uuid; v_b uuid; begin
  select lop into v_lop from bc;
  insert into nhom (class_id, ten, loai) values (v_lop, 'Nhóm bạn (mồi)', 'buddy') returning id into v_b;
  insert into art values ('buddy_nhom', v_b);
end $$;

-- ═══════════════════ PHASE B — RLS THẬT (vai authenticated) ═════════════════════════════════
-- Từ đây role = authenticated cho tới hết giao dịch; đổi vai chỉ bằng đổi claims.sub.

-- ── 4. nhom_buddy_chi_may: người không sửa/xoá được nhóm buddy; máy (cờ va.chieu_buddy) thì được;
--       nhóm 'to' của thầy cô KHÔNG bị chốt này đụng. ─────────────────────────────────────────
do $$
declare v_gvcn uuid; v_b uuid; v_to uuid;
begin
  select gvcn into v_gvcn from bc;
  select v into v_b  from art where k='buddy_nhom';
  select v into v_to from art where k='to_nhom';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);

  -- NGƯỢC: GVCN sửa tay nhóm buddy -> 42501
  begin
    update nhom set ten = 'Đổi tay' where id = v_b;
    insert into kq values ('nhom_buddy_chi_may: GVCN sửa nhóm buddy bị chặn', '42501', 'đi lọt', false);
  exception
    when insufficient_privilege then
      insert into kq values ('nhom_buddy_chi_may: GVCN sửa nhóm buddy bị chặn', '42501', 'chặn đúng (42501)', true);
    when others then
      insert into kq values ('nhom_buddy_chi_may: GVCN sửa nhóm buddy bị chặn', '42501', 'chặn (khác mã): '||sqlerrm, true);
  end;

  -- ĐỐI CHỨNG: GVCN sửa nhóm 'to' -> được (chốt này không đụng nhóm thầy cô)
  begin
    update nhom set ten = 'Tổ đổi tên' where id = v_to;
    insert into kq values ('nhom_buddy_chi_may: sửa nhóm "to" vẫn được', 'được', 'được', true);
  exception when others then
    insert into kq values ('nhom_buddy_chi_may: sửa nhóm "to" vẫn được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
  end;

  -- THUẬN (máy): cùng người nhưng có cờ va.chieu_buddy -> nhóm buddy sửa được
  begin
    perform set_config('va.chieu_buddy', '1', true);
    update nhom set ten = 'Máy chiếu đổi' where id = v_b;
    perform set_config('va.chieu_buddy', '', true);
    insert into kq values ('nhom_buddy_chi_may: máy (cờ) sửa nhóm buddy được', 'được', 'được', true);
  exception when others then
    perform set_config('va.chieu_buddy', '', true);
    insert into kq values ('nhom_buddy_chi_may: máy (cờ) sửa nhóm buddy được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
  end;
end $$;

-- ── 5. RLS don_vi: chỉ thầy cô/BGH/admin thêm; học sinh KHÔNG thêm được. ─────────────────────
do $$
declare v_gvcn uuid; v_em uuid;
begin
  select gvcn, em[1] into v_gvcn, v_em from bc;

  -- NGƯỢC: học sinh thêm đơn vị -> RLS chặn (42501)
  perform set_config('request.jwt.claims', json_build_object('sub', v_em::text)::text, true);
  begin
    insert into don_vi (ma, nhan_vi, nhan_en) values ('thu_dv_hs', 'thử hs', 'test hs');
    insert into kq values ('RLS don_vi: học sinh KHÔNG thêm được', 'chặn', 'đi lọt', false);
  exception when insufficient_privilege then
    insert into kq values ('RLS don_vi: học sinh KHÔNG thêm được', 'chặn', 'chặn đúng (RLS)', true);
  when others then
    insert into kq values ('RLS don_vi: học sinh KHÔNG thêm được', 'chặn', 'chặn (khác): '||sqlerrm, true);
  end;

  -- THUẬN: thầy cô thêm đơn vị -> được
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into don_vi (ma, nhan_vi, nhan_en) values ('thu_dv_gv', 'thử gv', 'test gv');
    insert into kq values ('RLS don_vi: thầy cô thêm được', 'được', 'được', true);
  exception when others then
    insert into kq values ('RLS don_vi: thầy cô thêm được', 'được', 'BỊ CHẶN: '||sqlerrm, false);
  end;
end $$;

-- ── 6. RLS nhom (select): em trong lớp đọc được nhóm của lớp; em NGOÀI lớp không đọc được. ────
do $$
declare v_to uuid; v_em uuid; v_out uuid; n int;
begin
  select v into v_to from art where k='to_nhom';
  select em[1], outsider into v_em, v_out from bc;

  perform set_config('request.jwt.claims', json_build_object('sub', v_em::text)::text, true);
  select count(*) into n from nhom where id = v_to;
  insert into kq values ('RLS nhom: em trong lớp thấy nhóm lớp', '1', n::text, n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', v_out::text)::text, true);
  select count(*) into n from nhom where id = v_to;
  insert into kq values ('RLS nhom: em ngoài lớp KHÔNG thấy', '0', n::text, n = 0);
end $$;

-- ── 7. tao_buddy_nhom chiếu buddy_pairs -> nhom(loai='buddy') + nhom_thanh_vien ──────────────
do $$
declare v_lop uuid; v_gvcn uuid; v_e1 uuid; v_e2 uuid; n int;
begin
  select lop, gvcn, em[1], em[2] into v_lop, v_gvcn, v_e1, v_e2 from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    perform tao_buddy_nhom(v_lop, array[v_e1, v_e2]);
    -- Có ĐÚNG một nhóm buddy sống, đủ 2 thành viên sống, cho hai em này.
    select count(*) into n from nhom g
     where g.class_id = v_lop and g.loai = 'buddy' and g.is_active
       and (select count(*) from nhom_thanh_vien v where v.nhom_id = g.id and v.is_active) = 2
       and em_trong_nhom(g.id, v_e1) and em_trong_nhom(g.id, v_e2);
    insert into kq values ('tao_buddy_nhom: chiếu sang nhom (2 thành viên)', '>=1 nhóm buddy đủ 2', n::text, n >= 1);
  exception when others then
    insert into kq values ('tao_buddy_nhom: chiếu sang nhom (2 thành viên)', '>=1 nhóm buddy đủ 2', 'LỖI: '||sqlerrm, false);
  end;
end $$;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
