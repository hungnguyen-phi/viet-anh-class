-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0150 — VÁ LỖ RÒ DỮ LIỆU: wig_progress_v chạy SECURITY DEFINER, ai cũng đọc được MỌI học sinh
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Phát hiện trong audit 18/08/2026 (Supabase advisor security_definer_view + kiểm sống trên
-- production): view public.wig_progress_v mất thuộc tính security_invoker ở đâu đó quãng 0101/
-- 0109 (các bản `create or replace view … as` không kèm `with (security_invoker=true)`). View
-- thuộc sở hữu postgres nên khi security_invoker TẮT, nó chạy bằng quyền CHỦ VIEW và BỎ QUA RLS
-- của wigs/lead_progress bên dưới.
--
-- HẬU QUẢ ĐÃ CHỨNG MINH: đóng vai `anon` (CHƯA đăng nhập) `select count(*) from wig_progress_v`
-- trả 15 dòng — tiến độ WIG của mọi học sinh toàn trường; trong khi `select from wigs` trả 0 vì
-- RLS chặn đúng. Anon key nằm sẵn trong bundle trình duyệt, nên đây là rò dữ liệu trẻ em không
-- cần đăng nhập, chỉ cần một request PostgREST.
--
-- VÁ: bật security_invoker → view đọc theo quyền NGƯỜI GỌI, RLS của bảng gốc áp lại. Anon không
-- có auth.uid() nên thấy 0 dòng; học sinh thấy của mình + của lớp; GVCN thấy cả lớp — đúng y như
-- mọi truy vấn wigs/lead_progress trực tiếp mà app vẫn dựa vào. Hai view metrics (0147) vốn đã
-- security_invoker và chạy đúng, nên đây chỉ là kéo wig_progress_v về cùng chuẩn.
--
-- Chỉ đổi THUỘC TÍNH, không đụng định nghĩa cột → không rewrite, không đổi thứ tự cột, mọi câu
-- select ... from wig_progress_v giữ nguyên.
alter view public.wig_progress_v set (security_invoker = true);

-- Anon không có việc gì với view tiến độ học sinh dù RLS đã chặn — bỏ nốt quyền cho chắc lớp
-- (phòng vệ nhiều tầng, đúng nguyên tắc dữ liệu trẻ em của dự án).
revoke all on public.wig_progress_v from anon;
