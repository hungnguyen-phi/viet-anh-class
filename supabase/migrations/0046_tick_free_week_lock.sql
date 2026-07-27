-- 0046 — Đổi mô hình tick: học sinh TỰ DO tick / gỡ tick / tick bù trong TUẦN,
--        khoá lại trước ngày họp. Yêu cầu-sửa thu về đúng 1 loại: đổi tên lead measure.
--
-- Quyết định 2026-07-27. Trước đó (0039) khoá theo NGÀY: chỉ sửa được logged_date = vn_today().
-- Hệ quả là hôm qua quên tick thì phải xin GVCN — thêm việc cho cả hai bên mà chẳng bảo vệ gì:
-- dữ liệu tick là em tự khai, không phải điểm số. Cái thực sự cần bảo vệ là "số liệu đã chốt để
-- HỌP" — nên chuyển từ khoá-theo-ngày sang khoá-theo-tuần.
--
-- Luật mới: được ghi/sửa/xoá tick của BẤT KỲ ngày trong TUẦN HIỆN TẠI (không vượt hôm nay),
-- MIỄN LÀ hôm nay chưa qua ngày khoá của lớp. Tuần trước thì khoá cứng.
set search_path = public;

-- ============================================================
-- 1) Ngày khoá theo lớp
-- ============================================================
-- 1=Thứ Hai … 7=Chủ Nhật (ISO). Mặc định 7 = mở suốt tuần, hết tuần là khoá.
-- Lớp họp WIG vào thứ Bảy thì đặt 5 (Thứ Sáu) → em sửa Hai→Sáu, Bảy/CN đã đóng, buổi họp đọc
-- số liệu đã chốt.
alter table classes
  add column if not exists tick_lock_dow smallint not null default 7;
alter table classes drop constraint if exists classes_tick_lock_dow_check;
alter table classes add constraint classes_tick_lock_dow_check
  check (tick_lock_dow between 1 and 7);

comment on column classes.tick_lock_dow is
  'ISO dow (1=T2..7=CN) — ngày CUỐI còn cho học sinh sửa tick của tuần. Sau ngày này tuần bị khoá.';

-- Thứ Hai của tuần chứa ngày cho trước (mặc định hôm nay theo giờ VN).
create or replace function vn_week_start(d date default null) returns date
  language sql stable set search_path = public as $$
  select (coalesce(d, vn_today()) - (extract(isodow from coalesce(d, vn_today()))::int - 1))::date;
$$;
grant execute on function vn_week_start(date) to authenticated;

-- Tuần này còn mở cho học sinh sửa tick không? SECURITY DEFINER vì hàm chỉ trả về BOOLEAN từ
-- một cột cấu hình của lớp — không lộ dữ liệu, mà nếu để INVOKER thì phụ thuộc RLS của classes.
create or replace function tick_open(p_class uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select extract(isodow from vn_today())::int
         <= coalesce((select c.tick_lock_dow from classes c where c.id = p_class), 7);
$$;
revoke all on function tick_open(uuid) from public, anon;
grant execute on function tick_open(uuid) to authenticated;

-- ============================================================
-- 2) RLS lead_progress: mở cả tuần, chặn tương lai, khoá theo ngày chốt
-- ============================================================
drop policy if exists lp_student_insert on lead_progress;
create policy lp_student_insert on lead_progress for insert
  with check (
    student_id = auth.uid() and logged_by = auth.uid()
    and is_class_student(lead_class(lead_measure_id))
    -- Trong tuần này, và KHÔNG được tick cho ngày chưa tới.
    and logged_date >= vn_week_start() and logged_date <= vn_today()
    and tick_open(lead_class(lead_measure_id))
  );

drop policy if exists lp_student_update on lead_progress;
create policy lp_student_update on lead_progress for update
  using (
    logged_by = auth.uid()
    and logged_date >= vn_week_start()
    and tick_open(lead_class(lead_measure_id))
  )
  with check (
    logged_by = auth.uid()
    and logged_date >= vn_week_start() and logged_date <= vn_today()
    and tick_open(lead_class(lead_measure_id))
  );

drop policy if exists lp_student_delete on lead_progress;
create policy lp_student_delete on lead_progress for delete
  using (
    logged_by = auth.uid()
    and logged_date >= vn_week_start()
    and tick_open(lead_class(lead_measure_id))
  );

-- GVCN/Admin KHÔNG đổi: lp_staff_manage vẫn sửa được mọi ngày (kể cả tuần đã khoá).

-- ============================================================
-- 3) Yêu cầu-sửa: chỉ còn ĐỔI TÊN lead measure
-- ============================================================
-- Tick giờ học sinh tự làm được nên undo_tick/add_tick thành vô nghĩa; change_target thì mục
-- tiêu là cam kết chốt trong buổi họp, sửa ở đó chứ không qua đơn từ. Bảng đang TRỐNG (đã kiểm)
-- nên siết CHECK an toàn.
-- `message` chính là TÊN MỚI mà em muốn (form hỏi đúng ô đó) → GVCN duyệt là áp được luôn,
-- không phải đọc văn xuôi rồi tự gõ lại.
alter table edit_requests drop constraint if exists edit_requests_kind_check;
alter table edit_requests add constraint edit_requests_kind_check
  check (kind in ('rename_lead'));

comment on column edit_requests.message is
  'Với kind=rename_lead: chính là TÊN MỚI của lead measure. GVCN duyệt → áp thẳng vào lead_measures.title.';
