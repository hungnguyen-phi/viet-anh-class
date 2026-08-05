-- 0087 — Một cơ sở mang NHIỀU cấp học (nhịp 1: thêm cột mới, code cũ vẫn chạy)
--
-- VÌ SAO: `campuses.level` chỉ chứa MỘT giá trị, trong khi Việt Anh Gò Vấp dạy cả THCS lẫn THPT —
-- và trường liên cấp là chuyện bình thường ở Việt Nam. Hệ quả của mô hình cũ:
--   · Nhãn trên màn hình ghi "THPT" trong khi cơ sở đang có Khối 6→12. Nói sai.
--   · hasNumberedGrades('thpt') = true nên mục Khối vào chế độ tự sinh, KHÔNG cho thêm tay —
--     muốn thêm Khối 5 thì không có nút nào.
--   · Bảy khối hiện có tồn tại được là do TÁC DỤNG PHỤ: đổi cấp học sinh thêm khối chuẩn của cấp
--     mới mà không xoá khối cũ, nên đổi THCS → THPT thì gom được 6→12. Nó chạy, nhưng là ăn may.
--
-- NHỊP 1 (file này) chỉ THÊM, không bỏ gì:
--   · cột `levels school_level[]`, đổ sẵn từ `level`
--   · hàm sinh khối đọc `levels`
--   · trigger đồng bộ hai chiều `level` ↔ `levels` để code ĐANG CHẠY trên production (còn đọc và
--     ghi `level`) không hỏng trong lúc chờ bản mới lên
-- NHỊP 2 (0088) mới bỏ `level` và trigger đồng bộ, sau khi bản mới đã chạy thật.

alter table campuses add column if not exists levels school_level[] not null default '{}';

update campuses
set levels = case when level is null then '{}'::school_level[] else array[level] end
where cardinality(levels) = 0;

-- Hợp của các dải khối chuẩn. Trả NULL khi không cấp nào có khối đánh số (mầm non), giữ đúng giao
-- ước của standard_grade_numbers() một cấp: NULL nghĩa là "khối không đánh số, phải nhập tay".
create or replace function standard_grade_numbers_multi(p_levels school_level[])
returns integer[]
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_levels is null or cardinality(p_levels) = 0 then null
    else (
      select array_agg(distinct n order by n)
      from unnest(p_levels) lv,
           unnest(coalesce(standard_grade_numbers(lv), '{}'::int[])) n
    )
  end;
$$;

-- Sinh khối theo TẤT CẢ các cấp của cơ sở. Vẫn on conflict do nothing nên gọi lại nhiều lần không
-- đẻ thêm dòng, và khối đã có (kể cả khối gõ tay) không bị đụng tới.
create or replace function seed_grades_for_campus(p_campus uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_levels school_level[]; v_nums int[]; n int; v_added int := 0;
begin
  select levels into v_levels from campuses where id = p_campus;
  v_nums := standard_grade_numbers_multi(v_levels);
  if v_nums is null then return 0; end if;
  foreach n in array v_nums loop
    insert into grades (campus_id, name, sort_order)
    values (p_campus, 'Khối ' || n, n)
    on conflict (campus_id, name) do nothing;
    v_added := v_added + 1;
  end loop;
  return v_added;
end;
$$;

-- Đồng bộ hai chiều, CHỈ DÙNG TRONG LÚC CHUYỂN TIẾP.
-- Code cũ ghi `level`; code mới ghi `levels`. Trigger này làm cái nào được ghi thì cái kia theo,
-- nên hai bản code chạy song song vài phút lúc deploy mà không bên nào thấy dữ liệu rỗng.
-- 0088 sẽ gỡ bỏ nó cùng với cột `level`.
create or replace function trg_campus_sync_level()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(coalesce(new.levels, '{}')) = 0 and new.level is not null then
      new.levels := array[new.level];
    elsif cardinality(coalesce(new.levels, '{}')) > 0 then
      new.level := new.levels[1];
    end if;
  else
    if new.levels is distinct from old.levels and cardinality(coalesce(new.levels, '{}')) > 0 then
      new.level := new.levels[1];
    elsif new.level is distinct from old.level and new.level is not null then
      new.levels := array[new.level];
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campus_sync_level on campuses;
create trigger campus_sync_level
  before insert or update on campuses
  for each row execute function trg_campus_sync_level();

-- Sinh khối phải chạy cả khi `levels` đổi, không chỉ khi `level` đổi.
create or replace function trg_seed_grades()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if cardinality(coalesce(new.levels, '{}')) > 0
     and (tg_op = 'INSERT' or new.levels is distinct from old.levels) then
    perform seed_grades_for_campus(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists campus_seed_grades on campuses;
create trigger campus_seed_grades
  after insert or update of level, levels on campuses
  for each row execute function trg_seed_grades();

-- Hiệu trưởng tự khai cấp cho cơ sở mình — nay khai được nhiều cấp.
create or replace function set_my_campus_levels(p_levels school_level[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_campus uuid;
begin
  if auth_role() <> 'principal' then
    raise exception 'Chỉ hiệu trưởng được khai cấp học cho cơ sở của mình';
  end if;
  v_campus := auth_campus();
  if v_campus is null then
    raise exception 'Tài khoản chưa được gán cơ sở';
  end if;
  update campuses set levels = coalesce(p_levels, '{}') where id = v_campus;
  return seed_grades_for_campus(v_campus);
end;
$$;

revoke all on function set_my_campus_levels(school_level[]) from public;
grant execute on function set_my_campus_levels(school_level[]) to authenticated;

comment on column campuses.levels is
  'Các cấp học cơ sở này dạy. Trường liên cấp có nhiều giá trị. Nguồn sự thật cho việc sinh khối.';
