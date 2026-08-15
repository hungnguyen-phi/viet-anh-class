-- EM ĐỘNG ĐƯỢC TỚI ĐÂU VÀO MỤC TIÊU CỦA CHÍNH MÌNH — phép kiểm.
--
-- Vốn là bài kiểm "cửa sổ một ngày" (0102). Cái đồng hồ ấy đã bỏ (0129/0131), vì hai quyết định
-- của chủ dự án 15/08/2026 làm nó vừa thừa vừa sai:
--
--   · "WIGs có thể được thay đổi trong năm, nhưng vẫn cần GVCN duyệt" — nên SỬA luôn mở, và cái
--     giữ chất lượng là con mắt của cô chứ không phải cái đồng hồ.
--   · "Lead measure không được xoá, sửa, chỉ được thêm" — nên việc dẫn dắt khoá ngay khi thêm.
--
-- Còn XOÁ thì đổi câu hỏi: không hỏi "mục tiêu này còn mới không" mà hỏi "xoá nó có làm mất công
-- sức của ai không". Chưa có lượt tick nào thì xoá không mất gì; có rồi thì đó là dấu chân của
-- chính em trên những ngày đã qua, và em phải nhờ cô.
--
-- Sáu điều phải đúng cùng lúc:
--   1. Em SỬA được mục tiêu của mình
--   2. Sửa xong thì mục tiêu về CHỜ DUYỆT
--   3. Em KHÔNG sửa được việc dẫn dắt
--   4. Chưa có tick · em XOÁ được
--   5. ĐÃ có tick · em KHÔNG xoá được
--   6. Có tick hay không, CÔ vẫn xoá được
--
--   npm run sql -- scripts/test-cua-so-mot-ngay.sql

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_em uuid; v_lop uuid; v_gv uuid; v_wig uuid; v_viec uuid; n int;
  v_ck uuid;
begin
  -- Một em đang học thật, và GVCN của chính lớp ấy.
  select e.student_id, e.class_id into v_em, v_lop
  from enrollments e join classes c on c.id = e.class_id
  where e.is_active and c.homeroom_teacher_id is not null limit 1;
  select homeroom_teacher_id into v_gv from classes where id = v_lop;

  if v_em is null then
    insert into kq values ('Có em để thử', 'có', 'KHÔNG CÓ em nào đang học', false);
    return;
  end if;

  -- Mục tiêu CÔ ĐẶT HỘ: vào thẳng 'approved', tức là không có cửa sổ thì em bó tay ngay từ đầu.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, v_em, 'student', 'academic', 'approved', 'teacher', 'tick', 'knowledge',
          'year', 'TEST-0102', 'thử cửa sổ một ngày', 5, 9, 'điểm',
          current_date, current_date + 30)
  returning id into v_wig;

  -- 0121: việc dẫn dắt treo dưới CAM KẾT. Fixture dựng đúng chuỗi thật — mục tiêu năm → cam kết
  -- tuần → việc — chứ không kiểm một hình dạng dữ liệu mà app không còn tạo ra được.
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  values (v_wig, v_lop, v_em, vn_week_start(), 'KIỂM · cam kết', 'knowledge')
  returning id into v_ck;

  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_ck, 'việc thử', 3, 'lần', array[1,3,5], 1) returning id into v_viec;

  -- ── CÒN TRONG CỬA SỔ ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  update wigs set title = 'em sửa lại' where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Vừa tạo · em SỬA mục tiêu', '1 dòng', n || ' dòng', n = 1);

  -- Sửa xong thì mục tiêu quay về chờ duyệt (0129) — đó mới là thứ giữ chất lượng, thay cho đồng hồ.
  perform set_config('role', 'postgres', true);
  insert into kq
  select 'Em sửa xong thì mục tiêu về CHỜ DUYỆT', 'sent', w.status, w.status = 'sent'
  from wigs w where w.id = v_wig;

  perform set_config('role', 'authenticated', true);
  update lead_measures set title = 'em sửa việc' where id = v_viec;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Em KHÔNG sửa được việc dẫn dắt (0129)', '0 dòng', n || ' dòng', n = 0);

  perform set_config('role', 'authenticated', true);
  delete from wigs where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Chưa có tick · em XOÁ được', '1 dòng', n || ' dòng', n = 1);

  -- ── ĐÃ QUÁ CỬA SỔ ──────────────────────────────────────────────────────────────────────────
  -- Dựng lại y hệt rồi kéo created_at lùi hai ngày. Kéo lùi chứ không chờ: phép kiểm phải chạy
  -- được trong một giây, mà thứ cần chứng minh là cái mốc 24 giờ chứ không phải thời gian thật.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date,
                    created_at)
  values (v_lop, v_em, 'student', 'academic', 'approved', 'teacher', 'tick', 'knowledge',
          'year', 'TEST-0102', 'mục tiêu đã chốt', 5, 9, 'điểm',
          current_date, current_date + 30, now() - interval '2 days')
  returning id into v_wig;

  -- Lần này treo một LƯỢT TICK dưới mục tiêu — đó mới là thứ khoá đường xoá của em.
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  values (v_wig, v_lop, v_em, vn_week_start(), 'KIỂM · cam kết có tick', 'knowledge')
  returning id into v_ck;
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_ck, 'việc đã có tick', 3, 'lần', array[1,3,5], 1) returning id into v_viec;
  insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
  values (v_viec, v_em, v_em, 1, vn_week_start());

  perform set_config('role', 'authenticated', true);
  update wigs set title = 'em vẫn sửa được' where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Mục tiêu cũ · em VẪN sửa được (bỏ đồng hồ 24 giờ)', '1 dòng', n || ' dòng', n = 1);

  perform set_config('role', 'authenticated', true);
  delete from wigs where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('ĐÃ có tick · em KHÔNG xoá được', '0 dòng', n || ' dòng', n = 0);

  -- Cô thì không vướng cửa sổ nào — rls_all_wigs.
  perform set_config('request.jwt.claims', json_build_object('sub', v_gv, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  delete from wigs where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Quá 1 ngày · CÔ vẫn xoá được', '1 dòng', n || ' dòng', n = 1);
exception when others then
  perform set_config('role', 'postgres', true);
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;

select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

rollback;
