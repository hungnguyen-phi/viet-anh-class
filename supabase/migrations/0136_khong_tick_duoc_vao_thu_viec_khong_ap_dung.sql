-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0136 — KHÔNG GHI ĐƯỢC LƯỢT TICK VÀO MỘT THỨ MÀ VIỆC ẤY KHÔNG ÁP DỤNG
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án nhìn màn của một em và nói: "chỗ làm bài thứ 6 tôi còn chưa tick mà vẫn tính 1/1".
--
-- Đúng. Việc "Làm bài thứ Sáu" bật đúng một thứ (active_weekdays = {5}), nhưng trong lead_progress
-- có sáu lượt ghi vào thứ Hai, Ba, Tư — và màn hình đếm chúng, hoàn toàn thành thật, ra "1/1 Xong".
--
-- ── VÌ SAO CÓ ĐƯỢC MẤY DÒNG ẤY ───────────────────────────────────────────────────────────────
--
-- Luật "chỉ tick đúng thứ" đã có từ 0073, nhưng nó nằm trong RLS (lead_day_ok). RLS bảo vệ người
-- dùng thật; nó KHÔNG chạm tới câu lệnh đi bằng quyền quản trị. Sáu dòng ấy do chính script gieo
-- dữ liệu lớp Test viết ra, và đi thẳng qua vì chạy bằng service_role.
--
-- Đây là bài học 0135 lặp lại theo chiều ngược: hôm ấy chốt chặn quyền chặn nhầm cả hệ thống; hôm
-- nay một luật DỮ LIỆU lại chỉ đứng ở tầng quyền, nên hệ thống đi qua được. Phân biệt cho rõ:
--
--   · "AI được ghi"      → thuộc về RLS. Người khác nhau thì quyền khác nhau.
--   · "GHI THẾ NÀO MỚI CÓ NGHĨA" → thuộc về TRIGGER. Không ai được phép, kể cả máy chủ, kể cả tôi
--     lúc gieo dữ liệu — vì một lượt tick vào thứ Hai cho việc chỉ làm thứ Sáu không mang nghĩa gì
--     cả, dù người viết nó là ai.
--
-- Một dòng vô nghĩa trong bảng đếm còn tệ hơn một dòng bị chặn oan: nó không báo lỗi, nó chỉ lặng
-- lẽ làm sai mọi con số phía sau — và con số ấy đi thẳng vào chuyện "em có giữ lời hứa không".
create or replace function private.tick_dung_thu()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_thu smallint[];
begin
  select active_weekdays into v_thu from lead_measures where id = new.lead_measure_id;

  -- Việc không khai thứ nào = làm ngày nào cũng được. Đừng suy thành "cấm mọi ngày".
  if v_thu is null or array_length(v_thu, 1) is null then
    return new;
  end if;

  if not (extract(isodow from new.logged_date)::smallint = any(v_thu)) then
    raise exception 'Việc này không áp dụng vào thứ %, nên không ghi được lượt nào vào ngày %.',
      extract(isodow from new.logged_date)::smallint, new.logged_date
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_tick_dung_thu on lead_progress;
create trigger trg_tick_dung_thu
  before insert or update of lead_measure_id, logged_date on lead_progress
  for each row execute function private.tick_dung_thu();

-- ── DỌN SÁU DÒNG ĐÃ LỠ VÀO ───────────────────────────────────────────────────────────────────
-- Xoá theo ĐÚNG ĐIỀU KIỆN vô nghĩa, không xoá theo tên việc hay theo ngày gieo: nếu còn dòng nào
-- khác cùng bệnh mà tôi chưa thấy, câu này dọn luôn.
delete from lead_progress lp
using lead_measures lm
where lm.id = lp.lead_measure_id
  and lm.active_weekdays is not null
  and array_length(lm.active_weekdays, 1) is not null
  and not (extract(isodow from lp.logged_date)::smallint = any(lm.active_weekdays));
