-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0145 — PRD v3 ĐỢT B: MỖI EM 4 WIG (1/DOMAIN) · VÒNG DUYỆT CÓ TRẢ LẠI · VÁ LỖ TỰ DUYỆT
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3 changelog #8: "Bắt buộc mỗi học sinh tạo đúng 4 WIG (1/Domain), format 'Từ X đến Y
-- trong thời gian Z', phải được GVCN thông qua." Trạng thái: draft → sent → approved/rejected,
-- rejected kèm nhận xét để em sửa và gửi lại.
--
-- ── 1. KHOÁ THEO DOMAIN, KHÔNG CÒN THEO KIND ────────────────────────────────────────────────
-- Khoá cũ wigs_em_uidx (student, kind, năm) là luật "2 mục tiêu: học tập + riêng" của Leader in
-- Me (0100). PRD v3 thay bằng "đúng 4, mỗi domain một" — cột kind giữ nguyên trên dữ liệu cũ
-- nhưng thôi làm luật. Đã đếm trước trên production (18/08/2026): không em nào có hai mục tiêu
-- cùng domain, đổi khoá không vấp dòng nào.
drop index if exists wigs_em_uidx;
create unique index if not exists wigs_em_domain_uidx
  on wigs(student_id, area, period_label)
  where scope = 'student';

-- ── 2. TRẠNG THÁI 'rejected' + NHẬN XÉT + VẾT DUYỆT ────────────────────────────────────────
-- Với CAM KẾT tuần dự án từng chốt "không có nút từ chối — lời hứa của một đứa trẻ thì không ai
-- bác bỏ" (0129). WIG năm thì KHÁC theo đúng PRD v3 4.2: bị trả lại phải kèm nhận xét, tức là
-- một lời chỉ đường ("đích này chưa đo được, em ghi rõ số nhé"), không phải một cái lắc đầu.
alter table wigs drop constraint if exists wig_status_ck;
alter table wigs add constraint wig_status_ck
  check (status in ('draft', 'sent', 'approved', 'rejected'));
alter table wigs
  add column if not exists reject_note text,
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz;
comment on column wigs.reject_note is
  'Nhận xét của GVCN khi trả lại (status=rejected). Em sửa gửi lại thì xoá về null.';

-- Trả lại thì phải nói lý do — chốt ở CSDL, không tin form.
alter table wigs drop constraint if exists wig_reject_note_ck;
alter table wigs add constraint wig_reject_note_ck
  check (status <> 'rejected' or coalesce(reject_note, '') <> '');

-- ── 3. VÁ LỖ TỰ DUYỆT (soi RLS 18/08/2026) ─────────────────────────────────────────────────
-- rls_update_wig_cua_em cho em UPDATE mục tiêu của mình với BẤT KỲ status nào — tức gọi thẳng
-- API là em tự đổi 'sent' thành 'approved' được, không cần cô. WITH CHECK không siết được vì em
-- vẫn phải update hợp lệ những dòng đã approved (ghi số đo, đánh dấu đạt — danhDauDaDat). Nên
-- chốt bằng trigger vào đúng CÚ CHUYỂN TRẠNG THÁI: học sinh không được ĐƯA một dòng sang
-- approved, và cũng không được tự xoá nhận xét trả lại mà không đổi nội dung gì (reject_note
-- chỉ về null khi status rời 'rejected' — tức em đã sửa và gửi lại).
create or replace function private.chan_em_tu_duyet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() = 'student'
     and new.status = 'approved'
     and old.status is distinct from 'approved' then
    raise exception 'Chỉ giáo viên duyệt được mục tiêu' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_chan_em_tu_duyet on wigs;
create trigger trg_chan_em_tu_duyet
  before update of status on wigs
  for each row execute function private.chan_em_tu_duyet();
