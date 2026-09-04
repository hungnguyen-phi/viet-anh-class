-- 0190 — /campus MỘT LƯỢT ĐI CSDL (đo 04/09/2026 sau 0189)
--
-- Đo được gì (production, lúc yên, phiên admin + BGH thật):
--   · /campus ttfb 0,5–0,7 s lúc rảnh (2,0 s của audit là lúc 3 phiên khác chạy chung + lần đầu
--     lạnh 1,3 s). Thuần CSDL từng mảnh chỉ 55–135 ms — dữ liệu nhỏ, mỗi câu ~50 ms là chi phí
--     kết nối/plan qua pooler, không phải tính toán.
--   · Trang gọi ~7 lượt PostgREST song song (campus_rollup, co_so_tong_hop, classes-lọc,
--     muc_tieu_v cap=truong, tuan_hoc) + 5 câu quản lý riêng của BGH (grades, classes,
--     profiles, campuses, pending_user_grants) + pt_class_message_health/pt_unread của layout.
--     10 người BGH/admin cùng mở = 70–120 câu chen 11 kết nối PostgREST.
--   · campus_rollup gọi class_competition_scores() → private.thi_dua_ba_so (bản KHÔNG cache,
--     quét 4 tuần × mọi thước × mọi em) cho cả 28 lớp: 100–135 ms và tăng theo số em; trong khi
--     co_so_tong_hop đã dùng bản cache thi_dua_ba_so_dem (0187) cho cùng con số.
--   → Chữa: một hàm trang_campus(p_campus, p_nam, p_khoi) trả jsonb đúng tên biến trang đang dùng;
--     rollup bên trong tính điểm bằng bản CACHE (cùng công thức class_competition_scores: trung
--     bình ba số thi đua có số). Không đè hàm nào đang có.
--
-- ĐÃ ĐỐI CHIẾU pg_get_functiondef live (04/09/2026): campus_rollup (0010 + 0163 vá wig_count),
-- co_so_tong_hop (0187), thi_dua_lop (0187), private.thi_dua_ba_so_dem (0187),
-- class_competition_scores (0187) — không đè, chỉ đọc để giữ đúng công thức.
--
-- SECURITY INVOKER: mọi bảng/khung nhìn đọc bên trong đi qua RLS y hệt khi trang gọi từng câu
-- (đối chiếu pg_policies 04/09: classes, grades, campuses, profiles, pending_user_grants,
-- tuan_hoc, muc_tieu(_v) đều có policy SELECT). co_so_tong_hop / thi_dua_ba_so_dem là SECDEF tự gác
-- quyền bên trong như cũ. Luật 0187: hàm public mới phải grant execute đích danh.

