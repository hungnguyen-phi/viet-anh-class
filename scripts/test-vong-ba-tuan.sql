-- VÒNG TUẦN HOÀN QUAY QUA BA TUẦN — thứ chỉ lộ ra khi có nhiều hơn một tuần
--
--   npm run sql -- scripts/test-vong-ba-tuan.sql
--
-- Chủ dự án 16/08/2026: "tạo 3 tuần dữ liệu luôn đi, mà kiểm cho đầy đủ".
--
-- Mọi bộ kiểm trước đây đều đo MỘT tuần. Nhưng cả app này sinh ra để quay vòng, và những chỗ dễ
-- hỏng nhất nằm ĐÚNG Ở KHỚP NỐI giữa hai tuần — chỗ không bài nào chạm tới được khi CSDL chỉ có
-- một tuần dữ liệu:
--
--   A. Tuần đã chốt phải KHOÁ, tuần đang chạy phải MỞ. Lẫn hai cái là hoặc cả lớp mất quyền tick,
--      hoặc ai đó sửa được điểm của một tuần đã tổng kết xong.
--   B. Mục tiêu NĂM phải CỘNG DỒN cả ba tuần. Chỉ đếm tuần này thì con số của cả năm học tụt về 0
--      mỗi thứ Hai, và không ai nhìn thấy mình đang đi tới đâu.
--   C. Mỗi tuần có bảng PDR RIÊNG với con số riêng — không được lẫn sang tuần khác.
--   D. V/X của tuần cũ phải nằm yên khi tuần mới chạy.
--   E. Trần "2 cam kết · 2 việc" đếm THEO TỪNG TUẦN, không cộng dồn — nếu không thì sang tuần thứ
--      hai là không ai đặt được gì nữa.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop, c.homeroom_teacher_id as gvcn,
       vn_week_start(current_date) as t0,
       vn_week_start(current_date) - 7 as t1,
       vn_week_start(current_date) - 14 as t2,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em
from classes c where c.name = 'Test' and c.is_active limit 1;

-- ── TIỀN ĐỀ: ba tuần thật sự có dữ liệu ─────────────────────────────────────────────────────
-- Không có câu này thì mọi phép dưới đây xanh một cách rỗng tuếch — đúng cái bẫy đã ghi trong
-- trí nhớ dự án ("bộ kiểm xanh vì rỗng").
insert into kq
select 'Tiền đề · ba tuần đều có cam kết', '3 tuần',
       count(distinct ck.week_start)::text || ' tuần',
       count(distinct ck.week_start) = 3
from commitments ck, ai
where ck.class_id = ai.lop and ck.week_start in (ai.t0, ai.t1, ai.t2);

-- ── A. TUẦN CŨ KHOÁ, TUẦN NÀY MỞ ────────────────────────────────────────────────────────────
insert into kq
select 'Tuần T-2 đã chốt', 'chốt', case when tuan_da_chot(lop, null, t2) then 'chốt' else 'CHƯA' end,
       tuan_da_chot(lop, null, t2) from ai;

insert into kq
select 'Tuần T-1 đã chốt', 'chốt', case when tuan_da_chot(lop, null, t1) then 'chốt' else 'CHƯA' end,
       tuan_da_chot(lop, null, t1) from ai;

insert into kq
select 'Tuần NÀY còn mở', 'mở', case when tuan_da_chot(lop, null, t0) then 'ĐÃ CHỐT' else 'mở' end,
       not tuan_da_chot(lop, null, t0) from ai;

-- Và khoá ấy phải chặn được NGƯỜI THẬT, không chỉ là một lá cờ để đọc.
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_lm uuid; v_so int;
begin
  select lm.id into v_lm
  from lead_measures lm join commitments ck on ck.id = lm.commitment_id, ai
  where ck.class_id = ai.lop and ck.week_start = ai.t1 and ck.student_id = ai.em limit 1;
  if v_lm is null then
    insert into kq values ('Em KHÔNG tick được vào tuần đã chốt', 'bị chặn', 'không có việc để thử', false);
    return;
  end if;
  insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
  select v_lm, ai.em, ai.em, 1, ai.t1 + 1 from ai;
  insert into kq values ('Em KHÔNG tick được vào tuần đã chốt', 'bị chặn', 'LỌT', false);
