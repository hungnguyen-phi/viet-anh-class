-- ════════════════════════════════════════════════════════════════════════════
-- 0100 — MỖI EM MỘT KHOẢNG CÁCH
--        Mục tiêu của em thôi cắt từ mục tiêu lớp. Và sửa cái đồng hồ đang đo sai.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Đọc docs/MO_HINH_WIG.md trước khi sửa file này. Tài liệu đó là hợp đồng; file này chỉ là bản
-- thi công. Lệch nhau thì một trong hai cái sai — đừng để tồn tại song song.
--
-- ── VÌ SAO ───────────────────────────────────────────────────────────────────────────────────
--
-- PRD v3 §0.1 đặc tả "WIG cá nhân 1-chạm": mục tiêu của em = mục tiêu lớp CHIA CHO SĨ SỐ. App đã
-- xây đúng vậy. Đo ngày 11/08/2026: 0 WIG cá nhân, 0 biên bản họp trên toàn hệ thống. Tính năng
-- không hỏng — nó chưa từng có một dòng dữ liệu nào. Vì "400 bài" không mô tả em nào cả.
--
-- Chủ dự án chốt chuyển sang Individual WIG Plan (Leader in Me — bản 4DX cho trường phổ thông của
-- chính FranklinCovey): mục tiêu của em là KHOẢNG CÁCH CỦA CHÍNH EM, nối với mục tiêu lớp bằng
-- hướng đi chứ không bằng số học.
--
-- Hệ quả kỹ thuật, và đây là lý do migration này NGẮN hơn cái nó thay thế: hai cây rời nhau nên
-- không còn phép chia sĩ số, không còn tiến độ cá nhân tràn lên điểm thi đua.
--
-- ── HAI CÁI ĐỘC LẬP NHAU TRONG FILE NÀY ──────────────────────────────────────────────────────
--
--   A. Mô hình mới (§1–§3, §6–§7) — theo quyết định của chủ dự án.
--   B. SỬA LỖI ĐANG CHẠY (§4–§5) — đúng dù đi hướng nào.
--
-- Lỗi ở B: private.wig_actual cộng đóng góp của các em rồi CHIA CHO SĨ SỐ một lần nữa, trong khi
-- wigs.target_value là con số của cả lớp. Hai vế của phép chia không cùng thang. Đo trên lớp Test
-- (3 em, việc "mỗi bạn 3 bài", mốc tuần 25): cả lớp làm đủ — thắng tuyệt đối — mà hiện 12% thay vì
-- 36%. Bảng thi đua toàn trường lấy từ WIG năm nên nó là một cột 0,06% đứng yên cả năm.

-- ── 1. CỘT MỚI TRÊN wigs ─────────────────────────────────────────────────────────────────────
alter table wigs
  add column if not exists kind         text,
  add column if not exists status       text not null default 'approved',
  add column if not exists set_by       text,
  add column if not exists measure_by   text not null default 'tick',
  add column if not exists achieved_at  timestamptz,
  add column if not exists achieved_by  uuid references profiles(id) on delete set null,
  add column if not exists source_wig_id uuid references wigs(id) on delete set null;

comment on column wigs.kind is
  'Chỉ cho mục tiêu của HỌC SINH: academic (nối vào một lĩnh vực của lớp) | personal (của riêng '
  'em, KHÔNG vào điểm thi đua). Mỗi em tối đa một cái mỗi loại — xem khoá wigs_em_uidx.';

comment on column wigs.status is
  'draft → sent → approved. Em gõ (draft), gửi cô (sent), cô duyệt (approved). WIG của lớp luôn '
  'approved. Chỉ WIG đã approved mới được tính vào bất kỳ bảng nào.';

comment on column wigs.set_by is
  'Ai thật sự đặt mục tiêu này: student | teacher. Cô được đặt hộ (chủ dự án chốt 11/08/2026 để '
  'triệt rủi ro "em không gõ thì màn trống"), nhưng van an toàn ấy có thể nuốt cả thiết kế nếu cô '
  'gõ hộ hết. Cột này là cách để chuyện đó LỘ RA: BGH theo dõi %% set_by = student, mốc >= 70%%.';

comment on column wigs.measure_by is
  'tick   = đích đếm được ("1200 bài"), máy đếm từ lead_progress, CÓ vạch tiến độ.'
  'manual = đích ghi nhận ngoài ("điểm TB 8,0"), cô và trò tự theo dõi, đạt thì tick achieved_at. '
  'LUẬT CẤM: không bao giờ vẽ vạch tiến độ cho manual. Thà hiện "chưa đạt" còn hơn hiện một con '
  'số không ai nhập — app hiện KHÔNG có dữ liệu điểm môn (0 dòng ngày 11/08/2026).';

