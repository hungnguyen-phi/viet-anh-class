-- ══════════════════════════════════════════════════════════════════════════════
-- 0064 — Đánh giá TỪNG HỌC SINH theo đợt: điểm môn + nhận xét GVCN + hạnh kiểm.
--
-- VÌ SAO GỘP BA THỨ VÀO MỘT MÔ HÌNH, KHÔNG LÀM BA BẢNG RỜI:
--   Ba yêu cầu (điểm số môn học, nhận xét quá trình học, điểm rèn luyện/hạnh kiểm) khác nhau về
--   nội dung nhưng GIỐNG HỆT NHAU về câu hỏi khoá: "của em nào, trong đợt nào, lớp nào". Làm ba
--   bảng rời thì:
--     • ba lần lặp lại đúng một bộ RLS phức tạp → chỉ cần một bảng viết sai là rò dữ liệu trẻ em
--       (dự án đã dính đúng lỗi kiểu này ở att_student_select và wig_read);
--     • không có một chỗ nào để bật CÔNG BỐ. Phụ huynh sẽ thấy điểm nửa vời trong lúc cô đang nhập;
--     • mỗi bảng tự mang chuỗi 'Học kỳ 1' của riêng nó → ba màn hình lệch nhau ngay đợt đầu.
--   Nên: 1 bảng ĐỢT (mốc thời gian dùng chung) + 1 bảng PHIẾU của từng em trong đợt (nhận xét +
--   hạnh kiểm + cờ công bố) + 1 bảng CON ĐIỂM treo dưới phiếu. Phiếu là cửa duy nhất: ai đọc được
--   phiếu mới đọc được điểm.
-- ══════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- Enum thay vì check(text): trùng lối đã dùng trong dự án (user_role, attendance_status,
-- school_level) và sau này thêm loại đợt chỉ cần `alter type ... add value`, không phải sửa
-- ràng buộc trên bảng đang có dữ liệu.
-- Bọc DO ... exception: file này có thể bị dán lại lần hai trong SQL Editor (dự án từng lệch
-- migration vì lý do đó), `create type` không có `if not exists`.
do $$ begin
  create type assessment_term_kind as enum ('giua_ky_1','hoc_ky_1','giua_ky_2','hoc_ky_2','ca_nam');
exception when duplicate_object then null; end $$;

create table if not exists assessment_terms (
  id          uuid primary key default gen_random_uuid(),
  campus_id   uuid not null references campuses(id) on delete cascade,
  -- Mặc định lấy năm học hiện tại theo GIỜ VIỆT NAM (mốc chuyển tháng 6, xem 0025). Không dùng
  -- extract(year from now()) vì now() là UTC — đúng lỗi đã phải vá ở 0019.
  school_year text not null default current_school_year(),
  kind        assessment_term_kind not null,
  -- Tên hiển thị do trường tự đặt ('Học kỳ 1', 'Giữa học kỳ 2'). Tách khỏi `kind` vì kind là thứ
  -- máy so sánh/sắp xếp, name là thứ người đọc — trộn hai vai vào một cột thì đổi cách gọi tên
  -- một cái là hỏng mọi truy vấn.
  name        text not null,
  start_date  date,
  end_date    date,
  -- CHỐT SỔ. Sau khi tổng kết đợt, ban giám hiệu/quản trị bật cờ này: giáo viên hết sửa được điểm
  -- và nhận xét (chỉ admin còn quyền). Không có cờ này thì điểm có thể bị đổi lặng lẽ SAU khi phiếu
  -- đã về tay phụ huynh — thứ không ai phát hiện ra và không cãi được.
  is_locked   boolean not null default false,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (campus_id, school_year, kind),
  constraint assessment_terms_name_check
    check (btrim(name) <> '' and length(name) <= 80),
  constraint assessment_terms_dates_check
    check (start_date is null or end_date is null or end_date >= start_date)
);

comment on table assessment_terms is
  'Đợt đánh giá của MỘT CƠ SỞ trong MỘT NĂM HỌC. Là mốc thời gian dùng chung cho cả điểm môn, nhận xét và hạnh kiểm.';
comment on column assessment_terms.is_locked is
  'Đã chốt sổ: giáo viên không sửa được phiếu/điểm thuộc đợt này nữa. Chỉ admin mở lại.';

