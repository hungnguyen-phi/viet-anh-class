-- 0061 — Báo bài / bài tập về nhà (BTVN) theo NGÀY, đăng cho LỚP.
--
-- VÌ SAO LÀM TRƯỚC HAI CÁI KIA: đây là thứ duy nhất mà CẢ BA vai người thử đều tự nhắc đến —
-- giáo viên ("có phần báo bài trên App"), học sinh ("có mục xem báo bài (bài tập về nhà)"),
-- phụ huynh ("BTVN hoặc dặn dò kiểm tra"). Khi ba nhóm có lợi ích khác nhau cùng xin một thứ
-- thì đó là nhu cầu thật, không phải ý thích.
--
-- VÌ SAO KHÔNG TÁI DÙNG BẢNG CÓ SẴN:
--   • timetable_slots chỉ có TÊN MÔN theo (thứ, tiết) cố định cả học kỳ — không có chỗ chứa
--     "hôm nay về nhà làm gì", và nó không đổi theo NGÀY.
--   • notifications gửi cho MỘT user_id — muốn báo bài cho lớp 40 em + 40 phụ huynh phải sinh
--     80 hàng trùng nội dung, sửa một chữ là phải sửa 80 hàng, và không ai trả lời được câu
--     "BTVN thứ Ba tuần trước là gì".
-- Nội dung theo ngày của LỚP là một thực thể riêng, phải có bảng riêng.

set search_path = public;

-- Hàm chạm updated_at dùng chung cho cả 0061/0062/0063.
-- KHÔNG security definer: nó chỉ sửa biến NEW trong bộ nhớ, không đọc bảng nào, nên không cần
-- quyền vượt RLS. Vẫn ghim search_path để không dính cảnh báo function_search_path_mutable.
create or replace function touch_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Ba loại nội dung khác nhau ở HÀNH ĐỘNG mà người đọc phải làm, nên tách bằng enum:
--   assignment = có việc phải nộp   · reminder = chỉ cần nhớ   · exam = phải ôn
-- Dùng enum thay vì text + check để: (a) gõ sai loại thì DB chặn ngay chứ không âm thầm đẻ ra
-- loại thứ tư, (b) nhãn hiển thị tiếng Việt nằm ở i18n nên đổi chữ không phải chạy UPDATE dữ liệu.
-- Bọc do-block vì `create type` không có `if not exists`, mà migration có thể bị chạy lại tay.
do $$ begin
  create type homework_kind as enum ('assignment', 'reminder', 'exam');
exception when duplicate_object then null;
end $$;

create table if not exists homework_posts (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,

  -- Ngày BÁO bài (buổi học nào), KHÔNG phải hạn nộp.
  -- Mặc định là ngày giờ Việt Nam, KHÔNG dùng current_date: 0019 đã sửa đúng cái bẫy này —
  -- current_date chạy theo UTC nên trong khung 00:00–07:00 giờ VN nó trả về NGÀY HÔM TRƯỚC.
  -- Giáo viên soạn bài lúc 6h sáng sẽ thấy bài rơi vào hôm qua.
  date        date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,

  subject     text not null check (btrim(subject) <> ''),
  content     text not null check (btrim(content) <> ''),

  -- Hạn nộp ĐƯỢC PHÉP TRỐNG, cố ý: 'reminder' và 'exam' thường không có gì để nộp. Ép nhập hạn
  -- cho mọi dòng chỉ đẻ ra hạn giả, rồi màn "sắp đến hạn" đầy rác và không ai tin nó nữa.
  due_date    date,

  kind        homework_kind not null default 'assignment',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Hạn nộp trước cả ngày báo bài là dữ liệu sai. Chặn ở DB chứ không tin vào form: form có
  -- server action, có API trực tiếp, có cả người sửa tay bằng SQL — chỉ DB là chốt cuối.
  constraint homework_due_after_date check (due_date is null or due_date >= date)
);

comment on table homework_posts is
  'Báo bài / BTVN / dặn dò kiểm tra theo ngày, đăng cho một lớp. GVCN ghi; HS + PH của lớp đọc.';
