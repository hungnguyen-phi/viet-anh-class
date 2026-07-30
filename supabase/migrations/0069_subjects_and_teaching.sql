-- ══════════════════════════════════════════════════════════════════════════════
-- 0069 (1/4) — BẢNG + HÀM.  Gộp cả 4 phần vào MỘT file
--   supabase/migrations/0069_subjects_and_teaching.sql
-- theo ĐÚNG thứ tự:  (1) DDL  →  (2) SEED  →  (3) ĐỔI BẢNG CŨ  →  (4) RLS
-- Không đảo thứ tự được: seed phải có trước thì backfill khoá ngoại mới khớp được tên môn,
-- và policy của subject_scores phải viết SAU khi cột subject_id đã tồn tại.
-- scripts/run-sql.mjs gửi cả file trong MỘT câu lệnh → Postgres bọc trong một transaction ngầm:
-- bất kỳ `raise exception` nào ở phần (3) cũng cuộn lại sạch, không để lại nửa vời.
--
-- ── QUYẾT ĐỊNH A: PHẠM VI DANH MỤC MÔN = THEO CẤP HỌC, KHÔNG THEO CƠ SỞ ──────
-- Chọn: một danh mục dùng chung cho cả hệ thống, khoá theo `level` (school_level), cộng thêm
-- khả năng một cơ sở tự thêm môn riêng qua `campus_id`.
--   • campus_id IS NULL  = môn chuẩn quốc gia của cấp học đó, cả 4 cơ sở dùng chung MỘT dòng.
--   • campus_id có giá trị = môn riêng của đúng cơ sở đó (CLB, tiếng Anh tăng cường…).
-- VÌ SAO KHÔNG LÀM THEO CƠ SỞ: 4 cơ sở đều là THCS, danh mục môn của Chương trình GDPT 2018 là
-- chuẩn quốc gia. Nhân bản 4 bản sẽ cho ra 4 dòng "Ngữ văn" khác id → tổng hợp điểm toàn trường
-- lại phải gom theo TÊN, tức là quay về đúng cái lỗi đang đi sửa.
-- ĐÁNH ĐỔI PHẢI CHẤP NHẬN: hai cơ sở không thể gọi tên khác nhau cho cùng một môn chuẩn (muốn
-- gọi "Văn" thay "Ngữ văn" thì phải sửa cho cả bốn). Đổi lại được thứ quan trọng hơn: một con
-- điểm Ngữ văn ở cơ sở A và ở cơ sở D là cùng một môn, cộng trung bình toàn trường ra số đúng.
-- ══════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- ── A. DANH MỤC MÔN ─────────────────────────────────────────────────────────
create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  -- NULL = dùng chung toàn hệ thống (xem quyết định A). Có giá trị = môn riêng của cơ sở.
  campus_id  uuid references campuses(id) on delete cascade,
  -- KHÔNG khoá theo cấp học (school_level). Bảng môn thật của trường có Toán / Ngữ văn /
  -- Tiếng Anh dạy từ lớp 6 tới lớp 12 — vắt qua cả THCS lẫn THPT. Khoá theo cấp thì mỗi môn như
  -- vậy phải gieo hai dòng, và một con điểm Toán lớp 9 với lớp 10 thành hai môn khác nhau.
  -- Lớp nào học môn nào ghi ở bảng subject_grades bên dưới, theo SỐ LỚP — chính xác hơn cấp học
  -- và khớp đúng cột grades.sort_order đang có.

  -- MÃ MÁY ĐỌC, ASCII, không dấu, không đổi. Dùng để gieo danh mục, để đối chiếu khi nhập từ
  -- file Excel của phòng đào tạo, và để migration sau này tìm đúng môn mà không phụ thuộc cách
  -- trường gọi tên. Tách khỏi tên hiển thị đúng theo lối 0064 đã tách `kind` khỏi `name`:
  -- trộn hai vai vào một cột thì đổi cách gọi tên là hỏng mọi truy vấn.
  code       text not null,
  name       text not null,
  -- MÃ NGẮN ĐỂ HIỆN TRONG Ô LƯỚI TKB. Ô một tiết học trên lưới 7 ngày × 12 tiết rộng chưa tới
  -- 90px; "Hoạt động trải nghiệm, hướng nghiệp" tràn ô hoặc bị cắt cụt thành "Hoạt độn…".
  -- Có cột riêng thì trường tự chọn viết tắt, không để CSS cắt bừa.
  short_name text not null,

  sort_order smallint not null default 500,
  -- Môn đánh giá bằng ĐIỂM SỐ hay bằng NHẬN XÉT (Thông tư 22: Giáo dục thể chất, Âm nhạc, Mĩ
  -- thuật, HĐTN-HN, GD địa phương đánh giá bằng nhận xét). CỐ Ý KHÔNG chặn ở DB lúc này:
  -- subject_scores.score là numeric NOT NULL nên chưa có chỗ ghi "Đạt/Chưa đạt"; chặn bây giờ là
  -- lấy mất của giáo viên cách duy nhất họ đang ghi kết quả các môn đó. Cột này để màn hình nhập
  -- điểm tách nhóm và nhắc, siết lại khi làm phần đánh giá bằng nhận xét.
  is_scored  boolean not null default true,
  -- XOÁ MÔN ĐÃ CÓ ĐIỂM: KHÔNG xoá cứng. Hai lớp khoá:
  --   1) is_active = false → môn biến khỏi mọi ô chọn, điểm cũ vẫn nguyên và vẫn đọc được;
  --   2) mọi khoá ngoại trỏ vào đây đều `on delete restrict` → lỡ tay xoá thì Postgres chặn
  --      thẳng thay vì cuốn theo cả bảng điểm. Đúng lệ đã theo với campuses/grades/classes.
  is_active  boolean not null default true,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subjects_code_check  check (code ~ '^[A-Z0-9_]{2,12}$'),
  constraint subjects_name_check  check (name = btrim(name) and name <> '' and length(name) <= 80),
  constraint subjects_short_check check (short_name = btrim(short_name) and short_name <> '' and length(short_name) <= 16)
);

comment on table subjects is
  'Danh mục môn học. campus_id NULL = môn chuẩn của cấp học, dùng chung cả 4 cơ sở; có giá trị = môn riêng của cơ sở đó.';
comment on column subjects.short_name is
  'Mã ngắn hiện trong ô lưới thời khoá biểu (ô rộng ~90px, tên đầy đủ không vừa).';
comment on column subjects.is_active is
  'Ngừng dùng thì tắt cờ này, KHÔNG xoá: điểm cũ trỏ vào môn và phải đọc được mãi.';

-- CHÍNH LÀ THỨ ĐANG ĐI SỬA: chặn "Ngữ văn" và "Ngữ Văn" thành hai môn. lower(name) nên khác hoa
-- thường là trùng. Bốn chỉ mục vì hai phạm vi (chung / riêng cơ sở) không so được với nhau bằng
-- một unique thường — NULL trong unique thường không bao giờ trùng NULL.
create unique index if not exists uq_subjects_chung_code on subjects (code)        where campus_id is null;
create unique index if not exists uq_subjects_chung_name on subjects (lower(name)) where campus_id is null;
create unique index if not exists uq_subjects_rieng_code on subjects (campus_id, code)        where campus_id is not null;
create unique index if not exists uq_subjects_rieng_name on subjects (campus_id, lower(name)) where campus_id is not null;

create index if not exists idx_subjects_campus       on subjects (campus_id);
create index if not exists idx_subjects_created_by   on subjects (created_by);
create index if not exists idx_subjects_active on subjects (is_active, sort_order);

