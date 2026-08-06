-- NĂM HỌC BẮT ĐẦU THÁNG 7, KHÔNG PHẢI THÁNG 9 (VÀ MỐC NHÃN CŨNG DỜI THEO).
--
-- Chủ dự án báo: "2026-2027, mà tháng 7 là bắt đầu kỳ này rồi, không phải t9."
--
-- Trước khi sửa, NHÃN và KHOẢNG NGÀY của năm học nói hai chuyện khác nhau:
--   · nhãn  (current_school_year, schoolYearLabel) đổi ở THÁNG 6
--   · khoảng (schoolYearRangeVN, schoolYearOptions) là 01/09 → 31/05
-- Nghĩa là ngày 06/08/2026 mang nhãn '2026-2027' nhưng NẰM NGOÀI khoảng ngày của chính năm học
-- ấy. Hệ quả thấy được trên production: mục tiêu năm vừa tạo nhận start_date 2026-09-01, nên mọi
-- mục tiêu tháng và tuần treo dưới nó đều bị đẩy về sau tháng 9 — trong khi trường đã vào năm học
-- từ tháng 7. Người dùng đọc ra một app tự mâu thuẫn với chính nó.
--
-- Nay cả hai cùng một mốc: năm học Y-(Y+1) = 01/07/Y → 30/06/(Y+1). Không tháng nào rơi ra ngoài
-- mọi năm học, nên không còn khoảng trống để lỗi loại này quay lại.
--
-- Migration này chỉ đổi ĐÚNG mệnh đề tháng. Phần thân còn lại giữ nguyên như 0025 — chép lại
-- nguyên văn thay vì sửa tại chỗ, vì `create or replace` cần cả định nghĩa.
set search_path = public;

create or replace function current_school_year() returns text
  language sql stable set search_path = public as $$
  select case
    when extract(month from vn_today()) >= 7
      then extract(year from vn_today())::text || '-' || (extract(year from vn_today()) + 1)::text
    else (extract(year from vn_today()) - 1)::text || '-' || extract(year from vn_today())::text
  end;
$$;

comment on function current_school_year() is
  'Năm học VN hiện tại, dạng ''2026-2027''. Mốc chuyển ở THÁNG 7 — khớp schoolYearLabel và '
  'NGAY_DAU_NAM_HOC trong lib/dates.ts. Đổi mốc ở đây thì phải đổi cả hai chỗ kia.';

grant execute on function current_school_year() to authenticated, anon;

-- ── DỮ LIỆU ĐÃ CÓ ────────────────────────────────────────────────────────────────────────
-- Mục tiêu NĂM nào đang mang đúng khoảng cũ (01/09 → 31/05) thì kéo về khoảng mới. Chỉ đụng
-- những dòng khớp CẢ HAI đầu mốc cũ: lớp nào đã tự sửa ngày thì để yên, đó là ý của họ.
update wigs w
set start_date = (split_part(w.period_label, '-', 1) || '-07-01')::date,
    end_date   = (split_part(w.period_label, '-', 2) || '-06-30')::date
where w.period = 'year'
  and w.period_label ~ '^\d{4}-\d{4}$'
  and w.start_date = (split_part(w.period_label, '-', 1) || '-09-01')::date
  and w.end_date   = (split_part(w.period_label, '-', 2) || '-05-31')::date;
