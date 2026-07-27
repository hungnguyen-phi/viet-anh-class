-- 0049 — Hiệu trưởng: quản lý giáo viên trong cơ sở + dữ liệu cho trang tổng hợp toàn trường
--
-- Bối cảnh: menu Hiệu trưởng trước đây có 6 mục thì 5 mục là view của ĐÚNG MỘT LỚP — lớp đầu
-- tiên sắp theo tên, chọn tuỳ tiện. Migration này cấp hai thứ HT thật sự cần:
--   (1) quản lý giáo viên trong cơ sở mình (mời, đổi vai trò, vô hiệu)
--   (2) một RPC tổng hợp mọi lớp kèm KHỐI để dựng bảng toàn trường

-- ── 1) Lời mời phải mang theo CƠ SỞ ────────────────────────────────────────
-- Trước đây pending_user_grants không có campus_id và handle_new_user không gán
-- profiles.campus_id. Hệ quả: giáo viên được mời có campus_id = NULL, nên mọi policy giới hạn
-- theo `campus_id = auth_campus()` KHÔNG khớp họ — HT mời xong lại không quản được. Vá gốc.
alter table pending_user_grants add column campus_id uuid references campuses(id) on delete set null;

comment on column pending_user_grants.campus_id is
  'Cơ sở gán cho người được mời khi họ đăng nhập lần đầu. HT mời thì luôn là cơ sở của HT.';

-- ── 2) handle_new_user: gán campus_id theo lời mời ─────────────────────────
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_role user_role;
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_grant pending_user_grants%rowtype;
  v_has_grant boolean := false;   -- KHÔNG dùng `found`: sau INSERT bên dưới `found` mang kết quả
                                  -- của INSERT chứ không phải của SELECT grant (lỗi cũ, sửa luôn).
begin
  select default_role into v_role from signup_email_domains where domain = v_domain;
  if v_role is null then
    if exists (select 1 from parent_invitations where lower(email) = v_email and status in ('pending','accepted')) then
      v_role := 'parent';
    else
      v_role := 'pending';
    end if;
  end if;

  select * into v_grant from pending_user_grants where lower(email) = v_email;
  v_has_grant := v_grant.email is not null;
  if v_has_grant then
    v_role := v_grant.role;
  end if;

  insert into profiles (id, email, full_name, role, campus_id)
  values (new.id, new.email, v_full_name, v_role,
          case when v_has_grant then v_grant.campus_id else null end)
  on conflict (id) do nothing;

  if v_has_grant then
    if v_grant.role = 'teacher' and v_grant.class_id is not null then
      update classes set homeroom_teacher_id = new.id where id = v_grant.class_id;
    elsif v_grant.role = 'student' and v_grant.class_id is not null then
      insert into enrollments (class_id, student_id) values (v_grant.class_id, new.id)
      on conflict (class_id, student_id) do nothing;
    elsif v_grant.role = 'parent' and v_grant.student_id is not null then
      insert into parent_links (parent_id, student_id, relationship)
      values (new.id, v_grant.student_id, 'guardian')
      on conflict (parent_id, student_id) do nothing;
    end if;
    delete from pending_user_grants where lower(email) = v_email;
  end if;

  if v_role = 'parent' then
    insert into parent_links (parent_id, student_id, relationship)
    select new.id, pi.student_id, 'guardian'
    from parent_invitations pi
    where lower(pi.email) = v_email and pi.status in ('pending','accepted')
    on conflict (parent_id, student_id) do nothing;
    update parent_invitations set status = 'accepted'
    where lower(email) = v_email and status = 'pending';
  end if;

  return new;
end;
$$;

-- ── 3) HT quản lý lời mời trong cơ sở mình ─────────────────────────────────
drop policy if exists rls_all_pending_user_grants on public.pending_user_grants;
create policy rls_all_pending_user_grants on public.pending_user_grants as permissive for ALL to public
  using (
    ((select auth_role()) = 'admin'::user_role)
    or (((select auth_role()) = 'principal'::user_role)
        and campus_id = (select auth_campus())
        and role in ('teacher'::user_role, 'student'::user_role, 'parent'::user_role))
  )
  with check (
    ((select auth_role()) = 'admin'::user_role)
    or (((select auth_role()) = 'principal'::user_role)
        and campus_id = (select auth_campus())
        -- CHẶN LEO THANG: HT không mời được admin/principal, chỉ mời vai trò dưới quyền.
        and role in ('teacher'::user_role, 'student'::user_role, 'parent'::user_role))
  );

