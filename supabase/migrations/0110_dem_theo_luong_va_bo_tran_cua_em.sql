-- ĐẾM THEO LƯỢNG — và bỏ trần tuần khỏi mục tiêu của CHÍNH EM.
--
-- Chủ dự án chốt 13/08/2026:
--   · đơn vị đếm được bằng một lượt (ngày, buổi, tiết, lần) → giữ MỘT CHẠM như hiện nay;
--   · đơn vị không đếm được bằng một lượt (giờ, bài, trang, lead) → ô ĐIỀN SỐ, điền là coi như tick;
--   · vòng tròn "Mục tiêu năm của con" phải cộng dồn CẢ NĂM: năm 5000 lead, thứ Hai điền 10 thì
--     nhích đúng 10/5000; năm 10000 giờ, một hôm 3 giờ thì nhích 3/10000.
--
-- ── VÌ SAO PHẢI BỎ TRẦN TUẦN (sửa chính bản 0109 của hôm nay) ────────────────────────────────
--
-- `wig_actual` kẹp phần đóng góp mỗi em ở `lead_measures.target_value`. Trần ấy sinh ra ở 0098 cho
-- WIG CỦA LỚP và lý do rất rõ: "mỗi em một bộ đếm" — một em làm gấp ba không được kéo bảng thi đua
-- của cả lớp lên, vì câu hỏi của lớp là "bao nhiêu em đã đủ phần mình".
--
-- Nhưng mục tiêu của CHÍNH EM không có câu hỏi ấy. Em làm nhiều hơn kế hoạch thì phải được tính
-- nhiều hơn — đó là toàn bộ ý nghĩa của một mục tiêu cá nhân. Với thiết kế điền số, cái trần này
-- còn chặn đúng thứ chủ dự án vừa mô tả: điền 10 mà chỉ tiêu tuần là 3 thì app lặng lẽ ghi 3, và
-- vòng tròn năm nhích sai. Lặng lẽ đổi con số người dùng vừa gõ là một kiểu nói dối khác.
--
-- Nên: giữ trần cho `scope='class'`, bỏ cho `scope='student'`.
--
-- Không có trần thì chặn số bịa ở đâu? Ở CHỖ NHẬP, và nói ra — xem ràng buộc `lp_luong_hop_le`
-- bên dưới: một ngày không được nhiều hơn cả chỉ tiêu một tuần. Chặn ở lúc gõ và báo cho người gõ
-- biết, thay vì âm thầm sửa con số của họ ở tầng đọc.

-- ── 1. CỜ "ĐẾM THEO LƯỢNG" ──────────────────────────────────────────────────────────────────
alter table lead_measures
  add column if not exists nhap_luong boolean not null default false;

comment on column lead_measures.nhap_luong is
  'true = ô ngày là ô ĐIỀN SỐ (giờ, bài, trang, lead…): điền số là coi như đã tick, và số ấy là '
  'lượng đóng góp của hôm đó. false = một chạm, mỗi lượt đúng 1 đơn vị (ngày, buổi, tiết, lần).';

-- ── 2. MỘT NGÀY KHÔNG VƯỢT CẢ TUẦN ──────────────────────────────────────────────────────────
-- Gõ nhầm 999 vào ô "giờ học" thì mục tiêu năm nhảy vọt trong một hôm. Chặn ở CSDL để mọi đường
-- ghi đều vướng, và chặn bằng một luật giải thích được: một ngày không thể nhiều hơn cả chỉ tiêu
-- của trọn một tuần. Làm dồn cả tuần vào Chủ Nhật thì vẫn lọt (bằng đúng chỉ tiêu tuần).
create or replace function private.chan_luong_vo_ly()
returns trigger language plpgsql as $$
declare tran numeric;
begin
  select lm.target_value into tran from lead_measures lm where lm.id = new.lead_measure_id;
  if tran is not null and tran > 0 and new.value > tran then
    raise exception 'Một ngày không ghi được nhiều hơn chỉ tiêu của cả tuần (%).', tran
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists lp_luong_hop_le on lead_progress;
create trigger lp_luong_hop_le before insert or update on lead_progress
for each row execute function private.chan_luong_vo_ly();

-- ── 3. TRẦN CHỈ CÒN CHO WIG CỦA LỚP ─────────────────────────────────────────────────────────
create or replace function private.wig_actual(w uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id, class_id, scope, student_id, start_date, end_date
    from wigs where id = w
    union all
    select c.id, c.class_id, c.scope, c.student_id, c.start_date, c.end_date
    from wigs c
    join descendants d on c.parent_wig_id = d.id
    where c.scope = d.scope
  ),
  viec as (
    select d.class_id, d.scope, d.student_id, d.start_date, d.end_date,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  theo_em as (
    select v.lead_id, v.class_id, v.scope,
           case
             -- WIG CỦA LỚP: giữ trần "mỗi em một bộ đếm" (0098), gom theo TUẦN (0109). Câu hỏi của
             -- lớp là "bao nhiêu em đã đủ phần mình", nên một em làm gấp ba không kéo cả lớp lên.
             when v.scope = 'class' and v.target_value > 0
               then least(sum(lp.value) * v.unit_per_tick, v.target_value)
             -- MỤC TIÊU CỦA CHÍNH EM: KHÔNG trần. Em làm nhiều hơn kế hoạch thì được tính nhiều
             -- hơn — đó là toàn bộ ý nghĩa của một mục tiêu cá nhân, và là điều kiện để vòng tròn
             -- năm cộng dồn đúng (5000 lead: điền 10 là nhích đúng 10). Số bịa đã bị chặn ở lúc gõ.
             else sum(lp.value) * v.unit_per_tick
           end as gop
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
     -- Mục tiêu của em chỉ đếm lượt tick của CHÍNH EM. WIG của lớp (student_id null) đếm hết.
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit_per_tick, lp.student_id,
             vn_week_start(lp.logged_date)
  )
  select coalesce(sum(t.gop), 0) from theo_em t;
$$;
