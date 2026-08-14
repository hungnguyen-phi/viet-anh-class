-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0121 — MỘT TẦNG WIG NĂM, MỖI TUẦN LÀ CAM KẾT. BỎ THÁNG, BỎ WIG TUẦN.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án chốt 14/08/2026, sau vòng comment PRD v3 của anh Nguyễn Mạnh Dương:
--
--   "wig thì chỉ tạo wig năm thôi, gv tạo cho lớp, hs tạo cho hs gắn theo lớp, sau đó ko còn
--    tháng nữa, sau đó mỗi tuần sẽ là weekly commitment, không còn là wig tuần nữa, và tick lead
--    measure thì cũng ko tính vào thắng thua nữa, và nút thắng thua thì nó là V hoặc X ở trong
--    phần họp wig thôi là được rồi. và mỗi lần chỉ được thực hiện đúng 2 commitment"
--
-- ── BỐN THỨ ĐỔI HẲN ─────────────────────────────────────────────────────────────────────────
--
-- 1. WIG chỉ còn CẤP NĂM. Không tháng, không tuần, không rải nhịp. Cỗ máy chia mốc (chiaNhip,
--    sinhNhip) mất chỗ đứng — kể cả bản vá "35→50kg mà bắt tăng 1kg mỗi tuần" sáng nay: khi
--    không còn mốc tuần thì câu hỏi ấy tự biến mất.
--
-- 2. TUẦN LÀ CAM KẾT, không phải mục tiêu con. Cam kết là một LỜI HỨA ("mỗi tối làm bài Toán
--    trước 9 giờ"), nên nó KHÔNG có con số đích của riêng nó — con số nằm ở các việc dẫn dắt
--    treo dưới. Đây là lý do nó phải là bảng riêng chứ không nhét tiếp vào `wigs`: cột
--    target_value của wigs là NOT NULL, và ép một lời hứa mang một con số là ép sai ngay từ
--    kiểu dữ liệu.
--
-- 3. TICK KHÔNG CÒN CHẤM THẮNG/THUA. Tick trở về đúng vai trò 4DX: bằng chứng hành vi để nhìn
--    khi họp. Thắng/thua là V hoặc X do NGƯỜI bấm trong phòng họp.
--
--    Máy vẫn gợi ý: đủ mọi việc dẫn dắt → gợi V, chưa đủ → gợi X. Và lưu CẢ HAI — máy gợi gì,
--    người chọn gì. Không lưu thì "cô chấm khác máy" thành vô hình, mà đúng chỉ số thứ ba của
--    Dashboard PDR ("weekly commitment đã thay đổi") lại cần đúng vệt ấy.
--
-- 4. TỐI ĐA 2 CAM KẾT mỗi tuần, cho cả lớp lẫn từng em. Chủ dự án: "bản chất wig thì nên giới
--    hạn ở như vậy cho dễ tập trung." Và tối đa 10 việc dẫn dắt mỗi tuần cho mỗi bên.
--
-- ── XOÁ SẠCH RỒI DỰNG LẠI ───────────────────────────────────────────────────────────────────
-- Chủ dự án: "xóa những bộ wig cũ, lead measure cũ vì nó neo nhau, sau khi code xong bộ mới thì
-- tạo lại". Đã đếm trước khi xoá — 79 mốc tháng/tuần đều RỖNG (không việc, không tick), chúng
-- là giàn giáo do sinhNhip tự rải chứ không phải thứ ai gõ vào. Bản sao lưu JSON của cả sáu bảng
-- đã cất ở scratchpad trước khi chạy file này.

-- ── 1. DỌN ─────────────────────────────────────────────────────────────────────────────────
-- Con trước, cha sau: wigs.parent_wig_id là NO ACTION nên xoá một phát cả bảng sẽ vướng khoá
-- ngoại giữa chừng. Lead measures và mọi tick, ghi chú, số đo đi theo bằng cascade.
delete from wigs where parent_wig_id is not null;
delete from wigs;

-- ── 2. WIG CHỈ CÒN CẤP NĂM ─────────────────────────────────────────────────────────────────
-- Giữ nguyên cột `period` thay vì bỏ đi: nó vẫn nói đúng thứ nó nói, và một CHECK ở đây là chỗ
-- rẻ nhất để mọi đường ghi cũ còn sót lại phải lộ ra ngay thay vì âm thầm tạo lại mốc tháng.
alter table wigs drop constraint if exists wig_chi_con_nam_ck;
alter table wigs add constraint wig_chi_con_nam_ck check (
  period = 'year' and parent_wig_id is null
);

-- ── 3. CAM KẾT TUẦN ────────────────────────────────────────────────────────────────────────
create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  -- Bắt buộc neo vào một WIG NĂM. Cam kết không neo vào đâu là một lời hứa không phục vụ mục
  -- tiêu nào — đúng thứ 4DX gọi là bận rộn mà không tiến.
  wig_id uuid not null references wigs(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  -- null = cam kết CỦA LỚP. Có giá trị = cam kết của một em.
  student_id uuid references profiles(id) on delete cascade,
  week_start date not null,
  title text not null,
  -- Tag 1 trong 4 lĩnh vực. Thừa kế từ WIG năm ở trigger bên dưới, không để người khai lại:
  -- khai lệch một cái là cam kết rơi khỏi cây tổng hợp mà nhìn màn hình vẫn thấy nằm đúng chỗ.
  area wig_area not null,
  -- V / X do NGƯỜI bấm trong phòng họp.
  verdict text check (verdict in ('win', 'lose')),
  -- Máy gợi ý gì tại thời điểm chấm. Giữ lại để biết người có đổi ý so với máy hay không.
  verdict_goi_y text check (verdict_goi_y in ('win', 'lose')),
  verdict_by uuid references profiles(id) on delete set null,
  verdict_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  constraint commitment_title_ck check (length(btrim(title)) between 1 and 160),
  -- Thứ Hai theo giờ Việt Nam. Không chốt thì hai người mở hai máy khác múi giờ sẽ tạo ra hai
  -- "tuần này" lệch nhau một ngày, và mọi phép đếm theo tuần bắt đầu nói dối.
  constraint commitment_thu_hai_ck check (extract(isodow from week_start) = 1),
  -- Chấm rồi thì phải biết ai chấm, lúc nào.
  constraint commitment_verdict_ck check (
    (verdict is null and verdict_at is null) or (verdict is not null and verdict_at is not null)
  )
);

create index if not exists idx_commitments_lop_tuan on commitments(class_id, week_start);
create index if not exists idx_commitments_em_tuan on commitments(student_id, week_start)
  where student_id is not null;
create index if not exists idx_commitments_wig on commitments(wig_id);

comment on table commitments is
  'Cam kết tuần (weekly commitment) — thay cho WIG tuần. Tối đa 2 mỗi tuần cho mỗi bên; thắng/thua do người chấm trong phòng họp.';

-- ── 4. VIỆC DẪN DẮT TREO DƯỚI CAM KẾT ──────────────────────────────────────────────────────
-- `wig_id` GIỮ LẠI nhưng thôi là thứ người khai: trigger suy ra từ cam kết. Nó là bản sao có sẵn
-- để hàng chục chỗ đọc "việc này phục vụ mục tiêu nào, lớp nào" không phải nối thêm một bảng —
-- một CACHE, không phải nguồn thứ hai, vì không đường nào ghi thẳng vào nó được.
alter table lead_measures add column if not exists commitment_id uuid references commitments(id) on delete cascade;
-- Bảng vừa bị dọn sạch nên siết NOT NULL được ngay, không phải chừa đường cho dữ liệu cũ.
alter table lead_measures alter column commitment_id set not null;
create index if not exists idx_lead_measures_commitment on lead_measures(commitment_id);

create or replace function private.lead_theo_cam_ket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
begin
  select * into c from commitments where id = new.commitment_id;
  if not found then
    raise exception 'Cam kết không còn nữa.' using errcode = 'foreign_key_violation';
  end if;
  -- Suy ra, không nhận: người gọi có gửi wig_id gì cũng bị đè.
  new.wig_id := c.wig_id;
  return new;
end $$;

drop trigger if exists trg_lead_theo_cam_ket on lead_measures;
create trigger trg_lead_theo_cam_ket
  before insert or update of commitment_id on lead_measures
  for each row execute function private.lead_theo_cam_ket();

-- ── 5. HAI CÁI TRẦN ────────────────────────────────────────────────────────────────────────
-- Tối đa 2 cam kết mỗi tuần cho mỗi bên. KHÔNG dùng chỉ mục duy nhất được: "tối đa 2" không phải
-- một khoá. Đếm trong trigger, và đếm ở mức SERIALIZABLE của chính câu lệnh — hai tab mở song
-- song vẫn có thể lách, nhưng đây là lớp bảo vệ thứ hai; lớp thứ nhất là giao diện.
create or replace function private.chan_qua_hai_cam_ket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_dem integer;
begin
  select count(*) into v_dem
  from commitments c
  where c.class_id = new.class_id
    and c.week_start = new.week_start
    and c.student_id is not distinct from new.student_id
    and c.id is distinct from new.id;
  if v_dem >= 2 then
    raise exception 'Mỗi tuần chỉ đặt tối đa 2 cam kết. Hãy bỏ bớt một cái trước khi thêm.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_chan_qua_hai_cam_ket on commitments;
create trigger trg_chan_qua_hai_cam_ket
  before insert or update of class_id, student_id, week_start on commitments
  for each row execute function private.chan_qua_hai_cam_ket();

-- Tối đa 10 việc dẫn dắt mỗi tuần cho mỗi bên — đếm NGANG cả hai cam kết, không phải mỗi cam kết
-- 10 cái. Chốt từ vòng comment PRD: "không quá 10 lead measure/tuần".
create or replace function private.chan_qua_muoi_viec()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  v_dem integer;
begin
  select * into c from commitments where id = new.commitment_id;
  select count(*) into v_dem
  from lead_measures lm
  join commitments cc on cc.id = lm.commitment_id
  where cc.class_id = c.class_id
    and cc.week_start = c.week_start
    and cc.student_id is not distinct from c.student_id
    and lm.id is distinct from new.id;
  if v_dem >= 10 then
    raise exception 'Mỗi tuần tối đa 10 việc dẫn dắt.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_chan_qua_muoi_viec on lead_measures;
create trigger trg_chan_qua_muoi_viec
  before insert or update of commitment_id on lead_measures
  for each row execute function private.chan_qua_muoi_viec();

-- "Mỗi mục tiêu của học sinh chỉ được có một việc" (0100) hết nghĩa: nay em có tối đa 2 cam kết
-- và tối đa 10 việc mỗi tuần.
-- Trigger nào đang gọi nó thì tên có thể khác trg_chan_viec_thu_hai (0100 đặt tên riêng), nên
-- gỡ bằng CASCADE thay vì đoán tên — và đây là chỗ cascade an toàn: hàm này chỉ có đúng một
-- công dụng là chặn việc thứ hai, không ai gọi nó vào việc gì khác.
drop function if exists private.chan_viec_thu_hai() cascade;

-- ── 6. CAM KẾT PHẢI KHỚP VỚI MỤC TIÊU NÓ PHỤC VỤ ───────────────────────────────────────────
create or replace function private.cam_ket_hop_le()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare w record;
begin
  select * into w from wigs where id = new.wig_id;
  if not found then
    raise exception 'Mục tiêu năm không còn nữa.' using errcode = 'foreign_key_violation';
  end if;
  if w.period <> 'year' then
    raise exception 'Cam kết chỉ treo được dưới mục tiêu NĂM.' using errcode = 'check_violation';
  end if;
  -- Mục tiêu CUỘN không nhận việc: số của nó đếm ngược từ mục tiêu năm của từng em (0116), nên
  -- treo một cam kết vào đó là hứa với một cái không đếm lời hứa.
  if w.measure_by = 'cuon' then
    raise exception 'Mục tiêu cuộn không nhận cam kết tuần.' using errcode = 'check_violation';
  end if;
  if new.student_id is null then
    if w.scope::text <> 'class' or w.class_id is distinct from new.class_id then
      raise exception 'Cam kết của lớp phải treo dưới mục tiêu năm của CHÍNH lớp ấy.'
        using errcode = 'check_violation';
    end if;
  else
    if w.scope::text <> 'student' or w.student_id is distinct from new.student_id then
      raise exception 'Cam kết của một bạn phải treo dưới mục tiêu năm của CHÍNH bạn ấy.'
        using errcode = 'check_violation';
    end if;
    if not exists (select 1 from enrollments e
                   where e.student_id = new.student_id and e.class_id = new.class_id and e.is_active) then
      raise exception 'Bạn này không còn học ở lớp đó.' using errcode = 'check_violation';
    end if;
  end if;
  -- Lĩnh vực THỪA KẾ, không khai lại.
  new.area := w.area;
  return new;
end $$;

drop trigger if exists trg_cam_ket_hop_le on commitments;
create trigger trg_cam_ket_hop_le
  before insert or update of wig_id, class_id, student_id on commitments
  for each row execute function private.cam_ket_hop_le();

-- ── 7. TUẦN ĐÃ CHỐT THÌ THÔI SỬA ───────────────────────────────────────────────────────────
-- Luật từ vòng comment: "mỗi tuần chỉ có thể sửa trong ngày họp PDR".
--
-- Đọc thành cơ chế: cam kết được đặt và chỉnh CHO TỚI KHI buổi họp của tuần ấy được ghi nhận;
-- ghi nhận xong là đóng cho tuần ấy. Dùng đúng cái mốc đã có (wig_meetings) thay vì thêm một
-- lịch PDR riêng — lịch PDR từng em là phần của đợt sau, và đoán trước nó ở đây thì sẽ phải gỡ.
create or replace function tuan_da_chot(p_class uuid, p_student uuid, p_week date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from wig_meetings m
    where m.class_id = p_class
      and m.week_start = p_week
      and m.student_id is not distinct from p_student
  );
$$;
revoke all on function tuan_da_chot(uuid, uuid, date) from public, anon;
grant execute on function tuan_da_chot(uuid, uuid, date) to authenticated, service_role;

create or replace function private.khoa_sau_khi_chot()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare c record;
begin
  c := coalesce(new, old);
  -- Chấm V/X thì CHÍNH LÀ việc làm trong buổi họp — không được tự khoá mình.
  if tg_op = 'UPDATE' and new.class_id = old.class_id and new.wig_id = old.wig_id
     and new.title = old.title and new.week_start = old.week_start
     and new.student_id is not distinct from old.student_id then
    return new;
  end if;
  if tuan_da_chot(c.class_id, c.student_id, c.week_start) then
    raise exception 'Tuần này đã chốt trong buổi họp — không sửa cam kết được nữa.'
      using errcode = 'check_violation';
  end if;
  return c;
end $$;

drop trigger if exists trg_khoa_sau_khi_chot on commitments;
create trigger trg_khoa_sau_khi_chot
  before insert or update or delete on commitments
  for each row execute function private.khoa_sau_khi_chot();

-- ── 8. MÁY GỢI Ý THẮNG/THUA ────────────────────────────────────────────────────────────────
-- "Đủ" = MỌI việc dẫn dắt của cam kết đều chạm chỉ tiêu tuần của nó. Cam kết không có việc nào
-- thì chưa có gì để nói là đủ → gợi thua.
create or replace function cam_ket_goi_y(p_commitment uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with c as (select * from commitments where id = p_commitment),
  viec as (
    select lm.id, lm.target_value, lm.unit, lm.unit_per_tick,
           coalesce((
             select case
               when kieu_don_vi(lm.unit) = 'do'
                 then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
               else sum(lp.value) * lm.unit_per_tick
             end
             from lead_progress lp, c
             where lp.lead_measure_id = lm.id
               and lp.logged_date between c.week_start and c.week_start + 6
               and (c.student_id is null or lp.student_id = c.student_id)
           ), 0) as duoc
    from lead_measures lm, c
    where lm.commitment_id = c.id
  )
  select case
    when not exists (select 1 from viec) then 'lose'
    when exists (select 1 from viec where duoc < target_value) then 'lose'
    else 'win'
  end;
$$;
revoke all on function cam_ket_goi_y(uuid) from public, anon;
grant execute on function cam_ket_goi_y(uuid) to authenticated, service_role;

-- ── 9. AI ĐƯỢC ĐỌC, AI ĐƯỢC SỬA ────────────────────────────────────────────────────────────
alter table commitments enable row level security;

drop policy if exists rls_cam_ket_doc on commitments;
create policy rls_cam_ket_doc on commitments for select
  using (
    staff_can_read_class(class_id)
    or is_class_student(class_id)
    or (student_id is not null and is_my_child(student_id))
  );

-- Em tự đặt cam kết của mình. Chủ dự án chốt ở vòng comment: "WIGs là do học sinh tự đặt, GVCN
-- chỉ tham vấn và duyệt" — cam kết tuần cũng cùng tinh thần ấy.
drop policy if exists rls_cam_ket_cua_em on commitments;
create policy rls_cam_ket_cua_em on commitments for all
  using (student_id = (select auth.uid()) and is_class_student(class_id))
  with check (student_id = (select auth.uid()) and is_class_student(class_id));

drop policy if exists rls_cam_ket_gvcn on commitments;
create policy rls_cam_ket_gvcn on commitments for all
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

grant select, insert, update, delete on commitments to authenticated;
