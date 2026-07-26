-- 0038 — Vá 2 hàm SECURITY DEFINER thiếu guard (phát hiện 2026-07-26, xem docs/M8_HARDENING.md §5):
--   a) wig_actual(uuid): gọi thẳng /rest/v1/rpc/wig_actual là đọc được tổng tiến độ của BẤT KỲ WIG
--      nào nếu biết UUID (kể cả WIG cá nhân của HS khác), anon cũng gọi được.
--   b) log_audit(): mọi role ghi được dòng tuỳ ý vào audit_log, anon ghi với actor_id = null.
-- An toàn chạy lại (create or replace / drop if exists / grant idempotent).
set search_path = public;

-- ============================================================
-- 1) wig_actual → chuyển sang schema `private` (PostgREST chỉ expose public + graphql_public)
--    → KHÔNG còn endpoint RPC. Cố ý KHÔNG thêm guard vào thân hàm: hàm này được
--    class_competition_scores() dùng để tính điểm thi đua của MỌI lớp (class_ranks/campus_ranks
--    cho phép cả HS trong lớp gọi) — guard theo quan hệ lớp sẽ trả 0 cho các lớp khác và
--    LÀM SAI BẢNG XẾP HẠNG. Ẩn khỏi API là cách đóng đúng chỗ, không đổi hành vi.
--
--    Vẫn phải grant EXECUTE cho `authenticated`: wig_progress_v là view security_invoker nên
--    người gọi (chứ không phải chủ view) cần quyền thực thi. anon/public bị revoke sạch, và
--    anon cũng không có USAGE trên schema private → đóng cả 2 lớp.
-- ============================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.wig_actual(w uuid) returns numeric
  language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id from wigs where id = w
    union all
    select c.id from wigs c join descendants d on c.parent_wig_id = d.id
  )
  select coalesce(sum(lp.value), 0)
  from lead_measures lm
  join lead_progress lp on lp.lead_measure_id = lm.id
  where lm.wig_id in (select id from descendants);
$$;
revoke all on function private.wig_actual(uuid) from public;
grant execute on function private.wig_actual(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Trỏ 3 chỗ dùng wig_actual sang private.* (giữ nguyên logic 0026/0028).
-- ------------------------------------------------------------
create or replace view wig_progress_v with (security_invoker = true) as
select
  w.id as wig_id, w.class_id, w.student_id, w.scope, w.area, w.period, w.period_label,
  w.target_value, w.unit, w.start_date, w.end_date,
  x.a as actual,
  case when w.target_value > 0 then least(1, round(x.a / w.target_value, 4)) else 0 end as pct,
  case when (w.end_date - w.start_date) > 0
       then least(1, greatest(0, round((vn_today() - w.start_date)::numeric / (w.end_date - w.start_date), 4)))
       else 1 end as expected_pct,
  case
    when (case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end)
      then 'on_track'
    when (case when w.target_value > 0 then least(1, x.a / w.target_value) else 0 end)
       >= (case when (w.end_date - w.start_date) > 0 then least(1, greatest(0, (vn_today() - w.start_date)::numeric / (w.end_date - w.start_date))) else 1 end) - 0.1
      then 'mid'
    else 'off_track'
  end as status
from wigs w
cross join lateral (select private.wig_actual(w.id) as a) x;

grant select on wig_progress_v to authenticated;

-- child_class_progress: đổi sang private.wig_actual + SỬA LUÔN current_date (UTC) → vn_today()
-- (0026 đã sửa cho view nhưng hàm này bị bỏ sót → nhịp on_track/mid/off_track của phụ huynh
--  lệch 1 ngày trong khung 00:00–07:00 giờ VN).
create or replace function child_class_progress(s uuid)
returns table(area wig_area, pct numeric, status text)
language sql stable security definer set search_path = public as $$
  with cls as (select class_id from enrollments where student_id = s and is_active limit 1)
  select
    w.area,
    case when w.target_value > 0 then least(1, round(private.wig_actual(w.id) / w.target_value, 4)) else 0 end as pct,
    case
      when (case when w.target_value > 0 then least(1, private.wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end)
        then 'on_track'
      when (case when w.target_value > 0 then least(1, private.wig_actual(w.id)/w.target_value) else 0 end)
         >= (case when (w.end_date-w.start_date) > 0 then least(1, greatest(0, (vn_today()-w.start_date)::numeric/(w.end_date-w.start_date))) else 1 end) - 0.1
        then 'mid'
      else 'off_track'
    end as status
  from wigs w
  where w.class_id = (select class_id from cls) and w.scope = 'class' and w.period = 'year'
    and can_view_student(s);
$$;

create or replace function class_competition_scores()
returns table(class_id uuid, campus_id uuid, grade text, level text, score numeric)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.campus_id, c.grade,
    case when c.grade ~ '^[0-9]+$' then
      case when c.grade::int between 1 and 5 then 'primary'
           when c.grade::int between 6 and 9 then 'secondary'
           else 'high' end
      else 'unknown' end as level,
    coalesce(round(avg(case when w.target_value > 0 then least(1, private.wig_actual(w.id) / w.target_value) else 0 end) * 100, 1), 0) as score
  from classes c
  left join wigs w on w.class_id = c.id and w.scope = 'class' and w.period = 'year'
  where c.school_year = current_school_year()
    and c.is_active
  group by c.id, c.campus_id, c.grade;
$$;

-- Giữ nguyên chính sách quyền đã siết ở 0013/0023 cho class_competition_scores.
revoke all on function class_competition_scores() from public, anon, authenticated;

-- Chỉ drop SAU khi view + 2 hàm đã trỏ sang private.* (view có dependency thật).
drop function if exists public.wig_actual(uuid);

-- ============================================================
-- 2) log_audit(): chặn anon + bỏ qua lệnh gọi không có phiên đăng nhập.
--    (RLS không giúp gì ở đây vì hàm là SECURITY DEFINER.)
--    Giới hạn độ dài p_action để không nhồi rác vào nhật ký; app chỉ dùng nhãn ngắn.
-- ============================================================
create or replace function log_audit(p_action text, p_detail jsonb default '{}'::jsonb)
  returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, detail)
  select auth.uid(), left(p_action, 200), coalesce(p_detail, '{}'::jsonb)
  where auth.uid() is not null;
$$;
revoke all on function log_audit(text, jsonb) from public, anon;
grant execute on function log_audit(text, jsonb) to authenticated, service_role;
