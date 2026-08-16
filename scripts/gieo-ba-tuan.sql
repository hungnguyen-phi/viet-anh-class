-- ════════════════════════════════════════════════════════════════════════════════════════════
-- GIEO BA TUẦN DỮ LIỆU THẬT CHO LỚP TEST — để vòng tuần hoàn quay đủ một lần
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   npm run sql -- scripts/gieo-ba-tuan.sql
--
-- Chủ dự án 16/08/2026: "thì tạo 3 tuần dữ liệu luôn đi, mà kiểm cho đầy đủ".
--
-- Tới nay CSDL chỉ có ĐÚNG MỘT TUẦN. Mọi mắt xích đã kiểm bằng phép đo, nhưng vòng tuần hoàn thì
-- chưa từng quay thật: chưa có tuần nào chốt xong rồi tuần sau chạy tiếp trên dữ liệu ấy. Ba chỗ
-- chỉ lộ ra khi có nhiều tuần — tuần cũ chốt rồi màn của em có sạch không, ô tick có mở lại không,
-- bảng của cô có nhảy sang tuần mới không — thì chưa đo được lần nào.
--
-- ── SCRIPT NÀY KHÔNG ĐƯỢC PHÉP ĐI QUA LUẬT CỦA APP ───────────────────────────────────────────
--
-- Lần gieo trước (14/08) chạy quyền quản trị và đã viết ra sáu lượt tick vào thứ mà việc không áp
-- dụng — RLS không chặn được vì RLS chỉ gác người dùng. Chủ dự án là người phát hiện ("làm bài thứ
-- 6 tôi còn chưa tick mà vẫn tính 1/1").
--
-- Nay ba luật ấy đã nằm ở TRIGGER nên chặn cả script này: đúng thứ (0136), tối đa 2 việc mỗi
-- người mỗi tuần (0137), tối đa 2 cam kết mỗi người mỗi tuần (0121). Nếu script này chạy lọt thì
-- dữ liệu nó gieo ra là dữ liệu HỢP LỆ theo đúng luật app — đó là điểm của việc chuyển luật xuống
-- trigger, và cũng là phép thử cho chính mấy cái trigger ấy.
--
-- ── BA TUẦN, BA TRẠNG THÁI KHÁC NHAU ─────────────────────────────────────────────────────────
--
--   T-2: đã họp, đã chốt, có V/X — tuần "quá khứ hoàn toàn"
--   T-1: đã họp, đã chốt, có V/X — tuần vừa xong, là tuần buổi họp sắp tổng kết
--   T0 : đang chạy, chưa chốt — tuần hiện tại
--
-- Bốn em mang bốn dáng người thật: đều đặn, bỏ giữa chừng, dồn cuối tuần, không làm gì. Không phải
-- để cho đẹp — đó là bốn dáng mà buổi họp phải phân biệt được, và một bộ dữ liệu toàn em chăm chỉ
-- thì không kiểm được gì cả.
begin;

do $$
declare
  v_lop   uuid;
  v_gvcn  uuid;
  v_t0    date;
  v_t1    date;
  v_t2    date;
  v_wig_kt uuid;   -- mục tiêu năm của lớp, lĩnh vực Kiến thức
  v_wig_kn uuid;   -- lĩnh vực khác, để em chọn trận thứ hai
  v_ck     uuid;
  v_lm     uuid;
  v_em     record;
  v_tuan   date;
  v_i      int;
  v_wig_em uuid;
  v_ngay   date;
  v_dem    int;
begin
  select c.id, c.homeroom_teacher_id into v_lop, v_gvcn
  from classes c where c.name = 'Test' and c.is_active;
  if v_lop is null then
    raise exception 'Không thấy lớp Test.';
  end if;

  v_t0 := vn_week_start(current_date);
  v_t1 := v_t0 - 7;
  v_t2 := v_t0 - 14;

  select id into v_wig_kt from wigs
   where class_id = v_lop and scope = 'class' and period = 'year'
     and measure_by <> 'cuon' and area = 'knowledge' limit 1;
  select id into v_wig_kn from wigs
   where class_id = v_lop and scope = 'class' and period = 'year'
     and measure_by <> 'cuon' and area <> 'knowledge' limit 1;
  if v_wig_kt is null then
    raise exception 'Lớp Test chưa có mục tiêu năm lĩnh vực Kiến thức.';
  end if;
  v_wig_kn := coalesce(v_wig_kn, v_wig_kt);

  -- ── DỌN SẠCH BA TUẦN ẤY TRƯỚC ─────────────────────────────────────────────────────────────
  -- Gỡ dấu chốt TRƯỚC, nếu không thì `khoa_sau_khi_chot` chặn chính lệnh xoá.
  update wig_meetings set chot_at = null, chot_by = null
   where class_id = v_lop and week_start in (v_t0, v_t1, v_t2);
  delete from wig_meetings where class_id = v_lop and week_start in (v_t0, v_t1, v_t2);
  delete from commitments  where class_id = v_lop and week_start in (v_t0, v_t1, v_t2);

  -- ── BA TUẦN ───────────────────────────────────────────────────────────────────────────────
  foreach v_tuan in array array[v_t2, v_t1, v_t0]
  loop
    v_i := case v_tuan when v_t2 then 1 when v_t1 then 2 else 3 end;

    -- CAM KẾT CỦA LỚP (cô đặt) + hai việc dẫn dắt (cô tick).
    insert into commitments (wig_id, class_id, week_start, title, area, created_by)
    values (v_wig_kt, v_lop, v_tuan,
            format('Tuần %s · cả lớp nộp bài đúng hạn', v_i), 'knowledge', v_gvcn)
    returning id into v_ck;

    insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
    values (v_ck, format('Nộp bài trước 21h (tuần %s)', v_i), 5, 'lần', '{1,2,3,4,5}', 1)
    returning id into v_lm;

    -- Cô tick: tuần 1 đủ 5, tuần 2 được 3, tuần 3 (đang chạy) mới 2.
    v_dem := case v_i when 1 then 5 when 2 then 3 else 2 end;
    for v_ngay in select generate_series(v_tuan, v_tuan + 4, interval '1 day')::date
    loop
      exit when v_dem <= 0;
      insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
      values (v_lm, null, v_gvcn, 1, v_ngay);
      v_dem := v_dem - 1;
    end loop;

    insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
    values (v_ck, format('Nhắc bạn cùng bàn (tuần %s)', v_i), 3, 'lần', '{1,3,5}', 1);

    -- ── TỪNG EM ─────────────────────────────────────────────────────────────────────────────
    for v_em in
      select e.student_id as id, p.full_name as ten,
             row_number() over (order by p.full_name) as thu_tu
      from enrollments e join profiles p on p.id = e.student_id
      where e.class_id = v_lop and e.is_active
    loop
      -- Mục tiêu năm của chính em, nếu có; không thì em hứa thẳng vào trận của lớp (0138).
      select id into v_wig_em from wigs
       where student_id = v_em.id and scope = 'student' and period = 'year' and kind = 'academic'
       limit 1;

      insert into commitments (wig_id, class_id, student_id, week_start, title, area, status, set_by)
      values (coalesce(v_wig_em, v_wig_kt), v_lop, v_em.id, v_tuan,
              format('Tuần %s · %s', v_i,
                     case (v_em.thu_tu % 4)
                       when 1 then 'mỗi tối làm bài trước 9 giờ'
                       when 2 then 'đọc 20 phút mỗi ngày'
                       when 3 then 'ôn lại bài ngay sau buổi học'
                       else 'hỏi thầy cô một câu mỗi ngày' end),
              'knowledge',
              -- Tuần đã qua thì cô đã duyệt; tuần đang chạy để một số em còn chờ duyệt, vì đó là
              -- trạng thái thật của một tuần đang giữa chừng.
              case when v_i < 3 or v_em.thu_tu % 3 <> 0 then 'approved' else 'sent' end,
              'student')
      returning id into v_ck;

      insert into lead_measures (commitment_id, title, target_value, unit, active_weekdays, unit_per_tick)
      values (v_ck, 'Làm bài buổi tối', 5, 'bài', '{1,2,3,4,5}', 1)
      returning id into v_lm;

      -- BỐN DÁNG NGƯỜI. Đây là thứ buổi họp phải phân biệt được.
      v_dem := case (v_em.thu_tu % 4)
                 when 1 then 5   -- đều đặn
                 when 2 then 2   -- bỏ giữa chừng
                 when 3 then 3   -- dồn cuối tuần
                 else 0          -- không làm gì
               end;
      -- Tuần đang chạy thì chưa ai đi hết quãng.
      if v_i = 3 then v_dem := greatest(v_dem - 2, 0); end if;

      if (v_em.thu_tu % 4) = 3 then
        -- Dồn cuối tuần: tick từ thứ Năm ngược lại.
        for v_ngay in select generate_series(v_tuan + 4, v_tuan, interval '-1 day')::date
        loop
          exit when v_dem <= 0;
          insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
          values (v_lm, v_em.id, v_em.id, 1, v_ngay);
          v_dem := v_dem - 1;
        end loop;
      else
        for v_ngay in select generate_series(v_tuan, v_tuan + 4, interval '1 day')::date
        loop
          exit when v_dem <= 0;
          insert into lead_progress (lead_measure_id, student_id, logged_by, value, logged_date)
          values (v_lm, v_em.id, v_em.id, 1, v_ngay);
          v_dem := v_dem - 1;
        end loop;
      end if;

      -- BIÊN BẢN RIÊNG + ba câu PDR, chỉ cho hai tuần đã họp.
      if v_i < 3 then
        insert into wig_meetings (class_id, student_id, week_label, week_start,
                                  results, commitments, kho_khan, vuot_qua, cach_tot_hon, coach_id)
        values (v_lop, v_em.id, 'W' || to_char(v_tuan, 'IW') || '-' || to_char(v_tuan, 'IYYY'), v_tuan,
                format('Tuần %s con làm được %s hôm', v_i,
                       case (v_em.thu_tu % 4) when 1 then '5' when 2 then '2' when 3 then '3' else '0' end),
                'Tuần tới con cố gắng đều hơn',
                case (v_em.thu_tu % 4)
                  when 1 then 'Có hôm bài nhiều quá'
                  when 2 then 'Con hay quên vào tối thứ Tư'
                  when 3 then 'Đầu tuần con lười'
                  else 'Con chưa bắt đầu được' end,
                case (v_em.thu_tu % 4)
                  when 1 then 'Con làm sớm hơn một tiếng'
                  when 2 then 'Nhờ mẹ nhắc'
                  when 3 then 'Bạn cùng bàn rủ con làm'
                  else 'Con chưa vượt qua được' end,
                'Đặt báo thức 20h30', v_gvcn);
      end if;

      -- V/X cho hai tuần đã họp: đạt đủ thì V, không thì X.
      if v_i < 3 then
        update commitments
           set verdict = case when (v_em.thu_tu % 4) = 1 then 'win' else 'lose' end,
               verdict_goi_y = cam_ket_goi_y(id),
               verdict_by = v_gvcn,
               verdict_at = now()
         where id = v_ck;
      end if;
    end loop;

    -- CHẤM V/X CHO CAM KẾT CỦA LỚP, và BIÊN BẢN LỚP + DẤU CHỐT — chỉ hai tuần đã họp.
    if v_i < 3 then
      update commitments
         set verdict = case when v_i = 1 then 'win' else 'lose' end,
             verdict_goi_y = cam_ket_goi_y(id), verdict_by = v_gvcn, verdict_at = now()
       where class_id = v_lop and week_start = v_tuan and student_id is null;

      insert into wig_meetings (class_id, student_id, week_label, week_start,
                                results, commitments, coach_id, mo_luc, chot_at, chot_by)
      values (v_lop, null, 'W' || to_char(v_tuan, 'IW') || '-' || to_char(v_tuan, 'IYYY'), v_tuan,
              format('Tuần %s: lớp %s', v_i, case when v_i = 1 then 'đạt cam kết' else 'chưa đạt' end),
              'Tuần tới cả lớp nộp bài đúng hạn hơn',
              v_gvcn, now(), now(), v_gvcn);
    end if;
  end loop;

  raise notice 'Đã gieo ba tuần cho lớp Test: % , % , %', v_t2, v_t1, v_t0;
end $$;

commit;
