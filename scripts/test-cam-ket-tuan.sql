-- CAM KẾT TUẦN — LUẬT CỦA MÔ HÌNH MỘT TẦNG (14/08/2026)
--
-- Chủ dự án chốt: WIG chỉ còn cấp NĂM; mỗi tuần là CAM KẾT, tối đa 2; tick thôi chấm thắng/thua,
-- V hoặc X là do người bấm trong phòng họp, máy chỉ gợi ý.
--
-- Phép kiểm này dựng đúng các ranh ấy trên lớp Test thật rồi hỏi lại máy. Chỗ đáng tiền nhất là
-- mấy cái CHẶN: một luật "tối đa 2" mà chỉ nằm trong giao diện thì nó không phải luật, nó là một
-- lời đề nghị — mở tab thứ hai là lách được.
--
-- Chạy thẳng trên production, kết thúc bằng ROLLBACK nên không để lại gì. Tuần dùng để thử đặt ở
-- 2030 để không đụng buổi họp nào có thật.
--
--   npm run sql -- scripts/test-cam-ket-tuan.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create temporary table boi_canh as
select c.id as lop,
       (select e.student_id from enrollments e where e.class_id = c.id and e.is_active
        order by e.student_id limit 1) as em,
       vn_week_start(date '2030-08-07') as tuan,
       date '2030-08-01' as tu, date '2031-05-31' as den
from classes c where c.name = 'Test' and c.is_active limit 1;

-- ── MỤC TIÊU NĂM: một của lớp, một của em ─────────────────────────────────────────────────
create temporary table wig_lop as
with them as (
  insert into wigs (class_id, scope, area, period, period_label, title, target_value, unit,
                    start_date, end_date, measure_by)
  select lop, 'class', 'knowledge', 'year', '2030-2031', 'KIỂM CAM KẾT · mục tiêu năm của lớp',
         100, 'bài', tu, den, 'tick'
  from boi_canh returning id
) select id from them;

create temporary table wig_em as
with them as (
  insert into wigs (class_id, student_id, scope, area, period, period_label, title, target_value,
                    unit, start_date, end_date, kind, set_by, measure_by, status)
  select lop, em, 'student', 'knowledge', 'year', '2030-2031', 'KIỂM CAM KẾT · mục tiêu năm của em',
         50, 'bài', tu, den, 'academic', 'student', 'tick', 'approved'
  from boi_canh returning id
) select id from them;

insert into ket_qua
select 'Dựng được mục tiêu năm cho cả lớp và em', 'có cả hai',
       (select count(*) from wig_lop) || ' + ' || (select count(*) from wig_em),
       (select count(*) from wig_lop) = 1 and (select count(*) from wig_em) = 1;

-- ── 1. KHÔNG CÒN TẠO ĐƯỢC WIG THÁNG / TUẦN ────────────────────────────────────────────────
do $$
declare v_ok boolean := false;
begin
  begin
    insert into wigs (class_id, scope, area, period, period_label, title, target_value, unit,
                      start_date, end_date, measure_by)
    select lop, 'class', 'knowledge', 'week', 'W32-2030', 'KIỂM · wig tuần không được phép',
           10, 'bài', tuan, tuan + 6, 'tick' from boi_canh;
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Không tạo được WIG tuần nữa', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 2. TỐI ĐA 2 CAM KẾT MỖI TUẦN CHO LỚP ──────────────────────────────────────────────────
create temporary table ck_lop as
with them as (
  insert into commitments (wig_id, class_id, week_start, title, area)
  select w.id, b.lop, b.tuan, 'KIỂM · cam kết lớp ' || i, 'knowledge'
  from wig_lop w, boi_canh b, generate_series(1, 2) i
  returning id
) select id from them;

insert into ket_qua
select 'Lớp đặt được 2 cam kết', '2', count(*)::text, count(*) = 2 from ck_lop;

