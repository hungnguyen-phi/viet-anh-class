-- BIÊN BẢN PDR LÀ CHUYỆN RIÊNG — chỉ người tham gia + giáo viên (0146, PRD v3 mục 12)
--
--   npm run sql -- scripts/test-pdr-rieng-tu.sql
--
-- Biên bản PDR chứa chia sẻ cá nhân của trẻ (khó khăn, cách vượt qua). PRD v3 đòi RLS bảo đảm
-- "GVCN + người tham gia", và đòi đưa vào bộ kiểm bắt buộc trước go-live. Mọi phép ĐÓNG VAI
-- người thật ghi/đọc thẳng vào bảng — đường API, không phải đường giao diện.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

-- Ba em cùng lớp Test: em1 trả lời, em2 là buddy ngồi cùng, em3 đứng ngoài buổi họp.
create table ai as
select c.id as lop,
       c.homeroom_teacher_id as gvcn,
       (select array_agg(student_id order by student_id)
        from (select student_id from enrollments
              where class_id = c.id and is_active order by student_id limit 3) ba) as em
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on kq, ai to authenticated;

do $$
begin
  if (select array_length(em, 1) from ai) < 3 then
    raise exception 'Lớp Test cần ít nhất 3 em đang học để kiểm bài này';
  end if;
end $$;

create table bb as
with m as (
  insert into pdr_meetings (class_id, student_id, type, counterpart_id, week_label,
                            q3_obstacle)
  select lop, em[1], 'buddy', em[2], 'W99-2031',
         'KIỂM · một chia sẻ riêng tư'
  from ai returning id
)
select id from m;
grant all on bb to authenticated;

-- ── EM ĐỨNG NGOÀI: không thấy, không sửa ────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em[3], 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  select count(*) into v_so from pdr_meetings where id = (select id from bb);
  insert into kq values ('Em NGOÀI buổi họp đọc biên bản', '0 dòng', v_so || ' dòng', v_so = 0);
end $$;
do $$
declare v_so int;
begin
  update pdr_meetings set q3_obstacle = 'EM NGOÀI SỬA' where id = (select id from bb);
  get diagnostics v_so = row_count;
  insert into kq values ('Em NGOÀI buổi họp sửa biên bản', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into kq values ('Em NGOÀI buổi họp sửa biên bản', '0 dòng', 'bị chặn: ' || sqlerrm, true);
end $$;

-- ── BUDDY NGỒI CÙNG: đọc được, nhưng không sửa phần trả lời của bạn ─────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', em[2], 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  select count(*) into v_so from pdr_meetings where id = (select id from bb);
  insert into kq values ('Buddy tham gia đọc biên bản', '1 dòng', v_so || ' dòng', v_so = 1);
end $$;
do $$
declare v_so int;
begin
  update pdr_meetings set q3_obstacle = 'BUDDY SỬA HỘ' where id = (select id from bb);
  get diagnostics v_so = row_count;
  insert into kq values ('Buddy sửa phần trả lời của bạn', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into kq values ('Buddy sửa phần trả lời của bạn', '0 dòng', 'bị chặn: ' || sqlerrm, true);
end $$;

-- ── CHÍNH EM: sửa được TỚI KHI GHI NHẬN, ký xong là đóng ───────────────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', em[1], 'role', 'authenticated')::text from ai), true);

do $$
declare v_so int;
begin
  update pdr_meetings set q4_overcome = 'KIỂM · em tự ghi' where id = (select id from bb);
  get diagnostics v_so = row_count;
  insert into kq values ('Chính em ghi câu trả lời', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Chính em ghi câu trả lời', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;
do $$
declare v_so int;
begin
  update pdr_meetings
  set acknowledged_at = now(), acknowledged_by = (select em[1] from ai)
  where id = (select id from bb);
  get diagnostics v_so = row_count;
  insert into kq values ('Chính em bấm Ghi nhận', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into kq values ('Chính em bấm Ghi nhận', '1 dòng', 'BỊ CHẶN: ' || sqlerrm, false);
end $$;
do $$
declare v_so int;
begin
  update pdr_meetings set q4_overcome = 'SỬA SAU KHI KÝ' where id = (select id from bb);
  get diagnostics v_so = row_count;
  insert into kq values ('Sửa biên bản SAU khi Ghi nhận', '0 dòng', v_so || ' dòng', v_so = 0);
exception when others then
  insert into kq values ('Sửa biên bản SAU khi Ghi nhận', '0 dòng', 'bị chặn: ' || sqlerrm, true);
end $$;

-- ── GVCN: thấy tất cả ──────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);
do $$
declare v_so int;
begin
  select count(*) into v_so from pdr_meetings where id = (select id from bb);
  insert into kq values ('GVCN đọc biên bản PDR của lớp mình', '1 dòng', v_so || ' dòng', v_so = 1);
end $$;

reset role;

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
