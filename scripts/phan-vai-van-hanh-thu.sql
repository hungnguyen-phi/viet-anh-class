-- ══════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN LẠI VAI CHO ĐỢT VẬN HÀNH THẬT (07/08/2026)
--
--   npm run sql -- scripts/phan-vai-van-hanh-thu.sql
--
-- Chủ dự án đã mời 33 người: 3 giáo viên chủ nhiệm + 30 học sinh. Nhưng một lớp vận hành thật
-- cần đủ vai để chạy hết vòng, nên file này chuyển 3 trong số 30 sang vai khác:
--
--   · 1 quản trị viên  → vui.nguyenvan@truongvietanh.com   (đang là HS 12A1)
--   · 2 ban giám hiệu  → y.pham@…  (đang là HS 10A1), vanduy@…  (đang là HS 12A1)
--   · 27 em còn lại giữ nguyên vai học sinh — 10A1: 10 em · 11A1: 9 em · 12A1: 8 em
--
-- Ai đổi thành ai thì sửa ba khối UPDATE bên dưới, hoặc làm thẳng trong /admin → "Mời người
-- dùng" (mời lại cùng email với vai khác là ghi đè lời mời cũ). Chưa ai đăng nhập lần nào nên
-- đổi lúc này không đụng tới dữ liệu của bất kỳ ai.
--
-- KHÔNG có phụ huynh trong file này — có lý do, xem khối cuối.
-- ══════════════════════════════════════════════════════════════════════════════════════════
set search_path = public;

begin;

-- ── 1. QUẢN TRỊ VIÊN ──────────────────────────────────────────────────────────────────────
-- class_id về null: quản trị viên không chủ nhiệm lớp nào, để nguyên lớp cũ thì lúc đăng nhập
-- trigger handle_new_user vẫn cố gán lớp cho họ.
update pending_user_grants
   set role = 'admin', class_id = null, campus_id = null
 where lower(email) = 'vui.nguyenvan@truongvietanh.com';

-- ── 2. BAN GIÁM HIỆU ──────────────────────────────────────────────────────────────────────
-- PHẢI CÓ campus_id. Quyền của BGH là "mọi lớp TRONG CƠ SỞ MÌNH" (auth_campus() trong RLS) —
-- thiếu cơ sở thì họ đăng nhập vào, vai đúng là hiệu trưởng, mà mở màn nào cũng trống trơn.
update pending_user_grants
   set role = 'principal',
       class_id = null,
       campus_id = (select id from campuses where name = 'Việt Anh Gò Vấp')
 where lower(email) in ('y.pham@truongvietanh.com', 'vanduy@truongvietanh.com');

-- ── 3. TRẢ LỚP VỀ CHO GIÁO VIÊN THẬT ──────────────────────────────────────────────────────
--
-- ĐÂY LÀ CHỖ SẼ CHẶN CẢ ĐỢT VẬN HÀNH NẾU KHÔNG SỬA TRƯỚC.
--
-- handle_new_user chỉ gán lớp cho giáo viên được mời khi lớp ấy CHƯA AI chủ nhiệm:
--     update classes set homeroom_teacher_id = new.id
--      where id = v_grant.class_id and homeroom_teacher_id is null;
--
-- Mà 10A1 đang đứng tên claudia@ và 11A1 đứng tên test1.gvcn@ — hai tài khoản thử. Nên nếu để
-- nguyên: cô Thắm và cô Như đăng nhập, nhận đúng vai giáo viên, nhưng KHÔNG nhận được lớp; lời
-- mời thì bị xoá ngay sau đó (dòng `delete from pending_user_grants` cuối trigger), nên không
-- có lần thứ hai. Hai cô mở app ra thấy "Chưa có lớp" và không ai hiểu vì sao.
--
-- CHẠY DƯỚI DANH NGHĨA QUẢN TRỊ VIÊN THẬT.
--
-- Cột homeroom_teacher_id có chốt chặn riêng (trg_protect_class_cols, migration 0018): ai không
-- phải admin thì không đổi được — chốt ấy sinh ra để GVCN không tự phong mình chủ nhiệm lớp khác.
-- Kết nối psql không mang theo phiên đăng nhập nào nên auth_role() trả null và bị chặn đúng như
-- một người lạ. Đặt request.jwt.claims = id của quản trị viên là cách Supabase dùng để nói "lệnh
-- này do người ấy ra" — không gỡ chốt, không tắt trigger, và ghi rõ ở đây ai đứng tên.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id::text from profiles where lower(email) = 'hung.nguyen@truongvietanh.com'))::text,
  true  -- true = chỉ trong transaction này
);

