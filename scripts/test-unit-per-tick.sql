-- Hệ số "mỗi lần tick đáng bao nhiêu" có thật sự nhân vào tiến độ không (0076).
--
-- Phép kiểm bằng .mjs chỉ đối chiếu được với dữ liệu ĐANG CÓ, mà hôm nay mọi việc đều để hệ số 1
-- — tức nó mới chứng minh "nhân 1 thì không đổi gì". Chuyện đáng lo là nhân KHÁC 1: nếu công thức
-- bỏ qua cột ấy thì mọi con số vẫn trông bình thường cho tới ngày có người khai 30, rồi tiến độ
-- lặng lẽ sai.
--
-- Chạy trong MỘT giao dịch rồi ROLLBACK: dựng dữ liệu giả, đo, và không để lại dấu vết nào trên
-- production. Đó là lý do phép kiểm này viết bằng SQL chứ không bằng .mjs — PostgREST không giữ
-- được giao dịch qua nhiều lượt gọi.
--
--   npm run sql -- scripts/test-unit-per-tick.sql

begin;

-- Tắt trigger/RLS không liên quan bằng cách chạy với quyền chủ sở hữu (run-sql.mjs nối bằng
-- postgres). Dữ liệu dựng ra đều mang tiền tố 'ZZ_TEST' để nếu có sót cũng nhận ra ngay.
create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

do $$
declare
  v_campus uuid;
  v_class  uuid;
  v_year   uuid;
  v_week   uuid;
  v_lead   uuid;
  v_stu    uuid;
  v_actual numeric;
begin
  -- Mượn một lớp và một học sinh có sẵn để không phải dựng cả cây quan hệ.
  select c.id, c.campus_id into v_class, v_campus from classes c limit 1;
  select e.student_id into v_stu from enrollments e where e.class_id = v_class and e.is_active limit 1;
  if v_stu is null then
    select id into v_stu from profiles where role = 'student' limit 1;
  end if;

  -- WIG năm (đơn vị PHÚT) → WIG tuần (PHÚT) → lead đo bằng TỐI, mỗi tối đáng 30 phút.
  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date)
  values (v_class, 'class', 'ZZ_TEST năm', 'knowledge', 'year', 'ZZ2026', 600, 'phút',
          '2026-01-01', '2026-12-31')
  returning id into v_year;

  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date, parent_wig_id)
  values (v_class, 'class', 'ZZ_TEST tuần', 'knowledge', 'week', 'ZZW01', 150, 'phút',
          '2026-03-02', '2026-03-08', v_year)
  returning id into v_week;

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_week, 'ZZ_TEST đọc 30 phút mỗi tối', 150, 'phút', '{1,2,3,4,5}', 30)
  returning id into v_lead;

  -- Ba tối trong tuần đó (T2, T3, T4 của 02–08/03/2026).
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_stu, 1, '2026-03-02', v_stu),
         (v_lead, v_stu, 1, '2026-03-03', v_stu),
         (v_lead, v_stu, 1, '2026-03-04', v_stu);

  -- ── 1. Tiến độ WIG TUẦN = 3 tick × 30 = 90 phút (không phải 3) ──
  v_actual := private.wig_actual(v_week);
  insert into ket_qua values
    ('Tiến độ WIG tuần nhân hệ số 30', '90', v_actual::text, v_actual = 90);

  -- ── 2. Tiến độ WIG NĂM cũng phải là 90, vì nó cộng đệ quy qua WIG tuần ──
  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('Tiến độ WIG năm cộng đệ quy đúng đơn vị', '90', v_actual::text, v_actual = 90);

  -- ── 3. Cảnh báo: 150 phút ÷ 30 = 5 lần tick, tuần có 5 ngày T2–T6 → vừa vặn, KHÔNG cảnh báo ──
  insert into ket_qua
  select 'Khai đúng hệ số thì không cảnh báo',
         '5 tick / 5 ngày, không báo',
         c.so_tick_can || ' tick / ' || c.so_ngay_tick_duoc || ' ngày, qua_nhieu=' || c.qua_nhieu
           || ', lech=' || c.lech_don_vi,
         c.so_tick_can = 5 and c.so_ngay_tick_duoc = 5 and not c.qua_nhieu and not c.lech_don_vi
  from lead_measure_canh_bao(v_week) c where c.lead_measure_id = v_lead;

  -- ── 4. Bỏ hệ số về 1 → 150 tick trong 5 ngày: phải kêu "quá nhiều" VÀ "lệch đơn vị" ──
  -- (lệch vì lead đo 'phút' còn WIG cũng 'phút'… nên đổi đơn vị lead để dựng đúng tình huống 7B1)
  update lead_measures set unit_per_tick = 1, unit = 'tối' where id = v_lead;
  insert into ket_qua
  select 'Để hệ số 1 mà lệch đơn vị thì kêu cả hai',
         'qua_nhieu=t, lech_don_vi=t',
         'qua_nhieu=' || c.qua_nhieu || ', lech_don_vi=' || c.lech_don_vi,
         c.qua_nhieu and c.lech_don_vi
  from lead_measure_canh_bao(v_week) c where c.lead_measure_id = v_lead;

  -- ── 5. Và lúc đó tiến độ tụt về 3 — đúng con số vô nghĩa mà 7B1 đang chịu ──
  v_actual := private.wig_actual(v_week);
  insert into ket_qua values
    ('Hệ số 1 thì 3 tối thành 3 phút (bằng chứng lỗi cũ)', '3', v_actual::text, v_actual = 3);

  -- ── 6. CHECK chặn hệ số ≤ 0 ──
  begin
    update lead_measures set unit_per_tick = 0 where id = v_lead;
    insert into ket_qua values ('CHECK chặn hệ số 0', 'bị chặn', 'LỌT', false);
  exception when check_violation then
    insert into ket_qua values ('CHECK chặn hệ số 0', 'bị chặn', 'bị chặn', true);
  end;
