-- Bảng ghi nhận buổi họp (0079): quyền đọc/ghi và hai chốt chặn.
--
-- CHUYỆN QUAN TRỌNG NHẤT Ở ĐÂY LÀ RANH GIỚI ĐỌC. Ô "rút ra điều gì" là nhận xét của giáo viên về
-- việc học của trẻ. Chủ dự án chốt: chỉ GVCN + ban giám hiệu đọc được — học sinh và phụ huynh
-- KHÔNG. Một khi đã mở cho phụ huynh thì không rút lại được, nên chỗ này phải chặn ở RLS chứ
-- không chỉ ẩn trên giao diện, và phải có phép kiểm đi bằng đúng phiên đăng nhập của từng vai.
--
-- Chạy trong MỘT giao dịch rồi ROLLBACK: dựng dữ liệu, đo, không để lại dấu vết trên production.
--
--   npm run sql -- scripts/test-bang-hop-wig.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

do $$
declare
  v_class    uuid;
  v_class2   uuid;
  v_gvcn     uuid;
  v_gvcn2    uuid;
  v_hs       uuid;
  v_ph       uuid;
  v_bgh      uuid;
  v_lead     uuid;
  v_lead2    uuid;
  v_wig      uuid;
  v_ck       uuid;
  v_wig2     uuid;
  v_ck2      uuid;
  v_n        int;
