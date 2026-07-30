-- ============================================================================
-- TÀI KHOẢN THỬ NGHIỆM — 3 người thử × 3 vai = 9 tài khoản
-- ============================================================================
-- Chạy trong Supabase → SQL Editor, bằng tài khoản chủ project.
--
-- CHẠY LẠI BAO NHIÊU LẦN CŨNG ĐƯỢC. Script không tạo trùng, không nhân đôi dữ liệu,
-- và mỗi lần chạy đều ép lại đúng trạng thái mong muốn (kể cả khi ai đó lỡ sửa tay).
--
-- Mật khẩu chung cho cả 9 tài khoản: demo1234
-- Đăng nhập: mở https://class.vietanh.org/login → bấm đúng nút ở khối "Demo".
--
-- CUỐI FILE có một câu SELECT in ra bảng tự kiểm. Đọc bảng đó: mọi cột phải là OK.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 0 — DỌN DẸP TRƯỚC (3 việc đã thống nhất)
-- ─────────────────────────────────────────────────────────────────────────────

-- 0.1 — Lớp 6A1 đang có HAI tổ trưởng điểm danh (hs01 và hs17). Cờ này mở quyền ghi
--       điểm danh CẢ LỚP, nhưng màn Danh sách lớp chỉ hiện một người. Giữ hs01, gỡ phần còn lại.
update enrollments e
set is_attendance_leader = false
where e.is_attendance_leader
  and e.class_id = (select id from classes where name = '6A1' and school_year = '2026-2027')
  and e.student_id <> (select id from profiles where email = 'hs01@student.truongvietanh.com');

-- 0.2 — Khai cấp học cho hai cơ sở → trigger campus_seed_grades tự sinh Khối 6,7,8,9.
update campuses set level = 'thcs' where code in ('VAGV', 'VAQ2') and level is distinct from 'thcs';

-- 0.3 — Chuyển lớp sang khối chuẩn rồi xoá hai khối tên rác ('6', '7' với thứ tự 0).
update classes c
set grade_id = g.id, grade = g.name
from grades g
where g.campus_id = c.campus_id
  and g.name = 'Khối ' || left(c.name, 1)     -- '6A1' → 'Khối 6'; '7B1' → 'Khối 7'
  and c.grade_id is distinct from g.id;

