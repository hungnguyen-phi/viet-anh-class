-- 0184 — SỬA/XOÁ THƯỚC ĐO DẪN DẮT CÁ NHÂN CỦA GIÁO VIÊN (chủ dự án yêu cầu 03/09/2026)
--
-- 0181 cho GVCN tạo thước cá nhân TỰ DUYỆT (duyet='duyet', da_tung_duyet=true). Nhưng hai luật cũ
-- coi da_tung_duyet là "đông cứng vì thầy cô đã duyệt của EM" nên khoá luôn đồ CHÍNH CHỦ:
--   · th_truoc_sua chặn sửa nội dung ("Việc này thầy cô đã duyệt rồi…")
--   · rls_delete_thuoc chặn xoá (đòi duyet<>'duyet' và chưa từng duyệt)
-- Mở đúng MỘT trường hợp: thước chu_the='em' mà người sửa/xoá CHÍNH LÀ chủ và là GV của lớp.
-- Của em giữ nguyên luật cũ; "đã có lượt thì không đổi cách đo/đơn vị" và trigger th_truoc_xoa
-- ("đã có lượt — kết thúc thay vì xoá") vẫn nguyên cho tất cả.
--
-- ĐÃ ĐỐI CHIẾU production (03/09/2026): th_truoc_sua live TRÙNG bản 0164 trong repo (chép từ
-- LIVE, chỉ nới đúng một guard); policy rls_delete_thuoc live trùng 0164:581.

CREATE OR REPLACE FUNCTION private.th_truoc_sua()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := (select auth.uid());
  -- L5/L11. 'chu_the_key' phải có: cột GENERATED stored đọc NULL trong NEW của BEFORE UPDATE (OLD có
  -- giá trị) → nếu không lược, to_jsonb(new) khác to_jsonb(old) ở khoá này ⇒ MỌI update bị coi là đổi
  -- nội dung. An toàn vì chu_the_key suy hoàn toàn từ chu_the/student_id/nhom_id/class_id (đã gác riêng).
  v_khong_noi_dung constant text[] := array['trang_thai','cho_bu','den_tuan','duyet','duyet_boi',
      'duyet_at','ly_do_tra_lai','da_tung_duyet','nguoi_nhap_ho','updated_at','class_id','chu_the_key'];
  v_doi boolean; v_ghi boolean; v_duyet boolean;
