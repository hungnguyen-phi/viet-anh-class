-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0155 — NỐI MỤC TIÊU CỦA EM LÊN WIG LỚP KHI LỚP KHAI SAU
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 24/08/2026: "hình như chỗ tạo wig của học sinh, chưa có wig liên kết với lớp thì phải".
--
-- Đúng một nửa, và nửa còn lại tệ hơn.
--
-- 0100 bỏ câu hỏi "góp vào trận nào của lớp" — máy chủ TỰ tìm WIG lớp cùng lĩnh vực lúc em bấm
-- Lưu (`luuMucTieuCuaEm`, student/actions.ts). Đúng ý: đáp án chỉ có một thì đừng bắt trẻ con trả
-- lời. Nhưng phép tìm ấy chạy ĐÚNG MỘT LẦN, tại đúng khoảnh khắc ấy:
--
--   Lớp chưa khai lĩnh vực đó  →  source_wig_id = null  →  KHÔNG CÓ GÌ nối lại về sau.
--
-- Comment trong code viết "dây nối bổ sung sau khi lớp khai", nhưng không có chỗ nào làm việc bổ
-- sung đó — không trigger, không backfill, không nút. Mục tiêu của em mồ côi vĩnh viễn: không
-- hiện "góp vào", không cộng vào tiến độ lớp, và KHÔNG MÀN NÀO BÁO. Nó im lặng như thể đúng.
--
-- Thứ tự sinh ra lỗ này không hiếm chút nào — nó là thứ tự TỰ NHIÊN của đầu năm học: em vào app
-- trước, đặt đủ 4 mục tiêu theo luật PRD v3 4.2 (em phải đủ 4 domain BẤT KỂ lớp đã khai hay chưa),
-- rồi vài hôm sau thầy cô mới ngồi khai WIG lớp. Hiện tại chưa nổ chỉ vì lớp Test tình cờ đi
-- ngược: khai lớp trước, em đặt sau.
--
-- ── VÌ SAO LÀ TRIGGER, KHÔNG PHẢI SỬA TRONG ACTION TẠO WIG LỚP ───────────────────────────────
--
-- WIG lớp sinh ra từ nhiều đường: GVCN ở /wig, quản trị, BGH duyệt, và cả các bộ kiểm gieo dữ
-- liệu. Vá một đường là để sót những đường kia — dự án này đã dính đúng kiểu lỗi ấy (chẩn đúng
-- một chỗ rồi quên chỗ còn lại). Dây nối là LUẬT của dữ liệu, nên nó thuộc về CSDL.
--
-- ── NĂM HỌC PHẢI KHỚP ────────────────────────────────────────────────────────────────────────
--
-- Nối cũng phải cùng `period_label`. Sang năm học thứ hai, một lớp có hai WIG lớp cùng lĩnh vực
-- (`wigs_lop_ky_uidx` khoá theo cả period_label nên hai dòng là hợp lệ) — nối bừa là tiến độ năm
-- nay chảy vào bảng năm ngoái. Bản vá kèm theo ở student/actions.ts thêm đúng điều kiện ấy vào
-- câu tìm WIG cha, vì câu cũ chỉ lọc period='year' và dùng .limit(1) KHÔNG có order by.

-- ── 1. NỐI LẠI KHI LỚP KHAI ──────────────────────────────────────────────────────────────────
create or replace function private.noi_muc_tieu_len_lop()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Cờ chỉ sống trong giao dịch này (set_config … , true). Nó nói với chốt chặn 0133/0135 rằng
  -- lượt UPDATE sắp tới là việc của HỆ THỐNG, không phải thầy cô gõ đè lời của em.
  perform set_config('va.noi_day_tu_dong', '1', true);

  update wigs w
     set source_wig_id = new.id
   where w.scope = 'student'
     and w.kind = 'academic'          -- mục tiêu RIÊNG không mang dây nối (wig_source_ck, 0100)
     and w.period = 'year'
     and w.class_id = new.class_id
     and w.area = new.area
     and w.period_label = new.period_label
     and w.source_wig_id is null;

  perform set_config('va.noi_day_tu_dong', '', true);
  return null;
end $$;

drop trigger if exists trg_noi_muc_tieu_len_lop on wigs;
create trigger trg_noi_muc_tieu_len_lop
  after insert on wigs
  for each row
  when (new.scope = 'class' and new.period = 'year' and new.measure_by is distinct from 'cuon')
  execute function private.noi_muc_tieu_len_lop();

comment on function private.noi_muc_tieu_len_lop() is
  'Lớp khai WIG năm sau khi em đã đặt mục tiêu → nối lại các mục tiêu học tập còn mồ côi cùng lớp, '
  'cùng lĩnh vực, cùng năm học (0155).';

