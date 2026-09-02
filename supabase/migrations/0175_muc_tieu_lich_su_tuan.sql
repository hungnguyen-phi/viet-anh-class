-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0175 — LỊCH SỬ THEO TUẦN của một mục tiêu (cho "biểu đồ thật" trên màn giáo viên)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Biểu đồ chỉ vẽ CÁI ĐÃ XẢY RA THẬT — số của mục tiêu ở CUỐI mỗi tuần gần đây — chứ KHÔNG có đường
-- "cần đạt/dự đoán", nên không thể biểu thị sai (yêu cầu của chủ dự án 02/09). Số mỗi tuần lấy đúng
-- bằng bộ tính lõi private.so_hien_tai(mục_tiêu, ngày) — cùng con số màn hình đang hiển thị.
--
-- Chỉ-đọc, SECURITY DEFINER để gọi được so_hien_tai (schema private) + kiểm quyền đọc bằng
-- doc_duoc_muc_tieu (0163, xét auth.uid() thật). Chỉ authenticated gọi (không anon).

create or replace function public.muc_tieu_lich_su_tuan(p_muc_tieu uuid, p_so_tuan int default 8)
returns table(tuan_ket date, so numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_mon date := date_trunc('week', vn_today())::date;   -- thứ Hai tuần này (giờ VN)
  v_n int := greatest(1, least(coalesce(p_so_tuan, 8), 26));
  i int;
  wk date;
begin
  -- Chỉ trả khi NGƯỜI GỌI đọc được mục tiêu (RLS của muc_tieu qua helper, không phải quyền definer).
  if not doc_duoc_muc_tieu(p_muc_tieu) then return; end if;
  for i in reverse (v_n - 1)..0 loop
    wk := v_mon - (i * 7) + 6;                            -- chủ nhật của tuần thứ i về trước
    tuan_ket := wk;
    select h.so into so from private.so_hien_tai(p_muc_tieu, wk) h;
    return next;
  end loop;
end $$;

revoke all on function public.muc_tieu_lich_su_tuan(uuid, int) from public, anon;
grant execute on function public.muc_tieu_lich_su_tuan(uuid, int) to authenticated;