do $$
declare v_ok boolean := false;
begin
  begin
    insert into commitments (wig_id, class_id, week_start, title, area)
    select w.id, b.lop, b.tuan, 'KIỂM · cam kết lớp thứ ba', 'knowledge'
    from wig_lop w, boi_canh b;
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Cam kết thứ BA của lớp bị chặn', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 3. TRẦN CỦA EM ĐẾM RIÊNG, KHÔNG DÍNH TRẦN CỦA LỚP ─────────────────────────────────────
create temporary table ck_em as
with them as (
  insert into commitments (wig_id, class_id, student_id, week_start, title, area)
  select w.id, b.lop, b.em, b.tuan, 'KIỂM · cam kết của em ' || i, 'knowledge'
  from wig_em w, boi_canh b, generate_series(1, 2) i
  returning id
) select id from them;

insert into ket_qua
select 'Lớp đã đủ 2 mà em vẫn đặt được 2 của mình', '2', count(*)::text, count(*) = 2 from ck_em;

-- ── 4. CAM KẾT PHẢI TREO ĐÚNG MỤC TIÊU ────────────────────────────────────────────────────
do $$
declare v_ok boolean := false;
begin
  begin
    -- Cam kết của LỚP mà treo dưới mục tiêu năm của MỘT EM.
    insert into commitments (wig_id, class_id, week_start, title, area)
    select w.id, b.lop, b.tuan, 'KIỂM · treo nhầm', 'knowledge' from wig_em w, boi_canh b;
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Cam kết lớp treo dưới mục tiêu của em thì bị chặn', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- Mục tiêu CUỘN không nhận cam kết: số của nó đếm ngược từ mục tiêu của từng em (0116).
do $$
declare v_cuon uuid; v_ok boolean := false;
begin
  insert into wigs (class_id, scope, area, period, period_label, title, target_value, unit,
                    start_date, end_date, measure_by, ty_le_can, so_dich_can)
  select lop, 'class', 'skills', 'year', '2030-2031', 'KIỂM · mục tiêu cuộn', 86, '%',
         tu, den, 'cuon', 86, 6 from boi_canh
  returning id into v_cuon;
  begin
    insert into commitments (wig_id, class_id, week_start, title, area)
    select v_cuon, lop, tuan, 'KIỂM · treo vào mục tiêu cuộn', 'skills' from boi_canh;
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Mục tiêu cuộn không nhận cam kết', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 5. VIỆC DẪN DẮT: MÁY SUY wig_id, VÀ TRẦN 10/TUẦN ──────────────────────────────────────
create temporary table viec1 as
with them as (
  insert into lead_measures (commitment_id, wig_id, title, target_value, unit, active_weekdays,
                             unit_per_tick)
  -- Cố tình gửi wig_id SAI (của em) để xem máy có đè lại bằng wig của cam kết không.
  select (select id from ck_lop limit 1), (select id from wig_em), 'KIỂM · việc 1', 3, 'bài',
         '{1,2,3,4,5}', 1
  returning id, wig_id
) select id, wig_id from them;

insert into ket_qua
select 'wig_id của việc do máy suy từ cam kết, không nhận của người', 'wig của lớp',
       case when v.wig_id = (select id from wig_lop) then 'wig của lớp' else 'nhận bừa' end,
       v.wig_id = (select id from wig_lop)
from viec1 v;

do $$
declare v_ok boolean := false;
begin
  -- Đã có 1 việc; thêm 1 nữa là chạm trần 2 (0137 — trần 10 của 0121 đã bỏ).
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  select (select id from ck_lop limit 1), 'KIỂM · việc thêm 2', 1, 'bài', '{1,2,3,4,5}', 1;
  begin
    insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
    select (select id from ck_lop limit 1), 'KIỂM · việc thứ ba', 1, 'bài', '{1,2,3,4,5}', 1;
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Việc thứ 3 cùng lúc bị chặn (0137)', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 6. MÁY GỢI Ý THẮNG/THUA ───────────────────────────────────────────────────────────────
-- Cam kết của em: một việc, đích 3 lượt. Chưa tick gì → gợi thua.
create temporary table viec_em as
with them as (
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  select (select id from ck_em limit 1), 'KIỂM · việc của em', 3, 'bài', '{1,2,3,4,5}', 1
  returning id
) select id from them;

