-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0132 — TRẦN LƯỢT TICK: GIỮ NGUYÊN "MỖI EM MỘT BỘ ĐẾM" (khôi phục sau một bản vá sai)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- GHI LẠI MỘT LẦN VÁ NHẦM BÊN, vì cái bẫy này sẽ còn giăng lại.
--
-- scripts/test-moi-lan-tick.mjs đối chiếu hai phép tính cảnh báo — một trong CSDL, một trong
-- app/[locale]/(dashboard)/wig/page.tsx — và báo lệch: SQL nói trần là 5, JS nói 35 (5 ngày × 7
-- em). Nhìn qua thì CSDL sai, vì hàm có tính `so_nguoi` rồi không dùng tới. Đã sửa theo hướng ấy.
--
-- SAI. Phép nhân sĩ số bị bỏ CÓ CHỦ Ý ở 0098 ("mỗi em một bộ đếm"), và trang /wig ghi rõ lý do:
--
--     "TRẦN LÀ TRẦN CỦA MỘT EM (0098). Mục tiêu nay là 'mỗi em bao nhiêu', nên số em không dự
--      phần vào phép tính nữa: một em nhiều nhất cũng chỉ tick được mỗi ngày một lượt... Bản
--      trước nhân với sĩ số vì hồi ấy cả lớp đổ chung vào một bộ đếm — nay giữ lại phép nhân ấy
--      là bỏ sót đúng những mục tiêu không em nào đạt nổi ở lớp đông."
--
-- Nghĩa là nhân sĩ số vào trần sẽ LÀM CÂM cảnh báo đúng lúc nó cần kêu nhất: lớp 30 em, việc bật
-- 5 ngày, chỉ tiêu 10 lượt cho MỖI EM — bất khả với từng đứa trẻ, nhưng trần giả 150 nói là ổn.
-- Bản vá sai ấy đổi một cảnh báo thừa (khó chịu) lấy một cảnh báo thiếu (nguy hiểm).
--
-- Bên cũ là BỘ KIỂM: nó vẫn nhân sĩ số theo lối trước 0098. Đã sửa phép tính JS trong bộ kiểm.
--
-- Bài học, đúng thứ đã ghi trong trí nhớ dự án: hai nguồn cùng một phép tính mà lệch nhau thì
-- phải tìm ra bên nào có LÝ DO ĐƯỢC GHI LẠI, rồi mới sửa bên kia. Ở đây lý do nằm ngay trong
-- chú thích của trang, cách chỗ tôi đang sửa vài dòng.
--
-- Định nghĩa dưới đây đúng bằng bản 0122 — chạy lại để gỡ bản vá sai đã lỡ áp lên production.
create or replace function public.lead_measure_canh_bao(p_commitment uuid)
returns table(lead_measure_id uuid, so_tick_can numeric, so_ngay_tick_duoc integer,
              so_nguoi_tick integer, tran_luot_tick integer, lech_don_vi boolean, qua_nhieu boolean)
language sql
stable
set search_path to 'public'
as $$
  with x as (
    select
      lm.id,
      ceil(lm.target_value / lm.unit_per_tick) as tick_can,
      (select count(*)::int
         from generate_series(c.week_start, c.week_start + 6, interval '1 day') g
        where extract(isodow from g)::smallint = any(lm.active_weekdays)) as so_ngay,
      -- Vẫn TRẢ VỀ sĩ số như một con số để đọc, nhưng KHÔNG đưa vào trần (0098). Ai đọc hàm này
      -- mà thấy `so_nguoi` không dự phần vào phép so thì đó là cố ý — xem phần đầu tệp.
      case
        when c.student_id is null
          then greatest((select count(*)::int from enrollments e
                         where e.class_id = c.class_id and e.is_active), 1)
        else 1
      end as so_nguoi,
      (lm.unit is not null and w.unit is not null
        and private.bo_dau(lm.unit) <> private.bo_dau(w.unit)
        and lm.unit_per_tick = 1) as lech
    from lead_measures lm
    join commitments c on c.id = lm.commitment_id
    join wigs w on w.id = c.wig_id
    where lm.commitment_id = p_commitment
  )
  select id, tick_can, so_ngay, so_nguoi, so_ngay, lech, tick_can > so_ngay
  from x;
$$;
revoke all on function public.lead_measure_canh_bao(uuid) from public, anon;
grant execute on function public.lead_measure_canh_bao(uuid) to authenticated, service_role;
