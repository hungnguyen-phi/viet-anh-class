-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0112 — "BUỔI HỌP ĐÃ CHỐT" PHẢI PHÂN BIỆT ĐƯỢC VỚI "MẤT MẠNG"
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Cảnh sẽ xảy ra ở buổi họp thật, gần như chắc chắn: cuối buổi cô bấm "Chốt buổi họp", trong khi
-- vài em vẫn đang gõ nốt câu của mình. Từ lúc ấy mọi lượt ghi của các em bị RPC từ chối — và màn
-- hình của em nói "Chưa lưu được — kiểm tra mạng rồi gõ tiếp." Em ngồi gõ lại, gõ lại, gõ lại
-- vào một cái ô không còn nhận nữa, và đi trách cái wifi.
--
-- 0111 raise cả hai lỗi bằng cùng một errcode 42501 nên phía trình duyệt không có cách nào tách
-- ra. Nay "đã chốt" mang mã riêng P0002, để màn hình nói đúng chuyện đang xảy ra và khoá ô lại.
create or replace function hs_ghi_bien_ban(
  p_class uuid,
  p_week_label text,
  p_week_start date,
  p_ket_qua text,
  p_cam_ket text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Chưa đăng nhập.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from enrollments
    where class_id = p_class and student_id = v_me and is_active
  ) then
    raise exception 'Bạn không học lớp này.' using errcode = '42501';
  end if;

  -- Tuần đã chốt: dòng của LỚP (student_id is null) mang dấu chốt.
  if exists (
    select 1 from wig_meetings
    where class_id = p_class and week_label = p_week_label
      and student_id is null and chot_at is not null
  ) then
    raise exception 'Buổi họp tuần này đã chốt.' using errcode = 'P0002';
  end if;

  insert into wig_meetings (class_id, student_id, week_label, week_start, results, commitments, hs_go_luc)
  values (p_class, v_me, p_week_label, p_week_start, nullif(btrim(p_ket_qua), ''), nullif(btrim(p_cam_ket), ''), now())
  on conflict (student_id, week_label) where student_id is not null
  do update set
    results     = nullif(btrim(p_ket_qua), ''),
    commitments = nullif(btrim(p_cam_ket), ''),
    hs_go_luc   = now();
end $$;
