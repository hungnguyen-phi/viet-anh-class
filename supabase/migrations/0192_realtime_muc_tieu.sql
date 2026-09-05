-- 0192 — REALTIME CHO CHỜ DUYỆT + THÔNG BÁO GỬI/DUYỆT MỤC TIÊU (chủ dự án 05/09/2026)
--
-- Vấn đề: em gửi mục tiêu chờ duyệt → giáo viên đang mở /wig phải F5 mới thấy. Đường sửa:
--   1. Đưa ba bảng muc_tieu / cam_ket / thuoc vào publication supabase_realtime (CÓ CHỌN LỌC —
--      0187 vừa gỡ realtime bừa bãi vì poller WAL tốn CPU; ba bảng này nhỏ, ghi ít: mỗi em vài
--      dòng một năm, mỗi tick là bảng `luot` KHÔNG đưa vào). Client nghe postgres_changes rồi
--      router.refresh() — RLS SELECT áp cho realtime y hệt truy vấn thường (Supabase Realtime
--      Authorization), nên giáo viên chỉ nhận sự kiện của lớp mình.
--   2. replica identity FULL cho ba bảng: mặc định (d) chỉ mang khoá chính trong `old` của
--      UPDATE/DELETE → filter `class_id=eq.…` không khớp DELETE và một số UPDATE. FULL ghi cả dòng
--      vào WAL — bảng nhỏ nên chi phí không đáng kể.
--   3. Thông báo trong app (bảng notifications, chuông): em gửi → GVCN lớp nhận "… gửi mục tiêu
--      chờ duyệt"; thầy cô duyệt / trả lại → em nhận. Làm bằng trigger AFTER trên muc_tieu (SECDEF,
--      như 0111/0159) — không phụ thuộc đường action nào, không cần khoá dịch vụ.
--
-- Đối chiếu live 05/09: muc_tieu có 5 trigger (trg_mt_ghi_lich_su_dich, trg_mt_truoc_sua,
-- trg_mt_truoc_them, trg_mt_truoc_xoa, trg_touch_muc_tieu) — không trùng tên; notifications
-- (user_id, title, body, link, read) policy SELECT/UPDATE cho chính chủ, insert chỉ qua SECDEF.
-- Luật 0187: hàm trigger nằm schema private, không cần grant.

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Publication + replica identity
-- ─────────────────────────────────────────────────────────────────────────────────────
alter table public.muc_tieu replica identity full;
alter table public.cam_ket  replica identity full;
alter table public.thuoc    replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'muc_tieu') then
    alter publication supabase_realtime add table public.muc_tieu;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cam_ket') then
    alter publication supabase_realtime add table public.cam_ket;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'thuoc') then
    alter publication supabase_realtime add table public.thuoc;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Thông báo gửi / duyệt / trả lại mục tiêu của EM (cap='em')
--    · INSERT trang_thai='gui' hoặc UPDATE sang 'gui' (từ nhap/tra_lai/duyet do sửa nội dung)
--      → notifications cho GVCN của lớp (classes.homeroom_teacher_id), link /wig?class=…
--    · UPDATE gui → duyet / tra_lai → notifications cho em, link /student
--    Không báo cho chính người thao tác (em tự sửa nháp không tự nhận thông báo).
-- ─────────────────────────────────────────────────────────────────────────────────────
create or replace function private.mt_thong_bao_duyet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_gvcn uuid;
  v_ten_em text;
  v_me uuid := (select auth.uid());
begin
  if new.cap <> 'em' or new.student_id is null then return new; end if;

  -- Em gửi (mới, hoặc đổi trạng thái sang 'gui')
  if new.trang_thai = 'gui' and (tg_op = 'INSERT' or old.trang_thai is distinct from 'gui') then
    select homeroom_teacher_id into v_gvcn from classes where id = new.class_id;
    if v_gvcn is not null and v_gvcn is distinct from v_me then
      select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into v_ten_em from profiles where id = new.student_id;
      insert into notifications (user_id, title, body, link)
      values (v_gvcn,
              v_ten_em || ' gửi mục tiêu chờ duyệt',
              left(new.ten, 120),
              '/wig?class=' || new.class_id::text);
    end if;
    return new;
  end if;

  -- Thầy cô duyệt / trả lại (trả lại được cả khi đã duyệt — mt_truoc_sua không chặn, nên
  -- không đòi old = 'gui'; chỉ cần trạng thái thật sự đổi)
  if tg_op = 'UPDATE' and new.trang_thai in ('duyet', 'tra_lai')
     and old.trang_thai is distinct from new.trang_thai
     and new.student_id is distinct from v_me then
    insert into notifications (user_id, title, body, link)
    values (new.student_id,
            case when new.trang_thai = 'duyet' then 'Thầy cô đã duyệt mục tiêu của em'
                 else 'Thầy cô trả lại mục tiêu — xem lý do trong thẻ' end,
            left(new.ten, 120) || case when new.trang_thai = 'tra_lai' and new.ly_do_tra_lai is not null
                                       then ' · ' || left(new.ly_do_tra_lai, 160) else '' end,
            '/student');
  end if;
  return new;
end $$;

-- KHÔNG dùng `update of trang_thai`: em sửa nội dung mục tiêu bị trả lại thì câu UPDATE không
-- nêu cột trang_thai — chính mt_truoc_sua (BEFORE) mới đẩy nó về 'gui'. Điều kiện cột chỉ nhìn
-- câu lệnh, không nhìn giá trị, nên trigger sẽ bỏ sót đúng lần gửi lại ấy. Bảng nhỏ, so old/new
-- trong thân hàm là đủ rẻ.
drop trigger if exists trg_mt_thong_bao_duyet on public.muc_tieu;
create trigger trg_mt_thong_bao_duyet
  after insert or update on public.muc_tieu
  for each row execute function private.mt_thong_bao_duyet();
