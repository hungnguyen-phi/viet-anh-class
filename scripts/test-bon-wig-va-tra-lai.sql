-- BỐN WIG MỖI EM + VÒNG DUYỆT CÓ TRẢ LẠI + EM KHÔNG TỰ DUYỆT (0145 — PRD v3 Đợt B)
--
--   npm run sql -- scripts/test-bon-wig-va-tra-lai.sql
--
-- Ba luật mới của 18/08/2026, kiểm bằng cách ĐÓNG VAI người thật ghi thẳng vào bảng —
-- gỡ nút trên giao diện mà cửa sau còn mở thì chỉ là giấu, không phải khoá:
--   A. Mỗi em MỘT WIG mỗi domain mỗi năm (wigs_em_domain_uidx) — cái thứ hai cùng domain bị chặn,
--      nhưng domain KHÁC thì vào bình thường (đường tới đủ 4 phải thông).
--   B. Em KHÔNG tự đưa mục tiêu của mình sang 'approved' (trg_chan_em_tu_duyet) — kể cả gọi
--      thẳng API. Em VẪN sửa được nội dung khi bị trả lại (đường gửi lại phải thông).
--   C. Trả lại thì PHẢI kèm nhận xét (wig_reject_note_ck) — rejected tay không bị chặn.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop,
       c.homeroom_teacher_id as gvcn,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on kq, ai to authenticated;

-- Một WIG 'sent' của em ở một năm học xa — không đụng dữ liệu đang chạy.
create table w1 as
with w as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2031-2032', 'KIỂM · WIG domain 1', 0,
         300, 'bài', date '2031-08-01', date '2032-05-31', 'academic', 'student', 'manual', 'sent'
  from ai returning id
)
select id from w;
grant all on w1 to authenticated;

-- ── A. KHOÁ THEO DOMAIN ────────────────────────────────────────────────────────────────────
do $$
declare v_so int;
begin
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2031-2032', 'KIỂM · trùng domain', 0,
         100, 'bài', date '2031-08-01', date '2032-05-31', 'academic', 'student', 'manual', 'sent'
  from ai;
  insert into kq values ('WIG thứ hai CÙNG domain cùng năm', 'BỊ CHẶN', 'vào được', false);
exception when unique_violation then
  insert into kq values ('WIG thứ hai CÙNG domain cùng năm', 'BỊ CHẶN', 'bị chặn đúng khoá', true);
end $$;

do $$
declare v_so int;
begin
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                    target_value, unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'character', 'year', '2031-2032', 'KIỂM · domain khác', 0,
         100, 'lần', date '2031-08-01', date '2032-05-31', 'academic', 'student', 'manual', 'sent'
  from ai;
  get diagnostics v_so = row_count;
  insert into kq values ('WIG domain KHÁC cùng năm (đường tới đủ 4)', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('WIG domain KHÁC cùng năm (đường tới đủ 4)', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

-- ── C. TRẢ LẠI PHẢI KÈM NHẬN XÉT (vai hệ thống — luật nằm ở CHECK, không phụ thuộc vai) ──────
do $$
begin
  update wigs set status = 'rejected', reject_note = null where id = (select id from w1);
  insert into kq values ('Trả lại TAY KHÔNG (không nhận xét)', 'BỊ CHẶN', 'vào được', false);
exception when check_violation then
  insert into kq values ('Trả lại TAY KHÔNG (không nhận xét)', 'BỊ CHẶN', 'bị chặn đúng CHECK', true);
end $$;

do $$
declare v_so int;
begin
  update wigs set status = 'rejected', reject_note = 'Em ghi rõ con số xuất phát nhé'
  where id = (select id from w1);
  get diagnostics v_so = row_count;
  insert into kq values ('Trả lại KÈM nhận xét', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Trả lại KÈM nhận xét', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

-- ── B. ĐÓNG VAI CHÍNH EM ───────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  -- Em sửa nội dung và gửi lại (rejected → sent, nhận xét được dọn) — đường này PHẢI thông.
  update wigs set title = 'KIỂM · em sửa theo nhận xét', status = 'sent', reject_note = null
  where id = (select id from w1);
  get diagnostics v_so = row_count;
  insert into kq values ('Em sửa mục tiêu bị trả lại rồi gửi lại', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Em sửa mục tiêu bị trả lại rồi gửi lại', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;

do $$
begin
  -- Cửa sau từng mở toang (soi RLS 18/08/2026): em gọi thẳng API đổi 'sent' → 'approved'.
  update wigs set status = 'approved' where id = (select id from w1);
  insert into kq values ('Em TỰ DUYỆT mục tiêu của mình', 'BỊ CHẶN', 'vào được — LỖ HỔNG', false);
exception when others then
  insert into kq values ('Em TỰ DUYỆT mục tiêu của mình', 'BỊ CHẶN', 'bị chặn: ' || sqlerrm, true);
end $$;

reset role;

-- ── DỌN & BÁO ──────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
