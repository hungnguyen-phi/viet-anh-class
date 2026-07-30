-- ============================================================
-- 0065 — TIN NHẮN PHỤ HUYNH ↔ GVCN — (1) CUỘC TRAO ĐỔI
-- ============================================================
-- Nguồn yêu cầu: ban giám hiệu — "Là PH tôi muốn phản hồi lại giáo viên trên app";
-- phiếu thử — "Phụ huynh chỉ xem, không nhắn lại được... Có cần thêm đường phản hồi không?" → CÓ.
set search_path = public;

create table if not exists parent_teacher_threads (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references profiles(id) on delete cascade,
  class_id         uuid not null references classes(id)  on delete cascade,
  opened_by        uuid references profiles(id) on delete set null,
  last_message_at  timestamptz,
  last_sender_side text check (last_sender_side in ('parent', 'school')),
  created_at       timestamptz not null default now(),
  unique (student_id, class_id)
);

comment on table parent_teacher_threads is
  'Mỗi (học sinh, lớp) đúng MỘT cuộc trao đổi giữa các phụ huynh của em và GVCN ĐƯƠNG NHIỆM của lớp.';

comment on column parent_teacher_threads.class_id is
  'Không lưu id giáo viên: phía nhà trường suy ra từ classes.homeroom_teacher_id lúc đọc. Bàn giao lớp giữa năm thì quyền chuyển ngay, không phải sửa một dòng dữ liệu nào.';

comment on column parent_teacher_threads.opened_by is
  'Ai bấm mở cuộc — để trả lời câu "phụ huynh chủ động hay giáo viên chủ động" khi tổng kết đợt thử. KHÔNG dùng để xét quyền: quyền luôn tính lại từ parent_links và homeroom_teacher_id.';

comment on column parent_teacher_threads.last_message_at is
  'Ghi sẵn để hộp thư sắp xếp và chấm đỏ không phải quét bảng tin nhắn. Do trigger SECURITY DEFINER ghi, người dùng không có policy UPDATE nên không sửa được.';

comment on column parent_teacher_threads.last_sender_side is
  'Bên nói sau cùng. ''parent'' nghĩa là NHÀ TRƯỜNG CHƯA TRẢ LỜI — đây đúng là chỉ số ban giám hiệu cần, và đọc được nó KHÔNG cần đọc nội dung.';

-- Hàm phụ: em đó có ĐANG học lớp đó không.
-- SECURITY DEFINER để biểu thức policy không phải đi qua RLS của enrollments (tránh đệ quy và
-- tránh việc policy im lặng trả false chỉ vì người gọi không được đọc dòng ghi danh).
-- Đây chính là chốt chặn "phụ huynh nhắn sang lớp khác".
create or replace function pt_student_in_class(s uuid, c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    where e.student_id = s and e.class_id = c and e.is_active
  );
$$;
revoke all on function pt_student_in_class(uuid, uuid) from public, anon;
grant execute on function pt_student_in_class(uuid, uuid) to authenticated;

alter table parent_teacher_threads enable row level security;

-- ĐỌC: chỉ phụ huynh của CHÍNH em đó, và GVCN đương nhiệm của lớp đó.
--
-- ⚠️ TUYỆT ĐỐI KHÔNG dùng is_parent_of_class(class_id) ở đây. Hàm đó đúng cho thời khoá biểu
--    (thông tin chung của cả lớp), nhưng dùng ở bảng này thì MỌI phụ huynh trong lớp đọc được
--    cuộc trao đổi riêng của MỌI gia đình khác — đúng loại lỗ rò dữ liệu trẻ em đã bị bắt trong
--    đợt audit trước. Điều kiện đúng là is_my_child(student_id), tức theo TỪNG ĐỨA TRẺ.
--
-- ⚠️ Cũng KHÔNG dùng staff_can_read_class(class_id): hàm đó kéo theo cả principal lẫn admin.
--    Xem phần "ai không được thấy" — mặc định an toàn là hai vai đó không đọc nội dung.
drop policy if exists rls_select_parent_teacher_threads on parent_teacher_threads;
create policy rls_select_parent_teacher_threads on parent_teacher_threads
  as permissive for select to public
  using (is_my_child(student_id) or is_class_teacher(class_id));

