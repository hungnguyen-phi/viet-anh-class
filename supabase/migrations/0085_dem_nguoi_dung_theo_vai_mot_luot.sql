-- 0085 — Đếm người dùng theo vai trong MỘT lượt đi-về, thay vì bảy lượt.
--
-- Màn Quản trị có bảy tab (Tất cả · Giáo viên · BGH · Quản trị · Học sinh · Phụ huynh · Chờ), mỗi
-- tab hiện số người khớp bộ lọc đang gõ. Bản đầu làm việc đó bằng bảy truy vấn đếm chạy song song
-- — bảy lượt đi-về Supabase cho một con số mà Postgres tính được trong một câu `group by`.
--
-- Vì sao đáng làm hẳn một hàm: VPS chạy app này MẤT KHOẢNG 5% GÓI TCP (đã đo, đã loại trừ
-- Supabase và CPU). Với đường truyền như thế, mỗi truy vấn thêm vào không chỉ tốn thời gian mà còn
-- là thêm một cơ hội để cả trang hỏng — một truy vấn rớt là React Server Component ném lỗi và
-- người quản trị nhận màn hình đỏ thay vì bảng người dùng.
--
-- SECURITY INVOKER (mặc định, ghi rõ cho khỏi hiểu nhầm): hàm chạy dưới quyền người gọi nên RLS
-- của bảng profiles vẫn áp nguyên. Không cấp thêm đường nhìn nào cho ai — chỉ gộp bảy câu hỏi cũ
-- thành một. Đây là dữ liệu trẻ em, chỗ này không được phép "cho tiện".
create or replace function admin_user_counts(p_q text default null)
returns table (role user_role, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.role, count(*)::bigint
  from profiles p
  where p_q is null
     or p_q = ''
     -- Cùng một phép so khớp với bảng bên dưới (ilike hai cột), để con số trên tab luôn bằng đúng
     -- số dòng bấm vào sẽ thấy. Lệch nhau là kiểu lỗi người dùng không báo được thành lời: họ chỉ
     -- thấy "ghi 3 mà bấm vào có 1" rồi thôi tin cả màn hình.
     or p.email ilike '%' || p_q || '%'
     or coalesce(p.full_name, '') ilike '%' || p_q || '%'
  group by p.role;
$$;

comment on function admin_user_counts(text) is
  'Đếm người dùng theo vai cho các tab màn Quản trị — một lượt thay cho bảy. RLS vẫn áp (invoker).';

revoke all on function admin_user_counts(text) from public;
grant execute on function admin_user_counts(text) to authenticated;
