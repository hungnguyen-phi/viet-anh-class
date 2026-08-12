-- ════════════════════════════════════════════════════════════════════════════
-- 0104 — BẠN ĐỒNG HÀNH HẰNG TUẦN (buddy_pairs)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Individual WIG Plan có "accountability partner" — mỗi em có MỘT bạn đồng hành cố định trong
-- tuần để nhắc nhau, không phải chọn tuỳ hứng mỗi lần họp. Trước migration này cột `buddy_id` chỉ
-- sống trong `wig_meetings`: cô gõ tay MỖI LẦN lưu biên bản, không có gì nhớ ai đi với ai tuần
-- trước, và học sinh không thấy "bạn đồng hành của mình tuần này là ai" ở đâu ngoài lúc mở lại
-- đúng biên bản đó. Đây là khoảng trống đã ghi trong docs/MO_HINH_WIG.md từ 0100.
--
-- Bảng này lưu MỘT DÒNG / (lớp, tuần, học sinh) — "bạn đồng hành của em trong tuần này là ai".
-- Sinh bằng thuật toán ghép ngẫu nhiên phía server (lib/buddy-pair.ts), GVCN bấm nút, KHÔNG cần
-- cron/edge function — dự án này đã có bài học "attendance-reminders chưa deploy" vì phụ thuộc hạ
-- tầng ngoài Next.js. Nhịp thứ Sáu là quy ước vận hành (cô ghép cho tuần sau vào chiều thứ Sáu),
-- không phải luật app ép — app cho ghép bất cứ tuần nào, kể cả tuần đang chạy.

create table if not exists buddy_pairs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  week_start date not null,
  student_id uuid not null references profiles(id) on delete cascade,
  buddy_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Mỗi em đúng MỘT bạn đồng hành mỗi tuần — ghép lại thì THAY, không đẻ dòng thứ hai.
  unique (class_id, week_start, student_id),
  check (student_id <> buddy_id)
);

create index if not exists idx_buddy_pairs_student_week on buddy_pairs (student_id, week_start);
create index if not exists idx_buddy_pairs_class_week on buddy_pairs (class_id, week_start);

alter table buddy_pairs enable row level security;

-- ĐỌC: chính em, em được ghép LÀM bạn đồng hành của bạn kia (thấy tên bạn), người lớn phụ trách
-- lớp, và phụ huynh của em đó. Không cho học sinh đọc tràn cả lớp — mỗi em chỉ thấy phần của mình.
drop policy if exists rls_select_buddy_pairs on buddy_pairs;
create policy rls_select_buddy_pairs on buddy_pairs for select
  using (
    student_id = (select auth.uid())
    or buddy_id = (select auth.uid())
    or staff_can_read_class(class_id)
    or is_my_child(student_id)
  );

-- GHI: chỉ GVCN của lớp hoặc admin — đúng người vẫn đang gõ buddy_id tay ở wig_meetings hôm nay.
drop policy if exists rls_write_buddy_pairs on buddy_pairs;
create policy rls_write_buddy_pairs on buddy_pairs for all
  using (is_class_teacher(class_id) or auth_role() = 'admin')
  with check (is_class_teacher(class_id) or auth_role() = 'admin');

grant select, insert, update, delete on buddy_pairs to authenticated;
