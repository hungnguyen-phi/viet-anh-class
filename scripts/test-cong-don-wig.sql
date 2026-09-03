-- KIỂM "WIG năm của em cộng dồn từ cam kết tuần" (0178).
-- Tự chứa: định nghĩa trigger INLINE + gieo dữ liệu, chạy trong GIAO DỊCH rồi ROLLBACK — KHÔNG cài gì
-- lên CSDL, KHÔNG để lại dữ liệu. Chạy được TRƯỚC khi cài 0178.  npm run sql -- scripts/test-cong-don-wig.sql
--
-- Ba ca: ① 2 cam kết cùng đơn vị → WIG = tổng so_dat; ② sửa 1 so_dat → tổng đổi; ③ huỷ 1 cam kết → trừ ra.

begin;

-- ── Trigger thử (PHẢI khớp 0178) ──────────────────────────────────────────────────────────────
create or replace function private.ck_gop_wig() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_mt uuid := coalesce(new.muc_tieu_id, old.muc_tieu_id); m muc_tieu%rowtype; v_tong numeric;
begin
  if v_mt is null then return coalesce(new, old); end if;
  select * into m from muc_tieu where id = v_mt;
  if m.id is null or m.cap <> 'em' or m.don_vi_id is null then return coalesce(new, old); end if;
  select coalesce(sum(c.so_dat), 0) into v_tong from cam_ket c
   where c.muc_tieu_id = v_mt and c.trang_thai='hieu_luc' and c.so_dat is not null
     and c.don_vi_id is not distinct from m.don_vi_id;
  perform set_config('va.nguon_he_thong', '1', true);
  delete from so_do where muc_tieu_id=v_mt and thanh_phan_id is null and nguon='he_thong'
     and student_id is not distinct from m.student_id;
  insert into so_do (muc_tieu_id, ngay, gia_tri, nguon, student_id, thanh_phan_id, nguoi_ghi)
  values (v_mt, vn_today(), v_tong, 'he_thong', m.student_id, null, null);
  perform set_config('va.nguon_he_thong', '', true);
  return coalesce(new, old);
end $$;
drop trigger if exists trg_ck_gop_wig on cam_ket;
create trigger trg_ck_gop_wig after insert or update or delete on cam_ket
  for each row execute function private.ck_gop_wig();

do $$
declare
  v_mon date := date_trunc('week', vn_today())::date;
  v_sid uuid; v_cid uuid; v_cpid uuid; v_dv uuid; v_wig uuid; v_so numeric;
begin
  select id into v_sid from profiles where email='test1.hs@student.truongvietanh.com';
  select id, campus_id into v_cid, v_cpid from classes where name='Test' and is_active limit 1;
  select id into v_dv from don_vi where ma='lan' limit 1;
  if v_sid is null or v_cid is null or v_dv is null then raise exception 'Thiếu student/lớp Test/đơn vị'; end if;

  -- WIG NĂM của em (cap='em', đã duyệt, đơn vị 'lần', đích 0→100)
  insert into muc_tieu (cap, student_id, class_id, campus_id, ten, linh_vuc, loai_moc, kieu_dich, chieu,
                        don_vi_id, x_so, y_so, bat_dau, ket_thuc, nguon_so, trang_thai)
  values ('em', v_sid, v_cid, v_cpid, 'ZZTEST-wig-congdon', 'knowledge', 'do_luong', 'toi', 'tang',
          v_dv, 0, 100, v_mon, date '2027-05-30', 'ghi_tay', 'duyet')
  returning id into v_wig;

  -- ① Hai cam kết CÙNG đơn vị, có số đạt: 3 + 5 = 8
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, so_dat, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id)
  values ('em', v_cid, v_sid, 'ZZTEST-ck-1', 3, 3, v_dv, 1, v_mon - 7, v_wig);
  insert into cam_ket (chu_the, class_id, student_id, noi_dung, so_hua, so_dat, don_vi_id, so_tuan, tuan_bat_dau, muc_tieu_id)
  values ('em', v_cid, v_sid, 'ZZTEST-ck-2', 5, 5, v_dv, 1, v_mon, v_wig);
  select so into v_so from private.so_hien_tai(v_wig);
  if v_so is distinct from 8 then raise exception 'CA1 HỎNG: WIG mong 8, ra %', v_so; end if;
  raise notice 'CA1 OK — WIG = tổng so_dat (3+5=8)';

  -- ② Sửa so_dat cam kết 2: 5 → 10 → tổng 3+10 = 13
  update cam_ket set so_dat=10 where student_id=v_sid and noi_dung='ZZTEST-ck-2';
  select so into v_so from private.so_hien_tai(v_wig);
  if v_so is distinct from 13 then raise exception 'CA2 HỎNG: mong 13, ra %', v_so; end if;
  raise notice 'CA2 OK — sửa số đạt thì tổng đổi (3+10=13)';

  -- ③ Huỷ cam kết 1 (trang_thai='huy') → chỉ còn 10
  update cam_ket set trang_thai='huy' where student_id=v_sid and noi_dung='ZZTEST-ck-1';
  select so into v_so from private.so_hien_tai(v_wig);
  if v_so is distinct from 10 then raise exception 'CA3 HỎNG: mong 10, ra %', v_so; end if;
  raise notice 'CA3 OK — huỷ cam kết thì trừ ra (còn 10)';

  raise notice '✔ TẤT CẢ TEST ĐẠT';
end $$;
rollback;
