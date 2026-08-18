-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0148 — KHỚP V3 NỐT: SỬA LỖI THÊM CLB · CẢM XÚC 6 LOẠI · ĐIỂM DANH THEO LUẬT V3 ·
--        WIG LỚP QUA TAY BGH · CAM KẾT CHỈ TREO DƯỚI WIG ĐÃ DUYỆT
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. SỬA LỖI THÊM CLB (chủ dự án báo 18/08: "ấn thêm CLB, load xong TKB chả có gì") ───────
-- Chuỗi lỗi: CLB không có subject_id → trigger ensure_class_subject (0069) vẫn đem NULL đi ghi
-- vào class_subjects → guard bên đó văng "Môn này không thuộc danh mục…" → cả lượt thêm bị huỷ,
-- còn câu lỗi thì hiện ở banner đầu trang, xa chỗ vừa bấm. CLB (và mọi dòng không mang môn)
-- không có gì để gieo vào chương trình lớp — bỏ qua là xong.
create or replace function ensure_class_subject() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.subject_id is null then
    return null;
  end if;
  insert into class_subjects (class_id, subject_id, created_by)
  values (new.class_id, new.subject_id, auth.uid())
  on conflict (class_id, subject_id) do nothing;
  return null;
end $$;
revoke all on function ensure_class_subject() from public, anon, authenticated;

-- ── 2. CẢM XÚC CHECK-IN: 6 LOẠI CỦA PRD V3 (mục 9.2) ───────────────────────────────────────
-- Bộ cũ là THANG 5 MỨC (great→bad); v3 đổi sang 6 CẢM XÚC gọi tên được: vui, bình thường,
-- buồn, mệt, lo lắng, tức giận. THÊM giá trị chứ không đổi tên giá trị cũ: dòng check-in cũ
-- là cảm xúc thật trẻ đã bấm — dịch "low" thành "mệt" là bịa lại dữ liệu. Ô chọn chỉ đưa ra
-- 6 loại mới; dòng cũ hiện bằng nhãn cũ trong lịch sử.
alter type mood_level add value if not exists 'happy';
alter type mood_level add value if not exists 'okay';
alter type mood_level add value if not exists 'sad';
alter type mood_level add value if not exists 'tired';
alter type mood_level add value if not exists 'worried';
alter type mood_level add value if not exists 'angry';

-- ── 3. ĐIỂM DANH THEO MA TRẬN V3 (mục 6.2.3 + 7.2) ─────────────────────────────────────────
-- Luật v3: GVCN hoặc tổ trưởng điểm danh sửa — CHỈ NGÀY HÔM NAY; ngày cũ chỉ Admin;
-- BGH KHÔNG sửa điểm danh thủ công ("không sửa điểm danh thủ công của lớp" — 7.2), chỉ đọc.
-- Bản 0127 đang cho admin + BGH sửa mọi ngày và GVCN/tổ trưởng không sửa được gì.
create or replace function la_to_truong_diem_danh(c uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from enrollments
    where student_id = (select auth.uid()) and class_id = c
      and is_active and is_attendance_leader
  );
$$;
revoke all on function la_to_truong_diem_danh(uuid) from public, anon;
grant execute on function la_to_truong_diem_danh(uuid) to authenticated;

drop policy if exists rls_insert_attendance_records on attendance_records;
create policy rls_insert_attendance_records on attendance_records for insert
  with check (
    auth_role() = 'admin'::user_role
    or (
      date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (is_class_teacher(class_id) or la_to_truong_diem_danh(class_id))
    )
  );

drop policy if exists rls_update_attendance_records on attendance_records;
create policy rls_update_attendance_records on attendance_records for update
  using (
    auth_role() = 'admin'::user_role
    or (
      date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (is_class_teacher(class_id) or la_to_truong_diem_danh(class_id))
    )
  )
  with check (
    auth_role() = 'admin'::user_role
    or (
      date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (is_class_teacher(class_id) or la_to_truong_diem_danh(class_id))
    )
  );

drop policy if exists rls_delete_attendance_records on attendance_records;
create policy rls_delete_attendance_records on attendance_records for delete
  using (
    auth_role() = 'admin'::user_role
    or (
      date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (is_class_teacher(class_id) or la_to_truong_diem_danh(class_id))
    )
  );

