-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0128 — BỎ SCOREBOARD 4 HẠNG MỤC: "CHỈ HIỆN LÊN CÁC COMMITMENT TUẦN VÀ LEAD MEASURE"
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3 §0.2 ghi bảng scoreboard 4 hạng mục (5 Giá trị/7 Thói quen/DEAR/Thể chất/Khác) là "vẫn
-- nằm trong phạm vi 100% nhưng CHƯA xây" — nhưng nó ĐÃ XÂY và đang chạy thật ở /scoreboard
-- (RPC class_scoreboard). Chủ dự án chốt 15/08/2026: bỏ hẳn, trang lớp (/wig) — vốn đã hiện
-- đúng "cam kết tuần + việc dẫn dắt" — là đủ.
drop function if exists public.class_scoreboard(uuid);
