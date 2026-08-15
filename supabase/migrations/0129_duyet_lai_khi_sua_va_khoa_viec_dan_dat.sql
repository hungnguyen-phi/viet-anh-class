-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0129 — SỬA THÌ DUYỆT LẠI · CAM KẾT CŨNG PHẢI DUYỆT · VIỆC DẪN DẮT KHOÁ NGAY KHI THÊM
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Ba luật chủ dự án chốt 15/08/2026, đều là một luật cũ được áp cho đúng chỗ chứ không phải luật
-- mới: "học sinh tạo wig, tạo commitment tuần, thì gv duyệt, còn tạo lead measure thì không cần,
-- nhưng phải có thể giáo viên biết bạn đó đang làm gì để đạt được mục tiêu."
--
-- ── 1. BỎ CỬA SỔ 24 GIỜ KHỎI ĐƯỜNG SỬA ──────────────────────────────────────────────────────
--
-- 0102 dựng luật: mục tiêu đã duyệt mà quá 24 giờ thì em hết sửa được, muốn đổi phải nhắn cô.
-- PRD v3 nói ngược lại — "WIGs có thể được thay đổi trong năm, nhưng vẫn cần GVCN duyệt". Hai
-- câu ấy không thể cùng đúng, và câu của PRD mới là câu chủ dự án chốt.
--
-- Nên cửa sổ thời gian biến mất khỏi đường SỬA, thay bằng đúng một cơ chế: em sửa → mục tiêu về
-- lại 'sent' → cô duyệt lại. Cái giữ chất lượng nay là con mắt của cô, không phải cái đồng hồ.
--
-- Đường XOÁ thì GIỮ NGUYÊN cửa sổ 24 giờ. Xoá kéo theo toàn bộ lịch sử tick (cascade) — một việc
-- không lấy lại được, khác hẳn sửa. Em đổi ý sau một tuần thì sửa, không phải xoá.
--
-- ── 2. TICK "ĐÃ ĐẠT" KHÔNG PHẢI LÀ SỬA ──────────────────────────────────────────────────────
--
-- Đây là chỗ dễ hỏng nhất của cả bản vá, nên KHÔNG làm bằng RLS WITH CHECK (kiểu "kết quả phải
-- luôn là 'sent'"). Làm thế thì em đánh dấu ĐÃ ĐẠT cho mục tiêu đo-ngoài-app cũng bị đá về chờ
-- duyệt — một cái tick xác nhận kết quả bỗng huỷ luôn hiệu lực của mục tiêu.
--
-- Làm bằng TRIGGER, và chỉ đá về 'sent' khi NỘI DUNG LỜI HỨA đổi: tên, đích, mốc xuất phát, đơn
-- vị, hạn, hay mục tiêu lớp mà nó gắn vào. Trigger chạy TRƯỚC WITH CHECK nên nó là tiếng nói sau
-- cùng — em có gửi lên status='approved' cũng bị đè.

create or replace function private.wig_em_sua_thi_cho_duyet()
returns trigger
language plpgsql
as $$
begin
  if new.scope <> 'student' then
    return new;
  end if;
  -- auth.uid() null (service_role, seed, migration) ⇒ không phải em đang gõ ⇒ không đụng status.
  if new.student_id is not distinct from (select auth.uid()) then
    if new.title         is distinct from old.title
    or new.target_value  is distinct from old.target_value
    or new.baseline      is distinct from old.baseline
    or new.unit          is distinct from old.unit
    or new.end_date      is distinct from old.end_date
    or new.kind          is distinct from old.kind
    or new.source_wig_id is distinct from old.source_wig_id
    then
      new.status := 'sent';
    else
      -- EM KHÔNG TỰ DUYỆT CHO MÌNH. Bản đầu chỉ hạ trạng thái khi nội dung đổi, nên gửi thẳng
      -- một câu update status='approved' (nội dung y nguyên) là em tự gật cho chính mình — bộ
      -- kiểm bắt được đúng đường ấy. Giữ nguyên trạng thái cũ là câu trả lời gọn nhất: mọi ngả
      -- đi qua tay em đều không đổi được nó.
      new.status := old.status;
    end if;
    -- `set_by` là thước đo "bao nhiêu %% em tự đặt" của cả chương trình — em không sửa được nó.
    new.set_by := old.set_by;
  end if;
  return new;
end $$;

drop trigger if exists trg_wig_em_sua_thi_cho_duyet on wigs;
create trigger trg_wig_em_sua_thi_cho_duyet
  before update on wigs
  for each row execute function private.wig_em_sua_thi_cho_duyet();

-- Chính sách sửa: bỏ hẳn vế thời gian. Em luôn sửa được mục tiêu CỦA MÌNH; trigger ở trên quyết
-- định việc ấy có kéo theo phải duyệt lại hay không.
drop policy if exists rls_update_wig_cua_em on wigs;
create policy rls_update_wig_cua_em on wigs for update
  using (scope = 'student' and student_id = (select auth.uid()))
  with check (scope = 'student' and student_id = (select auth.uid()));

-- ── 3. CAM KẾT TUẦN CŨNG QUA CỬA DUYỆT ──────────────────────────────────────────────────────
-- Cùng bộ chữ với wigs.status để hai nơi đọc được bằng một mắt: 'sent' = em gửi, chờ cô;
-- 'approved' = đã duyệt. Cam kết của LỚP (student_id null) do cô đặt nên luôn 'approved'.
alter table commitments add column if not exists status text not null default 'approved';
alter table commitments add column if not exists set_by text;

alter table commitments drop constraint if exists commitment_status_ck;
alter table commitments add constraint commitment_status_ck check (status in ('sent', 'approved'));

comment on column commitments.status is
  '"sent" = em vừa đặt/sửa, chờ GVCN duyệt · "approved" = đã duyệt. Trigger tự đặt — đừng ghi thẳng.';

create index if not exists idx_commitments_cho_duyet on commitments(class_id, week_start)
  where status = 'sent';

-- MÁY QUYẾT AI ĐẶT, KHÔNG HỎI FORM. Cùng lý do với `set_by` của wigs: đây là thước đo của cả
-- chương trình ("bao nhiêu % em tự đặt"), một ô trên form thì gửi gì lên cũng được.
create or replace function private.cam_ket_trang_thai()
returns trigger
language plpgsql
as $$
declare v_la_em boolean;
begin
  v_la_em := new.student_id is not null and new.student_id is not distinct from (select auth.uid());

  if tg_op = 'INSERT' then
    new.status := case when v_la_em then 'sent' else 'approved' end;
    new.set_by := case when v_la_em then 'student' else 'teacher' end;
    return new;
  end if;

  -- Em sửa lời hứa của mình → về lại chờ duyệt. Chấm V/X, đổi verdict_goi_y, đếm so_lan_sua đều
  -- KHÔNG phải "sửa lời hứa" — chúng là việc của buổi họp, và đá cam kết về chờ duyệt vì một cái
  -- tick của cô là biến chính thao tác duyệt thành thứ tự huỷ mình.
  if v_la_em then
    if new.title is distinct from old.title or new.wig_id is distinct from old.wig_id then
      new.status := 'sent';
    else
      -- EM KHÔNG TỰ DUYỆT. Xem ghi chú cùng nội dung ở private.wig_em_sua_thi_cho_duyet().
      new.status := old.status;
    end if;
    new.set_by := old.set_by;
  end if;
  return new;
end $$;

drop trigger if exists trg_cam_ket_trang_thai on commitments;
create trigger trg_cam_ket_trang_thai
  before insert or update on commitments
  for each row execute function private.cam_ket_trang_thai();

-- Dữ liệu đang có (gieo bằng service_role, cô đặt) đều coi như đã duyệt.
update commitments set set_by = coalesce(set_by, 'teacher') where set_by is null;

-- ── 4. VIỆC DẪN DẮT: THÊM ĐƯỢC, SỬA/XOÁ THÌ KHÔNG ──────────────────────────────────────────
--
-- Vòng comment PRD: "Lead measure của commitment đó không được xoá, sửa, nhưng có thể thêm với
-- giới hạn không quá 10 lead measure/tuần." Chủ dự án chốt tiếp 15/08/2026: khoá NGAY KHI VỪA
-- THÊM, không chờ có lượt tick.
--
-- Vì sao đáng khoá chặt thế: việc dẫn dắt là thứ các em tick vào mỗi ngày. Sửa tên hay đổi chỉ
-- tiêu giữa tuần là đổi luật giữa trận — mọi lượt tick đã ghi bỗng nói về một việc khác. Gõ nhầm
-- thì xoá cả cam kết rồi đặt lại; cam kết vẫn xoá được, và cascade dọn theo.
--
-- Đường thoát cuối cùng vẫn để cho quản trị viên: dữ liệu thật của trẻ con thì luôn phải có một
-- người sửa được khi mọi thứ hỏng.
drop policy if exists rls_all_lead_measures on lead_measures;

drop policy if exists rls_them_viec_cua_lop on lead_measures;
create policy rls_them_viec_cua_lop on lead_measures for insert
  with check (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id and staff_can_manage_class(c.class_id)
    )
  );

