-- 0181 — WIG CÁ NHÂN CỦA GIÁO VIÊN + nối lên lớp/trường (chốt với chủ dự án 03/09/2026)
--
-- Mô hình đổi: cam kết tuần + thước đo dẫn dắt KHÔNG treo ở mục tiêu lớp nữa. Thầy cô có mục
-- tiêu CÁ NHÂN (cap='em', student_id=thầy cô, class_id=lớp chủ nhiệm) y như em; cam kết + thước
-- của thầy cô treo ở đó (chu_the='em'). Mục tiêu cá nhân nối vào mục tiêu lớp: luôn chi_huong,
-- CÙNG đơn vị thì thêm gop_so và mục tiêu lớp chuyển nguon_so='con' (máy so_hien_tai 0173 tự
-- cộng). Mục tiêu lớp nối lên mục tiêu trường (cap='truong') theo cùng luật.
--
-- Chuỗi 'em' trong cap/chu_the từ nay nghĩa là "CÁ NHÂN" (em hoặc thầy cô đứng tên chính mình);
-- không đổi tên cột vì nó nằm khắp constraint/policy/trigger đang chạy.
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef trên production (03/09/2026) trước khi create or replace:
--   ghi_duoc_chu_the, ck_truoc_them, th_truoc_them, mt_truoc_sua — bản live TRÙNG bản trong
--   repo (0163/0164/0165 + vá 0167 không đụng các hàm này). Các policy đối chiếu qua pg_policies.

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Hàm mới: X có phải GVCN của lớp C — như is_class_teacher nhưng xét NGƯỜI BẤT KỲ
--    (trigger cần xét new.student_id, không phải auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.la_gvcn_cua(c uuid, p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from classes where id = c and homeroom_teacher_id = p);
$$;
revoke execute on function public.la_gvcn_cua(uuid, uuid) from public, anon;
grant execute on function public.la_gvcn_cua(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. ghi_duoc_chu_the — nhánh 'em' thêm: thầy cô đứng tên CHÍNH MÌNH trong lớp mình chủ nhiệm.
--    (Bản live = 0163:202, chỉ thêm một vế.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.ghi_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then (p_student = (select auth.uid()) and is_class_student(p_class))
                    or (p_student = (select auth.uid()) and is_class_teacher(p_class))   -- 0181: WIG cá nhân của GVCN
                    or (is_class_teacher(p_class) and lop_nhap_ho(p_class))
    when 'nhom'   then is_class_teacher(p_class)
    when 'lop'    then is_class_teacher(p_class)
                    or ((select auth_role()) = 'principal' and is_campus_class(p_class))
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. ck_truoc_them — check "còn học ở lớp" cho qua khi người đứng tên là GVCN của lớp.
--    (Bản live = 0165:691, chỉ nới một guard.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.ck_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_th thuoc%rowtype; v_mt muc_tieu%rowtype;
begin
  if v_me is null then return new; end if;                                   -- L6
  new.created_by := v_me;
  if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  new.ket_qua := null; new.cham_boi := null; new.cham_at := null;            -- không chấm lúc tạo
  new.so_dat := null; new.xong_at := null; new.goi_y := null;
  new.trang_thai := 'hieu_luc';
  -- 0181: cam kết cá nhân của GVCN — thầy cô không có enrollment, xét homeroom thay.
  if new.chu_the = 'em'
     and not exists (select 1 from enrollments e
       where e.class_id = new.class_id and e.student_id = new.student_id and e.is_active)
     and not la_gvcn_cua(new.class_id, new.student_id) then
    raise exception 'Em này không còn học ở lớp' using errcode = '23503';
  end if;
  if new.thuoc_id is not null then                                           -- neo cùng chủ thể
    select * into v_th from thuoc where id = new.thuoc_id;
    if v_th.id is null or v_th.class_id is distinct from new.class_id
       or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
      raise exception 'Việc gắn vào cam kết phải là việc của em hoặc của lớp/nhóm em' using errcode = '23514';
    end if;
  end if;
  if new.muc_tieu_id is not null then
    select * into v_mt from muc_tieu where id = new.muc_tieu_id;
    if v_mt.id is null or (v_mt.cap <> 'truong' and v_mt.class_id is distinct from new.class_id)
       or (v_mt.cap = 'em' and v_mt.student_id is distinct from new.student_id) then
      raise exception 'Mục tiêu gắn vào cam kết phải là mục tiêu của em hoặc của lớp/nhóm em' using errcode = '23514';
    end if;
  end if;
  if new.pdr_meeting_id is not null and exists (select 1 from pdr_meetings p
       where p.id = new.pdr_meeting_id and p.student_id is distinct from new.student_id) then
    raise exception 'Biên bản họp không phải của em này' using errcode = '23514';
  end if;
  perform private.ck_kiem_tran_tuan(new);
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. RLS cam_ket + thuoc — vế "em tự đứng tên" nhận cả GVCN của lớp (is_class_teacher xét
--    auth.uid() nên "student_id = auth.uid() ∧ is_class_teacher" = đúng thầy cô ấy).
--    (Đối chiếu pg_policies: bản live trùng 0165:981/0164:566.)
-- ─────────────────────────────────────────────────────────────────────────────────────
drop policy if exists rls_insert_cam_ket on cam_ket;
create policy rls_insert_cam_ket on cam_ket for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid())
        and (is_class_student(class_id) or is_class_teacher(class_id)))                 -- 0181
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))));

