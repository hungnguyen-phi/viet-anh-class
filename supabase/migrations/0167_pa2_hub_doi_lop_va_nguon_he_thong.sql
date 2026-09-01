-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0167 — PA2: Hub trên `luot`, đổi lớp mang mục tiêu/việc/cam kết theo em, nguồn HỆ THỐNG từ điểm danh.
-- Chủ dự án 01/09/2026: xây thẳng PA2, không song song, không di trú. Đặc tả: docs/PA2/ (10 §5–§6).
--
-- VÌ SAO tệp này gom ba việc lại một chỗ: cả ba đều là "chỗ nối mô hình mục tiêu mới ra thế giới đã có".
--  (1) Hub: lượt của em (bảng `luot`) phải chảy về os.truongvietanh.com y như tick cũ chảy từ
--      `lead_progress` — cùng event_type, cùng 6 trường, THÊM `nguoi_ghi`; lọc bỏ kiêng/số-đo/điểm-danh
--      (điểm danh đã đi đường riêng, không đếm đôi). Trigger cũ trên `lead_progress` vẫn sống tới 0168.
--  (2) Điểm danh: MỘT buổi có mặt = MỘT lượt cho thước `cach_ghi='he_thong'`, và % chuyên cần đổ vào
--      `so_do` của mục tiêu `nguon_so='he_thong'`. Idempotent theo `nguon_ref = attendance_records.id`;
--      sửa điểm danh (có mặt → vắng) thì rút lượt. Phần phụ, KHÔNG được làm rớt cú điểm danh (bọc warning).
--  (3) Đổi lớp / rời lớp: khi em sang lớp khác, mục tiêu · việc · cam kết ĐANG MỞ của em đi theo em
--      (kể cả `campus_id` khi khác cơ sở); nhóm ở lớp cũ tắt thành viên. GIỮ NGUYÊN khối kiểm quyền +
--      4 câu của bản 0160 (đã áp production) — chỉ NỐI THÊM, đọc pg_proc thật trước khi đè (md5 guard).
--
-- Tệp CHỈ THÊM/ĐÈ hàm-của-mình — không đụng đối tượng mô hình cũ (drop ở 0168). Phụ thuộc 0162–0166.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;

-- ──────────────────────────────────────────────────────────────────────────────────────────────
-- 0. GUARD md5 — bản đang chạy phải KHỚP bản đã đọc pg_proc 01/09/2026 (đọc LIVE, không tin đặc tả):
--    · apply_class_transfer  = 05006947b843899526c242e4de62f07b  (bản 0160 va_chuyen_lop_kiem_quyen)
--    · unenroll_student      = 2bb6c126b5e67240aacb35cf558bb597  (bản 0151)
--    (Đặc tả 50-DI-TRU §1.3 ghi md5 apply = c30ee9da… — SAI/cũ; giá trị dưới là md5 THẬT của production.)
--    Chạy lại tệp: md5 đã là bản PA2 → chỉ notice, đè lại y nguyên. Lệch cả hai → dừng, đọc lại pg_proc.
-- ──────────────────────────────────────────────────────────────────────────────────────────────
do $guard$
declare v text := md5(pg_get_functiondef('public.apply_class_transfer(uuid,uuid)'::regprocedure));
begin
  if v = 'b361f6f2cf815eb72fe06d08ee1ec287' then
    raise notice '0167: apply_class_transfer đã là bản PA2 — đè lại y nguyên';
  elsif v <> '05006947b843899526c242e4de62f07b' then
    raise exception '0167: apply_class_transfer trên production đã khác bản đã đọc 01/09 (md5=%) — đọc lại pg_proc trước khi đè', v;
  end if;
end $guard$;

do $guard$
declare v text := md5(pg_get_functiondef('public.unenroll_student(uuid,uuid)'::regprocedure));
begin
  if v = 'a0165a351ec68ac1585fbdc142e14dd9' then
    raise notice '0167: unenroll_student đã là bản PA2 — đè lại y nguyên';
  elsif v <> '2bb6c126b5e67240aacb35cf558bb597' then
    raise exception '0167: unenroll_student trên production đã khác bản đã đọc 01/09 (md5=%) — đọc lại pg_proc trước khi đè', v;
  end if;
end $guard$;

