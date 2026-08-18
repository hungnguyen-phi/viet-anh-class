-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0146 — PRD v3 ĐỢT C: BUDDY (BẠN HỌC) · LỊCH PDR · BIÊN BẢN PDR 6 CÂU + NÚT GHI NHẬN
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3 changelog #12: nhịp giải trình tách làm hai — Họp lớp hằng tuần (đã có: biên bản của
-- phòng họp /wig/hop) và Họp PDR (Plan-Do-Review) 1-1/1-1-1. Ba bảng mới ở đây phục vụ vế sau.
--
-- CHỮ "BUDDY" ĐỔI NGHĨA LẦN NỮA (chốt 18/08/2026, đảo quyết định 12/08): Buddy nay là BẠN HỌC
-- cùng lớp họp PDR hằng tuần theo PRD v3; con sư tử AI đổi tên "Sư Tử". Bài kiểm
-- test-buddy-mot-nghia đổi theo ở cùng đợt deploy.

-- ── 1. CẶP BUDDY — GVCN tạo, tối đa 2 buddy/em, quan hệ ĐỐI XỨNG ───────────────────────────
-- Bảng buddy_pairs CŨ (0104 — ghép cặp THEO TUẦN của tính năng bạn-đồng-hành đã gỡ 12/08) vẫn
-- nằm trong CSDL với 3 dòng thử nghiệm và không một dòng mã nào còn đọc nó (đã grep 18/08 —
-- chỉ còn trong comment). Hình dạng khác hẳn bản v3 (theo tuần, không created_by/is_active),
-- nên thay hẳn chứ không vá: drop rồi dựng theo PRD.
drop table if exists buddy_pairs cascade;
create table buddy_pairs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  buddy_id uuid not null references profiles(id) on delete cascade,
  created_by uuid not null references profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (student_id <> buddy_id)
);
-- ĐỐI XỨNG chuẩn hoá một chiều: mỗi cặp là MỘT dòng, đầu nhỏ đứng trước — không có chuyện
-- (A,B) và (B,A) cùng tồn tại rồi phép đếm "tối đa 2" đếm thiếu một nửa.
alter table buddy_pairs drop constraint if exists buddy_thu_tu_ck;
alter table buddy_pairs add constraint buddy_thu_tu_ck check (student_id < buddy_id);
create unique index if not exists buddy_pairs_uidx
  on buddy_pairs(student_id, buddy_id) where is_active;
create index if not exists idx_buddy_pairs_lop on buddy_pairs(class_id) where is_active;

-- Tối đa 2 buddy mỗi em, ĐẾM CẢ HAI CHIỀU (quyết định 18/08/2026 cho câu hỏi mở #4 của PRD).
-- Phải là trigger: điều kiện đếm vắt qua cả hai cột của nhiều dòng khác nhau.
create or replace function private.chan_buddy_thu_ba()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qua_tay uuid;
begin
  select nguoi into qua_tay
  from (select new.student_id as nguoi union all select new.buddy_id) hai_ben
  where (
    select count(*) from buddy_pairs b
    where b.is_active and b.id is distinct from new.id
      and (b.student_id = hai_ben.nguoi or b.buddy_id = hai_ben.nguoi)
  ) >= 2
  limit 1;
  if qua_tay is not null then
    raise exception 'Mỗi học sinh tối đa 2 buddy' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_chan_buddy_thu_ba on buddy_pairs;
create trigger trg_chan_buddy_thu_ba
  before insert or update of student_id, buddy_id, is_active on buddy_pairs
  for each row when (new.is_active) execute function private.chan_buddy_thu_ba();

-- ── 2. LỊCH PDR — GVCN cài ─────────────────────────────────────────────────────────────────
-- coach = 1-1 với GVCN, mỗi tháng một lần (monthly_day); buddy = hằng tuần, lịch cố định
-- (weekday 2..8 kiểu VN + giờ). Lịch buddy treo vào CẶP chứ không vào từng em: một buổi họp
-- là của cả cặp/nhóm.
create table if not exists pdr_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,   -- coach: em nào
  buddy_pair_id uuid references buddy_pairs(id) on delete cascade, -- buddy: cặp nào
  type text not null check (type in ('coach', 'buddy')),
  weekday int check (weekday between 2 and 8),                 -- 2=T2 … 8=CN (như TKB, 0144)
  time_slot time,
  monthly_day int check (monthly_day between 1 and 28),        -- 29–31 là lịch tự trượt, cấm từ đầu
  created_by uuid not null references profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Mỗi loại lịch mang đúng bộ cột của nó — dòng coach có weekday là dòng rác đọc hai nghĩa.
  check (type <> 'coach' or (student_id is not null and monthly_day is not null and buddy_pair_id is null)),
  check (type <> 'buddy' or (buddy_pair_id is not null and weekday is not null and student_id is null))
);
create unique index if not exists pdr_schedules_coach_uidx
  on pdr_schedules(student_id) where type = 'coach' and is_active;
create unique index if not exists pdr_schedules_buddy_uidx
  on pdr_schedules(buddy_pair_id) where type = 'buddy' and is_active;

