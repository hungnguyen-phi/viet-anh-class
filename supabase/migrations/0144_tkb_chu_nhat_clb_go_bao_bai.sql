-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0144 — PRD v3 ĐỢT D: TKB CÓ CHỦ NHẬT + DẢI CLB · TẮT ĐƯỜNG SINH BÁO BÀI
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3 changelog #14–#15 (17/08/2026): TKB bổ sung Chủ Nhật và TKB CLB; Báo bài BỎ hoàn toàn.
--
-- "Mỗi tuần tự copy tuần trước" KHÔNG cần bảng theo tuần: mô hình hiện tại đã là MẪU TUẦN
-- CỐ ĐỊNH + ngoại lệ theo ngày (0029 + 0044) — tuần mới mặc định y hệt tuần cũ, GVCN chỉ sửa
-- chỗ thay đổi. Đúng hành vi PRD muốn mà không nhân bản dữ liệu, không cron.
--
-- ── CHỦ NHẬT = day_of_week 8 ────────────────────────────────────────────────────────────────
-- Cột này lưu số "thứ" kiểu VN (2=Thứ Hai … 7=Thứ Bảy), nên Chủ Nhật là 8 — không phải 1,
-- vì 1 chưa từng được dùng và đọc "thứ 1" là vô nghĩa với người Việt.
alter table timetable_slots drop constraint if exists timetable_slots_day_of_week_check;
alter table timetable_slots add constraint timetable_slots_day_of_week_check
  check (day_of_week between 2 and 8);

-- ── CLB: loại tiết mới, xếp ở DẢI RIÊNG dưới lưới tiết ─────────────────────────────────────
-- CLB chạy theo GIỜ (16:00–17:30) chứ không theo tiết, và một ngày có thể có nhiều CLB.
-- Để khỏi phá unique (class, thứ, tiết) đang giữ cho lưới chính khoá, CLB dùng period_no
-- 13–18 làm chỗ đứng (tiết thật chỉ tới 12) — UI không hiện số này, chỉ hiện giờ.
alter table timetable_slots drop constraint if exists timetable_slots_period_no_check;
alter table timetable_slots add constraint timetable_slots_period_no_check
  check (period_no between 1 and 18);
alter table timetable_slots drop constraint if exists timetable_slots_kind_check;
alter table timetable_slots add constraint timetable_slots_kind_check
  check (kind in ('regular', 'practice', 'exam', 'club'));
alter table timetable_slots
  add column if not exists start_time time,
  add column if not exists end_time time;
comment on column timetable_slots.start_time is
  'Giờ bắt đầu — chỉ dùng cho kind=club (chính khoá đi theo tiết).';

-- CLB phải nằm đúng dải của nó, và chính khoá không được lạc vào dải CLB — không có chốt này
-- thì một dòng club với period_no 3 sẽ chiếm mất ô tiết 3 của lưới chính khoá.
alter table timetable_slots drop constraint if exists timetable_slots_club_band_check;
alter table timetable_slots add constraint timetable_slots_club_band_check
  check ((kind = 'club') = (period_no between 13 and 18));

-- ── BÁO BÀI: tắt đường sinh, giữ bảng ───────────────────────────────────────────────────────
-- UI/route đã gỡ ở cùng đợt deploy này. Bảng homework_posts/homework_done GIỮ NGUYÊN thêm
-- ~1 tháng (quyết định 18/08/2026) — dữ liệu thật, xoá là không hoàn lại. Chỉ:
--   1. tắt trigger sinh thông báo (không còn ai đăng được, nhưng tắt cho tròn),
--   2. gỡ link /homework khỏi thông báo cũ — route không còn, bấm vào là 404.
drop trigger if exists trg_notify_homework_post on homework_posts;
drop function if exists notify_homework_post();
update notifications set link = null where link like '/homework%';