-- ──────────────────────────────────────────────────────────────────────────────────────────────
-- 1. HUB — `private.hub_hang_doi_luot` trên `luot` (thay vai trò của trg_hub_hang_doi_tick cũ)
--    Chỉ AFTER INSERT: sửa/xoá lượt KHÔNG sinh sự kiện (như hôm nay). Payload là BẢN KÝ duy nhất
--    (50-DI-TRU §5): 6 trường cũ giữ tên+nghĩa + `nguoi_ghi`. `area` được null (không dây, hoặc 'khac').
--    Lọc bỏ ngay trong SQL (bóc rổ đỏ, kỷ luật 0157): lượt cả đội, lượt hệ thống (điểm danh đã đi
--    đường diem_danh.danh_dau — không đếm đôi), gia_tri ≤ 0 ("có làm được 0" ≠ một lần làm), thước
--    kiêng (`nhieu_nhat`), thước số-đo (`gop='moi_nhat'`), thước máy (`cach_ghi='he_thong'`).
--    Không tên/email học sinh: chỉ tên THƯỚC (do thầy cô đặt), lĩnh vực, ngày, số. `unique(source_table,
--    source_id)` cho hai trigger cũ ('lead_progress') / mới ('luot') sống chung tới 0168.
-- ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.hub_hang_doi_luot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
  v_ten   text;
  v_chieu text;
  v_gop   text;
  v_cach  text;
  v_area  text;
begin
  if new.student_id is null then return new; end if;                  -- lượt cả đội: không gắn em
  if new.nguon = 'he_thong' then return new; end if;                  -- điểm danh đi đường diem_danh.danh_dau
  if new.gia_tri is null or new.gia_tri <= 0 then return new; end if; -- 0 = "có làm được 0", không phải một lần làm

  select t.class_id, t.ten, t.chieu_dich, t.gop, t.cach_ghi
    into v_class, v_ten, v_chieu, v_gop, v_cach
  from thuoc t where t.id = new.thuoc_id;
  if v_class is null then return new; end if;                         -- không đủ dữ liệu dựng sự kiện
  if v_chieu = 'nhieu_nhat' or v_gop = 'moi_nhat' or v_cach = 'he_thong' then
    return new;                                                       -- kiêng / số-đo / máy: không gửi
  end if;

  -- Lĩnh vực lấy theo DÂY: gop_so trước, chi_huong sau (created_at sớm nhất); mục tiêu 'khac' → null.
  select case when m.linh_vuc::text in ('knowledge','leadership_skills','character','physical_wellbeing')
              then m.linh_vuc::text end
    into v_area
  from noi n join muc_tieu m on m.id = n.cha_id
  where n.con_thuoc_id = new.thuoc_id
  order by case n.vai when 'gop_so' then 0 else 1 end, n.created_at
  limit 1;

  insert into hub_event_outbox (event_type, source_table, source_id, payload)
  values (
    'viec_dan_dat.tick',
    'luot',
    new.id,
    jsonb_build_object(
      'student_id',  new.student_id,
      'class_id',    v_class,
      'area',        v_area,            -- có thể là JSON null: hợp đồng Hub mới nhận null (50 §5 dòng 5)
      'lead_title',  v_ten,
      'logged_date', new.ngay,
      'value',       new.gia_tri,
      'nguoi_ghi',   new.nguoi_ghi      -- MỚI: uuid người bấm (= em khi tự ghi, thầy cô khi ghi hộ)
    )
  )
  on conflict (source_table, source_id) do nothing;

  return new;
exception
  -- Phần PHỤ (báo Hub) không được làm rớt cú ghi lượt (phần CHÍNH đã xảy ra — AFTER INSERT). Mẫu 0157:93-98.
  when others then
    raise warning 'hub_hang_doi_luot: %', sqlerrm;
    return new;
end;
$$;
revoke all on function private.hub_hang_doi_luot() from public, anon, authenticated;
drop trigger if exists trg_hub_hang_doi_luot on luot;
create trigger trg_hub_hang_doi_luot
  after insert on luot
  for each row execute function private.hub_hang_doi_luot();

