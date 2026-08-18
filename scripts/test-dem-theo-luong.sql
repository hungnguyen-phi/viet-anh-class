-- ĐẾM THEO LƯỢNG, VÀ VÒNG TRÒN NĂM CỘNG DỒN CẢ NĂM (0110).
--
--   npm run sql -- scripts/test-dem-theo-luong.sql
--
-- Chủ dự án mô tả đúng thứ phải xảy ra: "năm có 5000 lead, thứ Hai điền 10 lead thì nó nhích lên
-- bao nhiêu % đó" — tức mỗi lượt điền cộng thẳng vào tổng của cả năm, không bị kẹp theo tuần.
--
-- Bản 0109 (cùng ngày) đã kẹp trần tuần cho MỌI wig; 0110 gỡ trần ấy khỏi mục tiêu của chính em và
-- giữ nguyên cho wig của lớp. Bài này canh đúng ranh giới đó, vì nó rất dễ bị gỡ nhầm cả hai.
--
-- Luật đang kiểm:
--   1. Mục tiêu của EM: điền 10 → cộng đúng 10
--   2. Mục tiêu của EM: vượt chỉ tiêu tuần vẫn cộng đủ, KHÔNG kẹp
--   3. Một ngày không được nhiều hơn cả chỉ tiêu tuần (chặn số gõ nhầm, ngay ở CSDL)
--   4. Làm dồn cả tuần vào một hôm, đúng bằng chỉ tiêu tuần → vẫn lọt
--   5. WIG của LỚP: TRẦN VẪN CÒN (0098 "mỗi em một bộ đếm")
--   6. Vòng tròn năm nhích đúng tỷ lệ: 10 lead trên quãng 5000 = 0,2%

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_em uuid; v_lop uuid; v_wig uuid; v_viec uuid; v_wlop uuid; v_vlop uuid;
  v_wig2 uuid; v_viec2 uuid;
  v_thu2 date := vn_week_start(); a numeric; p numeric;
  v_ck uuid; v_ck2 uuid; v_cklop uuid;