delete from grades g
where g.name ~ '^[0-9]+$'                      -- tên chỉ có chữ số = rác
  and not exists (select 1 from classes c where c.grade_id = g.id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 1 — LỚP MỚI 6A2 (cơ sở Gò Vấp)
-- ─────────────────────────────────────────────────────────────────────────────
-- Vì sao cần: để có MỘT lớp ở cơ sở khác với lớp của Người thử 1, làm vế đối chứng cho
-- kịch bản ranh giới ("BGH cơ sở này tuyệt đối không được thấy lớp cơ sở kia").
-- Không đụng vào 6A1 vì lớp đó đang gắn với tài khoản demo Cô Lan.
insert into classes (campus_id, name, grade, grade_id, school_year)
select c.id, '6A2', 'Khối 6', g.id, '2026-2027'
from campuses c
left join grades g on g.campus_id = c.id and g.name = 'Khối 6'
where c.code = 'VAGV'
  and not exists (
    select 1 from classes x
    where x.name = '6A2' and x.school_year = '2026-2027' and x.campus_id = c.id
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 2 — TẠO 9 TÀI KHOẢN
-- ─────────────────────────────────────────────────────────────────────────────
-- Cách hoạt động: chèn vào auth.users sẽ kích hoạt trigger handle_new_user, trigger đó
-- tự dựng hồ sơ trong bảng profiles. Miền email quyết định vai ban đầu:
--   @student.truongvietanh.com → vai 'student' ngay
--   @truongvietanh.com         → vai 'pending' (bị chặn) → PHẦN 3 nâng lên vai thật
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       s.em, now(), jsonb_build_object('full_name', s.fn), now(), now()
from (values
  ('test1.gvcn@truongvietanh.com',          'N1 · Giáo viên chủ nhiệm 7B1'),
  ('test1.hs@student.truongvietanh.com',    'N1 · Học sinh 7B1 (tổ trưởng)'),
  ('test1.ph@truongvietanh.com',            'N1 · Phụ huynh'),
  ('test2.bgh@truongvietanh.com',           'N2 · Ban giám hiệu Quận 2'),
  ('test2.hs@student.truongvietanh.com',    'N2 · Học sinh 7B1'),
  ('test2.ph@truongvietanh.com',            'N2 · Phụ huynh'),
  ('test3.admin@truongvietanh.com',         'N3 · Quản trị viên'),
  ('test3.gvcn@truongvietanh.com',          'N3 · Giáo viên chủ nhiệm 6A2'),
  ('test3.hs@student.truongvietanh.com',    'N3 · Học sinh 6A2')
) as s(em, fn)
where not exists (select 1 from auth.users u where u.email = s.em);

-- Đặt mật khẩu chung + đánh dấu email đã xác nhận (bỏ bước xác nhận qua hộp thư).
--
-- ⚠️ CÁC CỘT TOKEN PHẢI LÀ CHUỖI RỖNG, KHÔNG ĐƯỢC ĐỂ NULL.
-- Supabase Auth viết bằng Go và đọc mấy cột này vào kiểu `string` (không phải con trỏ). Gặp
-- NULL là nó lỗi ngay khi đăng nhập, trả về `unexpected_failure` — mà app chỉ biết dịch thành
-- "Email hoặc mật khẩu không đúng", nên rất dễ tưởng là gõ sai mật khẩu và đi tìm nhầm hướng.
-- Lệnh `insert into auth.users` để trống thì các cột này mặc định NULL, nên phải ép về ''.
update auth.users
set encrypted_password         = extensions.crypt('demo1234', extensions.gen_salt('bf')),
    email_confirmed_at         = coalesce(email_confirmed_at, now()),
    confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change               = coalesce(email_change, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change               = coalesce(phone_change, ''),
    phone_change_token         = coalesce(phone_change_token, ''),
    reauthentication_token     = coalesce(reauthentication_token, '')
where email like 'test_.%@truongvietanh.com'
   or email like 'test_.%@student.truongvietanh.com';


-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 3 — GÁN VAI VÀ CƠ SỞ
-- ─────────────────────────────────────────────────────────────────────────────
-- Bảng profiles có trigger chặn đổi vai/cơ sở nếu người gọi không phải admin. Script này
-- chạy trực tiếp trên database nên không có "người gọi" — phải tắt trigger trong lúc gán.
alter table profiles disable trigger trg_protect_profile_cols;

update profiles p
set role = v.vai::user_role,
    campus_id = (select id from campuses where code = v.co_so)
from (values
  ('test1.gvcn@truongvietanh.com',       'teacher',   'VAQ2'),
  ('test1.hs@student.truongvietanh.com', 'student',   'VAQ2'),
  ('test1.ph@truongvietanh.com',         'parent',    'VAQ2'),
  ('test2.bgh@truongvietanh.com',        'principal', 'VAQ2'),
  ('test2.hs@student.truongvietanh.com', 'student',   'VAQ2'),
  ('test2.ph@truongvietanh.com',         'parent',    'VAQ2'),
  ('test3.admin@truongvietanh.com',      'admin',     'VAGV'),
  ('test3.gvcn@truongvietanh.com',       'teacher',   'VAGV'),
  ('test3.hs@student.truongvietanh.com', 'student',   'VAGV')
) as v(em, vai, co_so)
where p.email = v.em;

alter table profiles enable trigger trg_protect_profile_cols;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 4 — GẮN NGƯỜI VỚI LỚP
-- ─────────────────────────────────────────────────────────────────────────────
alter table classes disable trigger trg_protect_class_cols;

-- 4.1 — Giáo viên chủ nhiệm
update classes set homeroom_teacher_id = (select id from profiles where email = 'test1.gvcn@truongvietanh.com')
where name = '7B1' and school_year = '2026-2027';

update classes set homeroom_teacher_id = (select id from profiles where email = 'test3.gvcn@truongvietanh.com')
where name = '6A2' and school_year = '2026-2027';

alter table classes enable trigger trg_protect_class_cols;

-- 4.2 — Học sinh vào lớp
insert into enrollments (class_id, student_id, is_active)
select cl.id, p.id, true
from (values
  ('7B1', 'test1.hs@student.truongvietanh.com'),
  ('7B1', 'test2.hs@student.truongvietanh.com'),
  ('6A2', 'test3.hs@student.truongvietanh.com')
) as v(lop, em)
join classes cl on cl.name = v.lop and cl.school_year = '2026-2027'
join profiles p on p.email = v.em
on conflict (class_id, student_id) do update set is_active = true;

-- 4.3 — Tổ trưởng điểm danh của 7B1 = học sinh của Người thử 1.
--       Đặt lại từ đầu để chạy lại script không đẻ ra hai tổ trưởng.
update enrollments e
set is_attendance_leader = (p.email = 'test1.hs@student.truongvietanh.com')
from profiles p, classes cl
where e.student_id = p.id
  and e.class_id = cl.id
  and cl.name = '7B1' and cl.school_year = '2026-2027';

-- 4.4 — Phụ huynh gắn với con
--       Cố ý cho hai phụ huynh có con HỌC CÙNG MỘT LỚP 7B1: đó là phép thử ranh giới mạnh
--       nhất — phụ huynh này tuyệt đối không được thấy con của phụ huynh kia.
insert into parent_links (parent_id, student_id, relationship)
select ph.id, hs.id, 'guardian'
from (values
  ('test1.ph@truongvietanh.com', 'test1.hs@student.truongvietanh.com'),
  ('test2.ph@truongvietanh.com', 'test2.hs@student.truongvietanh.com')
) as v(ph_em, hs_em)
join profiles ph on ph.email = v.ph_em
join profiles hs on hs.email = v.hs_em
on conflict (parent_id, student_id) do nothing;


-- ============================================================================
-- BẢNG TỰ KIỂM — đọc kết quả bên dưới, MỌI Ô phải là OK
-- ============================================================================
with tk as (
  select
    p.email,
    coalesce(u.raw_user_meta_data->>'full_name', '—')                       as ten_hien_thi,
    p.role::text                                                            as vai,
    coalesce(cam.code, '—')                                                 as co_so,
    -- đăng nhập được chưa: đủ mật khẩu, đã xác nhận email, VÀ không cột token nào còn NULL
    -- (cột token NULL làm Supabase Auth lỗi `unexpected_failure` — xem ghi chú ở PHẦN 2)
    case
      when u.encrypted_password is null or u.email_confirmed_at is null then 'THIEU MAT KHAU/XAC NHAN'
      when u.confirmation_token is null or u.recovery_token is null
        or u.email_change is null or u.email_change_token_new is null
        or u.email_change_token_current is null or u.phone_change is null
        or u.phone_change_token is null or u.reauthentication_token is null
        then 'TOKEN CON NULL - SE LOI KHI DANG NHAP'
      else 'OK'
    end                                                                     as dang_nhap,
    -- vai đã đúng chưa (không còn pending)
    case when p.role::text = 'pending' then 'CON PENDING - BI CHAN' else 'OK' end as vai_ok,
    -- gắn lớp
    case
      when p.role = 'teacher' then
        coalesce((select 'OK · GVCN ' || c.name from classes c where c.homeroom_teacher_id = p.id limit 1),
                 'THIEU: chua chu nhiem lop nao')
      when p.role = 'student' then
        coalesce((select 'OK · ' || c.name || case when e.is_attendance_leader then ' (to truong)' else '' end
                  from enrollments e join classes c on c.id = e.class_id
                  where e.student_id = p.id and e.is_active limit 1),
                 'THIEU: chua vao lop nao')
      when p.role = 'parent' then
        coalesce((select 'OK · con = ' || hs.email
                  from parent_links pl join profiles hs on hs.id = pl.student_id
                  where pl.parent_id = p.id limit 1),
                 'THIEU: chua gan con')
      when p.role = 'principal' then
        case when p.campus_id is not null then 'OK · quan co so ' || cam.code
             else 'THIEU: chua gan co so' end
      when p.role = 'admin' then 'OK · toan he thong'
      else 'KHONG XAC DINH'
    end                                                                     as gan_ket
  from profiles p
  join auth.users u on u.id = p.id
  left join campuses cam on cam.id = p.campus_id
  where p.email like 'test_.%'
)
select
  case
    when email like 'test1.%' then 'Nguoi thu 1'
    when email like 'test2.%' then 'Nguoi thu 2'
    else 'Nguoi thu 3'
  end as nguoi_thu,
  email, ten_hien_thi, vai, co_so, dang_nhap, vai_ok, gan_ket,
  case when dang_nhap = 'OK' and vai_ok = 'OK' and gan_ket like 'OK%'
       then '✔ SAN SANG' else '✘ CAN XEM LAI' end as ket_luan
from tk
order by email;


-- ============================================================================
-- DỌN SẠCH SAU KHI THỬ XONG — bỏ dấu chú thích ở khối dưới rồi chạy
-- ============================================================================
-- Xoá cả 9 tài khoản thử và mọi liên kết của chúng. Lớp 6A2 xoá riêng nếu muốn.
--
-- do $$
-- declare r record;
-- begin
--   for r in select id from profiles where email like 'test_.%' loop
--     perform admin_delete_user(r.id);
--   end loop;
--   delete from classes where name = '6A2' and school_year = '2026-2027';
-- end $$;