-- ── 3. BIÊN BẢN PDR — MỖI DÒNG LÀ PHẦN TRẢ LỜI CỦA MỘT EM ─────────────────────────────────
-- Một buổi buddy 1-1-1 có 2–3 em lần lượt trả lời → 2–3 dòng cùng week_label (PRD v3 9.2).
create table if not exists pdr_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,  -- em đang trả lời
  type text not null check (type in ('coach', 'buddy')),
  counterpart_id uuid not null references profiles(id),                -- GVCN hoặc buddy 1
  second_buddy_id uuid references profiles(id),                        -- buddy 2 nếu 1-1-1
  week_label text not null,                                            -- 'W34-2026'
  q1_plan text,        -- 1) Tuần qua bạn dự định làm gì?
  q2_result text,      -- 2) Kết quả ra sao? (Thắng/Thua)
  q3_obstacle text,    -- 3) Khó khăn bạn đã gặp là gì?
  q4_overcome text,    -- 4) Bạn đã vượt qua như thế nào?
  q5_better_way text,  -- 5) Có cách nào tốt hơn không?
  q6_commitment text,  -- 6) Tuần này bạn cam kết điều gì? (→ sinh commitments, bắt buộc link WIG)
  acknowledged_at timestamptz,                                         -- nút "Ghi nhận"
  acknowledged_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (student_id <> counterpart_id),
  -- Buổi chưa Ghi nhận không tính KPI; Ghi nhận thì phải biết ai bấm, lúc nào.
  check ((acknowledged_at is null) = (acknowledged_by is null))
);
-- Mỗi em một dòng PDR buddy mỗi tuần; coach thì theo tháng nhưng week_label vẫn là tuần diễn ra.
create unique index if not exists pdr_meetings_uidx
  on pdr_meetings(student_id, type, week_label);
create index if not exists idx_pdr_meetings_lop_tuan on pdr_meetings(class_id, week_label);

-- Cam kết sinh từ câu 6 nhớ buổi họp đẻ ra nó (PRD v3 9.2).
alter table commitments add column if not exists pdr_meeting_id uuid references pdr_meetings(id) on delete set null;

-- ── 4. PHÂN QUYỀN ──────────────────────────────────────────────────────────────────────────
-- Biên bản PDR chứa chia sẻ cá nhân của trẻ (PRD v3 mục 12): CHỈ người tham gia + GVCN/BGH/Admin.
create or replace function is_pdr_participant(m uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from pdr_meetings
    where id = m
      and (student_id = (select auth.uid())
           or counterpart_id = (select auth.uid())
           or second_buddy_id = (select auth.uid()))
  );
$$;
revoke all on function is_pdr_participant(uuid) from public, anon;
grant execute on function is_pdr_participant(uuid) to authenticated;

alter table buddy_pairs enable row level security;
alter table pdr_schedules enable row level security;
alter table pdr_meetings enable row level security;
grant select, insert, update, delete on buddy_pairs, pdr_schedules, pdr_meetings to authenticated;

-- Buddy & lịch: cả lớp xem (em cần biết buddy của mình, lịch của mình); GVCN/BGH-cơ-sở/Admin sửa.
drop policy if exists bp_read on buddy_pairs;
create policy bp_read on buddy_pairs for select
  using (is_class_student(class_id) or staff_can_read_class(class_id));
drop policy if exists bp_manage on buddy_pairs;
create policy bp_manage on buddy_pairs for all
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));

drop policy if exists ps_read on pdr_schedules;
create policy ps_read on pdr_schedules for select
  using (is_class_student(class_id) or staff_can_read_class(class_id));
drop policy if exists ps_manage on pdr_schedules;
create policy ps_manage on pdr_schedules for all
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));

-- PDR: GVCN/Admin toàn quyền lớp mình; BGH đọc trong cơ sở; NGƯỜI THAM GIA đọc buổi của mình.
-- Học sinh KHÔNG đọc buổi của bạn khác — khác hẳn biên bản họp lớp vốn cả lớp xem.
drop policy if exists pdr_staff_all on pdr_meetings;
create policy pdr_staff_all on pdr_meetings for all
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
drop policy if exists pdr_bgh_read on pdr_meetings;
create policy pdr_bgh_read on pdr_meetings for select
  using (staff_can_read_class(class_id));
drop policy if exists pdr_participant_read on pdr_meetings;
create policy pdr_participant_read on pdr_meetings for select
  using (is_pdr_participant(id));
-- Em TẠO dòng trả lời của chính mình (trong lớp mình, chưa Ghi nhận sẵn) và SỬA 6 câu của mình.
drop policy if exists pdr_student_insert on pdr_meetings;
create policy pdr_student_insert on pdr_meetings for insert
  with check (student_id = (select auth.uid()) and is_class_student(class_id)
              and acknowledged_at is null);
-- Em phải ĐỌC ĐƯỢC TÊN buddy của mình: rls_select_profiles hiện chỉ mở hồ sơ bạn cùng lớp cho
-- attendance leader (is_classmate_via_leader) — em thường nhìn buddy_pairs sẽ thấy một chuỗi
-- uuid câm. Mở đúng MỘT khe: hồ sơ của người đang là buddy active với mình, không phải cả lớp.
create or replace function is_my_buddy(s uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from buddy_pairs
    where is_active
      and ((student_id = (select auth.uid()) and buddy_id = s)
        or (buddy_id = (select auth.uid()) and student_id = s))
  );
$$;
revoke all on function is_my_buddy(uuid) from public, anon;
grant execute on function is_my_buddy(uuid) to authenticated;
drop policy if exists prof_buddy_read on profiles;
create policy prof_buddy_read on profiles for select using (is_my_buddy(id));

-- Sửa được TỚI KHI GHI NHẬN: USING soi dòng CŨ nên chính cú bấm Ghi nhận vẫn đi lọt, còn sau
-- đó biên bản đông cứng — Ghi nhận là chữ ký, ký rồi mà sửa được thì chữ ký vô nghĩa.
-- Em cũng không ký tên người khác: acknowledged_by phải là chính mình (hoặc còn trống).
drop policy if exists pdr_student_update on pdr_meetings;
create policy pdr_student_update on pdr_meetings for update
  using (student_id = (select auth.uid()) and acknowledged_at is null)
  with check (student_id = (select auth.uid())
              and (acknowledged_by is null or acknowledged_by = (select auth.uid())));
