-- NÓI ĐÚNG TÊN NGƯỜI DUYỆT CHO NGƯỜI ĐANG CHỜ CẤP QUYỀN.
--
-- Màn /unauthorized hỏi thẳng bảng profiles bằng phiên của chính người đang chờ:
--     select full_name, email from profiles where role = 'admin' limit 3
-- Nhưng chính sách rls_select_profiles chỉ cho người ở vai 'pending' đọc ĐÚNG MỘT DÒNG của họ
-- (id = auth.uid()). Nên câu ấy luôn trả về rỗng, và giao diện rơi vào nhánh lùi:
--     "Trường chưa có quản trị viên nào trong hệ thống."
-- Câu đó sai — hệ thống đang có hai quản trị viên — và nó sai với đúng người đang cần biết phải
-- nhờ ai. Ảnh chụp lúc audit mobile 2026-08-06 cho thấy nguyên văn câu ấy trên màn giáo viên.
--
-- Không nới RLS: cho người lạ đọc cả bảng profiles để lấy được ba dòng là mở toang danh bạ toàn
-- trường, trong đó có học sinh. Thay vào đó là một hàm SECURITY DEFINER trả về ĐÚNG hai cột và
-- ĐÚNG những người có vai quản trị — không hơn.
create or replace function public.nguoi_duyet()
returns table (full_name text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.email
  from public.profiles p
  where p.role = 'admin'
  order by p.full_name nulls last, p.email
  limit 3
$$;

comment on function public.nguoi_duyet() is
  'Tên + email của tối đa 3 quản trị viên, cho màn "chưa được cấp quyền". SECURITY DEFINER vì '
  'người đang chờ duyệt không đọc được hồ sơ của ai khác qua RLS.';

revoke all on function public.nguoi_duyet() from public;
grant execute on function public.nguoi_duyet() to authenticated;
