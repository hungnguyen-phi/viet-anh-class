-- 0188 — ĐIỀN profiles.campus_id CHO HỒ SƠ THIẾU (audit lại 04/09/2026: BGH không xem được em)
--
-- Policy rls_select_profiles nhánh principal xét `profiles.campus_id = auth_campus()`, nhưng 11/18
-- học sinh + 2 giáo viên + 3 BGH có campus_id NULL (cơ sở chỉ nằm ở enrollments→classes / lớp chủ
-- nhiệm). can_view_student() trả true mà SELECT profiles ra 0 dòng → "không có quyền xem".
-- Sửa DỮ LIỆU + chặn tái diễn bằng trigger; KHÔNG đổi policy.
--
-- Đối chiếu live 04/09: enrollments không có trigger nào; classes chỉ có trg_protect_class_cols
-- (protect_class_privileged_cols) — không đụng. Hàm mới nằm ở schema private (trigger function,
-- không cần grant; default privileges public đã thu ở 0187 nên không cấp gì thêm).
--
-- KHÔNG SUY ĐƯỢC (chủ dự án tự gán qua Quản trị → Người dùng): BGH aihoa@, bgh@, tuyen@ (không
-- có lớp nào để suy); GV test1.gvcn@ (không chủ nhiệm lớp nào).

-- 1. Học sinh: campus của lớp đang ghi danh, chỉ khi DUY NHẤT một cơ sở (nhiều cơ sở → để nguyên).
-- protect_profile_privileged_cols chặn mọi đổi campus_id trừ khi auth_role()='admin' → mượn danh
-- một admin cho riêng giao dịch này (set_config … true = local), như đợt nhập GVCN 03/09.
do $$
declare v_hs int; v_gv int; v_admin uuid;
begin
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception '0188: không có admin để mượn danh'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);   -- auth.uid() ưu tiên khoá này

  update profiles p
  set campus_id = s.campus_id
  from (
    select e.student_id, min(k.campus_id::text)::uuid as campus_id
    from enrollments e join classes k on k.id = e.class_id
    where e.is_active
    group by e.student_id
    having count(distinct k.campus_id) = 1
  ) s
  where p.id = s.student_id and p.campus_id is null and p.role = 'student';
  get diagnostics v_hs = row_count;

  -- 2. Giáo viên: campus của lớp chủ nhiệm đang hoạt động, chỉ khi duy nhất một cơ sở.
  update profiles p
  set campus_id = s.campus_id
  from (
    select k.homeroom_teacher_id as gv, min(k.campus_id::text)::uuid as campus_id
    from classes k
    where k.is_active and k.homeroom_teacher_id is not null
    group by k.homeroom_teacher_id
    having count(distinct k.campus_id) = 1
  ) s
  where p.id = s.gv and p.campus_id is null and p.role = 'teacher';
  get diagnostics v_gv = row_count;

  raise notice '0188: điền campus_id cho % học sinh, % giáo viên', v_hs, v_gv;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- 3. Trigger: ghi danh mới / đổi GVCN → tự điền campus_id nếu hồ sơ đang trống.
-- Chạy trong phiên của người ghi danh (GVCN/admin) — protect_profile_privileged_cols sẽ chặn nếu
-- không phải admin, nên trong lúc UPDATE mượn danh admin qua claims cục bộ rồi TRẢ LẠI claims cũ.
create or replace function private.ho_so_campus_theo_lop() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_campus uuid; v_ai uuid; v_admin uuid; v_claims_cu text; v_sub_cu text;
begin
  if tg_table_name = 'enrollments' then
    if not new.is_active then return new; end if;
    select campus_id into v_campus from classes where id = new.class_id;
    v_ai := new.student_id;
  elsif tg_table_name = 'classes' then
    if new.homeroom_teacher_id is null then return new; end if;
    v_campus := new.campus_id; v_ai := new.homeroom_teacher_id;
  else
    return new;
  end if;
  if v_campus is null or not exists (select 1 from profiles where id = v_ai and campus_id is null) then
    return new;
  end if;
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  v_claims_cu := coalesce(current_setting('request.jwt.claims', true), '');
  v_sub_cu := coalesce(current_setting('request.jwt.claim.sub', true), '');
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);   -- auth.uid() ưu tiên khoá này
  update profiles set campus_id = v_campus where id = v_ai and campus_id is null;
  perform set_config('request.jwt.claims', v_claims_cu, true);
  perform set_config('request.jwt.claim.sub', v_sub_cu, true);
  return new;
end $$;

drop trigger if exists trg_ho_so_campus_ghi_danh on enrollments;
create trigger trg_ho_so_campus_ghi_danh
  after insert or update of is_active, class_id on enrollments
  for each row execute function private.ho_so_campus_theo_lop();

drop trigger if exists trg_ho_so_campus_gvcn on classes;
create trigger trg_ho_so_campus_gvcn
  after insert or update of homeroom_teacher_id on classes
  for each row execute function private.ho_so_campus_theo_lop();