begin
  -- CHỌN LỚP CHO ĐÚNG, nếu không thì phép kiểm quyền ở mục 5 tự lừa mình.
  --
  -- Bản đầu lấy "một lớp bất kỳ có GVCN" rồi "một phụ huynh bất kỳ". Kiểm lại thì phụ huynh ấy
  -- KHÔNG có con trong lớp đang thử — nên "phụ huynh đọc được 0 dòng" là hiển nhiên, chẳng chứng
  -- minh gì về RLS. Một phép kiểm luôn xanh còn tệ hơn không có: nó làm mình tin là đã kiểm.
  --
  -- Nay chọn lớp thoả CẢ BA: có GVCN, có học sinh đang học, và có phụ huynh liên kết với chính
  -- em đó. Chỉ khi ấy câu "phụ huynh KHÔNG đọc được" mới nói lên điều gì.
  select c.id, c.homeroom_teacher_id, e.student_id, pl.parent_id
    into v_class, v_gvcn, v_hs, v_ph
  from classes c
  join enrollments e on e.class_id = c.id and e.is_active
  join parent_links pl on pl.student_id = e.student_id
  where c.homeroom_teacher_id is not null
  limit 1;

  -- Không có lớp nào đủ ba điều kiện thì lùi về lớp có GVCN + học sinh, và ĐÁNH DẤU là chưa kiểm
  -- được vế phụ huynh — nói thẳng ra thay vì báo xanh.
  if v_class is null then
    select c.id, c.homeroom_teacher_id into v_class, v_gvcn
    from classes c where c.homeroom_teacher_id is not null limit 1;
    select e.student_id into v_hs from enrollments e where e.class_id = v_class and e.is_active limit 1;
    v_ph := null;
  end if;

  select id into v_class2 from classes where id <> v_class limit 1;

  -- Một việc chung của lớp để chấm.
  select lm.id, lm.wig_id into v_lead, v_wig
  from lead_measures lm join wigs w on w.id = lm.wig_id
  where w.class_id = v_class and w.scope = 'class' limit 1;

  if v_lead is null then
    -- 0121: mục tiêu chỉ còn cấp NĂM, và việc treo dưới CAM KẾT của một tuần.
    insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                      start_date, end_date)
    values (v_class, 'class', 'ZZ_TEST wig', 'knowledge', 'year', 'ZZN', 5, 'buổi',
            '2026-01-01', '2026-12-31')
    returning id into v_wig;
    insert into commitments (wig_id, class_id, week_start, title, area)
    values (v_wig, v_class, date '2026-03-02', 'ZZ_TEST cam kết', 'knowledge')
    returning id into v_ck;
    insert into lead_measures (commitment_id, title, target_value, unit)
    values (v_ck, 'ZZ_TEST việc', 5, 'buổi') returning id into v_lead;
  end if;

  -- Một việc của LỚP KHÁC, để thử ghi chéo lớp. Tìm theo "việc thuộc lớp nào đó khác v_class"
  -- chứ không phải "việc của v_class2" — lớp đầu tiên khác v_class có thể chưa có việc nào.
  select lm.id into v_lead2
  from lead_measures lm
  join commitments ck on ck.id = lm.commitment_id
  join wigs w on w.id = lm.wig_id
  where ck.class_id is not null and ck.class_id <> v_class limit 1;

  -- KHÔNG CÓ THÌ TỰ DỰNG LẤY, đừng bỏ qua. Sau đợt xoá sạch mục tiêu cũ (0121) thường chỉ còn
  -- đúng một lớp có việc, và khi ấy phép kiểm ĐẮT NHẤT của cả file — "GVCN lớp này không chấm
  -- được việc của lớp khác" — lặng lẽ không chạy. Cảnh dựng trong transaction rồi ROLLBACK, nên
  -- lớp kia không mọc thêm gì sau khi chạy xong.
  if v_lead2 is null and v_class2 is not null then
    insert into wigs (class_id, scope, title, area, period, period_label, target_value, unit,
                      start_date, end_date)
    values (v_class2, 'class', 'ZZ_TEST wig lớp khác', 'knowledge', 'year', 'ZZN2', 5, 'buổi',
            '2026-01-01', '2026-12-31')
    returning id into v_wig2;
    insert into commitments (wig_id, class_id, week_start, title, area)
    values (v_wig2, v_class2, date '2026-03-02', 'ZZ_TEST cam kết lớp khác', 'knowledge')
    returning id into v_ck2;
    insert into lead_measures (commitment_id, title, target_value, unit)
    values (v_ck2, 'ZZ_TEST việc lớp khác', 5, 'buổi') returning id into v_lead2;
  end if;

  -- ── 1. Trigger chặn ghi chéo lớp ──
  -- RLS chỉ kiểm class_id của chính dòng đang ghi, mà class_id ấy do người gửi tự khai. Không có
  -- trigger thì một GVCN gửi lead_measure_id của lớp khác vẫn ghi được.
  if v_lead2 is not null then
    begin
      insert into wig_meeting_notes (class_id, week_start, lead_measure_id, verdict)
      values (v_class, '2026-03-02', v_lead2, 'win');
      insert into ket_qua values ('Chặn chấm việc của lớp khác', 'bị chặn', 'LỌT', false);
    exception when others then
      insert into ket_qua values ('Chặn chấm việc của lớp khác', 'bị chặn', 'bị chặn', true);
    end;
  else
    -- Không thử được thì nói thẳng là CHƯA KIỂM, đừng tự chấm đạt: một phép kiểm luôn xanh còn
    -- tệ hơn không có, vì nó làm mình tin là đã kiểm.
    insert into ket_qua values
      ('Chặn chấm việc của lớp khác', 'kiểm được', 'BỎ QUA — không lớp nào khác có việc để thử', false);
  end if;

  -- ── 2. verdict chỉ nhận win/lose ──
  begin
    insert into wig_meeting_notes (class_id, week_start, lead_measure_id, verdict)
    values (v_class, '2026-03-02', v_lead, 'hoa');
    insert into ket_qua values ('CHECK chặn verdict lạ', 'bị chặn', 'LỌT', false);
  exception when check_violation then
    insert into ket_qua values ('CHECK chặn verdict lạ', 'bị chặn', 'bị chặn', true);
  end;

  -- ── 3. Mỗi (lớp, tuần, việc) chỉ một dòng — lưu lại là ghi đè, không đẻ thêm ──
  insert into wig_meeting_notes (class_id, week_start, lead_measure_id, verdict, note)
  values (v_class, '2026-03-02', v_lead, 'win', 'lần đầu');
  insert into wig_meeting_notes (class_id, week_start, lead_measure_id, verdict, note)
  values (v_class, '2026-03-02', v_lead, 'lose', 'lần hai')
  on conflict (class_id, week_start, lead_measure_id)
  do update set verdict = excluded.verdict, note = excluded.note;

  select count(*) into v_n from wig_meeting_notes
  where class_id = v_class and week_start = '2026-03-02' and lead_measure_id = v_lead;
  insert into ket_qua values ('Lưu lại thì ghi đè, không đẻ dòng mới', '1', v_n::text, v_n = 1);

  select count(*) into v_n from wig_meeting_notes
  where class_id = v_class and week_start = '2026-03-02' and lead_measure_id = v_lead
    and verdict = 'lose' and note = 'lần hai';
  insert into ket_qua values ('Ghi đè giữ đúng giá trị mới', '1', v_n::text, v_n = 1);

  -- ── 4. THẮNG/THUA KHÔNG ĐƯỢC CHẢY VÀO KẾT QUẢ THẬT ──
  -- Đây là ranh giới đặt ra từ f596b4b. Chấm 'lose' xong thì tiến độ WIG phải y nguyên, vì nó
  -- tính từ tick của học sinh chứ không từ nút giáo viên bấm.
  insert into ket_qua
  select 'Chấm thua không làm đổi tiến độ WIG',
         'không đổi', 'actual=' || private.wig_actual(v_wig)::text,
         -- Vế phải cộng lại BẰNG TAY để đối chiếu. Sau 0124 phạm vi của một việc là ĐÚNG TUẦN
         -- của cam kết nó thuộc về, không phải cả năm — nên vế này phải bó theo tuần y hệt, nếu
         -- không phép kiểm so hai thứ khác nhau rồi kết luận là app sai.
         private.wig_actual(v_wig) = (
           -- Cộng lại có ÁP TRẦN "mỗi em một bộ đếm" (0098): với mục tiêu của LỚP, phần góp của
           -- mỗi em cho mỗi việc bị kẹp ở đúng chỉ tiêu của việc ấy. Bỏ trần ra khỏi vế này thì
           -- nó ra 18 trong khi app ra 14, và phép kiểm sẽ tố cáo app về một luật mà chính app
           -- đang giữ đúng.
           select coalesce(sum(least(g.gop, g.dich)), 0)
           from (
             select lm.target_value as dich,
                    sum(lp.value) * lm.unit_per_tick as gop
             from commitments c
             join lead_measures lm on lm.commitment_id = c.id
             join lead_progress lp on lp.lead_measure_id = lm.id
             where c.wig_id = v_wig
               and lp.logged_date between c.week_start and c.week_start + 6
             group by lm.id, lm.target_value, lm.unit_per_tick, lp.student_id
           ) g
         );

  -- ── 5. RANH GIỚI ĐỌC ──
  -- Đổi vai bằng cách đặt request.jwt.claims như PostgREST làm, rồi đọc với quyền authenticated.
  --
  -- Kiểm CẢ HAI CHIỀU: vai không được phép phải ra 0 dòng, VÀ vai được phép phải ra ≥1. Thiếu vế
  -- thứ hai thì một RLS chặn sạch mọi người cũng "đạt" — đúng cái bẫy của phép kiểm chỉ dò một
  -- chiều.
  perform set_config('request.jwt.claims', json_build_object('sub', v_hs, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from wig_meeting_notes where class_id = v_class;
  reset role;
  insert into ket_qua values ('Học sinh trong lớp KHÔNG đọc được', '0 dòng', v_n || ' dòng', v_n = 0);

  if v_ph is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_ph, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from wig_meeting_notes where class_id = v_class;
    reset role;
    insert into ket_qua values
      ('Phụ huynh CÓ CON trong lớp KHÔNG đọc được', '0 dòng', v_n || ' dòng', v_n = 0);
  else
    insert into ket_qua values
      ('Phụ huynh CÓ CON trong lớp KHÔNG đọc được', 'kiểm được',
       'BỎ QUA — không lớp nào có đủ GVCN + học sinh + phụ huynh liên kết', false);
  end if;

  -- ── 6. GVCN của lớp đó thì đọc được (vế ngược, để phép kiểm trên có nghĩa) ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from wig_meeting_notes where class_id = v_class;
  reset role;
  insert into ket_qua values ('GVCN của lớp ĐỌC ĐƯỢC', '≥1 dòng', v_n || ' dòng', v_n >= 1);

  -- ── 6b. Ban giám hiệu cùng cơ sở ĐỌC ĐƯỢC (chủ dự án chốt: GVCN + BGH) ──
  select p.id into v_bgh
  from profiles p join classes c on c.id = v_class
  where p.role = 'principal' and p.campus_id = c.campus_id limit 1;
  if v_bgh is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_bgh, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from wig_meeting_notes where class_id = v_class;
    reset role;
    insert into ket_qua values ('BGH cùng cơ sở ĐỌC ĐƯỢC', '≥1 dòng', v_n || ' dòng', v_n >= 1);
  else
    insert into ket_qua values
      ('BGH cùng cơ sở ĐỌC ĐƯỢC', 'kiểm được', 'BỎ QUA — cơ sở này chưa có hiệu trưởng', false);
  end if;

  -- ── 6c. GVCN LỚP KHÁC thì KHÔNG đọc được ──
  select c.homeroom_teacher_id into v_gvcn2
  from classes c where c.id <> v_class and c.homeroom_teacher_id is not null
    and c.homeroom_teacher_id <> v_gvcn limit 1;
  if v_gvcn2 is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn2, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from wig_meeting_notes where class_id = v_class;
    reset role;
    insert into ket_qua values ('GVCN lớp KHÁC không đọc được', '0 dòng', v_n || ' dòng', v_n = 0);
  end if;

  perform set_config('request.jwt.claims', null, true);
end $$;

-- ── 8. VÒNG CAM KẾT KHÔNG CÒN ĐỨT KHI NHÃN BỊ GÕ KHÁC (0080) ──
--
-- Trước 0080, biên bản chỉ có week_label — ô CHỮ TỰ DO. Dòng "Tuần trước lớp đã hứa…" tra theo
-- nhãn, nên ai sửa tay thành "Tuần 31" là vòng cam kết đứt, lặng lẽ: dòng đó chỉ đơn giản không
-- hiện, không ai biết mình vừa làm mất nó.
--
-- Nay khoá là NGÀY. Dựng một biên bản có nhãn gõ bậy hoàn toàn rồi tra theo ngày — vẫn phải thấy.
do $$
declare
  v_class uuid;
  v_n int;
  v_hua text;
begin
  select c.id into v_class from classes c where c.homeroom_teacher_id is not null limit 1;

  insert into wig_meetings (class_id, week_label, week_start, next_actions)
  values (v_class, 'Tuần ba mươi mốt', '2026-03-02', 'ZZ_TEST cả lớp đọc sách 4 buổi');

  -- Tra bằng NGÀY: phải thấy, dù nhãn không theo quy ước nào.
  select next_actions into v_hua from wig_meetings
  where class_id = v_class and week_start = '2026-03-02' and student_id is null;
  insert into ket_qua values
    ('Nhãn gõ bậy vẫn tra được lời hứa (theo ngày)', 'thấy lời hứa',
     coalesce(v_hua, '(không thấy)'), v_hua = 'ZZ_TEST cả lớp đọc sách 4 buổi');

  -- Tra bằng NHÃN như bản cũ: không thấy — đây chính là cái đã hỏng.
  select count(*) into v_n from wig_meetings
  where class_id = v_class and week_label = 'W10-2026' and student_id is null;
  insert into ket_qua values
    ('(đối chứng) Tra theo nhãn thì trượt', '0 dòng', v_n || ' dòng', v_n = 0);

  -- Hàm suy ngược dùng chung: nhãn đúng quy ước → thứ Hai đúng.
  insert into ket_qua
  select 'thu_hai_tu_nhan(''W31-2026'') ra 27/07 (thứ Hai)',
         '2026-07-27', coalesce(thu_hai_tu_nhan('W31-2026')::text, 'null'),
         thu_hai_tu_nhan('W31-2026') = date '2026-07-27';

  -- Nhãn không theo quy ước → trả null chứ không đoán bừa một ngày.
  insert into ket_qua
  select 'thu_hai_tu_nhan(nhãn lạ) trả null, không đoán bừa',
         'null', coalesce(thu_hai_tu_nhan('Tuần 31')::text, 'null'),
         thu_hai_tu_nhan('Tuần 31') is null;
end $$;

-- ── 9. HỌP XONG LÀ CHỐT TICK (0081) ──
--
-- Thay ô "Chốt tick tuần vào [thứ]" của 0046. Ô ấy bắt giáo viên đoán trước ngày họp: đặt sớm thì
-- khoá khi lớp chưa họp, đặt muộn thì họp xong tick vẫn chạy và con số vừa bàn đã đổi. Nay mốc
-- chốt là việc thật sự xảy ra.
--
-- Kiểm bằng chính hàm mà RLS dùng, ở cả hai chiều: chưa họp thì mở, họp rồi thì chốt.
do $$
declare
  v_class uuid;
  v_lead  uuid;
begin
  select c.id into v_class from classes c where c.homeroom_teacher_id is not null limit 1;
  select lm.id into v_lead from lead_measures lm join wigs w on w.id = lm.wig_id
   where w.class_id = v_class and w.scope = 'class' limit 1;

  -- Dọn sạch tuần thử để không dính ghi nhận của các bước trên.
  delete from wig_meeting_notes where class_id = v_class and week_start = '2026-04-06';
  delete from wig_meetings where class_id = v_class and week_start = '2026-04-06';

  insert into ket_qua values
    ('Chưa họp thì tick còn mở', 'mở', case when tuan_da_hop(v_class,'2026-04-08') then 'ĐÃ CHỐT' else 'mở' end,
     not tuan_da_hop(v_class, '2026-04-08'));

  -- Ghi nhận buổi họp cho tuần ấy (thứ Hai 06/04/2026).
  if v_lead is not null then
    insert into wig_meeting_notes (class_id, week_start, lead_measure_id, verdict)
    values (v_class, '2026-04-06', v_lead, 'win');
  end if;

  -- TỪ 0108, GHI KHÔNG CÒN LÀ CHỐT. Trước bản ấy chỉ cần một dòng ghi nhận là `tuan_da_hop()` trả
  -- true, nên phép kiểm này dừng ở chỗ chèn dòng. Nay tuần chỉ khoá khi buổi họp được BẤM CHỐT —
  -- và đó chính là điều 0108 sinh ra để làm: cô lưu giữa chừng buổi họp thì các em vẫn tick và
  -- vẫn nhập số đo được. Nên ở đây phải chốt thật, không thì phép kiểm đang canh một luật đã chết.
  insert into wig_meetings (class_id, week_label, week_start, results, chot_at)
  values (v_class, 'W15-2026', '2026-04-06', 'ZZ_TEST đã họp', now());

  insert into ket_qua values
    ('Họp xong thì tick chốt lại', 'đã chốt', case when tuan_da_hop(v_class,'2026-04-08') then 'đã chốt' else 'VẪN MỞ' end,
     tuan_da_hop(v_class, '2026-04-08'));

  -- Chốt đúng MỘT tuần, không lan sang tuần khác.
  insert into ket_qua values
    ('Chốt đúng tuần đó, tuần sau vẫn mở', 'mở',
     case when tuan_da_hop(v_class,'2026-04-15') then 'CHỐT LAN SANG' else 'mở' end,
     not tuan_da_hop(v_class, '2026-04-15'));
end $$;

-- Ba chốt chặn cho phần TẦNG ỨNG DỤNG (ghép cột tuần trước theo tên, chỉ xoá thứ đã nhìn thấy,
-- và thông điệp khi bảng trắng) nằm ở scripts/test-bang-hop-wig.mjs — Supabase chặn pg_read_file
-- nên không soi mã nguồn từ trong SQL được.

select buoc as "Bước", mong_doi as "Mong đợi", thuc_te as "Thực tế",
       case when dat then 'ĐẠT' else 'HỎNG' end as "Kết quả"
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as "Tổng",
       case when count(*) filter (where not dat) = 0 then 'TẤT CẢ ĐẠT' else 'CÓ LỖI' end as "Kết luận"
from ket_qua;

rollback;
