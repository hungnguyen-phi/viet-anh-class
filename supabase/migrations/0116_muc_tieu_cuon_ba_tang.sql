-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0116 — MỤC TIÊU CUỘN: TRƯỜNG → LỚP → HỌC SINH, MỘT LUẬT ĐẾM DÙNG CHUNG
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Sinh ra từ 4.571 mục tiêu THẬT của cơ sở Gò Vấp (đọc 14/08/2026). Cả 13 mục tiêu lớp đều có
-- đúng một dạng, và app không diễn tả được cái nào:
--
--   "86% học sinh của lớp có 6/8 môn tính điểm đạt 6.5 trở lên đến hết tháng 5/2025"
--   "Đạt 95% học sinh thực hiện kế hoạch học tập đến hết 12/4 năm 2025"
--   "80% lớp tham gia một môn thể thao đến 4/2025"
--
-- Không cái nào là "đi từ số A tới số B". Chúng là phép ĐẾM BA TẦNG:
--
--   tầng môn      điểm Toán ≥ 6.5          → mục tiêu của EM (đã có, đo bằng ô số đo mỗi tuần)
--   tầng học sinh ≥ 6 môn đạt              → CHƯA CÓ
--   tầng lớp      ≥ 86% học sinh đạt       → CHƯA CÓ
--   tầng trường   ≥ X% lớp đạt             → CHƯA CÓ
--
-- ── MỘT LUẬT, LẶP LẠI Ở MỌI TẦNG ────────────────────────────────────────────────────────────
--
--   Một ĐƠN VỊ CON coi là ĐẠT khi ít nhất `so_dich_can` mục tiêu năm của nó đã đạt.
--   Một MỤC TIÊU CUỘN coi là ĐẠT khi ít nhất `ty_le_can` phần trăm đơn vị con của nó đã đạt.
--
-- Lớp thì đơn vị con là học sinh; trường thì đơn vị con là lớp. Cùng một câu, chỉ đổi tầng —
-- nên chỉ cần một hàm, và tầng trên tự cuộn được tầng dưới mà không phải viết lại phép đếm.
--
-- Chủ dự án chốt 14/08/2026, kèm hai ranh giới quan trọng:
--   · "ở luồng xem của giáo viên lẫn bgh" — học sinh KHÔNG thấy mục tiêu cuộn. Phần của em là
--     mấy mục tiêu môn cụ thể; nhìn thấy "86% lớp" chỉ làm em rối chứ không làm được gì.
--   · "các case kép đó là do giáo viên lười cụ thể hóa, app không thể chạy theo được" — một ô
--     ghi năm đích ("Reading ≥29, Listening ≥23, Writing ≥17…") thì phải TÁCH thành năm mục
--     tiêu, không phải nhét vào một bản ghi. Chính việc bắt tách ra mới làm nó đo được.

-- ── 1. MỘT MỤC TIÊU CÓ CHỖ ĐỨNG Ở TẦNG TRƯỜNG ──────────────────────────────────────────────
-- Mục tiêu trường không thuộc lớp nào, nên class_id thôi bắt buộc và campus_id xuất hiện.
alter table wigs alter column class_id drop not null;
alter table wigs add column if not exists campus_id uuid references campuses(id) on delete cascade;

-- Ba cột định nghĩa phép cuộn. Để null với mục tiêu thường.
alter table wigs add column if not exists ty_le_can numeric;   -- 86  → cần 86% đơn vị con đạt
alter table wigs add column if not exists so_dich_can integer; -- 6   → mỗi đơn vị con cần 6 mục tiêu đạt
alter table wigs add column if not exists tong_dich integer;   -- 8   → "6/8 môn", chỉ để hiện chữ

comment on column wigs.ty_le_can is 'Mục tiêu cuộn: cần bao nhiêu %% đơn vị con đạt (86).';
comment on column wigs.so_dich_can is 'Mục tiêu cuộn: mỗi đơn vị con cần bao nhiêu mục tiêu năm đạt (6).';
comment on column wigs.tong_dich is 'Chỉ để hiện chữ "6/8 môn" — phép tính KHÔNG dùng tới.';

-- ── 2. NỚI CÁC RÀNG BUỘC ĐANG ĐÓNG CỨNG QUANH HAI TẦNG CŨ ─────────────────────────────────
-- Bốn CHECK dưới đây đều viết theo lối "hoặc class hoặc student", nên thêm tầng thứ ba là chúng
-- chặn. Nới đúng phần cần nới, giữ nguyên phần đang bảo vệ dữ liệu.
alter table wigs drop constraint if exists wig_scope_student;
alter table wigs add constraint wig_scope_student check (
  (scope = 'school'  and student_id is null and class_id is null and campus_id is not null)
  or (scope = 'class'   and student_id is null and class_id is not null)
  or (scope = 'student' and student_id is not null and class_id is not null)
);

