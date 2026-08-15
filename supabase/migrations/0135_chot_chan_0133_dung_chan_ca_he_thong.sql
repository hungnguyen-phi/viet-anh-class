-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0135 — CHỐT CHẶN CỦA 0133 ĐANG CHẶN CẢ CHÍNH HỆ THỐNG
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0133 chặn "ai không phải em, không phải BGH/quản trị" sửa hoặc xoá mục tiêu và cam kết của học
-- sinh. Nhưng nó đo bằng `auth.uid()` và `auth_role()` — hai thứ RỖNG khi câu lệnh không đến từ
-- một phiên đăng nhập. Nên nó chặn luôn cả:
--
--   · service_role — đường mà máy chủ tự dùng cho việc quản trị, và cũng là đường mọi bộ kiểm
--     dùng để DỌN dữ liệu chúng vừa gieo;
--   · và nguy hơn nhiều: XOÁ DÂY CHUYỀN. `wigs.student_id` và `commitments.student_id` đều là
--     `on delete cascade` tới `profiles`. Xoá một tài khoản học sinh là kéo theo mục tiêu và cam
--     kết của em ấy, và mỗi dòng bị kéo theo đều chạy qua trigger này. Với một lệnh xoá người dùng
--     chạy bằng service_role, trigger ném lỗi và CẢ LỆNH XOÁ VỠ — quản trị không xoá nổi một tài
--     khoản, mà câu lỗi thì nói về "mục tiêu của em", chẳng ai lần ra.
--
-- Đã thấy hậu quả nhẹ của nó ngay: scripts/test-hop-tung-em dọn rác bằng service_role, bị chặn im
-- lặng, và để lại ba cam kết ZZ_TEST trong CSDL thật — đủ để một bộ kiểm khác đâm vào trần "2 cam
-- kết mỗi tuần" rồi báo sai.
--
-- ── VÌ SAO "KHÔNG CÓ PHIÊN THÌ CHO QUA" LÀ ĐÚNG, KHÔNG PHẢI MỘT LỖ ───────────────────────────
--
-- `auth.uid()` rỗng nghĩa là câu lệnh KHÔNG đến từ trình duyệt của ai cả. Người dùng thật — em,
-- cô, BGH — luôn mang JWT; PostgREST không có đường nào bỏ nó đi. Thứ duy nhất đi vào mà không
-- mang JWT là kết nối máy chủ dùng khoá service_role, mà khoá ấy vốn đã BỎ QUA TOÀN BỘ RLS theo
-- thiết kế của Postgres. Nói cách khác: ai cầm được khoá ấy thì trigger này chưa bao giờ là thứ
-- cản họ. Chặn ở đây không thêm một lớp an toàn nào — nó chỉ chặn đúng những việc hợp lệ.
--
-- Điều kiện phải giữ chặt: khoá service_role KHÔNG ĐƯỢC lọt ra trình duyệt. Đó là luật đã có từ
-- lâu của dự án (xem docs/DEPLOY.md: chỉ đặt ở biến môi trường runtime, không bao giờ NEXT_PUBLIC_).
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
  -- KHÔNG CÓ PHIÊN = hệ thống. Cho qua — xem phần đầu tệp.
  if v_me is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.scope <> 'student' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.student_id is not distinct from v_me or v_vai in ('admin', 'principal') then
    return case when tg_op = 'DELETE' then old else new end;
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
  if v_me is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

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
