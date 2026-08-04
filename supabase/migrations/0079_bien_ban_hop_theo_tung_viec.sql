-- Biên bản họp WIG ghi theo TỪNG VIỆC, không phải ba ô văn bản cho cả lớp.
--
-- VÌ SAO. Buổi họp WIG hiện có đúng ba ô: chiêm nghiệm, cam kết, kế hoạch tuần sau — cho CẢ LỚP.
-- Không ai bị gọi tên, không có chỗ ghi lý do cho từng mục tiêu. So với app 4DX của chính công ty
-- (Major WIGs Tracker, xem lại 2026-08-04): ở đó buổi họp là một BẢNG, mỗi dòng một việc, có cột
-- "tuần trước" để đối chiếu cam kết, nút thắng/thua bấm tại chỗ, và ô chiêm nghiệm riêng. Chất
-- lượng câu người ta viết vào cao hẳn vì có chỗ để viết: "Đạt 169/100 share: nhờ viết nhiều bài
-- hơn, tạo nhiều ảnh hơn, dùng 2 skills mới".
--
-- BA QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (2026-08-04), migration này thi hành đúng như vậy:
--
-- 1) THẮNG/THUA CHỈ LÀ GHI NHẬN CỦA BUỔI HỌP, không đổi kết quả thật. Bảng BGH, điểm thi đua,
--    xếp hạng lớp vẫn đọc từ tick của học sinh như hiện nay. Đây là ranh giới đặt ra từ f596b4b
--    ("lớp nào cũng thắng vì bảng chỉ phản chiếu tay người bấm") và bản này KHÔNG được phá.
--    Hệ quả đáng giá: khi giáo viên chấm NGƯỢC với con số, BGH thấy cả hai vế — vừa là chỗ để
--    nói "các em làm thật, chỉ thiếu vì nghỉ lễ", vừa là dấu hiệu nếu một lớp tuần nào cũng tự
--    chấm thắng ngược số liệu.
--
-- 2) Lời hứa tuần trước hiện NGUYÊN VĂN (đọc ô next_actions của biên bản tuần trước) — không
--    cấu trúc hoá, không thêm bước nhập liệu. Vì vậy migration này không tạo gì cho phần đó.
--
-- 3) Ô "rút ra điều gì" CHỈ GVCN + BGH đọc. Chặn ở RLS chứ không chỉ ẩn trên giao diện: đây là
--    nhận xét về việc học của trẻ, và một khi đã mở cho phụ huynh thì không rút lại được.

set search_path = public;

create table if not exists wig_meeting_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  -- Thứ Hai của tuần họp. Dùng NGÀY chứ không dùng nhãn kỳ: nhãn là chữ người gõ, có thể bỏ
  -- trống hoặc gõ khác quy ước — đúng lý do 0073 đã chọn ngày, và đúng chỗ đã gây sự cố 7B1.
  week_start date not null,
  lead_measure_id uuid not null references lead_measures(id) on delete cascade,
  -- null = buổi họp chưa chấm việc này. Cố ý cho phép: giáo viên có thể chỉ ghi chú mà không
  -- chấm, hoặc chấm mà không ghi chú.
  verdict text check (verdict in ('win', 'lose')),
  note text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (class_id, week_start, lead_measure_id)
);

comment on table wig_meeting_notes is
  'Ghi nhận của BUỔI HỌP cho từng việc: lớp tự chấm thắng/thua và rút ra điều gì. KHÔNG phải nguồn tính thắng/thua thật — cái đó vẫn từ tick của học sinh. Xem 0079.';

create index if not exists ix_wig_meeting_notes_tuan
  on wig_meeting_notes (class_id, week_start);

alter table wig_meeting_notes enable row level security;

-- ĐỌC: giáo viên chủ nhiệm lớp đó, hiệu trưởng cùng cơ sở, admin. Học sinh và phụ huynh KHÔNG —
-- đúng quyết định 3 ở trên. staff_can_read_class (0004) đã gói sẵn đúng ba vai này.
drop policy if exists rls_select_wig_meeting_notes on wig_meeting_notes;
create policy rls_select_wig_meeting_notes on wig_meeting_notes
  for select using (staff_can_read_class(class_id));

-- GHI: chỉ GVCN của chính lớp đó và admin. Hiệu trưởng đọc được nhưng không sửa — người chịu
-- trách nhiệm về nhận xét trong lớp là giáo viên chủ nhiệm, cùng nguyên tắc đã dùng cho ảnh lớp
-- (0063) và cho biên bản họp.
drop policy if exists rls_all_wig_meeting_notes on wig_meeting_notes;
create policy rls_all_wig_meeting_notes on wig_meeting_notes
  for all using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

-- Chốt chặn ở tầng dữ liệu: việc được chấm phải THUỘC LỚP ĐÓ. Không có nó thì một GVCN gửi lên
-- lead_measure_id của lớp khác vẫn ghi được — RLS chỉ kiểm class_id trong chính dòng đang ghi,
-- mà class_id ấy do người gửi tự khai.
create or replace function wig_meeting_note_dung_lop() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where lm.id = new.lead_measure_id and w.class_id = new.class_id
  ) then
    raise exception 'Việc này không thuộc lớp đó';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tg_wig_meeting_note_dung_lop on wig_meeting_notes;
create trigger tg_wig_meeting_note_dung_lop
  before insert or update on wig_meeting_notes
  for each row execute function wig_meeting_note_dung_lop();