drop policy if exists rls_update_cam_ket on cam_ket;
create policy rls_update_cam_ket on cam_ket for update to authenticated
  using (ghi_duoc_cam_ket(id))
  with check (
       (select auth_role()) = 'admin'
    or (chu_the = 'em' and (student_id = (select auth.uid())
                            or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id)));
-- (with_check của update vốn đã nhận student_id = auth.uid() không kèm is_class_student — giữ nguyên,
--  chép lại chỉ để hai policy sống cạnh nhau cùng một chỗ trong lịch sử.)

drop policy if exists rls_insert_thuoc on thuoc;
create policy rls_insert_thuoc on thuoc for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid())
        and (is_class_student(class_id) or is_class_teacher(class_id)))                 -- 0181
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
    or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))));

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. th_truoc_them — thước cá nhân do GVCN tự đứng tên: hiệu lực ngay (như thước lớp [H-07]);
--    không có ai "trên" GVCN để duyệt thước cá nhân của chính họ.
--    (Bản live = 0164:272, thêm một nhánh elsif.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.th_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then return new; end if;                                 -- L6 (seed/máy đi qua)
  new.created_by := v_me;
  if new.tu_tuan is null then new.tu_tuan := vn_week_start(); end if;
  new.trang_thai := 'chay'; new.da_tung_duyet := false;
  if new.chu_the = 'em' and v_me <> new.student_id then
    new.nguoi_nhap_ho := v_me; new.duyet := 'gui';                         -- nhập hộ: dấu vết, vẫn chờ duyệt
  elsif new.chu_the = 'em' and v_me = new.student_id and is_class_teacher(new.class_id) then
    new.duyet := 'duyet'; new.da_tung_duyet := true;                       -- 0181: thước cá nhân của GVCN
  elsif staff_can_manage_class(new.class_id) and new.chu_the in ('lop','nhom') and new.subject_id is null then
    new.duyet := 'duyet'; new.da_tung_duyet := true;                       -- GVCN tạo thước lớp/nhóm: hiệu lực ngay [H-07]
  else
    new.duyet := 'gui';                                                    -- em; GVBM thước môn chờ GVCN [H-08]
  end if;
  if new.duyet = 'duyet' then new.duyet_boi := v_me; new.duyet_at := now();
  else new.duyet_boi := null; new.duyet_at := null; end if;
  perform private.th_kiem_tran(new);                                       -- trần ≤4 hàng/em (§3.3b)
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. mt_truoc_sua — khe hẹp ĐỔI NGUỒN SỐ: khi nối gop_so cùng đơn vị, hàm noi_wig_len_tren
--    (định nghĩa dưới) chuyển mục tiêu cha sang nguon_so='con' mà KHÔNG hạ trạng thái duyệt.
--    Cờ phiên va.doi_nguon_so chỉ hàm ấy bật, và chỉ khi đúng hai cột nguon_so/gop_con đổi.
--    (Bản live = 0163 + vá chu_the_key; chép nguyên văn, thêm MỘT nhánh early-return.)
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.mt_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['trang_thai','duyet_boi','duyet_at','ly_do_tra_lai',
      'dong_boi','dong_at','ly_do_dong','dang_tap_trung','nguoi_nhap_ho','updated_at',
      'class_id','campus_id',
      -- chu_the_key là cột GENERATED STORED: trong BEFORE UPDATE, new.chu_the_key = NULL (Postgres chỉ
      -- tính lại cột generated SAU mọi before-trigger), còn old.chu_the_key có giá trị → nếu KHÔNG loại
      -- khỏi diff thì doi_noi_dung LUÔN thấy "khác" và mọi update (kể cả chỉ đổi trạng thái để duyệt) bị
      -- hiểu nhầm là "đổi nội dung". Loại an toàn: nó suy từ cap/student_id/nhom_id/class_id/campus_id —
      -- các cột gốc ấy vẫn được diff riêng. (Đặc tả 20-QUYEN §3.2 thiếu cột này — vá tại đây; 0164
      -- th_truoc_sua và 0165 ck_truoc_sua có CÙNG lỗ với thuoc.chu_the_key / cam_ket.tuan_ket_thuc+lac_muc_tieu.)
      'chu_the_key'];                                                      -- L11
  v_doi boolean; v_ghi boolean; v_duyet boolean; v_key text;
begin
  if v_me is null then return new; end if;
  if (new.class_id is distinct from old.class_id or new.campus_id is distinct from old.campus_id)
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của mục tiêu chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  -- 0181: khe hẹp — noi_wig_len_tren (security definer) đổi ĐÚNG nguon_so/gop_con của mục tiêu
  -- cha khi nối gop_so cùng đơn vị. Không hạ trạng thái, không đòi quyền duyệt (hàm kia đã gác).
  if coalesce(current_setting('va.doi_nguon_so', true), '') = '1'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new),
                                  v_khong_noi_dung || array['nguon_so','gop_con']) then
    return new;
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_duyet := duyet_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_key   := old.chu_the_key;

  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung mục tiêu của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    if old.trang_thai = 'dong' then
      raise exception 'Mục tiêu đã đóng, không sửa được nữa' using errcode = '42501';
    end if;
    if new.cap = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    -- Người sửa KHÔNG đồng thời là người duyệt-của-cấp → nội dung về 'gui' (nháp giữ nháp).
    if not (v_duyet and v_ghi) and old.trang_thai in ('gui','duyet','tra_lai') then
      new.trang_thai := 'gui'; new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
    end if;
  end if;

  if old.trang_thai = 'dong' and new.trang_thai <> 'dong' and (select auth_role()) <> 'admin' then
    raise exception 'Mục tiêu đã đóng — muốn mở lại thì nhờ quản trị' using errcode = '42501';   -- [H-10]
  end if;

  if new.trang_thai is distinct from old.trang_thai
     and not (v_doi and new.trang_thai = 'gui' and old.trang_thai in ('gui','duyet','tra_lai')) then
    case new.trang_thai
      when 'duyet' then
        if not v_duyet then
          raise exception '%', case new.cap when 'lop' then 'Mục tiêu của lớp do ban giám hiệu duyệt'
                                            else 'Chỉ thầy cô chủ nhiệm mới duyệt được mục tiêu này' end
            using errcode = '42501';
        end if;
        perform private.mt_kiem_tran(v_key, new.nam_hoc, new.id);
        new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null;
      when 'tra_lai' then
        if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
        if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
          raise exception 'Trả lại thì phải ghi lý do để em biết sửa gì' using errcode = '23514';
        end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'gui' then
        if not v_ghi then raise exception 'Chỉ chủ mục tiêu mới gửi duyệt được' using errcode = '42501'; end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'nhap' then
        if not v_ghi or old.trang_thai not in ('gui','tra_lai') then
          raise exception 'Chỉ rút về nháp khi mục tiêu đang chờ duyệt hoặc bị trả lại' using errcode = '42501';
        end if;
        new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
      when 'dong' then
        if not (v_ghi or v_duyet) then
          raise exception 'Không có quyền đóng mục tiêu này' using errcode = '42501';
        end if;
        if new.ly_do_dong not in ('dat','doi','bo') then
          raise exception 'Đóng mục tiêu thì chọn: đã đạt, đổi mục tiêu khác, hay thôi không theo nữa'
            using errcode = '23514';
        end if;
        new.dong_boi := v_me; new.dong_at := now();
      else
        raise exception 'Trạng thái không hợp lệ' using errcode = '23514';
    end case;
  end if;

  if new.dang_tap_trung and not old.dang_tap_trung then
    perform private.mt_kiem_tap_trung(v_key, new.id);
  end if;
  -- Không ai nhét tay chữ ký: trạng thái không đổi thì chữ ký giữ nguyên giá trị cũ.
  if new.trang_thai = old.trang_thai then
    new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;
    new.dong_boi := old.dong_boi;  new.dong_at := old.dong_at;
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 7. noi_wig_len_tren — nối MỘT mục tiêu vào mục tiêu CẤP TRÊN, nguyên tử:
--      · luôn chi_huong (giữ hướng);
--      · CÙNG đơn vị → thêm gop_so + cha chuyển nguon_so='con', gop_con='cong' (máy tự cộng);
--      · KHÁC đơn vị → chỉ chi_huong, cha giữ nguyên (ghi tay).
--    Hai cặp hợp lệ:  con cap='em' của CHÍNH thầy cô → cha cap='lop' lớp chủ nhiệm;
--                     con cap='lop' (GVCN/ADMIN ghi được) → cha cap='truong' đã duyệt, cùng cơ sở.
--    SECURITY DEFINER — tự gác quyền bên trong, không dựa policy noi (vế gop_so của policy đòi
--    ghi được CHA, mà GVCN không ghi được mục tiêu trường).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.noi_wig_len_tren(p_con uuid, p_cha uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); con muc_tieu%rowtype; cha muc_tieu%rowtype;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  select * into con from muc_tieu where id = p_con;
  select * into cha from muc_tieu where id = p_cha;
  if con.id is null or cha.id is null then
    raise exception 'Không thấy mục tiêu để nối' using errcode = '23503';
  end if;
  if not ghi_duoc_muc_tieu(p_con) then
    raise exception 'Chỉ chủ mục tiêu mới nối được nó lên trên' using errcode = '42501';
  end if;
  if not ( (con.cap = 'em'  and con.student_id = v_me and cha.cap = 'lop'
            and cha.class_id = con.class_id and (is_class_teacher(con.class_id) or (select auth_role()) = 'admin'))
        or (con.cap = 'lop' and cha.cap = 'truong' and cha.trang_thai = 'duyet'
            and cha.campus_id = con.campus_id) ) then
    raise exception 'Chỉ nối được mục tiêu của mình lên mục tiêu lớp, hoặc mục tiêu lớp lên mục tiêu trường cùng cơ sở'
      using errcode = '42501';
  end if;
  insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'chi_huong', v_me)
    on conflict do nothing;
  if con.don_vi_id is not null and con.don_vi_id = cha.don_vi_id then
    -- Đổi nguồn số của cha TRƯỚC — trg_noi_hop_le đòi cha nguon_so='con' rồi mới nhận dây gop_so.
    if cha.nguon_so is distinct from 'con' then
      perform set_config('va.doi_nguon_so', '1', true);
      update muc_tieu set nguon_so = 'con', gop_con = 'cong' where id = p_cha;
      perform set_config('va.doi_nguon_so', '', true);
    end if;
    insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'gop_so', v_me)
      on conflict do nothing;
  end if;
