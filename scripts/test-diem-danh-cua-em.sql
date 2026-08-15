-- ĐIỂM DANH LÀ VIỆC CỦA EM (0127) — phép kiểm
--
-- Bốn luật chủ dự án chốt, và mỗi luật ở đây đều được hỏi bằng CHÍNH VAI của người ấy, không phải
-- bằng cách đọc chính sách. Một luật "tổ trưởng chỉ nhắc" mà chỉ nằm trong giao diện thì nó không
-- phải luật — mở tab thứ hai là tick hộ được.
--
--   npm run sql -- scripts/test-diem-danh-cua-em.sql

begin;

create table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop, c.campus_id as co_so,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id desc limit 1) as em2,
       c.homeroom_teacher_id as gvcn,
       '823acffd-118b-48cf-b099-1914e2d9bb2b'::uuid as bgh,
       vn_today() as hom_nay
from classes c where c.name = 'Test' and c.is_active limit 1;

-- Tổ trưởng: chính là em thứ hai.
update enrollments e set is_attendance_leader = true
from ai where e.class_id = ai.lop and e.student_id = ai.em2;

-- Dọn dòng của hôm nay để mọi phép đo bên dưới bắt đầu từ trang trắng.
delete from attendance_records a using ai where a.class_id = ai.lop and a.date = ai.hom_nay;

grant all on ket_qua, ai to authenticated;

-- ── 1. TỔ TRƯỞNG CHỈ NHẮC ──────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em2, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so integer;
begin
  begin
    insert into attendance_records (class_id, student_id, date, status, marked_by)
    select lop, em, hom_nay, 'present'::attendance_status, em2 from ai;
    get diagnostics v_so = row_count;
  exception when others then v_so := 0;
  end;
  insert into ket_qua values ('Tổ trưởng KHÔNG điểm danh thay được', '0 dòng', v_so || ' dòng', v_so = 0);
end $$;

-- Nhưng vẫn phải THẤY ai chưa check-in — đó là cả công việc còn lại của tổ trưởng.
insert into ket_qua
select 'Tổ trưởng thấy danh sách ai chưa check-in', 'thấy cả lớp',
       count(*) || ' em', count(*) >= 2
from ai, chua_check_in(ai.lop);

-- ── 2. GVCN CŨNG THÔI GHI ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so integer;
begin
  begin
    insert into attendance_records (class_id, student_id, date, status, marked_by)
    select lop, em, hom_nay, 'present'::attendance_status, gvcn from ai;
    get diagnostics v_so = row_count;
  exception when others then v_so := 0;
  end;
  insert into ket_qua values ('GVCN KHÔNG điểm danh thay được', '0 dòng', v_so || ' dòng', v_so = 0);
end $$;

do $$
declare v_ok boolean := false;
begin
  begin
    perform mark_attendance((select lop from ai), (select em from ai), 'present');
  exception when insufficient_privilege then v_ok := true;
  when others then v_ok := true;
  end;
  insert into ket_qua values ('GVCN gọi mark_attendance thì bị từ chối', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 3. BAN GIÁM HIỆU SỬA ĐƯỢC ──────────────────────────────────────────────────────────────
-- Đây là đường duy nhất còn lại để chữa một ngày ghi nhầm. Không có nó thì "vắng là mặc định"
-- biến mọi sự cố mạng của một đứa trẻ thành một vết vắng vĩnh viễn.
select set_config('request.jwt.claims',
  (select json_build_object('sub', bgh, 'role', 'authenticated')::text from ai), true);

do $$
declare v_so integer;
begin
  insert into attendance_records (class_id, student_id, date, status, marked_by)
  select lop, em, hom_nay, 'excused'::attendance_status, bgh from ai;
  get diagnostics v_so = row_count;
  insert into ket_qua values ('BGH ghi được', '1 dòng', v_so || ' dòng', v_so = 1);
exception when others then
  insert into ket_qua values ('BGH ghi được', '1 dòng', 'BỊ CHẶN OAN: ' || sqlerrm, false);
end $$;

reset role;

-- ── 4. EM TỰ CHECK-IN LÀ CÓ MẶT, KHÔNG CHỜ TRƯỜNG KHAI MẠNG ────────────────────────────────
-- Mở rộng cửa sổ để phép kiểm không phụ thuộc vào giờ chạy, rồi trả lại ngay.
create table cua_so_cu as
  select id, gio_vao_lop, mo_truoc_phut, an_han_phut, han_muon_phut from campuses;
-- Mở toang cửa sổ sáng để phép kiểm không phụ thuộc vào giờ chạy: mở trước 12 tiếng, ân hạn và
-- hạn muộn 12 tiếng nữa. Trả lại nguyên trạng ngay ở cuối — và cả file nằm trong ROLLBACK.
update campuses set mo_truoc_phut = 720, an_han_phut = 720, han_muon_phut = 720;

delete from attendance_records a using ai where a.class_id = ai.lop and a.date = ai.hom_nay;
delete from mood_checkins m using ai where m.class_id = ai.lop and m.date = ai.hom_nay;

do $$
declare v_kq text;
begin
  select student_checkin((select em from ai), 'good', '1.2.3.4', 'sang') into v_kq;
  insert into ket_qua values ('Em check-in xong thì có dòng điểm danh', 'có',
    coalesce((select status::text from attendance_records a, ai
              where a.class_id = ai.lop and a.student_id = ai.em and a.date = ai.hom_nay), 'KHÔNG CÓ'),
    exists (select 1 from attendance_records a, ai
            where a.class_id = ai.lop and a.student_id = ai.em and a.date = ai.hom_nay));
end $$;

-- Em KHÔNG check-in thì không có dòng nào — vắng là mặc định, không phải một dòng bịa ra.
insert into ket_qua
select 'Em chưa check-in thì KHÔNG có dòng nào (vắng là mặc định)', 'không có dòng',
       count(*) || ' dòng', count(*) = 0
from attendance_records a, ai
where a.class_id = ai.lop and a.student_id = ai.em2 and a.date = ai.hom_nay;

update campuses c
set gio_vao_lop = k.gio_vao_lop, mo_truoc_phut = k.mo_truoc_phut,
    an_han_phut = k.an_han_phut, han_muon_phut = k.han_muon_phut
from cua_so_cu k where k.id = c.id;

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