-- Chuẩn hoá + chặn nốt lỗ mà chỉ mục không với tới: cơ sở tạo môn RIÊNG trùng tên/mã với môn
-- CHUNG. Không chặn thì ô chọn môn của cơ sở đó hiện hai dòng "Tiếng Anh" — đúng cái bẫy cũ,
-- chỉ đổi chỗ nấp.
create or replace function subject_guard() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.code       := upper(btrim(new.code));
  new.name       := btrim(new.name);
  -- BEFORE trigger chạy trước khi Postgres kiểm NOT NULL (lối đã dùng ở fill_score_weight, 0064)
  -- nên bỏ trống mã ngắn vẫn hợp lệ: lấy tạm mã máy.
  new.short_name := btrim(coalesce(nullif(new.short_name, ''), new.code));

  if new.campus_id is not null and exists (
    select 1 from subjects s
    where s.campus_id is null
      and (s.code = new.code or lower(s.name) = lower(new.name))
  ) then
    raise exception 'Môn "%" đã có trong danh mục dùng chung của cấp học này. Dùng môn chung, đừng tạo bản riêng của cơ sở.', new.name;
  end if;

  new.updated_at := now();
  return new;
end $$;
-- Hàm trigger: chỉ Postgres gọi. Gỡ quyền của mọi vai (bài học 0066).
revoke all on function subject_guard() from public, anon, authenticated;
drop trigger if exists trg_subject_guard on subjects;
create trigger trg_subject_guard before insert or update on subjects
  for each row execute function subject_guard();


-- ── B. LỚP HỌC NHỮNG MÔN GÌ — CÓ, phải có bảng riêng ────────────────────────
-- TRẢ LỜI THẲNG: KHÔNG suy ra từ thời khoá biểu được. Ba lý do, lý do nào cũng đủ một mình:
--   1. Môn học theo đợt (chuyên đề, môn dạy dồn 6 tuần) không nằm trong mẫu tuần lặp của
--      timetable_slots — 0044 đã ghi rõ bảng đó là MẪU TUẦN, không có ngày.
--   2. Lớp mới lập chưa xếp TKB thì danh sách môn rỗng → giáo viên không nhập được điểm. Đây
--      không phải giả thiết: hiện có 6 lớp và ĐÚNG 2 dòng TKB trong toàn hệ thống.
--   3. Xoá một ô TKB (đổi lịch) sẽ làm biến mất một môn khỏi bảng điểm. Không ai chấp nhận
--      chuyện sửa lịch làm rơi cột điểm.
-- Bù lại KHÔNG bắt ai nhập tay: có trigger tự thêm khi xếp TKB / khi phân công giáo viên, và
-- có RPC seed_class_subjects() gieo cả bộ môn chuẩn cho lớp bằng một cú bấm.
create table if not exists class_subjects (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id)  on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  is_active  boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

comment on table class_subjects is
  'Chương trình của một lớp: lớp này học những môn nào. Nguồn duy nhất cho ô chọn môn ở màn hình nhập điểm.';

-- class_id đã được cột đầu của unique phủ — không tạo thêm (0054 đã phải gỡ chỉ mục trùng một lần).
create index if not exists idx_class_subjects_subject    on class_subjects (subject_id);
create index if not exists idx_class_subjects_created_by on class_subjects (created_by);

-- Môn có hợp với lớp không: đúng cấp học, và nếu là môn RIÊNG thì phải riêng của ĐÚNG cơ sở đó.
-- Không có chốt này thì cơ sở A gắn được môn nội bộ của cơ sở B vào lớp mình.
-- cp.level NULL (0047: cơ sở chưa khai cấp học) thì bỏ qua vế cấp học — đây là kiểm SỰ PHÙ HỢP
-- DỮ LIỆU, không phải kiểm quyền, nên thà cho qua còn hơn làm chết màn hình của cơ sở khai thiếu.
create or replace function subject_fits_class(p_subject uuid, p_class uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subjects s, classes c, campuses cp
    where s.id = p_subject and c.id = p_class and cp.id = c.campus_id
      and s.is_active
      and (s.campus_id is null or s.campus_id = c.campus_id)
  );
$$;
revoke all on function subject_fits_class(uuid, uuid) from public, anon;
grant execute on function subject_fits_class(uuid, uuid) to authenticated;

create or replace function class_subject_guard() returns trigger
  language plpgsql set search_path = public as $$
begin
  if not subject_fits_class(new.subject_id, new.class_id) then
    raise exception 'Môn này không thuộc danh mục đang dùng của cơ sở/cấp học của lớp, hoặc đã ngừng dùng.';
  end if;
  return new;
end $$;
revoke all on function class_subject_guard() from public, anon, authenticated;
drop trigger if exists trg_class_subject_guard on class_subjects;
create trigger trg_class_subject_guard before insert or update on class_subjects
  for each row execute function class_subject_guard();


-- ── C. PHÂN CÔNG GIÁO VIÊN BỘ MÔN ───────────────────────────────────────────
-- MỘT MÔN Ở MỘT LỚP CÓ NHIỀU GIÁO VIÊN ĐƯỢC KHÔNG: ĐƯỢC. Khoá là bộ BA
-- (class, subject, teacher), không phải cặp (class, subject).
-- VÌ SAO: dạy đôi và tách nhóm là chuyện thật (Tiếng Anh chia hai nhóm trình độ, Tin học chia ca
-- phòng máy). Và quan trọng hơn: cô nghỉ sinh giữa kỳ, người dạy thay vào. Nếu DB chỉ chứa được
-- một người thì bàn giao = xoá dòng cũ, tức là ngay giây đó cô cũ MẤT quyền đọc chính những con
-- điểm cô vừa nhập, còn hệ thống mất luôn dấu vết ai phụ trách trước đó. Cho nhiều dòng thì bàn
-- giao là "thêm người mới, tắt is_active của người cũ" — đúng thứ tự việc ở trường.
-- ĐÁNH ĐỔI: không có khái niệm "giáo viên CHÍNH của môn". Cố ý không thêm cột is_primary: nó là
-- một quy tắc mà giao diện phải nhớ áp mà không đổi lấy quyền gì cả (mọi người được phân công
-- đều có quyền ghi như nhau). Muốn ghi tên người phụ trách lên lưới TKB thì đã có
-- timetable_slots.teacher_name (0044).
create table if not exists teaching_assignments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id)  on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  -- on delete cascade: xoá tài khoản giáo viên (admin_delete_user, 0021) thì phân công vô nghĩa,
  -- và không được để nó chặn việc xoá người dùng.
  teacher_id uuid not null references profiles(id) on delete cascade,
  -- Hết phân công thì TẮT, không xoá: giữ được vì sao con điểm này do người này nhập.
  -- is_active = false là MẤT quyền ngay (mọi hàm quyền bên dưới đều lọc cờ này).
  is_active  boolean not null default true,
  note       text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, subject_id, teacher_id),
  constraint ta_note_len check (note is null or length(note) <= 200)
);

comment on table teaching_assignments is
  'Giáo viên X dạy môn Y ở lớp Z. ĐÂY LÀ BẢNG CẤP QUYỀN GHI ĐIỂM — thêm một dòng ở đây là mở cho một người ghi vào học bạ của một lớp.';

create index if not exists idx_ta_subject      on teaching_assignments (subject_id);
create index if not exists idx_ta_teacher      on teaching_assignments (teacher_id);
create index if not exists idx_ta_created_by   on teaching_assignments (created_by);
-- Chỉ mục cho ĐÚNG câu hỏi mà mọi policy hỏi ở mọi dòng điểm: "tôi có dạy môn này ở lớp này
-- không". Lọc sẵn is_active để chỉ mục chỉ chứa phân công còn hiệu lực.
create index if not exists idx_ta_quyen on teaching_assignments (teacher_id, class_id, subject_id) where is_active;

