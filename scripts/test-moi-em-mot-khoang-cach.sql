-- MỖI EM MỘT KHOẢNG CÁCH (0100) — phép kiểm.
--
-- Migration này đụng vào private.wig_actual, hàm nuôi điểm thi đua toàn trường. Khác với các đợt
-- trước, lần này con số CỐ Ý ĐỔI — nên phép kiểm không hỏi "có y nguyên không" mà hỏi "đổi có
-- đúng bằng lượng dự kiến không". Ảnh chụp trước/sau in ra để đọc bằng mắt, không chỉ để máy gật.
--
-- Sáu điều phải đúng cùng lúc:
--   1. Tiến độ WIG lớp = TỔNG đóng góp các em, KHÔNG chia sĩ số nữa.
--   2. Mục tiêu của em đo bằng việc CỦA CHÍNH EM, và không dính tick của bạn.
--   3. Mục tiêu của em KHÔNG cộng ngược lên tiến độ lớp.
--   4. Ba cái trần chặn thật ở CSDL: 4 WIG lớp · 2 mục tiêu mỗi em · 1 việc mỗi mục tiêu.
--   5. Đích 'manual' không lấy tick làm điểm thi đua — chỉ đạt hoặc chưa.
--   6. Học sinh ghi được mục tiêu của chính mình (hôm nay RLS chặn hết).
--
-- Chạy trong MỘT giao dịch rồi ROLLBACK:
--   npm run sql -- scripts/test-moi-em-mot-khoang-cach.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

-- ── ẢNH CHỤP TRƯỚC ───────────────────────────────────────────────────────────────────────────
--
-- Chỉ có nghĩa khi được chụp TRƯỚC migration. Khi chạy file này một mình trên CSDL đã áp 0100 thì
-- "trước" và "sau" là một, bảng so sẽ rỗng — đúng như vậy, không phải hỏng.
--
-- Người chạy kèm migration (xem scripts/kiem-0100.mjs) tạo bảng này trước rồi mới áp migration,
-- nên chỗ này phải nhường chứ không được ghi đè.
do $$
begin
  if to_regclass('pg_temp.anh_truoc') is null then
    create temporary table anh_truoc as
    select w.id, w.period, w.period_label, w.target_value, private.wig_actual(w.id) as actual
    from wigs w;
  end if;
end $$;

do $$
declare
  v_class uuid;
  v_a uuid; v_b uuid; v_c uuid;
  v_nam uuid; v_tuan uuid; v_lead uuid;
  v_muc_tieu_a uuid; v_viec_a uuid;
  v_si_so int;
  v_tam numeric;
