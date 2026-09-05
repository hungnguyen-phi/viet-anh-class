-- TEST 0192 — realtime + thông báo gửi/duyệt mục tiêu. Tự rollback. Chạy: npm run sql -- scripts/test-0192-realtime.sql
-- Chưa áp 0192 → CA1 đỏ (publication thiếu bảng). Áp rồi → 7 ca xanh (im lặng = đạt).
begin;

do $$
declare
  v_lop uuid; v_em uuid; v_gvcn uuid; v_mt uuid; v_n int; v_dv uuid; v_tt text;
begin
  -- CA1: publication có đủ 3 bảng
  select count(*) into v_n from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('muc_tieu','cam_ket','thuoc');
  if v_n <> 3 then raise exception 'CA1 CHUA VA 0192: publication chi co %/3 bang', v_n; end if;

  -- CA2: replica identity full
  select count(*) into v_n from pg_class where relname in ('muc_tieu','cam_ket','thuoc') and relreplident = 'f';
  if v_n <> 3 then raise exception 'CA2: replica identity full chi %/3', v_n; end if;

  select c.id, c.homeroom_teacher_id into v_lop, v_gvcn from classes c where c.name = 'Test' and c.is_active limit 1;
  select p.id into v_em from profiles p where p.email = 'test1.hs@student.truongvietanh.com';
  select id into v_dv from don_vi where ma = 'lan' limit 1;
  if v_lop is null or v_em is null or v_gvcn is null then raise exception 'thieu lop Test / em / GVCN'; end if;

  -- Giả phiên EM gửi mục tiêu
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_em::text, true);
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc, loai_moc, kieu_dich, chieu, x_so, y_so, don_vi_id, nguon_so, bat_dau, ket_thuc, trang_thai)
  select 'em', c.campus_id, v_lop, v_em, '2026-2027', 'TEST0192 doc 5 quyen', 'knowledge', 'do_luong', 'toi', 'tang', 0, 5, v_dv, 'ghi_tay', current_date, (current_date + 60), 'gui'
  from classes c where c.id = v_lop returning id into v_mt;

  -- CA3: GVCN nhận thông báo "gửi mục tiêu chờ duyệt", link /wig?class=
  select count(*) into v_n from notifications where user_id = v_gvcn and title like '%gửi mục tiêu chờ duyệt' and link = '/wig?class=' || v_lop::text and created_at > now() - interval '5 seconds';
  if v_n <> 1 then raise exception 'CA3: GVCN nhan % thong bao (mong 1)', v_n; end if;

  -- CA4: GVCN duyệt → em nhận thông báo duyệt
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_gvcn::text, true);
  update muc_tieu set trang_thai = 'duyet' where id = v_mt;
  select count(*) into v_n from notifications where user_id = v_em and title = 'Thầy cô đã duyệt mục tiêu của em' and created_at > now() - interval '5 seconds';
  if v_n <> 1 then raise exception 'CA4: em nhan % thong bao duyet (mong 1)', v_n; end if;

  -- CA5: GVCN trả lại (có lý do) → em nhận thông báo trả lại, thân có lý do
  update muc_tieu set trang_thai = 'tra_lai', ly_do_tra_lai = 'Ghi rõ số quyển' where id = v_mt;
  select count(*) into v_n from notifications where user_id = v_em and title like 'Thầy cô trả lại mục tiêu%' and body like '%Ghi rõ số quyển%' and created_at > now() - interval '5 seconds';
  if v_n <> 1 then raise exception 'CA5: em nhan % thong bao tra lai (mong 1)', v_n; end if;

  -- CA6: em CHỈ sửa nội dung (không nêu cột trang_thai) → mt_truoc_sua tự đẩy về 'gui'
  --      → GVCN vẫn phải nhận thông báo lần 2 (đây là chỗ `update of trang_thai` sẽ bỏ sót)
  perform set_config('request.jwt.claims', json_build_object('sub', v_em, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_em::text, true);
  update muc_tieu set ten = 'TEST0192 doc 5 quyen sach' where id = v_mt;
  select trang_thai into v_tt from muc_tieu where id = v_mt;
  if v_tt <> 'gui' then raise exception 'CA6: sua noi dung sau tra_lai phai ve gui, dang la %', v_tt; end if;
  select count(*) into v_n from notifications where user_id = v_gvcn and title like '%gửi mục tiêu chờ duyệt' and created_at > now() - interval '5 seconds';
  if v_n <> 2 then raise exception 'CA6: GVCN nhan % thong bao gui (mong 2 — lan gui lai sau khi sua)', v_n; end if;

  -- CA7: em sửa nội dung khi ĐANG 'gui' → không báo thêm (vẫn 2)
  update muc_tieu set ten = 'TEST0192 doc 6 quyen sach' where id = v_mt;
  select count(*) into v_n from notifications where user_id = v_gvcn and title like '%gửi mục tiêu chờ duyệt' and created_at > now() - interval '5 seconds';
  if v_n <> 2 then raise exception 'CA7: sua khi dang gui ma bao them (%)', v_n; end if;
end $$;

rollback;
