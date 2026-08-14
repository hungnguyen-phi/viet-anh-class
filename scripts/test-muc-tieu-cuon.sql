-- MỤC TIÊU CUỘN BA TẦNG: TRƯỜNG ĐẾM LỚP, LỚP ĐẾM HỌC SINH (14/08/2026)
--
-- Câu chủ dự án chốt, nguyên văn:
--   "86% học sinh có 6/8 môn >= 6.5 là hoàn toàn khả thi nhưng ở luồng xem của giáo viên lẫn bgh"
--
-- Phép kiểm này dựng đúng câu ấy trên lớp Test thật, rồi hỏi lại máy xem có ra đúng số không.
-- Chỗ đắt giá nhất là ranh 85,7 / 86: lớp bảy em mà sáu em đạt thì THUA — nếu ai đó lỡ viết
-- `>` thành `>=` sai chiều, hoặc làm tròn ẩu, thì con số 85,7 sẽ nhảy thành đạt và không ai
-- nhìn ra bằng mắt.
--
-- ── CHẠY THẲNG TRÊN PRODUCTION MÀ KHÔNG ĐỂ LẠI GÌ ──────────────────────────────────────────
-- Toàn bộ nằm trong một giao dịch kết thúc bằng ROLLBACK. Dữ liệu dựng ra đặt ở niên khoá
-- 2030–2031 để không đè lên bất kỳ mục tiêu thật nào — mọi hàm ở đây đều lọc theo khoảng ngày,
-- nên một cửa sổ thời gian trống là cách cô lập sạch nhất.
--
--   npm run sql -- scripts/test-muc-tieu-cuon.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create temporary table boi_canh as
select c.id as lop, c.campus_id as co_so,
       date '2030-08-01' as tu, date '2031-05-31' as den
from classes c
where c.name = 'Test' and c.is_active
limit 1;

-- Đánh số các em để chỉ định ai đạt ai không.
create temporary table em as
select row_number() over (order by e.student_id) as i, e.student_id as sid
from enrollments e, boi_canh b
where e.class_id = b.lop and e.is_active;

insert into ket_qua
select 'Lớp Test có đúng 7 em đang học', '7 em', count(*) || ' em', count(*) = 7 from em;

-- ── TẦNG MÔN: mỗi em 8 mục tiêu năm, em thứ 7 cố tình chỉ đạt 5 ────────────────────────────
-- Dùng achieved_at thay vì rải lượt tick: wig_dat() tin dấu tay trước mọi phép đếm, nên đây là
-- cách đặt kết quả một cách xác định, không phụ thuộc vào giờ giấc hay dữ liệu tick có sẵn.
insert into wigs (class_id, student_id, scope, area, period, title, target_value, unit,
                  start_date, end_date, kind, set_by, measure_by, achieved_at, achieved_by)
select b.lop, em.sid, 'student', 'knowledge', 'year',
       'KIỂM CUỘN · môn ' || m.n, 6.5, 'điểm', b.tu, b.den,
       'academic', 'student', 'manual',
       case when m.n <= (case when em.i <= 6 then 6 else 5 end) then now() else null end,
       case when m.n <= (case when em.i <= 6 then 6 else 5 end) then em.sid else null end
from boi_canh b, em, generate_series(1, 8) m(n);

insert into ket_qua
select 'Sáu em đạt đủ 6/8 môn, em thứ bảy thì không',
       '6 em đạt',
       count(*) filter (where em_dat_du(em.sid, b.lop, 6, b.tu, b.den)) || ' em đạt',
       count(*) filter (where em_dat_du(em.sid, b.lop, 6, b.tu, b.den)) = 6
from em, boi_canh b;

