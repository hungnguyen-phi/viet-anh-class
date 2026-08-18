-- DỰNG LẠI DỮ LIỆU CHO LỚP TEST THEO MÔ HÌNH MỚI (14/08/2026)
--
-- Chủ dự án: "xóa những bộ wig cũ, lead measure cũ vì nó neo nhau, sau khi code xong bộ mới, thì
-- tạo lại, fill đủ cho lớp test luôn."
--
-- Đây là dữ liệu THẬT, không rollback. Chạy lại được nhiều lần: mọi thứ khoá theo tên nên lần
-- chạy sau không đẻ bản sao.
--
--   npm run sql -- scripts/seed-lop-test.sql

create temporary table b as
select c.id as lop, c.campus_id as co_so,
       vn_week_start() as tuan,
       date '2026-07-01' as tu, date '2027-06-30' as den,
       '2026-2027' as nam
from classes c where c.name = 'Test' and c.is_active limit 1;

-- ── MỤC TIÊU NĂM CỦA LỚP ───────────────────────────────────────────────────────────────────
insert into wigs (class_id, scope, area, period, period_label, title, baseline, target_value,
                  unit, start_date, end_date, measure_by)
select b.lop, 'class', v.area::wig_domain, 'year', b.nam, v.ten, v.tu_so, v.dich, v.dv, b.tu, b.den, v.do_bang
from b, (values
  ('knowledge', 'Cả lớp làm đủ 1200 bài tập về nhà', 0, 1200, 'bài', 'tick'),
  ('physical_wellbeing',  'Điểm trung bình thể lực từ 6 lên 8', 6, 8, 'điểm', 'manual')
) as v(area, ten, tu_so, dich, dv, do_bang)
where not exists (
  select 1 from wigs w where w.class_id = b.lop and w.scope = 'class' and w.title = v.ten
);

-- Mục tiêu CUỘN của lớp — dạng thật của 13 mục tiêu lớp ở Gò Vấp.
insert into wigs (class_id, scope, area, period, period_label, title, target_value, unit,
                  start_date, end_date, measure_by, ty_le_can, so_dich_can, tong_dich)
select b.lop, 'class', 'leadership_skills', 'year', b.nam,
       '86% học sinh có 6/8 môn từ 6.5 trở lên', 86, '%', b.tu, b.den, 'cuon', 86, 6, 8
from b
where not exists (
  select 1 from wigs w where w.class_id = b.lop and w.scope = 'class' and w.measure_by = 'cuon'
);

-- ── MỤC TIÊU NĂM CỦA TỪNG EM ───────────────────────────────────────────────────────────────
-- Gắn theo lớp qua source_wig_id: "hs tạo cho hs gắn theo lớp".
insert into wigs (class_id, student_id, scope, area, period, period_label, title, baseline,
                  target_value, unit, start_date, end_date, kind, set_by, measure_by, status,
                  source_wig_id)
select b.lop, e.student_id, 'student', 'knowledge', 'year', b.nam,
       'Làm đủ 300 bài tập Toán trong năm', 0, 300, 'bài', b.tu, b.den,
       'academic', 'student', 'tick', 'approved',
       (select w.id from wigs w where w.class_id = b.lop and w.scope = 'class'
        and w.area = 'knowledge' and w.measure_by = 'tick' limit 1)
from b
join enrollments e on e.class_id = b.lop and e.is_active
where not exists (
  select 1 from wigs w where w.student_id = e.student_id and w.scope = 'student' and w.period = 'year'
);

-- ── CAM KẾT TUẦN NÀY CỦA LỚP (tối đa 2) ────────────────────────────────────────────────────
insert into commitments (wig_id, class_id, week_start, title, area)
select (select w.id from wigs w where w.class_id = b.lop and w.scope = 'class'
        and w.area = 'knowledge' and w.measure_by = 'tick' limit 1),
       b.lop, b.tuan, v.ten, 'knowledge'
