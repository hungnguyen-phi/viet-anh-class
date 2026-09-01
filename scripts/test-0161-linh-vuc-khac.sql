-- KIỂM 0161 — enum wig_domain đã có lĩnh vực 'khac'.  Chạy SAU khi apply 0161.
--
--   npm run sql -- scripts/test-0161-linh-vuc-khac.sql
--
-- 0161 KHÔNG có bảng/policy/trigger/CHECK nào — nó chỉ THÊM một nhãn vào enum wig_domain. Nên bài
-- này kiểm ở tầng catalog + một cột THẬT kiểu wig_domain (area_config.area, NOT NULL, khoá chính):
--   · CHIỀU THUẬN  — 'khac' nằm trong enum, cast được, cột thật lưu được, và được XẾP CUỐI (append).
--   · CHIỀU NGƯỢC  — một nhãn KHÔNG khai báo phải bị chặn (enum vẫn là TẬP ĐÓNG); bốn nhãn 4DX cũ
--                    còn nguyên (0161 chỉ thêm, không đổi nghĩa — C30 GIỮ wig_domain).
--   · "Chưa vá phải ĐỎ" — chốt chặn cứng ở đầu: chạy bài này TRƯỚC 0161 sẽ raise ngay (LỖI, không
--                    ra bảng tổng kết), đúng tinh thần "một phép kiểm luôn xanh là vô dụng".
--
-- Ghi chú vai: đặc tả yêu cầu đóng vai bằng request.jwt.claims. 0161 không có luật theo vai để
-- kiểm, nên chỉ giữ MỘT khối role-play chứng minh thay đổi enum là TOÀN CỤC (cast 'khac' vẫn hợp
-- lệ khi phiên là học sinh) — không phải bằng chứng RLS, và có chú thích rõ.
begin;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if not ('khac' = any (enum_range(null::wig_domain)::text[])) then
    raise exception 'CHUA VA 0161: enum wig_domain chưa có nhãn "khac" — chạy migration 0161 trước.';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;

-- ── 1. THUẬN: 'khac' có trong enum ──────────────────────────────────────────────────────────
insert into kq
select 'enum wig_domain chứa nhãn "khac"', 'có', 'có',
       'khac' = any (enum_range(null::wig_domain)::text[]);

-- ── 2. THUẬN: 'khac' xếp CUỐI (ADD VALUE nối vào đuôi, không chèn giữa làm lệch thứ tự cũ) ────
do $$
declare v_khac numeric; v_max_cu numeric;
begin
  select e.enumsortorder into v_khac
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'wig_domain' and e.enumlabel = 'khac';
  select max(e.enumsortorder) into v_max_cu
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'wig_domain'
     and e.enumlabel in ('knowledge','leadership_skills','character','physical_wellbeing');
  insert into kq values ('nhãn "khac" xếp SAU bốn nhãn 4DX', 'sortorder khac > mọi nhãn cũ',
    'khac=' || v_khac || ' , max_cũ=' || v_max_cu, v_khac > v_max_cu);
end $$;

-- ── 3. THUẬN: cast 'khac'::wig_domain chạy được ─────────────────────────────────────────────
do $$
begin
  perform 'khac'::wig_domain;
  insert into kq values ('cast text "khac" → wig_domain', 'cast được', 'cast được', true);
exception when others then
  insert into kq values ('cast text "khac" → wig_domain', 'cast được', 'LỖI: ' || sqlerrm, false);
end $$;

-- ── 4. THUẬN: cột THẬT kiểu wig_domain (area_config.area, NOT NULL, PK) lưu được 'khac' ──────
--   Không xoá dòng thật của ai: nếu 0162 đã chèn dòng 'khac' → unique_violation vẫn là bằng chứng
--   cột lưu được nhãn này. Tất cả nằm trong transaction sẽ rollback nên area_config không đổi.
do $$
begin
  insert into area_config (area, label_vi, label_en, color_hex, soft_rgba, icon_name, sort_order)
  values ('khac', '(thử)', '(test)', '#6b7093', 'rgba(107,112,147,0.14)', 'CircleDashed', 99);
  insert into kq values ('area_config.area (wig_domain) nhận "khac"', 'chèn được', 'chèn được (dòng mới)', true);
exception
  when unique_violation then
    insert into kq values ('area_config.area (wig_domain) nhận "khac"', 'chèn được',
      'đã có dòng "khac" (0162 đã chạy) — cột vẫn lưu được', true);
  when others then
    insert into kq values ('area_config.area (wig_domain) nhận "khac"', 'chèn được', 'LỖI: ' || sqlerrm, false);
end $$;

-- ── 5. NGƯỢC: nhãn KHÔNG khai báo phải bị chặn (enum là tập đóng) ────────────────────────────
do $$
begin
  perform 'khong_co_that'::wig_domain;
  insert into kq values ('nhãn lạ "khong_co_that" bị chặn', 'BỊ CHẶN',
    'CAST ĐƯỢC — enum không còn là tập đóng', false);
exception when invalid_text_representation then
  insert into kq values ('nhãn lạ "khong_co_that" bị chặn', 'BỊ CHẶN', 'bị chặn (invalid enum)', true);
end $$;

-- ── 6. NGƯỢC: bốn nhãn 4DX cũ còn NGUYÊN, tổng đúng 5 (chỉ THÊM, không đổi/xoá) ──────────────
do $$
declare v_con int; v_tong int;
begin
  select count(*) into v_con
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'wig_domain'
     and e.enumlabel in ('knowledge','leadership_skills','character','physical_wellbeing');
  select count(*) into v_tong
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'wig_domain';
  insert into kq values ('bốn nhãn 4DX cũ còn đủ', '4', v_con::text, v_con = 4);
  insert into kq values ('tổng nhãn wig_domain = 4 cũ + khac', '5', v_tong::text, v_tong = 5);
end $$;

-- ── 7. VAI (không phải kiểm RLS): enum toàn cục — phiên học sinh cast "khac" vẫn hợp lệ ───────
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","user_role":"student"}', true);
  perform 'khac'::wig_domain;
  perform set_config('request.jwt.claims', '', true);
  insert into kq values ('nhãn "khac" hợp lệ bất kể vai (phiên học sinh)', 'cast được', 'cast được', true);
exception when others then
  perform set_config('request.jwt.claims', '', true);
  insert into kq values ('nhãn "khac" hợp lệ bất kể vai (phiên học sinh)', 'cast được', 'LỖI: ' || sqlerrm, false);
end $$;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
