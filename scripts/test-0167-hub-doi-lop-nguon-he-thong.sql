-- KIỂM 0167 — HUB trên `luot`, ĐỔI/RỜI LỚP mang mục tiêu/việc/cam kết, NGUỒN HỆ THỐNG từ điểm danh.
--
--   npm run sql -- scripts/test-0167-hub-doi-lop-nguon-he-thong.sql   (chạy SAU khi apply 0162→0167)
--
-- Luật chỉ nằm trong giao diện thì không phải luật: bài này dựng cả đường THUẬN lẫn CHIỀU NGƯỢC cho
-- từng CHỐT MỚI của 0167, chạy thẳng trên production rồi ROLLBACK nên không để lại gì. "Chưa vá phải
-- ĐỎ": CHỐT CHẶN ở đầu raise ngay nếu 0167 (hoặc nền 0162→0166) chưa áp.
--
-- Cách cô lập trigger: mọi fixture tạo dưới vai postgres với auth.uid()=NULL — các trigger nghiệp vụ
-- (mt_truoc_them, ck_truoc_them, …) có chốt L6 `if v_me is null then return new` nên KHÔNG cản việc
-- gieo. Chỉ đặt claims.sub khi CẦN đúng vai: nối dây `gop_so` (noi_hop_le đòi uid≠null) và gọi hai
-- hàm definer apply_class_transfer/unenroll_student (đọc auth_role() theo claims). RLS bị bỏ qua vì
-- role vẫn là postgres — ta đang kiểm TRIGGER/HÀM, không kiểm RLS (RLS các bảng này kiểm ở 0163–0165).
--
--   Nhóm 1  hub_hang_doi_luot   — 1 thuận (area theo dây gop_so) + 6 ngược (lọc) + 1 area 'khac'→null
--   Nhóm 2  nguon_he_thong_diem_danh — có mặt→lượt, idempotent, sửa về vắng→rút lượt, % vào so_do
--   Nhóm 3  apply_class_transfer — mục tiêu/việc/cam kết MỞ đi theo; đã đóng/đã chấm đứng yên; guard
--   Nhóm 4  unenroll_student    — việc tạm dừng, nhóm tắt thành viên; guard

begin;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.thuoc') is null or to_regclass('public.luot') is null
     or to_regclass('public.muc_tieu') is null or to_regclass('public.noi') is null
     or to_regclass('public.cam_ket') is null or to_regclass('public.nhom') is null
     or to_regclass('public.nhom_thanh_vien') is null or to_regclass('public.so_do') is null
     or to_regclass('public.don_vi') is null then
    raise exception 'CHUA VA nền PA2 (0162–0165): thiếu bảng mục tiêu/việc/lượt — chạy các migration trước.';
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_hub_hang_doi_luot' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='trg_nguon_he_thong_diem_danh' and not tgisinternal) then
    raise exception 'CHUA VA 0167: thiếu trigger Hub/điểm danh — chạy migration 0167 trước.';
  end if;
  if pg_get_functiondef('public.apply_class_transfer(uuid,uuid)'::regprocedure) not like '%va.doi_lop%'
     or pg_get_functiondef('public.unenroll_student(uuid,uuid)'::regprocedure) not like '%va.doi_lop%' then
    raise exception 'CHUA VA 0167: apply_class_transfer/unenroll_student còn là bản 0160/0151 (thiếu khối va.doi_lop).';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;

-- ── Bối cảnh (id động — lấy từ lớp Test, không đóng cứng) ────────────────────────────────────
create temporary table bc on commit drop as
with t as (select id lop, campus_id cs, homeroom_teacher_id gvcn, school_year nam
           from classes where name='Test' and is_active limit 1)
select t.lop, t.cs, t.gvcn, t.nam,
  (select array_agg(sid order by sid) from (
     select e.student_id sid from enrollments e join profiles p on p.id=e.student_id
     where e.class_id=t.lop and e.is_active and p.role='student' order by e.student_id limit 4) z) em,
  (select p.id from profiles p where p.role='admin' limit 1) admin
