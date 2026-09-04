-- 0189 — HIỆU NĂNG: MỖI TRANG MỘT LƯỢT ĐI CSDL (đo 04/09/2026 sau 0187)
--
-- Đo được gì (production, lúc yên):
--   · Thời gian THUẦN CSDL của các RPC khi ấm: thi_dua_lop 2 ms, bang_lop_em 14 ms, viec_bang 0 ms,
--     muc_tieu_v 1–6 ms; lạnh 100–170 ms. Nhưng qua PostgREST trung bình 450–550 ms/lượt.
--   · /wig gọi ~14 câu, /student ~20 câu mỗi lần dựng; PostgREST chỉ có 11 kết nối, work_mem 2 MB,
--     1 worker. 10 người mở cùng lúc = 150–200 câu chen 11 kết nối → 7–9 s; 20 người → 12–15 s.
--   → Nút thắt KHÔNG phải tính toán mà là SỐ LƯỢT đi-về + plan lạnh mỗi kết nối. Chữa gốc: gộp
--     mỗi trang thành MỘT hàm trả jsonb, CSDL làm hết trong một kết nối với plan ấm.
--
-- Hai hàm dưới là SECURITY INVOKER: mọi bảng/khung nhìn đọc bên trong đi qua RLS y hệt khi trang
-- gọi từng câu (đã đối chiếu pg_policies 04/09: luot, noi, buoc, thuoc, thuoc_lich_su, mood_checkins,
-- pdr_meetings, buddy_pairs, pdr_schedules, tuan_hoc, muc_tieu_mau, enrollments, don_vi đều có
-- policy SELECT). Các RPC SECDEF gọi bên trong (thi_dua_lop, bang_lop_thuoc, bang_ron, viec_bang,
-- muc_tieu_lich_su_tuan_nhieu, thuoc_12_tuan_nhieu) tự gác quyền như cũ.
-- Khoá jsonb đặt đúng tên biến trang đang dùng để code chỉ đổi phần ĐỌC, không đổi JSX.
-- Không đè hàm nào đang có. Luật 0187: hàm public mới phải grant execute đích danh.

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 1. trang_wig — tầng 2 + tầng 3 của /wig trong một lượt
-- ═════════════════════════════════════════════════════════════════════════════════════
create or replace function public.trang_wig(
  p_class uuid,
  p_tuan date,                 -- thứ Hai tuần đang xem
  p_toi uuid default null,     -- id thầy cô đang xem (GVCN) → thêm khu "Mục tiêu của tôi"; null = không
  p_campus uuid default null,  -- cơ sở của lớp (mục tiêu trường)
  p_so_tuan integer default 8  -- lịch sử bao nhiêu tuần
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_ket date := p_tuan + 6;
  j jsonb := '{}'::jsonb;
  v_mt jsonb; v_mt_toi jsonb; v_truong jsonb;
  v_ids uuid[]; v_ids_toi uuid[]; v_ids_truong uuid[]; v_ke uuid[]; v_ls uuid[];
begin
  if (select auth.uid()) is null then return null; end if;

  -- muc_tieu_v ba lượt (lớp · tôi · trường) — cột đúng MT_COLS + vài cột thẻ trường cần.
  select coalesce(jsonb_agg(to_jsonb(m) - 'nguon' - 'ngay_nguon' - 'so_nguon' - 'x' - 'y' - 'ky_tu' - 'ky_den'
                                        - 'so_ky_giu' - 'so_ky_xet' - 'tu_so' - 'mau_so' - 'nam_hoc' - 'chu_the_key'
                                        - 'nguon_he_thong' - 'gop_con' - 'gop_thanh_phan' - 'nguong_con' - 'lay_tu' - 'mau_id'
                                        - 'duyet_boi' - 'duyet_at' - 'dong_boi' - 'dong_at' - 'ly_do_dong' - 'nguoi_nhap_ho'
                                        - 'created_by' - 'created_at' - 'updated_at' - 'bat_dau' - 'campus_id' - 'nhom_id' - 'cap'
                                        - 'class_id' order by m.created_at), '[]'::jsonb),
         coalesce(array_agg(m.id), '{}'::uuid[]),
         coalesce(array_agg(m.id) filter (where m.loai_moc = 'ke_hoach'), '{}'::uuid[]),
         coalesce(array_agg(m.id) filter (where m.pct is not null or m.so is not null), '{}'::uuid[])
    into v_mt, v_ids, v_ke, v_ls
  from muc_tieu_v m where m.class_id = p_class and m.cap = 'lop' and m.trang_thai <> 'dong';

  if p_toi is not null then
    select coalesce(jsonb_agg(to_jsonb(m) - 'nguon' - 'ngay_nguon' - 'so_nguon' - 'x' - 'y' - 'ky_tu' - 'ky_den'
                                          - 'so_ky_giu' - 'so_ky_xet' - 'tu_so' - 'mau_so' - 'nam_hoc' - 'chu_the_key'
                                          - 'nguon_he_thong' - 'gop_con' - 'gop_thanh_phan' - 'nguong_con' - 'lay_tu' - 'mau_id'
                                          - 'duyet_boi' - 'duyet_at' - 'dong_boi' - 'dong_at' - 'ly_do_dong' - 'nguoi_nhap_ho'
                                          - 'created_by' - 'created_at' - 'updated_at' - 'bat_dau' - 'campus_id' - 'nhom_id' - 'cap'
                                          - 'class_id' order by m.created_at), '[]'::jsonb),
           coalesce(array_agg(m.id), '{}'::uuid[]),
           v_ls || coalesce(array_agg(m.id) filter (where m.pct is not null or m.so is not null), '{}'::uuid[])
      into v_mt_toi, v_ids_toi, v_ls
    from muc_tieu_v m where m.class_id = p_class and m.cap = 'em' and m.student_id = p_toi and m.trang_thai <> 'dong';
  else
    v_mt_toi := null; v_ids_toi := '{}'::uuid[];
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ten', m.ten, 'don_vi_id', m.don_vi_id, 'ten_don_vi', m.ten_don_vi,
                                               'so', m.so, 'y_so', m.y_so) order by m.created_at), '[]'::jsonb),
         coalesce(array_agg(m.id), '{}'::uuid[])
    into v_truong, v_ids_truong
  from muc_tieu_v m where m.campus_id = p_campus and m.cap = 'truong' and m.trang_thai = 'duyet';

  j := jsonb_build_object(
    'thiDua',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.thi_dua_lop(p_class) x),
    'mtRows',    v_mt,
    'mtToiRows', v_mt_toi,
    'truongRows', v_truong,
    'thuocRows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.bang_lop_thuoc(p_class, p_tuan) x),
    'ckRows',    case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'noi_dung', c.noi_dung, 'so_hua', c.so_hua, 'so_dat', c.so_dat,
                     'ket_qua', c.ket_qua, 'ten_don_vi', c.ten_don_vi, 'muc_tieu_id', c.muc_tieu_id, 'thuoc_id', c.thuoc_id,
                     'tuan_bat_dau', c.tuan_bat_dau, 'tuan_ket_thuc', c.tuan_ket_thuc, 'so_tuan', c.so_tuan, 'trang_thai', c.trang_thai)), '[]'::jsonb)
                   from cam_ket_v c where c.class_id = p_class and c.chu_the = 'em' and c.student_id = p_toi and c.trang_thai <> 'huy') end,
    'enrolled',  (select coalesce(jsonb_agg(jsonb_build_object('student_id', e.student_id, 'profiles', jsonb_build_object('full_name', p.full_name))), '[]'::jsonb)
                   from enrollments e join profiles p on p.id = e.student_id where e.class_id = p_class and e.is_active),
    'mtCho',     (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ten', m.ten, 'linh_vuc', m.linh_vuc, 'student_id', m.student_id,
                     'x_so', m.x_so, 'y_so', m.y_so, 'ten_don_vi', m.ten_don_vi, 'ket_thuc', m.ket_thuc)), '[]'::jsonb)
                   from muc_tieu_v m where m.class_id = p_class and m.cap = 'em' and m.trang_thai = 'gui'),
    'haCho',     (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'thuoc_id', l.thuoc_id, 'chi_tieu_ky', l.chi_tieu_ky, 'la_ha', l.la_ha,
                     'thuoc', jsonb_build_object('ten', t.ten, 'class_id', t.class_id, 'student_id', t.student_id, 'chi_tieu_ky', t.chi_tieu_ky))), '[]'::jsonb)
                   from thuoc_lich_su l join thuoc t on t.id = l.thuoc_id where l.trang_thai = 'cho_duyet' and t.class_id = p_class),
    'thuocToiRows', case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ten', t.ten, 'cach_ghi', t.cach_ghi, 'chi_tieu_ky', t.chi_tieu_ky,
                     'ngay_ap_dung', t.ngay_ap_dung, 'don_vi_id', t.don_vi_id, 'cam_ket_id', t.cam_ket_id) order by t.created_at), '[]'::jsonb)
                   from thuoc t where t.class_id = p_class and t.student_id = p_toi and t.cam_ket_id is not null and t.trang_thai <> 'dong') end,
    'luotRows',  case when p_toi is null then null else (
                   select coalesce(jsonb_agg(jsonb_build_object('thuoc_id', l.thuoc_id, 'ngay', l.ngay, 'gia_tri', l.gia_tri)), '[]'::jsonb)
                   from luot l where l.student_id = p_toi and l.ngay between p_tuan and v_ket) end,
    -- tầng 3
    'buocRows',  (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'muc_tieu_id', b.muc_tieu_id, 'tieu_de', b.tieu_de,
                     'phan_tram', b.phan_tram, 'xong_at', b.xong_at) order by b.thu_tu), '[]'::jsonb)
                   from buoc b where b.muc_tieu_id = any(v_ke)),
    'noiRows',   (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_thuoc_id', n.con_thuoc_id)), '[]'::jsonb)
                   from noi n where n.cha_id = any(v_ids) and n.vai = 'gop_so' and n.con_thuoc_id is not null),
    'noiToiRows', (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_muc_tieu_id', n.con_muc_tieu_id, 'vai', n.vai)), '[]'::jsonb)
                   from noi n where n.con_muc_tieu_id = any(v_ids_toi)),
    'noiTruongRows', (select coalesce(jsonb_agg(jsonb_build_object('cha_id', n.cha_id, 'con_muc_tieu_id', n.con_muc_tieu_id, 'vai', n.vai)), '[]'::jsonb)
                   from noi n where n.cha_id = any(v_ids_truong) and n.con_muc_tieu_id = any(v_ids)),
    'lichSu',    (select coalesce(jsonb_agg(jsonb_build_object('muc_tieu_id', l.muc_tieu_id, 'tuan_ket', l.tuan_ket, 'so', l.so)), '[]'::jsonb)
                   from public.muc_tieu_lich_su_tuan_nhieu(v_ls, p_so_tuan) l)
  );
  return j;
