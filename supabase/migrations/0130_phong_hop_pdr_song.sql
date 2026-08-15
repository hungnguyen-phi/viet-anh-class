-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0130 — PHÒNG HỌP PDR SỐNG: CÔ MỞ, CÁC EM VÀO, MỌI Ô ĐỔ VỀ NHAU NGAY LÚC GÕ
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án tả nguyên văn 15/08/2026:
--
--   "khi giáo viên ấn họp, tất cả màn hình của các em đều hiện phòng họp, xong rồi các em ấn
--    tham gia, gv sẽ biết ai đang tham gia... còn dữ liệu tất cả các em sẽ đổ về realtime khi vừa
--    điền xong cho dashboard của giáo viên... kết thúc buổi họp thì giáo viên ấn 'kết thúc' thì
--    tất cả màn hình phòng họp đều đóng lại"
--
-- ── BA CỘT MỚI, VÀ VÌ SAO KHÔNG DÙNG PRESENCE CỦA REALTIME ─────────────────────────────────
--
-- Supabase có sẵn Presence cho đúng việc "ai đang trong phòng". Không dùng, vì Presence đi qua
-- kênh broadcast — mà kênh broadcast thì ai đăng nhập cũng vào được nếu đoán trúng tên, và trong
-- phòng này là chữ của trẻ con. Cùng lý do 0111 đã chọn postgres_changes.
--
-- Nên "tham gia" là MỘT CỘT trên chính dòng biên bản của em: em bấm → ghi `tham_gia_luc` → gói
-- postgres_changes bay sang màn của cô, đúng đường đã dựng và đã áp RLS. Đổi lại, danh sách ấy
-- sống theo TUẦN chứ không phải theo phiên — nhưng chủ dự án đã chốt "không cần lưu lại trạng
-- thái ai từng tham gia", và một cột trên đúng dòng của tuần ấy là cách rẻ nhất thoả điều đó mà
-- không mở thêm một cửa nào.
alter table wig_meetings add column if not exists mo_luc timestamptz;
alter table wig_meetings add column if not exists tham_gia_luc timestamptz;

comment on column wig_meetings.mo_luc is
  'Dòng của LỚP: lúc cô bấm "Bắt đầu họp". mo_luc có + chot_at rỗng = phòng đang mở.';
comment on column wig_meetings.tham_gia_luc is
  'Dòng của EM: lúc em bấm "Tham gia". Chỉ để cô biết ai đang ngồi trong phòng.';

-- ── BA CÂU HỎI CỦA BIÊN BẢN PDR ────────────────────────────────────────────────────────────
--
-- PRD v3 viết rõ ba câu, và giải thích luôn vì sao chỉ có ba: "Thực ra 6 câu nhưng một số câu đã
-- được trả lời bằng hành động: weekly commitment tuần trước, tick, weekly commitment tuần sau."
--
-- Ba cột riêng chứ không nhét chung vào `results`: mỗi câu là một câu hỏi khác nhau, và gộp lại
-- thành một ô chữ thì Dashboard PDR sau này không đọc tách ra được nữa.
alter table wig_meetings add column if not exists kho_khan text;
alter table wig_meetings add column if not exists vuot_qua text;
alter table wig_meetings add column if not exists cach_tot_hon text;

comment on column wig_meetings.kho_khan is 'PDR: "Khó khăn bạn đã gặp là gì?"';
comment on column wig_meetings.vuot_qua is 'PDR: "Bạn đã vượt qua như thế nào?"';
comment on column wig_meetings.cach_tot_hon is 'PDR: "Có cách nào tốt hơn không?"';