end $$;

-- ── 6b. ceil của CSDL với hệ số kiểu 0.7 ──
--
-- Rà soát đối kháng bắt được: JavaScript tính 21/0.7 ra 30.000000000000004 (số thực nhị phân) nên
-- Math.ceil cho 31, còn Postgres tính numeric chính xác nên cho 30. Lệch một đơn vị ấy đủ để trang
-- bật cảnh báo đỏ "không ai đạt nổi" trên một mục tiêu đặt vừa khít.
--
-- Phía JS đã làm tròn 9 chữ số trước khi ceil. Dòng dưới ghim CON SỐ CỦA CSDL làm mốc: nếu ai đó
-- đổi cách tính bên đó, phép so JS↔SQL trong test-moi-lan-tick.mjs sẽ đỏ và đây là chỗ giải thích.
insert into ket_qua
select 'ceil(21/0.7) trong CSDL là 30, không phải 31',
       '30', ceil(21::numeric / 0.7::numeric)::text,
       ceil(21::numeric / 0.7::numeric) = 30;

-- ── 7. CHỐT CHẶN: không hàm/view nào được cộng lead_progress mà quên nhân hệ số ──
--
-- Đây là phép kiểm đáng giá nhất trong file. Khi thêm unit_per_tick (0076) tôi đã dạy hai chỗ đọc
-- nó rồi tưởng xong — rà lại mới thấy còn BA hàm khác (child_week_report, class_scoreboard,
-- school_wig_rollup) vẫn cộng tick trần, phải vá tiếp bằng 0077. Chưa ai đặt hệ số khác 1 nên
-- chưa lệch, nhưng ngày đầu tiên có người khai 30 thì thanh tiến độ hiện 90 còn bảng BGH hiện 3.
--
-- Soi ĐỊNH NGHĨA hàm trong chính CSDL chứ không soi mã nguồn: thứ đang chạy trên production mới
-- là thứ quyết định, và migration có thể áp thiếu. Ai thêm hàm mới cộng tick mà quên hệ số sẽ
-- thấy phép kiểm này đỏ ngay, kèm tên hàm.
insert into ket_qua
select
  'Không hàm/view nào cộng tick mà quên hệ số',
  'không có',
  coalesce(string_agg(ten, ', '), 'không có'),
  count(*) = 0
from (
  select n.nspname || '.' || p.proname as ten
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f'
    and pg_get_functiondef(p.oid) like '%lead_progress%'
    and pg_get_functiondef(p.oid) like '%sum(%'
    and pg_get_functiondef(p.oid) not like '%unit_per_tick%'
  union all
  select 'VIEW ' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and pg_get_viewdef(c.oid) like '%lead_progress%'
    and pg_get_viewdef(c.oid) like '%sum%'
    and pg_get_viewdef(c.oid) not like '%unit_per_tick%'
) t;

select buoc as "Bước", mong_doi as "Mong đợi", thuc_te as "Thực tế",
       case when dat then 'ĐẠT' else 'HỎNG' end as "Kết quả"
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as "Tổng",
       case when count(*) filter (where not dat) = 0 then 'TẤT CẢ ĐẠT' else 'CÓ LỖI' end as "Kết luận"
from ket_qua;

-- Không để lại gì trên production.
rollback;
