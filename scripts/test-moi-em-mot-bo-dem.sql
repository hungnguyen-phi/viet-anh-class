-- MỖI EM MỘT BỘ ĐẾM (0098) — mục tiêu của một việc là mục tiêu CỦA MỖI EM.
--
-- Lỗi được chủ dự án bắt tận tay: "acc claudia tick xong được 1/3, mà tôi vào acc alex, thì tick
-- xong lại thành 2/3". Tức là công của bạn hiện trên thẻ của mình, và lớp 30 em chỉ cần 3 lượt
-- tick của 3 em đầu là "thắng".
--
-- Bốn điều phải đúng, và phải đúng CÙNG LÚC ở cả ba hàm (wig_actual, class_lead_board,
-- school_wig_rollup) — sửa một chỗ quên hai chỗ kia thì màn học sinh nói một đằng, bảng thi đua
-- của hiệu trưởng nói một nẻo:
--   1. Em A tick, con số của em B KHÔNG nhúc nhích.
--   2. Một việc chỉ "xong" khi MỌI em đủ.
--   3. Một em tick gấp đôi KHÔNG gánh được phần bạn (chặn trần).
--   4. Cảnh báo "không ai đạt nổi" tính theo trần của MỘT em, không nhân sĩ số.
--
-- Chạy trong MỘT giao dịch rồi ROLLBACK — dựng dữ liệu giả, đo, không để lại dấu vết nào.
--
--   npm run sql -- scripts/test-moi-em-mot-bo-dem.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

do $$
declare
  v_class  uuid;
  v_year   uuid;
  v_ck     uuid;
  v_lead   uuid;
  v_a      uuid;
  v_b      uuid;
  v_actual numeric;
  v_my     numeric;
  v_done   bigint;
