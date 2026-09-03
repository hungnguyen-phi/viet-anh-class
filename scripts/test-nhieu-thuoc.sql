-- KIỂM "một cam kết nhiều thước đo" (migration 0185).
-- An toàn: chạy trong GIAO DỊCH rồi ROLLBACK — không để lại gì trên CSDL thật.
-- Cần: đã cài 0185 (CHƯA cài thì phải ĐỎ ngay ở cột cam_ket_id). Chạy:
--   npm run sql -- scripts/test-nhieu-thuoc.sql
--
-- Sáu ca (fail là raise exception → thấy ngay):
--   CA1  một cam kết treo 3 thước qua thuoc.cam_ket_id.
--   CA2  neo chủ thể: thước của em KHÁC không gắn được vào cam kết của em này.
--   CA3  trần 2 cam kết/tuần vẫn chặn cái thứ 3 (giả phiên em qua request.jwt.claims).
--   CA4  lăn tuần: clone cam kết mới (thuoc_id null) + RE-POINT cả chùm thước theo.
--   CA5  xoá cam kết → chùm thước rụng theo (FK cascade).
--   CA6  gợi ý máy: TẤT CẢ thước đạt → 'thang'; còn một cái lửng → KHÔNG 'thang'.

begin;
do $$
declare
  v_mon date := date_trunc('week', vn_today())::date;
  v_sid uuid; v_sid2 uuid; v_cid uuid; v_dv uuid;
  v_ck uuid; v_ck2 uuid; v_moi uuid; v_th1 uuid; v_th2 uuid;
  v_cnt int; v_goi text; v_dow int := extract(isodow from vn_today())::int;