create or replace function teaching_assignment_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  -- SECURITY DEFINER vì phải đọc profiles.role của NGƯỜI KHÁC — RLS của profiles không cho
  -- hiệu trưởng/giáo viên đọc hồ sơ đồng nghiệp, invoker sẽ thấy rỗng và cho qua mọi thứ.
  select role into v_role from profiles where id = new.teacher_id;

  -- CHỈ vai 'teacher'. Không cho phân công cho hiệu trưởng: cả 0064 lẫn màn hình học bạ đều dựng
  -- trên nguyên tắc "hiệu trưởng KHÔNG chạm một con điểm nào". Phân công cho họ là đường vòng
  -- phá nguyên tắc đó mà không ai nhìn thấy. Trường có hiệu phó đứng lớp thì bàn riêng, đổi bằng
  -- một migration có tên, đừng để nó lọt qua đây.
  if v_role is distinct from 'teacher'::user_role then
    raise exception 'Chỉ phân công được cho tài khoản có vai GIÁO VIÊN. Tài khoản này không phải giáo viên.';
  end if;

  if not subject_fits_class(new.subject_id, new.class_id) then
    raise exception 'Môn này không thuộc danh mục đang dùng của cơ sở/cấp học của lớp, hoặc đã ngừng dùng.';
  end if;

  -- Phân công người dạy môn đó cho lớp đó thì hiển nhiên lớp đó CÓ học môn đó. Tự ghi luôn để
  -- không ai phải nhớ làm hai bước, và để ô chọn môn ở màn hình nhập điểm không rỗng.
  insert into class_subjects (class_id, subject_id, created_by)
  values (new.class_id, new.subject_id, coalesce(auth.uid(), new.created_by))
  on conflict (class_id, subject_id) do nothing;

  new.updated_at := now();
  return new;
end $$;
revoke all on function teaching_assignment_guard() from public, anon, authenticated;
drop trigger if exists trg_teaching_assignment_guard on teaching_assignments;
create trigger trg_teaching_assignment_guard before insert or update on teaching_assignments
  for each row execute function teaching_assignment_guard();


-- ── HÀM QUYỀN ───────────────────────────────────────────────────────────────
-- ⚠ CẢNH BÁO ĐÃ TỪNG DÍNH (0011/0014): KHÔNG hàm nào dưới đây kiểm VAI TRÒ. Tất cả đều hỏi
-- QUAN HỆ THẬT trong teaching_assignments. `auth_role() in ('teacher',...)` là câu hỏi "anh có
-- phải giáo viên không", còn câu cần hỏi là "anh có dạy MÔN NÀY ở LỚP NÀY không".

