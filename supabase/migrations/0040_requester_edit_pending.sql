-- 0040 — Học sinh/PH SỬA hoặc RÚT LẠI yêu cầu-sửa CỦA MÌNH khi còn 'pending'.
--
-- Quyết định 2026-07-26: GVCN VẪN là người duyệt đổi target (giữ cơ chế cam kết 4DX của
-- PRD §6.2 màn 5-6 — lead measure chốt trong buổi họp Coach × Buddy, nếu học sinh tự sửa
-- được target thì điểm thi đua "trung bình LM hoàn thành/HS" thành ra ai hạ target thấp thì
-- điểm cao). Cái được mở là quyền sửa CHÍNH YÊU CẦU của mình trong lúc GVCN chưa xử lý:
-- gửi sai lời nhắn thì sửa/rút, không phải chờ bị từ chối rồi gửi lại từ đầu.
--
-- Trước 0040, 0034 chỉ có er_requester_insert + er_requester_read → học sinh gửi xong là
-- BẾ TẮC, mà unique index edit_requests_pending_uidx (0035) chỉ cho 1 pending mỗi
-- (student_id, kind, ref_id) nên cũng không gửi lại được cái mới.
--
-- WITH CHECK giữ `status = 'pending'` → học sinh KHÔNG thể tự đặt status = 'approved'
-- (tự duyệt yêu cầu của mình). Giữ luôn guard quan hệ lớp/con như er_requester_insert để
-- không sửa class_id/student_id sang lớp khác.
set search_path = public;

drop policy if exists er_requester_update on edit_requests;
create policy er_requester_update on edit_requests for update
  using (requester_id = auth.uid() and status = 'pending')
  with check (
    requester_id = auth.uid() and status = 'pending'
    and (is_class_student(class_id) or is_my_child(student_id))
  );

drop policy if exists er_requester_delete on edit_requests;
create policy er_requester_delete on edit_requests for delete
  using (requester_id = auth.uid() and status = 'pending');
