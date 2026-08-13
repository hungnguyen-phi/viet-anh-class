-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0111 — HỌC SINH TỰ ĐIỀN BIÊN BẢN CỦA MÌNH TRONG PHÒNG HỌP, VÀ VÀI CHỖ NÓI SAI
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Bốn việc, cùng sinh ra từ buổi chạy thử họp WIG thật trên lớp Test ngày 13/08/2026:
--
--   ① TÊN HIỆN TRÊN MÀN HÌNH có một luật duy nhất. Trước đây em chưa có `full_name` hiện ba kiểu
--      khác nhau trong cùng một buổi họp: "—" ở khối Từng em, NGUYÊN EMAIL ở bảng số liệu ngay
--      phía trên, và UUID ở vài chỗ khác. Buổi họp chiếu lên máy chiếu, nên bày nguyên địa chỉ
--      thư của một đứa trẻ cho cả lớp nhìn là chuyện phải bỏ.
--
--   ② HỌC SINH TỰ ĐIỀN Ô CỦA MÌNH. Ba mươi em × hai ô, một mình GVCN gõ hết trong lúc vừa chủ trì
--      buổi họp — đó là lý do khối "Từng em" hay bị bỏ trống. Nay mỗi em điền ô của chính mình,
--      NGAY TRONG PHÒNG HỌP và chỉ ở đó. Không phải chỗ nào khác: biên bản là thứ của buổi họp.
--
--   ③ THÔNG BÁO KHÔNG ĐƯỢC NÓI DỐI. Trigger cũ bắn "Có biên bản họp WIG tuần X" cho MỌI dòng mới
--      trong wig_meetings — kể cả dòng mà Buddy AI tạo ra chỉ để giữ một câu nhắn. Em nhận một
--      thông báo tên là "biên bản họp WIG" với ruột rỗng, bấm vào không có gì. Nay phân biệt rõ
--      lời nhắn của Buddy với biên bản thật, và không báo cho em về chính chữ em vừa tự gõ.
--
--   ④ REALTIME cho phòng họp: cô nhìn thấy chữ của em hiện ra trong lúc em đang gõ.

-- ── ① MỘT LUẬT TÊN, DÙNG CHUNG ─────────────────────────────────────────────────────────────
-- Có tên thì dùng tên; không thì lấy phần TRƯỚC @ của email (đủ nhận ra em nào mà không bày cái
-- địa chỉ); không có gì cả thì nói thẳng là hồ sơ còn thiếu. Không bao giờ rơi về UUID.
-- Bản TypeScript đứng cạnh: lib/ten-hien-thi.ts — hai bên phải cùng một luật.
create or replace function ten_hien_thi(p_full_name text, p_email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(coalesce(p_full_name, '')), ''),
    nullif(btrim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'Chưa có tên'
  );
$$;

-- class_tick_matrix chỉ đổi đúng dòng `sname`. Phần còn lại chép nguyên từ 0073 — đã đối chiếu
-- với pg_proc trên production trước khi viết lại (luật của dự án: đọc hàm đang chạy, đừng tin
-- mỗi file migration).
create or replace function class_tick_matrix(p_class uuid, p_week_start date default null)
returns table(
  student_id uuid,
  student_name text,
  lead_measure_id uuid,
  lead_title text,
  active_weekdays smallint[],
  wig_id uuid,
  wig_title text,
  area text,
  ticked_dates date[]
)
language sql stable security definer set search_path = public as $$
  with wk as (select coalesce(p_week_start, vn_week_start()) as monday),
  studs as (
    select e.student_id as sid, ten_hien_thi(p.full_name, p.email) as sname
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.class_id = p_class and e.is_active
  ),
  lms as (
    select lm.id, lm.title, lm.active_weekdays, lm.wig_id,
           w.title as wig_title, w.area::text as area
    from lead_measures lm
    join wigs w on w.id = lm.wig_id
    where w.class_id = p_class
      and w.scope = 'class'
      and w.period = 'week'
      and w.start_date <= (select monday from wk) + 6
      and w.end_date   >= (select monday from wk)
  )
  select
    s.sid, s.sname, l.id, l.title, l.active_weekdays, l.wig_id, l.wig_title, l.area,
    coalesce(
      array_agg(lp.logged_date order by lp.logged_date) filter (where lp.id is not null),
      '{}'::date[]
    )
  from studs s
  cross join lms l
  left join lead_progress lp
         on lp.lead_measure_id = l.id
        and lp.student_id = s.sid
        and lp.logged_date between (select monday from wk) and (select monday from wk) + 6
  where staff_can_read_class(p_class)
  group by s.sid, s.sname, l.id, l.title, l.active_weekdays, l.wig_id, l.wig_title, l.area
  order by s.sname, l.title;
$$;

-- ── ② HỌC SINH TỰ ĐIỀN ────────────────────────────────────────────────────────────────────
-- Dấu thời gian của phím cuối cùng em gõ. Dùng cho đúng một việc: cô thấy "… đang điền" bên
-- cạnh tên em. Không phải cột kiểm toán, không giữ lịch sử.
alter table wig_meetings add column if not exists hs_go_luc timestamptz;