begin
  -- Một lớp có ÍT NHẤT HAI em — lỗi này chỉ lộ ra khi có từ hai em trở lên.
  select e.class_id into v_class
  from enrollments e where e.is_active
  group by e.class_id having count(*) >= 2 limit 1;

  if v_class is null then
    -- Không có lớp nào đủ hai em: mượn một lớp rồi ghi danh thêm cho đủ (vẫn rollback sau).
    select id into v_class from classes limit 1;
    insert into enrollments (class_id, student_id, is_active)
    select v_class, p.id, true from profiles p where p.role = 'student'
      and not exists (select 1 from enrollments e where e.class_id = v_class and e.student_id = p.id)
    limit 2;
  end if;

  select student_id into v_a from enrollments where class_id = v_class and is_active order by student_id limit 1;
  select student_id into v_b from enrollments where class_id = v_class and is_active order by student_id offset 1 limit 1;

  -- Cho lớp đúng HAI em để con số dễ đọc: 2 em × mục tiêu 3 bài.
  update enrollments set is_active = false
   where class_id = v_class and is_active and student_id not in (v_a, v_b);

  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date)
  values (v_class, 'class', 'ZZ_TEST năm', 'knowledge', 'year', 'ZZ2026', 30, 'bài',
          '2026-01-01', '2026-12-31')
  returning id into v_year;

  -- 0121: không còn WIG tuần. Nhịp tuần là CAM KẾT, và việc dẫn dắt treo dưới cam kết.
  insert into commitments (wig_id, class_id, week_start, title, area)
  values (v_year, v_class, date '2026-03-02', 'ZZ_TEST cam kết', 'knowledge')
  returning id into v_ck;

  -- "Làm bài tập về nhà — mỗi em 3 bài", tick được cả T2…T6.
  insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_ck, 'ZZ_TEST mỗi em 3 bài', 3, 'bài', '{1,2,3,4,5}', 1)
  returning id into v_lead;

  -- ── 1. EM A TICK MỘT LƯỢT ────────────────────────────────────────────────────────────────
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_a, 1, '2026-03-02', v_a);

  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select b.my_total, b.students_done into v_my, v_done
  from class_lead_board(v_class, '2026-03-02'::date) b where b.lead_measure_id = v_lead;
  insert into ket_qua values
    ('A tick 1 → màn của A ghi 1/3', '1', coalesce(v_my::text, 'NULL'), v_my = 1),
    ('… và chưa em nào đủ', '0', coalesce(v_done::text, 'NULL'), v_done = 0);

  -- ── 2. EM B TICK MỘT LƯỢT → MÀN CỦA A PHẢI ĐỨNG YÊN (đây là lỗi được báo) ────────────────
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_b, 1, '2026-03-02', v_b);

  select b.my_total into v_my
  from class_lead_board(v_class, '2026-03-02'::date) b where b.lead_measure_id = v_lead;
  insert into ket_qua values
    ('B tick → màn của A VẪN 1/3 (không phải 2/3)', '1', coalesce(v_my::text, 'NULL'), v_my = 1);

  -- ── 3. TIẾN ĐỘ WIG = TRUNG BÌNH MỨC ĐẠT: (1 + 1)/2 = 1 trên mục tiêu 3 ──────────────────
  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('Mỗi em 1 bài → tiến độ tuần = TỔNG hai em = 2', '2', v_actual::text, v_actual = 2);

  -- ⚠ CÁC CON SỐ DƯỚI ĐÂY ĐÃ ĐỔI Ở 0100 — và đổi là ĐÚNG, không phải phép kiểm hỏng.
  --
  -- 0098 (bản này) chốt: mục tiêu của một VIỆC là mục tiêu CỦA MỖI EM, và một em chăm không gánh
  -- được phần bạn. Điều đó vẫn nguyên. Cái đổi là bước cuối: 0098 cộng đóng góp các em rồi CHIA
  -- CHO SĨ SỐ, trong khi wigs.target_value là con số của CẢ LỚP — hai vế của phép chia không cùng
  -- thang, nên lớp thắng tuyệt đối vẫn hiện 12% và bảng thi đua toàn trường là một cột 0,0x%.
  --
  -- 0100 bỏ phép chia ấy. Từ nay tiến độ lớp = TỔNG đóng góp các em, cùng thang với mục tiêu.
  -- Với lớp thử 2 em, mục tiêu mỗi em 3: cả hai đủ → 6, đúng bằng "mỗi bạn 3 bài × 2 bạn".
  -- Xem docs/MO_HINH_WIG.md §5 và supabase/migrations/0100_moi_em_mot_khoang_cach.sql §4.

  -- ── 4. MỘT EM CHĂM KHÔNG GÁNH ĐƯỢC PHẦN BẠN ────────────────────────────────────────────
  -- A tick thêm 4 lượt nữa (tổng 5, vượt mục tiêu 3). Phần vượt phải bị chặn trần.
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_a, 1, '2026-03-03', v_a),
         (v_lead, v_a, 1, '2026-03-04', v_a),
         (v_lead, v_a, 1, '2026-03-05', v_a),
         (v_lead, v_a, 1, '2026-03-06', v_a);

  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('A làm 5 bài (chặn trần 3), B làm 1 → 3+1 = 4', '4', v_actual::text, v_actual = 4);

  select b.students_done into v_done
  from class_lead_board(v_class, '2026-03-02'::date) b where b.lead_measure_id = v_lead;
  insert into ket_qua values
    ('… và mới 1 em đủ', '1', coalesce(v_done::text, 'NULL'), v_done = 1);

  -- ── 5. CẢ HAI EM ĐỦ → ĐÚNG BẰNG MỤC TIÊU, LỚP THẮNG ────────────────────────────────────
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_b, 1, '2026-03-03', v_b),
         (v_lead, v_b, 1, '2026-03-04', v_b);

  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('Cả hai em đủ 3 → 3+3 = 6, bằng đúng mục tiêu lớp', '6', v_actual::text, v_actual = 6);

  select b.students_done into v_done
  from class_lead_board(v_class, '2026-03-02'::date) b where b.lead_measure_id = v_lead;
  insert into ket_qua values
    ('… và cả 2 em đều đủ', '2', coalesce(v_done::text, 'NULL'), v_done = 2);

  -- Không bao giờ vượt 100%: A còn tick thêm nữa cũng thế.
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_a, 1, '2026-03-09', v_a);
  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('Tick thêm ngoài tuần cũng không đẩy quá mục tiêu', '6', v_actual::text, v_actual = 6);

  -- ── 6. WIG NĂM CỘNG ĐỆ QUY QUA WIG TUẦN, cùng luật chặn trần ───────────────────────────
  v_actual := private.wig_actual(v_year);
  insert into ket_qua values
    ('WIG năm cộng đệ quy đúng luật mới', '6', v_actual::text, v_actual = 6);

  -- ── 7. CẢNH BÁO TÍNH THEO TRẦN CỦA MỘT EM ──────────────────────────────────────────────
  -- Mục tiêu 3 bài, tuần có 5 ngày tick được → vừa sức, KHÔNG cảnh báo.
  insert into ket_qua
  select 'Mục tiêu 3 trong 5 ngày: không cảnh báo',
         'qua_nhieu=f, tran=5',
         'qua_nhieu=' || c.qua_nhieu || ', tran=' || c.tran_luot_tick,
         not c.qua_nhieu and c.tran_luot_tick = 5
  from lead_measure_canh_bao(v_ck) c where c.lead_measure_id = v_lead;

  -- Nâng mục tiêu lên 8: một em nhiều nhất tick được 5 lượt → PHẢI cảnh báo, dù lớp có 2 em
  -- (bản cũ nhân sĩ số ra trần 10 nên im lặng — đúng chỗ báo động giả cần dẹp).
  update lead_measures set target_value = 8 where id = v_lead;
  insert into ket_qua
  select 'Mục tiêu 8 trong 5 ngày: phải cảnh báo dù lớp 2 em',
         'qua_nhieu=t',
         'qua_nhieu=' || c.qua_nhieu || ', tran=' || c.tran_luot_tick,
         c.qua_nhieu
  from lead_measure_canh_bao(v_ck) c where c.lead_measure_id = v_lead;