comment on column homework_posts.date is
  'Ngày của BUỔI HỌC được báo bài, không phải hạn nộp. Mặc định theo giờ VN (xem 0019).';
comment on column homework_posts.due_date is
  'Hạn nộp, để trống với dặn dò/thông báo kiểm tra.';

drop trigger if exists trg_homework_posts_touch on homework_posts;
create trigger trg_homework_posts_touch before update on homework_posts
  for each row execute function touch_updated_at();


-- ── Bảng phụ: học sinh tự đánh dấu "đã làm" ────────────────────────────────
-- CÓ NÊN LÀM KHÔNG — trả lời thẳng: NÊN, nhưng phải gọi đúng tên nó là TỰ KHAI, không phải điểm.
--
-- Được gì: không có bảng này thì "báo bài" chỉ là bảng tin một chiều — đăng xong là hết, không
-- ai biết chuyện gì xảy ra tiếp. Có nó thì em mở app buổi tối thấy còn 2 việc chưa tick, và sáng
-- hôm sau GVCN biết ngay lớp có bao nhiêu em chưa đụng tới bài, trước khi vào tiết.
--
-- Mất gì: nếu đem tick này ra chấm điểm hoặc đọc tên trước lớp thì nó thành công cụ bêu học sinh,
-- và khi đó em sẽ tick bừa cho xong — dữ liệu chết, tính năng chết. Thiết kế dưới đây cố tình
-- KHÔNG cho ai ngoài chính em, GVCN của em và bố mẹ em nhìn thấy tick của em (xem phần policy).
create table if not exists homework_done (
  post_id    uuid not null references homework_posts(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (post_id, student_id)
);

comment on table homework_done is
  'Học sinh TỰ đánh dấu đã làm. Là lời tự khai để em tự theo dõi, KHÔNG phải điểm số, KHÔNG dùng để xếp hạng.';

-- Lấy lớp của một bài báo, để policy của bảng phụ không phải join thẳng vào homework_posts
-- (join thẳng sẽ bị RLS của homework_posts chặn lại → đệ quy policy). Đúng khuôn wig_class /
-- lead_class đã có ở 0004.
create or replace function homework_class(p uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select class_id from homework_posts where id = p;
$$;
revoke all on function homework_class(uuid) from public, anon;
grant execute on function homework_class(uuid) to authenticated;

-- ══ homework_posts ═════════════════════════════════════════════════════════
alter table homework_posts enable row level security;

-- ĐỌC: học sinh ĐANG học lớp đó (is_class_student đã lọc is_active — em chuyển lớp thì mất
-- quyền đọc lớp cũ ngay), phụ huynh có con trong lớp, và nhân sự đọc được lớp đó
-- (GVCN lớp đó | hiệu trưởng cùng cơ sở | admin).
drop policy if exists rls_select_homework_posts on homework_posts;
create policy rls_select_homework_posts on homework_posts for select
  using (
    is_class_student(class_id)
    or is_parent_of_class(class_id)
    or staff_can_read_class(class_id)
  );

-- GHI/SỬA/XOÁ: staff_can_manage_class = GVCN của CHÍNH lớp đó, hoặc admin.
-- HIỆU TRƯỞNG CỐ Ý KHÔNG CÓ QUYỀN GHI. Đề bài nói rõ "GVCN đăng cho LỚP", và người chịu trách
-- nhiệm về bài tập của lớp là GVCN. BGH cần đọc để giám sát thì đã có ở policy trên.
drop policy if exists rls_all_homework_posts on homework_posts;
create policy rls_all_homework_posts on homework_posts for all
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

-- LUẬT 1: thiếu GRANT thì PostgREST trả 42501 dù RLS đã đúng — 0015 và 0037 đều đã dính lỗi này.
grant select, insert, update, delete on homework_posts to authenticated;


-- ══ homework_done ══════════════════════════════════════════════════════════
alter table homework_done enable row level security;

-- Học sinh: CHỈ dòng của chính mình.
-- Chú ý điều kiện insert có thêm is_class_student(homework_class(post_id)): không có nó thì em
-- lớp 6A tick được bài của lớp 6B (em không đọc được bài đó, nhưng đoán ra uuid thì vẫn ghi
-- được — ghi và đọc là hai cửa khác nhau, phải khoá cả hai).
drop policy if exists rls_select_homework_done_self on homework_done;
create policy rls_select_homework_done_self on homework_done for select
  using (student_id = (select auth.uid()));

drop policy if exists rls_insert_homework_done_self on homework_done;
create policy rls_insert_homework_done_self on homework_done for insert
  with check (
    student_id = (select auth.uid())
    and is_class_student(homework_class(post_id))
  );

-- Bỏ tick = XOÁ hàng, nên phải có policy delete cho chính em.
drop policy if exists rls_delete_homework_done_self on homework_done;
create policy rls_delete_homework_done_self on homework_done for delete
  using (student_id = (select auth.uid()));

-- Phụ huynh: CHỈ con mình. is_my_child(student_id) chứ không phải is_parent_of_class —
-- khác biệt sống còn: is_parent_of_class sẽ cho bố mẹ em A xem tick của cả 40 em trong lớp.
drop policy if exists rls_select_homework_done_parent on homework_done;
create policy rls_select_homework_done_parent on homework_done for select
  using (is_my_child(student_id));

-- GVCN lớp đó + admin: xem toàn lớp, vì "ai chưa làm" chính là lý do tồn tại của bảng này.
-- HIỆU TRƯỞNG CỐ Ý BỊ LOẠI (dùng staff_can_manage_class, KHÔNG dùng staff_can_read_class).
-- Lý do: "em A chưa làm bài ngày 12/9" là bản ghi hành vi của từng đứa trẻ. BGH cần biết tỉ lệ
-- của lớp, không cần biết tên em nào. Đây đúng nguyên tắc tối thiểu hoá mà 0058 đã áp cho
-- student_details. Muốn cho BGH xem số liệu tổng thì viết một RPC trả về CON SỐ, đừng mở bảng.
drop policy if exists rls_select_homework_done_staff on homework_done;
create policy rls_select_homework_done_staff on homework_done for select
  using (staff_can_manage_class(homework_class(post_id)));

-- KHÔNG có policy UPDATE, cố ý: bảng chỉ có ba cột và done_at do DB tự đặt — không có gì để sửa.
-- Vẫn cấp GRANT đủ 4 lệnh theo luật của dự án; UPDATE sẽ bị RLS chặn sạch vì không policy nào
-- khớp. Ít động từ dùng được = ít cửa phải canh.
grant select, insert, update, delete on homework_done to authenticated;

-- homework_posts
-- Truy vấn duy nhất mà app thực sự chạy: "báo bài của LỚP tôi, mới nhất trước" và "lớp tôi,
-- trong khoảng ngày X..Y". Chỉ mục ghép (class_id, date desc) phục vụ cả hai, và vì class_id là
-- CỘT ĐẦU nên nó đồng thời là chỉ mục cho khoá ngoại class_id → không cần tạo thêm cái riêng.
create index if not exists idx_homework_posts_class_date on homework_posts (class_id, date desc);

-- Khoá ngoại thứ hai. Advisor của dự án đã cảnh báo thiếu index FK (0053) — không có nó thì mỗi
-- lần xoá một profile giáo viên, Postgres phải quét TOÀN BẢNG này để kiểm ràng buộc.
create index if not exists idx_homework_posts_created_by on homework_posts (created_by);

-- Chỉ mục TỪNG PHẦN cho màn "sắp đến hạn". Phần lớn dòng có due_date NULL (dặn dò, thông báo
-- kiểm tra) — đưa chúng vào index chỉ tốn chỗ ghi mà không bao giờ được đọc.
create index if not exists idx_homework_posts_due on homework_posts (due_date)
  where due_date is not null;

-- homework_done
-- post_id đã có chỉ mục nhờ là cột đầu của khoá chính (post_id, student_id) → truy vấn
-- "ai đã làm bài này" chạy bằng PK. Còn thiếu chiều ngược lại: khoá ngoại student_id, dùng cho
-- "em này đã làm những bài nào" và cho ràng buộc khi xoá học sinh.
create index if not exists idx_homework_done_student on homework_done (student_id);