exception when others then
  insert into kq values ('Em KHÔNG tick được vào tuần đã chốt', 'bị chặn', 'bị chặn', true);
end $$;

do $$
declare v_lm uuid; v_ngay date; v_xong boolean := false;
begin
  select lm.id into v_lm
  from lead_measures lm join commitments ck on ck.id = lm.commitment_id, ai
  where ck.class_id = ai.lop and ck.week_start = ai.t0 and ck.student_id = ai.em limit 1;
  if v_lm is null then
    insert into kq values ('Em VẪN tick được vào tuần đang chạy', '1 dòng', 'không có việc để thử', false);
    return;
  end if;

  -- DUYỆT TỪNG NGÀY VÀ BẮT LỖI, thay vì dựng một câu chọn ngày "hợp lệ" cho khéo. Ba luật cùng
  -- lúc gác ô này — đúng thứ (0136), không quá hôm nay, chưa tick ngày ấy — và chép lại cả ba
  -- trong bộ kiểm là dựng nguồn sự thật thứ hai để rồi lệch. Cứ thử; ngày nào máy chủ nhận là
  -- ngày ấy hợp lệ.
  for v_ngay in select (ai.t0 + i)::date from ai, generate_series(0, 6) i
  loop
    begin
      insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
      select v_lm, ai.em, ai.em, 1, v_ngay from ai;
      v_xong := true;
      exit;
    exception when others then
      null;
    end;
  end loop;

  insert into kq values ('Em VẪN tick được vào tuần đang chạy', 'được',
    case when v_xong then 'được' else 'KHÔNG ngày nào nhận' end, v_xong);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ── B. MỤC TIÊU NĂM CỘNG DỒN CẢ BA TUẦN ─────────────────────────────────────────────────────
-- Đây là mắt xích nối vòng tuần hoàn với đích của cả năm. Đếm sót một tuần thì con số năm tụt
-- mỗi thứ Hai và cả cái bảng thành tích mất nghĩa.
insert into kq
select 'Tiến độ mục tiêu NĂM cộng cả ba tuần', 'đúng tổng',
       format('năm=%s · ba tuần=%s', coalesce(v.actual, 0), coalesce(t.tong, 0)),
       coalesce(v.actual, 0) = coalesce(t.tong, 0)
from ai
join wigs w on w.class_id = ai.lop and w.scope = 'class' and w.period = 'year'
           and w.area = 'knowledge' and w.measure_by <> 'cuon'
left join wig_progress_v v on v.wig_id = w.id
left join lateral (
  select sum(lp.value * lm.unit_per_tick) as tong
  from lead_progress lp
  join lead_measures lm on lm.id = lp.lead_measure_id
  join commitments ck on ck.id = lm.commitment_id
  where ck.wig_id = w.id
) t on true;

-- ── C. MỖI TUẦN MỘT BẢNG PDR RIÊNG ──────────────────────────────────────────────────────────
-- HỎI BẰNG PHIÊN CỦA CÔ. pdr_bang lọc theo danh tính người gọi; gọi bằng quyền postgres (không
-- JWT) thì nó trả RỖNG, và bài kiểm sẽ tưởng bảng của cô mất sạch dữ liệu tuần cũ. Đã sập đúng
-- bẫy này một lần khi đo tay hôm nay.
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);
insert into kq
select 'Bảng PDR tuần T-1 có đủ dòng của từng em', 'đủ sĩ số',
       (select count(*) from pdr_bang((select lop from ai), (select t1 from ai)))::text || ' dòng',
       (select count(*) from pdr_bang((select lop from ai), (select t1 from ai)))
         = (select count(*) from enrollments e, ai
            where e.class_id = ai.lop and e.is_active);

