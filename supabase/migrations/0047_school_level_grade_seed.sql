-- 0047 — Cấp học của cơ sở + tự sinh Khối
--
-- VẤN ĐỀ ĐANG SỬA: bảng `grades` để người dùng gõ tay cả TÊN lẫn SỐ THỨ TỰ. Kết quả trên
-- production là 4 bản ghi rác: tên "7", "6", "k", "Khối" với sort_order 0,0,2,7. Khối trong
-- trường phổ thông là hằng số theo cấp học, không phải thứ mỗi người tự đặt.
--
-- CÁCH SỬA: gắn CẤP HỌC cho cơ sở, rồi sinh khối từ cấp học đó.
--   • Tiểu học → Khối 1..5      • THCS → Khối 6..9      • THPT → Khối 10..12
--   • Mầm non  → KHÔNG sinh gì: nhà trẻ/mầm/chồi/lá không đánh số, mỗi trường gọi một kiểu
--                → giữ nguyên đường nhập tay cho riêng cấp này.
-- sort_order lấy thẳng bằng số khối nên luôn đúng thứ tự, không ai phải gõ.

-- ── 1) Cấp học ──────────────────────────────────────────────────────────────
create type school_level as enum ('mam_non', 'tieu_hoc', 'thcs', 'thpt');

-- NULL = chưa khai báo. Cố ý KHÔNG đặt mặc định: đoán sai cấp học sẽ sinh sai khối cho cơ sở
-- đang chạy thật. Hai cơ sở hiện có phải được chọn cấp bằng tay một lần (xem §5).
alter table campuses add column level school_level;

comment on column campuses.level is
  'Cấp học của cơ sở. Quyết định bộ Khối được sinh tự động; mầm non thì nhập tay.';

-- ── 2) Bộ khối chuẩn theo cấp ───────────────────────────────────────────────
create or replace function standard_grade_numbers(p_level school_level)
returns int[]
language sql
immutable
as $$
  select case p_level
    when 'tieu_hoc' then array[1,2,3,4,5]
    when 'thcs'     then array[6,7,8,9]
    when 'thpt'     then array[10,11,12]
    else null::int[]          -- mầm non (và NULL): không có khối đánh số
  end;
$$;

-- ── 3) Sinh khối cho một cơ sở ──────────────────────────────────────────────
-- Chạy lại bao nhiêu lần cũng an toàn: đã có `unique (campus_id, name)` nên bản ghi trùng bị
-- bỏ qua, KHÔNG ghi đè khối người dùng đã sửa tay. Trả về số khối vừa thêm mới.
create or replace function seed_grades_for_campus(p_campus uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level  school_level;
  v_nums   int[];
  n        int;
  v_added  int := 0;
begin
  select level into v_level from campuses where id = p_campus;
  v_nums := standard_grade_numbers(v_level);
  if v_nums is null then
    return 0;
  end if;

  foreach n in array v_nums loop
    insert into grades (campus_id, name, sort_order)
    values (p_campus, 'Khối ' || n, n)
    on conflict (campus_id, name) do nothing;
    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;

revoke all on function seed_grades_for_campus(uuid) from public, anon;
grant execute on function seed_grades_for_campus(uuid) to authenticated;
grant execute on function standard_grade_numbers(school_level) to authenticated;

-- ── 4) Tự sinh khi tạo cơ sở / khi khai cấp học lần đầu ─────────────────────
create or replace function trg_seed_grades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.level is not null and (tg_op = 'INSERT' or new.level is distinct from old.level) then
    perform seed_grades_for_campus(new.id);
  end if;
  return new;
end;
$$;

create trigger campus_seed_grades
  after insert or update of level on campuses
  for each row execute function trg_seed_grades();

-- ── 5) Dọn dữ liệu rác hiện có ──────────────────────────────────────────────
-- CHỈ xoá khối rác KHÔNG có lớp nào trỏ vào (`classes.grade_id`). Khối đang được lớp dùng thì
-- giữ nguyên — xoá đi sẽ làm lớp mất khối, việc đó phải do người phụ trách quyết định, không
-- phải migration tự làm. Tên rác = không khớp dạng 'Khối <số>'.
delete from grades g
where g.name !~ '^Khối [0-9]+$'
  and not exists (select 1 from classes c where c.grade_id = g.id);

-- Cơ sở hiện có chưa khai cấp học → CHƯA sinh khối nào. Sau khi áp migration này, vào
-- /admin (hoặc /campus) chọn cấp học cho từng cơ sở là khối tự hiện ra đầy đủ.
