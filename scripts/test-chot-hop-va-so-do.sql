-- LƯU TẠM KHÔNG KHOÁ, CHỐT MỚI KHOÁ — và số đo tự nhập nghe đúng cái khoá ấy (0108).
--
--   npm run sql -- scripts/test-chot-hop-va-so-do.sql
--
-- Luật đang kiểm:
--   1. Chưa họp                    → tuần chưa khoá
--   2. LƯU TẠM (có biên bản, chưa chốt) → tuần VẪN chưa khoá  ← chính cái lỗ 0108 đi vá
--   3. Chưa chốt · CHÍNH EM ghi được số đo
--   4. Chưa chốt · CÔ cũng ghi được (sửa đè lên dòng của em, không đẻ dòng thứ hai)
--   5. Mục tiêu đếm bằng tick KHÔNG nhận số nhập tay
--   6. CHỐT                        → tuần khoá
--   7. Đã chốt · em KHÔNG ghi được số đo nữa
--   8. Gỡ chốt                     → mở lại (đường lùi của nút gỡ biên bản còn sống)
--   9. Em lớp khác KHÔNG đọc được số đo của em này
--
-- CHẠY DƯỚI DANH NGHĨA TỪNG NGƯỜI, không chạy bằng quyền postgres. Quyền postgres đi xuyên mọi
-- chính sách RLS, nên một bài kiểm chạy bằng nó sẽ xanh kể cả khi bảng mới quên bật RLS — mà đây
-- là bảng chứa cân nặng và điểm số của trẻ em.
--
-- TOÀN BỘ NẰM TRONG MỘT GIAO DỊCH VÀ ROLLBACK Ở CUỐI: bài này gieo biên bản thật vào CSDL
-- production; không rollback thì nó để lại một buổi họp ma khoá tick của cả một lớp.

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_em uuid; v_lop uuid; v_gv uuid; v_wig uuid; v_khac uuid;
  v_thu2 date := vn_week_start();
  n int; b boolean;
begin
  select e.student_id, e.class_id into v_em, v_lop
  from enrollments e join classes c on c.id = e.class_id
  where e.is_active and c.homeroom_teacher_id is not null limit 1;
  select homeroom_teacher_id into v_gv from classes where id = v_lop;
  -- Một em ở LỚP KHÁC, để thử vế "người ngoài không đọc được".
  select e.student_id into v_khac
  from enrollments e where e.is_active and e.class_id <> v_lop limit 1;

  if v_em is null then
    insert into kq values ('Có em để thử', 'có', 'KHÔNG CÓ em nào đang học', false);
    return;
  end if;

  -- Mục tiêu đo NGOÀI app — đúng loại mà ô số đo sinh ra để phục vụ.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by, area,
                    period, period_label, title, baseline, target_value, unit, start_date, end_date)
  values (v_lop, v_em, 'student', 'personal', 'approved', 'student', 'manual', 'physical',
          'year', 'TEST-0108', 'thử số đo tự nhập', 30, 34, 'kg',
          vn_today() - 30, vn_today() + 300)
  returning id into v_wig;

  -- ① CHƯA HỌP
  insert into kq values ('Chưa họp · tuần chưa khoá', 'false',
    tuan_da_hop(v_lop, v_thu2)::text, tuan_da_hop(v_lop, v_thu2) = false);

  -- ② LƯU TẠM — có biên bản nhưng chot_at còn null
  insert into wig_meetings (class_id, week_label, week_start, results)
  values (v_lop, 'TEST-0108', v_thu2, 'ghi giữa chừng buổi họp');
  insert into kq values ('LƯU TẠM · tuần VẪN chưa khoá', 'false',
    tuan_da_hop(v_lop, v_thu2)::text, tuan_da_hop(v_lop, v_thu2) = false);

  -- ③ CHÍNH EM ghi số đo, qua RLS thật
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into wig_so_do (wig_id, week_start, gia_tri, nguoi_nhap, vai_tro)
  values (v_wig, v_thu2, 32.5, v_em, 'student');
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Chưa chốt · EM ghi được số đo', '1 dòng', n || ' dòng', n = 1);

  -- ④ CÔ ghi đè — mỗi kỳ đúng một dòng, không đẻ dòng thứ hai
  perform set_config('request.jwt.claims', json_build_object('sub', v_gv, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update wig_so_do set gia_tri = 33, nguoi_nhap = v_gv, vai_tro = 'teacher'
  where wig_id = v_wig and week_start = v_thu2;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  select count(*) into n from wig_so_do where wig_id = v_wig;
  insert into kq values ('Chưa chốt · CÔ sửa đè, vẫn 1 dòng', '1 dòng', n || ' dòng', n = 1);

  -- ⑤ Mục tiêu đếm bằng tick không nhận số nhập tay
  update wigs set measure_by = 'tick' where id = v_wig;
  begin
    update wig_so_do set gia_tri = 99 where wig_id = v_wig;
    insert into kq values ('Mục tiêu tick · chặn nhập số tay', 'bị chặn', 'GHI ĐƯỢC', false);
  exception when check_violation then
    insert into kq values ('Mục tiêu tick · chặn nhập số tay', 'bị chặn', 'bị chặn', true);
  end;
  update wigs set measure_by = 'manual' where id = v_wig;

  -- ⑥ CHỐT
  update wig_meetings set chot_at = now(), chot_by = v_gv
  where class_id = v_lop and student_id is null and week_start = v_thu2;
  insert into kq values ('CHỐT · tuần đã khoá', 'true',
    tuan_da_hop(v_lop, v_thu2)::text, tuan_da_hop(v_lop, v_thu2) = true);

  -- ⑦ Đã chốt · em hết ghi được. RLS phải chặn, không phải màn hình chặn.
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update wig_so_do set gia_tri = 40 where wig_id = v_wig and week_start = v_thu2;
  get diagnostics n = row_count;
  perform set_config('role', 'postgres', true);
  insert into kq values ('Đã chốt · em KHÔNG sửa được số đo', '0 dòng', n || ' dòng', n = 0);

  -- ⑧ Gỡ chốt → mở lại
  update wig_meetings set chot_at = null
  where class_id = v_lop and student_id is null and week_start = v_thu2;
  insert into kq values ('Gỡ chốt · tuần mở lại', 'false',
    tuan_da_hop(v_lop, v_thu2)::text, tuan_da_hop(v_lop, v_thu2) = false);

  -- ⑨ Em lớp khác không đọc được. Cân nặng của một đứa trẻ không phải chuyện của cả trường.
  if v_khac is null then
    insert into kq values ('Em lớp khác không đọc được', 'bỏ qua', 'không có em lớp khác', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_khac, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from wig_so_do where wig_id = v_wig;
    perform set_config('role', 'postgres', true);
    insert into kq values ('Em lớp khác KHÔNG đọc được số đo', '0 dòng', n || ' dòng', n = 0);
  end if;

exception when others then
  perform set_config('role', 'postgres', true);
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;

select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

-- KHÔNG BỎ DÒNG NÀY. Mọi thứ trên là dữ liệu gieo vào CSDL thật.
rollback;