from t;

do $$ declare v_lop uuid; v_n int; begin
  select lop into v_lop from bc;
  if v_lop is null then raise exception 'Không thấy lớp Test — không chạy được bài kiểm.'; end if;
  select coalesce(array_length(em,1),0) into v_n from bc;
  if v_n < 4 then raise exception 'Lớp Test cần ≥4 học sinh đang học (thấy %).', v_n; end if;
  if (select admin from bc) is null then raise exception 'Không thấy tài khoản admin.'; end if;
end $$;

-- ── Fixture dùng chung: một đơn vị nháp + một lớp ĐÍCH nháp (cùng cơ sở Test) ────────────────
create temporary table art (k text primary key, v uuid) on commit drop;
do $$
declare v_dv uuid; v_dest uuid; v_cs uuid; v_nam text; v_gvcn uuid;
begin
  select cs, nam, gvcn into v_cs, v_nam, v_gvcn from bc;
  insert into don_vi (ma, nhan_vi, nhan_en) values ('thu_0167', 'thử', 'test') returning id into v_dv;
  insert into classes (campus_id, name, school_year, homeroom_teacher_id, is_active)
    values (v_cs, 'ZZ-0167-đích', v_nam, v_gvcn, true) returning id into v_dest;  -- protect_class là UPDATE-only → INSERT tự do
  insert into art values ('don_vi', v_dv), ('dest', v_dest);
end $$;

-- ═══════════════════ NHÓM 1 — Hub `hub_hang_doi_luot` ═══════════════════════════════════════
-- Mỗi ca: gieo một lượt, đọc hub_event_outbox theo source_id = luot.id (cô lập tuyệt đối nhờ
-- unique(source_table, source_id)). Thuận = đúng 1 sự kiện + payload đúng; Ngược = 0 sự kiện.

do $$
declare
  v_lop uuid; v_dv uuid; v_e1 uuid;
  v_thN uuid; v_mtK uuid; v_luot uuid; v_row hub_event_outbox%rowtype; v_n int; v_gvcn uuid;
