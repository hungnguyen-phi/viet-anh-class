-- 0039 — Tick lead measure: khoá theo NGÀY (giờ VN) thay vì "24h trượt", + chặn tick bù quá khứ.
--
-- Quyết định 2026-07-26 (đổi so với PRD §6.2 màn 4 "không sửa được mục đã tick quá 24 giờ"):
-- trong ngày học sinh được tick / bỏ tick thoải mái; qua 00:00 giờ VN thì lượt cũ khoá lại và
-- mở lượt mới. Mốc "24h trượt tính từ created_at" ở 0004 không khớp nhịp ngày — tick 21:00 hôm
-- nay vẫn bỏ được lúc 08:00 hôm sau, còn tick 08:00 thì lại khoá đúng lúc đang học hôm sau.
--
-- Vá kèm 2 lỗ ở 0004_rls_policies.sql:
--   a) lp_student_insert KHÔNG giới hạn logged_date → học sinh tự gửi logged_date của ngày cũ để
--      tick bù quá khứ (cột có DEFAULT vn_today() nhưng client gửi giá trị khác là ghi đè được).
--   b) lp_student_update chỉ kiểm logged_by ở WITH CHECK → sửa được logged_date sang ngày khác,
--      lách luôn cửa sổ khoá.
-- GVCN/Admin không bị ảnh hưởng: lp_staff_manage giữ nguyên, vẫn sửa được mọi ngày.
set search_path = public;

drop policy if exists lp_student_insert on lead_progress;
create policy lp_student_insert on lead_progress for insert
  with check (
    student_id = auth.uid() and logged_by = auth.uid()
    and is_class_student(lead_class(lead_measure_id))
    and logged_date = vn_today()
  );

drop policy if exists lp_student_update on lead_progress;
create policy lp_student_update on lead_progress for update
  using (logged_by = auth.uid() and logged_date = vn_today())
  with check (logged_by = auth.uid() and logged_date = vn_today());

drop policy if exists lp_student_delete on lead_progress;
create policy lp_student_delete on lead_progress for delete
  using (logged_by = auth.uid() and logged_date = vn_today());
