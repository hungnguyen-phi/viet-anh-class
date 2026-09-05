-- 0194 — XOÁ MỤC TIÊU LÀ XOÁ CẢ CÂY (05/09/2026)
--
-- Chủ dự án: "chỗ Xoá mục tiêu phải xoá được ngay, không cần chờ cấp con được xoá". Trước đây
-- trigger private.mt_truoc_xoa (BEFORE DELETE) chặn khi mục tiêu còn số ghi (so_do), còn cam kết
-- hiệu lực, hoặc còn dây gop_so — người dùng phải dọn tay từng thứ, mà màn hình không có chỗ dọn.
--
-- Nay: ai được RLS cho xoá hàng muc_tieu (chủ mục tiêu / GVCN lớp / admin) thì trigger tự dọn cả
-- cây theo đúng thứ tự để không vướng trigger con và FK:
--   ghi chú PDR kể lại về cam kết (pdr_ke_lai, FK restrict) → lượt ghi của thước (luot; th_truoc_xoa
--   chặn xoá thước còn lượt) → thước đo (thuoc) → cam kết (cam_ket, FK set null) → số đã ghi (so_do).
--   Các bảng còn lại (noi, buoc, lich_su_dich, thanh_phan, moc_muc_tieu) đã ON DELETE CASCADE.
-- Bản live của hàm đọc từ pg_proc 05/09 (đầu hàm giữ nguyên: auth.uid() null / admin đi thẳng).
--
-- Chạy: npm run sql -- supabase/migrations/0194_xoa_muc_tieu_ca_cay.sql
-- Kiểm: npm run sql -- scripts/test-0194-xoa-ca-cay.sql   (đỏ khi CHƯA áp, xanh khi đã áp)

-- ── 1. RLS DELETE: chỉ còn "ai được ghi chủ thể này" ────────────────────────────────────────────
-- Bản live (pg_policies 05/09) còn đòi: trang_thai ∈ (nhap, gui, tra_lai) AND không so_do AND không noi
-- AND không cam_ket hiệu lực — tức mục tiêu đã duyệt và đang chạy thì KHÔNG AI xoá được, kể cả chủ.
-- Quyền xoá giờ = quyền ghi (chủ mục tiêu / GVCN lớp / BGH cơ sở / admin); cây con do trigger dọn.
drop policy if exists rls_delete_muc_tieu on public.muc_tieu;
create policy rls_delete_muc_tieu on public.muc_tieu
  for delete to authenticated
  using (ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));

-- ── 2. Trigger BEFORE DELETE: dọn cả cây thay vì chặn ───────────────────────────────────────────
create or replace function private.mt_truoc_xoa()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Dọn cả cây TRƯỚC khi hàng mục tiêu biến mất. Chạy với quyền chủ hàm (security definer) nên
  -- RLS của bảng con không cản; quyền xoá đã được quyết ở chính hàng muc_tieu này.
  delete from pdr_ke_lai where cam_ket_id in (select id from cam_ket where muc_tieu_id = old.id);
  delete from luot where thuoc_id in (
    select t.id from thuoc t join cam_ket c on c.id = t.cam_ket_id where c.muc_tieu_id = old.id);
  delete from thuoc where cam_ket_id in (select id from cam_ket where muc_tieu_id = old.id);
  delete from cam_ket where muc_tieu_id = old.id;
  delete from so_do where muc_tieu_id = old.id;
  return old;
end $function$;