-- Em tự thêm việc cho CAM KẾT CỦA CHÍNH MÌNH — không cần duyệt (chủ dự án: "tạo lead measure thì
-- không cần"), nhưng cô luôn đọc được, vì đó là cách cô biết em đang làm gì để đạt mục tiêu.
drop policy if exists rls_write_viec_cua_em on lead_measures;
drop policy if exists rls_them_viec_cua_em on lead_measures;
create policy rls_them_viec_cua_em on lead_measures for insert
  with check (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id = (select auth.uid())
        and is_class_student(c.class_id)
    )
  );

drop policy if exists rls_sua_viec_chi_quan_tri on lead_measures;
create policy rls_sua_viec_chi_quan_tri on lead_measures for update
  using (auth_role() = 'admin'::user_role)
  with check (auth_role() = 'admin'::user_role);

drop policy if exists rls_xoa_viec_chi_quan_tri on lead_measures;
create policy rls_xoa_viec_chi_quan_tri on lead_measures for delete
  using (auth_role() = 'admin'::user_role);

-- SELECT: nới cho khớp mô hình mới. Bản cũ hỏi `wigs.student_id = auth.uid()` — đúng với việc
-- treo thẳng dưới mục tiêu của em, nhưng nay việc treo dưới CAM KẾT, và cam kết mới là thứ giữ
-- chủ sở hữu. Thiếu vế này thì em không đọc nổi việc của chính mình.
drop policy if exists rls_select_lead_measures on lead_measures;
create policy rls_select_lead_measures on lead_measures for select
  using (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and (
          staff_can_read_class(c.class_id)
          or is_class_student(c.class_id)
          or (c.student_id is not null and is_my_child(c.student_id))
        )
    )
  );

