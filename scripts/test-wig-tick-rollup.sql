-- Kiểm: THẮNG/THUA của WIG LỚP đến từ TICK THẬT của học sinh (migration 0073).
--
-- Câu hỏi then chốt: một WIG tuần của lớp có thể "thắng" mà KHÔNG em nào tick không?
-- Trước 0073 thì có — giáo viên bấm "Ghi +" vài lần là đủ, và đo trên production ngày 2026-08-02
-- thì 27/27 dòng tiến độ của WIG lớp đều do giáo viên gõ, không dòng nào của học sinh. Nên lớp
-- nào cũng thắng. Bộ kiểm này dựng đúng tình huống ấy rồi bắt hệ thống trả lời.
--
-- Phép kiểm được viết theo chiều KHÓ: mỗi ca "được phép" đều có một ca "phải bị chặn" đi kèm.
-- Nếu chỉ kiểm chiều thuận thì một chính sách RLS mở toang cũng đạt hết.
--
--   node scripts/run-sql.mjs scripts/test-wig-tick-rollup.sql
--
-- Chạy trong transaction rồi ROLLBACK — không để lại gì trên production.
begin;

create temp table kq (nhom text, buoc text, ky_vong text, thuc_te text, dat text) on commit drop;

do $$
declare
  qtv   uuid := 'dc00a3e7-e7a9-4175-9b37-6dda75a99bc0'; -- quản trị viên
  bgh   uuid := '074f1e2e-e7bd-4401-ac03-291b02b37c62'; -- hiệu trưởng ĐÚNG cơ sở của 7B1
  bgh2  uuid := 'ffb3b830-22e5-4a09-b88a-7efdaaa24987'; -- hiệu trưởng cơ sở KHÁC
  gvcn  uuid := '22ec9392-46c6-420a-bae4-d890bd09d54f'; -- GVCN 7B1
  gvla  uuid := '26f6e5b6-dabd-4f64-8fe1-1a1ffc4da4dd'; -- GVCN 6A2, không dạy 7B1
  hs1   uuid := 'f10395c6-9975-4292-a7d8-778a7c72c478'; -- 7B1
  hs2   uuid := '9015d780-587c-4ef9-8dfa-2b2cc2fcde8d'; -- 7B1
  hs3   uuid := '2257d290-000e-4757-bf4e-45f34568b638'; -- 7B1, cố tình KHÔNG tick
  hsla  uuid := '1b7e8f60-0c4e-4361-bf20-b3dd591b2f39'; -- 6A2 (lớp khác)
  lop   uuid := '79589c03-6bb0-462c-96de-5445e32d72bf'; -- 7B1
  w_nam uuid; w_tuan uuid; lm_ok uuid; lm_sai_thu uuid;
  t2      date := vn_week_start();
  homnay  date := vn_today();
  dow_nay smallint := extract(isodow from vn_today())::smallint;
  thu_khac smallint[];
  n int; v numeric; b boolean;