-- Chỉ chạm updated_at. Cố ý KHÔNG security definer: hàm này không đọc bảng nào nên không cần,
-- và definer thừa là bề mặt tấn công thừa.
create or replace function touch_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_assessment_terms on assessment_terms;
create trigger trg_touch_assessment_terms before update on assessment_terms
  for each row execute function touch_updated_at();

alter table assessment_terms enable row level security;

-- ĐỌC: mọi người đã đăng nhập. Dòng ở đây KHÔNG có dữ liệu trẻ em — chỉ là tên đợt và khoảng
-- ngày, giống hệt mức nhạy cảm của `grades`/`campuses` (0030) vốn đã mở đọc cho người đăng nhập.
-- Siết theo cơ sở ở đây sẽ chặn nhầm chính giáo viên: 0049 ghi nhận có giáo viên được mời mà
-- profiles.campus_id vẫn NULL, họ sẽ không chọn được đợt nào để nhập điểm.
create policy rls_select_assessment_terms on assessment_terms
  as permissive for select to authenticated
  using (true);

-- GHI: hiệu trưởng trong cơ sở mình + admin. Đây là NGOẠI LỆ CÓ CHỦ Ý so với yêu cầu
-- "principal chỉ XEM": khai báo học kỳ là việc LỊCH của nhà trường, không phải dữ liệu của một
-- đứa trẻ. Hiệu trưởng vẫn KHÔNG chạm được một con điểm hay một dòng nhận xét nào (xem hai bảng
-- dưới). Nếu trường muốn siết nữa thì đổi `principal` thành chỉ `admin` ở đây là xong, không ảnh
-- hưởng gì tới hai bảng kia.
create policy rls_all_assessment_terms on assessment_terms
  as permissive for all to authenticated
  using (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and campus_id = (select auth_campus()))
  )
  with check (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and campus_id = (select auth_campus()))
  );

-- BẮT BUỘC: RLS đúng mà thiếu GRANT thì PostgREST trả 42501 (bài học từ 0015).
grant select, insert, update, delete on assessment_terms to authenticated;

-- FK campus_id: không có chỉ mục thì mỗi lần xoá/sửa một cơ sở Postgres phải quét toàn bảng con.
-- Gộp luôn school_year vào vì truy vấn thật luôn là "các đợt của cơ sở X năm học này".
create index if not exists idx_assessment_terms_campus on assessment_terms (campus_id, school_year);

-- FK created_by — cùng lý do, và thao tác xoá người dùng (admin_delete_user, 0021) hay bị than chậm.
create index if not exists idx_assessment_terms_created_by on assessment_terms (created_by);


-- ── 0064 (2/3) Phiếu đánh giá của từng em ────────────────────────────────────
-- Bốn mức chữ đúng như trường đang dùng. Thông tư 22/2021 (THCS/THPT) gọi là Tốt/Khá/Đạt/Chưa đạt;
-- khi trường chuyển sang cách gọi đó chỉ cần `alter type conduct_rating add value 'dat'` — dữ liệu
-- cũ không phải chuyển đổi. Đó là lý do dùng enum chứ không phải bảng danh mục.
do $$ begin
  create type conduct_rating as enum ('tot','kha','trung_binh','yeu');
exception when duplicate_object then null; end $$;