-- ── 4. WIG LỚP QUA TAY BGH (quyết định 18/08 cho câu hỏi mở #6) ─────────────────────────────
-- GVCN tạo WIG lớp → vào 'sent'; BGH (principal) hoặc admin mới đưa sang 'approved'.
-- ÉP về 'sent' thay vì văng lỗi ở đường tạo: cô không phải học một luật mới giữa chừng —
-- mục tiêu vẫn tạo được, chỉ mang thêm chip "chờ BGH duyệt". Riêng cú SỬA sang approved
-- thì chặn hẳn: đó là hành vi duyệt, không phải hành vi tạo.
create or replace function private.wig_lop_qua_tay_bgh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scope = 'class' and auth_role() = 'teacher' then
    if tg_op = 'INSERT' and new.status = 'approved' then
      new.status := 'sent';
    elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
      raise exception 'WIG của lớp do ban giám hiệu duyệt' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_wig_lop_qua_tay_bgh on wigs;
create trigger trg_wig_lop_qua_tay_bgh
  before insert or update of status on wigs
  for each row execute function private.wig_lop_qua_tay_bgh();

-- ── 5. CAM KẾT CHỈ TREO DƯỚI WIG ĐÃ DUYỆT (v3 4.2 / 6.2.5) ─────────────────────────────────
-- Bản đang chạy trên production đã đọc lại từ pg_proc trước khi viết đè (luật của dự án):
-- toàn bộ thân hàm giữ nguyên, CHÈN đúng một chốt status sau chốt 'cuon'.
create or replace function private.cam_ket_hop_le()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare w record;
begin
  select * into w from wigs where id = new.wig_id;
  if not found then
    raise exception 'Mục tiêu năm không còn nữa.' using errcode = 'foreign_key_violation';
  end if;
  if w.period <> 'year' then
    raise exception 'Cam kết chỉ treo được dưới mục tiêu NĂM.' using errcode = 'check_violation';
  end if;
  -- Mục tiêu CUỘN không nhận việc: số của nó đếm ngược từ mục tiêu năm của từng em (0116), nên
  -- treo một cam kết vào đó là hứa với một cái không đếm lời hứa.
  if w.measure_by = 'cuon' then
    raise exception 'Mục tiêu cuộn không nhận cam kết tuần.' using errcode = 'check_violation';
  end if;
  -- PRD v3: chỉ WIG ĐÃ DUYỆT mới gắn được weekly commitment (0148).
  if w.status is distinct from 'approved' then
    raise exception 'Mục tiêu năm này chưa được duyệt — duyệt xong mới đặt cam kết được.'
      using errcode = 'check_violation';
  end if;

  if new.student_id is null then
    if w.scope::text <> 'class' or w.class_id is distinct from new.class_id then
      raise exception 'Cam kết của lớp phải treo dưới mục tiêu năm của CHÍNH lớp ấy.'
        using errcode = 'check_violation';
    end if;
  else
    -- HAI ĐƯỜNG HỢP LỆ, và chỉ hai:
    --   · mục tiêu năm của CHÍNH EM  (mục tiêu riêng, không thuộc trận nào của lớp);
    --   · mục tiêu năm CỦA LỚP EM ĐANG HỌC (em chọn trận đánh của tuần này — 0138).
    if not (
      (w.scope::text = 'student' and w.student_id is not distinct from new.student_id)
      or (w.scope::text = 'class' and w.class_id is not distinct from new.class_id)
    ) then
      raise exception 'Cam kết của một bạn phải treo dưới mục tiêu năm của chính bạn ấy, hoặc một mục tiêu năm của lớp bạn ấy.'
        using errcode = 'check_violation';
    end if;
    if not exists (select 1 from enrollments e
                   where e.student_id = new.student_id and e.class_id = new.class_id and e.is_active) then
      raise exception 'Bạn này không còn học ở lớp đó.' using errcode = 'check_violation';
    end if;
  end if;

  -- Lĩnh vực THỪA KẾ, không khai lại.
  new.area := w.area;
  return new;
end $$;