-- ── 5. BẢNG PDR ĐẾM THÊM "CHỜ DUYỆT" ───────────────────────────────────────────────────────
-- Cô mở phòng họp là thấy ngay em nào vừa đặt lời hứa mà chưa ai gật.
drop function if exists pdr_bang(uuid, date);
create function pdr_bang(p_class uuid, p_week date default null)
returns table(
  student_id uuid,
  student_name text,
  cam_ket_tong integer,
  cam_ket_dat integer,
  cam_ket_cho_duyet integer,
  viec_tong integer,
  viec_dat integer,
  so_lan_sua integer,
  cham_khac_may integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with wk as (select coalesce(p_week, vn_week_start()) as monday),
  em as (
    select e.student_id as sid, ten_hien_thi(p.full_name, p.email) as ten
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.class_id = p_class and e.is_active
  ),
  ck as (
    select c.id, c.student_id, c.verdict, c.verdict_goi_y, c.so_lan_sua, c.status
    from commitments c, wk
    where c.class_id = p_class and c.student_id is not null and c.week_start = wk.monday
  ),
  viec as (
    select ck.student_id, lm.id as lead_id,
           coalesce((
             select case when kieu_don_vi(lm.unit) = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
               else sum(lp.value) * lm.unit_per_tick end
             from lead_progress lp, wk
             where lp.lead_measure_id = lm.id
               and lp.student_id = ck.student_id
               and lp.logged_date between wk.monday and wk.monday + 6
           ), 0) >= lm.target_value as xong
    from ck join lead_measures lm on lm.commitment_id = ck.id
  )
  select
    em.sid,
    em.ten,
    coalesce((select count(*) from ck where ck.student_id = em.sid), 0)::integer,
    coalesce((select count(*) from ck where ck.student_id = em.sid and ck.verdict = 'win'), 0)::integer,
    coalesce((select count(*) from ck where ck.student_id = em.sid and ck.status = 'sent'), 0)::integer,
    coalesce((select count(*) from viec v where v.student_id = em.sid), 0)::integer,
    coalesce((select count(*) from viec v where v.student_id = em.sid and v.xong), 0)::integer,
    coalesce((select sum(ck.so_lan_sua) from ck where ck.student_id = em.sid), 0)::integer,
    coalesce((select count(*) from ck
              where ck.student_id = em.sid and ck.verdict is not null
                and ck.verdict is distinct from ck.verdict_goi_y), 0)::integer
  from em
  where staff_can_read_class(p_class)
  order by em.ten;
$$;
revoke all on function pdr_bang(uuid, date) from public, anon;
grant execute on function pdr_bang(uuid, date) to authenticated, service_role;