begin
  select lop, gvcn, em[1] into v_lop, v_gvcn, v_e1 from bc;
  select v into v_dv from art where k='don_vi';

  -- thước thường của em + mục tiêu nguồn 'thuoc' (để nối gop_so), lĩnh vực 'knowledge'
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e1, 'Đọc sách (thử Hub)', 'cham', v_dv, 1, 5, date '2026-08-31')
    returning id into v_thN;
  insert into muc_tieu (cap, campus_id, class_id, student_id, ten, linh_vuc, nguon_so, kieu_dich,
                        chua_do_x, y_so, don_vi_id, ket_thuc, trang_thai)
    values ('em', (select cs from bc), v_lop, v_e1, 'Mục tiêu đọc (thử)', 'knowledge', 'thuoc', 'toi',
            true, 30, v_dv, date '2027-06-30', 'gui')
    returning id into v_mtK;

  -- Nối dây gop_so (đòi uid≠null → đóng vai GVCN; noi_hop_le kiểm cha.nguon_so='thuoc' ✓)
  perform set_config('request.jwt.claims', json_build_object('sub', v_gvcn::text)::text, true);
  begin
    insert into noi (cha_id, con_thuoc_id, vai) values (v_mtK, v_thN, 'gop_so');
  exception when others then
    insert into kq values ('Hub: nối dây gop_so (tiền đề)', 'nối được', 'LỖI: '||sqlerrm, false);
  end;
  perform set_config('request.jwt.claims', '', true);

  -- THUẬN: lượt tay, gia_tri>0 → đúng 1 sự kiện; area='knowledge'; nguoi_ghi=em; value khớp
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon)
    values (v_thN, v_e1, date '2026-08-31', 3, v_e1, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_table='luot' and source_id=v_luot;
  if v_n = 1 then
    select * into v_row from hub_event_outbox where source_table='luot' and source_id=v_luot;
    insert into kq values ('Hub THUẬN: lượt tay sinh 1 sự kiện', '1', v_n::text, true);
    insert into kq values ('Hub THUẬN: event_type=viec_dan_dat.tick', 'viec_dan_dat.tick', v_row.event_type, v_row.event_type='viec_dan_dat.tick');
    insert into kq values ('Hub THUẬN: area theo dây gop_so = knowledge', 'knowledge', coalesce(v_row.payload->>'area','(null)'), v_row.payload->>'area'='knowledge');
    insert into kq values ('Hub THUẬN: nguoi_ghi = em', v_e1::text, coalesce(v_row.payload->>'nguoi_ghi','(null)'), (v_row.payload->>'nguoi_ghi')=v_e1::text);
    insert into kq values ('Hub THUẬN: value = 3', '3', v_row.payload->>'value', (v_row.payload->>'value')='3');
    insert into kq values ('Hub THUẬN: KHÔNG có tên/email em trong payload', 'không có student_email', case when v_row.payload ? 'student_email' then 'có' else 'không' end, not (v_row.payload ? 'student_email'));
  else
    insert into kq values ('Hub THUẬN: lượt tay sinh 1 sự kiện', '1', v_n::text, false);
  end if;
end $$;

-- Sáu ca NGƯỢC (mỗi ca: 0 sự kiện) + ca 'khac'→area null
do $$
declare
  v_lop uuid; v_dv uuid; v_e1 uuid; v_e2 uuid;
  v_th uuid; v_luot uuid; v_n int; v_mtX uuid; v_cs uuid;
begin
  select lop, cs, em[1], em[2] into v_lop, v_cs, v_e1, v_e2 from bc;
  select v into v_dv from art where k='don_vi';

  -- (a) lượt CẢ ĐỘI (student_id null) trên thước lớp ca_doi → 0
  insert into thuoc (chu_the, class_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan, pham_vi)
    values ('lop', v_lop, 'Việc chung lớp (thử)', 'cham', v_dv, 1, 5, date '2026-08-31', 'ca_doi') returning id into v_th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th, null, date '2026-08-31', 2, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: lượt cả đội → 0 sự kiện', '0', v_n::text, v_n=0);

  -- (b) lượt nguồn hệ thống → 0 (điểm danh đi đường riêng)
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon, nguon_ref)
    values ((select id from thuoc where student_id=v_e1 and cach_ghi='cham' and ten like 'Đọc sách%' limit 1),
            v_e1, date '2026-09-01', 1, 'he_thong', gen_random_uuid()) returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: lượt he_thong → 0 sự kiện', '0', v_n::text, v_n=0);

  -- (c) gia_tri = 0 → 0 ("có làm được 0" không phải một lần làm)
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e2, 'Việc gia_tri 0 (thử)', 'cham', v_dv, 1, 5, date '2026-08-31') returning id into v_th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th, v_e2, date '2026-08-31', 0, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: gia_tri=0 → 0 sự kiện', '0', v_n::text, v_n=0);

  -- (d) thước KIÊNG (chieu_dich='nhieu_nhat') → 0
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan, chieu_dich)
    values ('em', v_lop, v_e1, 'Việc kiêng (thử)', 'cham', v_dv, 1, 3, date '2026-08-31', 'nhieu_nhat') returning id into v_th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th, v_e1, date '2026-08-31', 2, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: thước kiêng (nhieu_nhat) → 0', '0', v_n::text, v_n=0);

  -- (e) thước SỐ-ĐO (gop='moi_nhat') → 0
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, chi_tieu_ky, tu_tuan, gop)
    values ('em', v_lop, v_e1, 'Việc số đo (thử)', 'dien_so', v_dv, 100, date '2026-08-31', 'moi_nhat') returning id into v_th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th, v_e1, date '2026-08-31', 80, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: thước số-đo (moi_nhat) → 0', '0', v_n::text, v_n=0);

  -- (f) thước MÁY (cach_ghi='he_thong') dù lượt tay → 0
  insert into thuoc (chu_the, class_id, ten, cach_ghi, nguon_he_thong, don_vi_id, chi_tieu_ky, tu_tuan, pham_vi)
    values ('lop', v_lop, 'Chuyên cần máy (thử-f)', 'he_thong', 'diem_danh', v_dv, 5, date '2026-08-31', 'tung_em') returning id into v_th;
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguon) values (v_th, v_e1, date '2026-08-31', 1, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub NGƯỢC: thước máy (cach_ghi=he_thong) → 0', '0', v_n::text, v_n=0);

  -- (g) lĩnh vực 'khac' → CÓ sự kiện nhưng area = null
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan)
    values ('em', v_lop, v_e2, 'Việc lĩnh vực khác (thử)', 'cham', v_dv, 1, 5, date '2026-08-31') returning id into v_th;
  insert into muc_tieu (cap, campus_id, class_id, student_id, ten, linh_vuc, nguon_so, kieu_dich, chua_do_x, y_so, don_vi_id, ket_thuc, trang_thai)
    values ('em', v_cs, v_lop, v_e2, 'Mục tiêu khác (thử)', 'khac', 'ghi_tay', 'toi', true, 10, v_dv, date '2027-06-30', 'gui') returning id into v_mtX;
  insert into noi (cha_id, con_thuoc_id, vai) values (v_mtX, v_th, 'chi_huong');   -- postgres uid null → ép chi_huong, OK
  insert into luot (thuoc_id, student_id, ngay, gia_tri, nguoi_ghi, nguon) values (v_th, v_e2, date '2026-08-31', 4, v_e2, 'tay') returning id into v_luot;
  select count(*) into v_n from hub_event_outbox where source_id=v_luot;
  insert into kq values ('Hub khac: có sự kiện', '1', v_n::text, v_n=1);
  insert into kq values ('Hub khac: area = null', 'null',
    coalesce((select payload->>'area' from hub_event_outbox where source_id=v_luot),'(null)'),
    (select (payload->'area')='null'::jsonb or payload->'area' is null from hub_event_outbox where source_id=v_luot));
