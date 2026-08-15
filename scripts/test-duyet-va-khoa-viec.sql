-- SỬA THÌ DUYỆT LẠI · CAM KẾT QUA CỬA DUYỆT · VIỆC DẪN DẮT KHOÁ NGAY (0129)
--
-- Ba luật này đều là luật CHẶN, nên chúng chỉ có giá trị nếu chặn được cả khi người ta không đi
-- qua giao diện. Vì vậy mọi phép đo dưới đây đều ĐÓNG VAI người thật rồi ghi thẳng vào bảng —
-- đúng thứ một cái tab thứ hai làm được.
--
-- Chỗ đắt nhất: tick "đã đạt" KHÔNG được coi là sửa. Nếu bản vá làm ẩu bằng RLS WITH CHECK kiểu
-- "kết quả phải luôn là sent", thì em xác nhận kết quả cũng đá luôn mục tiêu về chờ duyệt — một
-- cái tick huỷ chính hiệu lực của mục tiêu, và không màn hình nào nói ra điều đó.
--
--   npm run sql -- scripts/test-duyet-va-khoa-viec.sql

begin;

create table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       c.homeroom_teacher_id as gvcn,
       vn_week_start(date '2031-03-03') as tuan,
       date '2030-08-01' as tu, date '2031-05-31' as den
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on ket_qua, ai to authenticated;

-- Mục tiêu năm của em, ĐÃ DUYỆT và tạo từ lâu — đúng trạng thái mà cửa sổ 24 giờ cũ sẽ khoá.
create table wig_em as
with them as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status,
                    created_at)
  select lop, em, 'student', 'knowledge', 'year', '2030-2031', 'KIỂM · mục tiêu của em', 0,
         300, 'bài', tu, den, 'academic', 'student', 'manual', 'approved', now() - interval '30 days'
  from ai returning id
) select id from them;

grant all on wig_em to authenticated;

-- Hai bảng giữ id, dựng SẴN bằng quyền postgres: vai `authenticated` không có quyền tạo bảng
-- trong schema public, mà cả bài kiểm này phải chạy trong vai người thật mới có nghĩa.
create table ck_em (id uuid);
create table viec_em (id uuid);
grant all on ck_em, viec_em to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