-- Cơ sở của một lớp. Có hàm này để policy không phải `select ... from classes` thẳng — đọc
-- classes trong policy là kéo theo RLS của classes, đúng kiểu vòng lặp policy gọi policy.
create or replace function class_campus(c uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select campus_id from classes where id = c;
$$;

-- Tôi có dạy MÔN NÀO ĐÓ ở lớp này không (dùng cho quyền ĐỌC danh sách lớp/học sinh).
create or replace function is_subject_teacher_of_class(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teaching_assignments
    where class_id = c and teacher_id = auth.uid() and is_active
  );
$$;

-- Em này có đang học một lớp tôi dạy bộ môn không. Lọc e.is_active — đúng chỗ sót đã phải vá ở
-- 0060 (phụ huynh còn đọc được lớp cũ vĩnh viễn vì quên hai chữ này).
create or replace function is_my_subject_student(s uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    join teaching_assignments ta on ta.class_id = e.class_id
    where e.student_id = s and e.is_active
      and ta.teacher_id = auth.uid() and ta.is_active
  );
$$;

-- ĐỌC một con điểm với tư cách giáo viên bộ môn: ĐÚNG BỘ BA (tôi, môn của chính dòng điểm đó,
-- lớp của phiếu). Không có vế `not is_locked`: đợt chốt sổ rồi vẫn phải xem lại được điểm mình
-- đã nhập.
create or replace function can_read_subject_score(p_review uuid, p_subject uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from student_term_reviews v
    join teaching_assignments ta
      on  ta.class_id   = v.class_id
      and ta.subject_id = p_subject
      and ta.teacher_id = auth.uid()
      and ta.is_active
    where v.id = p_review
  );
$$;

-- GHI một con điểm: y hệt trên, CỘNG đợt chưa chốt sổ. Giữ nguyên chốt an toàn của 0064 —
-- is_locked thì không ai ghi trừ admin (admin đi qua policy rls_all_subject_scores có sẵn).
create or replace function can_write_subject_score(p_review uuid, p_subject uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from student_term_reviews v
    join assessment_terms t on t.id = v.term_id
    join teaching_assignments ta
      on  ta.class_id   = v.class_id
      and ta.subject_id = p_subject
      and ta.teacher_id = auth.uid()
      and ta.is_active
    where v.id = p_review
      and not t.is_locked
  );
$$;

revoke all on function class_campus(uuid)                     from public, anon;
revoke all on function is_subject_teacher_of_class(uuid)      from public, anon;
revoke all on function is_my_subject_student(uuid)            from public, anon;
revoke all on function can_read_subject_score(uuid, uuid)     from public, anon;
revoke all on function can_write_subject_score(uuid, uuid)    from public, anon;
grant execute on function class_campus(uuid)                  to authenticated;
grant execute on function is_subject_teacher_of_class(uuid)   to authenticated;
grant execute on function is_my_subject_student(uuid)         to authenticated;
grant execute on function can_read_subject_score(uuid, uuid)  to authenticated;
grant execute on function can_write_subject_score(uuid, uuid) to authenticated;


-- ── DANH SÁCH EM ĐỂ NHẬP ĐIỂM, CHO GIÁO VIÊN BỘ MÔN ─────────────────────────
-- VÌ SAO PHẢI LÀ RPC CHỨ KHÔNG PHẢI POLICY SELECT TRÊN student_term_reviews:
-- giáo viên bộ môn cần đúng ba thứ để dựng lưới nhập điểm — id phiếu, id em, tên em. Nhưng phiếu
-- còn chứa `comment` (nhận xét GVCN gửi gia đình) và `conduct` (hạnh kiểm). RLS của Postgres chặn
-- theo DÒNG, KHÔNG chặn theo CỘT — 0064 đã viết cảnh báo đó ngay trên cột comment. Cho quyền
-- select dòng là cho luôn cả nhận xét của cô chủ nhiệm về hoàn cảnh gia đình đứa trẻ, cho mọi
-- giáo viên bộ môn. Hàm này trả ĐÚNG ba cột, không hơn.
-- Kiểm quyền nằm trong WHERE nên fail-closed: không phận sự thì ra 0 dòng, không phải "ra hết".
create or replace function subject_roster(p_term uuid, p_class uuid)
returns table (review_id uuid, student_id uuid, full_name text, con_hoc boolean)
  language sql stable security definer set search_path = public as $$
  select v.id, v.student_id,
         coalesce(nullif(btrim(p.full_name), ''), p.email),
         exists (select 1 from enrollments e
                 where e.class_id = v.class_id and e.student_id = v.student_id and e.is_active)
  from student_term_reviews v
  join profiles p on p.id = v.student_id
  where v.term_id = p_term
    and v.class_id = p_class
    and (is_subject_teacher_of_class(p_class) or staff_can_read_class(p_class))
  order by coalesce(nullif(btrim(p.full_name), ''), p.email);
$$;
revoke all on function subject_roster(uuid, uuid) from public, anon;
grant execute on function subject_roster(uuid, uuid) to authenticated;

-- ── GIEO CẢ BỘ MÔN CHUẨN CHO MỘT LỚP ────────────────────────────────────────
-- Không có hàm này thì "bảng class_subjects riêng" biến thành 6 lớp × 13 môn = 78 lần bấm tay,
-- và không ai làm — rồi ô chọn môn rỗng, rồi lại quay về gõ tay tên môn.
create or replace function seed_class_subjects(p_class uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare v_n int; v_campus uuid; v_level school_level;
begin
  select c.campus_id, cp.level into v_campus, v_level
  from classes c join campuses cp on cp.id = c.campus_id
  where c.id = p_class;
  if v_campus is null then raise exception 'Không thấy lớp'; end if;

  if not (staff_can_manage_class(p_class)
          or (auth_role() = 'principal'::user_role and v_campus = auth_campus())) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp, ban giám hiệu cơ sở này hoặc quản trị viên được sửa chương trình của lớp';
  end if;

  insert into class_subjects (class_id, subject_id, created_by)
  select p_class, s.id, auth.uid()
  from subjects s
  where s.is_active
    and (s.campus_id is null or s.campus_id = v_campus)
  on conflict (class_id, subject_id) do nothing;   -- gọi lại bao nhiêu lần cũng an toàn

  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function seed_class_subjects(uuid) from public, anon;
grant execute on function seed_class_subjects(uuid) to authenticated;

drop trigger if exists trg_touch_subjects on subjects;
-- (updated_at của subjects/teaching_assignments do chính trigger guard lo — không gắn thêm
--  touch_updated_at để khỏi chạy hai lượt, đúng ghi chú ở 0064.)



-- ══════════════════════════════════════════════════════════════════════════════
-- 0069 (2/4) — GIEO DANH MỤC MÔN CỦA TRƯỜNG VIỆT ANH + LỚP NÀO HỌC MÔN NÀO.
--
-- NGUỒN: bảng môn × lớp do chủ trường cung cấp ngày 2026-07-30. KHÔNG gieo theo danh mục
-- Chương trình GDPT 2018 mặc định — trường có môn riêng ("Oxford English") và có mấy chỗ khác
-- văn bản; gieo theo văn bản rồi bắt trường sửa lại 14 dòng là làm ngược.
--
-- ── BẢNG SỐ LỚP, thay cho cách khoá theo cấp học ────────────────────────────
-- Vì sao cần: bảng của trường có Toán / Ngữ văn / Tiếng Anh dạy từ lớp 6 tới lớp 12 — vắt qua cả
-- THCS lẫn THPT. Nếu khoá danh mục theo cấp thì ba môn đó phải gieo hai dòng, và điểm Toán lớp 9
-- với điểm Toán lớp 10 thành hai môn khác nhau khi tổng hợp.
--
-- Dùng SỐ LỚP (1–12) chứ không trỏ vào bảng `grades`: `grades` là bản ghi riêng của từng cơ sở
-- (hiện 16 dòng cho 4 cơ sở, mỗi cơ sở một bộ Khối 6/7/8/9). Gắn danh mục môn vào đó thì mở cơ
-- sở mới lại phải gieo lại toàn bộ, và bốn cơ sở dễ lệch nhau. Cột `grades.sort_order` CHÍNH LÀ
-- số lớp, nên "Toán: lớp 6–12" đủ dùng cho mọi cơ sở hiện tại lẫn cơ sở mở sau.
-- ══════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists subject_grades (
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_no   smallint not null check (grade_no between 1 and 12),
  primary key (subject_id, grade_no)
);

comment on table subject_grades is
  'Môn này dạy ở những lớp nào (số lớp 1-12). Môn KHÔNG có dòng nào ở đây = chưa khai, chọn được cho mọi lớp.';

-- Khoá chính đã phủ subject_id ở cột đầu nên không tạo thêm chỉ mục cho khoá ngoại đó (dự án đã
-- phải gỡ chỉ mục trùng ở 0054, đừng lặp lại). Chỉ mục ngược để hỏi "lớp 7 học môn gì".
create index if not exists idx_subject_grades_grade on subject_grades (grade_no);

alter table subject_grades enable row level security;

-- Đọc: mọi người đã đăng nhập — đây chỉ là "môn X dạy lớp mấy", không có dữ liệu trẻ em.
drop policy if exists rls_select_subject_grades on subject_grades;
create policy rls_select_subject_grades on subject_grades
  as permissive for select to authenticated using (true);

-- Ghi: chỉ quản trị viên. Đây là chương trình học của cả trường, không phải việc của từng lớp.
drop policy if exists rls_admin_subject_grades on subject_grades;
create policy rls_admin_subject_grades on subject_grades
  as permissive for all to authenticated
  using      ((select auth_role()) = 'admin'::user_role)
  with check ((select auth_role()) = 'admin'::user_role);

grant select, insert, update, delete on subject_grades to authenticated;


-- ── Gieo 14 môn ─────────────────────────────────────────────────────────────
-- `where not exists` chứ không `on conflict`: chỉ mục duy nhất trên subjects là chỉ mục MỘT PHẦN
-- (where campus_id is null), suy luận arbiter dễ trượt. Dán lại file lần hai vẫn an toàn.
insert into subjects (code, name, short_name, sort_order, is_scored, is_active)
select v.code, v.name, v.short_name, v.sort_order, v.is_scored, true
from (values
  -- mã          tên đầy đủ                          mã ngắn      thứ tự  chấm điểm
  ('VAN',   'Ngữ văn',                        'Văn',        10,  true ),
  ('TOAN',  'Toán',                           'Toán',       20,  true ),
  ('ANH',   'Tiếng Anh',                      'Anh',        30,  true ),
  ('OXENG', 'Oxford English',                 'Oxford',     35,  true ),
  ('KHTN',  'Khoa học tự nhiên',              'KHTN',       40,  true ),
  ('LSDL',  'Lịch sử và Địa lí',              'Sử - Địa',   50,  true ),
  ('GDCD',  'Giáo dục công dân',              'GDCD',       60,  true ),
  ('TIN',   'Tin học',                        'Tin',        70,  true ),
  ('CN',    'Công nghệ',                      'Công nghệ',  80,  true ),
  ('LY',    'Vật lí',                         'Lí',         90,  true ),
  ('HOA',   'Hoá học',                        'Hoá',       100,  true ),
  ('SINH',  'Sinh học',                       'Sinh',      110,  true ),
  ('DIA',   'Địa lí',                         'Địa',       120,  true ),
  ('GDKTPL','Giáo dục kinh tế và pháp luật',  'GDKT-PL',   130,  true )
) as v(code, name, short_name, sort_order, is_scored)
where not exists (
  select 1 from subjects s where s.campus_id is null and s.code = v.code
);


-- ── Gieo "môn này dạy lớp nào", đúng như bảng của trường ────────────────────
-- BỐN MÔN CỐ Ý ĐỂ TRỐNG, không tự đoán: bảng của trường không đánh dấu lớp nào cho
-- "Lịch sử và Địa lí", "Tin học", "Oxford English"; và "Hoá học" chỉ đánh dấu lớp 10.
-- Môn không có dòng nào ở subject_grades sẽ CHỌN ĐƯỢC CHO MỌI LỚP — không chặn nhầm ai, và ai
-- mở màn hình quản lý môn cũng thấy ngay dòng "chưa khai lớp" để bổ sung.
-- (Hoá học thì gieo đúng lớp 10 như bảng ghi, dù thường là 10-12 — trường soát lại.)
insert into subject_grades (subject_id, grade_no)
select s.id, g.n
from subjects s
join (values
  ('TOAN',   6), ('TOAN',   7), ('TOAN',   8), ('TOAN',   9), ('TOAN',  10), ('TOAN',  11), ('TOAN',  12),
  ('VAN',    6), ('VAN',    7), ('VAN',    8), ('VAN',    9), ('VAN',   10), ('VAN',   11), ('VAN',   12),
  ('ANH',    6), ('ANH',    7), ('ANH',    8), ('ANH',    9), ('ANH',   10), ('ANH',   11), ('ANH',   12),
  ('KHTN',   6), ('KHTN',   7), ('KHTN',   8), ('KHTN',   9),
  ('GDCD',   6), ('GDCD',   7), ('GDCD',   8), ('GDCD',   9),
  ('CN',     6), ('CN',     7), ('CN',     8), ('CN',     9), ('CN',    10), ('CN',    11),
  ('LY',    10), ('LY',    11), ('LY',    12),
  ('HOA',   10),
  ('SINH',  10), ('SINH',  11), ('SINH',  12),
  ('DIA',    9), ('DIA',   10), ('DIA',   11), ('DIA',   12),
  ('GDKTPL',10), ('GDKTPL',11), ('GDKTPL',12)
) as g(code, n) on g.code = s.code and s.campus_id is null
on conflict (subject_id, grade_no) do nothing;


-- ── Môn nào chọn được cho lớp nào ───────────────────────────────────────────
-- Môn CHƯA KHAI lớp nào thì mở cho mọi lớp (xem ghi chú trên). Dùng grades.sort_order làm số lớp.
create or replace function subject_fits_grade(p_subject uuid, p_class uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from subject_grades sg where sg.subject_id = p_subject)
      or exists (
        select 1
        from classes c
        join grades g on g.id = c.grade_id
        join subject_grades sg on sg.subject_id = p_subject and sg.grade_no = g.sort_order
        where c.id = p_class
      )
      -- Lớp chưa gắn khối (grade_id NULL) thì không chặn — 0049 ghi nhận có bản ghi thiếu khối,
      -- chặn ở đây là làm giáo viên không nhập được điểm mà không hiểu vì sao.
      or exists (select 1 from classes c where c.id = p_class and c.grade_id is null);
$$;
revoke all on function subject_fits_grade(uuid, uuid) from public, anon;
grant execute on function subject_fits_grade(uuid, uuid) to authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- 0069 (3/4) — ĐỔI HAI CỘT CHỮ TỰ DO SANG KHOÁ NGOẠI. Chạy SAU phần (2).
--
-- QUYẾT ĐỊNH E — ĐỔI HẲN, KHÔNG GIỮ CỘT CŨ LÀM DỰ PHÒNG. Nói rõ vì sao, vì đây là lựa chọn
-- không quay lại được:
--   • "Thêm subject_id NULL và giữ cột text" nghe an toàn nhưng chính là HAI NGUỒN SỰ THẬT —
--     đúng cái bệnh đang chữa. Ba tuần nữa sẽ có dòng subject_id = Ngữ văn còn subject = 'Ngữ Văn',
--     và không ai biết dòng nào đúng.
--   • Cột dự phòng mà không code nào ghi thì mục rữa trong một tháng; cột mà code VẪN ghi thì nó
--     là nguồn sự thật thứ hai. Không có lựa chọn thứ ba.
--   • Dữ liệu cho phép: subject_scores 0 dòng, timetable_slots ĐÚNG 2 dòng ("KHTN", "Toán") —
--     cả hai khớp thẳng vào danh mục vừa gieo ("KHTN" khớp mã, "Toán" khớp tên).
-- ĐỔI LẠI PHẢI TRẢ: bản đang chạy trên VPS sẽ HỎNG phần lưu TKB ngay khi cột `subject` biến mất.
-- Xem mục "rủi ro" — phải áp migration và deploy bản mới liền nhau.
--
-- Cả file chạy trong MỘT transaction ngầm (scripts/run-sql.mjs gửi nguyên chuỗi), nên mọi
-- `raise exception` bên dưới cuộn lại sạch: không có chuyện bảng đổi được một nửa.
-- ══════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- ── E1. subject_scores (0 dòng) ─────────────────────────────────────────────
alter table subject_scores
  add column if not exists subject_id uuid references subjects(id) on delete restrict;

-- Bảng đang rỗng nên câu này gần như không làm gì. Vẫn viết: giữa lúc đo (0 dòng) và lúc chạy có
-- thể có người vừa nhập thử vài con điểm, và mất điểm thật thì không ai dựng lại được.
update subject_scores sc
set subject_id = s.id
from student_term_reviews v, classes c, campuses cp, subjects s
where v.id  = sc.review_id
  and c.id  = v.class_id
  and cp.id = c.campus_id
  and (s.campus_id is null or s.campus_id = c.campus_id)
  and (lower(btrim(s.name)) = lower(btrim(sc.subject))
       or upper(btrim(s.code)) = upper(btrim(sc.subject))
       or lower(btrim(s.short_name)) = lower(btrim(sc.subject)))
  and sc.subject_id is null;

do $$
declare n int; ds text;
begin
  select count(*), string_agg(distinct subject, ', ')
    into n, ds from subject_scores where subject_id is null;
  if n > 0 then
    raise exception 'DỪNG: % con điểm không khớp được môn nào trong danh mục (%). Thêm môn vào bảng subjects rồi chạy lại — KHÔNG có gì bị ghi.', n, ds;
  end if;
end $$;

-- View phải gỡ TRƯỚC khi bỏ cột, nếu không Postgres chặn vì phụ thuộc.
drop view if exists subject_term_summary_v;

-- Bỏ cột kéo theo luôn unique (review_id, subject, kind, ordinal) và constraint
-- subject_scores_subject_check — không cần gọi tên chúng, và cũng không nên đoán tên tự sinh.
-- ⚠ KHÔNG XOÁ CỘT CHỮ CŨ TRONG CÙNG MIGRATION NÀY — cố ý.
--
-- Bản thiết kế ban đầu có  ngay tại đây. Bỏ đi, vì nó tạo một CỬA SỔ HỎNG:
-- container đang chạy trên VPS vẫn là mã cũ, vẫn gửi cột  khi lưu thời khoá biểu. Giây
-- phút migration chạy xong mà image mới chưa lên là mọi thao tác lưu TKB gãy — và trường đang
-- trong đợt thử với người dùng thật.
--
-- Nên làm kiểu CỘNG THÊM (expand/contract): giai đoạn này cột mới đứng CẠNH cột cũ, cả mã cũ lẫn
-- mã mới đều chạy được. Xoá cột cũ để dành cho một migration riêng, chạy SAU khi mã mới đã lên
-- production và xác nhận /api/health trả đúng SHA.
--
-- Đổi lại: cột subject_id để NULL được ở giai đoạn này. Ràng buộc NOT NULL đi cùng lệnh xoá cột.
alter table subject_scores
  add constraint subject_scores_review_subject_kind_ordinal_key
  unique (review_id, subject_id, kind, ordinal);

comment on column subject_scores.subject_id is
  'Khoá ngoại tới danh mục môn. Trước 0069 đây là chữ tự do — hai lớp gõ "Ngữ văn"/"Ngữ Văn" thành hai môn khác nhau.';

-- Chỉ mục cho khoá ngoại mới (luật 3), và cũng là chỉ mục cho câu hỏi "điểm môn này của cả
-- trường" — thứ trước 0069 không hỏi được.
create index if not exists idx_subject_scores_subject on subject_scores (subject_id);

-- Dựng lại view. VẪN security_invoker = true — điều kiện sống còn: view definer ở đây sẽ mở
-- toang bảng điểm cho mọi người đăng nhập (lỗ đã phải vá ở 0038).
-- Giữ NGUYÊN tên cột `subject` (giờ là tên môn lấy từ danh mục) để ClassScoreTable/FamilyReport
-- không phải đổi cách gom nhóm — tên môn giờ đã duy nhất nên gom theo tên là an toàn.
create or replace view subject_term_summary_v with (security_invoker = true) as
select
  s.review_id,
  s.subject_id,
  m.name       as subject,
  m.short_name,
  m.sort_order,
  count(*)                                                     as so_con_diem,
  round(sum(s.score * s.weight) / nullif(sum(s.weight), 0), 2) as diem_trung_binh
from subject_scores s
join subjects m on m.id = s.subject_id
group by s.review_id, s.subject_id, m.name, m.short_name, m.sort_order;

comment on view subject_term_summary_v is
  'Trung bình có hệ số của từng môn trong một phiếu. security_invoker → ai không đọc được điểm thì cũng không đọc được dòng tổng kết.';

grant select on subject_term_summary_v to authenticated;


-- ── E2. timetable_slots (2 dòng: "KHTN", "Toán") ────────────────────────────
alter table timetable_slots
  add column if not exists subject_id uuid references subjects(id) on delete restrict;

-- Khớp theo BA đường: tên đầy đủ, mã máy, mã ngắn — không phân biệt hoa thường, không phân biệt
-- dấu cách thừa. "KHTN" khớp mã KHTN; "Toán" khớp tên Toán.
update timetable_slots ts
set subject_id = s.id
from classes c, campuses cp, subjects s
where c.id  = ts.class_id
  and cp.id = c.campus_id
  and (s.campus_id is null or s.campus_id = c.campus_id)
  and (lower(btrim(s.name)) = lower(btrim(ts.subject))
       or upper(btrim(s.code)) = upper(btrim(ts.subject))
       or lower(btrim(s.short_name)) = lower(btrim(ts.subject)))
  and ts.subject_id is null;

-- DỪNG HẲN nếu còn ô chưa khớp, thay vì lặng lẽ bỏ NOT NULL hay xoá dòng. Thời khoá biểu biến
-- mất một tiết là thứ học sinh phát hiện trước nhà trường.
do $$
declare n int; ds text;
begin
  select count(*), string_agg(distinct subject, ', ')
    into n, ds from timetable_slots where subject_id is null;
  if n > 0 then
    raise exception 'DỪNG: % ô thời khoá biểu không khớp môn nào trong danh mục (%). Thêm các môn đó vào bảng subjects (môn riêng của cơ sở nếu cần) rồi chạy lại — KHÔNG có gì bị ghi.', n, ds;
  end if;
end $$;

-- ⚠ KHÔNG XOÁ CỘT CHỮ CŨ TRONG CÙNG MIGRATION NÀY — cố ý.
--
-- Bản thiết kế ban đầu có  ngay tại đây. Bỏ đi, vì nó tạo một CỬA SỔ HỎNG:
-- container đang chạy trên VPS vẫn là mã cũ, vẫn gửi cột  khi lưu thời khoá biểu. Giây
-- phút migration chạy xong mà image mới chưa lên là mọi thao tác lưu TKB gãy — và trường đang
-- trong đợt thử với người dùng thật.
--
-- Nên làm kiểu CỘNG THÊM (expand/contract): giai đoạn này cột mới đứng CẠNH cột cũ, cả mã cũ lẫn
-- mã mới đều chạy được. Xoá cột cũ để dành cho một migration riêng, chạy SAU khi mã mới đã lên
-- production và xác nhận /api/health trả đúng SHA.
--
-- Đổi lại: cột subject_id để NULL được ở giai đoạn này. Ràng buộc NOT NULL đi cùng lệnh xoá cột.

comment on column timetable_slots.subject_id is
  'Khoá ngoại tới danh mục môn. Trước 0069 là chữ tự do, nên TKB và bảng điểm không nối được với nhau.';

-- Chỉ mục khoá ngoại (luật 3). unique (class_id, day_of_week, period_no) không đụng gì tới cột
-- này nên vẫn nguyên vẹn; RLS của bảng (tt_read/tt_manage 0029 + policy hiệu trưởng 0057) cũng
-- chỉ soi class_id, không soi subject → không phải sửa policy nào.
create index if not exists idx_timetable_subject on timetable_slots (subject_id);

-- Xếp TKB xong là lớp coi như có môn đó. Trigger AFTER (không phải BEFORE) vì chỉ đi ghi bảng
-- khác, không sửa dòng đang ghi. SECURITY DEFINER để một sai lệch quyền giữa hai bảng không làm
-- CHẾT màn hình thời khoá biểu — nó chỉ ghi đúng cặp (lớp, môn) mà người gọi vừa chứng minh là
-- mình được phép gắn vào lớp đó.
create or replace function ensure_class_subject() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into class_subjects (class_id, subject_id, created_by)
  values (new.class_id, new.subject_id, auth.uid())
  on conflict (class_id, subject_id) do nothing;
  return null;
end $$;
revoke all on function ensure_class_subject() from public, anon, authenticated;
drop trigger if exists trg_ensure_class_subject on timetable_slots;
create trigger trg_ensure_class_subject
  after insert or update of subject_id on timetable_slots
  for each row execute function ensure_class_subject();

-- Nạp chương trình lớp từ TKB đang có (2 dòng → 2 cặp). Bấy nhiêu chưa đủ để dạy học: sau khi
-- áp migration, ban giám hiệu bấm "Gieo môn chuẩn" cho từng lớp, hoặc chạy tay:
--   select c.name, seed_class_subjects(c.id) from classes c where c.is_active;
insert into class_subjects (class_id, subject_id)
select distinct ts.class_id, ts.subject_id from timetable_slots ts
on conflict (class_id, subject_id) do nothing;

-- Soát lại: hai dòng TKB phải có subject_id, và class_subjects phải có đúng bấy nhiêu cặp.
select (select count(*) from timetable_slots)                          as o_tkb,
       (select count(*) from timetable_slots where subject_id is null) as tkb_thieu_mon,
       (select count(*) from class_subjects)                           as cap_lop_mon;
-- ── Nới cột chữ cũ thành NULL được ──────────────────────────────────────────
-- BẮT BUỘC cho kiểu cộng thêm: mã mới chỉ ghi subject_id, không ghi  nữa. Cột đó đang
-- NOT NULL nên mọi lệnh chèn của mã mới sẽ lỗi ngay. Nới ra để hai phiên bản mã cùng chạy được
-- trong khoảng thời gian deploy.
alter table timetable_slots alter column subject drop not null;
alter table subject_scores  alter column subject drop not null;
alter table homework_posts  alter column subject drop not null;

-- ── homework_posts: nguồn tên môn TỰ DO THỨ BA ─────────────────────────────
-- Bản khảo sát mã nguồn tìm ra chỗ này (0061, dòng 48) — tôi đã bỏ sót khi lên kế hoạch. Cùng
-- một bệnh: gõ tay tên môn, không ràng buộc gì. Tệ hơn hai chỗ kia ở chỗ tên môn đó còn chui vào
-- TIÊU ĐỀ THÔNG BÁO ĐẨY (0068), tức là sai chính tả thì cả lớp cùng phụ huynh nhận được.
alter table homework_posts
  add column if not exists subject_id uuid references subjects(id) on delete restrict;

update homework_posts hp
set subject_id = s.id
from subjects s
where hp.subject_id is null
  and (lower(btrim(s.name)) = lower(btrim(hp.subject))
       or upper(btrim(s.code)) = upper(btrim(hp.subject))
       or lower(btrim(s.short_name)) = lower(btrim(hp.subject)));

create index if not exists idx_homework_subject on homework_posts (subject_id);

-- Thông báo bài mới lấy tên môn từ DANH MỤC. Trước đây ghép thẳng new.subject.
create or replace function notify_homework_post() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_mon text;
  v_nhan text;
begin
  select name into v_mon from subjects where id = new.subject_id;
  -- Còn dòng cũ chưa có subject_id thì vẫn dùng chữ cũ — không để thông báo trống tên môn.
  v_mon := coalesce(v_mon, nullif(btrim(new.subject), ''), 'môn học');

  v_nhan := case new.kind
              when 'assignment' then 'Bài tập mới'
              when 'exam'       then 'Thông báo kiểm tra'
              else                   'Dặn dò mới'
            end || ' — ' || v_mon;

  insert into notifications (user_id, title, body, link)
  select e.student_id, v_nhan, null, '/homework'
    from enrollments e
   where e.class_id = new.class_id and e.is_active;

  insert into notifications (user_id, title, body, link)
  select distinct pl.parent_id, v_nhan, null, '/homework'
    from enrollments e
    join parent_links pl on pl.student_id = e.student_id
   where e.class_id = new.class_id and e.is_active;

  return null;
end $$;
revoke all on function notify_homework_post() from public, anon, authenticated;



-- ══════════════════════════════════════════════════════════════════════════════
-- 0069 (4/4) — RLS. Chạy SAU phần (3), vì policy của subject_scores nhắc tới cột subject_id.
--
-- QUYẾT ĐỊNH D — PHẦN NHẠY CẢM NHẤT, chốt bằng ba câu:
--   1. GIÁO VIÊN BỘ MÔN GHI: chỉ MÔN MÌNH, chỉ LỚP MÌNH ĐƯỢC PHÂN CÔNG, chỉ khi đợt CHƯA CHỐT SỔ.
--      Không chạm được con điểm môn khác NGAY TRONG CHÍNH LỚP MÌNH DẠY.
--   2. GIÁO VIÊN BỘ MÔN ĐỌC ĐIỂM MÔN KHÁC CỦA LỚP ĐÓ: KHÔNG. Ý KIẾN THẲNG — tiện thì có tiện,
--      nhưng cô dạy Toán không cần điểm Văn để chấm Toán. Đây là dữ liệu trẻ em: mở cho tiện là
--      nhân số người đọc được toàn bộ bảng điểm một lớp lên gấp 10 lần (mỗi lớp ~10 giáo viên bộ
--      môn) để đổi lấy một thứ không ai yêu cầu. Người cần nhìn cả bảng điểm lớp là GVCN và ban
--      giám hiệu — họ đã có sẵn. Trường nào nhất định muốn thì đó phải là một migration RIÊNG có
--      tên, có người ký, không lẫn vào đây.
--   3. student_term_reviews (nhận xét + hạnh kiểm): KHÔNG đọc trực tiếp, KHÔNG ghi.
--      MẶC ĐỊNH AN TOÀN LÀ KHÔNG. Nhận xét là thứ GVCN viết cho gia đình, hạnh kiểm là kết luận
--      của GVCN. Giáo viên bộ môn cần đúng danh sách em + id phiếu → đã có RPC subject_roster()
--      trả ba cột, không kèm nhận xét (RLS không chặn được theo CỘT — cảnh báo có sẵn trong 0064).
-- ══════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- ── subjects: đọc chung, ghi rất hẹp ────────────────────────────────────────
alter table subjects enable row level security;

-- ĐỌC: mọi người đã đăng nhập. Dòng ở đây KHÔNG có dữ liệu trẻ em — chỉ là tên môn, đúng mức
-- nhạy cảm của `grades`/`campuses`/`assessment_terms` vốn đã mở đọc cho người đăng nhập. Siết
-- theo cơ sở sẽ chặn nhầm chính giáo viên: 0049 ghi nhận có giáo viên được mời mà
-- profiles.campus_id vẫn NULL.
drop policy if exists rls_select_subjects on subjects;
create policy rls_select_subjects on subjects
  as permissive for select to authenticated using (true);

drop policy if exists rls_admin_subjects on subjects;
create policy rls_admin_subjects on subjects
  as permissive for all to authenticated
  using       ((select auth_role()) = 'admin'::user_role)
  with check  ((select auth_role()) = 'admin'::user_role);

-- Hiệu trưởng chỉ đụng được môn RIÊNG của cơ sở mình. `campus_id is not null` là vế quan trọng
-- nhất ở đây: thiếu nó thì một hiệu trưởng đổi tên "Ngữ văn" là đổi cho cả bốn cơ sở, và mọi
-- con điểm Ngữ văn toàn trường đổi nhãn theo.
drop policy if exists rls_principal_subjects on subjects;
create policy rls_principal_subjects on subjects
  as permissive for all to authenticated
  using (
    (select auth_role()) = 'principal'::user_role
    and campus_id is not null and campus_id = (select auth_campus())
  )
  with check (
    (select auth_role()) = 'principal'::user_role
    and campus_id is not null and campus_id = (select auth_campus())
  );

-- RLS đúng mà thiếu GRANT thì PostgREST trả 42501 — dự án đã dính 3 lần (0015, 0037, và mới đây).
grant select, insert, update, delete on subjects to authenticated;


-- ── class_subjects: chương trình của lớp ────────────────────────────────────
alter table class_subjects enable row level security;

drop policy if exists rls_select_class_subjects on class_subjects;
create policy rls_select_class_subjects on class_subjects
  as permissive for select to authenticated
  using (
    staff_can_read_class(class_id)          -- GVCN lớp | hiệu trưởng cùng cơ sở | admin
    or is_subject_teacher_of_class(class_id)
    or is_class_student(class_id)
    or is_parent_of_class(class_id)         -- "con tôi học những môn gì" là câu hỏi chính đáng
  );

-- GHI: GVCN lớp + admin (staff_can_manage_class) + hiệu trưởng cùng cơ sở.
-- Cho GVCN sửa được là CÓ CHỦ Ý: bảng này KHÔNG cấp quyền đọc/ghi dữ liệu của một đứa trẻ nào —
-- nó chỉ là danh sách tên môn. Môn học theo đợt phát sinh giữa kỳ mà phải chờ ban giám hiệu thì
-- cô sẽ quay lại gõ tay tên môn ở chỗ khác, và ta mất trắng thứ vừa dựng.
drop policy if exists rls_write_class_subjects on class_subjects;
create policy rls_write_class_subjects on class_subjects
  as permissive for all to authenticated
  using (
    staff_can_manage_class(class_id)
    or ((select auth_role()) = 'principal'::user_role and class_campus(class_id) = (select auth_campus()))
  )
  with check (
    staff_can_manage_class(class_id)
    or ((select auth_role()) = 'principal'::user_role and class_campus(class_id) = (select auth_campus()))
  );

grant select, insert, update, delete on class_subjects to authenticated;


-- ── teaching_assignments: BẢNG CẤP QUYỀN, siết nhất ─────────────────────────
alter table teaching_assignments enable row level security;

-- ĐỌC: chính giáo viên đó (phải biết mình dạy gì ở đâu), GVCN của lớp (phải biết ai đang ghi vào
-- học bạ lớp mình — đây là chốt kiểm soát bằng con người, đừng bỏ), hiệu trưởng cùng cơ sở, admin.
drop policy if exists rls_select_teaching_assignments on teaching_assignments;
create policy rls_select_teaching_assignments on teaching_assignments
  as permissive for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or staff_can_read_class(class_id)
  );

-- GHI: ADMIN + HIỆU TRƯỞNG TRONG CƠ SỞ MÌNH. GVCN **KHÔNG** được tự phân công cho lớp mình.
-- Ý KIẾN THẲNG, đây là chỗ đáng cãi nhất của cả migration:
--   • Thêm một dòng ở bảng này = MỞ QUYỀN GHI vào học bạ của một lớp cho một người. Để người
--     hưởng lợi tự cấp là mô hình sai từ gốc — GVCN có thể cấp cho bất kỳ đồng nghiệp nào quyền
--     đọc-ghi điểm lớp mình, mà chẳng ai ngoài họ biết.
--   • Ở trường thật, phân công chuyên môn là việc của ban giám hiệu / tổ trưởng bộ môn, không
--     phải của GVCN. Làm đúng thực tế thì cũng đúng an toàn, hiếm khi được cả hai.
--   • GVCN không mất gì: họ vẫn ĐỌC được ai dạy lớp mình (policy trên), và vẫn tự nhập được điểm
--     mọi môn của lớp mình như hôm nay (0064 giữ nguyên).
-- `class_campus(...)` chứ không `exists(select from classes ...)`: tránh policy gọi vào RLS của
-- classes rồi vòng lại chính bảng này.
drop policy if exists rls_write_teaching_assignments on teaching_assignments;
create policy rls_write_teaching_assignments on teaching_assignments
  as permissive for all to authenticated
  using (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and class_campus(class_id) = (select auth_campus()))
  )
  with check (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and class_campus(class_id) = (select auth_campus()))
  );

