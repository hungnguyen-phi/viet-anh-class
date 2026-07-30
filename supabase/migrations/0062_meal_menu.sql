-- 0062 — Thực đơn bữa ăn theo NGÀY, phạm vi CƠ SỞ (campus).
--
-- Phụ huynh xin cái này. Điểm cần chú ý về PHẠM VI: đây là tính năng đầu tiên của app KHÔNG
-- gắn với lớp. Cả trường ăn cùng một thực đơn, nên gắn theo campus. Gắn theo lớp sẽ bắt nhân
-- viên văn phòng nhập lại cùng một thực đơn 30 lần mỗi ngày — chắc chắn sẽ có lớp bị bỏ sót,
-- rồi phụ huynh lớp đó tưởng hôm nay con không được ăn.

set search_path = public;

-- Bốn bữa để phủ cả trường bán trú lẫn nội trú. 'snack' là bữa xế chiều.
do $$ begin
  create type meal_slot as enum ('breakfast', 'lunch', 'snack', 'dinner');
exception when duplicate_object then null;
end $$;

create table if not exists meal_menus (
  campus_id   uuid not null references campuses(id) on delete cascade,
  date        date not null,
  meal        meal_slot not null,

  -- Thực đơn để ở TEXT thô (mỗi món một dòng), CỐ Ý không phải jsonb và không phải bảng món ăn.
  -- Vì sao: người nhập là văn phòng/bếp gõ tay mỗi sáng, và trường CHƯA có danh mục món chuẩn
  -- hoá. Chuẩn hoá bây giờ nghĩa là bắt họ chọn từ một danh mục rỗng, rồi họ sẽ tạo món mới cho
  -- từng biến thể ("canh cải", "canh cải thịt bằm", "canh cải nấu thịt") — danh mục thành rác
  -- ngay tuần đầu. Khi nào cần lọc dị ứng THEO MÓN thì hãy tách bảng; lúc đó đã có dữ liệu thật
  -- để biết danh mục gồm những gì.
  items       text not null check (btrim(items) <> ''),

  -- Ghi chú chung: đổi món đột xuất, lưu ý dị ứng, món chay thay thế.
  note        text,

  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (campus_id, date, meal)
);

comment on table meal_menus is
  'Thực đơn theo ngày của một CƠ SỞ (cả trường ăn chung). Admin + hiệu trưởng cơ sở đó nhập; mọi người thuộc cơ sở đó đọc.';
comment on column meal_menus.items is
  'Danh sách món dạng văn bản, mỗi món một dòng. Chưa chuẩn hoá thành bảng món vì trường chưa có danh mục.';

drop trigger if exists trg_meal_menus_touch on meal_menus;
create trigger trg_meal_menus_touch before update on meal_menus
  for each row execute function touch_updated_at();


