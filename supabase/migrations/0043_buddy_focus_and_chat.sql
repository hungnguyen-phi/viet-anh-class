-- 0043 — Buddy giai đoạn 2: (a) ghi chú neo vào lead measure thật, (b) chat CHỈ trong buổi họp.
--
-- Quyết định 2026-07-27:
--   * Ngày thường: học sinh KHÔNG tương tác. Mở app là ghi chú tự sinh, 1 lần/ngày, và chỉ sinh
--     lại khi dữ liệu THAY ĐỔI (có tick mới kể từ ghi chú trước) → không cron, không tốn tiền cho
--     em không dùng app, cũng không có nút để bấm loạn.
--   * Chỉ trong buổi họp WIG mới cho học sinh trò chuyện với Buddy, và phải do GVCN MỞ
--     (buddy_chat_open). Lý do: lúc họp thì GVCN ngồi ngay cạnh — đó là lớp bảo vệ mạnh nhất cho
--     một con chat với trẻ em, mạnh hơn mọi bộ lọc từ khoá.
set search_path = public;

-- ============================================================
-- 1) Ghi chú hằng ngày: neo "việc hôm nay" vào MỘT lead measure thật
-- ============================================================
-- Vì sao cần cột này: trong 4DX học sinh không tác động được vào WIG, em chỉ TICK được lead
-- measure. Bản 0042 chỉ cho model xem WIG theo lĩnh vực nên nó khuyên ở tầng em không có nút nào
-- để bấm. Nay model trả về SỐ THỨ TỰ trong danh sách lead measure server gửi đi (không phải UUID —
-- giữ cam kết không cho UUID rời hệ thống), server map lại thành id thật và KIỂM tra id đó có nằm
-- trong danh sách đã gửi. Model không có đường bịa ra việc mà app không có.
alter table wig_meetings
  add column if not exists buddy_focus_lead_id uuid references lead_measures(id) on delete set null,
  add column if not exists buddy_action        text,
  add column if not exists buddy_tokens        int;

alter table wig_meetings drop constraint if exists wig_meetings_buddy_action_check;
alter table wig_meetings add constraint wig_meetings_buddy_action_check
  check (buddy_action is null or buddy_action in ('tick_lead', 'ask_teacher', 'checkin_mood', 'none'));

comment on column wig_meetings.buddy_focus_lead_id is
  'Lead measure Buddy chọn làm "việc hôm nay". Server tự map từ số thứ tự model trả về và kiểm nằm trong danh sách đã gửi.';
comment on column wig_meetings.buddy_tokens is
  'Token OpenRouter đã dùng cho lần sinh gần nhất — để theo dõi chi phí thật thay vì ước lượng.';

-- ============================================================
-- 2) Chat lúc họp — GVCN là người mở/đóng
-- ============================================================
alter table wig_meetings
  add column if not exists buddy_chat_open boolean not null default false;

comment on column wig_meetings.buddy_chat_open is
  'GVCN mở trong buổi họp thì học sinh mới chat được với Buddy. Mặc định đóng.';

create table if not exists buddy_messages (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references wig_meetings(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists buddy_messages_meeting_idx on buddy_messages (meeting_id, created_at);

alter table buddy_messages enable row level security;

-- Học sinh: đọc hội thoại của CHÍNH buổi họp của mình.
drop policy if exists bm_student_read on buddy_messages;
create policy bm_student_read on buddy_messages for select using (
  exists (select 1 from wig_meetings m where m.id = meeting_id and m.student_id = auth.uid())
);

-- Học sinh: chỉ gửi được tin của MÌNH (role='user') và CHỈ khi GVCN đã mở chat.
-- Câu trả lời của Buddy (role='assistant') do server ghi bằng service_role → học sinh không
-- giả được lời của Buddy.
drop policy if exists bm_student_insert on buddy_messages;
create policy bm_student_insert on buddy_messages for insert with check (
  role = 'user'
  and exists (
    select 1 from wig_meetings m
    where m.id = meeting_id and m.student_id = auth.uid() and m.buddy_chat_open
  )
);

-- GVCN/BGH/Admin đọc TOÀN BỘ transcript — bắt buộc với app cho trẻ em: người lớn phải xem lại được.
drop policy if exists bm_staff_read on buddy_messages;
create policy bm_staff_read on buddy_messages for select using (
  exists (select 1 from wig_meetings m where m.id = meeting_id and staff_can_read_class(m.class_id))
);

drop policy if exists bm_staff_manage on buddy_messages;
create policy bm_staff_manage on buddy_messages for all
  using (
    exists (select 1 from wig_meetings m where m.id = meeting_id and staff_can_manage_class(m.class_id))
  )
  with check (
    exists (select 1 from wig_meetings m where m.id = meeting_id and staff_can_manage_class(m.class_id))
  );

drop policy if exists bm_admin_all on buddy_messages;
create policy bm_admin_all on buddy_messages for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- Như 0015: có RLS nhưng thiếu GRANT bảng thì PostgREST trả 42501.
grant select, insert on buddy_messages to authenticated;
grant select, insert, update, delete on buddy_messages to service_role;
