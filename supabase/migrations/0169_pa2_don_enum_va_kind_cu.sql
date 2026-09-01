-- ═══════════════════════════════════════════════════════════════════════════════════
-- 0169 — PA2: dọn enum + kind cũ.  Chủ dự án 01/09/2026: xây thẳng PA2, không di trú.
-- Đặc tả: docs/PA2/50-DI-TRU §3.6 (bảng tên chốt C13, C30 của 00-TONG-QUAN).
--
-- Vì sao có tệp này, tách khỏi 0168: đây là phần ĐUÔI của việc gỡ mô hình cũ — dọn hai
-- enum mồ côi (wig_period, wig_scope), một cột mồ côi (classes.tick_lock_dow), và siết
-- lại edit_requests.kind về đúng bộ giá trị PA2. Phải chạy NGAY SAU 0168 (cùng buổi):
-- 0168 đã drop wigs + wig_progress_v + ba index của wigs — là những thứ DUY NHẤT còn trỏ
-- vào wig_period/wig_scope (đã đọc pg_depend production 01/09 xác nhận). Trước 0168 mà drop
-- hai enum này thì Postgres từ chối vì wigs.period/wigs.scope còn giữ chúng.
--
-- KHÔNG đụng wig_domain và score_category: hai enum này VẪN có bảng thật dùng
-- (area_config.area, scoreboard_entries.category) — drop nhầm là mất cột/bảng. C30 GIỮ.
-- Idempotent: drop … if exists / drop constraint if exists → dán lại được. Không có
-- 'alter type add value' nên bọc begin/commit bình thường (khác 0161).
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- 1) edit_requests.kind: bỏ 'rename_lead' (app cũ thôi sinh từ PR-4).  Một CHECK soi MỌI
--    dòng của bảng, không riêng dòng 'pending' — nên phải chuyển HẾT dòng 'rename_lead'
--    (kể cả approved/rejected cũ) sang 'khac' TRƯỚC khi siết, nếu không ADD CONSTRAINT đổ
--    vì dòng cũ vi phạm. Giữ vết gốc trong message để đọc lại. Hôm nay bảng 0 dòng (đã đọc
--    01/09), câu update không chạm gì; nhưng app cũ còn tạo 'rename_lead' tới khi PR-4 lên,
--    và tệp idempotent nên chạy lại lúc đó vẫn đúng.
update edit_requests
   set kind = 'khac',
       message = 'rename_lead cũ: ' || coalesce(message, '')
 where kind = 'rename_lead';

alter table edit_requests drop constraint if exists edit_requests_kind_check;
alter table edit_requests add constraint edit_requests_kind_check
  check (kind in ('doi_ten_thuoc', 'mo_tuan_da_ky', 'khac'));

-- 2) Hai enum mồ côi sau 0168.  Chỉ wigs/wig_progress_v/ba index của wigs từng dùng, đều đã
--    drop ở 0168 → phụ thuộc ngoài = 0 (phụ thuộc nội bộ: nhãn enum + kiểu mảng _wig_* rơi
--    theo drop type). GIỮ wig_domain / score_category — còn area_config / scoreboard_entries.
drop type if exists wig_period;
drop type if exists wig_scope;

-- 3) classes.tick_lock_dow: cột mồ côi sau khi 0168 drop hàm tick_open() — khoá tick nay theo
--    CHỮ KÝ biên bản PDR (0154), không còn theo thứ trong tuần. CHECK classes_tick_lock_dow_check
--    chỉ trỏ vào đúng cột này nên rơi theo, không cần cascade. Trigger protect_class_privileged_cols
--    KHÔNG chạm cột này (đã xác nhận 01/09) → drop an toàn.
alter table classes drop column if exists tick_lock_dow;

-- 4) Câu 6 biên bản: lời hứa tự do GIỮ để đọc lại, nhưng từ PA2 cam kết có cấu trúc nằm ở
--    cam_ket.pdr_meeting_id (câu 2 ở pdr_ke_lai) — không còn sinh commitments. Ghi rõ để ai
--    đọc bảng sau này khỏi tưởng q6_commitment là nguồn cam kết.
comment on column pdr_meetings.q6_commitment is
  'Lời hứa tự do của em ở câu 6 (giữ để đọc lại). Từ PA2 cam kết có cấu trúc ở cam_ket.pdr_meeting_id, câu 2 ở pdr_ke_lai — không còn sinh commitments.';

commit;