-- ── 1. EM SỬA MỤC TIÊU ĐÃ DUYỆT TỪ 30 NGÀY TRƯỚC ──────────────────────────────────────────
do $$
declare v_so integer;
begin
  update wigs set title = 'KIỂM · đổi tên sau 30 ngày' where id = (select id from wig_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('Em vẫn sửa được mục tiêu đã duyệt từ lâu (bỏ cửa sổ 24 giờ)',
    '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into ket_qua values ('Em vẫn sửa được mục tiêu đã duyệt từ lâu (bỏ cửa sổ 24 giờ)',
    '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

insert into ket_qua
select 'Sửa xong thì về CHỜ DUYỆT', 'sent', w.status, w.status = 'sent'
from wigs w where w.id = (select id from wig_em);

-- ── 2. TICK "ĐÃ ĐẠT" KHÔNG PHẢI LÀ SỬA ────────────────────────────────────────────────────
--
-- DỰNG CẢNH BẰNG QUYỀN HỆ THỐNG THÌ PHẢI XOÁ CẢ JWT, không chỉ `reset role`.
-- auth.uid() đọc `request.jwt.claims` chứ không đọc vai Postgres — bỏ quên nó thì trigger vẫn
-- tưởng em đang gõ và lặng lẽ giữ nguyên status, khiến chính cảnh dựng ra đã sai còn phép đo thì
-- tố cáo app. Đã dính đúng bẫy này một lần ở đây.
reset role;
select set_config('request.jwt.claims', '', true);
update wigs set status = 'approved' where id = (select id from wig_em);
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
begin
  update wigs set achieved_at = now(), achieved_by = (select em from ai)
  where id = (select id from wig_em);
exception when others then null;
end $$;

insert into ket_qua
select 'Em đánh dấu ĐÃ ĐẠT thì mục tiêu VẪN đang duyệt', 'approved', w.status, w.status = 'approved'
from wigs w where w.id = (select id from wig_em);

-- Và em cũng KHÔNG tự gật cho mục tiêu của mình. Cùng một lỗ với cam kết bên dưới: gửi thẳng
-- một câu update status='approved' mà không đổi nội dung gì.
reset role;
select set_config('request.jwt.claims', '', true);
update wigs set status = 'sent' where id = (select id from wig_em);
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
begin
  update wigs set status = 'approved' where id = (select id from wig_em);
exception when others then null;
end $$;

insert into ket_qua
select 'Em KHÔNG tự duyệt mục tiêu của mình được', 'sent', w.status, w.status = 'sent'
from wigs w where w.id = (select id from wig_em);

-- ── 3. CAM KẾT EM ĐẶT PHẢI CHỜ DUYỆT ──────────────────────────────────────────────────────
with them as (
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select w.id, a.lop, a.em, a.tuan, 'KIỂM · cam kết của em', 'knowledge'
  from wig_em w, ai a returning id
)
insert into ck_em select id from them;

insert into ket_qua
select 'Em đặt cam kết → chờ duyệt, và máy ghi nhận là em tự đặt', 'sent · student',
       c.status || ' · ' || coalesce(c.set_by, '—'),
       c.status = 'sent' and c.set_by = 'student'
from commitments c where c.id = (select id from ck_em);

-- Em KHÔNG tự duyệt được cho mình.
do $$
begin
  update commitments set status = 'approved' where id = (select id from ck_em);
exception when others then null;
end $$;

insert into ket_qua
select 'Em KHÔNG tự duyệt cam kết của mình được', 'sent', c.status, c.status = 'sent'
from commitments c where c.id = (select id from ck_em);

-- ── 4. VIỆC DẪN DẮT: THÊM ĐƯỢC, SỬA/XOÁ THÌ KHÔNG ────────────────────────────────────────
with them as (
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  select id, 'KIỂM · việc của em', 3, 'bài', '{1,2,3,4,5}', 1 from ck_em
  returning id
)
insert into viec_em select id from them;

insert into ket_qua
select 'Em tự thêm việc dẫn dắt được (không cần duyệt)', '1 việc', count(*) || ' việc', count(*) = 1
from viec_em;

do $$
declare v_so integer;
begin
  update lead_measures set title = 'KIỂM · đổi tên việc' where id = (select id from viec_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('Em KHÔNG sửa được việc dẫn dắt', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into ket_qua values ('Em KHÔNG sửa được việc dẫn dắt', '0 dòng', 'bị chặn', true);
end $$;

do $$
declare v_so integer;
begin
  delete from lead_measures where id = (select id from viec_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('Em KHÔNG xoá được việc dẫn dắt', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into ket_qua values ('Em KHÔNG xoá được việc dẫn dắt', '0 dòng', 'bị chặn', true);
end $$;

-- ── 5. GVCN CŨNG KHÔNG SỬA/XOÁ ĐƯỢC VIỆC, NHƯNG DUYỆT ĐƯỢC CAM KẾT ───────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so integer;
begin
  update lead_measures set title = 'KIỂM · cô đổi tên việc' where id = (select id from viec_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('GVCN cũng KHÔNG sửa được việc dẫn dắt', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into ket_qua values ('GVCN cũng KHÔNG sửa được việc dẫn dắt', '0 dòng', 'bị chặn', true);
end $$;

do $$
declare v_so integer;
begin
  update commitments set status = 'approved' where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('GVCN duyệt được cam kết của em', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into ket_qua values ('GVCN duyệt được cam kết của em', '1 dòng', 'BỊ CHẶN OAN', false);
end $$;

insert into ket_qua
select 'Cô duyệt xong thì cam kết ở trạng thái đã duyệt', 'approved', c.status, c.status = 'approved'
from commitments c where c.id = (select id from ck_em);

-- Và GVCN VẪN xoá được cả cam kết — đó là đường thoát khi gõ nhầm, thay cho việc sửa từng việc.
do $$
declare v_so integer;
begin
  delete from commitments where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into ket_qua values ('GVCN xoá được cả cam kết (đường thoát khi gõ nhầm)',
    '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into ket_qua values ('GVCN xoá được cả cam kết (đường thoát khi gõ nhầm)',
    '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

reset role;

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