grant select, insert, update, delete on teaching_assignments to authenticated;


-- ── subject_scores: MỞ CHO GIÁO VIÊN BỘ MÔN ─────────────────────────────────
-- Bốn policy MỚI, cộng thêm vào bốn policy cũ của 0064 (policy permissive nên OR với nhau —
-- KHÔNG sửa policy cũ, GVCN và admin giữ nguyên quyền y như trước).
--
-- ⚠ ĐIỂM CHẾT NGƯỜI Ở POLICY UPDATE: USING soi dòng CŨ, WITH CHECK soi dòng MỚI. Chỉ viết USING
-- thì cô dạy Toán update dòng điểm Toán của mình, đổi subject_id thành Ngữ văn — và vừa ghi được
-- vào môn không phải của mình. Phải có CẢ HAI vế, cả hai cùng gọi can_write_subject_score với
-- subject_id của chính dòng đang xét.
drop policy if exists rls_select_subject_scores_gvbm on subject_scores;
create policy rls_select_subject_scores_gvbm on subject_scores
  as permissive for select to authenticated
  using (can_read_subject_score(review_id, subject_id));

drop policy if exists rls_insert_subject_scores_gvbm on subject_scores;
create policy rls_insert_subject_scores_gvbm on subject_scores
  as permissive for insert to authenticated
  with check (can_write_subject_score(review_id, subject_id));

