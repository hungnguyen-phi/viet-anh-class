-- 0183 — BỎ KHOÁ "ĐỢI THỨ SÁU MỚI CHẤM" (chủ dự án chốt 03/09/2026)
--
-- Mô hình tự-hứa-tự-chấm: em và thầy cô điền số đạt + Thắng/Thua lúc nào cũng được trong tuần,
-- nhập sai thì sửa lại ngay. Khoá "chấm từ thứ Sáu tuần cuối" (0165) gỡ bỏ; các luật còn lại giữ
-- nguyên: ký PDR là chốt, bỏ chấm xoá sạch chữ ký, chống giả chữ ký.
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef trên production (03/09/2026): thân hàm live TRÙNG bản 0165
-- trong repo. Bản dưới đây chép từ LIVE, chỉ bỏ đúng khối raise "Đợi đến thứ Sáu".

CREATE OR REPLACE FUNCTION private.ck_truoc_sua()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['ket_qua','cham_boi','cham_at','so_dat','xong_at',
      'goi_y','trang_thai','nguoi_nhap_ho','updated_at','class_id'];
  v_tu_pdr boolean := coalesce(current_setting('va.tu_pdr', true), '') = '1';
  v_doi boolean; v_ket_thuc date; v_cham_doi boolean;
begin
  if v_me is null and not v_tu_pdr then return new; end if;
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của cam kết chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if v_tu_pdr then return new; end if;               -- pkl_sau_ghi tự đặt đủ bộ chấm — khe hẹp có điều kiện
  v_doi := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ket_thuc := new.tuan_bat_dau + (new.so_tuan - 1) * 7;
  if v_doi then
    if cam_ket_da_ke_lai(new.id) then
      raise exception 'Cam kết này đã được kể lại trong buổi họp nên không sửa được nữa' using errcode = '42501';
    end if;
    if old.ket_qua is not null then
      raise exception 'Cam kết đã chấm rồi — muốn sửa thì nhờ thầy cô' using errcode = '42501';
    end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    if (new.tuan_bat_dau, new.so_tuan) is distinct from (old.tuan_bat_dau, old.so_tuan) then
      perform private.ck_kiem_tran_tuan(new);        -- đổi tuần thì đếm lại trần
    end if;
  end if;
  v_cham_doi := (new.ket_qua, new.so_dat, new.xong_at) is distinct from (old.ket_qua, old.so_dat, old.xong_at);
  if v_cham_doi then
    if new.chu_the = 'em' then
      if v_me <> new.student_id and not (is_class_teacher(new.class_id) and lop_nhap_ho(new.class_id)) then
        raise exception 'Em tự chấm Thắng/Thua cho cam kết của mình; thầy cô chỉ chấm cam kết của lớp'
          using errcode = '42501';
      end if;
    elsif not (is_class_teacher(new.class_id) or (select auth_role()) = 'admin') then
      raise exception 'Cam kết của lớp do thầy cô chủ nhiệm chấm' using errcode = '42501';
    end if;
    if cam_ket_da_ke_lai(new.id) then                -- ký là chốt — không chấm lại sau ký
      raise exception 'Cam kết này đã chốt trong buổi họp — muốn sửa thì nhờ thầy cô mở tuần' using errcode = '42501';
    end if;
    if new.ket_qua is not null and old.ket_qua is null then
      -- 0183: bỏ khoá "đợi thứ Sáu" — chấm lúc nào cũng được, sai thì sửa lại (chốt 03/09/2026).
      new.cham_boi := v_me; new.cham_at := now();
      select g.goi_y into new.goi_y from public.goi_y_cam_ket(new.id) g;    -- ẢNH CHỤP gợi ý lúc chấm (hàm trả BẢNG)
      new.xong_at := coalesce(new.xong_at, now());
    elsif new.ket_qua is null and old.ket_qua is not null then
      new.cham_boi := null; new.cham_at := null; new.goi_y := null;
      new.so_dat := null; new.xong_at := null;       -- bỏ chấm (cùng người được chấm)
    else
      new.cham_boi := v_me; new.cham_at := now();     -- sửa so_dat/xong_at trên dòng đã chấm
    end if;
  else
    new.cham_boi := old.cham_boi; new.cham_at := old.cham_at; new.goi_y := old.goi_y;  -- chống giả chữ ký
  end if;
  if new.trang_thai = 'huy' and old.trang_thai <> 'huy'
     and (cam_ket_da_ke_lai(new.id) or old.ket_qua is not null) then
    raise exception 'Cam kết đã kể lại hoặc đã chấm thì không huỷ được' using errcode = '42501';
  end if;
  return new;
end $function$
;