from b, (values
  ('Cả lớp nộp bài Toán đúng hạn mỗi ngày'),
  ('Không ai để trống thứ Sáu')
) as v(ten)
where not exists (
  select 1 from commitments c where c.class_id = b.lop and c.student_id is null
    and c.week_start = b.tuan and c.title = v.ten
);

-- Việc dẫn dắt của từng cam kết lớp.
insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
select c.id, v.ten, v.dich, v.dv, '{1,2,3,4,5}', 1
from b
join commitments c on c.class_id = b.lop and c.student_id is null and c.week_start = b.tuan
join lateral (values
  ('Nộp bài Toán trước 21h', 5, 'lần'),
  ('Nhắc bạn cùng bàn', 3, 'lần')
) as v(ten, dich, dv) on c.title = 'Cả lớp nộp bài Toán đúng hạn mỗi ngày'
where not exists (
  select 1 from lead_measures lm where lm.commitment_id = c.id and lm.title = v.ten
);

insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
select c.id, 'Làm bài thứ Sáu', 1, 'lần', '{5}', 1
from b
join commitments c on c.class_id = b.lop and c.student_id is null and c.week_start = b.tuan
where c.title = 'Không ai để trống thứ Sáu'
  and not exists (select 1 from lead_measures lm where lm.commitment_id = c.id);

-- ── CAM KẾT TUẦN NÀY CỦA TỪNG EM (mỗi em 1) ────────────────────────────────────────────────
insert into commitments (wig_id, class_id, student_id, week_start, title, area)
select w.id, b.lop, w.student_id, b.tuan, 'Mỗi tối làm bài Toán trước 9 giờ', 'knowledge'
from b
join wigs w on w.class_id = b.lop and w.scope = 'student' and w.period = 'year'
where not exists (
  select 1 from commitments c where c.student_id = w.student_id and c.week_start = b.tuan
);

insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
select c.id, 'Làm bài Toán buổi tối', 5, 'bài', '{1,2,3,4,5}', 1
from b
join commitments c on c.class_id = b.lop and c.student_id is not null and c.week_start = b.tuan
where not exists (select 1 from lead_measures lm where lm.commitment_id = c.id);

-- ── VÀI LƯỢT TICK CHO CÓ NHỊP ──────────────────────────────────────────────────────────────
-- Hai em đầu danh sách làm ba ngày đầu tuần; những em còn lại để trống, đúng cảnh thật của một
-- lớp giữa tuần — và cũng để buổi họp có cái mà chấm.
insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
select lm.id, e.student_id, e.student_id, 1, b.tuan + g.i
from b
join commitments c on c.class_id = b.lop and c.student_id is null and c.week_start = b.tuan
join lead_measures lm on lm.commitment_id = c.id
join lateral (
  select student_id from enrollments en where en.class_id = b.lop and en.is_active
  order by student_id limit 2
) e on true
cross join generate_series(0, 2) g(i)
where b.tuan + g.i <= vn_today()
  and not exists (
    select 1 from lead_progress lp
    where lp.lead_measure_id = lm.id and lp.student_id = e.student_id
      and lp.logged_date = b.tuan + g.i
  );

select 'mục tiêu năm của lớp' as thu, count(*) from wigs w, b where w.class_id = b.lop and w.scope='class'
union all select 'mục tiêu năm của em', count(*) from wigs w, b where w.class_id = b.lop and w.scope='student'
union all select 'cam kết của lớp', count(*) from commitments c, b where c.class_id=b.lop and c.student_id is null
union all select 'cam kết của em', count(*) from commitments c, b where c.class_id=b.lop and c.student_id is not null
union all select 'việc dẫn dắt', count(*) from lead_measures lm join commitments c on c.id=lm.commitment_id, b where c.class_id=b.lop
union all select 'lượt tick', count(*) from lead_progress lp join lead_measures lm on lm.id=lp.lead_measure_id
  join commitments c on c.id=lm.commitment_id, b where c.class_id=b.lop;
