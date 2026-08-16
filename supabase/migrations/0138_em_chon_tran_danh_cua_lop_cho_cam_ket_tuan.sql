-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0138 — MỖI TUẦN EM CHỌN HAI TRẬN ĐÁNH CỦA LỚP ĐỂ HỨA
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 16/08/2026: "lớp có 3 mục tiêu, nhưng trong 1 tuần em chỉ được tạo tối đa 2, và 2 cái
-- đó liên kết 2/3 hay 2/4 cái nào đó tuỳ em".
--
-- Trần hai cam kết đã có (chan_qua_hai_cam_ket, 0121). Cái còn thiếu là QUYỀN CHỌN: tới nay cam
-- kết của một em BẮT BUỘC treo dưới mục tiêu năm của chính em, mà mỗi em chỉ có một mục tiêu học
-- tập — nên tuần nào cũng hứa vào đúng một chỗ, không có gì để chọn. Lớp có ba bốn trận đánh mà
-- em không với tới được trận nào ngoài trận của mình.
--
-- Nay cam kết tuần của em treo được dưới MỤC TIÊU NĂM CỦA LỚP — em chọn tuần này mình đánh trận
-- nào. Hai cam kết, hai trận khác nhau hoặc cùng một trận, tuỳ em.
--
-- ── VẪN GIỮ ĐƯỜNG CŨ ─────────────────────────────────────────────────────────────────────────
--
-- Treo dưới mục tiêu năm CỦA CHÍNH EM vẫn hợp lệ, không bỏ. Có em đặt mục tiêu riêng ("chạy bộ
-- mỗi sáng") không thuộc trận nào của lớp, và cam kết tuần cho nó phải có chỗ đứng.
--
-- ── ĐIỀU KHÔNG NỚI ───────────────────────────────────────────────────────────────────────────
--
-- Mục tiêu ấy phải thuộc ĐÚNG LỚP em đang học, và em phải còn học lớp đó. Không có hai câu ấy thì
-- một em gửi tay lên id mục tiêu của lớp khác là con số của em đi vào bộ đếm của một lớp không
-- quen. Ranh giới giữa các lớp là ranh giới dữ liệu trẻ con, không phải một chi tiết kỹ thuật.
create or replace function private.cam_ket_hop_le()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare w record;
begin
  select * into w from wigs where id = new.wig_id;
  if not found then
    raise exception 'Mục tiêu năm không còn nữa.' using errcode = 'foreign_key_violation';
  end if;
  if w.period <> 'year' then
    raise exception 'Cam kết chỉ treo được dưới mục tiêu NĂM.' using errcode = 'check_violation';
  end if;
  -- Mục tiêu CUỘN không nhận việc: số của nó đếm ngược từ mục tiêu năm của từng em (0116), nên
  -- treo một cam kết vào đó là hứa với một cái không đếm lời hứa.
  if w.measure_by = 'cuon' then
    raise exception 'Mục tiêu cuộn không nhận cam kết tuần.' using errcode = 'check_violation';
  end if;

  if new.student_id is null then
    if w.scope::text <> 'class' or w.class_id is distinct from new.class_id then
      raise exception 'Cam kết của lớp phải treo dưới mục tiêu năm của CHÍNH lớp ấy.'
        using errcode = 'check_violation';
    end if;
  else
    -- HAI ĐƯỜNG HỢP LỆ, và chỉ hai:
    --   · mục tiêu năm của CHÍNH EM  (mục tiêu riêng, không thuộc trận nào của lớp);
    --   · mục tiêu năm CỦA LỚP EM ĐANG HỌC (em chọn trận đánh của tuần này — 0138).
    if not (
      (w.scope::text = 'student' and w.student_id is not distinct from new.student_id)
      or (w.scope::text = 'class' and w.class_id is not distinct from new.class_id)
    ) then
      raise exception 'Cam kết của một bạn phải treo dưới mục tiêu năm của chính bạn ấy, hoặc một mục tiêu năm của lớp bạn ấy.'
        using errcode = 'check_violation';
    end if;
    if not exists (select 1 from enrollments e
                   where e.student_id = new.student_id and e.class_id = new.class_id and e.is_active) then
      raise exception 'Bạn này không còn học ở lớp đó.' using errcode = 'check_violation';
    end if;
  end if;

  -- Lĩnh vực THỪA KẾ, không khai lại.
  new.area := w.area;
  return new;
end $$;
