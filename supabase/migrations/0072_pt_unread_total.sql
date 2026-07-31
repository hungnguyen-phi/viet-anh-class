-- 0072 — Hàm đếm tin chưa đọc GỌN, thay cho việc gọi pt_my_threads() trên mọi trang.
--
-- LỖI HIỆU NĂNG, đo được: pt_my_threads() là truy vấn LÂU NHẤT trên 15/27 lượt đo trang
-- (158–470 ms). Nó chạy trên MỌI trang của giáo viên chủ nhiệm và phụ huynh — hai vai đông nhất
-- — vì layout dashboard gọi nó để lấy con số cho chấm đỏ trên icon phong bì.
--
-- Mà pt_my_threads() trả về NGUYÊN BẢNG cuộc trao đổi: join classes, join profiles, cộng một
-- subquery đếm tương quan cho TỪNG cuộc. Tất cả để lấy đúng MỘT con số.
--
-- Hàm dưới đây làm đúng một việc đó: một count(*) gộp, không join bảng nào, không đọc tên lớp
-- hay tên học sinh (những thứ chấm đỏ không cần).
--
-- SECURITY INVOKER, giống pt_my_threads: RLS của parent_teacher_messages/threads vẫn là thứ
-- quyết định ai đếm được gì. Phụ huynh chỉ đếm tin trong cuộc về con mình, GVCN chỉ cuộc của lớp
-- mình, học sinh/quản trị viên/hiệu trưởng ra 0 — y như trước, không nới quyền dòng nào.
--
-- "Chưa đọc" định nghĩa y hệt pt_my_threads: tin do NGƯỜI KHÁC gửi, sinh ra sau mốc đọc gần nhất
-- của tôi trong cuộc đó. Hai chỗ phải khớp nhau, nếu không chấm đỏ hiện 3 mà mở ra thấy 0.

create or replace function pt_unread_total() returns bigint
  language sql stable security invoker set search_path = public as $$
  select count(*)
    from parent_teacher_messages m
    join parent_teacher_threads t on t.id = m.thread_id
    left join parent_teacher_reads r
           on r.thread_id = t.id and r.user_id = (select auth.uid())
   where m.sender_id is distinct from (select auth.uid())
     and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function pt_unread_total() from public, anon;
grant execute on function pt_unread_total() to authenticated;
