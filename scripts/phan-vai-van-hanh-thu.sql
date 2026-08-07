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
-- PHỤ HUYNH — MỜI Ở NHỊP CUỐI, KHÔNG PHẢI Ở ĐÂY
--
-- Lời mời phụ huynh gắn vào profiles.id của CON (parent_invitations.student_id). Em chưa đăng
-- nhập lần đầu thì chưa có id nào để gắn — nên bước này không làm sớm hơn được, dù muốn.
--
-- Còn chuyện email của trường: TRƯỚC 0096 thì dùng không được, và hỏng lặng lẽ. handle_new_user
-- tra miền trước, miền truongvietanh.com có vai mặc định 'pending' nên cả nhánh kiểm
-- parent_invitations bị bỏ qua; người được mời đăng nhập vào chỉ thấy "Tài khoản chưa được cấp
-- quyền" trong khi lời mời nằm sờ sờ trong bảng. 0096 đã sửa: lời mời thắng vai mặc định
-- 'pending', vì 'pending' là chỗ đứng tạm chứ không phải một khẳng định.
--
-- Nay email của trường dùng làm phụ huynh được. Kiểm bằng
-- scripts/test-phu-huynh-mail-truong.sql — nó tạo tài khoản thật để trigger chạy y như lúc đăng
-- nhập Google, rồi rollback.
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- ĐÃ DỌN DỮ LIỆU THỬ TRONG 10A1 (07/08, chủ dự án chốt "dọn luôn đi")
--
-- 10A1 mang vết của đợt dò lỗi: mấy mục tiêu WIG tạo lúc thử, và alex@truongvietanh.com — tài
-- khoản của chính chủ dự án — nằm trong danh sách với vai học sinh. Để nguyên thì giáo viên thật
-- mở lớp ra đã thấy sẵn dữ liệu không của ai.
--
-- Mục tiêu thì XOÁ (kéo theo việc để tick và lượt tick bên trong). Còn alex@ thì CHO RỜI LỚP chứ
-- không xoá: rời lớp là tắt cờ, mọi thứ gắn với em vẫn còn nguyên nếu sau này cần tra lại, mà
-- danh sách lớp thì sạch ngay.
--
-- Đã chạy rồi, giữ lại đây để biết đã làm gì. Ba lớp sau khi dọn: 0 mục tiêu, 0 em đang học,
-- 8 · 9 · 8 em chờ đăng nhập.
--
-- delete from wigs where class_id = (select id from classes where name = '10A1');
-- update enrollments set is_active = false, is_attendance_leader = false
--  where class_id = (select id from classes where name = '10A1')
--    and student_id = (select id from profiles where lower(email) = 'alex@truongvietanh.com');
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- BỔ SUNG 07/08 — HAI PHỤ HUYNH THỬ, LẤY NGAY TRONG DANH SÁCH EMAIL CỦA TRƯỜNG
--
-- Chủ dự án chốt: phụ huynh chọn ngẫu nhiên trong chính dãy mail đã mời. Migration 0096 đã sửa
-- để email của trường vẫn ra đúng vai phụ huynh (trước đó vai mặc định 'pending' của miền nuốt
-- mất lời mời).
--
-- Lấy 2 em ở 10A1 vì lớp ấy đông nhất — sau khi rút còn 8 · 9 · 8, đều ba lớp.
--
-- XOÁ HẲN lời mời học sinh của họ, không để đó chờ. Vì nếu để, họ đăng nhập trước khi được mời
-- làm phụ huynh thì thành học sinh thật — và lúc ấy lời mời phụ huynh không đổi lại được nữa,
-- vai đã nằm trong hồ sơ rồi. Không có lời mời nào thì họ chỉ thấy màn "chờ cấp quyền", đúng
-- nghĩa "chưa tới lượt", và mời lại lúc nào cũng được.
--
-- MỜI THẬT ở NHỊP 7, sau khi ít nhất một em đã đăng nhập: /admin › Mời phụ huynh, chọn con.
-- Lời mời gắn vào id của con, mà id chỉ có sau lần đăng nhập đầu của em ấy.
delete from pending_user_grants
 where lower(email) in ('tramanh.nguyen@truongvietanh.com', 'tien.nguyen@truongvietanh.com');

select role::text as vai, count(*) as so_nguoi from pending_user_grants group by role order by role;
