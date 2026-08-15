-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0126 — BẢNG PDR: BA CON SỐ CỦA TỪNG EM, ĐỌC NGAY TRONG PHÒNG HỌP
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3, mục PDR Meeting: "Các thông số từng học sinh chạy về Dashboard PDR tổng của GVCN:
--   1) Weekly commitment hoàn thành/weekly commitment
--   2) Leadmeasure hoàn thành/leadmeasure
--   3) Weekly commitment đã thay đổi"
--
-- Chủ dự án chốt 15/08/2026: "dashboard pdr chính là cái trang họp wig bên gv đó" — nên đây KHÔNG
-- phải một màn hình mới. Ba con số này đứng ngay trong phòng họp, cạnh chỗ cô đang chấm V/X.
--
-- ── CON SỐ THỨ BA CẦN MỘT THỨ CHƯA AI ĐẾM ───────────────────────────────────────────────────
--
-- "Đã thay đổi" là một tín hiệu kỷ luật, không phải một con số vui: em đổi lời hứa giữa tuần thì
-- lời hứa ấy thôi là một cam kết. App chưa lưu vệt nào cho việc đó — nên thêm một bộ đếm, và để
-- CHÍNH CSDL tăng nó, không để đường ghi tự khai. Đường ghi thì có nhiều (trang lớp, phòng họp,
-- màn của em); tin vào tất cả là chắc chắn sót một.
alter table commitments add column if not exists so_lan_sua integer not null default 0;

comment on column commitments.so_lan_sua is
  'Số lần LỜI HỨA bị đổi (tên hoặc mục tiêu năm nó phục vụ). Trigger tự tăng — đừng ghi thẳng.';

create or replace function private.dem_lan_sua_cam_ket()
returns trigger
language plpgsql
as $$
begin
  -- Chỉ đếm khi thứ NGƯỜI HỨA đổi. Chấm V/X, đổi verdict_goi_y, cập nhật verdict_at đều không
  -- phải "đổi cam kết" — chúng là việc của buổi họp, và đếm chúng vào đây thì con số này nói về
  -- công việc của cô chứ không nói về kỷ luật của em.
  if new.title is distinct from old.title or new.wig_id is distinct from old.wig_id then
    new.so_lan_sua := old.so_lan_sua + 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_dem_lan_sua_cam_ket on commitments;
create trigger trg_dem_lan_sua_cam_ket
  before update on commitments
  for each row execute function private.dem_lan_sua_cam_ket();

-- ── BA CON SỐ, MỘT CÂU HỎI ─────────────────────────────────────────────────────────────────
-- Trả cả những em CHƯA đặt cam kết nào (0/0): buổi họp phải hỏi được mọi em, và em chưa hứa gì
-- mới đúng là em cần hỏi nhất. Ẩn các em ấy đi thì bảng đẹp lên còn buổi họp thì nghèo đi.
create or replace function pdr_bang(p_class uuid, p_week date default null)
returns table(
  student_id uuid,
  student_name text,
  cam_ket_tong integer,
  cam_ket_dat integer,
  viec_tong integer,
  viec_dat integer,
  so_lan_sua integer,
  cham_khac_may integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with wk as (select coalesce(p_week, vn_week_start()) as monday),
  em as (
    select e.student_id as sid, ten_hien_thi(p.full_name, p.email) as ten
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.class_id = p_class and e.is_active
  ),
  ck as (
    select c.id, c.student_id, c.verdict, c.verdict_goi_y, c.so_lan_sua
    from commitments c, wk
    where c.class_id = p_class and c.student_id is not null and c.week_start = wk.monday
  ),
  -- Việc dẫn dắt của em: đạt khi số của em trong tuần chạm chỉ tiêu của việc. Cùng một luật với
  -- cam_ket_goi_y() — nếu hai chỗ đếm khác nhau thì bảng này sẽ cãi nhau với chính nút V/X ở trên.
  viec as (
    select ck.student_id, lm.id as lead_id,
           coalesce((
             select case when kieu_don_vi(lm.unit) = 'do'
               then (array_agg(lp.value order by lp.logged_date desc, lp.created_at desc))[1]
               else sum(lp.value) * lm.unit_per_tick end
             from lead_progress lp, wk
             where lp.lead_measure_id = lm.id
               and lp.student_id = ck.student_id
               and lp.logged_date between wk.monday and wk.monday + 6
           ), 0) >= lm.target_value as xong
    from ck join lead_measures lm on lm.commitment_id = ck.id
  )
  select
    em.sid,
    em.ten,
    coalesce((select count(*) from ck where ck.student_id = em.sid), 0)::integer,
    coalesce((select count(*) from ck where ck.student_id = em.sid and ck.verdict = 'win'), 0)::integer,
    coalesce((select count(*) from viec v where v.student_id = em.sid), 0)::integer,
    coalesce((select count(*) from viec v where v.student_id = em.sid and v.xong), 0)::integer,
    coalesce((select sum(ck.so_lan_sua) from ck where ck.student_id = em.sid), 0)::integer,
    -- Cô chấm khác máy mấy lần. Không phải để bắt lỗi ai — để buổi họp sau nhìn lại còn biết chỗ
    -- nào con số và mắt người không khớp nhau.
    coalesce((select count(*) from ck
              where ck.student_id = em.sid and ck.verdict is not null
                and ck.verdict is distinct from ck.verdict_goi_y), 0)::integer
  from em
  where staff_can_read_class(p_class)
  order by em.ten;
$$;
revoke all on function pdr_bang(uuid, date) from public, anon;
grant execute on function pdr_bang(uuid, date) to authenticated, service_role;