-- ── Hàm "tôi có thuộc cơ sở này không" ─────────────────────────────────────
-- ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT CỦA MIGRATION NÀY. Đừng thay bằng `campus_id = auth_campus()`.
--
-- profiles.campus_id KHÔNG ĐÁNG TIN với phụ huynh, và bằng chứng nằm ngay trong repo:
--   • handle_new_user (0049) chỉ gán profiles.campus_id khi người đó đăng nhập TỪ MỘT LỜI MỜI
--     trong pending_user_grants (nhánh `case when v_has_grant then v_grant.campus_id else null end`).
--   • Nhưng luồng mời phụ huynh của app lại đi qua bảng KHÁC — parent_invitations
--     (app/[locale]/(dashboard)/admin/actions.ts:252 + edge function invite-parent). Nhánh xử lý
--     'parent' trong handle_new_user chỉ tạo parent_links, KHÔNG hề gán campus_id.
-- Hệ quả: phần lớn phụ huynh có campus_id = NULL. Mà trong SQL, `NULL = NULL` cho ra NULL chứ
-- không phải TRUE → policy không cho lọt dòng nào → THỰC ĐƠN HIỆN TRỐNG ĐÚNG VỚI NHÓM NGƯỜI
-- ĐÃ XIN TÍNH NĂNG NÀY. Và không ai báo "sai quyền" cả, họ chỉ nói "app hỏng", nên lỗi này rất
-- lâu mới bị tìm ra.
--
-- Cách chữa: suy ra cơ sở từ chỗ ĐÁNG TIN NHẤT của từng vai, thay vì tin một cột duy nhất:
--   nhân sự  → profiles.campus_id (được gán chắc chắn khi admin/HT tạo tài khoản, xem 0050)
--   học sinh → cơ sở của LỚP em đang học
--   phụ huynh→ cơ sở của lớp CON mình đang học
-- SECURITY DEFINER: bắt buộc, vì hàm đọc enrollments/classes/parent_links — để invoker thì RLS
-- của chính các bảng đó sẽ chặn, và tệ hơn là gây đệ quy policy.
create or replace function is_my_campus(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select
    auth_role() = 'admin'
    or c = auth_campus()
    or exists (
      select 1
      from enrollments e
      join classes cl on cl.id = e.class_id
      where e.student_id = auth.uid() and e.is_active and cl.campus_id = c
    )
    or exists (
      select 1
      from parent_links pl
      join enrollments e on e.student_id = pl.student_id and e.is_active
      join classes cl on cl.id = e.class_id
      where pl.parent_id = auth.uid() and cl.campus_id = c
    );
$$;

comment on function is_my_campus(uuid) is
  'Tôi có thuộc cơ sở c không. Suy ra theo vai (nhân sự: hồ sơ; HS: lớp đang học; PH: lớp của con) vì profiles.campus_id thường NULL với phụ huynh.';

revoke all on function is_my_campus(uuid) from public, anon;
grant execute on function is_my_campus(uuid) to authenticated;

alter table meal_menus enable row level security;

-- ĐỌC: mọi người thuộc cơ sở đó, suy ra bằng is_my_campus (xem giải thích dài ở phần DDL).
-- Thực đơn không phải dữ liệu cá nhân của bất kỳ đứa trẻ nào — nó là thông tin vận hành chung —
-- nên đây là bảng duy nhất trong ba bảng mới có phạm vi đọc RỘNG. Nhưng rộng đến CƠ SỞ thôi,
-- không phải toàn hệ thống: cơ sở khác nhau có bếp khác nhau, thực đơn khác nhau, và biết được
-- lịch ăn của một cơ sở mình không thuộc về thì không mang lại giá trị gì ngoài rò thông tin
-- vận hành. Không dùng `auth.uid() is not null`.
drop policy if exists rls_select_meal_menus on meal_menus;
create policy rls_select_meal_menus on meal_menus for select
  using (is_my_campus(campus_id));

-- NHẬP/SỬA/XOÁ: admin (mọi cơ sở) + hiệu trưởng của ĐÚNG cơ sở đó.
-- Ở nhánh GHI thì dùng auth_campus() (tức profiles.campus_id) là ĐÚNG và an toàn, khác với
-- nhánh đọc: hiệu trưởng luôn được gán campus_id có chủ đích (0049/0050), và nếu một HT nào đó
-- lỡ NULL thì hậu quả là "không nhập được" — hỏng theo hướng ĐÓNG. Còn ở nhánh đọc, NULL gây
-- hỏng theo hướng "không thấy gì", tức là hỏng tính năng. Hai nhánh chịu rủi ro khác nhau nên
-- được phép dùng hai cách xác định cơ sở khác nhau.
-- GIÁO VIÊN KHÔNG ĐƯỢC GHI: đề bài nói rõ, và thực tế thực đơn do bếp/văn phòng quyết. Cho GVCN
-- sửa thì 30 người cùng sửa một dòng, không ai chịu trách nhiệm khi sai.
-- Bọc (select auth_role()) theo đúng phép biến đổi đã chứng minh ở 0048: hàm STABLE không nhận
-- cột nào → Postgres nâng thành InitPlan, tính một lần cho cả câu thay vì gọi lại từng dòng.
drop policy if exists rls_all_meal_menus on meal_menus;
create policy rls_all_meal_menus on meal_menus for all
  using (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and campus_id = (select auth_campus()))
  )
  with check (
    (select auth_role()) = 'admin'::user_role
    or ((select auth_role()) = 'principal'::user_role and campus_id = (select auth_campus()))
  );

grant select, insert, update, delete on meal_menus to authenticated;

-- campus_id (khoá ngoại) ĐÃ CÓ chỉ mục nhờ là cột đầu của khoá chính (campus_id, date, meal),
-- và chính khoá chính đó phục vụ luôn truy vấn chính "cơ sở X, ngày Y" / "cơ sở X, tuần này".
-- Nên ở đây chỉ còn hai chỗ thật sự thiếu:

-- 1) Màn của admin: "hôm nay TOÀN HỆ THỐNG ăn gì" — truy vấn này KHÔNG có campus_id trong điều
--    kiện, nên khoá chính vô dụng với nó (cột đầu không bị ràng buộc) và Postgres sẽ quét bảng.
create index if not exists idx_meal_menus_date on meal_menus (date desc);

-- 2) Khoá ngoại thứ hai, chưa được chỉ mục nào phủ. Đây đúng loại cảnh báo mà advisor đã bắt ở
--    0053: thiếu index FK thì mỗi lần xoá một profile phải quét toàn bảng này để kiểm ràng buộc.
create index if not exists idx_meal_menus_updated_by on meal_menus (updated_by);
