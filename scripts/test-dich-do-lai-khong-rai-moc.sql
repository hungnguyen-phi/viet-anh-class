-- ĐÍCH GHI-NHẬN-NGOÀI KHÔNG ĐƯỢC RẢI MỐC (14/08/2026)
--
-- Chủ dự án mở trang WIG và hỏi: "35–50 mà 1 tuần bắt tăng 1kg?". Đúng vậy — mục tiêu lớp
-- "tăng cân 35 → 50 kg" (đơn vị kg, đo bằng ghi nhận ngoài app) đã bị rải thành 15 mốc tuần,
-- mỗi tuần +1 kg, đạt đích vào 11/10 rồi 37 tuần cuối năm không còn mốc nào.
--
-- Hai cái sai chồng lên nhau:
--   · cộng dồn một thứ KHÔNG cộng được — 1kg tuần này với 1kg tuần sau không phải 2kg tăng thêm;
--   · phần phải đi thêm (15) nhỏ hơn số tuần (52) nên raiDeu() rơi vào nhánh "giao 1 cho những
--     mốc đầu rồi dừng" — nhánh ấy hợp lý cho "đọc 20 cuốn sách", vô nghĩa cho cân nặng.
--
-- Luật đã được chốt từ trước ở đường mục tiêu của HỌC SINH (student/actions.ts) nhưng đường mục
-- tiêu của LỚP (lib/wig-tao.ts) quên áp — đúng kiểu lỗi "chẩn đúng một chỗ rồi quên chỗ còn lại"
-- mà repo đã dính vài lần.
--
-- Phép kiểm này là cái chốt cửa: KHÔNG mục tiêu năm nào đo bằng 'manual' được phép có mốc con.
-- Chạy thẳng trên production, chỉ ĐỌC.
--
--   npm run sql -- scripts/test-dich-do-lai-khong-rai-moc.sql

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

-- ── 1. Không mục tiêu 'manual' nào có mốc tháng/tuần treo dưới ────────────────────────────────
with nam as (
  select id from wigs where period = 'year' and measure_by = 'manual'
),
thang as (
  select id from wigs where parent_wig_id in (select id from nam)
),
tuan as (
  select id from wigs where parent_wig_id in (select id from thang)
),
dem as (
  select (select count(*) from thang) + (select count(*) from tuan) as n
)
insert into ket_qua
select 'Đích ghi-nhận-ngoài không có mốc con', '0 mốc', n || ' mốc', n = 0 from dem;

-- ── 2. Không mốc nào THỪA KẾ 'manual' mà lại đứng lẻ ngoài luật trên ──────────────────────────
-- Bắt trường hợp mốc được tạo bằng đường khác (nhập tay, kịch bản cũ) rồi trôi vào cùng vũng.
insert into ket_qua
select
  'Không mốc tháng/tuần nào đo bằng ghi-nhận-ngoài',
  '0 mốc',
  count(*) || ' mốc',
  count(*) = 0
from wigs
where period in ('month', 'week') and measure_by = 'manual';

-- ── 3. Đơn vị đo lại (kg, cm, điểm, %) không được nằm ở mốc tuần ──────────────────────────────
-- Chốt thứ hai, độc lập với cột measure_by: kể cả ai đó khai 'tick' cho một mục tiêu tính bằng
-- kg thì mốc tuần "1 kg" vẫn là một câu vô nghĩa.
insert into ket_qua
select
  'Không mốc tuần nào tính bằng đơn vị đo lại',
  '0 mốc',
  count(*) || ' mốc',
  count(*) = 0
from wigs
where period = 'week' and lower(btrim(coalesce(unit, ''))) in ('kg', 'cm', 'điểm', 'diem', '%');

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua
order by dat, buoc;

select
  count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
  bool_and(dat) as tat_ca_dat
from ket_qua;
