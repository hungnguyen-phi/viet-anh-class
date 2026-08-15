-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0133 — CÔ KHÔNG SỬA MỤC TIÊU VÀ CAM KẾT CỦA EM (chỉ BGH/quản trị mới sửa)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 15/08/2026: "giáo viên bây giờ đâu được sửa wig/commitment học sinh nữa, trong trang
-- chi-tiet còn sửa kìa".
--
-- Đúng. 0129 đã khoá VIỆC DẪN DẮT về chỉ quản trị, nhưng MỤC TIÊU và CAM KẾT thì chưa: hai chính
-- sách `for all` — `rls_all_wigs` và `rls_cam_ket_gvcn`, đều gác bằng `staff_can_manage_class` —
-- cho mọi nhân sự quản lớp làm mọi thứ, kể cả gõ lại câu mục tiêu của một đứa trẻ rồi xoá nó.
--
-- ── VÌ SAO LÀ TRIGGER, KHÔNG PHẢI SỬA CHÍNH SÁCH ─────────────────────────────────────────────
--
-- Hai chính sách ấy còn gánh cả quyền ĐỌC và quyền làm việc với mục tiêu CỦA LỚP. Thu hẹp chúng
-- là đụng vào cả bốn phép cùng lúc, mà chỉ cần lỡ tay một nhánh là cô mất luôn đường nhìn thấy
-- mục tiêu của lớp mình — hỏng to hơn nhiều so với thứ đang đi sửa. Trigger chặn đúng hai phép
-- cần chặn (UPDATE nội dung, DELETE), để nguyên mọi thứ khác.
--
-- ── CÔ VẪN LÀM ĐƯỢC GÌ ───────────────────────────────────────────────────────────────────────
--
-- DUYỆT (status), ĐÁNH DẤU ĐÃ ĐẠT (achieved_at/by), và CHẤM V/X cho cam kết (verdict*). Đó là
-- việc của cô. Còn NỘI DUNG — câu mục tiêu, con số, đơn vị, hạn, lĩnh vực — là lời của em.
--
-- Thấy nội dung chưa ổn thì nói với em rồi để em sửa; em sửa xong nó tự quay về chờ duyệt (0129).
-- Đường ấy chậm hơn một nhịp so với cô tự gõ, nhưng nó giữ đúng điều cả cái app này sinh ra để
-- dạy: mục tiêu là của em, không phải bài tập cô giao.
--
-- BGH và quản trị vẫn sửa được — chủ dự án đã chốt từ trước ("bgh, admin sửa được"), vì phải có
-- một đường gỡ khi mọi thứ kẹt.

-- ── 1. MỤC TIÊU CỦA EM ───────────────────────────────────────────────────────────────────────
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
  -- Chỉ áp cho mục tiêu CỦA EM. Mục tiêu của lớp/cơ sở là việc của nhân sự, không đụng tới.
  if old.scope <> 'student' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Chính em, hoặc BGH/quản trị: cho qua.
  if old.student_id is not distinct from v_me or v_vai in ('admin', 'principal') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Mục tiêu này là của em, thầy cô không xoá được. Nhờ em sửa, hoặc báo quản trị.'
      using errcode = '42501';
  end if;

  -- CÒN LẠI LÀ UPDATE. Cho đổi đúng ba cột thuộc việc của cô; đụng vào bất cứ cột nội dung nào
  -- khác là chặn. Liệt kê TỪNG CỘT thay vì so cả dòng: thêm cột mới sau này mà quên nghĩ tới thì
  -- nó rơi vào nhóm ĐƯỢC PHÉP một cách im lặng — kiểu lỗ mà không ai nhìn thấy cho tới lúc muộn.
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

drop trigger if exists trg_chi_em_va_bgh_sua_muc_tieu on wigs;
create trigger trg_chi_em_va_bgh_sua_muc_tieu
  before update or delete on wigs
  for each row execute function private.chi_em_va_bgh_sua_muc_tieu();

-- ── 2. CAM KẾT TUẦN CỦA EM ───────────────────────────────────────────────────────────────────
-- Cùng một luật, và cùng một lý do. Khác một chỗ: cô còn chấm V/X trong buổi họp, nên nhóm cột
-- được phép có thêm verdict*.
create or replace function private.chi_em_va_bgh_sua_cam_ket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me  uuid := (select auth.uid());
  v_vai user_role := auth_role();
begin
  -- Cam kết của LỚP (student_id rỗng) là của cô — không đụng.
  if old.student_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.student_id is not distinct from v_me or v_vai in ('admin', 'principal') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Cam kết này là của em, thầy cô không xoá được. Nhờ em sửa, hoặc báo quản trị.'
      using errcode = '42501';
  end if;

  if (new.title, new.area, new.wig_id, new.class_id, new.student_id, new.week_start, new.set_by)
     is distinct from
     (old.title, old.area, old.wig_id, old.class_id, old.student_id, old.week_start, old.set_by)
  then
    raise exception 'Cam kết là lời hứa của em — thầy cô duyệt hoặc chấm V/X, không sửa lời. Nhờ em sửa lại.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists trg_chi_em_va_bgh_sua_cam_ket on commitments;
create trigger trg_chi_em_va_bgh_sua_cam_ket
  before update or delete on commitments
  for each row execute function private.chi_em_va_bgh_sua_cam_ket();