create table if not exists student_term_reviews (
  id           uuid primary key default gen_random_uuid(),
  term_id      uuid not null references assessment_terms(id) on delete cascade,
  student_id   uuid not null references profiles(id) on delete cascade,
  -- Lớp TẠI THỜI ĐIỂM đánh giá — xem "lý do khoá". Đây cũng là cột mà toàn bộ RLS bám vào.
  class_id     uuid not null references classes(id) on delete cascade,

  -- (3) RÈN LUYỆN / HẠNH KIỂM. Hai cột vì hai trường làm hai kiểu: nơi xếp loại chữ, nơi chấm
  -- thang 100 ("điểm rèn luyện"). Cả hai đều để NULL được: trường nào không dùng thì bỏ trống,
  -- không phải bịa số.
  conduct       conduct_rating,
  conduct_score smallint,

  -- (2) NHẬN XÉT CỦA GVCN VỀ QUÁ TRÌNH HỌC — thứ phụ huynh xin.
  -- ⚠ ĐÂY LÀ Ô GỬI GIA ĐÌNH. Sau khi công bố, PHỤ HUYNH VÀ HỌC SINH ĐỀU ĐỌC ĐƯỢC nguyên văn.
  -- RLS của Postgres chặn theo DÒNG, không chặn theo CỘT — nên tuyệt đối đừng thêm một cột
  -- "ghi chú riêng của cô" vào bảng này; ai đọc được phiếu là đọc được cả cột đó.
  comment      text,

  -- CÔNG BỐ. NULL = bản nháp, chỉ nhân sự thấy. Có giá trị = đã gửi gia đình.
  -- Vì sao phải có: giáo viên nhập điểm trong nhiều ngày, gõ nhầm rồi sửa là bình thường. Không có
  -- cổng này thì phụ huynh nhìn thấy con số sai trong đúng khoảnh khắc nó còn sai, và cuộc gọi
  -- phàn nàn xảy ra trước khi cô kịp sửa.
  published_at timestamptz,

  created_by   uuid references profiles(id) on delete set null,
  updated_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (term_id, student_id),
  constraint str_conduct_score_check
    check (conduct_score is null or conduct_score between 0 and 100),
  -- Chặn ở DB chứ không tin form: nhận xét dài vô hạn là đường làm phình bảng và làm chậm mọi
  -- màn hình đọc danh sách lớp.
  constraint str_comment_len
    check (comment is null or length(comment) <= 2000)
);

comment on table student_term_reviews is
  'Một phiếu = một em trong một đợt. Cửa duy nhất để đọc điểm môn: điểm treo dưới phiếu này.';
comment on column student_term_reviews.published_at is
  'NULL = bản nháp (chỉ GVCN/BGH/admin thấy). Có giá trị = đã công bố cho phụ huynh và chính em đó.';
comment on column student_term_reviews.comment is
  'Nhận xét GỬI GIA ĐÌNH. Phụ huynh và học sinh đọc được sau khi công bố — không viết ghi chú nội bộ vào đây.';

-- ── Chốt an toàn tầng trigger (RLS lo được DÒNG nào, trigger lo được CỘT nào) ──
create or replace function review_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Khoá danh tính phiếu. Không có chốt này thì một lệnh UPDATE đổi student_id biến phiếu của
    -- em A thành phiếu của em B, mang theo nguyên bộ điểm — vừa sai dữ liệu vừa là đường lách
    -- quyền (WITH CHECK chỉ soi giá trị MỚI, không biết giá trị cũ là của ai).
    if new.student_id is distinct from old.student_id
       or new.class_id is distinct from old.class_id
       or new.term_id  is distinct from old.term_id then
      raise exception 'Không được đổi học sinh/lớp/đợt của phiếu đã tạo. Xoá phiếu rồi tạo lại.';
    end if;
  end if;

  -- Đợt phải CÙNG CƠ SỞ với lớp. Vì sao quan trọng: khoá sổ (is_locked) nằm ở đợt, nên nếu cho
  -- phép gắn phiếu vào đợt của cơ sở khác thì chỉ cần mượn một đợt chưa khoá của cơ sở bên kia
  -- là sửa được điểm sau khi cơ sở mình đã chốt sổ. Check constraint không làm được việc liên bảng
  -- nên phải là trigger.
  if not exists (
    select 1 from assessment_terms t join classes c on c.id = new.class_id
    where t.id = new.term_id and t.campus_id = c.campus_id
  ) then
    raise exception 'Đợt đánh giá không thuộc cơ sở của lớp';
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

drop trigger if exists trg_review_guard on student_term_reviews;
create trigger trg_review_guard before insert or update on student_term_reviews
  for each row execute function review_guard();

-- ── Vết kiểm toán cho đúng hai việc đáng ngờ nhất ────────────────────────────
-- DATA_GOVERNANCE §3 buộc ghi log khi truy cập/thay đổi báo cáo nhạy cảm. Điểm số nhạy cảm hơn
-- điểm danh: công bố rồi mới sửa là thao tác luôn cần giải thích được. Chỉ ghi id, không ghi nội
-- dung nhận xét — audit_log chỉ admin đọc nhưng vẫn không nên nhân bản dữ liệu trẻ em thêm chỗ nữa.
create or replace function audit_review_publish() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.published_at is distinct from old.published_at then
    perform log_audit(
      case when new.published_at is null then 'review_unpublish' else 'review_publish' end,
      jsonb_build_object('review_id', new.id, 'class_id', new.class_id,
                         'term_id', new.term_id, 'student_id', new.student_id));
  elsif old.published_at is not null then
    perform log_audit('review_edit_after_publish',
      jsonb_build_object('review_id', new.id, 'class_id', new.class_id));
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_review_publish on student_term_reviews;
create trigger trg_audit_review_publish after update on student_term_reviews
  for each row execute function audit_review_publish();

