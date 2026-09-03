-- KIỂM "cam kết tự lăn sang tuần sau" (hàm lan_cam_ket_tuan, migration 0177).
-- An toàn: chạy trong GIAO DỊCH rồi ROLLBACK — không để lại gì trên CSDL thật.
-- Cần: đã cài 0177. Chạy:  npm run sql -- scripts/test-lan-cam-ket.sql
--
-- Ba ca (mỗi ca fail thì raise exception → thấy ngay):
--   CA1  bản kết thúc tuần trước → lăn sang tuần này, DÙNG LẠI cùng lead measure.
--   CA2  chạy lại → KHÔNG nhân đôi (idempotent).
--   CA3  "đổi" (đánh dấu 'huy' bản tuần này) → chạy → KHÔNG mọc lại (dòng dừng).

begin;
do $$
declare
  v_mon date := date_trunc('week', vn_today())::date;   -- thứ Hai tuần này
  v_sid uuid; v_cid uuid; v_mt uuid; v_dv uuid; v_thuoc uuid; v_cnt int;
begin
  select id into v_sid from profiles where email = 'test1.hs@student.truongvietanh.com';
  select id into v_cid from classes where name = 'Test' and is_active limit 1;
  if v_sid is null or v_cid is null then raise exception 'Thiếu student/lớp Test để kiểm'; end if;
  select id into v_dv from don_vi where ma in ('ngay','lan') order by (ma = 'ngay') desc limit 1;
  select id into v_mt from muc_tieu where class_id = v_cid and cap = 'lop' and trang_thai <> 'dong' limit 1;

  -- Dọn SẠCH cam kết hiện có của em này (trong giao dịch, rollback trả lại nguyên trạng) để dòng
  -- (em × mục tiêu) sạch — nếu không, cam kết THẬT tuần này của em sẽ là "bản mới nhất" và che bản
  -- tuần-trước ta gieo (đúng logic: bản tuần này chưa kết thúc nên chưa lăn).
  delete from cam_ket_xac_nhan where cam_ket_id in (select id from cam_ket where student_id = v_sid);
  delete from cam_ket where student_id = v_sid;

  -- Lead measure của em + cam kết KẾT THÚC tuần trước (tuan_bat_dau = thứ Hai tuần này − 7).
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai)
  values('em',v_cid,v_sid,'ZZTEST-lan-viec',v_dv,'cham','it_nhat','tong',1,5,1,array[1,2,3,4,5]::smallint[],'tung_em',v_mon - 7,'duyet','chay')
  returning id into v_thuoc;
  insert into cam_ket(chu_the,class_id,student_id,noi_dung,so_tuan,tuan_bat_dau,muc_tieu_id,thuoc_id)
  values('em',v_cid,v_sid,'ZZTEST-lan-camket',1,v_mon - 7,v_mt,v_thuoc);

  -- CA1 — lăn sang tuần này + giữ nguyên lead measure
  perform lan_cam_ket_tuan();
  select count(*) into v_cnt from cam_ket
    where student_id=v_sid and noi_dung='ZZTEST-lan-camket' and tuan_bat_dau=v_mon and trang_thai='hieu_luc';
  if v_cnt <> 1 then raise exception 'CA1 HỎNG: mong 1 bản tuần này, có %', v_cnt; end if;
  perform 1 from cam_ket
    where student_id=v_sid and noi_dung='ZZTEST-lan-camket' and tuan_bat_dau=v_mon and thuoc_id=v_thuoc;
  if not found then raise exception 'CA1b HỎNG: bản mới KHÔNG dùng lại lead measure cũ'; end if;
  raise notice 'CA1 OK — lăn sang tuần này, giữ nguyên lead measure';

  -- CA2 — chạy lại không nhân đôi
  perform lan_cam_ket_tuan();
  select count(*) into v_cnt from cam_ket
    where student_id=v_sid and noi_dung='ZZTEST-lan-camket' and tuan_bat_dau=v_mon;
  if v_cnt <> 1 then raise exception 'CA2 HỎNG (nhân đôi): có % bản tuần này', v_cnt; end if;
  raise notice 'CA2 OK — chạy lại không nhân đôi';

  -- CA3 — "đổi": đánh dấu 'huy' bản tuần này → lăn → không mọc lại
  update cam_ket set trang_thai='huy'
    where student_id=v_sid and noi_dung='ZZTEST-lan-camket' and tuan_bat_dau=v_mon;
  perform lan_cam_ket_tuan();
  select count(*) into v_cnt from cam_ket
    where student_id=v_sid and noi_dung='ZZTEST-lan-camket' and tuan_bat_dau=v_mon and trang_thai='hieu_luc';
  if v_cnt <> 0 then raise exception 'CA3 HỎNG: đổi (huy) rồi vẫn mọc lại % bản', v_cnt; end if;
  raise notice 'CA3 OK — đổi → dòng dừng, không lăn nữa';

  raise notice '✔ TẤT CẢ TEST ĐẠT';
end $$;
rollback;