-- TẠO: cả hai bên đều mở được cuộc, nhưng phải là cuộc HỢP LỆ:
--   (1) em phải ĐANG học lớp đó → chặn phụ huynh dựng cuộc trỏ vào một lớp lạ rồi nhắn vào đó
--   (2) người tạo phải là phụ huynh của chính em, hoặc GVCN của chính lớp
--   (3) opened_by phải là chính mình → không dựng cuộc rồi đổ cho người khác đã mở
drop policy if exists rls_insert_parent_teacher_threads on parent_teacher_threads;
create policy rls_insert_parent_teacher_threads on parent_teacher_threads
  as permissive for insert to public
  with check (
    pt_student_in_class(student_id, class_id)
    and (is_my_child(student_id) or is_class_teacher(class_id))
    and opened_by = (select auth.uid())
  );

-- KHÔNG có policy UPDATE và KHÔNG có policy DELETE — cố ý.
--   • last_message_at / last_sender_side do trigger SECURITY DEFINER ghi, người dùng không cần quyền.
--   • Không ai đổi được class_id/student_id của một cuộc đã có. Đổi được nghĩa là kéo NGUYÊN CẢ
--     LỊCH SỬ hội thoại của một gia đình sang lớp khác cho người khác đọc.
--   • Không ai xoá được cuộc để phi tang sau khi nói điều không nên nói.

-- Luật dự án: thiếu GRANT thì PostgREST trả 42501 dù RLS đúng (đã dính lỗi này ở 0015).
-- Cấp đủ 4 quyền cho đúng luật, nhưng UPDATE/DELETE vẫn bất khả thi vì KHÔNG có policy nào cho
-- phép — với RLS đang bật, không policy = không dòng nào lọt, PostgREST trả 0 dòng chứ không lỗi.
grant select, insert, update, delete on parent_teacher_threads to authenticated;

-- unique (student_id, class_id) đã tạo sẵn một index; student_id đứng đầu nên nó phủ luôn
-- khoá ngoại student_id VÀ truy vấn thường gặp nhất của phụ huynh: "các cuộc về con tôi".

-- Phủ khoá ngoại class_id, đồng thời đúng thứ tự hộp thư của GVCN (mới nhất lên đầu) nên
-- màn hình "Tin nhắn" của giáo viên đọc thẳng từ index, không sort lại.
-- nulls last: cuộc vừa mở chưa có tin nào thì xuống cuối, không chen lên đầu danh sách.
create index if not exists idx_pt_threads_class_recent
  on parent_teacher_threads (class_id, last_message_at desc nulls last);

-- Khoá ngoại nào cũng phải có index (advisor của dự án đã cảnh báo thiếu index FK).
-- Cột này còn dùng khi xoá tài khoản: tìm nhanh các dòng cần set null.
create index if not exists idx_pt_threads_opened_by
  on parent_teacher_threads (opened_by);

-- Lọc "lớp nào phụ huynh nhắn mà trường chưa trả lời" chỉ chạm một phần nhỏ dữ liệu,
-- nên dùng index bộ phận thay vì index đầy đủ.
create index if not exists idx_pt_threads_waiting
  on parent_teacher_threads (class_id, last_message_at)
  where last_sender_side = 'parent';