alter table wigs drop constraint if exists wig_kind_ck;
alter table wigs add constraint wig_kind_ck check (
  (scope in ('school', 'class') and kind is null)
  or (scope = 'student' and kind = any (array['academic', 'personal']))
);

alter table wigs drop constraint if exists wig_set_by_ck;
alter table wigs add constraint wig_set_by_ck check (
  (scope in ('school', 'class') and set_by is null)
  or (scope = 'student' and set_by = any (array['student', 'teacher']))
);

-- 'cuon' = số của nó do MÁY ĐẾM NGƯỢC từ các đơn vị con, không ai gõ vào.
alter table wigs drop constraint if exists wig_measure_by_ck;
alter table wigs add constraint wig_measure_by_ck check (
  measure_by = any (array['tick', 'manual', 'cuon'])
);

-- Mục tiêu cuộn thì hai con số định nghĩa phép cuộn phải có, và tỉ lệ phải nằm trong 0–100.
-- Và KHÔNG BAO GIỜ ở tầng học sinh: một em không có "đơn vị con" để đếm, nên phép cuộn sẽ đi
-- tìm chính nó. Đây vừa là ranh giới chủ dự án chốt ("ở luồng xem của giáo viên lẫn bgh"), vừa
-- là cái chặn vòng lặp vô tận cho ty_le_cuon() ở mục 6.
alter table wigs drop constraint if exists wig_cuon_ck;
alter table wigs add constraint wig_cuon_ck check (
  measure_by <> 'cuon'
  or (scope in ('class', 'school')
      and ty_le_can is not null and ty_le_can > 0 and ty_le_can <= 100
      and so_dich_can is not null and so_dich_can >= 1)
);

-- Và mục tiêu TRƯỜNG thì bắt buộc là mục tiêu cuộn. Trường không có ô tick nào của riêng nó, cũng
-- không có việc hằng ngày treo dưới — mọi con số của nó chỉ có thể là kết quả đếm từ các lớp. Cho
-- phép một mục tiêu trường đo bằng 'tick' là hứa một vạch tiến độ mà không gì trong app nuôi được,
-- nên nó sẽ đứng ở 0% suốt năm mà chẳng ai giải thích nổi vì sao.
alter table wigs drop constraint if exists wig_school_cuon_ck;
alter table wigs add constraint wig_school_cuon_ck check (
  scope <> 'school' or measure_by = 'cuon'
);

create index if not exists idx_wigs_campus on wigs(campus_id) where campus_id is not null;

