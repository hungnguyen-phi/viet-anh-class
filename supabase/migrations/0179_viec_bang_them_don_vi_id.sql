-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0179 — viec_bang trả thêm `don_vi_id` (để màn em prefill ĐƠN VỊ khi SỬA thước đo dẫn dắt)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Popup "Sửa thước đo dẫn dắt" (SuaViecEm) cần biết ĐƠN VỊ hiện tại (id) và CÁCH ĐO (cach_ghi đã có)
-- để cho em đổi tùy thích. viec_bang trước chỉ trả `ten_don_vi` (để hiển thị), thiếu `don_vi_id`.
-- Thêm 1 cột trả về `don_vi_id uuid`; MỌI cột/logic khác GIỮ NGUYÊN.
--
-- §5: đã đọc pg_get_functiondef của viec_bang đang chạy — khớp y hệt bản 0166, chỉ thêm cột này.
-- Đổi RETURNS TABLE ⇒ phải DROP + CREATE (create-or-replace không đổi được kiểu trả). Các hàm gọi
-- viec_bang (bang_ron, thi_dua…) đều plpgsql, tham chiếu theo TÊN cột (vb.chi_xem…) và không tạo
-- phụ thuộc cứng — DROP không cascade là an toàn; cột mới thêm ở CUỐI nên không lệch chỗ nào.

drop function if exists public.viec_bang(uuid);

create function public.viec_bang(p_student uuid default null)
returns table (thuoc_id uuid, ten text, chu_the text, cach_ghi text, chieu_dich text,
  ky_tuan int, ten_don_vi text, don_vi_id uuid, ngay_ap_dung smallint[], cho_bu boolean, chi_xem boolean,
  ky_tu date, ky_den date, gia numeric, chi_tieu numeric, le_ra numeric, dat boolean, trang_thai text)
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_hom_nay date;
begin
  v_student := coalesce(p_student, (select auth.uid()));
  if not (v_student = (select auth.uid()) or can_view_student(v_student)) then return; end if;
  v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());
  return query
  select t.id, t.ten, t.chu_the, t.cach_ghi, t.chieu_dich, t.ky_tuan::int, dv.nhan_vi, t.don_vi_id,
    t.ngay_ap_dung, t.cho_bu, (t.pham_vi = 'ca_doi'),
    kc.ky_tu, kc.ky_den, g.gia, g.chi_tieu, g.le_ra, g.dat, g.trang_thai
  from thuoc t
  left join don_vi dv on dv.id = t.don_vi_id
  cross join lateral private.ky_cua_thuoc(t.id, v_hom_nay) kc
  left join lateral private.gia_thuoc(t.id, kc.ky_tu, kc.ky_den, v_student) g on true
  where t.trang_thai = 'chay'
    and ( (t.pham_vi = 'tung_em' and (
              (t.chu_the = 'em' and t.student_id = v_student)
           or (t.chu_the = 'lop' and exists (select 1 from enrollments e
                 where e.class_id = t.class_id and e.student_id = v_student and e.is_active))
           or (t.chu_the = 'nhom' and em_trong_nhom(t.nhom_id, v_student))))
       or (t.pham_vi = 'ca_doi' and exists (select 1 from enrollments e
             where e.class_id = t.class_id and e.student_id = v_student and e.is_active)) );
end $$;

revoke all on function public.viec_bang(uuid) from anon;
grant execute on function public.viec_bang(uuid) to authenticated;
