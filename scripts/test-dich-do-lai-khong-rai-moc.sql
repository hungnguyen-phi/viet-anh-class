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
  -- Chỉ đích ĐẾM ĐƯỢC mà theo dõi ngoài app mới không có mốc. Đơn vị đo lại thì LUÔN có mốc
  -- (dốc), vì ô số đo mỗi tuần đã đưa con số vào trong app — xem lib/wig-tao.ts.
  select id from wigs
  where period = 'year' and measure_by = 'manual' and kieu_don_vi(unit) <> 'do'
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
where period in ('month', 'week') and measure_by = 'manual' and kieu_don_vi(unit) <> 'do';

-- ── 3. MỐC CỦA ĐƠN VỊ ĐO LẠI PHẢI LÀ DỐC, KHÔNG PHẢI LÁT CẮT ────────────────────────────────
-- Đổi luật 14/08/2026. Trước đó phép kiểm này đòi "không mốc tuần nào tính bằng kg/điểm" — đúng
-- với bản vá sáng hôm ấy, nhưng chủ dự án chốt lại: loại này VẪN có mốc tuần (chỗ treo việc, và
-- là con số để so mỗi tuần khi họp), chỉ khác là mốc mang GIÁ TRỊ PHẢI ĐẠT chứ không phải phần
-- cộng thêm.
--
-- Bất biến thật, và nó bắt đúng con bọ gốc ("+1 kg mỗi tuần, xong đích vào tháng 10 rồi thôi"):
--   · tuần CUỐI của năm phải rơi đúng vào đích;
--   · không tuần nào vượt ra ngoài đoạn [xuất phát, đích];
--   · số tuần có mốc phải phủ gần hết năm, không dừng giữa chừng.
with nam as (
  select w.id, w.baseline, w.target_value, w.start_date, w.end_date
  from wigs w
  where w.period = 'year' and kieu_don_vi(w.unit) = 'do'
),
tuan as (
  select n.id, n.baseline, n.target_value,
         count(c.id) as so_moc,
         max(c.end_date) as het,
         n.end_date as het_nam,
         min(least(n.baseline, n.target_value)) as thap,
         max(greatest(n.baseline, n.target_value)) as cao,
         min(c.target_value) as moc_thap,
         max(c.target_value) as moc_cao,
         (array_agg(c.target_value order by c.end_date desc))[1] as moc_cuoi
  from nam n
  -- LEFT join: đích đo lại mà KHÔNG có mốc nào cũng là hỏng, và phải nói ra chứ không được
  -- biến mất khỏi phép kiểm (bool_and trên tập rỗng trả NULL — đọc thành "không sai").
  left join wigs t on t.parent_wig_id = n.id and t.period = 'month'
  left join wigs c on c.parent_wig_id = t.id and c.period = 'week'
  group by n.id, n.baseline, n.target_value, n.end_date
)
insert into ket_qua
select 'Mốc tuần của đơn vị đo lại chạy theo dốc tới đích',
       'tuần cuối = đích, mọi mốc trong đoạn, phủ hết năm',
       coalesce(string_agg(
         case when so_moc = 0 then 'không có mốc tuần nào'
              when moc_cuoi is distinct from target_value then 'tuần cuối ' || coalesce(moc_cuoi::text,'—') || ' ≠ đích ' || target_value
              when moc_thap < thap or moc_cao > cao then 'có mốc ngoài đoạn'
              when het < het_nam - 7 then 'mốc dừng ở ' || het || ' mà năm tới ' || het_nam
              else null end, '; '), 'đúng cả ba'),
       coalesce(bool_and(
         so_moc > 0
         and moc_cuoi is not distinct from target_value
         and moc_thap >= thap and moc_cao <= cao
         and het >= het_nam - 7
       ), true)
from tuan;

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
