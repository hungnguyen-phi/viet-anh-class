-- 0186 — GVCN TẠO MỤC TIÊU LỚP = HIỆU LỰC NGAY (chủ dự án chốt 04/09/2026)
--
-- 0163 giao việc duyệt mục tiêu lớp cho ban giám hiệu (role principal), nhưng app CHƯA từng có
-- màn nào để BGH duyệt — mục tiêu lớp treo 'Chờ ban giám hiệu duyệt' vô hạn, bước kế hoạch không
-- tick được. Mô hình đã là tự-hứa-tự-chấm (thước lớp [H-07], mục tiêu cá nhân 0181 đều hiệu lực
-- ngay), nên mục tiêu lớp cũng vậy: GVCN của lớp là người duyệt.
--
-- MỘT vế sửa là đủ cả chuỗi, vì hai trigger đều hỏi duyet_duoc_chu_the:
--   · mt_truoc_them (0163:20): v_duyet → trang_thai='duyet' + mt_kiem_tran + chữ ký ngay lúc tạo;
--   · mt_truoc_sua (0181): v_duyet ∧ v_ghi → GVCN sửa nội dung KHÔNG bị hạ về 'gui'.
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef trên production (04/09/2026): duyet_duoc_chu_the = bản 0163;
-- mt_truoc_them = 0163, mt_truoc_sua = 0181 — cả hai trùng repo, KHÔNG cần đè lại.

create or replace function public.duyet_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then is_class_teacher(p_class)
    when 'nhom'   then is_class_teacher(p_class)                           -- [H-06] GVCN tạo nhóm = tự duyệt
    when 'lop'    then is_class_teacher(p_class)                           -- 0186: GVCN tự duyệt mục tiêu lớp mình
                    or ((select auth_role()) = 'principal' and is_campus_class(p_class))
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;

-- Dọn dữ liệu cho nhất quán luật mới: hai mục tiêu lớp Test đang 'gui' (không có ai duyệt) lên
-- 'duyet'. "zađa" trên lớp Marketing là rác thử của chủ dự án trên LỚP THẬT — không đụng, để
-- chủ dự án tự xoá. Chạy bằng postgres nên auth.uid() null → mt_truoc_sua cho qua (nhánh L6).
update muc_tieu
set trang_thai = 'duyet', duyet_boi = created_by, duyet_at = now()
where cap = 'lop' and trang_thai in ('gui', 'nhap')
  and class_id = (select id from classes where name = 'Test' and is_active limit 1);
