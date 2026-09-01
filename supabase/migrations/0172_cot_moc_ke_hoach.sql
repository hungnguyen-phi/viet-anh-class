-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0172 — BA LOẠI CỘT MỐC cho mục tiêu; "kế hoạch" có các BƯỚC (chủ dự án 02/09/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Form đặt mục tiêu bỏ kiểu "một khuôn cho mọi phép đo" (đếm/đo/giữ/giảm khó hiểu), thay bằng BA
-- LOẠI CỘT MỐC đúng cách người ta hình dung một mục tiêu:
--   · do_luong  — một con số đi từ X đến Y (điểm 6→8). Dùng mô hình đo sẵn có, không đổi gì.
--   · hanh_dong — làm xong một việc, 0→100%. Đo bằng số đo tay theo % (đơn vị 'phan_tram').
--   · ke_hoach  — làm theo CÁC BƯỚC cộng dồn tới 100% (dự án: chọn đề → thí nghiệm → viết). MỚI.
--
-- Vì sao "kế hoạch" cần bảng riêng: tiến độ của nó = tổng % của các bước ĐÃ XONG, không đo bằng
-- một con số em ghi. Bảng `buoc` giữ từng bước; một trigger tự tính % xong rồi GHI VÀO so_do bằng
-- nguồn hệ thống — nhờ vậy hàm tính tiến độ (private.so_hien_tai) KHÔNG phải sửa: mục tiêu kế
-- hoạch khai nguon_so='he_thong', đọc so_do như mọi mục tiêu đo tay khác. Cô lập, ít rủi ro.
--
-- loai_moc là METADATA cho form (hiện ô nào) — bộ tính vẫn dựa nguon_so/kieu_dich như cũ.

-- ── 1. Loại cột mốc trên muc_tieu ──────────────────────────────────────────────────────────
alter table muc_tieu
  add column if not exists loai_moc text not null default 'do_luong'
  check (loai_moc in ('do_luong', 'hanh_dong', 'ke_hoach'));

-- ── 2. muc_tieu_v gồm cột mới (0171 chốt cột lúc tạo; thêm cột phải tạo lại). Không view nào
--      phụ thuộc muc_tieu_v (đã kiểm pg_depend). `m.*` nay gồm cả mo_ta lẫn loai_moc. ─────────
drop view if exists muc_tieu_v;
create view muc_tieu_v with (security_invoker = true) as
select m.*,
  dv.nhan_vi as ten_don_vi,
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.so end as so,
  h.nguon, h.ngay_nguon, h.so_nguon, h.x, h.y, h.le_ra,
  case when m.cap = 'nhom'
        and (select count(*) from nhom_thanh_vien v where v.nhom_id = m.nhom_id and v.is_active) < 3
        and not (staff_can_read_class(m.class_id)
                 or em_trong_nhom(m.nhom_id, (select auth.uid()))
                 or is_parent_of_class(m.class_id))
       then null else h.pct end as pct,
  h.dat, h.trang_thai as trang_thai_do, h.ky_tu, h.ky_den, h.so_ky_giu, h.so_ky_xet, h.tu_so, h.mau_so
from muc_tieu m
left join don_vi dv on dv.id = m.don_vi_id
left join lateral private.so_hien_tai(m.id) h on true;
revoke all on muc_tieu_v from anon;
grant select on muc_tieu_v to authenticated;

-- ── 3. Bảng BƯỚC của cột mốc kế hoạch ──────────────────────────────────────────────────────
create table if not exists buoc (
  id uuid primary key default gen_random_uuid(),
  muc_tieu_id uuid not null references muc_tieu(id) on delete cascade,
  thu_tu int not null default 0,
  tieu_de text not null,
  -- Trọng số của bước trong tổng 100% (form buộc tổng = 100 trước khi gửi). 0–100 mỗi bước.
  phan_tram numeric not null default 0 check (phan_tram >= 0 and phan_tram <= 100),
  bat_dau date,
  ket_thuc date,
  mo_ta text,
  -- Xong = có mốc thời gian; null = chưa xong. Ai bấm xong lưu lại.
  xong_at timestamptz,
  xong_boi uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (ket_thuc is null or bat_dau is null or ket_thuc >= bat_dau)
);
create index if not exists buoc_muc_tieu_idx on buoc (muc_tieu_id, thu_tu);
alter table buoc enable row level security;

-- RLS: đọc/ghi theo đúng quyền của mục tiêu cha (helper 0163 đã có).
drop policy if exists buoc_doc on buoc;
create policy buoc_doc on buoc for select to authenticated
  using (doc_duoc_muc_tieu(muc_tieu_id));
drop policy if exists buoc_ghi on buoc;
create policy buoc_ghi on buoc for all to authenticated
  using (ghi_duoc_muc_tieu(muc_tieu_id))
  with check (ghi_duoc_muc_tieu(muc_tieu_id));
grant select, insert, update, delete on buoc to authenticated;

-- ── 4. Trigger: đổi bước → tính lại % xong → ghi vào so_do (nguồn hệ thống) ─────────────────
-- % = tổng phan_tram của các bước ĐÃ XONG. Ghi một dòng so_do hôm nay (giờ VN) mang nguồn
-- 'he_thong' — mở khe va.nguon_he_thong để qua trigger so_do_truoc_ghi. Xoá dòng hệ thống cũ
-- của hôm nay trước khi ghi để không đọng nhiều dòng.
create or replace function private.buoc_cap_nhat_so_do()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mt uuid := coalesce(new.muc_tieu_id, old.muc_tieu_id);
  v_pct numeric;
  v_hom_nay date := vn_today();
  v_owner uuid;   -- student_id của mục tiêu: so_do phải mang đúng chủ (so_do_truoc_ghi kiểm).
begin
  select coalesce(sum(phan_tram) filter (where xong_at is not null), 0), (select student_id from muc_tieu where id = v_mt)
    into v_pct, v_owner from buoc where muc_tieu_id = v_mt;
  -- Nếu mục tiêu không còn (xoá cascade) thì thôi.
  if not exists (select 1 from muc_tieu where id = v_mt) then return null; end if;
  perform set_config('va.nguon_he_thong', '1', true);
  delete from so_do
    where muc_tieu_id = v_mt and thanh_phan_id is null and student_id is not distinct from v_owner
      and nguon = 'he_thong' and ngay = v_hom_nay;
  insert into so_do (muc_tieu_id, student_id, ngay, gia_tri, nguon)
  values (v_mt, v_owner, v_hom_nay, v_pct, 'he_thong');
  perform set_config('va.nguon_he_thong', '', true);
  return null;
end $$;

drop trigger if exists buoc_sau_ghi on buoc;
create trigger buoc_sau_ghi after insert or update or delete on buoc
  for each row execute function private.buoc_cap_nhat_so_do();
