-- PHÒNG HỌP PDR SỐNG (0130) — phép kiểm
--
-- Cô mở phòng → em thấy phòng mở → em bấm tham gia → cô biết ai đang ngồi trong phòng → cô bấm
-- kết thúc → phòng đóng với cả hai bên. Mỗi bước hỏi bằng CHÍNH VAI của người ấy.
--
-- Chỗ đáng tiền: "mở phòng" KHÔNG được là "chốt tuần". Hai việc ấy từng bị gộp một lần rồi
-- (0121 → phải sửa ở 0122), và nếu gộp lại thì cô vừa mở phòng là cam kết khoá cứng, buổi họp
-- không còn gì để làm.
--
--   npm run sql -- scripts/test-phong-hop-song.sql

begin;

create table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

create table ai as
select c.id as lop,
       (select e.student_id from enrollments e
        where e.class_id = c.id and e.is_active order by e.student_id limit 1) as em,
       c.homeroom_teacher_id as gvcn,
       vn_week_start(date '2031-04-07') as tuan,
       'W15-2031' as nhan
from classes c where c.name = 'Test' and c.is_active limit 1;

grant all on ket_qua, ai to authenticated;

-- ── 1. CHƯA MỞ THÌ CHƯA MỞ ────────────────────────────────────────────────────────────────
insert into ket_qua
select 'Chưa ai bấm thì phòng đóng', 'đóng',
       case when phong_dang_mo(lop, nhan) then 'MỞ' else 'đóng' end,
       not phong_dang_mo(lop, nhan)
from ai;

-- ── 2. EM KHÔNG TỰ MỞ ĐƯỢC PHÒNG ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_ok boolean := false;
begin
  begin
    perform mo_phong_hop((select lop from ai), (select tuan from ai), (select nhan from ai));
  exception when others then v_ok := true;
  end;
  insert into ket_qua values ('Em KHÔNG tự mở được phòng họp', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

-- ── 3. CÔ MỞ PHÒNG ────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from ai), true);
select mo_phong_hop(lop, tuan, nhan) from ai;

insert into ket_qua
select 'Cô mở thì phòng mở', 'mở',
       case when phong_dang_mo(lop, nhan) then 'mở' else 'ĐÓNG' end,
       phong_dang_mo(lop, nhan)
from ai;

-- MỞ PHÒNG KHÔNG PHẢI LÀ CHỐT TUẦN.
insert into ket_qua
select 'Mở phòng KHÔNG chốt tuần (cam kết vẫn sửa được)', 'chưa chốt',
       case when tuan_da_chot(lop, null, tuan) then 'ĐÃ CHỐT' else 'chưa chốt' end,
       not tuan_da_chot(lop, null, tuan)
from ai;

-- ── 4. EM THẤY PHÒNG MỞ VÀ VÀO ĐƯỢC ───────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

insert into ket_qua
select 'Em cũng đọc được là phòng đang mở', 'mở',
       case when phong_dang_mo(lop, nhan) then 'mở' else 'ĐÓNG' end,
       phong_dang_mo(lop, nhan)
from ai;

select hs_tham_gia(lop, nhan, tuan) from ai;

-- Em viết ba câu PDR — và bấm Tham gia lần nữa KHÔNG được xoá chữ em vừa viết.
select hs_ghi_bien_ban(lop, nhan, tuan, 'kết quả', 'cam kết',
                       'Khó ở chỗ tối hay quên', 'Nhờ bạn cùng bàn nhắc', 'Đặt báo thức 20h30')
from ai;
select hs_tham_gia(lop, nhan, tuan) from ai;

reset role;
select set_config('request.jwt.claims', '', true);

insert into ket_qua
select 'Em vào phòng thì cô thấy dấu có mặt', 'có',
       case when m.tham_gia_luc is not null then 'có' else 'KHÔNG' end,
       m.tham_gia_luc is not null
from wig_meetings m, ai
where m.class_id = ai.lop and m.student_id = ai.em and m.week_label = ai.nhan;

insert into ket_qua
select 'Ba câu PDR lưu đúng ba ô riêng', 'đủ ba',
       coalesce(m.kho_khan, '—') || ' / ' || coalesce(m.vuot_qua, '—') || ' / ' || coalesce(m.cach_tot_hon, '—'),
       m.kho_khan is not null and m.vuot_qua is not null and m.cach_tot_hon is not null
from wig_meetings m, ai
where m.class_id = ai.lop and m.student_id = ai.em and m.week_label = ai.nhan;

insert into ket_qua
select 'Bấm Tham gia lần nữa KHÔNG xoá chữ đã viết', 'còn nguyên',
       coalesce(m.kho_khan, 'MẤT'), m.kho_khan = 'Khó ở chỗ tối hay quên'
from wig_meetings m, ai
where m.class_id = ai.lop and m.student_id = ai.em and m.week_label = ai.nhan;

-- ── 5. CÔ KẾT THÚC → PHÒNG ĐÓNG VỚI CẢ HAI BÊN ────────────────────────────────────────────
update wig_meetings set chot_at = now(), chot_by = (select gvcn from ai)
where class_id = (select lop from ai) and student_id is null
  and week_label = (select nhan from ai);

insert into ket_qua
select 'Cô kết thúc thì phòng đóng', 'đóng',
       case when phong_dang_mo(lop, nhan) then 'VẪN MỞ' else 'đóng' end,
       not phong_dang_mo(lop, nhan)
from ai;

set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', em, 'role', 'authenticated')::text from ai), true);

do $$
declare v_ok boolean := false;
begin
  begin
    perform hs_ghi_bien_ban((select lop from ai), (select nhan from ai), (select tuan from ai),
                            'ghi sau khi chốt', '', null, null, null);
  exception when sqlstate 'P0002' then v_ok := true;
  when others then v_ok := true;
  end;
  insert into ket_qua values ('Chốt rồi thì em không ghi thêm được', 'bị chặn',
    case when v_ok then 'bị chặn' else 'LỌT' end, v_ok);
end $$;

reset role;

select
  case when dat then 'ĐẠT ' else 'HỎNG' end as ket,
  buoc,
  'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from ket_qua order by dat, buoc;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket,
       bool_and(dat) as tat_ca_dat
from ket_qua;

rollback;