drop policy if exists rls_update_subject_scores_gvbm on subject_scores;
create policy rls_update_subject_scores_gvbm on subject_scores
  as permissive for update to authenticated
  using      (can_write_subject_score(review_id, subject_id))
  with check (can_write_subject_score(review_id, subject_id));

-- Xoá con điểm gõ nhầm là nghiệp vụ thật (gõ 9 thành 90). Chốt an toàn vẫn là is_locked, nằm sẵn
-- trong can_write_subject_score.
drop policy if exists rls_delete_subject_scores_gvbm on subject_scores;
create policy rls_delete_subject_scores_gvbm on subject_scores
  as permissive for delete to authenticated
  using (can_write_subject_score(review_id, subject_id));

-- (grant trên subject_scores đã có từ 0064 — không cần lặp, và cũng không được thu hẹp.)

-- KHÔNG có policy nào cho giáo viên bộ môn trên student_term_reviews. Cố ý. Xem quyết định D§3.


-- ── Ba policy ĐỌC bắt buộc, thiếu là tính năng chết ─────────────────────────
-- Giáo viên bộ môn hôm nay KHÔNG đọc được lớp mình dạy (classes chỉ mở cho GVCN/BGH/admin),
-- KHÔNG đọc được danh sách em (enrollments), KHÔNG đọc được tên em (profiles: is_my_student chỉ
-- tính GVCN). Không mở ba chỗ này thì màn hình của họ trắng trơn dù policy điểm ở trên đã đúng.
-- Cả ba đều hỏi QUAN HỆ THẬT qua teaching_assignments, không hỏi vai trò.
drop policy if exists class_subject_teacher_read on classes;
create policy class_subject_teacher_read on classes
  for select to authenticated using (is_subject_teacher_of_class(id));

