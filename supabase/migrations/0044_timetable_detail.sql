-- 0044 — Thời khoá biểu chi tiết: loại tiết + giáo viên, và NGOẠI LỆ THEO NGÀY (huỷ/dời/dạy thay).
--
-- Vì sao phải thêm bảng thứ hai: timetable_slots (0029) là MẪU TUẦN LẶP — chỉ có day_of_week +
-- period_no, KHÔNG có ngày. Huỷ tiết, dời tiết, dạy thay đều là chuyện của MỘT NGÀY cụ thể
-- ("huỷ tiết 3 thứ Tư ngày 15/09"), không thể nhét vào mẫu lặp mà không phá cả các tuần khác.
--
-- Vì sao giáo viên là TEXT chứ không phải FK -> profiles(id):
--   1. RLS profiles hiện tại (prof_self_read / prof_teacher_students / prof_principal_campus /
--      prof_admin_all) KHÔNG cho GVCN đọc hồ sơ đồng nghiệp → select giáo viên sẽ rỗng, và
--      "dạy thay" thì càng cần người khác.
--   2. Giáo viên bộ môn (Toán, Lý, Thể dục…) phần lớn KHÔNG có tài khoản trong app này — người
--      dùng app là GVCN, BGH, học sinh, phụ huynh. FK sẽ chặn nhập đúng thực tế.
-- Nếu sau này trường đưa toàn bộ giáo viên vào hệ thống thì nâng lên FK bằng migration riêng.
set search_path = public;

-- ============================================================
-- 1) Mẫu tuần: thêm loại tiết + giáo viên phụ trách
-- ============================================================
alter table timetable_slots
  add column if not exists teacher_name text,
  add column if not exists kind text not null default 'regular';

-- regular = học bình thường, practice = thực hành (xanh lá), exam = thi/kiểm tra (vàng).
alter table timetable_slots drop constraint if exists timetable_slots_kind_check;
alter table timetable_slots add constraint timetable_slots_kind_check
  check (kind in ('regular', 'practice', 'exam'));

comment on column timetable_slots.kind is
  'regular | practice | exam — quyết định màu ô trên lưới TKB.';

-- ============================================================
-- 2) Ngoại lệ theo ngày
-- ============================================================
create table if not exists timetable_overrides (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid not null references timetable_slots(id) on delete cascade,
  date           date not null,
  status         text not null check (status in ('cancelled', 'moved', 'substituted')),
  -- Chỉ dùng khi status='moved': tiết được dời tới đâu.
  new_date       date,
  new_period_no  smallint check (new_period_no is null or new_period_no between 1 and 12),
  -- Chỉ dùng khi status='substituted'.
  substitute_name text,
  note           text,
  created_at     timestamptz not null default now(),
  -- 1 ngoại lệ / (tiết, ngày) — huỷ rồi lại dời cùng ngày là vô nghĩa.
  unique (slot_id, date),
  -- Ép dữ liệu đủ nghĩa ngay ở DB, đừng tin form: dời thì phải có đích, dạy thay phải có người.
  constraint tto_moved_needs_target
    check (status <> 'moved' or (new_date is not null and new_period_no is not null)),
  constraint tto_sub_needs_name
    check (status <> 'substituted' or coalesce(substitute_name, '') <> '')
);
create index if not exists idx_tt_over_slot_date on timetable_overrides (slot_id, date);
create index if not exists idx_tt_over_date on timetable_overrides (date);

alter table timetable_overrides enable row level security;

-- Quyền soi theo LỚP của slot — giống hệt tt_read/tt_manage của timetable_slots (0029),
-- để không có đường nào đọc/sửa TKB lớp khác qua bảng ngoại lệ.
drop policy if exists tto_read on timetable_overrides;
create policy tto_read on timetable_overrides for select using (
  exists (
    select 1 from timetable_slots s
    where s.id = slot_id
      and (is_class_student(s.class_id) or staff_can_read_class(s.class_id) or is_parent_of_class(s.class_id))
  )
);

drop policy if exists tto_manage on timetable_overrides;
create policy tto_manage on timetable_overrides for all
  using (
    exists (select 1 from timetable_slots s where s.id = slot_id and staff_can_manage_class(s.class_id))
  )
  with check (
    exists (select 1 from timetable_slots s where s.id = slot_id and staff_can_manage_class(s.class_id))
  );

-- Như 0015: có RLS nhưng thiếu GRANT bảng thì PostgREST trả 42501.
grant select, insert, update, delete on timetable_overrides to authenticated;
