-- LỚP KHAI WIG SAU KHI EM ĐÃ ĐẶT MỤC TIÊU → DÂY NỐI PHẢI TỰ MỌC (0155)
--
-- Lỗ được vá: 0100 chỉ nối lúc em bấm Lưu. Lớp chưa khai lĩnh vực ấy thì source_wig_id = null và
-- KHÔNG có gì nối lại về sau — mục tiêu của em mồ côi vĩnh viễn, không màn nào báo. Thứ tự sinh
-- ra lỗ chính là thứ tự tự nhiên của đầu năm học: em vào trước, thầy cô khai WIG lớp sau.
--
-- Phép kiểm này dựng đúng thứ tự ngược ấy, và ghim thêm ba mối nguy đi kèm bản vá:
--   · nối phải ĐÚNG NĂM HỌC (từ năm thứ hai, một lớp có hai WIG lớp cùng lĩnh vực);
--   · mục tiêu RIÊNG không được mọc dây (wig_source_ck, 0100);
--   · dây đã có KHÔNG bị giật sang WIG mới.
--
-- Chạy trong một giao dịch rồi ROLLBACK — không để lại gì trên CSDL thật.
--
--   npm run sql -- scripts/test-noi-muc-tieu-len-lop.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

do $$
declare
  v_class    uuid;
  v_em       uuid;
  v_nay      uuid;   -- mục tiêu của em, năm học "ZZ2099"
  v_ngoai    uuid;   -- mục tiêu của em, năm học khác — không được nối
  v_rieng    uuid;   -- mục tiêu RIÊNG — không bao giờ mang dây
  v_lop      uuid;   -- WIG lớp khai SAU
  v_lop_2    uuid;
begin
  select e.class_id, e.student_id into v_class, v_em
  from enrollments e
  join classes c on c.id = e.class_id
  where e.is_active and c.is_active and c.homeroom_teacher_id is not null
  order by e.class_id, e.student_id limit 1;

  -- ── ① EM ĐẶT TRƯỚC, LỚP CHƯA KHAI GÌ ──────────────────────────────────────────────────────
  insert into wigs (class_id, student_id, scope, kind, title, area, period, period_label,
                    target_value, unit, start_date, end_date, measure_by, set_by, status)
  values (v_class, v_em, 'student', 'academic', 'ZZ_TEST mục tiêu của em', 'character', 'year',
          'ZZ2099', 10, 'lần', '2099-01-01', '2099-12-31', 'tick', 'student', 'sent')
  returning id into v_nay;

  insert into ket_qua values
    ('Lớp chưa khai lĩnh vực → mục tiêu của em đứng một mình',
     'null', coalesce((select source_wig_id::text from wigs where id = v_nay), 'null'),
     (select source_wig_id from wigs where id = v_nay) is null);

  -- Cùng em, cùng lĩnh vực, NĂM HỌC KHÁC (khoá wigs_em_domain_uidx cho phép vì period_label khác).
  insert into wigs (class_id, student_id, scope, kind, title, area, period, period_label,
                    target_value, unit, start_date, end_date, measure_by, set_by, status)
  values (v_class, v_em, 'student', 'academic', 'ZZ_TEST mục tiêu năm khác', 'character', 'year',
          'ZZ2100', 10, 'lần', '2100-01-01', '2100-12-31', 'tick', 'student', 'sent')
  returning id into v_ngoai;

  -- Mục tiêu RIÊNG cùng lĩnh vực, cùng năm — CSDL cấm nó mang dây nối (wig_source_ck).
  insert into wigs (class_id, student_id, scope, kind, title, area, period, period_label,
                    target_value, unit, start_date, end_date, measure_by, set_by, status)
  values (v_class, v_em, 'student', 'personal', 'ZZ_TEST mục tiêu riêng', 'physical_wellbeing',
          'year', 'ZZ2099', 10, 'lần', '2099-01-01', '2099-12-31', 'tick', 'student', 'sent')
  returning id into v_rieng;

end $$;

