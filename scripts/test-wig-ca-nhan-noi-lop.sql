-- WIG NĂM CỦA EM NỐI VÀO WIG NĂM CỦA LỚP (0099) — sợi dây có, nhưng tiến độ KHÔNG tràn qua.
--
-- Chủ dự án: "wig năm của em phải liên kết với wig năm của lớp chứ? […] lớp làm 1000 bài tập về
-- nhà, lớp có 10 em thì mỗi em 100 bài." Nối được rồi thì phát sinh ngay một mối nguy: hàm tính
-- tiến độ đi ĐỆ QUY xuống mọi con qua parent_wig_id, nên WIG năm của lớp bỗng có thêm 30 đứa con
-- là WIG cá nhân của 30 em — và mỗi lượt tick việc RIÊNG của một em sẽ cộng thẳng vào tiến độ
-- chung, rồi vào điểm thi đua toàn trường. Lớp nào đông em chăm làm việc riêng sẽ leo hạng mà
-- không cần làm gì cho mục tiêu chung.
--
-- Phép kiểm này ghim đúng chỗ ấy. Chạy trong một giao dịch rồi ROLLBACK.
--
--   npm run sql -- scripts/test-wig-ca-nhan-noi-lop.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

do $$
declare
  v_class     uuid;
  v_nam_lop   uuid;
  v_tuan_lop  uuid;
  v_lead_lop  uuid;
  v_nam_em    uuid;
  v_tuan_em   uuid;
  v_lead_em   uuid;
  v_a         uuid;
  v_b         uuid;
  v_truoc     numeric;
  v_sau       numeric;
  v_em        numeric;
begin
  select e.class_id into v_class
  from enrollments e where e.is_active
  group by e.class_id having count(*) >= 2 limit 1;
  select student_id into v_a from enrollments where class_id = v_class and is_active order by student_id limit 1;
  select student_id into v_b from enrollments where class_id = v_class and is_active order by student_id offset 1 limit 1;
  update enrollments set is_active = false
   where class_id = v_class and is_active and student_id not in (v_a, v_b);

  -- Cây của LỚP: năm → tuần → một việc chung, mỗi em cần 3.
  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date)
  values (v_class, 'class', 'ZZ_TEST năm lớp', 'knowledge', 'year', 'ZZ2026', 6, 'bài',
          '2026-01-01', '2026-12-31')
  returning id into v_nam_lop;

  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date, parent_wig_id)
  values (v_class, 'class', 'ZZ_TEST tuần lớp', 'knowledge', 'week', 'ZZW01', 3, 'bài',
          '2026-03-02', '2026-03-08', v_nam_lop)
  returning id into v_tuan_lop;

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_tuan_lop, 'ZZ_TEST việc chung', 3, 'bài', '{1,2,3,4,5}', 1)
  returning id into v_lead_lop;

  -- Cả hai em làm đủ phần việc CHUNG → tiến độ năm của lớp bằng 6.
  --
  -- SỬA 14/08/2026: dòng này vốn đòi 3, và nó tự mâu thuẫn với phép kiểm thứ ba trong CHÍNH FILE
  -- NÀY ("tiến độ của LỚP đứng yên", mong đợi 6). Số đúng là 6: luật "mỗi em một bộ đếm" (0098)
  -- cho mỗi em một trần riêng bằng đích của việc, nên hai em làm đủ là 3 + 3. Con số 3 là dấu vết
  -- của luật CŨ — trần đặt trên tổng của cả lớp — và không ai sửa nốt dòng này khi luật đổi.
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead_lop, v_a, 1, '2026-03-02', v_a), (v_lead_lop, v_a, 1, '2026-03-03', v_a),
         (v_lead_lop, v_a, 1, '2026-03-04', v_a),
         (v_lead_lop, v_b, 1, '2026-03-02', v_b), (v_lead_lop, v_b, 1, '2026-03-03', v_b),
         (v_lead_lop, v_b, 1, '2026-03-04', v_b);

  v_truoc := private.wig_actual(v_nam_lop);
  insert into ket_qua values
    ('Việc chung: cả hai em đủ → tiến độ năm của lớp = 6 (mỗi em một bộ đếm)',
     '6', v_truoc::text, v_truoc = 6);

  -- Cây CÁ NHÂN của em A, NỐI VÀO WIG năm của lớp (đây là thứ 0099 mở ra).
  insert into wigs (class_id, student_id, scope, title, area, period, period_label,
                    target_value, unit, start_date, end_date, parent_wig_id)
  values (v_class, v_a, 'student', 'ZZ_TEST năm em', 'knowledge', 'year', 'ZZ2026', 3, 'bài',
          '2026-01-01', '2026-12-31', v_nam_lop)
  returning id into v_nam_em;

  insert into ket_qua
  select 'Sợi dây có thật: WIG năm của em trỏ về WIG năm của lớp',
         'trỏ đúng', coalesce(w.parent_wig_id::text, 'NULL'), w.parent_wig_id = v_nam_lop
  from wigs w where w.id = v_nam_em;

  insert into wigs (class_id, student_id, scope, title, area, period, period_label,
                    target_value, unit, start_date, end_date, parent_wig_id)
  values (v_class, v_a, 'student', 'ZZ_TEST tuần em', 'knowledge', 'week', 'ZZW01', 3, 'bài',
          '2026-03-02', '2026-03-08', v_nam_em)
  returning id into v_tuan_em;

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_tuan_em, 'ZZ_TEST việc riêng của em', 3, 'bài', '{1,2,3,4,5}', 1)
  returning id into v_lead_em;

  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead_em, v_a, 1, '2026-03-02', v_a), (v_lead_em, v_a, 1, '2026-03-03', v_a),
         (v_lead_em, v_a, 1, '2026-03-04', v_a);

  -- ── CHỐT: việc RIÊNG của em không được đẩy tiến độ của LỚP lên ──────────────────────────
  v_sau := private.wig_actual(v_nam_lop);
  insert into ket_qua values
    ('Em làm xong việc riêng → tiến độ của LỚP đứng yên', v_truoc::text, v_sau::text, v_sau = v_truoc);

  -- ── Và tiến độ cá nhân của em vẫn đếm đủ phần của em ────────────────────────────────────
  v_em := private.wig_actual(v_nam_em);
  insert into ket_qua values
    ('Tiến độ WIG năm CỦA EM đếm đủ việc riêng', '3', v_em::text, v_em = 3);

  -- ── Chiều ngược lại: việc CHUNG không nhảy vào WIG cá nhân của em ───────────────────────
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead_lop, v_a, 1, '2026-03-05', v_a);
  insert into ket_qua values
    ('Tick thêm việc chung → WIG cá nhân của em đứng yên', '3', private.wig_actual(v_nam_em)::text,
     private.wig_actual(v_nam_em) = 3);
end $$;

select
  case when dat then 'OK  ' else 'SAI ' end || ' ' || buoc
    || case when dat then '' else '  → mong ' || mong_doi || ', thực tế ' || thuc_te end as ket_qua
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket from ket_qua;

rollback;