drop policy if exists enr_subject_teacher_read on enrollments;
create policy enr_subject_teacher_read on enrollments
  for select to authenticated using (is_subject_teacher_of_class(class_id));

-- MỞ RỘNG DỮ LIỆU TRẺ EM, nói rõ ra: giáo viên bộ môn sẽ đọc được dòng profiles của các em mình
-- dạy — họ tên, email, ảnh đại diện, ngôn ngữ. KHÔNG kèm student_details (0058) vì bảng đó có
-- policy riêng bám is_my_student (GVCN), không đụng tới ở đây. Đây là mức tối thiểu để vẽ được
-- lưới nhập điểm có tên em; không có nó thì phải hiện uuid, và cô sẽ nhập nhầm em.
drop policy if exists prof_subject_teacher_students on profiles;
create policy prof_subject_teacher_students on profiles
  for select to authenticated using (is_my_subject_student(id));


-- ══════════════════════════════════════════════════════════════════════════════
-- BỘ KIỂM CHỨNG — chạy trên chính DB thật, theo mẹo có sẵn ở supabase/tests/rls_security.sql:
-- giả danh từng vai trong một transaction rồi rollback. CHỈ ĐẾM DÒNG, không kéo tên/email.
--
-- begin;
--   select set_config('request.jwt.claims',
--          json_build_object('sub','<uuid GV dạy TOÁN lớp 7A>','role','authenticated')::text, true);
--   set local role authenticated;
--   -- PHẢI = 0: không thấy con điểm môn khác, kể cả trong chính lớp 7A
--   select count(*) from subject_scores s join subjects m on m.id = s.subject_id where m.code <> 'TOAN';
--   -- PHẢI = 0: không đọc được phiếu (nhận xét/hạnh kiểm) của bất kỳ em nào
--   select count(*) from student_term_reviews;
--   -- PHẢI = 0: không thấy lớp nào mình không dạy
--   select count(*) from classes c where not is_subject_teacher_of_class(c.id) and not is_class_teacher(c.id);
--   -- PHẢI BÁO LỖI/0 dòng: ghi điểm môn Ngữ văn của chính lớp mình dạy
--   -- insert into subject_scores(review_id, subject_id, kind, ordinal, score, weight)
--   --   values ('<phiếu lớp 7A>', '<id Ngữ văn>', 'mieng', 1, 9, 1);
--   -- PHẢI BÁO LỖI: tự phân công thêm cho mình một môn nữa
--   -- insert into teaching_assignments(class_id, subject_id, teacher_id)
--   --   values ('<7A>','<id Ngữ văn>', auth.uid());
-- rollback;
--
-- Lặp lại với: GV dạy môn ở CƠ SỞ KHÁC (mọi số phải = 0) · GVCN (phải giữ nguyên quyền cũ:
-- đọc-ghi mọi môn của lớp mình) · hiệu trưởng (đọc được, UPDATE một dòng điểm phải hỏng) ·
-- GV có phân công đã is_active=false (mọi số phải = 0) · sau khi CHỐT SỔ đợt (GV bộ môn ghi
-- phải hỏng, admin vẫn ghi được).
-- ══════════════════════════════════════════════════════════════════════════════