end $$;

-- ═══════════════════ NHÓM 2 — `nguon_he_thong_diem_danh` (điểm danh) ═════════════════════════
do $$
declare
  v_lop uuid; v_dv uuid; v_cs uuid; v_e1 uuid; v_e2 uuid;
  v_thHT uuid; v_mtHT uuid; v_n int; v_att uuid; v_att2 uuid;
  v_ngay date := date '2026-12-07';   -- Thứ Hai; xa dữ liệu điểm danh thật (giảm nguy cơ đụng unique)
begin
  select lop, cs, em[1], em[2] into v_lop, v_cs, v_e1, v_e2 from bc;
  select v into v_dv from art where k='don_vi';
  delete from attendance_records where class_id=v_lop and student_id in (v_e1,v_e2) and date=v_ngay;  -- dọn (đã trong rollback)

  -- Thước máy (chuyên cần) + mục tiêu lớp nguồn hệ thống
  insert into thuoc (chu_the, class_id, ten, cach_ghi, nguon_he_thong, don_vi_id, chi_tieu_ky, tu_tuan, pham_vi)
    values ('lop', v_lop, 'Chuyên cần (thử-điểm-danh)', 'he_thong', 'diem_danh', v_dv, 5, v_ngay, 'tung_em') returning id into v_thHT;
  insert into muc_tieu (cap, campus_id, class_id, ten, linh_vuc, nguon_so, nguon_he_thong, kieu_dich, chua_do_x, y_so, don_vi_id, bat_dau, ket_thuc, trang_thai)
    values ('lop', v_cs, v_lop, 'Chuyên cần lớp (thử)', 'physical_wellbeing', 'he_thong', 'diem_danh', 'toi', true, 100, v_dv, v_ngay, date '2027-06-30', 'duyet') returning id into v_mtHT;

  -- THUẬN: em1 CÓ MẶT → sinh 1 lượt he_thong; nguoi_ghi=null (máy)
  insert into attendance_records (class_id, student_id, date, status) values (v_lop, v_e1, v_ngay, 'present') returning id into v_att;
  select count(*) into v_n from luot where thuoc_id=v_thHT and student_id=v_e1 and nguon='he_thong';
  insert into kq values ('Điểm danh: present → 1 lượt he_thong', '1', v_n::text, v_n=1);
  insert into kq values ('Điểm danh: lượt máy nguoi_ghi=null', 'null',
    coalesce((select nguoi_ghi::text from luot where thuoc_id=v_thHT and student_id=v_e1 and nguon='he_thong' limit 1),'null'),
    (select nguoi_ghi is null from luot where thuoc_id=v_thHT and student_id=v_e1 and nguon='he_thong' limit 1));
  -- % chuyên cần đổ vào so_do của mục tiêu lớp
  select count(*) into v_n from so_do where muc_tieu_id=v_mtHT and ngay=v_ngay and nguon='he_thong';
  insert into kq values ('Điểm danh: % có mặt vào so_do (mục tiêu lớp)', '≥1', v_n::text, v_n>=1);

  -- IDEMPOTENT: sửa present→late (vẫn tính có mặt) → vẫn 1 lượt
  update attendance_records set status='late' where id=v_att;
  select count(*) into v_n from luot where thuoc_id=v_thHT and student_id=v_e1 and nguon='he_thong';
  insert into kq values ('Điểm danh: present→late vẫn 1 lượt (idempotent)', '1', v_n::text, v_n=1);

  -- RÚT LƯỢT: sửa về vắng → xoá lượt he_thong
  update attendance_records set status='absent' where id=v_att;
  select count(*) into v_n from luot where thuoc_id=v_thHT and student_id=v_e1 and nguon='he_thong';
  insert into kq values ('Điểm danh: late→absent rút lượt', '0', v_n::text, v_n=0);

  -- NGƯỢC: em2 VẮNG ngay từ đầu → không có lượt he_thong
  insert into attendance_records (class_id, student_id, date, status) values (v_lop, v_e2, v_ngay, 'absent') returning id into v_att2;
  select count(*) into v_n from luot where thuoc_id=v_thHT and student_id=v_e2 and nguon='he_thong';
  insert into kq values ('Điểm danh NGƯỢC: absent → 0 lượt', '0', v_n::text, v_n=0);

  -- NGƯỢC: lượt he_thong KHÔNG đi Hub (đã kiểm ở Nhóm 1b; ở đây xác nhận không có event cho lượt máy)
  select count(*) into v_n from hub_event_outbox o
    where o.source_table='luot' and o.source_id in (select id from luot where thuoc_id=v_thHT and nguon='he_thong');
  insert into kq values ('Điểm danh: lượt máy KHÔNG lên Hub', '0', v_n::text, v_n=0);
