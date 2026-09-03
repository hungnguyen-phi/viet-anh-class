-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0178 — WIG NĂM CỦA EM CỘNG DỒN TỪ CAM KẾT TUẦN (chủ dự án 03/09/2026)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Mô hình B: cam kết tuần của em hướng vào WIG NĂM của em. Chủ dự án chốt: "wig năm được cộng con
-- số từ cam kết tuần" — tức số ĐẠT (cam_ket.so_dat, em tự nhập cuối tuần) của các cam kết CÙNG ĐƠN
-- VỊ với WIG được CỘNG DỒN thành số hiện tại của WIG.
--
-- Đây bật lại "auto cộng dồn" từng hoãn (số trước đây DỪNG ở cam kết). Chỉ áp cho WIG của EM
-- (cap='em') có đơn vị; chỉ cộng cam kết CÙNG đơn vị (khác đơn vị thì không cộng — như lead measure).
--
-- CÁCH GHI: trigger sau mỗi thay đổi cam_ket → tính Σ so_dat của WIG → ghi MỘT dòng so_do 'he_thong'
-- (số tổng). so_hien_tai đọc so_do mới nhất (WIG của em vẫn nguon_so='ghi_tay', nhưng đọc so_do bất
-- kể nguon) → hiện đúng tổng. Ghi 'he_thong' phải qua khe `va.nguon_he_thong` mà so_do_truoc_ghi mở.
--
-- ‼️ CÀI FILE NÀY = BẬT NGAY tính năng (trigger active). Chạy scripts/test-cong-don-wig.sql (tự
-- rollback, không cài gì) và thấy "TẤT CẢ TEST ĐẠT" TRƯỚC khi chạy migration này lên production.

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
  -- Chỉ cộng dồn cho WIG NĂM của EM có đơn vị. WIG lớp/nhóm hoặc không đơn vị: bỏ qua.
  if m.id is null or m.cap <> 'em' or m.don_vi_id is null then
    return coalesce(new, old);
  end if;

  -- Σ số ĐẠT của mọi cam kết thuộc WIG này: còn hiệu lực, đã có số, và CÙNG đơn vị với WIG.
  select coalesce(sum(c.so_dat), 0) into v_tong
  from cam_ket c
  where c.muc_tieu_id = v_mt
    and c.trang_thai = 'hieu_luc'
    and c.so_dat is not null
    and c.don_vi_id is not distinct from m.don_vi_id;

  -- Ghi số tổng vào so_do (nguon 'he_thong'). so_do_truoc_ghi CHẶN ghi tay 'he_thong' trừ khi mở
  -- khe `va.nguon_he_thong`. WIG của em không có unique-index he_thong (chỉ áp khi student_id null),
  -- nên giữ MỘT dòng tổng bằng cách xoá dòng cũ rồi chèn lại.
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
  'Sau mỗi thay đổi cam_ket: cộng dồn Σ so_dat của các cam kết CÙNG đơn vị thuộc WIG NĂM của em rồi '
  'ghi 1 dòng so_do he_thong = tổng. Chỉ cap=''em'' có đơn vị. Bật khi cài (trigger active ngay).';

drop trigger if exists trg_ck_gop_wig on cam_ket;
create trigger trg_ck_gop_wig
  after insert or update or delete on cam_ket
  for each row execute function private.ck_gop_wig();