insert into ket_qua
select 'Chưa tick gì → máy gợi THUA', 'lose', cam_ket_goi_y(id), cam_ket_goi_y(id) = 'lose'
from ck_em limit 1;

insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
select v.id, b.em, b.em, 1, b.tuan + i
from viec_em v, boi_canh b, generate_series(0, 2) i;

insert into ket_qua
select 'Tick đủ 3/3 → máy gợi THẮNG', 'win', cam_ket_goi_y(id), cam_ket_goi_y(id) = 'win'
from ck_em limit 1;

-- Nhưng máy chỉ GỢI Ý: chưa ai bấm thì cam kết vẫn chưa có V/X.
insert into ket_qua
select 'Gợi ý không tự thành kết quả — chưa bấm thì chưa có V/X', 'chưa chấm',
       coalesce(c.verdict, 'chưa chấm'), c.verdict is null
from commitments c where c.id in (select id from ck_em) limit 1;

-- ── 7. CHỐT TUẦN RỒI THÌ THÔI SỬA, NHƯNG VẪN CHẤM ĐƯỢC ────────────────────────────────────
insert into wig_meetings (class_id, week_start, week_label, chot_at)
select lop, tuan, 'W32-2030', now() from boi_canh;

do $$
declare v_ok boolean := false; v_cham boolean := false;
begin
  begin
    update commitments set title = 'KIỂM · đổi tên sau khi chốt' where id = (select id from ck_lop limit 1);
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Chốt họp rồi thì không đổi được cam kết', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);

  -- Chấm V/X CHÍNH LÀ việc làm trong buổi họp — không được tự khoá mình.
  update commitments set verdict = 'win', verdict_goi_y = 'lose', verdict_at = now()
  where id = (select id from ck_lop limit 1);
  select verdict = 'win' into v_cham from commitments where id = (select id from ck_lop limit 1);
  insert into ket_qua values ('Chốt rồi vẫn bấm được V/X', 'chấm được',
    case when v_cham then 'chấm được' else 'BỊ CHẶN OAN' end, v_cham);
end $$;

-- CAM KẾT CỦA EM CŨNG KHOÁ THEO DẤU CHỐT CỦA LỚP (0125).
--
-- Buổi họp WIG cuối tuần CHÍNH LÀ buổi PDR — chủ dự án nói thẳng 15/08/2026. Phần chung và phần
-- từng em nằm trong cùng một buổi, cùng một dấu chốt. Bản 0121 đi tìm dấu chốt RIÊNG của mỗi em,
-- mà đường ghi biên bản chưa từng đóng dấu ấy, nên cam kết của em không bao giờ khoá: họp xong,
-- chốt xong, em vẫn sửa được lời hứa của tuần vừa qua.
do $$
declare v_ok boolean := false;
begin
  begin
    update commitments set title = 'KIỂM · em đổi tên sau khi lớp đã chốt'
    where id = (select id from ck_em limit 1);
  exception when check_violation then v_ok := true;
  end;
  insert into ket_qua values ('Lớp chốt họp thì cam kết của EM cũng khoá', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- Người chấm khác máy thì phải nhìn thấy được — đây là nguồn của chỉ số "đã thay đổi".
insert into ket_qua
select 'Lưu được cả hai: máy gợi gì, người chọn gì', 'lose → win',
       coalesce(verdict_goi_y, '—') || ' → ' || coalesce(verdict, '—'),
       verdict_goi_y = 'lose' and verdict = 'win'
from commitments where id = (select id from ck_lop limit 1);

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
