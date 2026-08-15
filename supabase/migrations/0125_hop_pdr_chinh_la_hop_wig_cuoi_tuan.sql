-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0125 — HỌP PDR CHÍNH LÀ BUỔI HỌP WIG CUỐI TUẦN, KHÔNG PHẢI MỘT BUỔI KHÁC
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án nói thẳng 15/08/2026: "họp pdr chính là họp wig cuối tuần đó".
--
-- 0121 tôi đã đoán khác — ghi trong chính tệp ấy rằng "lịch PDR từng em là phần của đợt sau" và
-- dựng tuan_da_chot() theo hướng mỗi em có buổi chốt riêng:
--
--     where m.student_id is not distinct from p_student and m.chot_at is not null
--
-- Nhưng chỉ biên bản LỚP mới được đóng dấu chot_at (xem ketThucBuoiHop) — 8 dòng biên bản riêng
-- của các em trên production đều có chot_at rỗng. Nghĩa là cam kết của một em KHÔNG BAO GIỜ khoá:
-- họp xong, chốt xong, em vẫn sửa được lời hứa của tuần vừa qua. Đúng cái lỗ mà luật "chỉ sửa
-- trong ngày họp PDR" sinh ra để bịt.
--
-- Buổi họp WIG của tuần là MỘT: phần chung và phần từng em nằm trong cùng một buổi, cùng một dấu
-- chốt. Nên dấu chốt của LỚP khoá cả tuần — cho cả cam kết của lớp lẫn cam kết của từng em.
create or replace function tuan_da_chot(p_class uuid, p_student uuid, p_week date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from wig_meetings m
    where m.class_id = p_class
      and m.week_start = p_week
      and m.chot_at is not null
      -- Biên bản LỚP là dấu chốt của cả buổi. Giữ thêm nhánh biên bản riêng phòng khi sau này có
      -- đường đóng dấu cho từng em — chốt ở đâu cũng là chốt, không đường nào được lỏng hơn.
      and (m.student_id is null or m.student_id = p_student)
  );
$$;

comment on function tuan_da_chot(uuid, uuid, date) is
  'Tuần này đã chốt trong buổi họp WIG (= buổi PDR) chưa. Dấu chốt của biên bản LỚP khoá cả cam kết của từng em.';
