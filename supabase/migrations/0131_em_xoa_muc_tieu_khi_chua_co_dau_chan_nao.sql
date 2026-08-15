-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0131 — EM XOÁ ĐƯỢC MỤC TIÊU KHI NÓ CHƯA MANG DẤU CHÂN NÀO, KHÔNG PHẢI KHI NÓ CÒN MỚI
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Lỗ do CHÍNH 0129 mở ra, và bộ kiểm test-cua-so-mot-ngay bắt được ngay lượt chạy sau:
--
--   Chính sách xoá cũ cho em xoá khi `status in ('draft','sent')` HOẶC còn trong 24 giờ. Ở mô
--   hình cũ, 'sent' nghĩa là "chưa ai duyệt, vẫn còn là bản nháp" — xoá thì không mất gì.
--   0129 làm 'sent' mang thêm một nghĩa thứ hai: "mục tiêu ĐÃ chạy cả kỳ, em vừa sửa nên chờ
--   duyệt lại". Hai nghĩa ấy khác hẳn nhau, mà chính sách chỉ nhìn thấy một chữ.
--
--   Hậu quả: em sửa một mục tiêu ba tháng tuổi (→ 'sent') rồi xoá sạch nó cùng toàn bộ lượt tick.
--
-- ── ĐỔI CÂU HỎI, KHÔNG VÁ CÂU TRẢ LỜI ──────────────────────────────────────────────────────
--
-- Cái đồng hồ 24 giờ vốn là một PHỎNG ĐOÁN cho câu hỏi thật: "xoá cái này có làm mất công sức
-- của ai không?". Nay hỏi thẳng câu ấy — mục tiêu chưa có LƯỢT TICK nào thì xoá không mất gì,
-- bất kể nó ra đời hôm qua hay ba tháng trước. Có tick rồi thì em phải nhờ cô, vì đó là dấu chân
-- của chính em trên những ngày đã qua.
--
-- Cũng gọn hơn cho em: đường "con không nhận mục tiêu cô đặt hộ" không còn hết hạn sau một ngày.
drop policy if exists rls_delete_wig_cua_em on wigs;
create policy rls_delete_wig_cua_em on wigs for delete
  using (
    scope = 'student'
    and student_id = (select auth.uid())
    and not exists (
      select 1
      from commitments c
      join lead_measures lm on lm.commitment_id = c.id
      join lead_progress lp on lp.lead_measure_id = lm.id
      where c.wig_id = wigs.id
    )
  );

comment on policy rls_delete_wig_cua_em on wigs is
  'Em xoá được mục tiêu CỦA MÌNH khi chưa có lượt tick nào treo dưới. Có tick rồi thì nhờ cô — xoá là mất dấu chân của chính em.';
