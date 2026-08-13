-- PHẦN TRĂM ĐO THEO QUÃNG PHẢI ĐI, KHÔNG THEO ĐÍCH (0109).
--
--   npm run sql -- scripts/test-quang-duong.sql
--
-- Chuyện đã xảy ra: mục tiêu "từ 7 đến 9 tiết", em tick 2 lượt — tức đi hết quãng — mà vòng tròn
-- hiện 22%. Bỏ một tick còn 11%, thêm một tick lên 33%: đúng dãy 1/9, 2/9, 3/9. App chia cho ĐÍCH
-- (9) thay vì chia cho QUÃNG (9−7=2), nên vòng tròn ấy không bao giờ đầy được dù em làm đủ mọi
-- thứ mình hứa.
--
-- Luật đang kiểm:
--   1. quang_duong(9, 7) = 2, và baseline null thì quãng đúng bằng đích
--   2. Đi hết quãng → 100%, KHÔNG phải 22%
--   3. Đi nửa quãng → 50%
--   4. baseline = 0 (mọi WIG lớp) → kết quả không đổi một đơn vị nào
--   5. TRẦN THEO TUẦN: việc 2 lượt/tuần, em tick đủ 2 tuần → tính 4, không bị kẹp ở 2
--   6. Đích ghi-nhận-ngoài vẫn chỉ nhìn achieved_at (0101/0107 không bị bản này phá)
--
-- TOÀN BỘ TRONG MỘT GIAO DỊCH VÀ ROLLBACK: bài này gieo mục tiêu và lượt tick thật.

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_em uuid; v_lop uuid; v_wig uuid; v_viec uuid; v_thu2 date := vn_week_start();
  p numeric; a numeric;
begin
  select e.student_id, e.class_id into v_em, v_lop
  from enrollments e join classes c on c.id = e.class_id
  where e.is_active and c.homeroom_teacher_id is not null limit 1;
  if v_em is null then
    insert into kq values ('Có em để thử', 'có', 'không có em nào đang học', false);
    return;
  end if;

  -- ① Hàm quãng đường
  insert into kq values ('quang_duong(9, 7)', '2', private.quang_duong(9,7)::text, private.quang_duong(9,7) = 2);
  insert into kq values ('baseline null → quãng = đích', '50', private.quang_duong(50,null)::text,
                         private.quang_duong(50,null) = 50);
  insert into kq values ('baseline ≥ đích → 0, không âm', '0', private.quang_duong(5,9)::text,
                         private.quang_duong(5,9) = 0);

  -- Mục tiêu "từ 7 đến 9", việc 2 lượt/tuần, cả kỳ dài 3 tuần.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, v_em, 'student', 'academic', 'approved', 'student', 'tick', 'knowledge',
          'year', 'TEST-0109', 'thử quãng đường', 7, 9, 'tiết', v_thu2 - 14, v_thu2 + 6)
  returning id into v_wig;
  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_wig, 'việc thử', 2, 'tiết', array[1,2,3,4,5], 1) returning id into v_viec;

  -- ② Đi HẾT quãng (2 lượt) → 100%
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_viec, v_em, v_em, v_thu2, 1), (v_viec, v_em, v_em, v_thu2 + 1, 1);
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('Đi hết quãng (2/2) → 100%', '1.0000', p::text, p = 1);

  -- ③ Đi NỬA quãng
  delete from lead_progress where lead_measure_id = v_viec and logged_date = v_thu2 + 1;
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('Đi nửa quãng (1/2) → 50%', '0.5000', p::text, p = 0.5);

  -- ④ baseline = 0 → như cũ: 1 lượt trên đích 9 = 11%
  update wigs set baseline = 0 where id = v_wig;
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('baseline 0 → chia cho đích như cũ', '0.1111', p::text, p = 0.1111);
  update wigs set baseline = 7 where id = v_wig;

  -- ⑤ TRẦN THEO TUẦN. Việc 2 lượt/tuần; tick đủ 2 lượt ở TUẦN TRƯỚC và 2 lượt ở TUẦN NÀY.
  -- Luật cũ kẹp tổng cả kỳ ở 2 → wig_actual = 2. Luật mới kẹp từng tuần → 4.
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_viec, v_em, v_em, v_thu2 + 1, 1),
         (v_viec, v_em, v_em, v_thu2 - 7, 1),
         (v_viec, v_em, v_em, v_thu2 - 6, 1);
  select private.wig_actual(v_wig) into a;
  insert into kq values ('Trần theo TUẦN, không theo cả kỳ', '4', a::text, a = 4);

  -- ⑥ Đích ghi-nhận-ngoài không bị bản này phá
  update wigs set measure_by = 'manual', achieved_at = null where id = v_wig;
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('Đích ngoài app · chưa ghi nhận → 0', '0', p::text, p = 0);
  -- `wig_achieved_ck` bắt achieved_at và achieved_by phải đi cùng nhau — ghi nhận một mục tiêu thì
  -- phải có tên người ghi nhận, không có chuyện "tự nhiên nó đạt".
  update wigs set achieved_at = now(), achieved_by = v_em where id = v_wig;
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('Đích ngoài app · đã ghi nhận → 100%', '1', p::text, p = 1);

exception when others then
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;
select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

-- KHÔNG BỎ DÒNG NÀY.
rollback;