-- ── 2. CHỐT CHẶN 0133/0135 PHẢI CHO LƯỢT NỐI NÀY ĐI QUA ──────────────────────────────────────
--
-- `source_wig_id` nằm trong danh sách cột bị chặn của 0133: thầy cô đụng vào là 42501. Mà người
-- bấm "Tạo WIG lớp" thường CHÍNH LÀ thầy cô — nên nếu không mở đúng một khe, trigger ở §1 sẽ làm
-- vỡ luôn lượt tạo WIG của lớp. Khe mở ở đây hẹp ba lớp cùng lúc:
--
--   · đang có cờ va.noi_day_tu_dong (chỉ §1 đặt được, và chỉ sống trong giao dịch ấy);
--   · dây nối đi từ RỖNG sang có, không phải đổi từ WIG này sang WIG khác;
--   · và WIG được nối tới PHẢI đúng là WIG lớp cùng lớp, cùng lĩnh vực, cùng năm học.
--
-- Điều kiện thứ ba là thứ khiến khe này vô hại kể cả khi ai đó dựng được cái cờ: thứ duy nhất họ
-- làm được là nối đúng cái dây mà hệ thống dù sao cũng sẽ nối.
--
-- Phần còn lại của hàm giữ NGUYÊN như 0135 (đã đối chiếu với bản đang chạy trên CSDL, md5 khớp).
create or replace function private.chi_em_va_bgh_sua_muc_tieu()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me  uuid := (select auth.uid());
  v_vai user_role := auth_role();
begin
  -- KHÔNG CÓ PHIÊN = hệ thống. Cho qua — xem 0135.
  if v_me is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.scope <> 'student' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.student_id is not distinct from v_me or v_vai in ('admin', 'principal') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- NỐI DÂY TỰ ĐỘNG (0155) — việc của hệ thống, không phải lời của ai.
  if tg_op = 'UPDATE'
     and coalesce(current_setting('va.noi_day_tu_dong', true), '') = '1'
     and old.source_wig_id is null
     and new.source_wig_id is not null
     and exists (
       select 1 from wigs p
        where p.id = new.source_wig_id
          and p.scope = 'class'
          and p.class_id = new.class_id
          and p.area = new.area
          and p.period = 'year'
          and p.period_label = new.period_label)
     and (new.title, new.baseline, new.target_value, new.unit, new.area, new.kind,
          new.period, new.period_label, new.start_date, new.end_date,
          new.measure_by, new.parent_wig_id,
          new.student_id, new.class_id, new.set_by,
          new.ty_le_can, new.so_dich_can, new.tong_dich)
         is not distinct from
         (old.title, old.baseline, old.target_value, old.unit, old.area, old.kind,
          old.period, old.period_label, old.start_date, old.end_date,
          old.measure_by, old.parent_wig_id,
          old.student_id, old.class_id, old.set_by,
          old.ty_le_can, old.so_dich_can, old.tong_dich)
  then
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Mục tiêu này là của em, thầy cô không xoá được. Nhờ em sửa, hoặc báo quản trị.'
      using errcode = '42501';
  end if;

  if (new.title, new.baseline, new.target_value, new.unit, new.area, new.kind,
      new.period, new.period_label, new.start_date, new.end_date,
      new.measure_by, new.source_wig_id, new.parent_wig_id,
      new.student_id, new.class_id, new.set_by,
      new.ty_le_can, new.so_dich_can, new.tong_dich)
     is distinct from
     (old.title, old.baseline, old.target_value, old.unit, old.area, old.kind,
      old.period, old.period_label, old.start_date, old.end_date,
      old.measure_by, old.source_wig_id, old.parent_wig_id,
      old.student_id, old.class_id, old.set_by,
      old.ty_le_can, old.so_dich_can, old.tong_dich)
  then
    raise exception 'Nội dung mục tiêu là lời của em — thầy cô duyệt hoặc đánh dấu đã đạt, không sửa. Nhờ em sửa lại.'
      using errcode = '42501';
  end if;

  return new;
end $$;

-- ── 3. NỐI LẠI CHO DỮ LIỆU CŨ ────────────────────────────────────────────────────────────────
--
-- Chạy bằng quyền migration (không có phiên) nên đi thẳng qua chốt chặn theo luật 0135.
-- Hôm nay trên production con số này là 0 — câu lệnh vẫn phải có, vì lỗ đã mở từ 0100 và bất kỳ
-- lớp nào khai WIG muộn trong khoảng ấy đều đã kịp sinh ra mục tiêu mồ côi.
update wigs w
   set source_wig_id = p.id
  from wigs p
 where w.scope = 'student'
   and w.kind = 'academic'
   and w.period = 'year'
   and w.source_wig_id is null
   and p.scope = 'class'
   and p.period = 'year'
   and p.measure_by is distinct from 'cuon'
   and p.class_id = w.class_id
   and p.area = w.area
   and p.period_label = w.period_label;
