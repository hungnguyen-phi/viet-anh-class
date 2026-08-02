-- Dọn 27 dòng lead_progress do NGƯỜI LỚN GÕ TAY (student_id IS NULL) — quyết định 2026-08-02,
-- đi cùng migration 0073 (thắng/thua WIG lớp tính từ tick thật của học sinh).
--
-- Vì sao phải dọn chứ không để lại: wig_actual() cộng MỌI dòng lead_progress, không phân biệt ai
-- ghi. Để lại thì bảng điểm mới vẫn mang theo con số cũ — trên màn hình GVCN của 7B1 nó hiện ra
-- đúng cái nghịch lý: thanh tiến độ 24/30 mà "0/3 em đã góp".
--
-- ĐÃ SAO LƯU nguyên vẹn (id, giá trị, ngày, người ghi) tại:
--   scripts/restore-lead-progress-go-tay-2026-08-02.sql
-- Cần lấy lại thì chạy file đó — xem ghi chú trong đó về hai nhóm dòng khác bản chất nhau.
begin;

create temp table truoc on commit drop as
select count(*) filter (where student_id is null)     as go_tay,
       count(*) filter (where student_id is not null) as tick_that
from lead_progress;

delete from lead_progress where student_id is null;

select t.go_tay        as da_xoa_go_tay,
       t.tick_that     as tick_that_giu_nguyen,
       (select count(*) from lead_progress)                          as con_lai_tong,
       (select count(*) from lead_progress where student_id is null) as con_sot_go_tay
from truoc t;

commit;