insert into kq
select 'Bảng PDR ba tuần KHÁC nhau (không lẫn số)', 'khác nhau',
       format('T-2=%s · T-1=%s · T0=%s', a.s, b.s, c.s),
       not (a.s = b.s and b.s = c.s)
from ai,
lateral (select sum(viec_dat) as s from pdr_bang(ai.lop, ai.t2)) a,
lateral (select sum(viec_dat) as s from pdr_bang(ai.lop, ai.t1)) b,
lateral (select sum(viec_dat) as s from pdr_bang(ai.lop, ai.t0)) c;

reset role;
select set_config('request.jwt.claims', '', true);

-- ── D. V/X CỦA TUẦN CŨ NẰM YÊN ──────────────────────────────────────────────────────────────
insert into kq
select 'Hai tuần đã họp đều đã chấm V/X', 'không còn cái nào chưa chấm',
       count(*) filter (where ck.verdict is null)::text || ' chưa chấm',
       count(*) filter (where ck.verdict is null) = 0
from commitments ck, ai
where ck.class_id = ai.lop and ck.week_start in (ai.t1, ai.t2);

insert into kq
select 'Tuần đang chạy CHƯA chấm V/X', 'chưa chấm',
       count(*) filter (where ck.verdict is not null)::text || ' đã chấm',
       count(*) filter (where ck.verdict is not null) = 0
from commitments ck, ai
where ck.class_id = ai.lop and ck.week_start = ai.t0;

-- ── E. TRẦN ĐẾM THEO TỪNG TUẦN, KHÔNG CỘNG DỒN ──────────────────────────────────────────────
-- Nếu trần cộng dồn qua các tuần thì sang tuần thứ hai là không ai đặt được gì nữa — cả app đứng.
insert into kq
select 'Trần 2 cam kết đếm theo TỪNG tuần', 'mỗi tuần ≤ 2 mỗi người',
       max(so)::text || ' là nhiều nhất',
       max(so) <= 2
from (
  select count(*) as so
  from commitments ck, ai
  where ck.class_id = ai.lop and ck.week_start in (ai.t0, ai.t1, ai.t2)
  group by ck.week_start, ck.student_id
) x;

insert into kq
select 'Trần 2 việc đếm theo TỪNG tuần', 'mỗi tuần ≤ 2 mỗi người',
       max(so)::text || ' là nhiều nhất',
       max(so) <= 2
from (
  select count(lm.id) as so
  from lead_measures lm
  join commitments ck on ck.id = lm.commitment_id, ai
  where ck.class_id = ai.lop and ck.week_start in (ai.t0, ai.t1, ai.t2)
  group by ck.week_start, ck.student_id
) x;

-- ── F. KHÔNG CÓ LƯỢT TICK NÀO VÔ NGHĨA ──────────────────────────────────────────────────────
-- Đúng cái mà lần gieo trước đã để lọt và chủ dự án bắt được.
insert into kq
select 'Không lượt tick nào rơi vào thứ việc không áp dụng', '0',
       count(*)::text,
       count(*) = 0
from lead_progress lp
join lead_measures lm on lm.id = lp.lead_measure_id
join commitments ck on ck.id = lm.commitment_id, ai
where ck.class_id = ai.lop
  and lm.active_weekdays is not null
  and not (extract(isodow from lp.logged_date)::smallint = any(lm.active_weekdays));

insert into kq
select 'Không lượt tick nào rơi ngoài tuần của cam kết', '0',
       count(*)::text,
       count(*) = 0
from lead_progress lp
join lead_measures lm on lm.id = lp.lead_measure_id
join commitments ck on ck.id = lm.commitment_id, ai
where ck.class_id = ai.lop
  and (lp.logged_date < ck.week_start or lp.logged_date > ck.week_start + 6);

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from kq;

rollback;
