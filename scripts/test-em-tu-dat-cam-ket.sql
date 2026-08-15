-- EM TỰ ĐẶT CAM KẾT TUẦN — MẮT XÍCH TỪNG ĐỨT (16/08/2026)
--
--   npm run sql -- scripts/test-em-tu-dat-cam-ket.sql
--
-- Cho tới 16/08, đường DUY NHẤT sinh ra cam kết tuần của một em là ô mà GIÁO VIÊN gõ trong phòng
-- họp. Chủ dự án bảo gỡ ô ấy ("phải là em đặt chứ"); gỡ xong thì không còn đường nào cả — em viết
-- cam kết thành một câu văn trong biên bản, còn bảng của cô đọc bảng `commitments`. Hai bên nói
-- về hai thứ khác nhau, và suốt tuần không có gì để tick.
--
-- Bài này canh CẢ VÒNG, không canh một hàm:
--   A. Em tự đặt được, và đặt xong là CHỜ DUYỆT (em không tự gật cho mình).
--   B. Trần 2 cam kết mỗi tuần vẫn giữ.
--   C. Cam kết của em phải treo dưới mục tiêu năm CỦA CHÍNH EM.
--   D. CÔ THẤY NGAY thứ em vừa đặt — cùng một con số, không phải hai nguồn kể hai chuyện.
--   E. Cô duyệt được; và sau khi duyệt, em treo được việc để tick lên chính cam kết ấy.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop,
       c.homeroom_teacher_id as gvcn,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       vn_week_start(current_date) + 91 as tuan_xa
from classes c where c.name = 'Test' and c.is_active limit 1;

-- Mục tiêu năm của chính em — cam kết phải treo dưới nó.
create table wig_em as
with w as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2032-2033', 'KIỂM · mục tiêu của em', 0,
         300, 'bài', date '2032-08-01', date '2033-05-31', 'academic', 'student', 'manual', 'approved'
  from ai returning id
) select id from w;

-- Mục tiêu năm CỦA LỚP — để thử treo nhầm chỗ.
create table wig_lop as
select id from wigs
where class_id = (select lop from ai) and scope = 'class' and period = 'year'
  and measure_by <> 'cuon' limit 1;

create table ck_em (id uuid);
grant all on kq, ai, wig_em, wig_lop, ck_em to authenticated;

-- ── A. EM TỰ ĐẶT ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_id uuid;
begin
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from wig_em), a.lop, a.em, a.tuan_xa, 'KIỂM · tuần này con đọc 5 bài', 'knowledge'
  from ai a returning id into v_id;
  insert into ck_em values (v_id);
  insert into kq values ('Em tự đặt được cam kết tuần', '1 dòng', '1 dòng', true);
exception when others then
  insert into kq values ('Em tự đặt được cam kết tuần', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

insert into kq
select 'Đặt xong là CHỜ DUYỆT, và máy ghi nhận em tự đặt', 'sent · student',
       c.status || ' · ' || coalesce(c.set_by, '—'),
       c.status = 'sent' and c.set_by = 'student'
from commitments c where c.id = (select id from ck_em);

-- ── B. TRẦN HAI CAM KẾT ─────────────────────────────────────────────────────────────────────
do $$
begin
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from wig_em), a.lop, a.em, a.tuan_xa, 'KIỂM · cam kết hai', 'knowledge' from ai a;
  insert into kq values ('Cam kết thứ hai vẫn đặt được', 'được', 'được', true);
exception when others then
  insert into kq values ('Cam kết thứ hai vẫn đặt được', 'được', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

do $$
begin
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from wig_em), a.lop, a.em, a.tuan_xa, 'KIỂM · cam kết ba', 'knowledge' from ai a;
  insert into kq values ('Cam kết thứ BA bị chặn (tối đa 2)', 'bị chặn', 'LỌT', false);
exception when others then
  insert into kq values ('Cam kết thứ BA bị chặn (tối đa 2)', 'bị chặn', 'bị chặn', true);
end $$;

-- ── C. TREO NHẦM CHỖ THÌ CHẶN ───────────────────────────────────────────────────────────────
-- Cam kết của em mà treo dưới mục tiêu của LỚP là con số của em đi vào bộ đếm của cả lớp.
do $$
begin
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from wig_lop), a.lop, a.em, a.tuan_xa + 7, 'KIỂM · treo nhầm', 'knowledge' from ai a;
  insert into kq values ('Treo cam kết của em dưới mục tiêu của LỚP → chặn', 'bị chặn', 'LỌT', false);
exception when others then
  insert into kq values ('Treo cam kết của em dưới mục tiêu của LỚP → chặn', 'bị chặn', 'bị chặn', true);
end $$;

-- ── D. CÔ THẤY ĐÚNG THỨ EM VỪA ĐẶT ──────────────────────────────────────────────────────────
-- Đây là câu hỏi thật của cả bài: hai màn hình có kể cùng một chuyện không.
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);

insert into kq
select 'Cô ĐỌC được cam kết em vừa đặt', 'thấy', case when count(*) = 1 then 'thấy' else 'KHÔNG THẤY' end,
       count(*) = 1
from commitments c where c.id = (select id from ck_em);

insert into kq
select 'Bảng PDR của cô đếm đúng cam kết CHỜ DUYỆT', '≥1',
       coalesce(max(p.cam_ket_cho_duyet)::text, '0'),
       coalesce(max(p.cam_ket_cho_duyet), 0) >= 1
from pdr_bang((select lop from ai), (select tuan_xa from ai)) p;

-- ── E. CÔ DUYỆT, RỒI EM TREO VIỆC ĐỂ TICK ───────────────────────────────────────────────────
do $$
declare v_so int;
begin
  update commitments set status = 'approved' where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô duyệt được cam kết của em', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Cô duyệt được cam kết của em', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_id uuid;
begin
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  select id, 'KIỂM · đọc 1 bài mỗi tối', 5, 'bài', '{1,2,3,4,5}', 1 from ck_em
  returning id into v_id;
  insert into kq values ('Em treo được việc để tick lên cam kết ấy', 'được', 'được', v_id is not null);
exception when others then
  insert into kq values ('Em treo được việc để tick lên cam kết ấy', 'được', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

-- Và việc ấy phải tự nối về ĐÚNG mục tiêu năm của em — cột wig_id do trigger suy ra, không ai gõ.
insert into kq
select 'Việc tự nối về đúng mục tiêu năm của em', 'khớp',
       case when lm.wig_id = (select id from wig_em) then 'khớp' else 'LỆCH' end,
       lm.wig_id = (select id from wig_em)
from lead_measures lm where lm.commitment_id = (select id from ck_em);

reset role;
select set_config('request.jwt.claims', '', true);

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