create or replace function public.trang_campus(
  p_campus uuid default null,   -- cơ sở của BGH (null = admin, xem mọi lớp)
  p_nam text default null,      -- năm học đang lọc (null = năm mới nhất có lớp)
  p_khoi uuid default null      -- khối đang lọc (null = tất cả)
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  j jsonb := '{}'::jsonb;
  v_role text := (select auth_role());
  v_nam text;
  v_bgh boolean;
begin
  if (select auth.uid()) is null then return null; end if;
  if not coalesce(v_role in ('admin', 'principal'), false) then return null; end if;
  v_bgh := v_role = 'principal' and p_campus is not null;

  -- Năm mặc định = năm mới nhất có lớp (như trang đang làm: namList[0]).
  select max(c.school_year) into v_nam from classes c
    where c.is_active and (not v_bgh or c.campus_id = p_campus);
  v_nam := coalesce(nullif(p_nam, ''), v_nam);

  j := jsonb_build_object(
    -- rows (SchoolRollup): đúng cột campus_rollup, điểm = bản CACHE (cùng công thức
    -- class_competition_scores: avg của ba số thi đua có số).
    'rows', (
      with att as (select class_id, count(*) as n from attendance_records where date = vn_today() group by class_id),
           enr as (select class_id, count(*) as n from enrollments where is_active group by class_id),
           wig as (select m.class_id, count(*) as n from muc_tieu m where m.cap = 'lop' and m.trang_thai = 'duyet' group by m.class_id)
      select coalesce(jsonb_agg(jsonb_build_object(
               'class_id', c.id, 'class_name', c.name, 'school_year', c.school_year, 'grade_id', c.grade_id,
               'grade_name', coalesce(g.name, c.grade, '—'), 'grade_sort', coalesce(g.sort_order, 9999),
               'score', coalesce((select round(avg(x), 1) from unnest(array[td.diem_muc_tieu, td.diem_thuoc, td.diem_cam_ket]) x where x is not null), 0),
               'att_today', coalesce(att.n, 0), 'student_count', coalesce(enr.n, 0), 'wig_count', coalesce(wig.n, 0))
             order by coalesce(g.sort_order, 9999), c.name), '[]'::jsonb)
      from classes c
      left join grades g on g.id = c.grade_id
      left join att on att.class_id = c.id
      left join enr on enr.class_id = c.id
      left join wig on wig.class_id = c.id
      cross join lateral private.thi_dua_ba_so_dem(c.id) td
      where c.school_year = current_school_year() and c.is_active
        and (v_role = 'admin' or (v_role = 'principal' and c.campus_id = (select auth_campus())))
    ),
    -- coSoTatCa (LopDiCham): nguyên co_so_tong_hop (SECDEF tự gác).
    'coSoTatCa', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.co_so_tong_hop() r),
    -- lopRows (bộ lọc Năm → Khối): classes + grades(name, sort_order) như trang đang select.
    'lopRows', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', c.id, 'school_year', c.school_year, 'grade_id', c.grade_id,
                   'grades', case when g.id is null then null else jsonb_build_object('name', g.name, 'sort_order', g.sort_order) end)), '[]'::jsonb)
                 from classes c left join grades g on g.id = c.grade_id
                 where c.is_active and (not v_bgh or c.campus_id = p_campus)),
    -- mtTruong (C1): chỉ BGH.
    'mtTruong', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', m.id, 'ten', m.ten, 'linh_vuc', m.linh_vuc, 'pct', m.pct, 'trang_thai', m.trang_thai, 'nguon_so', m.nguon_so)
                   order by m.created_at desc), '[]'::jsonb)
                 from muc_tieu_v m where m.cap = 'truong' and m.trang_thai <> 'dong') else '[]'::jsonb end,
    -- tuanHoc (C4): chỉ BGH, năm học hiện hành theo giờ VN — đúng cửa sổ schoolYearRangeVN của
    -- trang: 01/07 năm đầu → 30/06 năm sau (lib/dates.ts NGAY_DAU/CUOI_NAM_HOC).
    'tuanHoc', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object('week_start', t.week_start, 'loai', t.loai)), '[]'::jsonb)
                 from tuan_hoc t where t.campus_id = p_campus
                   and t.week_start >= make_date(extract(year from vn_today())::int - case when extract(month from vn_today()) >= 7 then 0 else 1 end, 7, 1)
                   and t.week_start <= make_date(extract(year from vn_today())::int + case when extract(month from vn_today()) >= 7 then 1 else 0 end, 6, 30))
               else '[]'::jsonb end,
    -- mgmt (BGH quản cơ sở): 5 câu quản lý gộp.
    'gr', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'sort_order', g.sort_order, 'is_active', g.is_active, 'campus_id', g.campus_id) order by g.sort_order), '[]'::jsonb)
                 from grades g where g.campus_id = p_campus) else '[]'::jsonb end,
    'cls', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade_id', c.grade_id, 'grade', c.grade, 'school_year', c.school_year,
                   'campus_id', c.campus_id, 'homeroom_teacher_id', c.homeroom_teacher_id, 'is_active', c.is_active, 'nhap_ho', c.nhap_ho) order by c.name), '[]'::jsonb)
                 from classes c where c.campus_id = p_campus and c.is_active) else '[]'::jsonb end,
    'staffRows', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) order by p.email), '[]'::jsonb)
                 from (select * from profiles p where p.campus_id = p_campus and p.role in ('teacher', 'pending') order by p.email limit 500) p) else '[]'::jsonb end,
    'cp', case when v_bgh then (select to_jsonb(x) from (select name, levels from campuses where id = p_campus) x) else null end,
    'inv', case when v_bgh then (select coalesce(jsonb_agg(jsonb_build_object('email', i.email, 'created_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
                 from pending_user_grants i where i.campus_id = p_campus and i.role = 'teacher') else '[]'::jsonb end,
    'namChon', v_nam
  );
  return j;
end $$;
revoke execute on function public.trang_campus(uuid, text, uuid) from public, anon;
grant execute on function public.trang_campus(uuid, text, uuid) to authenticated, service_role;