begin
  select e.student_id, e.class_id into v_em, v_lop
  from enrollments e join classes c on c.id = e.class_id
  where e.is_active and c.homeroom_teacher_id is not null limit 1;
  if v_em is null then
    insert into kq values ('Có em để thử', 'có', 'không có em nào đang học', false);
    return;
  end if;

  -- Mục tiêu năm của EM: 5000 lead; việc tuần 30 lead, ô ĐIỀN SỐ.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, v_em, 'student', 'academic', 'approved', 'student', 'tick', 'knowledge',
          'year', 'TEST-0110', 'thử đếm theo lượng', 0, 5000, 'lead', v_thu2 - 7, v_thu2 + 300)
  returning id into v_wig;
  -- 0121: việc treo dưới CAM KẾT, không treo thẳng vào mục tiêu.
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  values (v_wig, v_lop, v_em, v_thu2, 'KIỂM · cam kết của em', 'knowledge') returning id into v_ck;
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick, nhap_luong)
  values (v_ck, 'điền lead', 30, 'lead', array[1,2,3,4,5], 1, true) returning id into v_viec;

  -- ① Điền 10 → cộng đúng 10
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_viec, v_em, v_em, v_thu2, 10);
  select private.wig_actual(v_wig) into a;
  insert into kq values ('EM · điền 10 → cộng đúng 10', '10', a::text, a = 10);

  -- ② Vượt chỉ tiêu tuần (10 + 25 = 35 > 30) vẫn cộng đủ
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_viec, v_em, v_em, v_thu2 + 1, 25);
  select private.wig_actual(v_wig) into a;
  insert into kq values ('EM · vượt chỉ tiêu tuần vẫn cộng đủ', '35', a::text, a = 35);

  -- ⑥ Vòng tròn nhích đúng tỷ lệ (35 / 5000 = 0,7%)
  select pct into p from wig_progress_v where wig_id = v_wig;
  insert into kq values ('Vòng tròn năm = 35/5000', '0.0070', p::text, p = 0.0070);

  -- ③ Gõ nhầm 999 bị chặn
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
    values (v_viec, v_em, v_em, v_thu2 + 2, 999);
    insert into kq values ('Một ngày > chỉ tiêu tuần · bị chặn', 'bị chặn', 'GHI ĐƯỢC', false);
  exception when check_violation then
    insert into kq values ('Một ngày > chỉ tiêu tuần · bị chặn', 'bị chặn', 'bị chặn', true);
  end;

  -- ④ Dồn cả tuần vào một hôm, đúng bằng chỉ tiêu → lọt
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
    values (v_viec, v_em, v_em, v_thu2 + 3, 30);
    insert into kq values ('Dồn cả tuần vào một hôm (=30) · vẫn lọt', 'lọt', 'lọt', true);
  exception when check_violation then
    insert into kq values ('Dồn cả tuần vào một hôm (=30) · vẫn lọt', 'lọt', 'BỊ CHẶN OAN', false);
  end;

  -- ⑤ MỘT CHẠM, MỖI CHẠM ĐÁNG NHIỀU ĐƠN VỊ — ví dụ thứ hai của chủ dự án:
  -- "năm có 10000 giờ học, 1 tick ngày = 3 giờ, thì mỗi lần tick là 3h/10000 giờ".
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, v_em, 'student', 'personal', 'approved', 'student', 'tick', 'physical_wellbeing',
          'year', 'TEST-0110B', 'thử 1 tick = 3 giờ', 0, 10000, 'giờ', v_thu2 - 7, v_thu2 + 300)
  returning id into v_wig2;
  -- 0121: việc treo dưới CAM KẾT. Em đã có một cam kết ở khối trên; đây là cái thứ hai — vừa
  -- đúng trần 2, và cũng là cách phép kiểm này chạm luôn vào cái trần ấy.
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  values (v_wig2, v_lop, v_em, v_thu2, 'KIỂM · cam kết thứ hai', 'physical_wellbeing') returning id into v_ck2;
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick, nhap_luong)
  values (v_ck2, 'học bài', 9, 'giờ', array[1,3,5], 3, false) returning id into v_viec2;
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_viec2, v_em, v_em, v_thu2, 1);
  select private.wig_actual(v_wig2) into a;
  insert into kq values ('1 tick = 3 giờ → cộng 3, không phải 1', '3', a::text, a = 3);
  select pct into p from wig_progress_v where wig_id = v_wig2;
  insert into kq values ('Vòng tròn năm = 3/10000', '0.0003', p::text, p = 0.0003);

  -- ⑥ WIG CỦA LỚP: trần vẫn còn (0098). Việc 3 lượt/tuần, em tick 3 hôm rồi cố góp thêm.
  insert into wigs (class_id, scope, status, measure_by, area, period, period_label,
                    title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, 'class', 'approved', 'tick', 'knowledge', 'year', 'TEST-0110W',
          'thử trần lớp', 0, 90, 'lần', v_thu2 - 30, v_thu2 + 300)
  returning id into v_wlop;
  -- 0121: việc treo dưới CAM KẾT, không treo thẳng vào mục tiêu.
  insert into commitments (wig_id, class_id, week_start, title, area)
  values (v_wlop, v_lop, v_thu2, 'KIỂM · cam kết của lớp', 'knowledge') returning id into v_cklop;
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_cklop, 'việc chung', 3, 'lần', array[1,2,3,4,5], 1) returning id into v_vlop;
  insert into lead_progress (lead_measure_id, student_id, logged_by, logged_date, value)
  values (v_vlop, v_em, v_em, v_thu2, 1),
         (v_vlop, v_em, v_em, v_thu2 + 1, 1),
         (v_vlop, v_em, v_em, v_thu2 + 2, 1),
         (v_vlop, v_em, v_em, v_thu2 + 3, 1);
  select private.wig_actual(v_wlop) into a;
  insert into kq values ('LỚP · trần "mỗi em một bộ đếm" còn nguyên', '3', a::text, a = 3);

exception when others then
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;
select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

-- KHÔNG BỎ DÒNG NÀY.
rollback;
