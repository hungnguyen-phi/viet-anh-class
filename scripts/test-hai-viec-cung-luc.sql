-- MỖI LÚC CHỈ THEO HAI VIỆC DẪN DẮT (0137)
--
--   npm run sql -- scripts/test-hai-viec-cung-luc.sql
--
-- Chủ dự án 16/08/2026: "leadmeasure 1 lần chỉ 2 cái cùng lúc thôi", và nhắc lại cho màn của cô.
--
-- Chỗ dễ làm hỏng nhất KHÔNG phải cái trần, mà là ĐẾM NHẦM PHẠM VI. Đếm theo cam kết thì lớp có
-- hai cam kết × hai việc = bốn việc trên màn mọi em — đúng cảnh vừa bị chỉ ra. Đếm gộp cả việc
-- của lớp lẫn việc riêng thì em mất chỗ đặt việc của mình chỉ vì lớp đã dùng hết. Nên bài này
-- canh cả ba: trần đúng, hai bộ đếm tách nhau, và tuần khác không bị vạ lây.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop, c.homeroom_teacher_id as gvcn,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       (select w.id from wigs w where w.class_id = c.id and w.scope='class'
          and w.period='year' and w.measure_by <> 'cuon' limit 1) as wig_lop,
       vn_week_start(current_date) + 119 as tuan
from classes c where c.name = 'Test' and c.is_active limit 1;

create table ck_lop as
with x as (
  insert into commitments (wig_id, class_id, week_start, title, area)
  select wig_lop, lop, tuan, 'KIỂM · cam kết lớp', 'knowledge' from ai returning id
) select id from x;

create table wig_em as
with w as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2033-2034', 'KIỂM · mục tiêu em', 0, 100, 'bài',
         date '2033-08-01', date '2034-05-31', 'academic', 'student', 'manual', 'approved'
  from ai returning id
) select id from w;

create table ck_em as
with x as (
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from wig_em), lop, em, tuan, 'KIỂM · cam kết em', 'knowledge' from ai returning id
) select id from x;

-- Cam kết THỨ HAI của lớp — để chứng minh trần đếm theo LỚP, không theo từng cam kết.
create table ck_lop2 as
with x as (
  insert into commitments (wig_id, class_id, week_start, title, area)
  select wig_lop, lop, tuan, 'KIỂM · cam kết lớp hai', 'knowledge' from ai returning id
) select id from x;

create or replace function them_viec(p_ck uuid, p_ten text) returns text
language plpgsql as $$
begin
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (p_ck, p_ten, 1, 'lần', '{1}', 1);
  return 'được';
exception when others then return 'bị chặn';
end $$;

-- ── LỚP: hai việc thì được, việc thứ ba thì chặn — KỂ CẢ khi treo sang cam kết khác ──────────
insert into kq select 'Việc thứ nhất của lớp', 'được', them_viec((select id from ck_lop), 'KIỂM · lớp 1'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Việc thứ nhất của lớp';

insert into kq select 'Việc thứ hai của lớp', 'được', them_viec((select id from ck_lop), 'KIỂM · lớp 2'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Việc thứ hai của lớp';

insert into kq select 'Việc thứ BA của lớp bị chặn', 'bị chặn', them_viec((select id from ck_lop), 'KIỂM · lớp 3'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Việc thứ BA của lớp bị chặn';

insert into kq select 'Treo sang CAM KẾT KHÁC của lớp cũng chặn (đếm theo lớp)', 'bị chặn',
       them_viec((select id from ck_lop2), 'KIỂM · lớp 4'), true;
update kq set dat = (thuc_te = mong_doi) where buoc like 'Treo sang CAM KẾT KHÁC%';

-- ── EM: bộ đếm RIÊNG, không bị lớp ăn mất chỗ ───────────────────────────────────────────────
insert into kq select 'Em vẫn thêm được việc riêng dù lớp đã đủ 2', 'được',
       them_viec((select id from ck_em), 'KIỂM · em 1'), true;
update kq set dat = (thuc_te = mong_doi) where buoc like 'Em vẫn thêm được%';

insert into kq select 'Việc riêng thứ hai của em', 'được', them_viec((select id from ck_em), 'KIỂM · em 2'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Việc riêng thứ hai của em';

insert into kq select 'Việc riêng thứ BA của em bị chặn', 'bị chặn', them_viec((select id from ck_em), 'KIỂM · em 3'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Việc riêng thứ BA của em bị chặn';

-- ── TUẦN KHÁC KHÔNG BỊ VẠ LÂY ───────────────────────────────────────────────────────────────
create table ck_tuan_sau as
with x as (
  insert into commitments (wig_id, class_id, week_start, title, area)
  select wig_lop, lop, tuan + 7, 'KIỂM · cam kết tuần sau', 'knowledge' from ai returning id
) select id from x;

insert into kq select 'Tuần sau vẫn đặt được việc mới', 'được',
       them_viec((select id from ck_tuan_sau), 'KIỂM · tuần sau 1'), true;
update kq set dat = (thuc_te = mong_doi) where buoc = 'Tuần sau vẫn đặt được việc mới';

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
