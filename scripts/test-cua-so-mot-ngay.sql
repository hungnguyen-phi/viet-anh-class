-- CỬA SỔ MỘT NGÀY (0102) — phép kiểm.
--
-- Luật đang kiểm: mục tiêu của em, khi đã duyệt rồi, chỉ còn sửa/xoá được trong 24 giờ đầu. Đây là
-- đường "con không nhận mục tiêu cô đặt hộ" — mở quá rộng thì cam kết thành thứ đổi lúc nào cũng
-- được, đóng quá chặt thì em mở mắt ra đã thấy một mục tiêu mang tên mình mà không bỏ nổi.
--
-- Sáu điều phải đúng cùng lúc:
--   1. Vừa tạo · em SỬA được
--   2. Vừa tạo · em sửa được cả VIỆC treo dưới nó
--   3. Vừa tạo · em XOÁ được
--   4. Quá 1 ngày · em KHÔNG sửa được nữa
--   5. Quá 1 ngày · em KHÔNG xoá được nữa
--   6. Quá 1 ngày · CÔ vẫn xoá được (cửa sổ chỉ ràng buộc em, không ràng buộc người lớn)
--
--   npm run sql -- scripts/test-cua-so-mot-ngay.sql

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_em uuid; v_lop uuid; v_gv uuid; v_wig uuid; v_viec uuid; n int;
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

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_wig, 'việc thử', 3, 'lần', array[1,3,5], 1) returning id into v_viec;

  -- ── CÒN TRONG CỬA SỔ ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  update wigs set title = 'em sửa lại' where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Vừa tạo · em SỬA mục tiêu', '1 dòng', n || ' dòng', n = 1);

  perform set_config('role', 'authenticated', true);
  update lead_measures set title = 'em sửa việc' where id = v_viec;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Vừa tạo · em sửa VIỆC treo dưới', '1 dòng', n || ' dòng', n = 1);

  perform set_config('role', 'authenticated', true);
  delete from wigs where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Vừa tạo · em XOÁ mục tiêu', '1 dòng', n || ' dòng', n = 1);

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

  perform set_config('role', 'authenticated', true);
  update wigs set title = 'em cố sửa' where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Quá 1 ngày · em KHÔNG sửa được', '0 dòng', n || ' dòng', n = 0);

  perform set_config('role', 'authenticated', true);
  delete from wigs where id = v_wig;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Quá 1 ngày · em KHÔNG xoá được', '0 dòng', n || ' dòng', n = 0);

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