-- Chỉ gỡ khi người đang đứng tên ĐÚNG LÀ tài khoản thử — lớp nào đã có giáo viên thật thì để yên.
update classes
   set homeroom_teacher_id = null
 where name in ('10A1', '11A1')
   and homeroom_teacher_id in (
     select id from profiles
      where lower(email) in ('claudia@truongvietanh.com', 'test1.gvcn@truongvietanh.com')
   );

commit;

-- ── SOI LẠI ───────────────────────────────────────────────────────────────────────────────
select c.name as lop,
       coalesce(p.email, '(trống — chờ GVCN thật đăng nhập)') as dang_chu_nhiem,
       (select count(*) from pending_user_grants g where g.class_id = c.id and g.role = 'student') as hs_cho_dang_nhap
  from classes c
  left join profiles p on p.id = c.homeroom_teacher_id
 order by c.name;

select role::text as vai, count(*) as so_nguoi, string_agg(email, ', ' order by email) as danh_sach
  from pending_user_grants
 group by role
 order by role;

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- PHỤ HUYNH — VÌ SAO KHÔNG NẰM TRONG FILE NÀY
--
-- Hai lý do, cả hai đều là chuyện phải biết trước khi mời:
--
-- 1. PHẢI CÓ HỌC SINH ĐÃ ĐĂNG NHẬP TRƯỚC. Lời mời phụ huynh gắn vào profiles.id của con
--    (parent_invitations.student_id). Em chưa đăng nhập lần đầu thì chưa có id nào để gắn.
--    → Mời phụ huynh ở NHỊP 3, sau khi các em đã vào.
--
-- 2. ĐỪNG DÙNG EMAIL @truongvietanh.com LÀM PHỤ HUYNH THỬ.
--    handle_new_user tra miền trước: miền truongvietanh.com đã có vai mặc định 'pending', nên
--    nhánh kiểm parent_invitations bị BỎ QUA hoàn toàn —
--        select default_role into v_role from signup_email_domains where domain = v_domain;
--        if v_role is null then  ...kiểm parent_invitations...  end if;
--    Người đó đăng nhập sẽ rơi vào vai 'pending' và thấy màn "Tài khoản chưa được cấp quyền".
--    Email ngoài miền trường (gmail…) thì đúng luồng, vì miền đó không có trong bảng.
--    → Dùng đúng email thật của phụ huynh, hoặc một gmail bất kỳ để thử.
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- TUỲ CHỌN — DỌN DỮ LIỆU THỬ TRONG 10A1 TRƯỚC KHI CHẠY THẬT
--
-- 10A1 đang mang vết của đợt thử: alex@truongvietanh.com nằm trong danh sách với vai học sinh,
-- 4 mục tiêu WIG do chủ dự án tạo lúc dò lỗi (trong đó có mục tiêu tuần W37 lạc sang tháng 9 do
-- lỗi cha-chọn-sẵn đã sửa). Để nguyên thì lớp thật mở ra đã có sẵn dữ liệu không của ai.
--
-- KHÔNG tự chạy — bỏ dấu chú thích khi đã quyết. Xoá WIG là xoá cả lead measure và lượt tick
-- bên trong, không hoàn tác được.
--
-- delete from wigs where class_id = (select id from classes where name = '10A1');
-- update enrollments set is_active = false
--  where class_id = (select id from classes where name = '10A1')
--    and student_id = (select id from profiles where lower(email) = 'alex@truongvietanh.com');
-- ══════════════════════════════════════════════════════════════════════════════════════════
