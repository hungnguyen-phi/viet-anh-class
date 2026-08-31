-- NHẮC HỌP PDR: đúng người, đúng lúc, một lần (0159)
--
--   npm run sql -- scripts/test-nhac-pdr.sql
--
-- Tự rollback, không để lại gì. Cần migration 0159 đã chạy.
--
-- GHIM MỐC THỜI GIAN, không dùng "bây giờ": phép kiểm nào phụ thuộc lúc chạy thì sớm muộn cũng
-- có ngày báo sai mà không ai hiểu vì sao — bản đầu của tệp này đã dính đúng thế (chạy ngày 31,
-- mà lịch tháng chỉ nhận ngày 1–28, nên ba phép về lịch coach không dựng nổi cảnh). Nay mọi phép
-- gọi sinh_nhac_pdr_luc(<mốc ghim>), chạy ngày nào giờ nào cũng ra cùng kết quả.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

create table moc as select
  timestamptz '2026-09-16 08:00+07' as sang_hom_hop,     -- 08:00 ngày họp
  timestamptz '2026-09-15 19:30+07' as toi_hom_truoc,    -- 19:30 hôm trước
  timestamptz '2026-09-16 06:00+07' as truoc_khi_nhac,   -- 06:00 ngày họp, chưa tới 07:00
  date '2026-09-16' as ngay_hop;

-- Bốn em: ba em một nhóm buddy, em thứ tư đứng ngoài để kiểm "không nhắc người không dự".
create table ai as
select c.id as lop,
       c.homeroom_teacher_id as gvcn,
       (select array_agg(student_id order by student_id)
        from (select student_id from enrollments
              where class_id = c.id and is_active order by student_id limit 4) bon) as em
from classes c where c.name = 'Test' and c.is_active limit 1;

do $$
begin
  if (select array_length(em, 1) from ai) < 4 then
    raise exception 'Lớp Test cần ít nhất 4 em đang học';
  end if;
  if (select gvcn from ai) is null then
    raise exception 'Lớp Test chưa có GVCN — phép kiểm lịch coach cần người thứ hai';
  end if;
end $$;

-- Nhóm 3 em = BA cặp, và lịch treo lên cả ba (0146). Đây chính là chỗ dễ nhắc trùng ba lần.
create table cap as
with m as (
  insert into buddy_pairs (class_id, student_id, buddy_id, created_by)
  select lop, least(a, b), greatest(a, b), gvcn from (
    select lop, gvcn, em[1] a, em[2] b from ai
    union all select lop, gvcn, em[1], em[3] from ai
    union all select lop, gvcn, em[2], em[3] from ai
  ) x
  returning id
)
select id from m;

-- Lịch buddy: đúng thứ của ngày họp, 15:30, nhắc sáng hôm đó.
insert into pdr_schedules (class_id, buddy_pair_id, type, weekday, time_slot, nhac_khi, created_by)
select (select lop from ai), c.id, 'buddy',
       extract(isodow from (select ngay_hop from moc))::int + 1,
       time '15:30', 'sang_hom_do', (select gvcn from ai)
from cap c;

-- Lịch coach của em[1]: đúng ngày trong tháng của ngày họp, cũng nhắc sáng hôm đó.
insert into pdr_schedules (class_id, student_id, type, monthly_day, nhac_khi, created_by)
select lop, em[1], 'coach', extract(day from (select ngay_hop from moc))::int, 'sang_hom_do', gvcn
from ai;

-- ════ ① SÁNG HÔM HỌP — nhắc đúng người ══════════════════════════════════════════════════════
create table lan1 as select sinh_nhac_pdr_luc((select sang_hom_hop from moc)) as so;

do $$
declare v int;
begin
  -- Mỗi em trong nhóm ĐÚNG MỘT tin, dù cùng một buổi họp nằm trên ba dòng lịch.
  select count(*) into v from notifications
   where user_id = (select em[1] from ai) and title like 'Nhắc:%với bạn';
  insert into kq values ('Em 1 nhận tin họp với bạn', '1 tin', v || ' tin', v = 1);

  select count(*) into v from notifications
   where user_id = (select em[3] from ai) and title like 'Nhắc:%với bạn';
  insert into kq values ('Em 3 (nhóm 3 người) nhận tin', '1 tin', v || ' tin', v = 1);

  -- Em đứng ngoài nhóm: không nhắc. Nhắc cả lớp là làm hỏng cái chuông.
  select count(*) into v from notifications
   where user_id = (select em[4] from ai) and title like 'Nhắc:%';
  insert into kq values ('Em KHÔNG dự buổi nào', '0 tin', v || ' tin', v = 0);

  -- Buổi với thầy cô nhắc CẢ HAI người dự.
  select count(*) into v from notifications
   where user_id = (select em[1] from ai) and title like '%với thầy cô';
  insert into kq values ('Em 1 nhận tin họp với thầy cô', '1 tin', v || ' tin', v = 1);

  select count(*) into v from notifications
   where user_id = (select gvcn from ai) and title like 'Nhắc:%họp PDR với %';
  insert into kq values ('GVCN nhận tin buổi với em', '1 tin', v || ' tin', v = 1);

  -- Tin của thầy cô dẫn về danh sách lớp, tin của em dẫn về màn của em.
  select count(*) into v from notifications
   where user_id = (select gvcn from ai) and title like 'Nhắc:%' and link = '/roster';
  insert into kq values ('Tin của GVCN dẫn về /roster', '1 tin', v || ' tin', v = 1);

  select count(*) into v from notifications
   where user_id = (select em[2] from ai) and title like '%với bạn' and link = '/student';
  insert into kq values ('Tin của em dẫn về /student', '1 tin', v || ' tin', v = 1);

  -- Có giờ họp thì phải nói giờ, không thì người ta biết hôm nay mà không biết mấy giờ.
  select count(*) into v from notifications
   where user_id = (select em[2] from ai) and title like '%với bạn' and body = 'Lúc 15:30';
  insert into kq values ('Tin buddy kèm giờ họp', '1 tin', v || ' tin', v = 1);

  -- Chữ trên tin phải là chữ trẻ lớp 5 đọc hiểu ngay, không phải nhãn tuần.
  select count(*) into v from notifications
   where user_id = (select em[3] from ai) and title like 'Nhắc: hôm nay%';
  insert into kq values ('Chữ trên tin: "hôm nay"', '1 tin', v || ' tin', v = 1);
