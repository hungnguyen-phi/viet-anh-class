-- KIỂM 0181 — WIG CÁ NHÂN CỦA GIÁO VIÊN + nối lên lớp/trường.
--
--   npm run sql -- scripts/test-wig-ca-nhan-gv.sql   (chạy SAU khi apply 0181)
--
-- Chạy trong GIAO DỊCH rồi ROLLBACK trên production — không để lại gì. CHƯA áp 0181 thì CHỐT CHẶN
-- đỏ ngay (và các ca RLS/trigger phía dưới cũng đỏ nếu chạy ép — hai chiều đều đã thử 03/09).
--
-- Ca kiểm:
--   ① GVCN tạo mục tiêu cap='em' ĐỨNG TÊN MÌNH (vai authenticated, RLS thật) → tự duyệt luôn.
--   ② GVCN tạo cam kết + thước đo chu_the='em' đứng tên mình → OK; thước tự duyet='duyet'.
--   ③ HS KHÔNG tạo được cam kết đứng tên GVCN; ④ em thường vẫn tạo được đồ của mình như cũ.
--   ⑤ noi_wig_len_tren CÙNG đơn vị (tôi→lớp): chi_huong + gop_so, lớp sang nguon_so='con',
--      trạng thái 'duyet' GIỮ NGUYÊN, và SỐ CHẢY: ghi 4 ở mục tiêu tôi → so_hien_tai(lớp)=4.
--   ⑥ KHÁC đơn vị: chỉ chi_huong, lớp giữ ghi_tay.  ⑦ lớp→trường cùng đơn vị: gop_so + 'con'.
--   ⑧ go_wig_len_tren: gỡ hết dây gop_so → lớp quay về ghi_tay.

begin;

-- ── CHỐT CHẶN: chưa vá 0181 thì dừng ngay ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'la_gvcn_cua')
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'noi_wig_len_tren')
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'go_wig_len_tren') then
    raise exception 'CHUA VA 0181: thiếu la_gvcn_cua / noi_wig_len_tren / go_wig_len_tren — chạy migration 0181 trước.';
  end if;
end $$;

-- Bối cảnh id thật của lớp Test.
create temporary table bc181 on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn,
  (select e.student_id from enrollments e join profiles p on p.id = e.student_id
    where e.class_id = t.lop and e.is_active and p.role = 'student' order by e.student_id limit 1) em1,
  current_school_year()                                              nam,
  vn_today()                                                         bd,
  make_date(split_part(current_school_year(),'-',1)::int + 1, 6, 30) kt,
  (select id from don_vi where lower(ma)='lan'  limit 1)             dv,
  (select id from don_vi where lower(ma)='diem' limit 1)             dv2
from t;
grant select on bc181 to authenticated;

-- Tự gieo chủ thể SẠCH (0187): dọn cam kết / thước cá nhân của GVCN test trong giao dịch (rollback
-- trả lại) — bài kiểm không được phụ thuộc vào thứ người ta đang thử tay trên tài khoản ấy
-- (trần 2 cam kết/tuần, thước đã có lượt ghi từng làm bài này đỏ oan 04/09).
do $$ declare r bc181%rowtype; begin
  select * into r from bc181;
  -- Không xoá (trigger th_truoc_xoa giữ thước đã có lượt) — chỉ đóng/huỷ: 'dong' không tính trần thước,
  -- 'huy' không tính trần 2 cam kết/tuần.
  update thuoc set trang_thai = 'dong' where chu_the = 'em' and student_id = r.gvcn and trang_thai <> 'dong';
  update cam_ket set trang_thai = 'huy' where chu_the = 'em' and student_id = r.gvcn and trang_thai = 'hieu_luc';
end $$;
create temporary table art181 (k text primary key, v uuid) on commit drop;
grant all on art181 to authenticated;

do $$ declare r bc181%rowtype; begin
  select * into r from bc181;
  if r.lop is null or r.gvcn is null or r.em1 is null or r.dv is null or r.dv2 is null then
    raise exception 'Thiếu lớp Test / GVCN / học sinh / đơn vị lan+diem — không chạy được bài kiểm.';
  end if;
end $$;

