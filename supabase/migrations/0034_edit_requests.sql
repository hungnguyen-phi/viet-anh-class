-- 0034 — Yêu cầu-sửa (edit_requests): học sinh/PH gửi "Xin sửa" → GVCN/Admin duyệt 1 chạm.
-- Tránh ngõ cụt "làm xong không sửa được": GVCN/Admin vẫn sửa trực tiếp; đây là kênh cho
-- HỌC SINH/PH yêu cầu thay đổi thứ họ không tự sửa được (vd tick sai >24h, xin đổi mục tiêu).

create table if not exists edit_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,   -- yêu cầu về em nào
  requester_id uuid not null references profiles(id) on delete cascade, -- ai gửi (HS hoặc PH)
  kind text not null check (kind in ('undo_tick', 'change_target', 'other')),
  ref_id uuid,                 -- lead_measure_id / wig_id liên quan (nếu có) để duyệt-áp-dụng nhanh
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists edit_requests_class_status_idx on edit_requests(class_id, status);
create index if not exists edit_requests_student_idx on edit_requests(student_id);

alter table edit_requests enable row level security;

-- Người gửi: học sinh của lớp, hoặc phụ huynh của em. Chỉ tạo yêu cầu ĐỨNG TÊN MÌNH.
drop policy if exists er_requester_insert on edit_requests;
create policy er_requester_insert on edit_requests for insert
  with check (
    requester_id = auth.uid()
    and (is_class_student(class_id) or is_my_child(student_id))
  );
drop policy if exists er_requester_read on edit_requests;
create policy er_requester_read on edit_requests for select using (requester_id = auth.uid());

-- Nhân sự lớp (GVCN/BGH/Admin): đọc; GVCN/Admin của lớp: duyệt (update trạng thái).
drop policy if exists er_staff_read on edit_requests;
create policy er_staff_read on edit_requests for select using (staff_can_read_class(class_id));
drop policy if exists er_staff_update on edit_requests;
create policy er_staff_update on edit_requests for update
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));

drop policy if exists er_admin_all on edit_requests;
create policy er_admin_all on edit_requests for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

grant select, insert, update, delete on edit_requests to authenticated;