end $$;

-- ② Gọi lại: KHÔNG nhắc chồng. Hỏng chỗ này thì tới trưa cái chuông có 30 tin giống hệt.
update pdr_nhac_lan_chay set chay_luc = timestamptz '2026-09-01 00:00+07';
create table lan2 as select sinh_nhac_pdr_luc((select sang_hom_hop from moc)) as so;
do $$
begin
  insert into kq values ('Chạy lại cùng ngày', '0 tin mới',
                         (select so from lan2) || ' tin mới', (select so from lan2) = 0);
end $$;

-- ③ Chống chạy dày: vừa chạy xong mà gọi tiếp thì bỏ qua.
create table lan3 as select sinh_nhac_pdr_luc((select sang_hom_hop from moc)) as so;
do $$
begin
  insert into kq values ('Gọi lại ngay sau lần trước', '0 (bỏ qua)',
                         (select so from lan3)::text, (select so from lan3) = 0);
end $$;

-- ════ CHIỀU NGƯỢC — bỏ điều kiện đi thì phải THẤY nó sai ════════════════════════════════════
delete from notifications where title like 'Nhắc:%';
delete from pdr_nhac_da_gui;

-- ④ CHƯA TỚI GIỜ: 06:00 ngày họp, mà lịch đặt nhắc 07:00.
update pdr_nhac_lan_chay set chay_luc = timestamptz '2026-09-01 00:00+07';
create table lan4 as select sinh_nhac_pdr_luc((select truoc_khi_nhac from moc)) as so;
do $$
begin
  insert into kq values ('06:00 mà lịch nhắc 07:00', '0 tin',
                         (select so from lan4) || ' tin', (select so from lan4) = 0);
end $$;

-- ⑤ "Tối hôm trước" — mốc 19:30 ngày 15, buổi họp ngày 16. Đây là chỗ hàm ĐÃ TỪNG SAI: mốc nhắc
--    nằm ở kỳ trước buổi họp, chỉ tính kỳ hiện tại là không bao giờ nhắc nổi.
update pdr_schedules set nhac_khi = 'toi_hom_truoc'
 where class_id = (select lop from ai) and is_active;
update pdr_nhac_lan_chay set chay_luc = timestamptz '2026-09-01 00:00+07';
create table lan5 as select sinh_nhac_pdr_luc((select toi_hom_truoc from moc)) as so;
do $$
declare v int;
begin
  select count(*) into v from notifications
   where user_id = (select em[1] from ai) and title like 'Nhắc: ngày mai%';
  insert into kq values ('Tối hôm trước: tin nói "ngày mai"', '2 tin (bạn + thầy cô)',
                         v || ' tin', v = 2);
end $$;

-- ⑥ "Không nhắc" thì im hẳn.
delete from notifications where title like 'Nhắc:%';
delete from pdr_nhac_da_gui;
update pdr_schedules set nhac_khi = 'khong'
 where class_id = (select lop from ai) and is_active;
update pdr_nhac_lan_chay set chay_luc = timestamptz '2026-09-01 00:00+07';
create table lan6 as select sinh_nhac_pdr_luc((select sang_hom_hop from moc)) as so;
do $$
begin
  insert into kq values ('Lịch đặt "không nhắc"', '0 tin',
                         (select so from lan6) || ' tin', (select so from lan6) = 0);
end $$;

-- ⑦ Người dùng thường KHÔNG được gọi bản ghim mốc: đưa mốc tương lai vào tay ai cũng gọi được
--    là bơm được thông báo sớm cho cả lớp.
do $$
declare v boolean;
begin
  select has_function_privilege('authenticated', 'sinh_nhac_pdr_luc(timestamptz)', 'execute') into v;
  insert into kq values ('authenticated gọi được bản ghim mốc', 'không',
                         case when v then 'có' else 'không' end, not v);
  select has_function_privilege('authenticated', 'sinh_nhac_pdr()', 'execute') into v;
  insert into kq values ('authenticated gọi được bản thường', 'có',
                         case when v then 'có' else 'không' end, v);
end $$;

select buoc, mong_doi, thuc_te, case when dat then 'ĐẠT' else '*** SAI ***' end as ket from kq;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong from kq;

rollback;