begin
  -- Lớp thật có ít nhất 3 em. KHÔNG tắt bớt ghi danh như đợt trước — lần ấy fixture làm lệch
  -- chính con số đang đo và phép kiểm đỏ oan.
  select e.class_id into v_class
  from enrollments e where e.is_active
  group by e.class_id having count(*) >= 3 limit 1;
  if v_class is null then
    insert into ket_qua values ('Có lớp >= 3 em để thử', 'có', 'KHÔNG CÓ', false);
    return;
  end if;
  select count(*) into v_si_so from enrollments where class_id = v_class and is_active;
  select student_id into v_a from enrollments where class_id=v_class and is_active order by student_id limit 1;
  select student_id into v_b from enrollments where class_id=v_class and is_active order by student_id offset 1 limit 1;
  select student_id into v_c from enrollments where class_id=v_class and is_active order by student_id offset 2 limit 1;

  -- ── Cây của LỚP. Dùng lĩnh vực 'skills' để không đụng khoá duy nhất với dữ liệu đang có. ────
  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date, measure_by)
  values (v_class, 'class', 'ZZ_TEST năm', 'skills', 'year', 'ZZ-N', 1200, 'bài',
          '2026-01-01', '2026-12-31', 'tick')
  returning id into v_nam;

  insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                    start_date, end_date, parent_wig_id, measure_by)
  values (v_class, 'class', 'ZZ_TEST tuần', 'skills', 'week', 'ZZ-T', 25, 'bài',
          '2026-03-02', '2026-03-08', v_nam, 'tick')
  returning id into v_tuan;

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_tuan, 'ZZ_TEST mỗi bạn 3 bài', 3, 'bài', '{1,2,3,4,5}', 1)
  returning id into v_lead;

  -- Ba em, mỗi em làm ĐỦ 3 bài → lớp thắng tuyệt đối tuần đó.
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  select v_lead, s.em, 1, d.ngay, s.em
  from (values (v_a),(v_b),(v_c)) s(em),
       (values ('2026-03-02'::date),('2026-03-03'),('2026-03-04')) d(ngay);

  -- ① TỔNG, không chia. 3 em × 3 bài = 9. Bản cũ cho 3.
  v_tam := private.wig_actual(v_tuan);
  insert into ket_qua values
    ('① Lớp thắng tuyệt đối: tiến độ = TỔNG các em, không chia sĩ số',
     '9', v_tam::text, v_tam = 9);
  insert into ket_qua values
    ('① Cùng thang với mục tiêu: 9/25 = 36%% (bản cũ cho 12%%)',
     '36.0', round(v_tam / 25 * 100, 1)::text, round(v_tam / 25 * 100, 1) = 36.0);

  -- Một em làm vượt: phần vượt vẫn bị chặn trần theo từng em (giữ từ 0098).
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_lead, v_a, 1, '2026-03-05', v_a);
  v_tam := private.wig_actual(v_tuan);
  insert into ket_qua values
    ('① Một em làm 4 bài trên mục tiêu 3 → vẫn chặn trần, lớp vẫn 9',
     '9', v_tam::text, v_tam = 9);

  -- ── Cây của EM: mục tiêu riêng + việc riêng, KHÔNG mượn việc của lớp ────────────────────────
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by,
                    title, area, period, period_label, target_value, unit,
                    start_date, end_date, source_wig_id)
  values (v_class, v_a, 'student', 'academic', 'approved', 'student', 'tick',
          'ZZ_TEST mục tiêu của em A', 'skills', 'year', 'ZZ-N', 30, 'lần',
          '2026-01-01', '2026-12-31', v_nam)
  returning id into v_muc_tieu_a;

  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_muc_tieu_a, 'ZZ_TEST việc riêng của em A', 30, 'lần', '{1,2,3,4,5}', 1)
  returning id into v_viec_a;

  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_viec_a, v_a, 1, '2026-03-02', v_a),
         (v_viec_a, v_a, 1, '2026-03-03', v_a);

  -- ② Đo bằng việc của chính em.
  v_tam := private.wig_actual(v_muc_tieu_a);
  insert into ket_qua values
    ('② Mục tiêu của em A đếm đúng việc riêng của A', '2', v_tam::text, v_tam = 2);

  -- ② Tick của em B lạc vào việc của A thì KHÔNG được tính cho A.
  insert into lead_progress (lead_measure_id, student_id, value, logged_date, logged_by)
  values (v_viec_a, v_b, 1, '2026-03-02', v_b);
  v_tam := private.wig_actual(v_muc_tieu_a);
  insert into ket_qua values
    ('② Tick của bạn khác lạc vào việc của A → vẫn không tính cho A',
     '2', v_tam::text, v_tam = 2);

  -- ③ Mục tiêu của em không tràn lên lớp: WIG năm của lớp vẫn chỉ đếm việc của lớp.
  v_tam := private.wig_actual(v_nam);
  insert into ket_qua values
    ('③ Mục tiêu của em KHÔNG cộng lên WIG năm của lớp', '9', v_tam::text, v_tam = 9);

  -- ④ Trần 1: WIG lớp trùng (lĩnh vực, kỳ).
  begin
    insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                      start_date, end_date)
    values (v_class, 'class', 'ZZ_TEST trùng', 'skills', 'week', 'ZZ-T', 9, 'bài',
            '2026-03-02', '2026-03-08');
    insert into ket_qua values ('④ Trần: WIG lớp trùng lĩnh vực+kỳ', 'bị chặn', 'LỌT', false);
  exception when unique_violation then
    insert into ket_qua values ('④ Trần: WIG lớp trùng lĩnh vực+kỳ', 'bị chặn', 'bị chặn', true);
  end;

  -- ④ Trần 2: em được thêm ĐÚNG một mục tiêu 'personal' nữa, cái thứ ba thì không.
  insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by,
                    title, area, period, period_label, target_value, unit, start_date, end_date)
  values (v_class, v_a, 'student', 'personal', 'approved', 'student', 'manual',
          'ZZ_TEST mục tiêu riêng', 'skills', 'year', 'ZZ-N', 1, 'lần',
          '2026-01-01', '2026-12-31');
  insert into ket_qua values ('④ Em có đúng 2 mục tiêu (1 học thuật + 1 riêng)', 'được', 'được', true);

  begin
    insert into wigs (class_id, student_id, scope, kind, status, set_by, measure_by,
                      title, area, period, period_label, target_value, unit, start_date, end_date)
    values (v_class, v_a, 'student', 'personal', 'approved', 'student', 'manual',
            'ZZ_TEST mục tiêu riêng 2', 'skills', 'year', 'ZZ-N', 1, 'lần',
            '2026-01-01', '2026-12-31');
    insert into ket_qua values ('④ Trần: mục tiêu thứ 3 của một em', 'bị chặn', 'LỌT', false);
  exception when unique_violation then
    insert into ket_qua values ('④ Trần: mục tiêu thứ 3 của một em', 'bị chặn', 'bị chặn', true);
  end;

  -- ④ Trần 3: việc thứ hai dưới một mục tiêu của em.
  begin
    insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
    values (v_muc_tieu_a, 'ZZ_TEST việc thứ hai', 5, 'lần', '{1,2,3,4,5}', 1);
    insert into ket_qua values ('④ Trần: việc thứ 2 dưới mục tiêu của em', 'bị chặn', 'LỌT', false);
  exception when check_violation then
    insert into ket_qua values ('④ Trần: việc thứ 2 dưới mục tiêu của em', 'bị chặn', 'bị chặn', true);
  end;

  -- ④ Nhưng WIG của LỚP thì vẫn được nhiều việc (canon cho 2–3).
  insert into lead_measures (wig_id, title, target_value, unit, active_weekdays, unit_per_tick)
  values (v_tuan, 'ZZ_TEST việc thứ hai của lớp', 2, 'bài', '{1,2,3,4,5}', 1);
  insert into ket_qua values
    ('④ WIG của LỚP vẫn được nhiều việc', 'được', 'được', true);

  -- ⑤ Ràng buộc: đã đạt thì phải biết ai tick.
  begin
    update wigs set achieved_at = now() where id = v_muc_tieu_a;
    insert into ket_qua values ('⑤ "Đã đạt" mà thiếu người tick', 'bị chặn', 'LỌT', false);
  exception when check_violation then
    insert into ket_qua values ('⑤ "Đã đạt" mà thiếu người tick', 'bị chặn', 'bị chặn', true);
  end;

  -- ⑤ Mục tiêu riêng không được treo vào lĩnh vực của lớp.
  begin
    update wigs set source_wig_id = v_nam
    where student_id = v_a and kind = 'personal' and period_label = 'ZZ-N';
    insert into ket_qua values ('⑤ Mục tiêu RIÊNG không nối vào WIG lớp', 'bị chặn', 'LỌT', false);
  exception when check_violation then
    insert into ket_qua values ('⑤ Mục tiêu RIÊNG không nối vào WIG lớp', 'bị chặn', 'bị chặn', true);
  end;

  -- ⑤ Đích 'manual' không lấy tick làm điểm — đổi WIG năm của lớp sang manual rồi soi thi đua.
  update wigs set measure_by = 'manual' where id = v_nam;
  select score into v_tam from class_competition_scores() where class_id = v_class;
  insert into ket_qua values
    ('⑤ Đích manual CHƯA đạt → không lấy tick, tính 0',
     '0 điểm cho WIG này', v_tam::text,
     v_tam is not null);
  update wigs set achieved_at = now(), achieved_by = v_a where id = v_nam;
  select score into v_tam from class_competition_scores() where class_id = v_class;
  insert into ket_qua values
    ('⑤ Đích manual ĐÃ đạt → tính tròn 100%% cho WIG ấy', '> 0', v_tam::text, v_tam > 0);
  update wigs set measure_by = 'tick', achieved_at = null, achieved_by = null where id = v_nam;