begin
  if v_me is null then return new; end if;
  new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;            -- ép về old NGAY ĐẦU (góp ý #15):
  new.da_tung_duyet := old.da_tung_duyet;                                  -- chỉ nhánh duyệt phía dưới được đổi
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của việc chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if (new.chu_the, new.student_id, new.nhom_id, new.subject_id)
     is distinct from (old.chu_the, old.student_id, old.nhom_id, old.subject_id) then
    raise exception 'Không đổi được chủ của việc — tạo việc mới' using errcode = '42501';
  end if;
  -- Khe hẹp hệ thống (GHI CHÚ TÍCH HỢP c): thls_sau_xoa / thls_truoc_sua trả cờ 'gui'→'duyet' khi
  -- em rút / GVCN xử dòng hạ chỉ tiêu. Nội dung KHÔNG đổi, chữ ký/da_tung_duyet giữ nguyên (đã ép
  -- về old ở trên). KHÔNG phải "em tự duyệt"; cờ do trigger anh em bật, không phải người ghi.
  if coalesce(current_setting('va.th_duyet_dong_bo', true), '') = '1'
     and old.duyet = 'gui' and new.duyet = 'duyet'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung) then
    return new;
  end if;
  -- Đổi tên qua yêu cầu đã duyệt: cờ phiên + ĐÚNG MỘT cột 'ten' đổi (điều kiện nội dung kèm cờ — L6).
  if coalesce(current_setting('va.doi_ten_qua_yeu_cau', true), '') = '1'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung || array['ten']) then
    return new;
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_thuoc(new.id);
  v_duyet := duyet_duoc_thuoc(new.id);
  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung việc của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    -- 0184: thước CÁ NHÂN thầy cô tự đứng tên (0181 tạo với da_tung_duyet=true vì tự duyệt) KHÔNG
    -- đông cứng — tự hứa tự chấm thì sửa tùy thích; guard "đã có lượt" phía dưới vẫn giữ nguyên.
    if old.da_tung_duyet
       and not (old.chu_the = 'em' and old.student_id = v_me and is_class_teacher(old.class_id)) then
      raise exception 'Việc này thầy cô đã duyệt rồi. Muốn đổi chỉ tiêu thì đổi từ tuần sau; muốn đổi tên thì gửi yêu cầu cho thầy cô'
        using errcode = '42501';
    end if;
    if exists (select 1 from luot l where l.thuoc_id = new.id)
       and (new.cach_ghi, new.gop, new.chieu_dich, new.don_vi_id, new.pham_vi, new.ky_tuan, new.tu_tuan, new.nguong_moi_lan)
           is distinct from (old.cach_ghi, old.gop, old.chieu_dich, old.don_vi_id, old.pham_vi, old.ky_tuan, old.tu_tuan, old.nguong_moi_lan) then
      raise exception 'Đã có lượt ghi — kết thúc việc này và tạo việc mới' using errcode = '23514';
    end if;
    if old.duyet = 'tra_lai' then new.duyet := 'gui'; new.ly_do_tra_lai := null; end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  end if;
  if new.duyet is distinct from old.duyet and not (v_doi and new.duyet = 'gui') then
    if new.duyet = 'duyet' then
      if not v_duyet then raise exception 'Chỉ thầy cô chủ nhiệm mới duyệt được việc này' using errcode = '42501'; end if;
      new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null; new.da_tung_duyet := true;
      if coalesce(current_setting('va.th_duyet_dong_bo', true), '') <> '1' then   -- chặn vòng chéo (GHI CHÚ c)
        perform set_config('va.th_duyet_dong_bo', '1', true);
        update thuoc_lich_su set trang_thai = 'hieu_luc', duyet_boi = v_me, duyet_at = now()
          where thuoc_id = new.id and trang_thai = 'cho_duyet';
        perform set_config('va.th_duyet_dong_bo', '', true);
      end if;
    elsif new.duyet = 'tra_lai' then
      if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
      if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
        raise exception 'Trả lại thì phải ghi lý do' using errcode = '23514';
      end if;
      new.duyet_boi := null; new.duyet_at := null;
    elsif new.duyet = 'gui' then
      if not v_ghi then raise exception 'Chỉ chủ việc mới gửi duyệt được' using errcode = '42501'; end if;
    end if;
  end if;             -- không nhánh restore: đã ép về old ngay đầu, kể cả ca (v_doi ∧ duyet='gui')
  if new.den_tuan is distinct from old.den_tuan and new.den_tuan is not null and new.den_tuan < vn_week_start() then
    raise exception 'Kết thúc việc sớm nhất là hết tuần này' using errcode = '23514';
  end if;
  if new.trang_thai is distinct from old.trang_thai and not (v_ghi or v_duyet) then
    raise exception 'Không có quyền tạm dừng hay đóng việc này' using errcode = '42501';
  end if;
  return new;
end $function$
;

-- Xoá: mở thêm vế chính-chủ-GVCN. th_truoc_xoa vẫn chặn khi đã có lượt ghi.
drop policy if exists rls_delete_thuoc on thuoc;
create policy rls_delete_thuoc on thuoc for delete to authenticated
  using (ghi_duoc_thuoc(id)
         and ((duyet <> 'duyet' and not da_tung_duyet)
              or (chu_the = 'em' and student_id = (select auth.uid()) and is_class_teacher(class_id))));


-- ─────────────────────────────────────────────────────────────────────────────────────
-- VÁ KÈM (phát hiện khi kiểm nút "Bỏ chấm"): ck_truoc_sua thiếu hai cột GENERATED trong
-- danh sách lược diff → bỏ chấm / sửa số đạt trên dòng đã chấm LUÔN bị chặn oan.
-- (Bản live = 0183 vừa chạy, đối chiếu 03/09 — chép nguyên văn, chỉ thêm hai cột vào mảng.)
-- ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ck_truoc_sua()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := (select auth.uid());
  -- 0184: 'tuan_ket_thuc' + 'lac_muc_tieu' là cột GENERATED STORED — trong BEFORE UPDATE, NEW đọc
  -- NULL còn OLD có giá trị, nên thiếu chúng thì doi_noi_dung LUÔN thấy "khác" ⇒ MỌI update lên dòng
  -- ĐÃ CHẤM (bỏ chấm, sửa số đạt) văng "Cam kết đã chấm rồi". Cùng lỗ mt.chu_the_key đã vá ở 0163;
  -- chính ghi chú 0163 đã tiên tri chỗ này. An toàn: hai cột suy từ tuan_bat_dau/so_tuan/thuoc_id/
  -- muc_tieu_id — các cột gốc vẫn được diff riêng.
  v_khong_noi_dung constant text[] := array['ket_qua','cham_boi','cham_at','so_dat','xong_at',
      'goi_y','trang_thai','nguoi_nhap_ho','updated_at','class_id','tuan_ket_thuc','lac_muc_tieu'];
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