end $$;
revoke execute on function public.trang_wig(uuid, date, uuid, uuid, integer) from public, anon;
grant execute on function public.trang_wig(uuid, date, uuid, uuid, integer) to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════════════
-- 2. trang_student — đợt 1 + đợt 2 của /student trong một lượt (trừ 3 câu khoá dịch vụ
--    và edit_requests theo người xem — vẫn ở trang, chạy song song với lượt này)
-- ═════════════════════════════════════════════════════════════════════════════════════
create or replace function public.trang_student(
  p_student uuid,
  p_tuan date,                 -- thứ Hai tuần đang xem
  p_hom_nay date,              -- hôm nay theo giờ VN (mood check-in)
  p_nhan_tuan text             -- nhãn tuần ISO (pdr_meetings.week_label)
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_class uuid; v_campus uuid; v_ket date := p_tuan + 6;
  v_thuoc uuid[]; v_ke uuid[]; v_cap uuid[]; v_ban uuid[];
  j jsonb;
begin
  if (select auth.uid()) is null then return null; end if;

  select e.class_id, c.campus_id into v_class, v_campus
  from enrollments e join classes c on c.id = e.class_id
  where e.student_id = p_student and e.is_active order by e.class_id limit 1;

  select coalesce(array_agg(v.thuoc_id), '{}'::uuid[]) into v_thuoc from public.viec_bang(p_student) v;
  select coalesce(array_agg(m.id) filter (where m.loai_moc = 'ke_hoach'), '{}'::uuid[]) into v_ke
    from muc_tieu m where m.student_id = p_student and m.cap = 'em';
  select coalesce(array_agg(b.id), '{}'::uuid[]),
         coalesce(array_agg(case when b.student_id = p_student then b.buddy_id else b.student_id end), '{}'::uuid[])
    into v_cap, v_ban
    from buddy_pairs b where b.is_active and (b.student_id = p_student or b.buddy_id = p_student);

  j := jsonb_build_object(
    'student',   (select to_jsonb(x) from (select id, full_name, email from profiles where id = p_student) x),
    'enr',       (select to_jsonb(x) from (
                    select e.class_id, jsonb_build_object('name', c.name, 'school_year', c.school_year, 'campus_id', c.campus_id) as classes
                    from enrollments e join classes c on c.id = e.class_id
                    where e.student_id = p_student and e.is_active order by e.class_id limit 1) x),
    'moodRow',   (select coalesce(jsonb_agg(jsonb_build_object('mood', mood, 'buoi', buoi, 'created_at', created_at)), '[]'::jsonb)
                   from mood_checkins where student_id = p_student and date = p_hom_nay),
    'bangRon',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.bang_ron(p_student) x),
    'mucTieu',   (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb) from muc_tieu_v m where m.student_id = p_student and m.cap = 'em'),
    'viec',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.viec_bang(p_student) x),
    'camKet',    (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'noi_dung', c.noi_dung, 'trang_thai', c.trang_thai, 'ket_qua', c.ket_qua,
                     'so_hua', c.so_hua, 'so_dat', c.so_dat, 'ten_don_vi', c.ten_don_vi, 'so_tuan', c.so_tuan, 'tuan_bat_dau', c.tuan_bat_dau,
                     'tuan_ket_thuc', c.tuan_ket_thuc, 'xong_at', c.xong_at, 'goi_y_may', c.goi_y_may, 'so_dat_goi_y', c.so_dat_goi_y,
                     'muc_tieu_id', c.muc_tieu_id, 'thuoc_id', c.thuoc_id, 'lac_muc_tieu', c.lac_muc_tieu)), '[]'::jsonb)
                   from cam_ket_v c where c.student_id = p_student and c.trang_thai <> 'huy'),
    'donVi',     (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ma', ma, 'nhan_vi', nhan_vi, 'nhan_en', nhan_en) order by ma), '[]'::jsonb)
                   from don_vi where is_active),
    'pdrBuddy',  (select to_jsonb(x) from (select id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at
                   from pdr_meetings where student_id = p_student and type = 'buddy' and week_label = p_nhan_tuan limit 1) x),
    'pdrCoach',  (select to_jsonb(x) from (select id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at
                   from pdr_meetings where student_id = p_student and type = 'coach' and week_label = p_nhan_tuan limit 1) x),
    'cap',       (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'student_id', student_id, 'buddy_id', buddy_id) order by created_at), '[]'::jsonb)
                   from buddy_pairs where is_active and (student_id = p_student or buddy_id = p_student)),
    'lichCoach', (select to_jsonb(x) from (select monthly_day from pdr_schedules where student_id = p_student and type = 'coach' and is_active limit 1) x),
    -- đợt 2
    'luot',      (select coalesce(jsonb_agg(jsonb_build_object('thuoc_id', thuoc_id, 'ngay', ngay, 'gia_tri', gia_tri)), '[]'::jsonb)
                   from luot where thuoc_id = any(v_thuoc) and student_id = p_student and ngay between p_tuan and v_ket),
    'noi',       (select coalesce(jsonb_agg(jsonb_build_object('cha_id', cha_id, 'con_thuoc_id', con_thuoc_id)), '[]'::jsonb)
                   from noi where vai = 'gop_so' and con_thuoc_id = any(v_thuoc)),
    'tuanHoc',   (select to_jsonb(x) from (select loai from tuan_hoc where campus_id = v_campus and week_start = p_tuan limit 1) x),
    'mucTieuLop', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ten', m.ten, 'linh_vuc', m.linh_vuc, 'loai_moc', m.loai_moc, 'pct', m.pct,
                     'so', m.so, 'y_so', m.y_so, 'don_vi_id', m.don_vi_id, 'ten_don_vi', m.ten_don_vi, 'ket_thuc', m.ket_thuc)), '[]'::jsonb)
                   from muc_tieu_v m where m.class_id = v_class and m.cap = 'lop' and m.trang_thai = 'duyet'),
    'mau',       (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ten', ten, 'linh_vuc', linh_vuc, 'subject_id', subject_id, 'don_vi_id', don_vi_id,
                     'kieu_dich', kieu_dich, 'chieu', chieu, 'x_goi_y', x_goi_y, 'y_goi_y', y_goi_y) order by created_at), '[]'::jsonb)
                   from muc_tieu_mau where class_id = v_class and is_active),
    'tenBuddy',  (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'email', email)), '[]'::jsonb)
                   from profiles where id = any(v_ban)),
    'lichBuddy', (select to_jsonb(x) from (select weekday, time_slot from pdr_schedules where buddy_pair_id = any(v_cap) and is_active limit 1) x),
    'buoc',      (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'muc_tieu_id', muc_tieu_id, 'tieu_de', tieu_de, 'phan_tram', phan_tram,
                     'bat_dau', bat_dau, 'ket_thuc', ket_thuc, 'mo_ta', mo_ta, 'xong_at', xong_at) order by thu_tu), '[]'::jsonb)
                   from buoc where muc_tieu_id = any(v_ke)),
    'tuan12',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.thuoc_12_tuan_nhieu(v_thuoc, p_student, p_tuan) x)
  );
  return j;
end $$;
revoke execute on function public.trang_student(uuid, date, date, text) from public, anon;
grant execute on function public.trang_student(uuid, date, date, text) to authenticated, service_role;