-- ── 1. CÔ MỞ PHÒNG ─────────────────────────────────────────────────────────────────────────
-- Mở phòng KHÔNG phải là chốt tuần: `chot_at` để nguyên rỗng. Hai việc ấy từng bị gộp làm một ở
-- bản 0121 của tuan_da_chot và đã phải sửa (0122) — mở phòng mà khoá luôn cam kết thì buổi họp
-- không còn gì để làm.
create or replace function mo_phong_hop(p_class uuid, p_week_start date, p_week_label text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not staff_can_manage_class(p_class) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp này mới mở được buổi họp.' using errcode = '42501';
  end if;

  insert into wig_meetings (class_id, student_id, week_label, week_start, mo_luc, coach_id)
  values (p_class, null, p_week_label, p_week_start, now(), auth.uid())
  on conflict (class_id, week_label) where student_id is null
  do update set
    mo_luc = now(),
    -- Mở lại một tuần đã chốt thì gỡ dấu chốt: đó chính là ý của việc bấm "Bắt đầu họp" lần nữa.
    chot_at = null,
    chot_by = null;
end $$;
revoke all on function mo_phong_hop(uuid, date, text) from public, anon;
grant execute on function mo_phong_hop(uuid, date, text) to authenticated, service_role;

-- ── 2. EM VÀO PHÒNG ────────────────────────────────────────────────────────────────────────
-- Chỉ ghi dấu có mặt. KHÔNG đụng tới chữ em đã viết — bấm Tham gia hai lần không được xoá bài.
create or replace function hs_tham_gia(p_class uuid, p_week_label text, p_week_start date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Chưa đăng nhập.' using errcode = '42501';
  end if;
  if not exists (select 1 from enrollments
                 where class_id = p_class and student_id = v_me and is_active) then
    raise exception 'Bạn không học lớp này.' using errcode = '42501';
  end if;

  insert into wig_meetings (class_id, student_id, week_label, week_start, tham_gia_luc)
  values (p_class, v_me, p_week_label, p_week_start, now())
  on conflict (student_id, week_label) where student_id is not null
  do update set tham_gia_luc = now();
end $$;
revoke all on function hs_tham_gia(uuid, text, date) from public, anon;
grant execute on function hs_tham_gia(uuid, text, date) to authenticated, service_role;

-- ── 3. BA CÂU HỎI ĐI CÙNG ĐƯỜNG GHI CŨ ─────────────────────────────────────────────────────
-- Giữ nguyên tên hàm và hai tham số cũ để đường ghi hiện tại không đứt; ba câu mới đi kèm với
-- giá trị mặc định, nên nơi gọi cũ vẫn chạy y nguyên.
--
-- `hs_go_luc` vẫn đóng dấu ở mỗi lượt ghi: đó là thứ làm chữ "… đang điền" hiện lên màn của cô.
create or replace function hs_ghi_bien_ban(
  p_class uuid,
  p_week_label text,
  p_week_start date,
  p_ket_qua text,
  p_cam_ket text,
  p_kho_khan text default null,
  p_vuot_qua text default null,
  p_cach_tot_hon text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Chưa đăng nhập.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from enrollments
    where class_id = p_class and student_id = v_me and is_active
  ) then
    raise exception 'Bạn không học lớp này.' using errcode = '42501';
  end if;

  if exists (
    select 1 from wig_meetings
    where class_id = p_class and week_label = p_week_label
      and student_id is null and chot_at is not null
  ) then
    raise exception 'Buổi họp tuần này đã chốt.' using errcode = 'P0002';
  end if;

  insert into wig_meetings (class_id, student_id, week_label, week_start, results, commitments,
                            kho_khan, vuot_qua, cach_tot_hon, hs_go_luc)
  values (p_class, v_me, p_week_label, p_week_start,
          nullif(btrim(p_ket_qua), ''), nullif(btrim(p_cam_ket), ''),
          nullif(btrim(p_kho_khan), ''), nullif(btrim(p_vuot_qua), ''),
          nullif(btrim(p_cach_tot_hon), ''), now())
  on conflict (student_id, week_label) where student_id is not null
  do update set
    results      = nullif(btrim(p_ket_qua), ''),
    commitments  = nullif(btrim(p_cam_ket), ''),
    kho_khan     = nullif(btrim(p_kho_khan), ''),
    vuot_qua     = nullif(btrim(p_vuot_qua), ''),
    cach_tot_hon = nullif(btrim(p_cach_tot_hon), ''),
    hs_go_luc    = now();
end $$;
revoke all on function hs_ghi_bien_ban(uuid, text, date, text, text, text, text, text) from public, anon;
grant execute on function hs_ghi_bien_ban(uuid, text, date, text, text, text, text, text)
  to authenticated, service_role;

-- ── 4. PHÒNG ĐANG MỞ KHÔNG ─────────────────────────────────────────────────────────────────
-- Một câu hỏi, một câu trả lời, dùng chung cho cả màn của cô lẫn màn của em — hai bên mà tự suy
-- theo hai cách thì sẽ có lúc cô thấy phòng mở còn em thấy đóng.
create or replace function phong_dang_mo(p_class uuid, p_week_label text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from wig_meetings m
    where m.class_id = p_class and m.week_label = p_week_label
      and m.student_id is null and m.mo_luc is not null and m.chot_at is null
  );
$$;
revoke all on function phong_dang_mo(uuid, text) from public, anon;
grant execute on function phong_dang_mo(uuid, text) to authenticated, service_role;
