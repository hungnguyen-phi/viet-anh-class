-- AI ĐƯỢC NHÌN MỤC TIÊU TRƯỜNG — HỎI BẰNG CHÍNH TÀI KHOẢN THẬT (14/08/2026)
--
-- Bản nháp đầu của 0116 viết chính sách đọc theo lối:
--
--     using ( scope <> 'school' OR <người có quyền> )
--
-- Đọc thì thấy hiền: "mục tiêu không phải của trường thì kệ nó, chính sách này không nói gì".
-- Nhưng Postgres nối các chính sách permissive bằng HOẶC, nên vế trái đó không phải là "kệ" —
-- nó là MỘT CÁI CỬA MỞ cho mọi mục tiêu của mọi học sinh, với bất kỳ ai đăng nhập được. Dữ liệu
-- ở đây là dữ liệu trẻ con, và cái sai ấy đọc bằng mắt thì không thấy.
--
-- Nên phép kiểm này không đọc chính sách. Nó ĐÓNG VAI từng người thật rồi hỏi thẳng cái bảng.
--
--   npm run sql -- scripts/test-quyen-muc-tieu-truong.sql

begin;

-- Bảng thường chứ không phải bảng tạm: bảng tạm nằm trong schema pg_temp mà vai `authenticated`
-- không có quyền USAGE, nên vừa đổi vai là mọi thao tác đổ lỗi phân quyền của CHÍNH phép kiểm,
-- che mất thứ đang cần đo. Giao dịch kết thúc bằng ROLLBACK nên chúng vẫn không để lại gì.
create table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select '61453ebe-dd27-434c-8787-c78dd21da742'::uuid as co_so,
       'ddefb0a7-eeaa-40e6-9e16-0fd4c65fc8bf'::uuid as lop_test,
       '823acffd-118b-48cf-b099-1914e2d9bb2b'::uuid as hieu_truong,
       '005d401f-d100-4be4-864f-9c6c8fc14fca'::uuid as giao_vien,
       '5b8a687d-e9bb-4e3b-ab51-0b19d462e4fb'::uuid as hoc_sinh;

-- Một mục tiêu trường thật để hỏi, và một mục tiêu của học sinh ở lớp khác để canh cửa sau.
create table wig_truong as
with them as (
  insert into wigs (campus_id, scope, area, period, title, target_value, unit,
                    start_date, end_date, measure_by, ty_le_can, so_dich_can)
  select co_so, 'school', 'knowledge', 'year', 'KIỂM QUYỀN · mục tiêu trường', 80, '%',
         date '2030-08-01', date '2031-05-31', 'cuon', 80, 1
  from ai
  returning id
)
select id from them;

-- Mục tiêu riêng của một em ở lớp KHÁC lớp Test — không ai ngoài em, gia đình em và giáo viên
-- của lớp ấy được thấy. Đây là thứ cái cửa sau kia sẽ làm lộ.
create table lop_khac as
select c.id from classes c, ai
where c.campus_id = ai.co_so and c.id <> ai.lop_test and c.is_active
limit 1;

create table em_lop_khac as
select e.student_id as sid from enrollments e, lop_khac l
where e.class_id = l.id and e.is_active limit 1;

create table wig_rieng as
with them as (
  insert into wigs (class_id, student_id, scope, area, period, title, target_value, unit,
                    start_date, end_date, kind, set_by, measure_by)
  select l.id, e.sid, 'student', 'knowledge', 'year', 'KIỂM QUYỀN · mục tiêu riêng của em', 6.5,
         'điểm', date '2030-08-01', date '2031-05-31', 'academic', 'student', 'manual'
  from lop_khac l, em_lop_khac e
  returning id
)
select id from them;

-- Vai authenticated phải ghi được vào bảng kết quả và đọc được mấy bảng dựng cảnh.
grant all on ket_qua, ai, wig_truong, wig_rieng, lop_khac, em_lop_khac to authenticated;

-- ── ĐÓNG VAI HIỆU TRƯỞNG ───────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"823acffd-118b-48cf-b099-1914e2d9bb2b","role":"authenticated"}';

insert into ket_qua
select 'Hiệu trưởng thấy mục tiêu trường của cơ sở mình', 'thấy',
       case when count(*) = 1 then 'thấy' else 'KHÔNG thấy' end, count(*) = 1
from wigs w, wig_truong t where w.id = t.id;

-- Sửa được thì mới quản được. Chính sách quản là FOR ALL nên update là phép thử đủ.
do $$
declare v_so integer;
begin
  update wigs set ty_le_can = 81 where id = (select id from wig_truong);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('Hiệu trưởng sửa được mục tiêu trường',
    '1 dòng', v_so || ' dòng', v_so = 1);
end $$;

-- ── ĐÓNG VAI GIÁO VIÊN ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"005d401f-d100-4be4-864f-9c6c8fc14fca","role":"authenticated"}';

insert into ket_qua
select 'Giáo viên ĐỌC được mục tiêu trường', 'thấy',
       case when count(*) = 1 then 'thấy' else 'KHÔNG thấy' end, count(*) = 1
from wigs w, wig_truong t where w.id = t.id;

do $$
declare v_so integer;
begin
  update wigs set ty_le_can = 82 where id = (select id from wig_truong);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('Giáo viên KHÔNG sửa được mục tiêu trường',
    '0 dòng', v_so || ' dòng', v_so = 0);
end $$;

-- ── ĐÓNG VAI HỌC SINH ──────────────────────────────────────────────────────────────────────
-- Chủ dự án chốt mục tiêu cuộn chỉ ở luồng GVCN và BGH: em nhìn thấy "86% lớp" thì chỉ rối,
-- vì phần của em là mấy mục tiêu môn cụ thể chứ không phải con số của cả lớp.
set local request.jwt.claims = '{"sub":"5b8a687d-e9bb-4e3b-ab51-0b19d462e4fb","role":"authenticated"}';

insert into ket_qua
select 'Học sinh KHÔNG thấy mục tiêu trường', 'không thấy',
       case when count(*) = 0 then 'không thấy' else 'THẤY' end, count(*) = 0
from wigs w, wig_truong t where w.id = t.id;

-- CÁI CỬA SAU. Nếu chính sách mới viết "scope <> 'school' OR …" thì đúng dòng này sẽ đọc được.
insert into ket_qua
select 'Học sinh KHÔNG thấy mục tiêu riêng của bạn lớp khác', 'không thấy',
       case when count(*) = 0 then 'không thấy' else 'THẤY — RÒ DỮ LIỆU' end, count(*) = 0
from wigs w, wig_rieng r where w.id = r.id;

-- Và em vẫn phải thấy mục tiêu của chính lớp mình — chặn quá tay cũng là hỏng.
insert into ket_qua
select 'Học sinh vẫn thấy mục tiêu lớp mình', 'thấy ít nhất 1',
       count(*) || ' mục tiêu', count(*) > 0
from wigs w, ai where w.class_id = ai.lop_test and w.scope = 'class';

reset role;

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
