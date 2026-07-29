-- 0054 — Gỡ nốt cặp chỉ mục trùng thứ hai trên wig_meetings (bản cho biên bản CÁ NHÂN).
--
-- uq_meeting_student_week và wig_meetings_student_week_uidx phủ cùng cột (student_id, week_label),
-- cùng điều kiện (student_id is not null), cùng tính duy nhất. Giữ hai cái là bắt Postgres cập
-- nhật hai lần mỗi lần ghi biên bản, không thêm gì khi đọc. Giữ tên gốc, bỏ cái sinh sau.
--
-- Advisor của Supabase KHÔNG bắt được cặp này (nó chỉ báo cặp class_week ở 0053) — tìm ra bằng
-- cách tự đối chiếu pg_index theo (bảng, cột, điều kiện, tính duy nhất, kiểu index).
drop index if exists wig_meetings_student_week_uidx;
