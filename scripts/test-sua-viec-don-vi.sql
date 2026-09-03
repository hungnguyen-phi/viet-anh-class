-- KIỂM "Sửa ĐƠN VỊ + CÁCH ĐO của thước đo dẫn dắt" — luật ở trigger th_truoc_sua (0164).
-- Tự chứa: chạy trong GIAO DỊCH rồi ROLLBACK — KHÔNG để lại gì. Không cần cài migration nào (chỉ
-- test luật trigger đang chạy).  Chạy:  npm run sql -- scripts/test-sua-viec-don-vi.sql
--
-- Hai ca:
--   CA1  CHƯA có lượt → đổi cách đo (cham→dien_so) + đơn vị → ĐỔI ĐƯỢC.
--   CA2  ĐÃ có lượt   → đổi cách đo/đơn vị → BỊ CHẶN (trigger raise, không đổi).
-- (Chạy dưới ngữ cảnh EM để th_truoc_sua thực thi — auth null thì trigger thoát sớm, không kiểm.)

begin;
do $$
declare
  v_mon date := date_trunc('week', vn_today())::date;
  v_sid uuid; v_cid uuid; v_dv_ngay uuid; v_dv_lan uuid; v_th uuid;
  v_cach text; v_dv uuid; v_chan boolean;
begin
  select id into v_sid from profiles where email='test1.hs@student.truongvietanh.com';
  select id into v_cid from classes where name='Test' and is_active limit 1;
  select id into v_dv_ngay from don_vi where ma in ('ngay','lan') order by (ma='ngay') desc limit 1;
  select id into v_dv_lan  from don_vi where ma='lan' limit 1;
  if v_sid is null or v_cid is null or v_dv_ngay is null or v_dv_lan is null then
    raise exception 'Thiếu student/lớp Test/đơn vị';
  end if;

  -- Gieo thước đo dẫn dắt của em ('cham', đơn vị "ngày") — postgres (auth null) → th_truoc_them thoát sớm.
  insert into thuoc(chu_the,class_id,student_id,ten,don_vi_id,cach_ghi,chieu_dich,gop,ky_tuan,chi_tieu_ky,moi_lan,ngay_ap_dung,pham_vi,tu_tuan,duyet,trang_thai)
  values('em',v_cid,v_sid,'ZZTEST-sua-dv',v_dv_ngay,'cham','it_nhat','tong',1,5,1,array[1,2,3,4,5]::smallint[],'tung_em',v_mon,'gui','chay')
  returning id into v_th;

  -- Ngữ cảnh EM để th_truoc_sua kiểm quyền/luật.
  perform set_config('request.jwt.claims', json_build_object('sub', v_sid::text)::text, true);

  -- CA1 — chưa lượt: đổi sang 'dien_so' + đơn vị 'lần' + đích 20 → phải đổi được
  update thuoc set cach_ghi='dien_so', don_vi_id=v_dv_lan, moi_lan=null, chi_tieu_ky=20 where id=v_th;
  select cach_ghi, don_vi_id into v_cach, v_dv from thuoc where id=v_th;
  if v_cach <> 'dien_so' or v_dv <> v_dv_lan then
    raise exception 'CA1 HỎNG: chưa tick mà không đổi được (cach=%, dv khớp lần=%)', v_cach, (v_dv=v_dv_lan);
  end if;
  raise notice 'CA1 OK — chưa tick thì đổi được cách đo + đơn vị';

  -- CA2 — có lượt: đổi cách đo/đơn vị phải BỊ CHẶN. Gieo lượt như hệ thống (auth null) để khỏi vướng cửa sổ.
  perform set_config('request.jwt.claims', '', true);
  insert into luot(thuoc_id, student_id, ngay, gia_tri) values(v_th, v_sid, v_mon, 1);
  perform set_config('request.jwt.claims', json_build_object('sub', v_sid::text)::text, true);
  v_chan := false;
  begin
    update thuoc set cach_ghi='cham', don_vi_id=v_dv_ngay, moi_lan=1 where id=v_th;
  exception when others then v_chan := true;
  end;
  if not v_chan then raise exception 'CA2 HỎNG: đã tick mà vẫn đổi được cách đo/đơn vị'; end if;
  raise notice 'CA2 OK — đã tick thì KHÔNG đổi cách đo/đơn vị (chặn đúng)';

  raise notice '✔ TẤT CẢ TEST ĐẠT';
end $$;
rollback;
