-- CÔ KHÔNG SỬA MỤC TIÊU VÀ CAM KẾT CỦA EM (0133)
--
--   npm run sql -- scripts/test-co-khong-sua-cua-em.sql
--
-- Chủ dự án 15/08/2026: "giáo viên bây giờ đâu được sửa wig/commitment học sinh nữa".
--
-- Luật này chỉ có nghĩa nếu chặn được cả khi người ta KHÔNG đi qua giao diện — gỡ cái nút bút chì
-- đi mà cửa sau còn mở thì chỉ là giấu, không phải khoá. Nên mọi phép dưới đây ĐÓNG VAI người thật
-- rồi ghi thẳng vào bảng.
--
-- Ba nhóm, và nhóm thứ ba mới là nhóm dễ làm hỏng nhất:
--   A. Cô KHÔNG sửa nội dung, KHÔNG xoá — mục tiêu lẫn cam kết.
--   B. Cô VẪN duyệt, VẪN đánh dấu đã đạt, VẪN chấm V/X. Khoá quá tay là buổi họp không chấm được.
--   C. Em vẫn sửa được của mình, BGH vẫn sửa được, và mục tiêu/cam kết CỦA LỚP không hề bị đụng.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop,
       c.homeroom_teacher_id as gvcn,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       (select p.id from profiles p where p.role = 'principal' limit 1) as bgh,
       (select w.id from wigs w
        where w.class_id = c.id and w.scope = 'class' and w.period = 'year'
          and w.measure_by <> 'cuon' limit 1) as wig_lop,
       vn_week_start(current_date) + 84 as tuan_xa
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on kq, ai to authenticated;

-- Mục tiêu năm của em, và một cam kết tuần của em ở một tuần xa (không đụng dữ liệu đang chạy).
create table cua_em as
with w as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2030-2031', 'KIỂM · mục tiêu của em', 0,
         300, 'bài', date '2030-08-01', date '2031-05-31', 'academic', 'student', 'manual', 'approved'
  from ai returning id
)
select id from w;

create table ck_em as
with c as (
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select (select id from cua_em), a.lop, a.em, a.tuan_xa, 'KIỂM · cam kết của em', 'knowledge'
  from ai a returning id
)
select id from c;

grant all on cua_em, ck_em to authenticated;

-- ── A. CÔ KHÔNG SỬA, KHÔNG XOÁ ──────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  update wigs set title = 'CÔ GÕ ĐÈ' where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô KHÔNG sửa được câu mục tiêu của em', 'bị chặn', v_so || ' dòng lọt', false);
exception when others then
  insert into kq values ('Cô KHÔNG sửa được câu mục tiêu của em', 'bị chặn', 'bị chặn', true);
end $$;

do $$
declare v_so int;
begin
  update wigs set target_value = 999 where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('… kể cả chỉ đổi mỗi con số đích', 'bị chặn', v_so || ' dòng lọt', false);
exception when others then
  insert into kq values ('… kể cả chỉ đổi mỗi con số đích', 'bị chặn', 'bị chặn', true);
end $$;

do $$
declare v_so int;
begin
  update commitments set title = 'CÔ GÕ ĐÈ LỜI HỨA' where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô KHÔNG sửa được lời cam kết của em', 'bị chặn', v_so || ' dòng lọt', false);
exception when others then
  insert into kq values ('Cô KHÔNG sửa được lời cam kết của em', 'bị chặn', 'bị chặn', true);
end $$;

-- ── B. NHƯNG VIỆC CỦA CÔ THÌ VẪN LÀM ĐƯỢC ───────────────────────────────────────────────────
-- Khoá quá tay ở đây là hỏng đúng buổi họp: không duyệt được, không chấm V/X được.
do $$
declare v_so int;
begin
  update wigs set status = 'approved' where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô VẪN duyệt được mục tiêu của em', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Cô VẪN duyệt được mục tiêu của em', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

do $$
declare v_so int;
begin
  update wigs set achieved_at = now(), achieved_by = (select gvcn from ai)
   where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô VẪN đánh dấu ĐÃ ĐẠT được', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Cô VẪN đánh dấu ĐÃ ĐẠT được', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

do $$
declare v_so int;
begin
  update commitments set verdict = 'win', verdict_at = now() where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô VẪN chấm được V/X trong buổi họp', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Cô VẪN chấm được V/X trong buổi họp', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

do $$
declare v_so int;
begin
  update commitments set status = 'approved' where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô VẪN duyệt được cam kết của em', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Cô VẪN duyệt được cam kết của em', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

-- ── C. VÀ KHÔNG KHOÁ NHẦM AI ────────────────────────────────────────────────────────────────
-- Mục tiêu CỦA LỚP vẫn là việc của cô — khoá nhầm cả cái này là cô không dựng nổi trận đánh nào.
do $$
declare v_so int;
begin
  update wigs set title = title where id = (select wig_lop from ai);
  get diagnostics v_so = row_count;
  insert into kq values ('Mục tiêu CỦA LỚP cô vẫn sửa được', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Mục tiêu CỦA LỚP cô vẫn sửa được', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

-- Em sửa của chính mình.
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);
do $$
declare v_so int;
begin
  update wigs set title = 'KIỂM · em tự sửa' where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Em VẪN sửa được mục tiêu của chính mình', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Em VẪN sửa được mục tiêu của chính mình', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

-- BGH sửa được — đường gỡ khi mọi thứ kẹt.
select set_config('request.jwt.claims',
  (select json_build_object('sub', bgh, 'role', 'authenticated')::text from ai), true);
do $$
declare v_so int; v_bgh uuid := (select bgh from ai);
begin
  if v_bgh is null then
    insert into kq values ('BGH VẪN sửa được (đường gỡ)', '1 dòng', 'trường chưa có tài khoản BGH — CHƯA KIỂM', false);
    return;
  end if;
  update wigs set title = 'KIỂM · BGH sửa' where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('BGH VẪN sửa được (đường gỡ)', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('BGH VẪN sửa được (đường gỡ)', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

-- ── D. XOÁ — ĐỂ CUỐI CÙNG, VÌ NÓ PHÁ CẢNH ───────────────────────────────────────────────────
-- Bản đầu của bài này đặt hai phép xoá ở giữa. Trước khi có 0133 thì chúng XOÁ THẬT, và mọi phép
-- đo phía sau đọc trên một dòng đã biến mất — báo "cô không duyệt được", "em không sửa được", tức
-- tố cáo hàng loạt luật hoàn toàn lành. Phép kiểm phá cảnh của chính nó là phép kiểm nói dối.
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  delete from commitments where id = (select id from ck_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô KHÔNG xoá được cam kết của em', 'bị chặn', v_so || ' dòng lọt', false);
exception when others then
  insert into kq values ('Cô KHÔNG xoá được cam kết của em', 'bị chặn', 'bị chặn', true);
end $$;

do $$
declare v_so int;
begin
  delete from wigs where id = (select id from cua_em);
  get diagnostics v_so = row_count;
  insert into kq values ('Cô KHÔNG xoá được mục tiêu của em', 'bị chặn', v_so || ' dòng lọt', false);
exception when others then
  insert into kq values ('Cô KHÔNG xoá được mục tiêu của em', 'bị chặn', 'bị chặn', true);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
