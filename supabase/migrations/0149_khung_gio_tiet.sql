-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0149 — KHUNG GIỜ TIẾT HỌC: "Tiết 3" phải nói được là MẤY GIỜ
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 18/08/2026: "làm chỗ thời khoá biểu thành 1 trình quản lí chuyên nghiệp đi, có tiết
-- có giờ". Lưới hiện tại chỉ có SỐ tiết — người ngoài guồng (phụ huynh, học sinh mới, giáo viên
-- dạy thay) nhìn "Tiết 3" không biết mấy giờ phải có mặt.
--
-- Khung giờ khai THEO LỚP, không theo cơ sở: hai buổi sáng/chiều, khối nhỏ tan sớm, lớp bán trú
-- lệch giờ — cùng một cơ sở vẫn mỗi lớp một nhịp. Lớp nào chưa khai thì lưới hiện như cũ (chỉ
-- số tiết), không có trạng thái hỏng.
create table if not exists class_period_times (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  period_no smallint not null check (period_no between 1 and 12),
  start_time time not null,
  end_time time not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (class_id, period_no)
);
create index if not exists idx_cpt_class on class_period_times (class_id);

alter table class_period_times enable row level security;
grant select, insert, update, delete on class_period_times to authenticated;

-- Ai ĐỌC: đúng những ai đọc được lưới TKB (tt_read 0029) — lớp, nhân sự, phụ huynh của lớp.
drop policy if exists cpt_read on class_period_times;
create policy cpt_read on class_period_times for select using (
  is_class_student(class_id) or staff_can_read_class(class_id) or is_parent_of_class(class_id)
);
-- Ai SỬA: đúng những ai sửa được lưới (tt_manage + policy hiệu trưởng 0057).
drop policy if exists cpt_manage on class_period_times;
create policy cpt_manage on class_period_times for all
  using (
    staff_can_manage_class(class_id)
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  )
  with check (
    staff_can_manage_class(class_id)
    or (auth_role() = 'principal'::user_role and is_campus_class(class_id))
  );
