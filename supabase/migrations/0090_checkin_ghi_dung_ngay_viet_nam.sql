-- 0090 — Check-in buổi sáng đang ghi vào NGÀY HÔM TRƯỚC
--
-- Máy chủ Postgres chạy múi giờ UTC. Việt Nam là UTC+7. Nên lúc 6h45 sáng ở Việt Nam, `current_date`
-- vẫn còn là ngày hôm qua:
--
--     6h45 ngày 06/08 giờ Việt Nam  =  23h45 ngày 05/08 giờ UTC
--     ngày thật:  2026-08-06
--     current_date ghi: 2026-08-05     ← lệch một ngày
--
-- student_checkin() dùng `current_date` ở hai chỗ (mood_checkins.date và attendance_records.date),
-- nên MỌI lượt check-in trước 7h sáng bị ghi sang hôm trước. Giáo viên mở sổ hôm nay thấy trống,
-- còn hôm qua tự nhiên mọc thêm một loạt em có mặt.
--
-- Chưa ai phát hiện vì bảng điểm danh đang rỗng và chưa có lượt check-in thật nào. Nhưng cửa sổ
-- check-in sắp mở là 6h30–7h00 — nằm TRỌN trong vùng lệch. Ngày đầu chạy thật là hỏng ngay.
--
-- Dự án đã có sẵn vn_today() đúng múi giờ, và mặc định của các cột date (mood_checkins,
-- lead_progress, homework_posts, class_albums) đều đã dùng 'Asia/Ho_Chi_Minh' từ trước — nghĩa là
-- chuyện này từng được biết và xử lý ở tầng cột, chỉ riêng hàm này truyền current_date đè lên.
--
-- Đã quét toàn bộ pg_proc: student_checkin là hàm DUY NHẤT còn dùng current_date.
-- Phía ứng dụng dùng lib/dates.ts → todayInVN() (Intl, Asia/Ho_Chi_Minh) nên không dính.

create or replace function student_checkin(p_student uuid, p_mood mood_level, p_ip text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_class uuid;
  v_da_khai boolean;
  v_hom_nay date := vn_today();   -- NGÀY THEO GIỜ VIỆT NAM, không phải theo giờ máy chủ
begin
  v_da_khai := truong_da_khai_mang();

  -- Chỉ chặn khi trường THẬT SỰ có cổng: chưa khai mạng thì chặn là chặn theo một luật không tồn tại.
  if v_da_khai and not ip_allowed(p_ip) then
    return 'blocked';
  end if;

  select class_id into v_class from enrollments
    where student_id = p_student and is_active limit 1;

  insert into mood_checkins (student_id, class_id, date, mood)
    values (p_student, v_class, v_hom_nay, p_mood)
    on conflict (student_id, date) do update set mood = excluded.mood, updated_at = now();

  if v_class is null then
    return 'no_class';
  end if;

  if not v_da_khai then
    return 'mood_only';
  end if;

  -- Cảm xúc = điểm danh: đánh "có mặt". KHÔNG đè nếu GV đã đánh Trễ/Có phép.
  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, v_hom_nay, 'present', p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        when attendance_records.status in ('excused','late') then attendance_records.status
        else 'present'
      end;

  return 'ok';
end;
$$;

comment on function student_checkin(uuid, mood_level, text) is
  'Check-in cam xuc = diem danh. Ngay lay tu vn_today() (gio Viet Nam), KHONG dung current_date: may chu chay UTC nen truoc 7h sang current_date van la hom truoc.';

-- Cho bộ kiểm tự động soi được, thay vì phải đọc pg_proc bằng tay.
-- Giao ước: hàm này PHẢI trả về rỗng.
create or replace function ham_lay_ngay_may_chu()
returns table (ten text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.proname::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.proname <> 'ham_lay_ngay_may_chu'
    and (pg_get_functiondef(p.oid) ~* '\mcurrent_date\M'
         or pg_get_functiondef(p.oid) ~* 'now\(\)::date')
  order by 1;
$$;

revoke all on function ham_lay_ngay_may_chu() from public;
grant execute on function ham_lay_ngay_may_chu() to authenticated;