end $$;

-- ═══════════════════ NHÓM 3 — `apply_class_transfer` (đổi lớp) ══════════════════════════════
do $$
declare
  v_lop uuid; v_cs uuid; v_dv uuid; v_dest uuid; v_admin uuid; v_e3 uuid; v_e1 uuid;
  v_dest_cs uuid;
  v_mtOpen uuid; v_mtClosed uuid; v_thOpen uuid; v_ckOpen uuid; v_ckGraded uuid; v_nhom uuid;
  v_row record;
begin
  select lop, cs, em[3], em[1], admin into v_lop, v_cs, v_e3, v_e1, v_admin from bc;
  select v into v_dv from art where k='don_vi';
  select v into v_dest from art where k='dest';
  select campus_id into v_dest_cs from classes where id=v_dest;

  -- Mục tiêu MỞ + Mục tiêu ĐÃ ĐÓNG (chứng đối)
  insert into muc_tieu (cap, campus_id, class_id, student_id, ten, linh_vuc, nguon_so, kieu_dich, chua_do_x, y_so, don_vi_id, ket_thuc, trang_thai)
    values ('em', v_cs, v_lop, v_e3, 'MT mở (thử chuyển)', 'knowledge', 'ghi_tay', 'toi', true, 20, v_dv, date '2027-06-30', 'gui') returning id into v_mtOpen;
  insert into muc_tieu (cap, campus_id, class_id, student_id, ten, linh_vuc, nguon_so, kieu_dich, chua_do_x, y_so, don_vi_id, ket_thuc, trang_thai, ly_do_dong)
    values ('em', v_cs, v_lop, v_e3, 'MT đóng (thử chuyển)', 'knowledge', 'ghi_tay', 'toi', true, 20, v_dv, date '2027-06-30', 'dong', 'dat') returning id into v_mtClosed;

  -- Việc MỞ của em
  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan, trang_thai)
    values ('em', v_lop, v_e3, 'Việc mở (thử chuyển)', 'cham', v_dv, 1, 5, date '2026-08-31', 'chay') returning id into v_thOpen;

  -- Cam kết CHƯA CHẤM (tuần còn mở) + cam kết ĐÃ CHẤM (chứng đối)
  insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung, trang_thai)
    values ('em', v_lop, v_e3, date '2026-08-31', 2, 'Cam kết mở (thử)', 'hieu_luc') returning id into v_ckOpen;
  insert into cam_ket (chu_the, class_id, student_id, tuan_bat_dau, so_tuan, noi_dung, trang_thai, ket_qua, cham_at)
    values ('em', v_lop, v_e3, date '2026-08-17', 1, 'Cam kết đã chấm (thử)', 'hieu_luc', 'thang', now()) returning id into v_ckGraded;

  -- Nhóm ở lớp Test có em3
  insert into nhom (class_id, ten, loai) values (v_lop, 'Tổ thử chuyển', 'to') returning id into v_nhom;
  insert into nhom_thanh_vien (nhom_id, student_id) values (v_nhom, v_e3);

  -- Gọi apply dưới vai ADMIN (guard 42501 đi qua)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform public.apply_class_transfer(v_e3, v_dest);
  perform set_config('request.jwt.claims', '', true);

  -- Kiểm THUẬN
  select class_id, campus_id into v_row from muc_tieu where id=v_mtOpen;
  insert into kq values ('Chuyển: MT mở → class_id = đích', v_dest::text, v_row.class_id::text, v_row.class_id=v_dest);
  insert into kq values ('Chuyển: MT mở → campus_id = cơ sở đích', v_dest_cs::text, v_row.campus_id::text, v_row.campus_id=v_dest_cs);
  insert into kq values ('Chuyển: MT ĐÓNG đứng yên (giữ lớp cũ)', v_lop::text,
    (select class_id::text from muc_tieu where id=v_mtClosed), (select class_id from muc_tieu where id=v_mtClosed)=v_lop);
  insert into kq values ('Chuyển: Việc mở → class_id = đích', v_dest::text,
    (select class_id::text from thuoc where id=v_thOpen), (select class_id from thuoc where id=v_thOpen)=v_dest);
  insert into kq values ('Chuyển: Cam kết CHƯA CHẤM → đích', v_dest::text,
    (select class_id::text from cam_ket where id=v_ckOpen), (select class_id from cam_ket where id=v_ckOpen)=v_dest);
  insert into kq values ('Chuyển: Cam kết ĐÃ CHẤM đứng yên (lớp cũ)', v_lop::text,
    (select class_id::text from cam_ket where id=v_ckGraded), (select class_id from cam_ket where id=v_ckGraded)=v_lop);
  insert into kq values ('Chuyển: nhóm lớp cũ tắt thành viên', 'is_active=false',
    (select is_active::text from nhom_thanh_vien where nhom_id=v_nhom and student_id=v_e3),
    (select not is_active from nhom_thanh_vien where nhom_id=v_nhom and student_id=v_e3));
  insert into kq values ('Chuyển: ghi danh đích bật', 'true',
    (select is_active::text from enrollments where class_id=v_dest and student_id=v_e3),
    coalesce((select is_active from enrollments where class_id=v_dest and student_id=v_e3), false));
  insert into kq values ('Chuyển: ghi danh lớp cũ tắt', 'false',
    coalesce((select is_active::text from enrollments where class_id=v_lop and student_id=v_e3),'(không có)'),
    coalesce((select not is_active from enrollments where class_id=v_lop and student_id=v_e3), true));