-- ── Mở đợt cho cả lớp trong một lượt ─────────────────────────────────────────
-- Vì sao cần RPC: điểm treo dưới phiếu, nên phải có phiếu trước mới nhập được điểm. Bắt frontend
-- tự tạo 30 phiếu là bắt nó tự kiểm quyền — chính là kiểu lỗ đã có ở 0011/0014. Hàm này kiểm
-- quyền một lần, ở một chỗ, rồi mới ghi.
create or replace function open_term_for_class(p_term uuid, p_class uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not (is_class_teacher(p_class) or auth_role() = 'admin') then
    raise exception 'Chỉ giáo viên chủ nhiệm của lớp này được mở đợt đánh giá';
  end if;
  if auth_role() <> 'admin' and term_is_locked(p_term) then
    raise exception 'Đợt đánh giá đã chốt sổ';
  end if;
  if not exists (
    select 1 from assessment_terms t join classes c on c.id = p_class
    where t.id = p_term and t.campus_id = c.campus_id
  ) then
    raise exception 'Đợt đánh giá không thuộc cơ sở của lớp';
  end if;

  insert into student_term_reviews (term_id, student_id, class_id, created_by, updated_by)
  select p_term, e.student_id, p_class, auth.uid(), auth.uid()
  from enrollments e
  where e.class_id = p_class and e.is_active
  on conflict (term_id, student_id) do nothing;   -- gọi lại nhiều lần vẫn an toàn

  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function open_term_for_class(uuid, uuid) from public, anon;
grant execute on function open_term_for_class(uuid, uuid) to authenticated;

drop trigger if exists trg_touch_student_term_reviews on student_term_reviews;
-- (updated_at đã do review_guard lo — không gắn thêm trigger để khỏi chạy hai lần.)

-- ── Hàm phụ cho policy (SECURITY DEFINER: phải bỏ RLS của bảng nó đọc, nếu không policy tự gọi
--    lại policy → đệ quy. Lối này giống hệt wig_class()/lead_class() ở 0004) ──

-- Đợt đã chốt sổ chưa. FAIL CLOSED: đợt không tồn tại thì coi như ĐÃ KHOÁ, để một term_id rác
-- không mở toang quyền ghi.
create or replace function term_is_locked(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select is_locked from assessment_terms where id = t), true);
$$;

-- Em có đang thực học lớp đó không. Dùng ở WITH CHECK để GVCN dạy hai lớp không lập nhầm phiếu
-- của em lớp này vào lớp kia.
create or replace function is_enrolled(s uuid, c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments where student_id = s and class_id = c and is_active
  );
$$;

revoke all on function term_is_locked(uuid) from public, anon;
revoke all on function is_enrolled(uuid, uuid) from public, anon;
grant execute on function term_is_locked(uuid) to authenticated;
grant execute on function is_enrolled(uuid, uuid) to authenticated;

alter table student_term_reviews enable row level security;

-- ── ĐỌC ─────────────────────────────────────────────────────────────────────
-- Ba nhánh, cố tình gộp vào MỘT policy select (khuôn của 0048: mỗi lệnh một policy) để người
-- review chỉ phải đọc một biểu thức là biết hết ai xem được gì.
--   1) staff_can_read_class = GVCN CHÍNH LỚP ĐÓ | hiệu trưởng CÙNG CƠ SỞ | admin.
--      Nhân sự đọc được cả bản nháp — họ là người đang nhập/đang theo dõi tiến độ nhập, giấu bản
--      nháp với chính họ thì không dùng được. Giáo viên lớp khác KHÔNG lọt vào nhánh này.
--   2) phụ huynh: CHỈ con mình (is_my_child) và CHỈ sau khi công bố.
--   3) học sinh: CHỈ dòng của chính em và CHỈ sau khi công bố. Không có nhánh nào theo class_id
--      cho học sinh — đó là chỗ đã làm rò dữ liệu ở att_student_select/wig_read trước đây.
create policy rls_select_student_term_reviews on student_term_reviews
  as permissive for select to authenticated
  using (
    staff_can_read_class(class_id)
    or (published_at is not null and is_my_child(student_id))
    or (published_at is not null and student_id = (select auth.uid()))
  );

