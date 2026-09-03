-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0177 — CAM KẾT TỰ LĂN SANG TUẦN SAU (chủ dự án 03/09/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Ý: cam kết tuần của EM không phải đặt lại mỗi tuần. Nếu tuần trước có cam kết mà em KHÔNG đổi,
-- thứ Hai đầu tuần này tự tạo một bản mới (cùng lời hứa + cùng lead measure) để em chấm Thắng/Thua
-- cho tuần này. Nếu em bấm "Đổi cam kết" (doiCamKet đánh dấu bản này 'huy') thì dòng NGỪNG lăn.
--
-- CƠ CHẾ DỪNG: "Đổi cam kết" (doiCamKet) đánh dấu bản hiện tại `trang_thai='huy'` (KHÔNG xoá).
-- Hàm chỉ lăn khi bản MỚI NHẤT của dòng (em × mục tiêu) còn 'hieu_luc'. Bản mới nhất là 'huy' →
-- dòng đã dừng → bỏ qua. (Đánh dấu chắc hơn "để lại khoảng trống": cron chạy hằng ngày cũng đúng,
-- và một tuần lỡ cron vẫn bắt kịp — chỉ cần bản mới nhất đã kết thúc là lăn.)
--
-- Idempotent + bắt kịp tuần lỡ: điều kiện là tuan_ket_thuc < thứ-Hai-tuần-này (đã kết thúc). Sau khi
-- lăn, bản mới nhất là của tuần này (tuan_ket_thuc = thứ Hai tuần này, KHÔNG < nó) nên lần sau bỏ qua.
--
-- CHỈ tạo HÀM ở đây — KHÔNG lịch cron. Bật cron là một bước riêng (scripts/bat-cron-lan-cam-ket.sql)
-- để chạy sau khi đã kiểm bằng scripts/test-lan-cam-ket.sql. Cài hàm này KHÔNG tự làm gì cả.
--
-- Chỉ EM (chu_the='em', student_id not null). Cam kết của lớp (cô) chưa lăn — để riêng.

create or replace function lan_cam_ket_tuan() returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_mon date := date_trunc('week', vn_today())::date;   -- thứ Hai tuần này (ISO week bắt đầu T2)
  v_n   int;
begin
  with latest as (
    -- Bản MỚI NHẤT của mỗi dòng (em × mục tiêu). Mục tiêu null → gộp bằng một uuid mốc.
    select distinct on (c.student_id, coalesce(c.muc_tieu_id, '00000000-0000-0000-0000-000000000000'::uuid))
           c.class_id, c.student_id, c.noi_dung, c.so_hua, c.don_vi_id, c.muc_tieu_id, c.thuoc_id,
           c.trang_thai, c.tuan_ket_thuc, c.chu_the
    from cam_ket c
    where c.chu_the = 'em' and c.student_id is not null
    order by c.student_id,
             coalesce(c.muc_tieu_id, '00000000-0000-0000-0000-000000000000'::uuid),
             c.tuan_bat_dau desc, c.created_at desc
  )
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id, thuoc_id)
  select 'em', l.class_id, l.student_id, l.noi_dung, l.so_hua, l.don_vi_id, 1, v_mon, l.muc_tieu_id, l.thuoc_id
  from latest l
  where l.trang_thai = 'hieu_luc'                 -- bản mới nhất còn hiệu lực (chưa bị "đổi"→huỷ)
    and l.tuan_ket_thuc < v_mon                   -- đã kết thúc (cần lăn tiếp; bắt kịp cả tuần lỡ)
    -- lead measure còn sống mới lăn kèm; nếu em đã xoá việc bổ trợ thì thuoc_id = null (vẫn lăn cam kết)
    and (l.thuoc_id is null
         or exists (select 1 from thuoc t where t.id = l.thuoc_id and t.trang_thai <> 'dong'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function lan_cam_ket_tuan() is
  'Thứ Hai đầu tuần: clone cam kết của em từ tuần trước sang tuần này (cùng lead measure) nếu dòng '
  'liền mạch (kết thúc đúng tuần trước). Em xoá bản tuần này = đứt dòng → tự ngừng. Idempotent. '
  'Cài hàm không tự chạy; bật lịch qua scripts/bat-cron-lan-cam-ket.sql.';

-- Chạy được cho scheduler nội bộ; KHÔNG cấp cho authenticated (không ai gọi tay).
revoke all on function lan_cam_ket_tuan() from public;