begin
  -- Mọi thứ trong khối này chạy quyền postgres (bỏ qua RLS) — đó là chủ ý: dựng bối cảnh.
  -- Chỉ khi ĐÓNG VAI mới bật role 'authenticated' để RLS thật sự có hiệu lực.

  -- Chốt cửa sổ tick còn mở, để phép kiểm không phụ thuộc vào hôm chạy là thứ mấy.
  update classes set tick_lock_dow = 7 where id = lop;

  -- Mọi thứ trong tuần TRỪ hôm nay — dùng cho ca "tick vào thứ mà việc không áp dụng".
  select coalesce(array_agg(d::smallint), '{}') into thu_khac
  from generate_series(1, 7) d where d <> dow_nay;

  insert into wigs (class_id, scope, area, period, period_label, target_value, unit,
                    start_date, end_date, title)
  values (lop, 'class', 'knowledge', 'year', 'KT-0073', 999, 'lượt',
          t2 - 200, t2 + 200, '[KIỂM 0073] WIG năm')
  returning id into w_nam;

  -- WIG TUẦN của lớp: mục tiêu TUYỆT ĐỐI 2 lượt (không phải %, đúng như đã chốt).
  insert into wigs (class_id, scope, area, period, period_label, parent_wig_id, target_value, unit,
                    start_date, end_date, title)
  values (lop, 'class', 'knowledge', 'week', 'KT-0073-W', w_nam, 2, 'lượt',
          t2, t2 + 6, '[KIỂM 0073] WIG tuần của lớp')
  returning id into w_tuan;

  -- Việc CHUNG áp dụng ĐÚNG hôm nay.
  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays)
  values (w_tuan, '[KIỂM] Nộp bài tập', 2, 'lượt', array[dow_nay])
  returning id into lm_ok;

  -- Việc CHUNG KHÔNG áp dụng hôm nay.
  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays)
  values (w_tuan, '[KIỂM] Việc của thứ khác', 2, 'lượt', thu_khac)
  returning id into lm_sai_thu;

  -- ══════════════════════════════════════════════════════
  -- A · CHƯA AI TICK THÌ CHƯA THẮNG
  -- ══════════════════════════════════════════════════════
  select pct into v from wig_progress_v where wig_id = w_tuan;
  insert into kq values ('A · NGUỒN SỐ LIỆU', 'Chưa em nào tick → WIG tuần của lớp', '0% (chưa thắng)',
    round(coalesce(v,0) * 100) || '%', case when coalesce(v,0) = 0 then 'ĐẠT' else '✘ HỎNG' end);

  -- ══════════════════════════════════════════════════════
  -- B · HỌC SINH TICK → CON SỐ CỦA LỚP TỰ CỘNG LÊN
  -- ══════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', hs1)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_ok, hs1, hs1, 1, homnay);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('B · TICK', 'Học sinh tick vào việc CHUNG của lớp', 'được',
    case when b then 'được' else 'BỊ CHẶN' end, case when b then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', hs2)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_ok, hs2, hs2, 1, homnay);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('B · TICK', 'Em thứ hai tick', 'được',
    case when b then 'được' else 'BỊ CHẶN' end, case when b then 'ĐẠT' else '✘ HỎNG' end);

  select pct into v from wig_progress_v where wig_id = w_tuan;
  insert into kq values ('B · TICK', 'Hai lượt tick / mục tiêu 2 → WIG tuần của lớp', '100% (THẮNG)',
    round(coalesce(v,0) * 100) || '%', case when coalesce(v,0) >= 1 then 'ĐẠT' else '✘ HỎNG' end);

  -- WIG NĂM phải cộng dồn theo cây (năm ← tuần), đúng như wig_actual() vẫn làm.
  select actual into v from wig_progress_v where wig_id = w_nam;
  insert into kq values ('B · TICK', 'WIG năm cộng dồn từ WIG tuần con', '2',
    coalesce(v,0)::text, case when coalesce(v,0) = 2 then 'ĐẠT' else '✘ HỎNG' end);

  -- ══════════════════════════════════════════════════════
  -- C · NHỮNG NGÕ PHẢI BỊ CHẶN
  -- ══════════════════════════════════════════════════════
  -- Thứ mà việc đó không áp dụng (cấu hình active_weekdays của GVCN).
  perform set_config('request.jwt.claims', json_build_object('sub', hs1)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_sai_thu, hs1, hs1, 1, homnay);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('C · CHẶN', 'Tick vào việc KHÔNG áp dụng hôm nay', 'bị chặn',
    case when b then 'LỌT' else 'bị chặn' end, case when b then '✘ HỎNG' else 'ĐẠT' end);

  -- Ngày chưa tới.
  perform set_config('request.jwt.claims', json_build_object('sub', hs1)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_ok, hs1, hs1, 1, homnay + 1);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('C · CHẶN', 'Tick trước cho ngày chưa tới', 'bị chặn',
    case when b then 'LỌT' else 'bị chặn' end, case when b then '✘ HỎNG' else 'ĐẠT' end);

  -- Học sinh lớp khác tick vào việc của 7B1.
  perform set_config('request.jwt.claims', json_build_object('sub', hsla)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_ok, hsla, hsla, 1, homnay);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('C · CHẶN', 'Học sinh LỚP KHÁC tick vào việc của 7B1', 'bị chặn',
    case when b then 'LỌT' else 'bị chặn' end, case when b then '✘ HỎNG' else 'ĐẠT' end);

  -- Tick hộ bạn: ghi student_id của người khác.
  perform set_config('request.jwt.claims', json_build_object('sub', hs1)::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
    values (lm_ok, hs3, hs1, 1, homnay);
    b := true;
  exception when others then b := false;
  end;
  perform set_config('role', 'postgres', true);
  insert into kq values ('C · CHẶN', 'Em này tick HỘ em khác', 'bị chặn',
    case when b then 'LỌT' else 'bị chặn' end, case when b then '✘ HỎNG' else 'ĐẠT' end);

  -- ══════════════════════════════════════════════════════
  -- D · BẢNG ĐIỂM CỦA ĐỘI: em phải thấy TỔNG CẢ LỚP, không chỉ phần mình
  -- ══════════════════════════════════════════════════════
  -- hs2 chỉ đọc được dòng tick của chính mình (RLS), nên nếu class_lead_board trả về 1 thì tức là
  -- em đang nhìn một bảng điểm của riêng em — hỏng đúng cái tinh thần "scoreboard của cả đội".
  perform set_config('request.jwt.claims', json_build_object('sub', hs2)::text, true);
  perform set_config('role', 'authenticated', true);
  select class_total into v from class_lead_board(lop, t2) where lead_measure_id = lm_ok;
  select count(*) into n from lead_progress where lead_measure_id = lm_ok;
  perform set_config('role', 'postgres', true);
  insert into kq values ('D · BẢNG ĐIỂM CHUNG', 'Em đọc TỔNG của cả lớp', '2',
    coalesce(v,0)::text, case when coalesce(v,0) = 2 then 'ĐẠT' else '✘ HỎNG' end);
  insert into kq values ('D · BẢNG ĐIỂM CHUNG', 'Nhưng RLS vẫn chỉ cho em đọc dòng CỦA MÌNH', '1 dòng',
    n || ' dòng', case when n = 1 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', hs2)::text, true);
  perform set_config('role', 'authenticated', true);
  select coalesce(array_length(my_dates, 1), 0) into n from class_lead_board(lop, t2) where lead_measure_id = lm_ok;
  perform set_config('role', 'postgres', true);
  insert into kq values ('D · BẢNG ĐIỂM CHUNG', 'my_dates chỉ là ngày CỦA CHÍNH EM', '1',
    n::text, case when n = 1 then 'ĐẠT' else '✘ HỎNG' end);

  -- ══════════════════════════════════════════════════════
  -- E · GVCN NHÌN ĐƯỢC AI TICK GÌ (thứ trước đây thiếu hẳn)
  -- ══════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', gvcn)::text, true);
  perform set_config('role', 'authenticated', true);
  -- Lọc về đúng hai việc của phép kiểm: lớp 7B1 ngoài đời còn WIG tuần khác, đếm cả vào thì con
  -- số kỳ vọng phụ thuộc dữ liệu thật — một phép kiểm như vậy sẽ đỏ lên vì lý do không liên quan.
  select count(*) into n from class_tick_matrix(lop, t2)
   where lead_measure_id in (lm_ok, lm_sai_thu);
  perform set_config('role', 'postgres', true);
  -- 3 học sinh × 2 việc = 6 dòng, KỂ CẢ em chưa tick lần nào — chính ô trống mới là thứ cần thấy.
  insert into kq values ('E · GVCN', 'Ma trận đủ (học sinh × việc), kể cả ô trống', '6 dòng',
    n || ' dòng', case when n = 6 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', gvcn)::text, true);
  perform set_config('role', 'authenticated', true);
  select coalesce(array_length(ticked_dates, 1), 0) into n
  from class_tick_matrix(lop, t2) where student_id = hs3 and lead_measure_id = lm_ok;
  perform set_config('role', 'postgres', true);
  insert into kq values ('E · GVCN', 'Em chưa tick vẫn có dòng, số ngày = 0', '0',
    n::text, case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', gvla)::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from class_tick_matrix(lop, t2);
  perform set_config('role', 'postgres', true);
  insert into kq values ('E · GVCN', 'GV KHÔNG dạy lớp này xem ma trận', '0 dòng',
    n || ' dòng', case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', hs1)::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from class_tick_matrix(lop, t2);
  perform set_config('role', 'postgres', true);
  insert into kq values ('E · GVCN', 'Học sinh xem ma trận cả lớp', '0 dòng',
    n || ' dòng', case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

  -- ══════════════════════════════════════════════════════
  -- F · BAN GIÁM HIỆU: thắng/thua theo lớp, theo GVCN
  -- ══════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', bgh)::text, true);
  perform set_config('role', 'authenticated', true);
  select wigs_won into n from school_wig_rollup(t2) where class_id = lop;
  perform set_config('role', 'postgres', true);
  insert into kq values ('F · BGH', 'Hiệu trưởng ĐÚNG cơ sở thấy 7B1 thắng', '≥1',
    coalesce(n, -1)::text, case when coalesce(n,0) >= 1 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', bgh)::text, true);
  perform set_config('role', 'authenticated', true);
  select tick_students into n from school_wig_rollup(t2) where class_id = lop;
  perform set_config('role', 'postgres', true);
  insert into kq values ('F · BGH', 'Số em thật sự có tick', '2',
    coalesce(n, -1)::text, case when coalesce(n,-1) = 2 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', bgh)::text, true);
  perform set_config('role', 'authenticated', true);
  select teacher_name is not null into b from school_wig_rollup(t2) where class_id = lop;
  perform set_config('role', 'postgres', true);
  insert into kq values ('F · BGH', 'Có tên GVCN để biết lớp của ai', 'có',
    case when coalesce(b,false) then 'có' else 'KHÔNG' end,
    case when coalesce(b,false) then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', bgh2)::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from school_wig_rollup(t2) where class_id = lop;
  perform set_config('role', 'postgres', true);
  insert into kq values ('F · BGH', 'Hiệu trưởng cơ sở KHÁC thấy 7B1', '0 dòng',
    n || ' dòng', case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', gvcn)::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from school_wig_rollup(t2);
  perform set_config('role', 'postgres', true);
  insert into kq values ('F · BGH', 'GVCN gọi bảng toàn trường', '0 dòng',
    n || ' dòng', case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

  -- ══════════════════════════════════════════════════════
  -- G · DÒNG DO NGƯỜI LỚN GÕ KHÔNG ĐƯỢC TÍNH LÀ "EM ĐÃ THAM GIA"
  -- ══════════════════════════════════════════════════════
  -- GVCN vẫn ghi được (lp_staff_manage) — CỐ Ý, để chữa sai sót. Nhưng dòng không gắn với em nào
  -- thì không được làm tăng "số em đã tick", nếu không thì lại quay về đúng cái bệnh cũ.
  insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
  values (lm_ok, null, gvcn, 5, homnay);

  perform set_config('request.jwt.claims', json_build_object('sub', bgh)::text, true);
  perform set_config('role', 'authenticated', true);
  select tick_students into n from school_wig_rollup(t2) where class_id = lop;
  perform set_config('role', 'postgres', true);
  insert into kq values ('G · GÕ TAY', 'GVCN gõ +5 → số EM đã tick', 'vẫn 2',
    coalesce(n,-1)::text, case when coalesce(n,-1) = 2 then 'ĐẠT' else '✘ HỎNG' end);

  perform set_config('request.jwt.claims', json_build_object('sub', gvcn)::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from class_tick_matrix(lop, t2) where hs3 = student_id and array_length(ticked_dates,1) is not null;
  perform set_config('role', 'postgres', true);
  insert into kq values ('G · GÕ TAY', 'Dòng gõ tay KHÔNG hiện thành tick của một em', '0',
    n::text, case when n = 0 then 'ĐẠT' else '✘ HỎNG' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into kq values ('LỖI', 'Bộ kiểm dừng giữa chừng', '—', sqlerrm, '✘ HỎNG');
end $$;

select nhom, buoc, ky_vong, thuc_te, dat from kq;

select
  count(*) filter (where dat = 'ĐẠT') || '/' || count(*) || ' đạt' as ket_qua,
  case when count(*) filter (where dat <> 'ĐẠT') = 0 then 'TẤT CẢ ĐẠT' else '✘ CÓ PHÉP KIỂM HỎNG' end as ket_luan
from kq;

rollback;