-- ── 4) HT sửa hồ sơ nhân sự trong cơ sở mình ───────────────────────────────
-- "Toàn quyền như Admin" nhưng CÓ TRẦN: chỉ đụng được người đang là teacher/pending, và chỉ
-- đặt lại thành teacher/pending. Không cho HT tự nâng ai (kể cả chính mình) lên admin/principal
-- — đó là leo thang đặc quyền, không phải quản lý nhân sự.
drop policy if exists rls_update_profiles on public.profiles;
create policy rls_update_profiles on public.profiles as permissive for UPDATE to public
  using (
    (id = (select auth.uid()))
    or (((select auth_role()) = 'principal'::user_role)
        and campus_id = (select auth_campus())
        and role in ('teacher'::user_role, 'pending'::user_role))
  )
  with check (
    (id = (select auth.uid()))
    or (((select auth_role()) = 'principal'::user_role)
        and campus_id = (select auth_campus())
        and role in ('teacher'::user_role, 'pending'::user_role))
  );

-- ── 4b) Tầng bảo vệ thứ hai: trigger cột đặc quyền ─────────────────────────
-- RLS ở trên quyết định HT được đụng vào DÒNG nào; trigger này quyết định được đổi CỘT nào.
-- Bản cũ chặn cứng "chỉ admin" nên nếu để nguyên thì policy trên vô nghĩa — HT vẫn không đổi
-- được vai trò của ai. Nới đúng một khe cho HT, giữ nguyên mọi ràng buộc khác:
--   • người bị sửa phải THUỘC CƠ SỞ của HT
--   • KHÔNG cho chuyển cơ sở (đưa người sang cơ sở khác = vượt khỏi phạm vi HT)
--   • KHÔNG cho đổi email (email là danh tính đăng nhập — đổi được là chiếm được tài khoản)
--   • vai trò cũ VÀ mới đều phải nằm trong {teacher, pending} → không nâng ai lên
--     admin/principal, cũng không đụng được admin/principal sẵn có
create or replace function protect_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor user_role := coalesce(auth_role(), 'pending');
begin
  if (new.role is distinct from old.role
      or new.campus_id is distinct from old.campus_id
      or new.email is distinct from old.email) then

    if v_actor = 'admin' then
      return new;
    end if;

    if v_actor = 'principal'
       and old.campus_id is not distinct from auth_campus()
       and new.campus_id is not distinct from old.campus_id
       and new.email is not distinct from old.email
       and old.role in ('teacher'::user_role, 'pending'::user_role)
       and new.role in ('teacher'::user_role, 'pending'::user_role)
    then
      return new;
    end if;

    raise exception 'Chỉ admin (hoặc hiệu trưởng, với giáo viên trong cơ sở mình) được đổi role/campus/email';
  end if;
  return new;
end;
$$;

-- ── 5) Dữ liệu cho bảng tổng hợp toàn trường ───────────────────────────────
-- Một lượt truy vấn trả về MỌI lớp trong phạm vi kèm KHỐI, điểm thi đua, điểm danh hôm nay và
-- sĩ số — đủ để trang gom nhóm theo khối mà không phải hỏi thêm lần nào (tránh N+1 theo lớp).
-- SECURITY DEFINER + lọc theo auth_role/auth_campus y hệt campus_ranks: admin thấy toàn hệ
-- thống, HT chỉ thấy cơ sở mình.
create or replace function campus_rollup()
returns table(
  class_id uuid, class_name text, school_year text,
  grade_id uuid, grade_name text, grade_sort int,
  score numeric, att_today bigint, student_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with scores as (select * from class_competition_scores()),
  att as (
    select class_id, count(*) as n
    from attendance_records
    where date = vn_today()
    group by class_id
  ),
  enr as (
    select class_id, count(*) as n
    from enrollments
    where is_active
    group by class_id
  )
  select c.id, c.name, c.school_year,
         c.grade_id,
         coalesce(g.name, c.grade, '—'),
         coalesce(g.sort_order, 9999),
         coalesce(s.score, 0),
         coalesce(att.n, 0),
         coalesce(enr.n, 0)
  from classes c
  left join grades g on g.id = c.grade_id
  left join scores s on s.class_id = c.id
  left join att    on att.class_id = c.id
  left join enr    on enr.class_id = c.id
  where c.school_year = current_school_year()
    and c.is_active
    and (auth_role() = 'admin' or (auth_role() = 'principal' and c.campus_id = auth_campus()))
  order by coalesce(g.sort_order, 9999), c.name;
$$;

revoke all on function campus_rollup() from public, anon;
grant execute on function campus_rollup() to authenticated;
