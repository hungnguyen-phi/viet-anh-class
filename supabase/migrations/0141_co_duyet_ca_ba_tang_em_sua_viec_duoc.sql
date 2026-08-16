-- CÔ DUYỆT CẢ BA TẦNG — mục tiêu năm, cam kết tuần, việc dẫn dắt; em sửa gì thì thứ ấy về chờ.
--
-- Chủ dự án 16/08/2026 (chốt lần cuối, sau khi đảo một lần): "wig năm cũng duyệt, cam kết tuần +
-- lead measure cũng duyệt". Nhưng em VẪN được sửa/xoá việc của mình (0129 khoá cứng là quá tay):
-- sửa xong thì cam kết mẹ về 'sent' để cô gật lại — cùng luật với sửa mục tiêu năm (0129).
--
--   · MỤC TIÊU NĂM: giữ nguyên trg_wig_em_sua_thi_cho_duyet (0129).
--   · CAM KẾT TUẦN: giữ nguyên trg_cam_ket_trang_thai (0129) — em đặt → 'sent'.
--   · VIỆC DẪN DẮT: em thêm/sửa/xoá được khi tuần chưa chốt (RLS mới), và mỗi lần như thế cam kết
--     mẹ về 'sent'. Duyệt cam kết là duyệt cả bộ việc dưới nó.
set search_path = public;

-- ── 0. Trả trigger trạng thái cam kết về đúng 0129 (bản 0141 lúc sáng đã lỡ đặt 'luôn approved') ──
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

-- ── 1. Em sửa/xoá việc dưới cam kết của mình khi tuần chưa chốt ─────────────────────────────
drop policy if exists rls_sua_viec_cua_em on lead_measures;
create policy rls_sua_viec_cua_em on lead_measures for update
  using (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id = (select auth.uid())
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  )
  with check (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id = (select auth.uid())
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  );

drop policy if exists rls_xoa_viec_cua_em on lead_measures;
create policy rls_xoa_viec_cua_em on lead_measures for delete
  using (
    exists (
      select 1 from commitments c
      where c.id = lead_measures.commitment_id
        and c.student_id = (select auth.uid())
        and not tuan_da_hop(c.class_id, c.week_start)
    )
  );

-- ── 2. Em đụng vào việc → cam kết mẹ về chờ duyệt ──────────────────────────────────────────
create or replace function private.viec_em_sua_thi_cam_ket_cho_duyet() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_ck uuid := coalesce(new.commitment_id, old.commitment_id);
begin
  -- Chỉ khi CHÍNH EM (chủ cam kết) đang thao tác; cô/quản trị/seed thì không đá về chờ.
  if v_ck is not null and exists (
    select 1 from commitments c where c.id = v_ck and c.student_id = (select auth.uid())
  ) then
    update commitments set status = 'sent' where id = v_ck and status <> 'sent';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_viec_em_sua_thi_cam_ket_cho_duyet on lead_measures;
create trigger trg_viec_em_sua_thi_cam_ket_cho_duyet
  after insert or update or delete on lead_measures
  for each row execute function private.viec_em_sua_thi_cam_ket_cho_duyet();

comment on trigger trg_viec_em_sua_thi_cam_ket_cho_duyet on lead_measures is
  'Em thêm/sửa/xoá việc dưới cam kết của mình → cam kết về ''sent'' để cô duyệt lại (0141).';