end $$;

-- ── 8. CHỐT CHẶN: ĐIỂM DANH MỌI HÀM ĐỌC lead_progress ─────────────────────────────────────
--
-- Phép kiểm đáng giá nhất trong file, và là bài học phải trả giá hai lần: 0076 thêm hệ số
-- "mỗi lần tick đáng bao nhiêu" rồi chỉ dạy cho hai hàm — ba hàm còn lại vẫn cộng tick trần, phải
-- vá tiếp bằng 0077. Đợt này đúng cái bẫy ấy: có tới sáu hàm đọc lead_progress.
--
-- Nên không dò bằng mẹo tìm chữ trong thân hàm (mẹo ấy vừa cho kết quả sai ngay lần chạy đầu),
-- mà ĐIỂM DANH bằng danh sách trắng. Ai thêm một hàm thứ bảy đọc bảng này thì dòng dưới đỏ, và
-- người thêm buộc phải trả lời: hàm của anh đếm theo TỪNG EM hay lại cộng dồn cả lớp?
--
-- Vì sao sáu hàm này được coi là đúng:
--   · private.wig_actual_so   — chặn trần theo em rồi chia sĩ số (chính là luật mới)
--
-- 14/08/2026 — hàm ấy vốn tên `wig_actual`; nay đổi tên, THÂN HÀM GIỮ NGUYÊN TỪNG CHỮ. Mục tiêu
-- cuộn (0116) không có lượt tick nào để cộng — số của nó đếm ngược từ mục tiêu năm của từng em —
-- nên private.wig_actual nay là lớp bọc mỏng: 'cuon' thì hỏi ty_le_cuon, còn lại gọi wig_actual_so.
-- Lớp bọc không đọc lead_progress, nên phần đọc thật vẫn đúng một hàm như trước.
--
-- 15/08/2026 — `pdr_bang` (0126) nhập danh sách: nó đếm "việc đạt" cho từng em ở Bảng PDR trong
-- phòng họp. Trả lời câu hỏi dòng điểm danh này đặt ra: nó đếm theo TỪNG EM, và dùng đúng luật
-- gộp của cam_ket_goi_y — nếu hai chỗ đếm khác nhau thì bảng sẽ cãi nhau với chính nút V/X ở trên.
--
-- 14/08/2026, đợt hai — `cam_ket_goi_y` (0121) nhập danh sách: nó đọc lượt tick để GỢI Ý thắng
-- hay thua cho một cam kết. Trả lời câu hỏi mà dòng điểm danh này đặt ra: nó đếm theo TỪNG EM khi
-- cam kết là của một em, và theo cả lớp khi cam kết là của lớp — cùng một luật với class_lead_board.
--
-- Cùng ngày, `gop_lead` (0113) bị bỏ hẳn — xem 0120. Nó nằm không từ lúc sinh ra và cộng tick mà
-- quên hệ số; chính dòng điểm danh này cùng test-unit-per-tick đã bắt được nó.
--   · class_lead_board        — trả my_total của em và students_done, không lấy tổng làm thước đo
--   · school_wig_rollup       — gọi thẳng private.wig_actual, không tự cộng nữa
--   · class_tick_matrix       — vốn trả mảng ngày tick của TỪNG em
--   · child_week_report       — chỉ đọc WIG cá nhân (một em), tổng chính là của em ấy
--   · class_scoreboard        — CỐ Ý cộng dồn: đây là bảng ĐIỂM tích luỹ theo hạng mục, không
--                               phải thước đo thắng/thua của một việc
insert into ket_qua
select 'Đúng 8 hàm đọc lead_progress, không hơn',
       'cam_ket_goi_y, child_week_report, class_lead_board, class_scoreboard, class_tick_matrix, pdr_bang, school_wig_rollup, wig_actual_so',
       string_agg(p.proname, ', ' order by p.proname),
       string_agg(p.proname, ', ' order by p.proname) =
         'cam_ket_goi_y, child_week_report, class_lead_board, class_scoreboard, class_tick_matrix, pdr_bang, school_wig_rollup, wig_actual_so'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%lead_progress%';

select
  case when dat then 'OK  ' else 'SAI ' end || ' ' || buoc
    || case when dat then '' else '  → mong ' || mong_doi || ', thực tế ' || thuc_te end as ket_qua
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket from ket_qua;

rollback;
