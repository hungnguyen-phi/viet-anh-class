-- BUDDY LÀ NHÓM 2 HOẶC 3 (0153, chốt 19/08/2026)
--
-- Chủ dự án: "buddy bây giờ là bạn học, sẽ có nhóm 2, hoặc 3. ví dụ lớp lẻ thì tất cả đều 2
-- thì 1 nhóm 3". Dưới CSDL nhóm 3 là 3 cặp buddy_pairs đôi một; cửa tạo duy nhất là RPC
-- tao_buddy_nhom — nguyên nhóm một giao dịch. Phép kiểm dựng cả đường vui lẫn bốn cái CHẶN:
-- luật chỉ nằm trong giao diện thì không phải luật.
--
-- Chạy thẳng trên production, kết thúc bằng ROLLBACK nên không để lại gì.
--
--   npm run sql -- scripts/test-buddy-nhom.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

-- 6 học sinh đang học của lớp Test, thứ tự ổn định.
create temporary table boi_canh as
select c.id as lop,
       (array(select e.student_id from enrollments e join profiles p on p.id = e.student_id
              where e.class_id = c.id and e.is_active and p.role = 'student'
              order by e.student_id))[1:6] as em
from classes c where c.name = 'Test' and c.is_active limit 1;

-- ── 1. NHÓM 3 → đúng 3 cặp đôi một, chuẩn hoá đầu nhỏ trước ────────────────────────────────
select tao_buddy_nhom((select lop from boi_canh),
                      (select array[em[1], em[2], em[3]] from boi_canh));
insert into ket_qua
select 'nhóm 3 sinh 3 cặp chuẩn hoá', '3 cặp, tất cả student_id<buddy_id', n || ' cặp, chuẩn=' || ch,
       n = 3 and ch
from (select count(*) as n, bool_and(student_id < buddy_id) as ch
      from buddy_pairs where is_active and class_id = (select lop from boi_canh)) x;

-- ── 2. CHẶN: em đã có nhóm thì không vào nhóm mới ──────────────────────────────────────────
do $$
begin
  perform tao_buddy_nhom((select lop from boi_canh),
                         (select array[em[1], em[4]] from boi_canh));
  insert into ket_qua values ('chặn em đã có nhóm', 'văng 23514', 'đi lọt', false);
exception when check_violation then
  insert into ket_qua values ('chặn em đã có nhóm', 'văng 23514', 'văng đúng', true);
end $$;

-- ── 3. CHẶN: nhóm 4 và nhóm trùng em ───────────────────────────────────────────────────────
do $$
begin
  perform tao_buddy_nhom((select lop from boi_canh),
                         (select array[em[4], em[5], em[6], em[1]] from boi_canh));
  insert into ket_qua values ('chặn nhóm 4', 'văng 23514', 'đi lọt', false);
exception when check_violation then
  insert into ket_qua values ('chặn nhóm 4', 'văng 23514', 'văng đúng', true);
end $$;
do $$
begin
  perform tao_buddy_nhom((select lop from boi_canh),
                         (select array[em[4], em[4]] from boi_canh));
  insert into ket_qua values ('chặn nhóm trùng em', 'văng 23514', 'đi lọt', false);
exception when check_violation then
  insert into ket_qua values ('chặn nhóm trùng em', 'văng 23514', 'văng đúng', true);
end $$;

-- ── 4. CHẶN: lớp lạ (trigger buddy_cung_lop 0151 vẫn gác sau lưng hàm mới) ─────────────────
do $$
begin
  perform tao_buddy_nhom('00000000-0000-0000-0000-000000000001',
                         (select array[em[4], em[5]] from boi_canh));
  insert into ket_qua values ('chặn ghép khác lớp', 'văng lỗi', 'đi lọt', false);
exception when others then
  insert into ket_qua values ('chặn ghép khác lớp', 'văng lỗi', 'văng đúng', true);
end $$;

-- ── 5. NHÓM 2 với hai em còn trống vẫn vào bình thường; nửa nhóm không bao giờ tồn tại ─────
select tao_buddy_nhom((select lop from boi_canh),
                      (select array[em[4], em[5]] from boi_canh));
insert into ket_qua
select 'nhóm 2 tạo được, tổng cặp đúng', '4 cặp active (3+1)', n || ' cặp', n = 4
from (select count(*) as n from buddy_pairs
      where is_active and class_id = (select lop from boi_canh)) x;
-- Mỗi em trong nhóm 3 phải có ĐÚNG 2 buddy, em nhóm 2 có đúng 1 — "chuỗi" nửa nhóm = hỏng.
insert into ket_qua
select 'không có chuỗi nửa nhóm', 'số buddy mỗi em ∈ {1,2} khớp cỡ nhóm', string_agg(sobuddy::text, ',' order by sobuddy),
       array_agg(sobuddy order by sobuddy) = array[1,1,2,2,2]::bigint[]
from (
  select nguoi, count(*) as sobuddy
  from (select student_id as nguoi from buddy_pairs
        where is_active and class_id = (select lop from boi_canh)
        union all select buddy_id from buddy_pairs
        where is_active and class_id = (select lop from boi_canh)) hai_chieu
  group by nguoi
) dem;

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