-- ── GHI: GVCN lớp đó, khi đợt chưa chốt sổ ──────────────────────────────────
-- Cố ý KHÔNG dùng staff_can_manage_class ở đây dù nó = GVCN|admin: viết tách ra để nhìn thấy
-- ngay điều kiện `not term_is_locked` áp cho giáo viên nhưng KHÔNG áp cho admin (admin còn phải
-- sửa được sau khi chốt, đó là cả lý do có vai admin).
create policy rls_insert_student_term_reviews on student_term_reviews
  as permissive for insert to authenticated
  with check (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id)
        and not term_is_locked(term_id)
        and is_enrolled(student_id, class_id))
  );

create policy rls_update_student_term_reviews on student_term_reviews
  as permissive for update to authenticated
  using (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id) and not term_is_locked(term_id))
  )
  with check (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id)
        and not term_is_locked(term_id)
        and is_enrolled(student_id, class_id))
  );

-- XOÁ: thêm một điều kiện nữa — phiếu ĐÃ CÔNG BỐ thì không xoá thẳng được. Muốn xoá phải gỡ công
-- bố trước, mà gỡ công bố thì trigger audit ghi lại. Một nút gờ cố ý: xoá thứ gia đình đã nhìn
-- thấy là việc phải cố tình làm, không được lỡ tay.
create policy rls_delete_student_term_reviews on student_term_reviews
  as permissive for delete to authenticated
  using (
    (select auth_role()) = 'admin'::user_role
    or (is_class_teacher(class_id) and not term_is_locked(term_id) and published_at is null)
  );

grant select, insert, update, delete on student_term_reviews to authenticated;


-- ── 0064 (3/3) Con điểm ──────────────────────────────────────────────────────
-- Năm loại điểm phủ cả hai quy chế đang cùng tồn tại trong trường phổ thông VN: cách cũ
-- (miệng / 15 phút / 1 tiết / thi học kỳ) và Thông tư 22 (thường xuyên / giữa kỳ / cuối kỳ).
do $$ begin
  create type score_kind as enum ('mieng','15p','1tiet','giua_ky','cuoi_ky');
exception when duplicate_object then null; end $$;

-- HỆ SỐ MẶC ĐỊNH theo loại điểm. Để hàm riêng, immutable, thay vì rải số 1/2/3 trong frontend:
-- dự án đã có bài học "quy tắc thắng tuần tính ở 3 nơi" — hệ số nhân điểm mà lệch giữa màn hình
-- giáo viên và màn hình phụ huynh là loại lỗi phụ huynh phát hiện trước mình.
create or replace function default_score_weight(k score_kind) returns smallint
  language sql immutable as $$
  select (case k
            when 'mieng'   then 1
            when '15p'     then 1
            when '1tiet'   then 2
            when 'giua_ky' then 2
            when 'cuoi_ky' then 3
          end)::smallint;
$$;
grant execute on function default_score_weight(score_kind) to authenticated;