end $$;

-- NGƯỢC: học sinh (không quyền) gọi apply → 42501
do $$
declare v_e1 uuid; v_e3 uuid; v_dest uuid;
begin
  select em[1], em[3] into v_e1, v_e3 from bc;
  select v into v_dest from art where k='dest';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    perform public.apply_class_transfer(v_e3, v_dest);
    insert into kq values ('Chuyển NGƯỢC: học sinh gọi apply bị chặn', '42501', 'đi lọt', false);
  exception
    when insufficient_privilege then insert into kq values ('Chuyển NGƯỢC: học sinh gọi apply bị chặn', '42501', 'chặn đúng (42501)', true);
    when others then insert into kq values ('Chuyển NGƯỢC: học sinh gọi apply bị chặn', '42501', 'chặn (khác mã): '||sqlerrm, true);
  end;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ═══════════════════ NHÓM 4 — `unenroll_student` (rời lớp) ══════════════════════════════════
do $$
declare
  v_lop uuid; v_dv uuid; v_admin uuid; v_e4 uuid; v_thU uuid; v_nhomU uuid; v_n int;
begin
  select lop, admin, em[4] into v_lop, v_admin, v_e4 from bc;
  select v into v_dv from art where k='don_vi';

  insert into thuoc (chu_the, class_id, student_id, ten, cach_ghi, don_vi_id, moi_lan, chi_tieu_ky, tu_tuan, trang_thai)
    values ('em', v_lop, v_e4, 'Việc chạy (thử rời)', 'cham', v_dv, 1, 5, date '2026-08-31', 'chay') returning id into v_thU;
  insert into nhom (class_id, ten, loai) values (v_lop, 'Tổ thử rời', 'to') returning id into v_nhomU;
  insert into nhom_thanh_vien (nhom_id, student_id) values (v_nhomU, v_e4);

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform public.unenroll_student(v_lop, v_e4);
  perform set_config('request.jwt.claims', '', true);

  insert into kq values ('Rời: việc của em → tam_dung', 'tam_dung',
    (select trang_thai from thuoc where id=v_thU), (select trang_thai from thuoc where id=v_thU)='tam_dung');
  insert into kq values ('Rời: nhóm lớp tắt thành viên', 'is_active=false',
    (select is_active::text from nhom_thanh_vien where nhom_id=v_nhomU and student_id=v_e4),
    (select not is_active from nhom_thanh_vien where nhom_id=v_nhomU and student_id=v_e4));
  insert into kq values ('Rời: ghi danh lớp tắt', 'false',
    (select is_active::text from enrollments where class_id=v_lop and student_id=v_e4),
    (select not is_active from enrollments where class_id=v_lop and student_id=v_e4));
end $$;

-- NGƯỢC: học sinh gọi unenroll → 'Không có quyền'
do $$
declare v_lop uuid; v_e1 uuid; v_e4 uuid;
begin
  select lop, em[1], em[4] into v_lop, v_e1, v_e4 from bc;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1::text)::text, true);
  begin
    perform public.unenroll_student(v_lop, v_e4);
    insert into kq values ('Rời NGƯỢC: học sinh gọi unenroll bị chặn', 'chặn', 'đi lọt', false);
  exception when others then
    insert into kq values ('Rời NGƯỢC: học sinh gọi unenroll bị chặn', 'chặn', 'chặn đúng: '||sqlerrm, true);
  end;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
