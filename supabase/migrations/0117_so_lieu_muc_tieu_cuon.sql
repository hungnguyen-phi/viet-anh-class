-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0117 — MỘT MỤC TIÊU CUỘN PHẢI NÓI ĐƯỢC "6/7 BẠN ĐẠT", KHÔNG CHỈ "85,7%"
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0116 dựng phép đếm và trả về đúng một con số phần trăm. Nhưng màn hình cần cả PHÂN SỐ: cô nhìn
-- "85,7%" thì không biết phải kéo thêm mấy em nữa, còn "6/7 bạn đạt" thì biết ngay là một em.
-- Với lớp 32 em thì khác biệt còn lớn hơn — 84,4% và 85,7% trông như nhau, "27/32" và "6/7" thì
-- không.
--
-- Và lấy theo LÔ. Trang /wig hiện cả chục mục tiêu một lúc; hỏi từng cái một là chục vòng mạng
-- tới Supabase, đúng thứ đợt audit tốc độ đã đi dọn (VPS mất ~5% gói TCP nên mỗi vòng thừa đều
-- đắt gấp mấy lần bình thường).

-- ── 1. ĐẾM MỘT LẦN, DÙNG CHO CẢ HAI ───────────────────────────────────────────────────────
-- Tách phần đếm ra khỏi ty_le_cuon để hai đường không trôi khỏi nhau: nếu để mỗi bên tự đếm thì
-- một hôm nào đó phần trăm nói "đạt" mà phân số nói "6/7", và không ai biết bên nào đúng.
create or replace function cuon_dem(w uuid)
returns table(tong integer, dat integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  select * into r from wigs where id = w;
  if not found or r.measure_by <> 'cuon' then
    return;
  end if;

  if r.scope = 'class' then
    return query
      select count(*)::integer,
             count(*) filter (
               where em_dat_du(e.student_id, r.class_id, r.so_dich_can, r.start_date, r.end_date)
             )::integer
      from enrollments e
      where e.class_id = r.class_id and e.is_active;
  elsif r.scope = 'school' then
    return query
      select count(*)::integer,
             count(*) filter (
               where lop_dat_du(c.id, r.so_dich_can, r.start_date, r.end_date)
             )::integer
      from classes c
      where c.campus_id = r.campus_id and c.is_active;
  end if;
end $$;
revoke all on function cuon_dem(uuid) from public, anon;
grant execute on function cuon_dem(uuid) to authenticated, service_role;

-- ty_le_cuon giữ nguyên chữ ký và ý nghĩa, chỉ thôi tự đếm.
create or replace function ty_le_cuon(w uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  d record;
begin
  select * into d from cuon_dem(w);
  if not found then return null; end if;
  -- Chưa có đơn vị con nào thì trả 0, KHÔNG trả null: null làm mọi phép so bên trên thành
  -- "không sai", và một lớp rỗng sẽ đọc thành đang-đạt.
  if coalesce(d.tong, 0) = 0 then return 0; end if;
  return round(d.dat * 100.0 / d.tong, 1);
end $$;

-- ── 2. LẤY THEO LÔ ────────────────────────────────────────────────────────────────────────
-- Màn hình đưa cả nắm id, nhận về đủ ba con số cho từng cái. Hàm tự lọc theo RLS của bảng wigs
-- (nó KHÔNG phải security definer): id nào người gọi không được đọc thì không có dòng trả về,
-- chứ không phải trả về số rồi mới đi che.
create or replace function cuon_so_lieu(p_wigs uuid[])
returns table(wig_id uuid, tong integer, dat integer, ty_le numeric)
language sql
stable
set search_path to 'public'
as $$
  select w.id, d.tong, d.dat,
         case when coalesce(d.tong, 0) = 0 then 0 else round(d.dat * 100.0 / d.tong, 1) end
  from wigs w
  cross join lateral cuon_dem(w.id) d
  where w.id = any(p_wigs) and w.measure_by = 'cuon';
$$;
revoke all on function cuon_so_lieu(uuid[]) from public, anon;
grant execute on function cuon_so_lieu(uuid[]) to authenticated, service_role;