-- Mồi (vai postgres, RLS bỏ qua, auth.uid() null nên trigger L6 cho qua):
-- mục tiêu LỚP 'duyet' (đơn vị lần) + mục tiêu TRƯỜNG 'duyet' (đơn vị lần).
do $$ declare r bc181%rowtype; v uuid; begin
  select * into r from bc181;
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('lop', r.cs, r.lop, null, r.nam, 'ZZTEST181-wig-lop', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 100, r.dv, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v;
  insert into art181 values ('g_lop', v);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('truong', r.cs, null, null, r.nam, 'ZZTEST181-wig-truong', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 1000, r.dv, r.bd, r.kt, 'ghi_tay', 'duyet') returning id into v;
  insert into art181 values ('g_truong', v);
end $$;

-- ═══════════ Từ đây RLS THẬT (vai authenticated) ═══════════
do $$ begin perform set_config('role', 'authenticated', true); end $$;

-- ① GVCN tạo mục tiêu cap='em' đứng tên MÌNH → RLS cho qua (vế mới ghi_duoc_chu_the) và
--    mt_truoc_them tự duyệt (duyet_duoc em = is_class_teacher).
do $$ declare r bc181%rowtype; v uuid; tt text; begin
  select * into r from bc181;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.cs, r.lop, r.gvcn, r.nam, 'ZZTEST181-wig-toi', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 10, r.dv, r.bd, r.kt, 'ghi_tay', 'gui') returning id, trang_thai into v, tt;
  if tt is distinct from 'duyet' then raise exception 'CA1 HỎNG: mục tiêu cá nhân GVCN mong tự duyệt, ra %', tt; end if;
  insert into art181 values ('g_toi', v);
  raise notice 'CA1 OK — GVCN tự tạo + tự duyệt mục tiêu cá nhân';
end $$;

-- ② Cam kết + thước đo đứng tên GVCN.
do $$ declare r bc181%rowtype; v_ck uuid; v_th uuid; d text; begin
  select * into r from bc181;
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id)
  values ('em', r.lop, r.gvcn, 'ZZTEST181-ck-toi', 4, r.dv, 1, vn_week_start(), (select v from art181 where k='g_toi'))
  returning id into v_ck;
  insert into art181 values ('ck_toi', v_ck);
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, moi_lan,
                     ngay_ap_dung, chieu_dich, gop, ky_tuan, pham_vi, tu_tuan)
  values ('em', r.lop, r.gvcn, 'ZZTEST181-thuoc-toi', 'cham', r.dv, 5, 1,
          array[1,2,3,4,5], 'it_nhat', 'tong', 1, 'tung_em', vn_week_start())
  returning id, duyet into v_th, d;
  if d is distinct from 'duyet' then raise exception 'CA2 HỎNG: thước cá nhân GVCN mong tự duyệt, ra %', d; end if;
  raise notice 'CA2 OK — cam kết + thước đo đứng tên GVCN, thước hiệu lực ngay';
end $$;

-- ③ HS KHÔNG tạo được cam kết đứng tên GVCN (RLS chặn — 42501 hoặc 0 dòng).
do $$ declare r bc181%rowtype; begin
  select * into r from bc181;
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  begin
    insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_tuan, tuan_bat_dau)
    values ('em', r.lop, r.gvcn, 'ZZTEST181-ck-gia-danh', 1, vn_week_start());
    raise exception 'CA3 HỎNG: học sinh chèn được cam kết đứng tên thầy cô!';
  exception when insufficient_privilege or check_violation then
    raise notice 'CA3 OK — học sinh không đứng tên thầy cô được';
  end;
end $$;

-- ④ Em thường vẫn tạo cam kết của MÌNH như cũ (đường cũ không gãy).
do $$ declare r bc181%rowtype; v uuid; begin
  select * into r from bc181;
  perform set_config('request.jwt.claims', json_build_object('sub', r.em1::text)::text, true);
  -- dọn trần 2/tuần trong txn: HUỶ thay vì delete — từ 0185 xoá cam kết cascade sang thước (cam_ket_id)
  -- và th_truoc_xoa chặn thước đã có lượt ghi.
  update cam_ket set trang_thai = 'huy' where student_id = r.em1 and class_id = r.lop
    and tuan_bat_dau >= vn_week_start() and trang_thai = 'hieu_luc' and ket_qua is null;
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_tuan, tuan_bat_dau)
  values ('em', r.lop, r.em1, 'ZZTEST181-ck-em', 1, vn_week_start()) returning id into v;
  if v is null then raise exception 'CA4 HỎNG: em thường không tạo được cam kết của mình nữa'; end if;
  raise notice 'CA4 OK — em thường vẫn tạo cam kết như cũ';
end $$;