begin
  select id into v_sid from profiles where email = 'test1.hs@student.truongvietanh.com';
  select id into v_sid2 from profiles where email = 'agent1@test.truongvietanh.com';
  select id into v_cid from classes where name = 'Test' and is_active limit 1;
  if v_sid is null or v_sid2 is null or v_cid is null then raise exception 'Thiếu tài khoản/lớp Test'; end if;
  select id into v_dv from don_vi where ma in ('ngay','lan') order by (ma = 'ngay') desc limit 1;

  -- Dọn trong giao dịch cho dòng sạch (rollback trả nguyên trạng).
  delete from cam_ket_xac_nhan where cam_ket_id in (select id from cam_ket where student_id in (v_sid, v_sid2));
  delete from thuoc where student_id in (v_sid, v_sid2) and chu_the = 'em';
  delete from cam_ket where student_id in (v_sid, v_sid2);

  -- ── CA1: 3 thước cho MỘT cam kết ─────────────────────────────────────────────
  insert into cam_ket(chu_the,class_id,student_id,noi_dung,so_tuan,tuan_bat_dau)
  values('em',v_cid,v_sid,'ZZTEST-nhieu-thuoc',1,v_mon) returning id into v_ck;
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
  values('em',v_cid,v_sid,'ZZT-thuoc-1',v_dv,'cham','it_nhat','tong',1,1,1,array[v_dow]::smallint[],'tung_em',v_mon,'duyet','chay',v_ck)
  returning id into v_th1;
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
  values('em',v_cid,v_sid,'ZZT-thuoc-2',v_dv,'cham','it_nhat','tong',1,1,1,array[v_dow]::smallint[],'tung_em',v_mon,'duyet','chay',v_ck)
  returning id into v_th2;
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
  values('em',v_cid,v_sid,'ZZT-thuoc-3',v_dv,'cham','it_nhat','tong',1,3,1,array[1,2,3,4,5]::smallint[],'tung_em',v_mon,'duyet','chay',v_ck);
  select count(*) into v_cnt from thuoc where cam_ket_id = v_ck;
  if v_cnt <> 3 then raise exception 'CA1 HỎNG: mong 3 thước treo cam kết, có %', v_cnt; end if;
  raise notice 'CA1 OK — một cam kết treo 3 thước';

  -- ── CA2: neo chủ thể — thước của agent1 không gắn vào cam kết của test1 ──────
  begin
    insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
    values('em',v_cid,v_sid2,'ZZT-thuoc-lech',v_dv,'cham','it_nhat','tong',1,1,1,array[1]::smallint[],'tung_em',v_mon,'duyet','chay',v_ck);
    raise exception 'CA2 HỎNG: thước của em khác vẫn gắn được vào cam kết của em này';
  exception when others then
    if sqlerrm like 'CA2 HỎNG%' then raise; end if;
    raise notice 'CA2 OK — neo chủ thể chặn: %', sqlerrm;
  end;

  -- ── CA3: trần 2 cam kết/tuần (giả phiên em để trigger đếm trần chạy) ─────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_sid, 'role', 'authenticated')::text, true);
  insert into cam_ket(chu_the,class_id,student_id,noi_dung,so_tuan,tuan_bat_dau)
  values('em',v_cid,v_sid,'ZZTEST-ck-2',1,v_mon) returning id into v_ck2;
  begin
    insert into cam_ket(chu_the,class_id,student_id,noi_dung,so_tuan,tuan_bat_dau)
    values('em',v_cid,v_sid,'ZZTEST-ck-3',1,v_mon);
    raise exception 'CA3 HỎNG: cam kết thứ 3 trong tuần vẫn lọt (trần 2 phải chặn)';
  exception when others then
    if sqlerrm like 'CA3 HỎNG%' then raise; end if;
    raise notice 'CA3 OK — trần 2/tuần vẫn chặn: %', sqlerrm;
  end;
  perform set_config('request.jwt.claims', '', true);
  delete from cam_ket where id = v_ck2;                       -- dọn để CA6 không vướng trần

  -- ── CA4: lăn tuần re-point cả chùm ───────────────────────────────────────────
  -- Gieo dòng agent1: cam kết KẾT THÚC tuần trước + 2 thước treo nó.
  insert into cam_ket(chu_the,class_id,student_id,noi_dung,so_tuan,tuan_bat_dau)
  values('em',v_cid,v_sid2,'ZZTEST-lan-chum',1,v_mon - 7) returning id into v_ck2;
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
  values('em',v_cid,v_sid2,'ZZT-lan-a',v_dv,'cham','it_nhat','tong',1,2,1,array[1,2]::smallint[],'tung_em',v_mon - 7,'duyet','chay',v_ck2);
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai,cam_ket_id)
  values('em',v_cid,v_sid2,'ZZT-lan-b',v_dv,'cham','it_nhat','tong',1,2,1,array[3,4]::smallint[],'tung_em',v_mon - 7,'duyet','chay',v_ck2);
  perform lan_cam_ket_tuan();
  select id into v_moi from cam_ket
    where student_id = v_sid2 and noi_dung = 'ZZTEST-lan-chum' and tuan_bat_dau = v_mon and trang_thai = 'hieu_luc';
  if v_moi is null then raise exception 'CA4 HỎNG: không thấy bản clone tuần này'; end if;
  select count(*) into v_cnt from thuoc where cam_ket_id = v_moi;
  if v_cnt <> 2 then raise exception 'CA4 HỎNG: mong CẢ CHÙM 2 thước re-point sang bản mới, có %', v_cnt; end if;
  select count(*) into v_cnt from thuoc where cam_ket_id = v_ck2;
  if v_cnt <> 0 then raise exception 'CA4 HỎNG: bản cũ vẫn giữ % thước', v_cnt; end if;
  raise notice 'CA4 OK — lăn tuần re-point cả chùm 2 thước';

  -- ── CA5: xoá cam kết → chùm thước rụng theo (cascade) ────────────────────────
  delete from cam_ket where id = v_moi;
  select count(*) into v_cnt from thuoc where student_id = v_sid2 and ten like 'ZZT-lan-%';
  if v_cnt <> 0 then raise exception 'CA5 HỎNG: xoá cam kết mà còn % thước mồ côi', v_cnt; end if;
  raise notice 'CA5 OK — xoá cam kết là chùm thước rụng theo';

  -- ── CA6: gợi ý máy — đủ TẤT CẢ mới "có vẻ Thắng" ─────────────────────────────
  -- Hai thước tick hôm nay (chi_tieu 1, chỉ áp dụng hôm nay): tick CẢ HAI → thang.
  -- Thước thứ 3 (chi_tieu 3, chưa tick) đang lửng → tổng thể KHÔNG được 'thang'.
  insert into luot(thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th1, v_sid, vn_today(), 1, 'tay');
  select g.goi_y into v_goi from goi_y_cam_ket(v_ck) g;
  if v_goi = 'thang' then raise exception 'CA6a HỎNG: mới 1/3 thước đạt mà đã gợi ý Thắng'; end if;
  raise notice 'CA6a OK — còn thước lửng thì không Thắng (goi_y = %)', coalesce(v_goi, 'im lặng');
  -- Gỡ thước 3 (lửng) + tick nốt thước 2 → cả chùm đạt → thang.
  delete from thuoc where cam_ket_id = v_ck and ten = 'ZZT-thuoc-3';
  insert into luot(thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th2, v_sid, vn_today(), 1, 'tay');
  select g.goi_y into v_goi from goi_y_cam_ket(v_ck) g;
  if v_goi is distinct from 'thang' then
    raise exception 'CA6b HỎNG: cả chùm đạt mà gợi ý là %', coalesce(v_goi, 'null');
  end if;
  raise notice 'CA6b OK — tất cả thước đạt → có vẻ Thắng';

  raise notice 'TẤT CẢ 6 CA ĐẠT — một cam kết nhiều thước chạy đúng.';
end $$;
rollback;
