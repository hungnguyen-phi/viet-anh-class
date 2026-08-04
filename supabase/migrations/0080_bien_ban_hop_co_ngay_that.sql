-- Biên bản họp có NGÀY THẬT, thôi phụ thuộc nhãn chữ.
--
-- VẤN ĐỀ GỐC. wig_meetings chỉ có week_label — mà nhãn ấy là ô CHỮ TỰ DO trong MeetingForm.
-- Form điền sẵn nhãn đúng, nhưng ai sửa tay thành "Tuần 31" là mọi thứ tra theo nhãn đều trượt,
-- lặng lẽ. Đây đúng cặp "lọc theo nhãn vs lọc theo ngày" đã gây sự cố 7B1 ngày 03/08, và 0073 đã
-- ghi rõ lý do chọn ngày: "nhãn kỳ là chữ người gõ, có thể bỏ trống hoặc gõ khác quy ước, còn
-- start_date/end_date thì luôn có".
--
-- Chỗ đau nhất là dòng "Tuần trước lớp đã hứa…" mới thêm ở 0079: nó tra biên bản tuần trước bằng
-- nhãn, nên chỉ cần một lần gõ khác quy ước là vòng khép kín cam kết đứt — mà đứt thì không ai
-- thấy, dòng đó chỉ đơn giản không hiện.
--
-- CÁCH SỬA. Thêm cột week_start (thứ Hai của tuần họp), backfill từ nhãn cũ, và từ nay mọi đường
-- tra đi bằng ngày. week_label GIỮ LẠI để hiển thị và cho dữ liệu cũ — nó vẫn là thứ con người
-- đọc, chỉ thôi làm khoá tra cứu.

set search_path = public;

alter table wig_meetings add column if not exists week_start date;

comment on column wig_meetings.week_start is
  'Thứ Hai của tuần họp. KHOÁ TRA CỨU THẬT — week_label chỉ để hiển thị (là chữ người gõ). Xem 0080.';

-- Backfill từ nhãn cũ. Chỉ đụng những dòng đúng định dạng 'Wnn-YYYY'; dòng gõ khác quy ước để
-- NULL và nói ra ở cuối file, chứ không đoán bừa một ngày rồi gán vào biên bản của lớp.
--
-- Cẩn thận chỗ cắt chuỗi: substring('W31-2026' from 6) ra '026' → to_date hiểu thành năm 0026.
-- Phải from 5. (Đã suýt sai, kiểm bằng dữ liệu thật mới thấy.)
update wig_meetings
set week_start = to_date(
      substring(week_label from 5) || '-' || substring(week_label from 2 for 2), 'IYYY-IW')
where week_start is null
  and week_label ~ '^W\d{2}-\d{4}$';

create index if not exists ix_wig_meetings_tuan on wig_meetings (class_id, week_start);

-- ============================================================
-- Hàm dùng chung: nhãn ISO → thứ Hai
-- ============================================================
-- Để chỗ nào cần suy ngược từ nhãn cũ vẫn có một đường duy nhất, thay vì mỗi nơi tự cắt chuỗi
-- một kiểu (và tự mắc lại đúng cái bẫy from 5/from 6 ở trên).
create or replace function public.thu_hai_tu_nhan(nhan text) returns date
  language sql immutable as $$
  select case
    when nhan ~ '^W\d{2}-\d{4}$'
      then to_date(substring(nhan from 5) || '-' || substring(nhan from 2 for 2), 'IYYY-IW')
    else null
  end;
$$;
revoke all on function public.thu_hai_tu_nhan(text) from public, anon;
grant execute on function public.thu_hai_tu_nhan(text) to authenticated, service_role;

-- Báo lại những dòng không suy được ngày — để biết còn sót gì thay vì tưởng đã sạch.
do $$
declare v_sot int;
begin
  select count(*) into v_sot from wig_meetings where week_start is null;
  if v_sot > 0 then
    raise notice 'Còn % biên bản chưa suy được ngày (nhãn gõ khác quy ước) — chúng vẫn đọc được, chỉ không tham gia vòng cam kết.', v_sot;
  end if;
end $$;