-- ── ② THẦY CÔ KHAI WIG LỚP SAU — ĐÓNG ĐÚNG VAI GVCN ─────────────────────────────────────────
--
-- Phải chạy bằng PHIÊN THẬT của thầy cô, không phải quyền migration: chốt chặn 0133/0135 cho
-- "không có phiên" đi qua vô điều kiện, nên chạy bằng postgres là kiểm một con đường KHÔNG AI
-- ĐI. Người bấm "Tạo WIG lớp" ngoài đời chính là thầy cô — và `source_wig_id` nằm trong danh
-- sách cột mà 0133 cấm thầy cô đụng vào. Nếu khe mở ở 0155 sai, lượt INSERT này vỡ với 42501.
create temporary table vai as
select c.id as lop, c.homeroom_teacher_id as gvcn
from classes c join enrollments e on e.class_id = c.id and e.is_active
where c.is_active and c.homeroom_teacher_id is not null
order by c.id limit 1;

grant all on ket_qua, vai to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  (select json_build_object('sub', gvcn, 'role', 'authenticated')::text from vai), true);

do $$
declare
  v_lop   uuid;
  v_lop_2 uuid;
  v_nay   uuid;
  v_ngoai uuid;
  v_rieng uuid;
  v_class uuid := (select lop from vai);
begin
  select id into v_nay   from wigs where title = 'ZZ_TEST mục tiêu của em';
  select id into v_ngoai from wigs where title = 'ZZ_TEST mục tiêu năm khác';
  select id into v_rieng from wigs where title = 'ZZ_TEST mục tiêu riêng';

  begin
    insert into wigs (class_id, scope, title, area, period, period_label,
                      target_value, unit, start_date, end_date)
    values (v_class, 'class', 'ZZ_TEST WIG lớp', 'character', 'year', 'ZZ2099',
            100, 'lần', '2099-01-01', '2099-12-31')
    returning id into v_lop;
    insert into ket_qua values ('Thầy cô khai được WIG lớp (khe 0155 không làm vỡ lượt tạo)',
                                'tạo được', 'tạo được', true);
  exception when others then
    insert into ket_qua values ('Thầy cô khai được WIG lớp (khe 0155 không làm vỡ lượt tạo)',
                                'tạo được', sqlstate || ' ' || sqlerrm, false);
  end;

  insert into ket_qua values
    ('Lớp khai sau → mục tiêu của em tự nối lên WIG lớp',
     coalesce(v_lop::text, 'không tạo được'),
     coalesce((select source_wig_id::text from wigs where id = v_nay), 'null'),
     (select source_wig_id from wigs where id = v_nay) is not distinct from v_lop and v_lop is not null);

  insert into ket_qua values
    ('Mục tiêu của năm học KHÁC không bị nối theo',
     'null', coalesce((select source_wig_id::text from wigs where id = v_ngoai), 'null'),
     (select source_wig_id from wigs where id = v_ngoai) is null);

  insert into ket_qua values
    ('Mục tiêu RIÊNG vẫn không mang dây nối',
     'null', coalesce((select source_wig_id::text from wigs where id = v_rieng), 'null'),
     (select source_wig_id from wigs where id = v_rieng) is null);

  -- ── ③ KHAI THÊM MỘT WIG LỚP NỮA → KHÔNG ĐƯỢC GIẬT DÂY ĐÃ CÓ ───────────────────────────────
  insert into wigs (class_id, scope, title, area, period, period_label,
                    target_value, unit, start_date, end_date)
  values (v_class, 'class', 'ZZ_TEST WIG lớp 2', 'knowledge', 'year', 'ZZ2099',
          100, 'bài', '2099-01-01', '2099-12-31')
  returning id into v_lop_2;

  insert into ket_qua values
    ('Khai thêm WIG lớp lĩnh vực khác → dây cũ giữ nguyên',
     coalesce(v_lop::text, '—'), coalesce((select source_wig_id::text from wigs where id = v_nay), 'null'),
     (select source_wig_id from wigs where id = v_nay) is not distinct from v_lop and v_lop is not null);

  -- ── ④ VÀ KHE ẤY KHÔNG NỚI THÊM GÌ CHO THẦY CÔ ────────────────────────────────────────────
  begin
    update wigs set title = 'CÔ GÕ ĐÈ' where id = v_nay;
    insert into ket_qua values ('Thầy cô vẫn KHÔNG sửa được lời của em', 'bị chặn', 'lọt', false);
  exception when others then
    insert into ket_qua values ('Thầy cô vẫn KHÔNG sửa được lời của em', 'bị chặn', 'bị chặn', true);
  end;
end $$;

select set_config('request.jwt.claims', '', true);
reset role;


select
  case when dat then 'OK  ' else 'SAI ' end || ' ' || buoc
    || case when dat then '' else '  → mong ' || mong_doi || ', thực tế ' || thuc_te end as ket_qua
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket from ket_qua;

rollback;
