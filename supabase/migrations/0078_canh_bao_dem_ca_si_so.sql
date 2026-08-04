-- Cảnh báo "cần quá nhiều lượt tick" phải đếm cả SĨ SỐ, và so đơn vị phải bỏ dấu.
--
-- HAI LỖI trong lead_measure_canh_bao (0076), do rà soát đối kháng tìm ra ngay sau khi áp:
--
-- 1) TRẦN TÍNH THIẾU SĨ SỐ. Với WIG của LỚP, cả lớp cùng tick vào một việc — trần không phải
--    "số ngày" mà là "số ngày × sĩ số". Lớp 7B1 chỉ có 3 em nên 7 ngày × 3 = 21 vẫn nhỏ hơn mục
--    tiêu 30, cảnh báo vẫn đúng và tôi không thấy lỗi. Nhưng một lớp 24 em thì trần là 168 — mọi
--    mục tiêu từ 8 tới 168 sẽ bị kêu oan là "không ai đạt nổi" trong khi hoàn toàn bình thường.
--    Báo động giả thì tệ hơn không báo: vài lần bị kêu oan là người ta thôi đọc cảnh báo.
--
--    WIG CÁ NHÂN giữ nguyên trần cũ — chỉ một em tick nên nhân sĩ số là sai theo chiều ngược lại.
--
-- 2) SO ĐƠN VỊ KHÔNG BỎ DẤU. Production đang có cả 'buoi' lẫn 'buổi' trong cùng cột đơn vị (dữ
--    liệu cũ gõ không dấu). Một WIG ghi 'buổi' mà việc dưới nó ghi 'buoi' là cùng một thứ, nhưng
--    lower(btrim()) coi là hai — lại một cảnh báo kêu oan nữa.
--
-- Đổi kiểu trả về (thêm cột trần và sĩ số để giao diện nói được con số cụ thể) nên phải drop trước.

set search_path = public;

-- Bỏ dấu tiếng Việt để so đơn vị. Dùng unaccent thì phải bật extension và nó không xử lý được
-- 'đ'; bảng thay thế tường minh dưới đây gọn hơn và đủ cho phạm vi này (tên đơn vị: buổi, lần,
-- phút, giờ, bài, tiết…).
create or replace function private.bo_dau(s text) returns text
  language sql immutable strict as $$
  select lower(btrim(translate(
    s,
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ' ||
    'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ',
    'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd' ||
    'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  )));
$$;
revoke all on function private.bo_dau(text) from public;
grant execute on function private.bo_dau(text) to authenticated, service_role;

drop function if exists lead_measure_canh_bao(uuid);

create function lead_measure_canh_bao(p_wig uuid)
returns table(
  lead_measure_id uuid,
  so_tick_can numeric,
  so_ngay_tick_duoc int,
  -- Số người có thể tick việc này: cả lớp với WIG lớp, một em với WIG cá nhân.
  so_nguoi_tick int,
  -- Trần thật = số ngày × số người. Đây mới là con số để so với `so_tick_can`.
  tran_luot_tick int,
  lech_don_vi boolean,
  qua_nhieu boolean
)
language sql stable security invoker set search_path = public as $$
  with x as (
    select
      lm.id,
      ceil(lm.target_value / lm.unit_per_tick) as tick_can,
      (select count(*)::int
         from generate_series(w.start_date, w.end_date, interval '1 day') g
        where extract(isodow from g)::smallint = any(lm.active_weekdays)) as so_ngay,
      case
        when w.scope = 'class'
          then greatest(
            (select count(*)::int from enrollments e where e.class_id = w.class_id and e.is_active),
            1)
        else 1
      end as so_nguoi,
      (lm.unit is not null and w.unit is not null
        and private.bo_dau(lm.unit) <> private.bo_dau(w.unit)
        and lm.unit_per_tick = 1) as lech
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where lm.wig_id = p_wig
  )
  select id, tick_can, so_ngay, so_nguoi, so_ngay * so_nguoi, lech,
         tick_can > so_ngay * so_nguoi
  from x;
$$;
revoke all on function lead_measure_canh_bao(uuid) from public, anon;
grant execute on function lead_measure_canh_bao(uuid) to authenticated;