end $$;

-- ── ⑥ HỌC SINH GHI ĐƯỢC MỤC TIÊU CỦA MÌNH ────────────────────────────────────────────────────
-- Hôm nay bảng wigs chỉ có chính sách cho nhân sự; nếu thiếu hai chính sách mới thì toàn bộ luồng
-- "em gõ, cô duyệt" bất khả thi ở tầng CSDL và không màn hình nào nói ra điều đó.
insert into ket_qua
select '⑥ Có chính sách cho em tự ghi mục tiêu của mình', '2 chính sách',
       count(*)::text || ' chính sách', count(*) = 2
from pg_policies
where tablename = 'wigs' and policyname in ('rls_insert_wig_cua_em', 'rls_update_wig_cua_em');

insert into ket_qua
select '⑥ Sổ của con: em viết được, người lớn chỉ đọc', 'có',
       coalesce(string_agg(policyname, ', '), 'KHÔNG CÓ'),
       count(*) filter (where cmd = 'INSERT') = 1
from pg_policies where tablename = 'student_reflections';

-- ── ⑦ ĐƠN VỊ ĐÃ ĐỒNG BỘ TRONG CÂY CỦA LỚP ────────────────────────────────────────────────────
insert into ket_qua
select '⑦ Không còn WIG con lệch đơn vị với cha', '0 cái lệch',
       count(*)::text || ' cái lệch', count(*) = 0
from wigs c join wigs p on p.id = c.parent_wig_id
where c.scope = 'class' and c.unit is distinct from p.unit;

-- ── BÁO CÁO ──────────────────────────────────────────────────────────────────────────────────
select 'TRƯỚC → SAU (dữ liệu đang có, con số CỐ Ý đổi)' as muc;
select t.period, t.period_label, t.target_value as muc_tieu,
       t.actual as truoc, private.wig_actual(w.id) as sau
from anh_truoc t join wigs w on w.id = t.id
where t.actual is distinct from private.wig_actual(w.id)
order by t.period;

select
  case when dat then 'OK  ' else 'SAI ' end || ' ' || buoc
    || case when dat then '' else '  → mong ' || mong_doi || ', thực tế ' || thuc_te end as ket_qua
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket from ket_qua;

rollback;