end $$;
revoke execute on function public.noi_wig_len_tren(uuid, uuid) from public, anon;
grant execute on function public.noi_wig_len_tren(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 8. go_wig_len_tren — GỠ dây đã nối (cả chi_huong lẫn gop_so). Nếu cha không còn con
--    gop_so nào mà đang nguon_so='con' thì trả về ghi tay (không thì số hiện = 0 vô nghĩa).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.go_wig_len_tren(p_con uuid, p_cha uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  if not ghi_duoc_muc_tieu(p_con) then
    raise exception 'Chỉ chủ mục tiêu mới gỡ được dây của nó' using errcode = '42501';
  end if;
  delete from noi where cha_id = p_cha and con_muc_tieu_id = p_con;
  if not exists (select 1 from noi where cha_id = p_cha and vai = 'gop_so')
     and exists (select 1 from muc_tieu where id = p_cha and nguon_so = 'con') then
    perform set_config('va.doi_nguon_so', '1', true);
    update muc_tieu set nguon_so = 'ghi_tay', gop_con = null where id = p_cha;
    perform set_config('va.doi_nguon_so', '', true);
  end if;
end $$;
revoke execute on function public.go_wig_len_tren(uuid, uuid) from public, anon;
grant execute on function public.go_wig_len_tren(uuid, uuid) to authenticated;