-- ── TẦNG LỚP: "86% học sinh có 6/8 môn ≥ 6.5" ──────────────────────────────────────────────
create temporary table wig_lop as
with them as (
  insert into wigs (class_id, scope, area, period, title, target_value, unit,
                    start_date, end_date, measure_by, ty_le_can, so_dich_can, tong_dich)
  select b.lop, 'class', 'knowledge', 'year',
         'KIỂM CUỘN · 86% học sinh có 6/8 môn từ 6.5 trở lên', 86, '%',
         b.tu, b.den, 'cuon', 86, 6, 8
  from boi_canh b
  returning id
)
select id from them;

insert into ket_qua
select '6/7 em ra đúng 85,7%', '85.7', coalesce(ty_le_cuon(id)::text, '—'),
       ty_le_cuon(id) = 85.7
from wig_lop;

insert into ket_qua
select '85,7% CHƯA tới 86% nên lớp chưa đạt', 'chưa đạt',
       case when wig_dat(id) then 'đã đạt' else 'chưa đạt' end,
       wig_dat(id) = false
from wig_lop;

-- Cho em thứ bảy đạt nốt môn thứ 6 → 7/7 → 100%.
update wigs set achieved_at = now(), achieved_by = student_id
where id = (
  select w.id from wigs w, em, boi_canh b
  where w.student_id = em.sid and em.i = 7 and w.class_id = b.lop
    and w.scope = 'student' and w.start_date = b.tu and w.achieved_at is null
  order by w.title limit 1
);

insert into ket_qua
select 'Em cuối đạt thêm một môn thì lớp lên 100% và thắng',
       '100 · đã đạt',
       coalesce(ty_le_cuon(id)::text, '—') || ' · ' || case when wig_dat(id) then 'đã đạt' else 'chưa đạt' end,
       ty_le_cuon(id) = 100 and wig_dat(id)
from wig_lop;

-- ── TẦNG TRƯỜNG: đếm lớp, không đếm em ─────────────────────────────────────────────────────
insert into ket_qua
select 'Lớp Test được tính là đạt ở tầng trường', 'đạt',
       case when lop_dat_du(b.lop, 1, b.tu, b.den) then 'đạt' else 'chưa' end,
       lop_dat_du(b.lop, 1, b.tu, b.den)
from boi_canh b;

insert into ket_qua
select 'Đòi 99 mục tiêu lớp thì Test không đạt', 'chưa',
       case when lop_dat_du(b.lop, 99, b.tu, b.den) then 'đạt' else 'chưa' end,
       lop_dat_du(b.lop, 99, b.tu, b.den) = false
from boi_canh b;

create temporary table wig_truong as
with them as (
  insert into wigs (campus_id, scope, area, period, title, target_value, unit,
                    start_date, end_date, measure_by, ty_le_can, so_dich_can)
  select b.co_so, 'school', 'knowledge', 'year',
         'KIỂM CUỘN · 80% lớp đạt mục tiêu năm', 80, '%',
         b.tu, b.den, 'cuon', 80, 1
  from boi_canh b
  returning id
)
select id from them;

-- Tự đếm lại bằng SQL thường rồi so với số hàm trả về. Chỉ lớp Test có mục tiêu ở niên khoá
-- 2030–2031 nên đúng 1 lớp đạt; nhưng vẫn tính mẫu số từ dữ liệu thật thay vì viết cứng.
insert into ket_qua
select 'Số của mục tiêu trường = % lớp đạt, tự đếm lại thì khớp',
       mong::text, coalesce(that::text, '—'), that = mong
from (
  select ty_le_cuon(w.id) as that,
         round(100.0 * count(*) filter (where lop_dat_du(c.id, 1, b.tu, b.den)) / count(*), 1) as mong
  from wig_truong w, boi_canh b
  join classes c on c.campus_id = b.co_so and c.is_active
  group by w.id
) x;

