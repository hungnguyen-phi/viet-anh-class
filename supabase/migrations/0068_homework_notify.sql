-- 0068 — Có bài mới thì báo cho học sinh và phụ huynh.
--
-- VÌ SAO CẦN: phụ huynh xin "báo bài" chính là để KHÔNG phải hỏi con "hôm nay có bài gì". Nếu
-- họ vẫn phải tự nhớ mà mở app kiểm tra thì tính năng chỉ giải quyết được nửa vấn đề — thay
-- việc hỏi con bằng việc nhớ mở app, không nhẹ hơn bao nhiêu. Bảng notifications và cái chuông
-- đã có sẵn từ 0029; 0061 chỉ thiếu mắt xích nối vào.
--
-- CHỈ BÁO KHI THÊM MỚI, KHÔNG BÁO KHI SỬA: giáo viên gõ lại một chữ trong đề bài mà cả lớp 40
-- người cùng phụ huynh nhận thêm một thông báo nữa thì chuông thành thứ gây phiền, và người ta
-- sẽ học cách phớt lờ nó — lúc đó thông báo THẬT cũng chìm theo.
--
-- KHÔNG chép nội dung bài vào notifications.body, chỉ ghi môn: nội dung bài có thể dài, và
-- notifications là bảng có vòng đời khác (không có policy DELETE — xem 0029). Người dùng bấm
-- vào là tới nơi đọc đủ.
--
-- SECURITY DEFINER: phải bỏ qua RLS của notifications để chèn hàng cho NGƯỜI KHÁC (policy
-- notif_own_read chỉ cho mỗi người đọc hàng của chính mình). Đúng khuôn notify_student_meeting()
-- ở 0029 và pt_after_message() ở 0065.

create or replace function notify_homework_post() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_nhan text;
begin
  v_nhan := case new.kind
              when 'assignment' then 'Bài tập mới'
              when 'exam'       then 'Thông báo kiểm tra'
              else                   'Dặn dò mới'
            end || ' — ' || new.subject;

  -- Học sinh ĐANG học lớp đó. Lọc is_active để em đã chuyển lớp không nhận bài của lớp cũ.
  insert into notifications (user_id, title, body, link)
  select e.student_id, v_nhan, null, '/homework'
    from enrollments e
   where e.class_id = new.class_id and e.is_active;

  -- Phụ huynh của các em đó. distinct vì bố và mẹ cùng trỏ tới một em thì mỗi người một hàng,
  -- nhưng một phụ huynh có HAI con cùng lớp thì không được nhận hai thông báo giống hệt nhau.
  insert into notifications (user_id, title, body, link)
  select distinct pl.parent_id, v_nhan, null, '/homework'
    from enrollments e
    join parent_links pl on pl.student_id = e.student_id
   where e.class_id = new.class_id and e.is_active;

  return null;
end $$;

revoke all on function notify_homework_post() from public, anon, authenticated;

drop trigger if exists trg_notify_homework_post on homework_posts;
create trigger trg_notify_homework_post after insert on homework_posts
  for each row execute function notify_homework_post();