-- RPC thay vì mở RLS cho bảng: RLS của Postgres không giới hạn được theo CỘT, mà ở đây em chỉ
-- được đụng đúng hai ô của chính mình (`results`, `commitments`). Mở quyền update cả dòng là mở
-- luôn `chot_at`, `coach_id`, `buddy_note`… cho một đứa trẻ lớp 6.
--
-- Ba cửa khoá, kiểm ở server chứ không ở giao diện:
--   · em phải đang học lớp ấy (enrollments, is_active);
--   · tuần ấy CHƯA CHỐT — chốt rồi là biên bản đóng, giống hệt luật khoá tick;
--   · dòng ghi ra luôn mang student_id = auth.uid(), không nhận id từ ngoài.
create or replace function hs_ghi_bien_ban(
  p_class uuid,
  p_week_label text,
  p_week_start date,
  p_ket_qua text,
  p_cam_ket text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
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

  -- Tuần đã chốt: dòng của LỚP (student_id is null) mang dấu chốt.
  if exists (
    select 1 from wig_meetings
    where class_id = p_class and week_label = p_week_label
      and student_id is null and chot_at is not null
  ) then
    raise exception 'Buổi họp tuần này đã chốt.' using errcode = '42501';
  end if;

  insert into wig_meetings (class_id, student_id, week_label, week_start, results, commitments, hs_go_luc)
  values (p_class, v_me, p_week_label, p_week_start, nullif(btrim(p_ket_qua), ''), nullif(btrim(p_cam_ket), ''), now())
  on conflict (student_id, week_label) where student_id is not null
  do update set
    results     = nullif(btrim(p_ket_qua), ''),
    commitments = nullif(btrim(p_cam_ket), ''),
    hs_go_luc   = now();
end $$;

revoke all on function hs_ghi_bien_ban(uuid, text, date, text, text) from public;
grant execute on function hs_ghi_bien_ban(uuid, text, date, text, text) to authenticated;

-- ── ③ THÔNG BÁO NÓI ĐÚNG THỨ NÓ LÀ ────────────────────────────────────────────────────────
create or replace function notify_student_meeting() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_co_bien_ban boolean;
begin
  if new.student_id is null then
    return new;
  end if;

  -- Chữ của chính em vừa gõ trong phòng họp — không báo cho em về chữ của em.
  if new.student_id = auth.uid() then
    return new;
  end if;

  v_co_bien_ban :=
    coalesce(btrim(new.results), '') <> ''
    or coalesce(btrim(new.next_actions), '') <> ''
    or coalesce(btrim(new.commitments), '') <> '';

  if v_co_bien_ban then
    insert into notifications (user_id, title, body, link)
    values (
      new.student_id,
      'Cô đã ghi biên bản họp WIG tuần ' || coalesce(new.week_label, ''),
      left(coalesce(nullif(btrim(new.results), ''), nullif(btrim(new.next_actions), ''), ''), 200),
      '/student'
    );
  elsif coalesce(btrim(new.buddy_note), '') <> '' then
    -- Dòng do Buddy AI sinh ra. Trước đây nó cũng được gọi là "biên bản họp WIG", ruột rỗng.
    insert into notifications (user_id, title, body, link)
    values (new.student_id, 'Buddy nhắn bạn', left(new.buddy_note, 200), '/student');
  end if;
  -- Không có gì để nói thì KHÔNG báo. Một thông báo rỗng vẫn là một chấm đỏ trên chuông.
  return new;
end $$;

-- Trước đây chỉ bắn khi INSERT: cô sửa lại biên bản của một em thì em không bao giờ biết. Nay
-- bắn cả khi nội dung ĐỔI — và chỉ khi đổi, nhờ mệnh đề `when`, nên chữ em tự gõ hay dấu chốt
-- không kéo theo thông báo nào.
drop trigger if exists trg_notify_student_meeting on wig_meetings;
create trigger trg_notify_student_meeting after insert on wig_meetings
  for each row execute function notify_student_meeting();

drop trigger if exists trg_notify_student_meeting_upd on wig_meetings;
create trigger trg_notify_student_meeting_upd after update on wig_meetings
  for each row
  when (
    new.student_id is not null
    and (
      coalesce(old.results, '') is distinct from coalesce(new.results, '')
      or coalesce(old.next_actions, '') is distinct from coalesce(new.next_actions, '')
      or coalesce(old.commitments, '') is distinct from coalesce(new.commitments, '')
      or coalesce(old.buddy_note, '') is distinct from coalesce(new.buddy_note, '')
    )
  )
  execute function notify_student_meeting();

-- ── ④ REALTIME CHO PHÒNG HỌP ──────────────────────────────────────────────────────────────
-- Cô nhìn thấy chữ em đang gõ hiện ra ngay trong phòng họp.
--
-- ĐI QUA postgres_changes, KHÔNG qua broadcast. Kênh broadcast của Supabase mặc định ai đăng
-- nhập cũng vào được nếu đoán trúng tên kênh (tên kênh ở đây là id lớp) — nghĩa là chữ của trẻ
-- con đi trên một đường không có RLS. postgres_changes thì Realtime áp đúng RLS của bảng, nên
-- chỉ GVCN của lớp và chính em ấy nhận được dòng đó.
--
-- REPLICA IDENTITY FULL: thiếu nó, gói UPDATE chỉ mang khoá chính + cột vừa đổi, nên phía nhận
-- không có `class_id`/`student_id` để lọc và Realtime cũng không kiểm được RLS.
alter table wig_meetings replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wig_meetings'
  ) then
    execute 'alter publication supabase_realtime add table wig_meetings';
  end if;
end $$;
