-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0118 — LẤY SỐ LIỆU CUỘN CỦA CẢ LỚP MÀ KHÔNG CẦN BIẾT TRƯỚC ID
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0117 nhận một mảng id. Trang /wig thì chưa có mảng ấy lúc bắt đầu — nó bắn 7 câu hỏi SONG SONG
-- rồi mới biết lớp có mục tiêu cuộn nào. Muốn dùng bản nhận mảng thì phải chờ câu hỏi thứ nhất
-- xong mới hỏi câu thứ hai, tức là thêm một vòng mạng NỐI TIẾP vào đúng đường tải trang. VPS này
-- mất ~5% gói TCP nên mỗi vòng nối tiếp đều đắt hơn người ta tưởng.
--
-- Đây là lớp bọc mỏng, KHÔNG chép lại phép đếm: nó gọi thẳng cuon_so_lieu. Hai bên mà tự đếm
-- riêng thì có ngày một bên nói "6/7" còn bên kia nói "đạt".
create or replace function cuon_so_lieu_lop(p_class uuid)
returns table(wig_id uuid, tong integer, dat integer, ty_le numeric)
language sql
stable
set search_path to 'public'
as $$
  select * from cuon_so_lieu(array(
    select w.id from wigs w
    where w.class_id = p_class and w.scope = 'class' and w.measure_by = 'cuon'
  ));
$$;
revoke all on function cuon_so_lieu_lop(uuid) from public, anon;
grant execute on function cuon_so_lieu_lop(uuid) to authenticated, service_role;
