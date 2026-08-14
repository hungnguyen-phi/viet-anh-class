-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0113 — ĐƠN VỊ ĐO LẠI: EM NHẬP SỐ MỖI NGÀY, MÁY LẤY SỐ CUỐI (KHÔNG CỘNG)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án chốt 14/08/2026, và câu của anh ấy gọn hơn mọi thứ tôi viết trước đó:
--
--   "loại như kg thì t2 nhập 35kg, t3 nhập 35.4kg, t5 nhập 35.2, t6 nhập 36kg… thì cuối cùng
--    so số đó với số cuối cùng 50kg, nếu có lớn hơn thì thắng, không thì thua"
--
-- Tôi đã lẫn hai chuyện khác nhau và đề xuất hẳn một cơ chế riêng cho loại này: "cộng lại không
-- có nghĩa" là ĐÚNG, nhưng "nhập hàng ngày không có nghĩa" là SAI. Cùng một ô nhập với giờ/bài/
-- trang; chỉ khác PHÉP GỘP — kia lấy tổng, đây lấy số mới nhất. Chính lib/don-vi.ts đã ghi sẵn
-- "con số MỚI NHẤT mới là con số thật" mà tôi vẫn đi vòng.
--
-- ── HAI CA CỦA CÙNG MỘT ĐƠN VỊ ──────────────────────────────────────────────────────────────
--
--   kg + measure_by='manual'  → con số sống ngoài app, không rải mốc (0111/0112 giữ nguyên).
--   kg + measure_by='tick'    → em nhập trong app ⇒ PHẢI có mốc tuần để treo việc nhập ấy.
--
-- 0112 chặn theo kiểu đơn vị nên chặn luôn ca thứ hai. Bản này trả lại đúng ranh giới: chỉ
-- 'manual' mới không rải. Mốc của đơn vị đo lại mang CON SỐ PHẢI ĐẠT theo dốc (35 → 50), không
-- phải lát cắt cộng dồn — phần rải nằm ở lib/wig-nhip.ts, đây chỉ lo phần CỘNG SỐ.

-- ── 1. KIỂU ĐƠN VỊ, BẢN SQL ────────────────────────────────────────────────────────────────
-- Gương của lib/don-vi.ts. Hai bên phải cùng một luật; đổi một bên thì đổi cả hai.
-- Bỏ dấu bằng unaccent thủ công để đơn vị gõ tay ("KG ", "diem", "Điểm trung bình") vẫn về đúng.
create or replace function kieu_don_vi(p_unit text)
returns text
language sql
immutable
as $$
  with u as (select btrim(lower(coalesce(p_unit, ''))) as v)
  select case
    when (select v from u) = '' then 'luong'
    -- LIỆT KÊ THẲNG cả bản có dấu lẫn bản gõ không dấu, thay vì tự dựng một bảng bỏ dấu.
    -- Bản đầu của hàm này dùng translate() với hai chuỗi gõ tay, và tôi đếm thừa đúng MỘT chữ
    -- 'a' ở vế phải — thế là mọi nguyên âm từ nhóm 'e' trở đi lệch một ô, "điểm" ra "diẹm" và
    -- rơi vào 'luong'. Một bảng 67 ký tự gõ tay thì không ai soát được bằng mắt; một danh sách
    -- tám chữ thì soát được.
    when (select v from u) in ('điểm', 'diem', 'kg', 'cm', '%') then 'do'
    when (select v from u) in ('buổi', 'buoi', 'lần', 'lan', 'ngày', 'ngay') then 'luot'
    -- "điểm trung bình", "kg tăng thêm" — khớp theo từ đầu, cùng luật với lib/don-vi.ts.
    when (select v from u) like 'điểm %' or (select v from u) like 'diem %' then 'do'
    when (select v from u) like 'kg %' or (select v from u) like 'cm %' then 'do'
    when (select v from u) like 'buổi %' or (select v from u) like 'buoi %' then 'luot'
    when (select v from u) like 'lần %' or (select v from u) like 'lan %' then 'luot'
    when (select v from u) like 'ngày %' or (select v from u) like 'ngay %' then 'luot'
    else 'luong'
  end;
$$;

-- ── 2. GỘP THEO KIỂU ───────────────────────────────────────────────────────────────────────
-- Số của một việc trong một khoảng: đơn vị đo lại thì lấy dòng có logged_date MỚI NHẤT (cùng
-- ngày thì lấy dòng ghi sau cùng); còn lại thì cộng.
create or replace function gop_lead(p_lead uuid, p_student uuid, p_tu date, p_den date)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when (select kieu_don_vi(lm.unit) from lead_measures lm where lm.id = p_lead) = 'do'
      then (
        select lp.value
        from lead_progress lp
        where lp.lead_measure_id = p_lead
          and (p_student is null or lp.student_id = p_student)
          and lp.logged_date between p_tu and p_den
        order by lp.logged_date desc, lp.created_at desc
        limit 1
      )
    else (
      select sum(lp.value)
      from lead_progress lp
      where lp.lead_measure_id = p_lead
        and (p_student is null or lp.student_id = p_student)
        and lp.logged_date between p_tu and p_den
    )
  end;
$$;
revoke all on function gop_lead(uuid, uuid, date, date) from public, anon;
grant execute on function gop_lead(uuid, uuid, date, date) to authenticated, service_role;

-- ── 3. ĐÃ TỚI ĐÍCH CHƯA — THEO HƯỚNG CỦA ĐÍCH ──────────────────────────────────────────────
-- Luật chủ dự án nói là "lớn hơn thì thắng", đúng với tăng cân 35 → 50. Nhưng lớp nào đặt
-- "giảm cân 60 → 55" hay "giảm lỗi chính tả 20 → 5" thì lớn hơn lại là THUA. App có sẵn số xuất
-- phát nên biết hướng — hỏi đúng câu "đã đi tới đích chưa", không phải "có lớn hơn không".
create or replace function toi_dich(p_so numeric, p_dich numeric, p_xuat_phat numeric)
returns boolean
language sql
immutable
as $$
  select case
    when p_so is null or p_dich is null then false
    -- Đích thấp hơn số xuất phát ⇒ đang đi xuống.
    when p_xuat_phat is not null and p_dich < p_xuat_phat then p_so <= p_dich
    else p_so >= p_dich
  end;
$$;