-- ── 3. SỐ MỚI NHẤT CỦA MỘT MỤC TIÊU ĐO LẠI ────────────────────────────────────────────────
-- Với kg/điểm/%, con số thật KHÔNG nằm ở lượt tick mà ở ô số đo điền lại mỗi tuần (wig_so_do,
-- 0108). Chủ dự án: "nhập vào con số tuần này kiểu điểm tb của con là 5 < 6.5 nên là con thua,
-- tuần sau lại điền tiếp, hoặc điền theo kì khác vì ko biết tuần đó có điểm ngay chưa".
-- Nên: lấy dòng có week_start MỚI NHẤT, bất kể nó thuộc tuần nào — tuần trống không phải là 0,
-- nó là "chưa đo".
create or replace function so_do_moi_nhat(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select gia_tri from wig_so_do where wig_id = w order by week_start desc limit 1;
$$;
revoke all on function so_do_moi_nhat(uuid) from public, anon;
grant execute on function so_do_moi_nhat(uuid) to authenticated, service_role;

-- ── 4. MỘT MỤC TIÊU ĐÃ ĐẠT CHƯA ───────────────────────────────────────────────────────────
-- Câu hỏi này trước đây nằm rải rác: chỗ so pct >= 1, chỗ xem achieved_at, chỗ so >= target.
-- Gom về một hàm, vì mục tiêu cuộn phải hỏi nó hàng trăm lần và mọi tầng phải trả lời giống nhau.
--
-- NGƯỠNG, KHÔNG PHẢI QUÃNG. Đích 9 điểm mà em được 10 thì là ĐẠT — không phải 111%. Dữ liệu
-- thật có đúng ca ấy (Lê Đăng Hiếu, 10A2: đích 9, kết quả 10.0). 449 mục tiêu của trường viết
-- thẳng "từ X trở lên".
create or replace function wig_dat(w uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_so numeric;
begin
  select * into r from wigs where id = w;
  if not found then return false; end if;

  -- Người đã đánh dấu tay thì tin dấu ấy — nó là câu trả lời của con người, đứng trên mọi phép đếm.
  if r.achieved_at is not null then return true; end if;

  if r.measure_by = 'cuon' then
    return coalesce(private.wig_actual(w), 0) >= r.ty_le_can;
  end if;

  if kieu_don_vi(r.unit) = 'do' then
    -- Ưu tiên ô số đo mỗi tuần; không có thì mới nhìn tới lượt tick.
    v_so := coalesce(so_do_moi_nhat(w), private.wig_actual(w));
    return toi_dich(v_so, r.target_value, r.baseline);
  end if;

  return coalesce(private.wig_actual(w), 0) >= r.target_value;
end $$;
revoke all on function wig_dat(uuid) from public, anon;
grant execute on function wig_dat(uuid) to authenticated, service_role;

-- ── 5. MỘT ĐƠN VỊ CON ĐÃ ĐẠT CHƯA ─────────────────────────────────────────────────────────
-- "Em này đạt mấy mục tiêu năm của em, có đủ 6 chưa" — và cùng câu ấy cho một LỚP với các mục
-- tiêu năm của lớp. Một hàm, hai tầng.
create or replace function em_dat_du(p_student uuid, p_class uuid, p_can integer, p_tu date, p_den date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*) filter (where wig_dat(w.id)) >= p_can
  from wigs w
  where w.scope = 'student' and w.student_id = p_student and w.class_id = p_class
    and w.period = 'year'
    and w.start_date <= p_den and w.end_date >= p_tu;
$$;
revoke all on function em_dat_du(uuid, uuid, integer, date, date) from public, anon;
grant execute on function em_dat_du(uuid, uuid, integer, date, date) to authenticated, service_role;

create or replace function lop_dat_du(p_class uuid, p_can integer, p_tu date, p_den date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*) filter (where wig_dat(w.id)) >= p_can
  from wigs w
  where w.scope = 'class' and w.class_id = p_class and w.period = 'year'
    and w.start_date <= p_den and w.end_date >= p_tu;
$$;
revoke all on function lop_dat_du(uuid, integer, date, date) from public, anon;
grant execute on function lop_dat_du(uuid, integer, date, date) to authenticated, service_role;

-- ── 6. SỐ CỦA MỘT MỤC TIÊU CUỘN = PHẦN TRĂM ĐƠN VỊ CON ĐÃ ĐẠT ─────────────────────────────
-- Đây là chỗ ba tầng nối vào nhau. Mục tiêu cuộn KHÔNG có số của riêng nó; số của nó là kết quả
-- đếm ngược từ tầng dưới. Lớp đếm học sinh, trường đếm lớp.
create or replace function ty_le_cuon(w uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_tong integer;
  v_dat integer;
begin
  select * into r from wigs where id = w;
  if not found or r.measure_by <> 'cuon' then return null; end if;

  if r.scope::text = 'class' then
    select count(*), count(*) filter (where em_dat_du(e.student_id, r.class_id, r.so_dich_can, r.start_date, r.end_date))
      into v_tong, v_dat
    from enrollments e where e.class_id = r.class_id and e.is_active;
  elsif r.scope::text = 'school' then
    select count(*), count(*) filter (where lop_dat_du(c.id, r.so_dich_can, r.start_date, r.end_date))
      into v_tong, v_dat
    from classes c where c.campus_id = r.campus_id and c.is_active;
  else
    return null;
  end if;

  -- Chưa có đơn vị con nào thì trả 0, KHÔNG trả null: null làm mọi phép so ở trên trở thành
  -- "không sai", và một lớp rỗng sẽ đọc thành đang-đạt.
  if coalesce(v_tong, 0) = 0 then return 0; end if;
  return round(v_dat * 100.0 / v_tong, 1);
end $$;
revoke all on function ty_le_cuon(uuid) from public, anon;
grant execute on function ty_le_cuon(uuid) to authenticated, service_role;

-- Đường CŨ được giữ nguyên, chỉ đổi tên: đây đúng là thân hàm private.wig_actual đang chạy trên
-- production (0114), chép lại nguyên văn sau khi đọc pg_proc. Tách ra để lớp bọc bên dưới không
-- phải nhân đôi phép cộng số — repo này đã dính "chẩn đúng một chỗ rồi quên chỗ còn lại" vài lần.
create or replace function private.wig_actual_so(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  with recursive descendants as (
    select id, class_id, scope, student_id, start_date, end_date
    from wigs where id = w
    union all
    select c.id, c.class_id, c.scope, c.student_id, c.start_date, c.end_date
    from wigs c
    join descendants d on c.parent_wig_id = d.id
    where c.scope = d.scope
  ),
  viec as (
    select d.class_id, d.scope, d.student_id, d.start_date, d.end_date,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick, lm.unit
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  theo_tuan as (
    select v.lead_id, v.class_id, v.scope, v.target_value, v.unit,
           lp.student_id,
           vn_week_start(lp.logged_date) as tuan,
           case
             when kieu_don_vi(v.unit) = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
             else sum(lp.value) * v.unit_per_tick
           end as gia
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
     and (v.student_id is null or lp.student_id = v.student_id)
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit, v.unit_per_tick,
             lp.student_id, vn_week_start(lp.logged_date)
  ),
  do_theo_em as (
    select distinct on (t.lead_id, t.student_id) t.lead_id, t.student_id, t.gia
    from theo_tuan t
    where kieu_don_vi(t.unit) = 'do'
    order by t.lead_id, t.student_id, t.tuan desc
  ),
  cong_don as (
    select coalesce(sum(
      case
        when t.scope = 'class' and t.target_value > 0 then least(t.gia, t.target_value)
        else t.gia
      end
    ), 0) as tong
    from theo_tuan t
    where kieu_don_vi(t.unit) <> 'do'
  )
  select case
    when exists (select 1 from do_theo_em)
      then (select round(avg(gia), 2) from do_theo_em)
    else (select tong from cong_don)
  end;
$$;
revoke all on function private.wig_actual_so(uuid) from public, anon;
grant execute on function private.wig_actual_so(uuid) to authenticated, service_role;

-- wig_actual đứng sau một lớp bọc: mục tiêu cuộn thì trả tỉ lệ, còn lại giữ nguyên đường cũ.
-- Mọi vòng tròn phần trăm trong app đều gọi tên này, nên đổi ở đây là đổi khắp nơi.
create or replace function private.wig_actual(w uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_mb text;
begin
  select measure_by into v_mb from wigs where id = w;
  if v_mb = 'cuon' then
    return ty_le_cuon(w);
  end if;
  return private.wig_actual_so(w);
end $$;

-- ── 7. AI ĐƯỢC ĐỤNG VÀO MỤC TIÊU TRƯỜNG ───────────────────────────────────────────────────
-- Mục tiêu trường không thuộc lớp nào nên mọi chính sách cũ (đều hỏi class_id) đều trượt.
-- Ban giám hiệu và quản trị viên của ĐÚNG cơ sở ấy quản; giáo viên trong cơ sở thì đọc được —
-- họ cần thấy lớp mình đang góp vào đâu. Học sinh KHÔNG đọc được: chủ dự án chốt mục tiêu cuộn
-- chỉ ở luồng GVCN và BGH.
--
-- MỖI CHÍNH SÁCH DƯỚI ĐÂY PHẢI MỞ ĐẦU BẰNG `scope = 'school'`. Postgres nối các chính sách
-- permissive bằng HOẶC, nên một dòng viết kiểu "scope <> 'school' OR …" sẽ không phải là thêm
-- một cửa cho mục tiêu trường — nó là mở toang mọi mục tiêu CỦA HỌC SINH cho bất kỳ ai đăng nhập.
-- Bản nháp đầu của tệp này viết đúng như vậy. Dữ liệu ở đây là dữ liệu trẻ con.
--
-- Quản trị viên đã có sẵn đường qua rls_all_wigs (staff_can_manage_class trả true cho admin ở
-- mọi dòng, kể cả class_id null), nên hai chính sách này chỉ cần lo hiệu trưởng và giáo viên.
drop policy if exists rls_school_wig_read on wigs;
create policy rls_school_wig_read on wigs for select
  using (
    scope = 'school'
    and campus_id = auth_campus()
    and auth_role() = any (array['principal'::user_role, 'teacher'::user_role])
  );

drop policy if exists rls_school_wig_manage on wigs;
create policy rls_school_wig_manage on wigs for all
  using (
    scope = 'school'
    and campus_id = auth_campus()
    and auth_role() = 'principal'::user_role
  )
  with check (
    scope = 'school'
    and campus_id = auth_campus()
    and auth_role() = 'principal'::user_role
  );
