-- 0195 — XOÁ / HUỶ CAM KẾT LÀ DỌN CẢ CÂY THƯỚC ĐO (05/09/2026)
--
-- Chủ dự án bấm "Xoá cam kết" → về trang với flash_err "Không thực hiện được vì còn dữ liệu liên
-- quan" (23503). Nguồn: xoá cam_ket cascade sang thuoc, trigger private.th_truoc_xoa chặn thước đã
-- có lượt ghi ("kết thúc thay vì xoá"); còn đường "đổi cam kết" (đánh dấu 'huy' + xoá thước) thì
-- RLS thuoc không cho học sinh xoá thước ĐÃ DUYỆT → thước cũ ở lại lặng lẽ.
-- Cùng tinh thần 0194 ("xoá được ngay, không chờ dọn cấp con"):
--   1. th_truoc_xoa: thước bị xoá thì lượt ghi của nó đi theo (quyền xoá thước đã do RLS quyết).
--   2. RPC huy_cam_ket_ca_cay(p_id): cho em/thầy cô ĐỔI cam kết — kiểm ghi_duoc_cam_ket + chưa chấm,
--      rồi xoá lượt → thước, đánh dấu cam kết 'huy' (giữ 'huy' chứ không xoá: tín hiệu để cam kết tự
--      lăn 0177 ngừng lăn dòng này). SECURITY DEFINER vì RLS thuoc không cho em xoá thước đã duyệt.
-- Bản live th_truoc_xoa đọc từ pg_proc 05/09.
--
-- Chạy: npm run sql -- supabase/migrations/0195_xoa_cam_ket_ca_cay.sql
-- Kiểm: npm run sql -- scripts/test-0195-xoa-cam-ket.sql   (đỏ khi CHƯA áp, xanh khi đã áp)

create or replace function private.th_truoc_xoa()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Xoá thước = xoá luôn lượt ghi của nó (0195). Trước đây chặn "đã có lượt ghi — kết thúc thay
  -- vì xoá", nhưng người dùng không có nút kết thúc nào trên màn cam kết.
  delete from luot where thuoc_id = old.id;
  return old;
end $function$;

create or replace function public.huy_cam_ket_ca_cay(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_ket_qua text;
begin
  if (select auth.uid()) is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  if not coalesce(ghi_duoc_cam_ket(p_id), false) then
    raise exception 'Không có quyền đổi cam kết này' using errcode = '42501';
  end if;
  select ket_qua into v_ket_qua from cam_ket where id = p_id;
  if v_ket_qua is not null then
    raise exception 'Cam kết đã chấm — bấm Bỏ chấm trước' using errcode = '23514';
  end if;
  delete from luot where thuoc_id in (select id from thuoc where cam_ket_id = p_id);
  delete from thuoc where cam_ket_id = p_id;
  update cam_ket set trang_thai = 'huy' where id = p_id;
end $function$;

revoke all on function public.huy_cam_ket_ca_cay(uuid) from public, anon;
grant execute on function public.huy_cam_ket_ca_cay(uuid) to authenticated, service_role;