create table if not exists subject_scores (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references student_term_reviews(id) on delete cascade,

  -- Môn là TEXT, không phải FK tới bảng danh mục môn. Lý do y hệt timetable_slots.teacher_name ở
  -- 0044: dự án CHƯA CÓ bảng môn học, và thời khoá biểu (0029) vốn đã cho gõ tên môn tự do. Dựng
  -- danh mục môn ngay bây giờ nghĩa là thêm một màn quản trị chưa ai xin, cộng nguy cơ hai nguồn
  -- sự thật lệch nhau (môn trong TKB vs môn trong bảng điểm). Ép btrim để 'Toán ' và 'Toán' không
  -- thành hai môn; nâng lên FK bằng migration riêng khi trường thực sự cần.
  subject    text not null,

  kind       score_kind not null,
  ordinal    smallint not null default 1,

  -- numeric(4,2): thang 10 của VN, cho phép 8.75. Chặn 0..10 ngay ở DB — điểm 100 lọt vào là sai
  -- toàn bộ trung bình môn và phụ huynh nhìn thấy trước khi ai kịp phát hiện.
  score      numeric(4,2) not null,
  -- Cho phép ghi đè hệ số vì vài môn/vài trường chấm khác chuẩn; để trống thì trigger điền theo
  -- loại điểm.
  weight     smallint not null,
  taken_on   date,
  note       text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (review_id, subject, kind, ordinal),
  constraint subject_scores_subject_check
    check (subject = btrim(subject) and subject <> '' and length(subject) <= 60),
  constraint subject_scores_score_check   check (score >= 0 and score <= 10),
  constraint subject_scores_weight_check  check (weight between 1 and 5),
  constraint subject_scores_ordinal_check check (ordinal between 1 and 20),
  constraint subject_scores_note_len      check (note is null or length(note) <= 300)
);

comment on table subject_scores is
  'Một dòng = MỘT con điểm. Quyền đọc/ghi thừa hưởng hoàn toàn từ phiếu (review_id) — không có lối vào nào khác.';
comment on column subject_scores.weight is
  'Hệ số. Bỏ trống khi ghi thì trigger điền theo loại điểm (miệng/15p=1, 1 tiết/giữa kỳ=2, cuối kỳ=3).';

-- BEFORE trigger chạy TRƯỚC khi Postgres kiểm NOT NULL, nên client bỏ trống `weight` vẫn hợp lệ.
create or replace function fill_score_weight() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.weight is null then
    new.weight := default_score_weight(new.kind);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_fill_score_weight on subject_scores;
create trigger trg_fill_score_weight before insert or update on subject_scores
  for each row execute function fill_score_weight();

-- ── Trung bình môn, tính MỘT chỗ ─────────────────────────────────────────────
-- security_invoker = true: view chạy bằng quyền NGƯỜI GỌI nên tự thừa hưởng RLS của
-- subject_scores. Đây là điều kiện sống còn — một view SECURITY DEFINER ở đây sẽ mở toang bảng
-- điểm cho mọi người đăng nhập, đúng loại lỗ đã phải vá ở 0038.
create or replace view subject_term_summary_v with (security_invoker = true) as
select
  s.review_id,
  s.subject,
  count(*)                                                     as so_con_diem,
  round(sum(s.score * s.weight) / nullif(sum(s.weight), 0), 2) as diem_trung_binh
from subject_scores s
group by s.review_id, s.subject;

comment on view subject_term_summary_v is
  'Trung bình có hệ số của từng môn trong một phiếu. security_invoker → ai không đọc được điểm thì cũng không đọc được dòng tổng kết.';

grant select on subject_term_summary_v to authenticated;

