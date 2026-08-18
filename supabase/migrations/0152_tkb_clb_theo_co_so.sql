-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0152 — TKB CÂU LẠC BỘ THEO CƠ SỞ (chủ dự án 18/08/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- CLB là LIÊN LỚP: "Bóng rổ" có em nhiều lớp cùng học, GVCN một lớp không quản CLB, không biết
-- em nào chọn CLB nào. Nên CLB theo LỚP (bản 0144) sai thực tế — bỏ. Thay bằng MỘT bảng CLB
-- dùng chung theo CƠ SỞ: BGH/Admin điều phối, mọi người trong cơ sở XEM cùng một lịch, không
-- cần biết membership (em tự biết mình đăng ký gì rồi nhìn lịch chung mà đi).
--
-- PRD v3 chỉ nói "TKB CLB là một lớp dữ liệu thứ hai, phân biệt màu/nhãn" — không chốt phạm vi,
-- nên cách này không trái PRD.

create table if not exists campus_clubs (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id) on delete cascade,
  weekday int not null check (weekday between 2 and 8),   -- 2=T2 … 8=CN (như TKB, 0144)
  start_time time not null,
  end_time time not null,
  name text not null,
  room text,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (length(btrim(name)) between 1 and 120)
);
create index if not exists idx_campus_clubs_campus on campus_clubs (campus_id, weekday, start_time);

alter table campus_clubs enable row level security;
grant select, insert, update, delete on campus_clubs to authenticated;

-- ĐỌC: lịch CLB là thông tin CÔNG KHAI trong cơ sở (như bảng tin), KHÔNG có dữ liệu riêng của
-- trẻ em nào — nên mở đọc cho mọi người đã đăng nhập. (Đơn cơ sở hiện tại; khi đa cơ sở muốn
-- lọc thì thêm điều kiện campus, nhưng bản thân lịch không nhạy cảm.)
drop policy if exists cc_read on campus_clubs;
create policy cc_read on campus_clubs for select using (true);

-- QUẢN: Admin toàn quyền; BGH chỉ cơ sở MÌNH (auth_campus()). GVCN/học sinh/phụ huynh KHÔNG sửa.
drop policy if exists cc_manage on campus_clubs;
create policy cc_manage on campus_clubs for all
  using (auth_role() = 'admin'::user_role
         or (auth_role() = 'principal'::user_role and campus_id = auth_campus()))
  with check (auth_role() = 'admin'::user_role
         or (auth_role() = 'principal'::user_role and campus_id = auth_campus()));

-- ── DẸP CLB THEO LỚP (0144): không cho tạo club trong timetable_slots nữa ────────────────────
-- Không xoá cột start_time/end_time (vô hại, để yên tránh rewrite). Chỉ chặn kind='club' quay lại.
alter table timetable_slots drop constraint if exists timetable_slots_club_band_check;
alter table timetable_slots drop constraint if exists timetable_slots_kind_check;
alter table timetable_slots add constraint timetable_slots_kind_check
  check (kind in ('regular', 'practice', 'exam'));