-- ── HAI CÁI CHẶN ───────────────────────────────────────────────────────────────────────────
-- Một là chặn vòng lặp vô tận: mục tiêu cuộn ở tầng học sinh sẽ đi tìm "đơn vị con" của một em,
-- mà em thì không có tầng dưới.
do $$
declare v_ok boolean := false;
begin
  begin
    insert into wigs (class_id, student_id, scope, area, period, title, target_value, unit,
                      start_date, end_date, kind, set_by, measure_by, ty_le_can, so_dich_can)
    select b.lop, (select sid from em limit 1), 'student', 'knowledge', 'year',
           'KIỂM CUỘN · không được phép', 86, '%', b.tu, b.den,
           'academic', 'student', 'cuon', 86, 6
    from boi_canh b;
  exception when check_violation then
    v_ok := true;
  end;
  insert into ket_qua values ('Không đặt được mục tiêu cuộn cho một em',
    'bị chặn', case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- Hai là lớp rỗng phải ra 0, không được ra null: null làm mọi phép so bên trên thành "không sai",
-- và một lớp chưa có em nào sẽ đọc thành đang-đạt.
create temporary table lop_rong as
with them as (
  insert into classes (campus_id, name, school_year, is_active)
  select b.co_so, 'KIỂM CUỘN · lớp rỗng', '2030-2031', true from boi_canh b
  returning id
)
select id from them;

create temporary table wig_lop_rong as
with them as (
  insert into wigs (class_id, scope, area, period, title, target_value, unit,
                    start_date, end_date, measure_by, ty_le_can, so_dich_can)
  select r.id, 'class', 'knowledge', 'year', 'KIỂM CUỘN · lớp rỗng', 86, '%',
         b.tu, b.den, 'cuon', 86, 6
  from lop_rong r, boi_canh b
  returning id
)
select id from them;

insert into ket_qua
select 'Lớp chưa có em nào ra 0, không phải null', '0',
       coalesce(ty_le_cuon(w.id)::text, 'NULL'), ty_le_cuon(w.id) = 0
from wig_lop_rong w;

-- ── PHÂN SỐ VÀ PHẦN TRĂM PHẢI LÀ MỘT ──────────────────────────────────────────────────────
-- Màn hình đọc phân số ("7/7 bạn đạt") từ cuon_so_lieu, còn thắng-thua thì đi qua ty_le_cuon.
-- Hai đường mà lệch nhau thì cô nhìn thấy "7/7 bạn đạt" bên cạnh một cái nhãn "chưa đạt".
insert into ket_qua
select 'Lấy theo lô ra đúng như hỏi lẻ từng cái',
       '7/7 · 100', s.dat || '/' || s.tong || ' · ' || s.ty_le,
       s.tong = 7 and s.dat = 7 and s.ty_le = ty_le_cuon(s.wig_id)
from wig_lop w, cuon_so_lieu(array[w.id]) s;

insert into ket_qua
select 'Lô bỏ qua id không phải mục tiêu cuộn', '1 dòng',
       count(*) || ' dòng', count(*) = 1
from wig_lop l, wig_truong t,
     cuon_so_lieu(array[
       l.id, t.id,
       (select w.id from wigs w, boi_canh b
        where w.scope = 'student' and w.class_id = b.lop and w.start_date = b.tu limit 1)
     ]) s
where s.wig_id = l.id;

-- ── ĐƯỜNG CŨ KHÔNG ĐƯỢC ĐỔI SỐ ────────────────────────────────────────────────────────────
-- wig_actual vừa bị bọc thêm một lớp. Mọi vòng tròn phần trăm trong app đều gọi nó, nên phải
-- chắc rằng với mục tiêu thường nó vẫn trả đúng con số của hàm cũ, không lệch một chữ số nào.
insert into ket_qua
select 'Mục tiêu thường vẫn ra đúng con số như trước',
       '0 lệch', count(*) filter (where lech) || ' lệch',
       count(*) filter (where lech) = 0
from (
  select private.wig_actual(w.id) is distinct from private.wig_actual_so(w.id) as lech
  from wigs w
  where w.measure_by <> 'cuon' and w.period = 'year'
  limit 300
) x;

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

rollback;