-- ──────────────────────────────────────────────────────────────────────────────────────────────
-- 2. NGUỒN HỆ THỐNG — `private.nguon_he_thong_diem_danh` trên `attendance_records`
--    Ghi điểm danh chạy trong PHIÊN thầy cô (uid ≠ null) qua mark_attendance(_on). Trigger này mở
--    cờ `va.nguon_he_thong='1'` để luot_truoc_ghi/so_do_truoc_ghi biết "máy ghi trong phiên người"
--    (khe hẹp 0155 — ép nguoi_ghi := null, bỏ qua chặn ghi-tay). Idempotent theo nguon_ref = bản ghi
--    điểm danh; sửa điểm danh (present/late → khác) thì rút lượt. KHÔNG đổi RLS attendance_records.
--    KHÔNG liên quan hợp đồng Hub (lượt he_thong bị hub_hang_doi_luot lọc bỏ) — không chờ [H-03].
-- ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.nguon_he_thong_diem_danh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_pct numeric;
begin
  perform set_config('va.nguon_he_thong', '1', true);

  -- (a) Thước he_thong: một bản ghi CÓ MẶT (present/late) = một lượt; sửa về vắng thì rút lượt.
  if new.status in ('present', 'late') then
    for r in
      select t.id from thuoc t
      where t.cach_ghi = 'he_thong' and t.nguon_he_thong = 'diem_danh'
        and t.trang_thai = 'chay' and t.pham_vi = 'tung_em' and t.class_id = new.class_id
        and exists (select 1 from enrollments e
                    where e.class_id = t.class_id and e.student_id = new.student_id and e.is_active)
    loop
      insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon, nguon_ref)
      values (r.id, new.student_id, new.date, 1, null, 'he_thong', new.id)
      on conflict (thuoc_id, student_id, ngay) where nguon = 'he_thong' do nothing;
    end loop;
  elsif tg_op = 'UPDATE' and old.status in ('present', 'late') and new.status not in ('present', 'late') then
    delete from luot where nguon = 'he_thong' and nguon_ref = new.id;
  end if;

  -- (b) Mục tiêu he_thong (chuyên cần): upsert số đọc = % có mặt từ bat_dau tới ngày này (cả present/vắng).
  for r in
    select m.id, m.cap, m.class_id, m.campus_id, m.bat_dau from muc_tieu m
    where m.nguon_so = 'he_thong' and m.nguon_he_thong = 'diem_danh' and m.trang_thai = 'duyet'
      and ((m.cap = 'lop'    and m.class_id = new.class_id)
        or (m.cap = 'truong' and m.campus_id = (select campus_id from classes where id = new.class_id)))
  loop
    select round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*), 0), 1)
      into v_pct
    from attendance_records a join classes c on c.id = a.class_id
    where a.date between r.bat_dau and new.date
      and ((r.cap = 'lop' and a.class_id = r.class_id) or (r.cap = 'truong' and c.campus_id = r.campus_id));
    if v_pct is not null then
      insert into so_do (muc_tieu_id, ngay, gia_tri, nguon, nguon_ref, nguoi_ghi)
      values (r.id, new.date, v_pct, 'he_thong', new.id, null)
      on conflict (muc_tieu_id, ngay) where nguon = 'he_thong' and thanh_phan_id is null and student_id is null
      do update set gia_tri = excluded.gia_tri;
    end if;
  end loop;

  perform set_config('va.nguon_he_thong', '', true);
  return new;
exception
  -- Phần phụ không được làm rớt điểm danh (phần chính đã ghi — AFTER). Đóng cờ rồi cho qua.
  when others then
    perform set_config('va.nguon_he_thong', '', true);
    raise warning 'nguon_he_thong_diem_danh: %', sqlerrm;
    return new;
end;
$$;
revoke all on function private.nguon_he_thong_diem_danh() from public, anon, authenticated;
drop trigger if exists trg_nguon_he_thong_diem_danh on attendance_records;
create trigger trg_nguon_he_thong_diem_danh
  after insert or update on attendance_records
  for each row execute function private.nguon_he_thong_diem_danh();

