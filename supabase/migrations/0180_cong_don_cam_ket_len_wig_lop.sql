-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0180 — MỞ RỘNG cộng dồn cam kết → WIG cho MỤC TIÊU LỚP (chủ dự án 03/09/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0178 cho WIG NĂM của EM cộng dồn từ cam kết tuần của em. Chủ dự án muốn PHÍA CÔ cũng vậy: mục
-- tiêu LỚP và cam kết tuần của lớp CÙNG ĐƠN VỊ thì bỏ "Ghi số hôm nay" tay, mà con số của mục tiêu
-- lớp được CỘNG DỒN từ số đạt của các cam kết tuần của lớp (cô nhập cuối/đầu tuần + chấm Thắng/Thua).
--
-- Chỉ đổi ĐÚNG MỘT chỗ trong ck_gop_wig: cap 'em' → cap ∈ {'em','lop'}. Với lớp, WIG có student_id
-- = null, so_do he_thong cũng student_id=null (unique index so_do_he_thong_uidx áp đúng ca này —
-- xoá-rồi-chèn giữ một dòng tổng). Cam kết của lớp là chu_the='lop', nối WIG lớp qua muc_tieu_id.
--
-- ‼️ CÀI = BẬT NGAY. Chạy scripts/test-cong-don-wig-lop.sql (rollback) ĐẠT trước rồi mới cài.

create or replace function private.ck_gop_wig() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_mt  uuid := coalesce(new.muc_tieu_id, old.muc_tieu_id);
  m     muc_tieu%rowtype;
  v_tong numeric;
begin
  if v_mt is null then return coalesce(new, old); end if;
  select * into m from muc_tieu where id = v_mt;
  -- Cộng dồn cho WIG của EM và của LỚP, miễn có đơn vị. Nhóm/trường: chưa (để sau).
  if m.id is null or m.cap not in ('em', 'lop') or m.don_vi_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(c.so_dat), 0) into v_tong
  from cam_ket c
  where c.muc_tieu_id = v_mt
    and c.trang_thai = 'hieu_luc'
    and c.so_dat is not null
    and c.don_vi_id is not distinct from m.don_vi_id;

  perform set_config('va.nguon_he_thong', '1', true);
  delete from so_do
   where muc_tieu_id = v_mt and thanh_phan_id is null and nguon = 'he_thong'
     and student_id is not distinct from m.student_id;
  insert into so_do (muc_tieu_id, ngay, gia_tri, nguon, student_id, thanh_phan_id, nguoi_ghi)
  values (v_mt, vn_today(), v_tong, 'he_thong', m.student_id, null, null);
  perform set_config('va.nguon_he_thong', '', true);

  return coalesce(new, old);
end $$;

comment on function private.ck_gop_wig() is
  'Sau mỗi thay đổi cam_ket: Σ so_dat các cam kết CÙNG đơn vị thuộc WIG (cap em hoặc lop) → ghi 1 '
  'dòng so_do he_thong = tổng. WIG lớp student_id=null. Bật khi cài (0178 em, 0180 thêm lớp).';