comment on column wigs.source_wig_id is
  'Mục tiêu học thuật của em đang góp vào mục tiêu nào của lớp. CHỈ ĐỂ HIỂN THỊ VÀ RÀ SOÁT — '
  'không tham gia bất kỳ phép tính nào. Đây là khác biệt cốt lõi với mô hình cũ: liên kết bằng '
  'hướng đi, không bằng phép chia.';

-- Mọi ràng buộc dưới đây phải chạy được trên dữ liệu ĐANG CÓ (3 WIG lớp, 0 WIG cá nhân). Nếu một
-- cái đỏ khi chạy thật thì có dữ liệu ngoài dự kiến — dừng lại đọc, đừng nới ràng buộc cho qua.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wig_kind_ck') then
    alter table wigs add constraint wig_kind_ck check (
      (scope = 'class'   and kind is null) or
      (scope = 'student' and kind in ('academic', 'personal')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wig_status_ck') then
    alter table wigs add constraint wig_status_ck check (status in ('draft', 'sent', 'approved'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wig_set_by_ck') then
    alter table wigs add constraint wig_set_by_ck check (
      (scope = 'class'   and set_by is null) or
      (scope = 'student' and set_by in ('student', 'teacher')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wig_measure_by_ck') then
    alter table wigs add constraint wig_measure_by_ck check (measure_by in ('tick', 'manual'));
  end if;
  -- achieved_by chỉ có nghĩa khi đã đạt; và đã đạt thì phải biết ai tick.
  if not exists (select 1 from pg_constraint where conname = 'wig_achieved_ck') then
    alter table wigs add constraint wig_achieved_ck check (
      (achieved_at is null and achieved_by is null) or
      (achieved_at is not null and achieved_by is not null));
  end if;
  -- Mục tiêu của riêng em không treo dưới lĩnh vực nào của lớp.
  if not exists (select 1 from pg_constraint where conname = 'wig_source_ck') then
    alter table wigs add constraint wig_source_ck check (
      kind is distinct from 'personal' or source_wig_id is null);
  end if;
end $$;

create index if not exists wigs_source_idx on wigs(source_wig_id) where source_wig_id is not null;

-- ── 2. TRẦN SỐ LƯỢNG — chặn ở CSDL, không phải nhắc trong giao diện ───────────────────────────
--
-- Trần là lý do sống còn của 4DX chứ không phải lời khuyên mềm: nghiên cứu FranklinCovey trên
-- ~300.000 người — đội theo 2–3 mục tiêu đạt xuất sắc 2–3; theo 4–10 chỉ đạt 1–2; theo 11–20 đạt
-- KHÔNG. App cũ bày ra 12 mục tiêu mỗi lớp (3 cấp × 4 lĩnh vực).
--
-- LỚP: một WIG cho mỗi (lĩnh vực, kỳ). wig_area có đúng 4 giá trị nên WIG năm tự động chặn ở 4 —
-- canon là 2, ta cố ý lệch theo chính sách trường (docs/MO_HINH_WIG.md §7).
-- Khoá này còn chặn luôn kiểu hỏng "bấm hai lần" và "hai giáo viên bấm cùng lúc" mà mã hiện nay
-- chống bằng đọc-trước-rồi-ghi — hở đúng khe giữa hai câu.
create unique index if not exists wigs_lop_ky_uidx
  on wigs(class_id, area, period, period_label)
  where scope = 'class';

-- EM: một mục tiêu học thuật + một mục tiêu riêng, mỗi kỳ. Đúng 2, theo Leader in Me.
create unique index if not exists wigs_em_uidx
  on wigs(student_id, kind, period_label)
  where scope = 'student';

-- ── 3. MỖI MỤC TIÊU CỦA EM CHỈ MỘT VIỆC ──────────────────────────────────────────────────────
--
-- Chủ dự án: "1 tuần chỉ 2 mục tiêu cá nhân thôi, tránh nhiều quá ko tốt". Hai tầng khoá để cả
-- hai cách hiểu đều đúng: tối đa 2 mục tiêu (§2) × tối đa 1 việc mỗi mục tiêu (đây) ⇒ em không
-- bao giờ phải tick quá 2 việc của mình trong một tuần.
--
-- Phải dùng trigger chứ không phải partial index: điều kiện nằm ở BẢNG KHÁC (wigs.scope), mà
-- index bộ phận thì không với sang bảng khác được.
create or replace function private.chan_viec_thu_hai()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_scope wig_scope;
  v_dem   int;
begin
  select scope into v_scope from wigs where id = new.wig_id;
  if v_scope is distinct from 'student' then
    return new;
  end if;
  select count(*) into v_dem
  from lead_measures
  where wig_id = new.wig_id and id is distinct from new.id;
  if v_dem >= 1 then
    raise exception 'Mỗi mục tiêu của học sinh chỉ được có một việc.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists chan_viec_thu_hai on lead_measures;
create trigger chan_viec_thu_hai
  before insert or update of wig_id on lead_measures
  for each row execute function private.chan_viec_thu_hai();

-- ── 4. SỬA CÁI ĐỒNG HỒ ĐANG ĐO SAI ───────────────────────────────────────────────────────────
--
-- Đổi đúng hai chỗ so với bản 0099 đang chạy:
--
--   a) BỎ phép chia sĩ số ở nhánh scope='class'. Đây là lỗi. Đóng góp của các em đã được chặn
--      trần theo từng em rồi (0098), nên TỔNG của chúng chính là con số của cả lớp — cùng thang
--      với wigs.target_value. Chia thêm lần nữa là chia hai lần.
--
--   b) THÊM bộ lọc theo em cho WIG cá nhân. Mục tiêu của em đo bằng việc CỦA CHÍNH EM, và chỉ
--      đếm lượt tick của chính em ấy. Hôm nay chưa lọc — một dòng lạc vào là số của em phồng lên
--      mà không màn hình nào kêu.
--
-- GIỮ NGUYÊN từ 0099: `where c.scope = d.scope` ở nhánh đệ quy. Trong mô hình mới hai cây vốn đã
-- rời nhau nên nó không còn việc gì để làm — nhưng giữ lại làm chốt chặn thứ hai, phòng khi sau
-- này ai đó nối parent_wig_id xuyên cây.
--
-- KHÔNG đụng tới: chặn trần theo từng em (0098) — một em chăm không gánh được cho cả lớp.
create or replace function private.wig_actual(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
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
             when v.target_value > 0
               then least(sum(lp.value) * v.unit_per_tick, v.target_value)
             else sum(lp.value) * v.unit_per_tick
           end as gop
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
     -- Mục tiêu của em chỉ đếm lượt tick của CHÍNH EM. WIG của lớp (student_id null) đếm hết.
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit_per_tick, lp.student_id
  )
  -- TỔNG, không chia. Xem ghi chú (a) ở trên.
  select coalesce(sum(t.gop), 0) from theo_em t;
$function$;

-- ── 5. ĐIỂM THI ĐUA ĐI THEO CÙNG LUẬT ────────────────────────────────────────────────────────
--
-- Hai đổi:
--   · Đích 'manual' không có tiến độ để chia — chỉ có đạt hoặc chưa. Trước đây nó rơi vào nhánh
--     actual/target và cho ra một con số vô nghĩa chạy suốt năm.
--   · Chỉ tính WIG đã approved. WIG của lớp mặc định approved nên hôm nay không đổi gì; nhưng khi
--     có luồng nháp thì một mục tiêu chưa duyệt không được kéo điểm của lớp.
-- Chữ ký giữ NGUYÊN từng chữ (cột đầu tên `class_id`, không phải `id`) để `create or replace`
-- chạy được — đổi kiểu trả về thì Postgres bắt DROP, mà DROP là mất sạch GRANT đang có.
create or replace function public.class_competition_scores()
returns table(class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    c.id, c.campus_id, c.grade,
    case when c.grade ~ '^[0-9]+$' then
      case when c.grade::int between 1 and 5 then 'primary'
           when c.grade::int between 6 and 9 then 'secondary'
           else 'high' end
      else 'unknown' end as level,
    coalesce(round(avg(
      case
        when w.measure_by = 'manual'
          then case when w.achieved_at is not null then 1 else 0 end
        when w.target_value > 0
          then least(1, private.wig_actual(w.id) / w.target_value)
        else 0
      end
    ) * 100, 1), 0) as score
  from classes c
  left join wigs w
    on w.class_id = c.id and w.scope = 'class' and w.period = 'year' and w.status = 'approved'
  where c.school_year = current_school_year()
    and c.is_active
  group by c.id, c.campus_id, c.grade;
$function$;

-- ── 6. SỔ CỦA CON ────────────────────────────────────────────────────────────────────────────
--
-- Trong Leader in Me, cuốn sổ THUỘC VỀ HỌC SINH — không phải hồ sơ của giáo viên. Đó là toàn bộ
-- lý do nó có tác dụng. Nên phân quyền ở đây phải nói đúng điều ấy: em viết, người lớn đọc.
create table if not exists student_reflections (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  week_start  date not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, week_start)
);

create index if not exists student_reflections_lop_tuan_idx
  on student_reflections(class_id, week_start);

alter table student_reflections enable row level security;

-- Đọc: chính em, phụ huynh của em, và nhân sự đọc được lớp. Đi đúng khuôn của lead_progress.
drop policy if exists rls_select_student_reflections on student_reflections;
create policy rls_select_student_reflections on student_reflections for select
  using (
    student_id = (select auth.uid())
    or is_my_child(student_id)
    or staff_can_read_class(class_id)
  );

-- Viết: CHỈ CHÍNH EM. Cô đọc được nhưng không viết hộ — đây là chỗ duy nhất trong cả mô hình mà
-- người lớn không có quyền ghi, và đó là chủ ý: một cuốn sổ ai cũng viết được thì không còn là sổ
-- của em nữa. (Khác với mục tiêu — cô được đặt hộ, xem §1 set_by.)
drop policy if exists rls_write_student_reflections on student_reflections;
create policy rls_write_student_reflections on student_reflections for insert
  with check (student_id = (select auth.uid()) and is_class_student(class_id));

drop policy if exists rls_update_student_reflections on student_reflections;
create policy rls_update_student_reflections on student_reflections for update
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

grant select, insert, update on student_reflections to authenticated;

-- ── 7. EM ĐƯỢC TỰ ĐẶT MỤC TIÊU CỦA MÌNH ──────────────────────────────────────────────────────
--
-- Hôm nay bảng wigs chỉ có rls_all_wigs (staff) + rls_select_wigs. Học sinh KHÔNG ghi được gì —
-- nên toàn bộ luồng "em gõ, cô duyệt" là bất khả thi ở tầng CSDL, không phải ở tầng giao diện.
--
-- Mở đúng một khe: em ghi được mục tiêu CỦA CHÍNH EM, khi nó còn là nháp hoặc vừa gửi. Duyệt rồi
-- thì em không sửa được nữa — muốn đổi thì xin cô (đường "xin đổi" nằm ở tầng ứng dụng).
drop policy if exists rls_insert_wig_cua_em on wigs;
create policy rls_insert_wig_cua_em on wigs for insert
  with check (
    scope = 'student'
    and student_id = (select auth.uid())
    and is_class_student(class_id)
    and status in ('draft', 'sent')
    and set_by = 'student'
  );

drop policy if exists rls_update_wig_cua_em on wigs;
create policy rls_update_wig_cua_em on wigs for update
  using (
    scope = 'student'
    and student_id = (select auth.uid())
    and status in ('draft', 'sent')
  )
  with check (
    scope = 'student'
    and student_id = (select auth.uid())
    and status in ('draft', 'sent')
  );

-- Việc của em: treo dưới mục tiêu của chính em, và cũng chỉ khi mục tiêu còn nháp/chờ duyệt.
drop policy if exists rls_write_viec_cua_em on lead_measures;
create policy rls_write_viec_cua_em on lead_measures for all
  using (
    exists (select 1 from wigs w
            where w.id = lead_measures.wig_id
              and w.scope = 'student'
              and w.student_id = (select auth.uid())
              and w.status in ('draft', 'sent'))
  )
  with check (
    exists (select 1 from wigs w
            where w.id = lead_measures.wig_id
              and w.scope = 'student'
              and w.student_id = (select auth.uid())
              and w.status in ('draft', 'sent'))
  );

-- ── 8. DỌN DỮ LIỆU THỬ ───────────────────────────────────────────────────────────────────────
--
-- Lớp "Test" có WIG tháng đơn vị "buổi" trong khi năm và tuần là "bài" — cấu trúc cũ cho phép mỗi
-- cấp một đơn vị nên nó sai được. Từ nay mốc do app sinh và thừa kế đơn vị từ WIG năm, lỗi này
-- không tái diễn. Sửa dòng đang có cho khỏi cộng lẫn lộn.
-- Lấy đơn vị từ GỐC cây, không phải từ cha trực tiếp.
--
-- Bản đầu tôi viết "lấy của cha" và phép kiểm bắt được: một câu UPDATE nhìn thấy ảnh CŨ của bảng,
-- nên tháng lấy đúng "bài" từ năm, còn tuần lại lấy "buổi" — giá trị sai của tháng ĐỌC TRƯỚC KHI
-- tháng được sửa. Sai lan xuống thay vì được dọn. Đi từ gốc thì một lượt là xong và không có thứ
-- tự nào để mà sai.
with recursive tu_goc as (
  select id, unit from wigs where scope = 'class' and parent_wig_id is null
  union all
  select c.id, g.unit
  from wigs c join tu_goc g on c.parent_wig_id = g.id
  where c.scope = 'class'
)
update wigs w set unit = g.unit
from tu_goc g
where g.id = w.id and w.unit is distinct from g.unit;