-- ============================================================
-- 0065 — (2) TIN NHẮN
-- ============================================================
create table if not exists parent_teacher_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references parent_teacher_threads(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete set null,
  sender_role user_role not null,
  sender_side text not null check (sender_side in ('parent', 'school')),
  body        text not null check (length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

comment on table parent_teacher_messages is
  'Sổ ghi chỉ-thêm. Không có policy UPDATE/DELETE cho bất kỳ ai: đã nói ra thì không sửa lại được, vì đây là bản ghi có thể phải mở ra khi có khiếu nại.';

comment on column parent_teacher_messages.sender_id is
  'Người viết thật. Cho phép NULL (on delete set null) vì xoá tài khoản KHÔNG được kéo theo việc xoá lịch sử trao đổi về một đứa trẻ. Trigger ép giá trị này = auth.uid(), client gửi gì cũng bị bỏ.';

comment on column parent_teacher_messages.sender_role is
  'Chụp lại vai trò tại thời điểm gửi. Người ta đổi vai (GVCN lên ban giám hiệu) thì lịch sử vẫn đọc đúng bối cảnh cũ. Đây là dữ liệu HIỂN THỊ, không phải đầu vào xét quyền.';

comment on column parent_teacher_messages.sender_side is
  'Phía gửi, để giao diện vẽ bong bóng trái/phải. Trigger tự đặt bằng is_my_child(), không suy từ sender_role — vì hiệu trưởng kiêm GVCN có role=principal nhưng phía vẫn là nhà trường.';

comment on column parent_teacher_messages.body is
  'Trần 2000 ký tự: đủ cho một phản hồi tử tế, chặn kiểu dán nguyên tài liệu vào ô chat. btrim() để tin toàn dấu cách không lọt qua.';

-- Ai được ĐỌC một cuộc: đúng bằng điều kiện của bảng cuộc trao đổi, gói lại thành một lượt tra
-- cứu. SECURITY DEFINER nên biểu thức policy của bảng tin nhắn không phải chui qua RLS của bảng
-- cuộc trao đổi — cùng khuôn với wig_class()/lead_class() đã có trong dự án.
create or replace function pt_can_read_thread(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from parent_teacher_threads th
    where th.id = t
      and (is_my_child(th.student_id) or is_class_teacher(th.class_id))
  );
$$;
revoke all on function pt_can_read_thread(uuid) from public, anon;
grant execute on function pt_can_read_thread(uuid) to authenticated;

-- Ai được GỬI: hẹp hơn đọc MỘT bậc — phải đọc được VÀ em đó còn đang học lớp đó.
--
-- VÌ SAO TÁCH RA: khi em chuyển lớp (hoặc nghỉ), hai bên vẫn cần xem lại chuyện đã nói —
-- nên quyền ĐỌC giữ nguyên, không xoá lịch sử. Nhưng giáo viên lớp cũ thì KHÔNG còn lý do gì
-- để nhắn tiếp cho gia đình đó, và gia đình cũng không nên nhắn tiếp cho người không còn phụ
-- trách con mình. Cuộc trao đổi tự "đóng băng" đúng lúc, không cần ai bấm nút đóng, không cần
-- cron dọn dẹp.
create or replace function pt_can_write_thread(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from parent_teacher_threads th
      join enrollments e on e.student_id = th.student_id
                        and e.class_id  = th.class_id
                        and e.is_active
     where th.id = t
       and (is_my_child(th.student_id) or is_class_teacher(th.class_id))
  );
$$;
revoke all on function pt_can_write_thread(uuid) from public, anon;
grant execute on function pt_can_write_thread(uuid) to authenticated;

alter table parent_teacher_messages enable row level security;

-- ĐỌC: chỉ hai bên của đúng cuộc đó.
-- Phụ huynh lớp bên cạnh, phụ huynh cùng lớp nhưng khác con, học sinh, lớp trưởng điểm danh,
-- giáo viên bộ môn, hiệu trưởng, admin — tất cả đều rơi ra ở đây.
drop policy if exists rls_select_parent_teacher_messages on parent_teacher_messages;
create policy rls_select_parent_teacher_messages on parent_teacher_messages
  as permissive for select to public
  using (pt_can_read_thread(thread_id));

-- GỬI: phải là bên trong cuộc, cuộc còn hiệu lực, và tin phải mang tên CHÍNH MÌNH.
-- sender_id do trigger BEFORE INSERT ép về auth.uid() rồi, điều kiện dưới đây là lớp chốt thứ hai:
-- nếu ai đó lỡ tay xoá trigger trong tương lai thì RLS vẫn chặn mạo danh.
-- (Thứ tự Postgres: BEFORE ROW trigger chạy trước, WITH CHECK xét trên dòng SAU khi trigger sửa.)
drop policy if exists rls_insert_parent_teacher_messages on parent_teacher_messages;
create policy rls_insert_parent_teacher_messages on parent_teacher_messages
  as permissive for insert to public
  with check (
    pt_can_write_thread(thread_id)
    and sender_id = (select auth.uid())
  );

-- KHÔNG policy UPDATE, KHÔNG policy DELETE — không sửa, không rút lại lời đã nói (xem lý do khoá).
-- Cần gỡ nội dung vi phạm thì đi đường service_role phía máy chủ và ghi audit_log, không mở cho app.

grant select, insert, update, delete on parent_teacher_messages to authenticated;
-- ↑ Đủ 4 quyền theo luật dự án. UPDATE/DELETE vẫn vô hiệu vì không có policy tương ứng.
grant select on parent_teacher_messages to service_role;   -- cho đường mở niêm phong có kiểm toán

-- Phủ khoá ngoại thread_id VÀ đúng thứ tự đọc hội thoại (cũ → mới).
-- Truy vấn nóng nhất của tính năng này chạy thẳng trên đây, không sort thêm.
create index if not exists idx_pt_messages_thread
  on parent_teacher_messages (thread_id, created_at);

-- Phủ khoá ngoại sender_id (yêu cầu bắt buộc của dự án), và là index mà trigger chống spam
-- dùng để đếm số tin của một người trong 24 giờ.
create index if not exists idx_pt_messages_sender
  on parent_teacher_messages (sender_id, created_at desc);

-- Đếm chưa đọc: "tin trong cuộc này, không phải của tôi, sau mốc tôi đã đọc" — index ở trên
-- (thread_id, created_at) đã phục vụ đúng dạng truy vấn đó, không cần thêm index riêng.
-- Cố tình KHÔNG đánh index toàn văn trên body: không có nhu cầu tìm kiếm nội dung riêng tư,
-- và mỗi index thêm là thêm một bản sao dữ liệu nhạy cảm nằm trên đĩa.


-- ============================================================
-- 0065 — (3) MỐC ĐÃ ĐỌC (để hiện chấm đỏ)
-- ============================================================
create table if not exists parent_teacher_reads (
  thread_id    uuid not null references parent_teacher_threads(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

comment on table parent_teacher_reads is
  'Cột mốc "tôi đã đọc tới đâu" cho từng người trong từng cuộc. Chưa đọc = có tin của người khác tạo sau mốc này. Một dòng cho mỗi (cuộc, người), không phải mỗi (tin, người).';

comment on column parent_teacher_reads.last_read_at is
  'Chỉ tiến, không lùi về quá khứ được qua RPC pt_mark_read(). Cho phép lệch tối đa 5 phút so với giờ máy chủ để chịu được đồng hồ máy khách chạy sai.';

alter table parent_teacher_reads enable row level security;

-- Một policy ALL là đủ vì luật ở đây chỉ có một câu: MỖI NGƯỜI CHỈ ĐỤNG ĐƯỢC MỐC CỦA CHÍNH MÌNH,
-- và chỉ trong cuộc mà mình vốn đã đọc được.
--
-- Vì sao phải chặn user_id: nếu để hở, một phụ huynh có thể ghi mốc "đã đọc" hộ GVCN để xoá chấm
-- đỏ bên kia (khiến giáo viên không thấy tin), hoặc lùi mốc của người khác để làm phiền. Nhỏ
-- nhưng là lỗ thao túng thật.
--
-- Vì sao vẫn phải gọi pt_can_read_thread: không cho ai rải mốc đọc lên những cuộc họ không thuộc
-- về. Bảng này tuy không chứa nội dung, nhưng chỉ cần chèn được dòng là đã DÒ ĐƯỢC id cuộc nào
-- có thật — rò rỉ siêu dữ liệu, vẫn là rò rỉ.
drop policy if exists rls_all_parent_teacher_reads on parent_teacher_reads;
create policy rls_all_parent_teacher_reads on parent_teacher_reads
  as permissive for all to public
  using (
    user_id = (select auth.uid())
    and pt_can_read_thread(thread_id)
  )
  with check (
    user_id = (select auth.uid())
    and pt_can_read_thread(thread_id)
    -- Chặn đặt mốc ở tương lai xa để giấu vĩnh viễn mọi tin sắp tới của mình.
    and last_read_at <= now() + interval '5 minutes'
  );

grant select, insert, update, delete on parent_teacher_reads to authenticated;
-- Ở bảng này cả 4 quyền đều dùng thật: upsert mốc đọc cần insert lẫn update,
-- delete để dọn khi người dùng rời cuộc.

-- PK (thread_id, user_id) đã phủ khoá ngoại thread_id và tra cứu chính.

-- Phủ khoá ngoại user_id (bắt buộc theo luật dự án) và phục vụ truy vấn mở app:
-- "lấy hết mốc đọc của tôi" để dựng chấm đỏ trên toàn bộ hộp thư trong một lượt,
-- thay vì hỏi từng cuộc một (N+1).
create index if not exists idx_pt_reads_user
  on parent_teacher_reads (user_id);


-- ============================================================
-- 0065 — (4) TRIGGER, RPC, REALTIME
-- ============================================================

-- ── Ép danh tính người gửi + chống nhắn dồn ────────────────────────────────
create or replace function pt_stamp_message() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_recent  int;
begin
  select th.student_id into v_student
    from parent_teacher_threads th where th.id = new.thread_id;
  if v_student is null then
    raise exception 'Cuộc trao đổi không tồn tại';
  end if;

  -- Bốn cột này KHÔNG lấy từ client, kể cả khi client cố gửi lên.
  -- auth.uid() vẫn là người gọi thật dù hàm là SECURITY DEFINER: nó đọc claim của JWT,
  -- không đọc vai trò kết nối.
  new.sender_id   := auth.uid();
  new.sender_role := coalesce(auth_role(), 'pending');
  new.sender_side := case when is_my_child(v_student) then 'parent' else 'school' end;
  new.created_at  := now();

  select count(*) into v_recent
    from parent_teacher_messages m
   where m.thread_id = new.thread_id
     and m.sender_id = new.sender_id
     and m.created_at > now() - interval '24 hours';
  if v_recent >= 30 then
    raise exception 'Bạn đã gửi quá nhiều tin trong 24 giờ ở cuộc trao đổi này. Vui lòng chờ phản hồi.';
  end if;

  return new;
end $$;

drop trigger if exists trg_pt_stamp_message on parent_teacher_messages;
create trigger trg_pt_stamp_message before insert on parent_teacher_messages
  for each row execute function pt_stamp_message();

-- ── Cập nhật cuộc + gọi chuông cho bên KIA ─────────────────────────────────
-- Quan trọng: body của thông báo để NULL. KHÔNG chép nội dung riêng tư sang bảng notifications
-- (0029 từng chép left(...,200) cho biên bản họp — ở đây không lặp lại). Chuông chỉ nói "có tin
-- mới", muốn đọc thì bấm vào và đi qua RLS của bảng tin nhắn.
--
-- Người nhận là GVCN ĐƯƠNG NHIỆM tra tại thời điểm gửi, không phải người từng dạy lớp đó.
create or replace function pt_after_message() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_student uuid; v_class uuid; v_teacher uuid; v_child text;
begin
  select th.student_id, th.class_id into v_student, v_class
    from parent_teacher_threads th where th.id = new.thread_id;

  update parent_teacher_threads
     set last_message_at  = new.created_at,
         last_sender_side = new.sender_side
   where id = new.thread_id;

  select coalesce(nullif(btrim(p.full_name), ''), 'học sinh') into v_child
    from profiles p where p.id = v_student;

  if new.sender_side = 'parent' then
    select c.homeroom_teacher_id into v_teacher from classes c where c.id = v_class;
    if v_teacher is not null then          -- lớp đang khuyết GVCN thì không gửi cho ai
      insert into notifications (user_id, title, body, link)
      values (v_teacher, 'Phụ huynh em ' || v_child || ' vừa nhắn', null,
              '/messages?t=' || new.thread_id);
    end if;
  else
    insert into notifications (user_id, title, body, link)
    select pl.parent_id, 'Giáo viên chủ nhiệm vừa nhắn về em ' || v_child, null,
           '/messages?t=' || new.thread_id
      from parent_links pl
     where pl.student_id = v_student
       and pl.parent_id is distinct from new.sender_id;
  end if;

  return null;
end $$;

drop trigger if exists trg_pt_after_message on parent_teacher_messages;
create trigger trg_pt_after_message after insert on parent_teacher_messages
  for each row execute function pt_after_message();

-- ── Mở cuộc: server tự tra lớp, client không truyền class_id ───────────────
-- SECURITY INVOKER cố ý: câu select đi qua RLS của enrollments (phụ huynh chỉ thấy ghi danh của
-- con mình, GVCN chỉ thấy lớp mình), và câu insert vẫn phải qua WITH CHECK của bảng cuộc.
-- Hai tầng độc lập cùng nói một điều — sai một tầng vẫn chưa rò.
create or replace function pt_open_thread(p_student uuid) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare v_class uuid; v_id uuid;
begin
  select e.class_id into v_class
    from enrollments e
    join classes c on c.id = e.class_id
   where e.student_id = p_student and e.is_active and c.is_active
   order by c.school_year desc
   limit 1;

  if v_class is null then
    raise exception 'Em này chưa thuộc lớp nào đang hoạt động';
  end if;

  insert into parent_teacher_threads (student_id, class_id, opened_by)
  values (p_student, v_class, auth.uid())
  on conflict (student_id, class_id) do nothing;

  select id into v_id from parent_teacher_threads
   where student_id = p_student and class_id = v_class;
  return v_id;
end $$;

-- ── Đánh dấu đã đọc: giờ do máy chủ đặt, máy khách không gửi mốc lên ───────
create or replace function pt_mark_read(p_thread uuid) returns void
  language sql security invoker set search_path = public as $$
  insert into parent_teacher_reads (thread_id, user_id, last_read_at)
  values (p_thread, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
$$;

-- ── Hộp thư của tôi + số chưa đọc, một lượt truy vấn ───────────────────────
-- SECURITY INVOKER → RLS của cả 4 bảng vẫn có hiệu lực; hàm này chỉ gom truy vấn cho gọn,
-- KHÔNG cấp thêm quyền cho ai. Phụ huynh gọi thì ra các cuộc về con mình; GVCN gọi thì ra
-- các cuộc của lớp mình. Cùng một hàm, hai kết quả khác nhau, do RLS quyết định.
create or replace function pt_my_threads()
returns table(
  thread_id uuid, student_id uuid, student_name text,
  class_id uuid, class_name text,
  last_message_at timestamptz, last_sender_side text,
  unread_count bigint, waiting_for_school boolean
)
language sql stable security invoker set search_path = public as $$
  select t.id, t.student_id, p.full_name, t.class_id, c.name,
         t.last_message_at, t.last_sender_side,
         (select count(*) from parent_teacher_messages m
           where m.thread_id = t.id
             and m.sender_id is distinct from (select auth.uid())
             and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
         t.last_sender_side = 'parent'
    from parent_teacher_threads t
    join classes  c on c.id = t.class_id
    join profiles p on p.id = t.student_id
    left join parent_teacher_reads r
           on r.thread_id = t.id and r.user_id = (select auth.uid())
   order by t.last_message_at desc nulls last;
$$;

-- ── Cho ban giám hiệu: SỨC KHOẺ kênh liên lạc, KHÔNG phải nội dung ─────────
-- Đây là câu trả lời cho "admin/hiệu trưởng có nên đọc không": họ nhận SỐ, không nhận CHỮ.
-- Trả về mỗi lớp một dòng: có bao nhiêu cuộc, bao nhiêu cuộc phụ huynh đang chờ trả lời, và
-- cuộc chờ lâu nhất là bao nhiêu giờ. Đủ để BGH đôn đốc giáo viên trả lời phụ huynh — vốn là
-- mối quan tâm thật của họ — mà không đọc một câu nào của gia đình nào.
-- Không có tên học sinh, không có tên phụ huynh, không có nội dung.
create or replace function pt_class_message_health()
returns table(class_id uuid, class_name text, thread_count bigint,
              waiting_count bigint, oldest_waiting_hours numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
         count(t.id),
         count(t.id) filter (where t.last_sender_side = 'parent'),
         round(extract(epoch from (now() - min(t.last_message_at)
                 filter (where t.last_sender_side = 'parent'))) / 3600.0, 1)
    from classes c
    left join parent_teacher_threads t on t.class_id = c.id
   where c.school_year = current_school_year()
     and c.is_active
     and (auth_role() = 'admin'
          or (auth_role() = 'principal' and c.campus_id = auth_campus()))
   group by c.id, c.name
   order by 5 desc nulls last, c.name;
$$;

-- ── Mở niêm phong: đường DUY NHẤT để người ngoài cuộc đọc nội dung ─────────
-- Không cấp cho authenticated → không bấm được từ trong app. Chỉ máy chủ (service_role) gọi,
-- sau khi đã xác thực người thao tác bằng getUser() và ghi rõ lý do. Mỗi lần gọi là một dòng
-- audit_log, không có cách đọc mà không để lại dấu.
-- p_actor truyền tường minh vì kết nối service_role không mang JWT nên auth.uid() sẽ là NULL —
-- không có người chịu trách nhiệm thì bản ghi kiểm toán vô nghĩa.
create or replace function pt_disclose_thread(p_thread uuid, p_actor uuid, p_reason text)
returns table(created_at timestamptz, sender_side text, sender_name text, body text)
language plpgsql security definer set search_path = public as $$
begin
  if p_actor is null or length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Mở niêm phong phải có người chịu trách nhiệm và lý do cụ thể (>= 20 ký tự)';
  end if;

  insert into audit_log (actor_id, action, detail)
  values (p_actor, 'pt_disclose_thread',
          jsonb_build_object('thread_id', p_thread, 'reason', btrim(p_reason)));

  return query
    select m.created_at, m.sender_side,
           coalesce(p.full_name, '(tài khoản đã xoá)'), m.body
      from parent_teacher_messages m
      left join profiles p on p.id = m.sender_id
     where m.thread_id = p_thread
     order by m.created_at;
end $$;

-- ── Realtime: tin mới hiện ngay, không phải bấm tải lại ────────────────────
-- Realtime của Supabase áp RLS cho kênh authenticated, nên chỉ hai bên của cuộc nhận được
-- sự kiện. Không thêm bảng cuộc/mốc đọc vào publication: hộp thư tải lại khi có sự kiện tin
-- nhắn là đủ, thêm bảng chỉ là thêm mặt phẳng để rò siêu dữ liệu.
alter publication supabase_realtime add table parent_teacher_messages;

-- Phần này không có bảng nên không có policy. Chỉ có quyền THỰC THI hàm — và ở đây
-- "ai gọi được hàm nào" chính là chỗ đặt ranh giới quyền, nên phải đọc kỹ như đọc policy.

revoke all on function pt_open_thread(uuid)   from public, anon;
revoke all on function pt_mark_read(uuid)     from public, anon;
revoke all on function pt_my_threads()        from public, anon;
grant execute on function pt_open_thread(uuid) to authenticated;
grant execute on function pt_mark_read(uuid)   to authenticated;
grant execute on function pt_my_threads()      to authenticated;
-- ↑ Ba hàm trên đều SECURITY INVOKER: cấp cho mọi người đăng nhập vẫn an toàn, vì RLS lọc
--   kết quả theo từng người. Học sinh gọi pt_my_threads() sẽ nhận về 0 dòng.

-- Hàm tổng hợp cho BGH là SECURITY DEFINER (bỏ qua RLS) nên tự kiểm quyền BÊN TRONG bằng
-- auth_role()/auth_campus() — giáo viên hay phụ huynh gọi cũng chỉ nhận 0 dòng.
revoke all on function pt_class_message_health() from public, anon;
grant execute on function pt_class_message_health() to authenticated;

-- Mở niêm phong: KHÔNG cấp cho authenticated. Trong app không có nút nào gọi được hàm này.
revoke all on function pt_disclose_thread(uuid, uuid, text) from public, anon, authenticated;
grant execute on function pt_disclose_thread(uuid, uuid, text) to service_role;

-- Hai hàm trigger không cần grant: trigger chạy dưới quyền chủ sở hữu hàm, không qua GRANT.
-- Nhưng vẫn khoá lại để không ai gọi trực tiếp qua PostgREST.
revoke all on function pt_stamp_message()  from public, anon, authenticated;
revoke all on function pt_after_message()  from public, anon, authenticated;

-- Không tạo bảng nên không có index mới. Ba lưu ý về hiệu năng của phần này:
--
-- 1) pt_can_read_thread(thread_id) và pt_can_write_thread(thread_id) NHẬN CỘT của dòng đang xét
--    nên KHÔNG bọc được vào (select ...) để thành InitPlan như 0048 đã làm với auth_role().
--    Chúng buộc phải chạy từng dòng — giống hệt wig_class(wig_id) hiện có. Chấp nhận được vì
--    idx_pt_messages_thread đã thu tập dòng về đúng một cuộc trước khi policy chạy.
--    Ngược lại auth.uid() trong policy ĐÃ được bọc (select auth.uid()) theo đúng khuôn 0048.
--
-- 2) Trigger chống spam đếm trên idx_pt_messages_sender (sender_id, created_at desc), đã có.
--
-- 3) pt_class_message_health() quét theo classes rồi left join — bám idx_pt_threads_class_recent.
--    Hàm này chạy khi BGH mở trang, không nằm trên đường nóng.
