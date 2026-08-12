-- ════════════════════════════════════════════════════════════════════════════
-- 0102 — CỬA SỔ MỘT NGÀY: mục tiêu vừa đặt thì còn sửa/xoá được, sau đó thì khoá
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án chốt 12/08/2026:
--
--   "giáo viên đặt thì hs có thể yêu cầu sửa, hoặc hs tự xoá ngay thì mất request luôn, hoặc có
--    thể tự sửa; sau 1 ngày thì giáo viên mới có quyền xoá, sửa. Học sinh đặt thì gv có thể xem,
--    xoá, sửa, thêm."
--
-- VÌ SAO CẦN: 0100 cho cô đặt hộ, và mục tiêu cô đặt vào thẳng `status='approved'`. Chính sách
-- rls_update_wig_cua_em chỉ mở cho `status in ('draft','sent')`, nên em MỞ MẮT RA ĐÃ THẤY một mục
-- tiêu mang tên mình mà không sửa nổi một chữ, cũng không bỏ được. Đó đúng là thứ 4DX gọi là
-- *dictate*, chỉ khác là lần này nó có vẻ ngoài của một món quà.
--
-- CỬA SỔ MỘT NGÀY là chỗ dung hoà: 24 giờ đầu mục tiêu vẫn là ĐỀ NGHỊ — em sửa lại cho đúng người
-- mình, hoặc xoá thẳng (xoá là "con không nhận"), không cần đơn từ gì cả. Qua 24 giờ nó thành CAM
-- KẾT: em muốn đổi thì xin cô, vì một cam kết sửa được lúc nào cũng được thì không phải cam kết.
--
-- Người lớn không đụng tới cửa sổ này: rls_all_wigs cho cô/quản trị sửa xoá thêm bất cứ lúc nào,
-- kể cả mục tiêu do chính em đặt. Đây là lớp học tiểu học, không phải hợp đồng.

-- ── 1. EM SỬA ĐƯỢC KHI NÀO ───────────────────────────────────────────────────────────────────
--
-- Hai vế, hoặc-là:
--   · còn nháp / vừa gửi chờ duyệt  → em vẫn đang cầm bút, chưa ai duyệt gì
--   · vừa tạo trong vòng 24 giờ     → kể cả cô đặt hộ và duyệt luôn, em vẫn được nói lại
drop policy if exists rls_update_wig_cua_em on wigs;
create policy rls_update_wig_cua_em on wigs for update
  using (
    scope = 'student'
    and student_id = (select auth.uid())
    and (status in ('draft', 'sent') or created_at > now() - interval '1 day')
  )
  with check (
    scope = 'student'
    and student_id = (select auth.uid())
    and (status in ('draft', 'sent') or created_at > now() - interval '1 day')
  );

-- ── 2. EM XOÁ ĐƯỢC KHI NÀO ───────────────────────────────────────────────────────────────────
--
-- Trước bản này học sinh KHÔNG có chính sách delete nào trên wigs, nên "hs tự xoá ngay thì mất
-- request luôn" là bất khả thi ở tầng CSDL. Mở đúng cùng một cửa sổ với sửa — không rộng hơn.
--
-- Xoá kéo theo lead_measures (on delete cascade) và lead_progress dưới nó. Đó là chủ ý: trong 24
-- giờ đầu gần như chưa có lượt tick nào, còn nếu có thì chúng thuộc về một mục tiêu em vừa từ chối.
drop policy if exists rls_delete_wig_cua_em on wigs;
create policy rls_delete_wig_cua_em on wigs for delete
  using (
    scope = 'student'
    and student_id = (select auth.uid())
    and (status in ('draft', 'sent') or created_at > now() - interval '1 day')
  );

-- ── 3. VIỆC CỦA EM ĐI THEO MỤC TIÊU ──────────────────────────────────────────────────────────
--
-- Cùng một cửa sổ. Lệch nhau thì sinh ra trạng thái không giải thích được cho ai: em sửa được câu
-- mục tiêu nhưng không sửa nổi cái việc treo ngay dưới nó.
drop policy if exists rls_write_viec_cua_em on lead_measures;
create policy rls_write_viec_cua_em on lead_measures for all
  using (
    exists (select 1 from wigs w
            where w.id = lead_measures.wig_id
              and w.scope = 'student'
              and w.student_id = (select auth.uid())
              and (w.status in ('draft', 'sent') or w.created_at > now() - interval '1 day'))
  )
  with check (
    exists (select 1 from wigs w
            where w.id = lead_measures.wig_id
              and w.scope = 'student'
              and w.student_id = (select auth.uid())
              and (w.status in ('draft', 'sent') or w.created_at > now() - interval '1 day'))
  );