-- ──────────────────────────────────────────────────────────────────────────────────────────────
-- 3. ĐỔI LỚP — `public.apply_class_transfer` bản HỢP NHẤT (chốt C20)
--    GIỮ NGUYÊN khối kiểm quyền + 4 câu của 0160 (enrollments/buddy_pairs/pdr_schedules/insert),
--    CHÈN THÊM giữa "tắt pdr_schedules" và "insert enrollments": mục tiêu/việc/cam kết đang mở của
--    em đi theo em; nhóm lớp cũ tắt thành viên. Cờ `va.doi_lop='1'` báo trigger nội dung biết đây là
--    đổi lớp (class_id/campus_id là whitelist "không phải nội dung"). KHÔNG đụng `noi` — màn suy "góp
--    vào lớp cũ" từ cha.class_id <> con.class_id. KHÔNG trigger trên enrollments (bài học 0155).
-- ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_class_transfer(p_student uuid, p_to_class uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- ② Phòng thân (GIỮ NGUYÊN 0160): chỉ quản trị / GVCN lớp nhận / hiệu trưởng cơ sở lớp nhận.
  if not (
    auth_role() = 'admin'
    or is_class_teacher(p_to_class)
    or exists (select 1 from classes c where c.id = p_to_class
               and auth_role() = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp nhận (hoặc quản trị) mới chuyển lớp được'
      using errcode = '42501';
  end if;

  -- 4 câu GIỮ NGUYÊN của 0160:
  update enrollments set is_active = false, is_attendance_leader = false
  where student_id = p_student and is_active and class_id <> p_to_class;

  update buddy_pairs set is_active = false
    where is_active and class_id <> p_to_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id <> p_to_class and student_id = p_student;

  -- ── PA2: dữ liệu mục tiêu ĐANG MỞ của em đi theo em ────────────────────────────────────────
  perform set_config('va.doi_lop', '1', true);

  -- Mục tiêu cấp em còn sống (chưa đóng): đổi lớp, và đổi cả cơ sở khi lớp nhận khác cơ sở (để
  -- predicate BGH/cơ sở mới đọc đúng). Mục tiêu đã 'dong' là lịch sử của lớp cũ — đứng yên.
  update muc_tieu set class_id = p_to_class,
         campus_id = (select campus_id from classes where id = p_to_class)
    where cap = 'em' and student_id = p_student
      and class_id is distinct from p_to_class and trang_thai <> 'dong';

  -- Việc của em còn sống: đổi lớp (thuoc không có campus_id, quyền suy từ class_id).
  update thuoc set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student
      and class_id <> p_to_class and trang_thai <> 'dong';

  -- Cam kết của em CHƯA CHẤM và tuần cuối CHƯA QUA: đi theo. Cam kết đã chấm = lịch sử lớp cũ, đứng yên.
  update cam_ket set class_id = p_to_class
    where chu_the = 'em' and student_id = p_student and class_id <> p_to_class
      and trang_thai = 'hieu_luc' and ket_qua is null
      and tuan_bat_dau + (so_tuan * 7) - 1 >= vn_today();          -- tuần cuối còn chưa qua

  -- Nhóm ở lớp KHÁC lớp nhận: tắt tư cách thành viên (nhóm là của lớp cũ).
  update nhom_thanh_vien v set is_active = false
    from nhom n where n.id = v.nhom_id and v.student_id = p_student
      and v.is_active and n.class_id <> p_to_class;

  perform set_config('va.doi_lop', '', true);
  -- Dây `noi` lên mục tiêu LỚP CŨ giữ nguyên — màn suy "góp vào lớp cũ" từ cha.class_id <> con.class_id.

  insert into enrollments (class_id, student_id, is_active)
  values (p_to_class, p_student, true)
  on conflict (class_id, student_id) do update set is_active = true;
end;
$function$;

-- Thu hồi execute khỏi mọi vai PostgREST (bản vá 0160 giữ nguyên). Chủ hàm vẫn chạy → request/decide sống.
revoke all on function public.apply_class_transfer(uuid, uuid) from public, anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────────────────────
-- 4. RỜI LỚP — `public.unenroll_student` MỞ RỘNG (GIỮ NGUYÊN kiểm quyền + 3 câu của 0151)
--    Rời hẳn một lớp (không sang lớp mới ngay): nhóm của lớp đó tắt thành viên; việc của em ở lớp
--    này TẠM DỪNG (không đóng hẳn — vào lớp mới còn chạy tiếp). Cùng cờ va.doi_lop như đổi lớp.
--    KHÔNG đụng mục tiêu/cam kết (chưa biết em đi đâu — chờ apply_class_transfer khi có lớp nhận).
-- ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.unenroll_student(p_class uuid, p_student uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền';
  end if;

  update enrollments set is_active = false, is_attendance_leader = false
    where class_id = p_class and student_id = p_student;
  update buddy_pairs set is_active = false
    where is_active and class_id = p_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id = p_class and student_id = p_student;

  -- ── PA2: rời lớp → nhóm lớp này tắt thành viên; việc của em ở lớp này tạm dừng ───────────────
  perform set_config('va.doi_lop', '1', true);
  update nhom_thanh_vien v set is_active = false
    from nhom n where n.id = v.nhom_id and v.student_id = p_student
      and v.is_active and n.class_id = p_class;
  update thuoc set trang_thai = 'tam_dung'
    where chu_the = 'em' and student_id = p_student and class_id = p_class and trang_thai = 'chay';
  perform set_config('va.doi_lop', '', true);
end;
$function$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ĐƯỜNG LÙI (§8) — thân CŨ của hai hàm public (để `scripts/pa2-lui-nen.sql` đè về, so md5 sau khi đè):
--
--   public.apply_class_transfer (bản 0160, md5 05006947b843899526c242e4de62f07b): khối guard 42501 +
--     update enrollments(is_active=false,is_attendance_leader=false where student_id=p_student and
--     is_active and class_id<>p_to_class) + update buddy_pairs + update pdr_schedules + insert
--     enrollments on conflict do update set is_active=true. KHÔNG có khối va.doi_lop.
--
--   public.unenroll_student (bản 0151, md5 2bb6c126b5e67240aacb35cf558bb597): khối guard 'Không có
--     quyền' + update enrollments + update buddy_pairs + update pdr_schedules. KHÔNG có khối va.doi_lop.
--
-- (Bản đầy đủ đọc được ở supabase/migrations/0160_va_chuyen_lop_kiem_quyen.sql và 0151_audit_va_lo_tang_db.sql.)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