-- ── Hàm phụ: mọi quyền của bảng điểm đều suy ra từ PHIẾU ────────────────────
create or replace function review_class(r uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select class_id from student_term_reviews where id = r;
$$;

-- Gia đình = phụ huynh của em, hoặc chính em. Gộp hai vai vào một hàm vì điều kiện của họ giống
-- hệt nhau: phải ĐÃ CÔNG BỐ và phải đúng em đó. Tách ra chỉ tạo thêm chỗ để quên `published_at`.
create or replace function review_visible_to_family(r uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_term_reviews v
    where v.id = r
      and v.published_at is not null
      and (is_my_child(v.student_id) or v.student_id = auth.uid())
  );
$$;

-- Sửa được điểm = là GVCN của lớp trong phiếu VÀ đợt chưa chốt sổ.
create or replace function review_is_editable(r uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from student_term_reviews v
    join assessment_terms t on t.id = v.term_id
    where v.id = r and not t.is_locked and is_class_teacher(v.class_id)
  );
$$;

revoke all on function review_class(uuid)              from public, anon;
revoke all on function review_visible_to_family(uuid)  from public, anon;
revoke all on function review_is_editable(uuid)        from public, anon;
grant execute on function review_class(uuid)             to authenticated;
grant execute on function review_visible_to_family(uuid) to authenticated;
grant execute on function review_is_editable(uuid)       to authenticated;

alter table subject_scores enable row level security;

-- ĐỌC: đúng hai nhánh, cả hai đều đi qua phiếu.
--   • nhân sự: GVCN lớp đó | hiệu trưởng cùng cơ sở | admin — thấy cả bản nháp (họ đang nhập).
--   • gia đình: chỉ sau công bố, chỉ đúng em đó.
-- KHÔNG có nhánh nào theo lớp cho học sinh: bạn cùng lớp không phải là lý do để xem điểm của nhau.
create policy rls_select_subject_scores on subject_scores
  as permissive for select to authenticated
  using (
    staff_can_read_class(review_class(review_id))
    or review_visible_to_family(review_id)
  );

create policy rls_all_subject_scores on subject_scores
  as permissive for all to authenticated
  using ((select auth_role()) = 'admin'::user_role)
  with check ((select auth_role()) = 'admin'::user_role);

create policy rls_insert_subject_scores on subject_scores
  as permissive for insert to authenticated
  with check (review_is_editable(review_id));

create policy rls_update_subject_scores on subject_scores
  as permissive for update to authenticated
  using (review_is_editable(review_id))
  with check (review_is_editable(review_id));

-- Xoá được con điểm nhập nhầm là nghiệp vụ thật (gõ 9 thành 90 rồi phải bỏ). Chốt an toàn nằm ở
-- `is_locked`: chốt sổ xong thì không ai xoá được nữa, kể cả GVCN.
create policy rls_delete_subject_scores on subject_scores
  as permissive for delete to authenticated
  using (review_is_editable(review_id));

grant select, insert, update, delete on subject_scores to authenticated;


-- Bộ kiểm chứng RLS trên chính DB thật, theo đúng mẹo đã ghi trong supabase/tests/rls_security.sql:
-- giả danh từng vai trong một transaction rồi rollback. Chỉ đếm số dòng, KHÔNG kéo email/tên
-- (dữ liệu trẻ em).
--
-- begin;
--   select set_config('request.jwt.claims',
--          json_build_object('sub','<uuid học sinh B>','role','authenticated')::text, true);
--   set local role authenticated;
--   -- PHẢI = 0: học sinh B không thấy phiếu của học sinh A
--   select count(*) from student_term_reviews where student_id <> '<uuid B>'::uuid;
--   -- PHẢI = 0: không thấy con điểm nào của bạn khác
--   select count(*) from subject_scores s
--     join student_term_reviews v on v.id = s.review_id where v.student_id <> '<uuid B>'::uuid;
--   -- PHẢI = 0: phiếu của chính mình nhưng CHƯA công bố
--   select count(*) from student_term_reviews
--     where student_id = '<uuid B>'::uuid and published_at is null;
-- rollback;
--
-- Lặp lại với: phụ huynh (chỉ ra đúng số con mình), giáo viên KHÔNG chủ nhiệm (phải = 0),
-- hiệu trưởng cơ sở khác (phải = 0), hiệu trưởng cùng cơ sở thử UPDATE một dòng điểm
-- (phải báo lỗi/0 dòng bị sửa).

-- Không có policy mới ở mục này.

-- FK review_id — cột nóng nhất: mọi màn hình đều là "lấy điểm của phiếu này".
create index if not exists idx_subject_scores_review on subject_scores (review_id);

-- FK created_by — cùng lý do với các bảng trên (xoá người dùng phải quét bảng con).
create index if not exists idx_subject_scores_created_by on subject_scores (created_by);

-- Bảng điểm cả lớp trong một đợt = truy vấn chính của giáo viên và của ban giám hiệu.
create index if not exists idx_str_term_class on student_term_reviews (term_id, class_id);

-- Phụ huynh/học sinh xem lại các đợt của một em → đi theo student_id. Cũng là chỉ mục FK.
create index if not exists idx_str_student on student_term_reviews (student_id);

-- FK class_id (RLS soi cột này ở MỌI dòng) và hai FK người dùng.
create index if not exists idx_str_class      on student_term_reviews (class_id);
create index if not exists idx_str_created_by on student_term_reviews (created_by);
create index if not exists idx_str_updated_by on student_term_reviews (updated_by);

-- Ghi chú: FK term_id đã được chỉ mục duy nhất (term_id, student_id) phủ ở cột đầu, không tạo
-- thêm — dự án đã từng phải gỡ chỉ mục trùng ở 0054, đừng lặp lại.