-- ⑤ Nối tôi→lớp CÙNG đơn vị: chi_huong + gop_so, lớp sang 'con' mà KHÔNG tụt trạng thái; số chảy.
do $$ declare r bc181%rowtype; g_toi uuid; g_lop uuid; n int; ns text; tt text; v_so numeric; begin
  select * into r from bc181;
  select v into g_toi from art181 where k='g_toi';
  select v into g_lop from art181 where k='g_lop';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  perform noi_wig_len_tren(g_toi, g_lop);
  select count(*) into n from noi where cha_id = g_lop and con_muc_tieu_id = g_toi;
  if n <> 2 then raise exception 'CA5 HỎNG: mong 2 dây (chi_huong + gop_so), có %', n; end if;
  select nguon_so, trang_thai into ns, tt from muc_tieu where id = g_lop;
  if ns is distinct from 'con' or tt is distinct from 'duyet' then
    raise exception 'CA5 HỎNG: lớp mong nguon_so=con + duyet, ra %/%', ns, tt;
  end if;
  -- Số chảy ĐÚNG luồng thật: GVCN điền so_dat=4 vào cam kết → 0178 cộng dồn lên mục tiêu tôi
  -- (so_do he_thong) → gop_so chảy tiếp lên lớp. (Ghi tay so_do sẽ bị dòng he_thong cùng ngày đè.)
  update cam_ket set so_dat = 4, ket_qua = 'thang', xong_at = now() where id = (select v from art181 where k = 'ck_toi');
  select so into v_so from private.so_hien_tai(g_lop);
  if v_so is distinct from 4 then raise exception 'CA5 HỎNG: số lớp mong 4 (chảy từ mục tiêu tôi), ra %', v_so; end if;
  raise notice 'CA5 OK — cùng đơn vị: gop_so + nguon_so=con, giữ duyet, số chảy tôi→lớp';
end $$;

-- ⑥ KHÁC đơn vị: chỉ chi_huong, cha giữ nguyên nguồn số.
do $$ declare r bc181%rowtype; g_lop uuid; v2 uuid; n int; begin
  select * into r from bc181;
  select v into g_lop from art181 where k='g_lop';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich,
                        chieu, x_so, y_so, don_vi_id, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', r.cs, r.lop, r.gvcn, r.nam, 'ZZTEST181-wig-toi-2', 'knowledge', 'do_luong', 'toi',
          'tang', 0, 9, r.dv2, r.bd, r.kt, 'ghi_tay', 'gui') returning id into v2;
  perform noi_wig_len_tren(v2, g_lop);
  select count(*) into n from noi where cha_id = g_lop and con_muc_tieu_id = v2 and vai = 'gop_so';
  if n <> 0 then raise exception 'CA6 HỎNG: khác đơn vị mà vẫn có gop_so'; end if;
  select count(*) into n from noi where cha_id = g_lop and con_muc_tieu_id = v2 and vai = 'chi_huong';
  if n <> 1 then raise exception 'CA6 HỎNG: thiếu dây chi_huong'; end if;
  raise notice 'CA6 OK — khác đơn vị: chỉ giữ hướng';
end $$;

-- ⑦ Lớp→trường: từ 0182 CHỈ GIỮ HƯỚNG (trường đo theo cách riêng) — dù cùng đơn vị cũng không gop_so,
--    trường KHÔNG chuyển sang 'con'. (Bài này viết theo 0181, cập nhật 04/09 theo 0182.)
do $$ declare r bc181%rowtype; g_lop uuid; g_tr uuid; n int; ns text; begin
  select * into r from bc181;
  select v into g_lop from art181 where k='g_lop';
  select v into g_tr  from art181 where k='g_truong';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  perform noi_wig_len_tren(g_lop, g_tr);
  select count(*) into n from noi where cha_id = g_tr and con_muc_tieu_id = g_lop and vai = 'chi_huong';
  if n <> 1 then raise exception 'CA7 HỎNG: lớp→trường thiếu dây chi_huong'; end if;
  select count(*) into n from noi where cha_id = g_tr and con_muc_tieu_id = g_lop and vai = 'gop_so';
  if n <> 0 then raise exception 'CA7 HỎNG: lớp→trường có gop_so — 0182 đã bỏ cộng số lên trường'; end if;
  select nguon_so into ns from muc_tieu where id = g_tr;
  if ns = 'con' then raise exception 'CA7 HỎNG: trường bị chuyển sang nguon_so=con'; end if;
  raise notice 'CA7 OK — lớp nối lên trường chỉ giữ hướng (0182)';
end $$;

-- ⑧ Gỡ dây: hết con gop_so → cha quay về ghi_tay.
do $$ declare r bc181%rowtype; g_toi uuid; g_lop uuid; ns text; begin
  select * into r from bc181;
  select v into g_toi from art181 where k='g_toi';
  select v into g_lop from art181 where k='g_lop';
  perform set_config('request.jwt.claims', json_build_object('sub', r.gvcn::text)::text, true);
  perform go_wig_len_tren(g_toi, g_lop);
  select nguon_so into ns from muc_tieu where id = g_lop;
  if ns is distinct from 'ghi_tay' then raise exception 'CA8 HỎNG: gỡ hết gop_so mà lớp vẫn nguon_so=%', ns; end if;
  raise notice 'CA8 OK — gỡ dây thì lớp về ghi tay';
end $$;

rollback;
