-- 0089 — Dời học sinh sang lớp khác, có bước duyệt của lớp nhận
--
-- LUẬT (chủ dự án ra):
--   · GVCN lớp hiện tại ĐỀ NGHỊ dời một em sang lớp khác.
--   · GVCN lớp ĐÍCH duyệt hoặc từ chối.
--   · Trong lúc chờ, em VẪN Ở LỚP CŨ — vẫn điểm danh, vẫn tick, vẫn có tên trong danh sách.
--     Đây là điểm quan trọng nhất: một em "đang lơ lửng giữa hai lớp" là một em không ai điểm danh.
--   · Quản trị viên chuyển thẳng, không cần ai duyệt.
--
-- Vì sao phải có bước duyệt: lớp nhận là người chịu hậu quả — sĩ số, chỗ ngồi, WIG của lớp đều đổi.
-- Cho phép lớp này đẩy em sang lớp khác mà lớp kia không biết là cách tạo ra tranh cãi giữa hai
-- giáo viên mà hệ thống không có dấu vết nào để phân xử.

create table if not exists class_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  from_class_id uuid not null references classes(id) on delete cascade,
  to_class_id uuid not null references classes(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decide_note text,
  created_at timestamptz not null default now(),
  constraint khac_lop check (from_class_id <> to_class_id)
);

-- MỘT em chỉ có MỘT đề nghị đang chờ. Không có ràng buộc này thì bấm hai lần là hai dòng, rồi hai
-- lớp đích cùng duyệt và em bị đẩy đi hai nơi theo thứ tự ngẫu nhiên.
create unique index if not exists uq_transfer_pending_per_student
  on class_transfer_requests (student_id) where status = 'pending';

create index if not exists idx_transfer_to_class on class_transfer_requests (to_class_id, status);
create index if not exists idx_transfer_from_class on class_transfer_requests (from_class_id, status);

alter table class_transfer_requests enable row level security;

-- ĐỌC: quản trị, GVCN lớp gửi, GVCN lớp nhận, và hiệu trưởng của cơ sở có liên quan.
-- Học sinh KHÔNG đọc được: các em không cần biết người lớn đang bàn chuyện chuyển lớp của mình cho
-- tới khi nó thành sự thật, và một đề nghị bị từ chối mà em đọc được là một tổn thương không cần.
drop policy if exists transfer_read on class_transfer_requests;
create policy transfer_read on class_transfer_requests for select
  using (
    (select auth_role()) = 'admin'
    or is_class_teacher(from_class_id)
    or is_class_teacher(to_class_id)
    or exists (
      select 1 from classes c
      where c.id in (from_class_id, to_class_id)
        and (select auth_role()) = 'principal'
        and c.campus_id = (select auth_campus())
    )
  );

-- GHI: chỉ qua RPC bên dưới (SECURITY DEFINER). Không mở insert/update thẳng cho ai — mọi lối ghi
-- đều phải đi qua chỗ có kiểm tra quyền và có ghi nhật ký.
grant select on class_transfer_requests to authenticated;

-- ── Lớp có thể dời tới ────────────────────────────────────────────────────────────────────
-- GVCN chỉ ĐỌC được lớp của mình (RLS của bảng classes), nên không tự liệt kê được lớp đích.
-- Hàm này mở đúng một khe hẹp: tên các lớp đang hoạt động, không kèm gì khác.
create or replace function transfer_target_classes()
returns table (id uuid, name text, school_year text, campus_name text, gvcn text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.name, c.school_year, cs.name,
         coalesce(p.full_name, p.email)
  from classes c
  join campuses cs on cs.id = c.campus_id
  left join profiles p on p.id = c.homeroom_teacher_id
  where c.is_active and cs.is_active
    and (select auth_role()) in ('admin','principal','teacher')
  order by cs.name, c.name;
$$;

revoke all on function transfer_target_classes() from public;
grant execute on function transfer_target_classes() to authenticated;

-- ── Chuyển em sang lớp mới (dùng chung cho admin-chuyển-thẳng và duyệt-xong) ──────────────
create or replace function apply_class_transfer(p_student uuid, p_to_class uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Rút khỏi mọi lớp đang học khác. Bỏ luôn cờ trưởng điểm danh: chức ấy gắn với lớp cũ.
  update enrollments set is_active = false, is_attendance_leader = false
  where student_id = p_student and is_active and class_id <> p_to_class;

  insert into enrollments (class_id, student_id, is_active)
  values (p_to_class, p_student, true)
  on conflict (class_id, student_id) do update set is_active = true;
end;
$$;

-- ── Đề nghị dời ───────────────────────────────────────────────────────────────────────────
-- Trả về: 'moved' (admin chuyển thẳng) · 'requested' · 'exists' (đã có đề nghị đang chờ)
create or replace function request_class_transfer(p_student uuid, p_to_class uuid, p_note text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_from uuid;
  v_role user_role;
begin
  v_role := auth_role();

  select class_id into v_from from enrollments
  where student_id = p_student and is_active
  order by class_id limit 1;

  if v_from is null then
    raise exception 'Em này chưa ở lớp nào';
  end if;
  if v_from = p_to_class then
    raise exception 'Em đang ở chính lớp đó rồi';
  end if;
  if not exists (select 1 from classes c join campuses cs on cs.id = c.campus_id
                 where c.id = p_to_class and c.is_active and cs.is_active) then
    raise exception 'Lớp đích không còn hoạt động';
  end if;

  -- Ai được đề nghị: quản trị, GVCN lớp hiện tại, hoặc hiệu trưởng của cơ sở lớp ấy.
  if not (
    v_role = 'admin'
    or is_class_teacher(v_from)
    or exists (select 1 from classes c where c.id = v_from and v_role = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chỉ giáo viên chủ nhiệm của lớp hiện tại (hoặc quản trị) mới đề nghị dời được';
  end if;

  -- QUẢN TRỊ CHUYỂN THẲNG. Ghi lại một dòng đã-duyệt-sẵn để lịch sử không có lỗ: sau này nhìn lại
  -- vẫn biết em đã đi từ lớp nào sang lớp nào, ai quyết, lúc nào.
  if v_role = 'admin' then
    perform apply_class_transfer(p_student, p_to_class);
    insert into class_transfer_requests
      (student_id, from_class_id, to_class_id, requested_by, note, status, decided_by, decided_at)
    values (p_student, v_from, p_to_class, auth.uid(), p_note, 'approved', auth.uid(), now());
    return 'moved';
  end if;

  if exists (select 1 from class_transfer_requests where student_id = p_student and status = 'pending') then
    return 'exists';
  end if;

  insert into class_transfer_requests (student_id, from_class_id, to_class_id, requested_by, note)
  values (p_student, v_from, p_to_class, auth.uid(), p_note);
  return 'requested';
end;
$$;

-- ── Lớp đích duyệt / từ chối ──────────────────────────────────────────────────────────────
create or replace function decide_class_transfer(p_request uuid, p_approve boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_req class_transfer_requests%rowtype;
begin
  select * into v_req from class_transfer_requests where id = p_request;
  if v_req.id is null then raise exception 'Không tìm thấy đề nghị'; end if;
  if v_req.status <> 'pending' then raise exception 'Đề nghị này đã được xử lý rồi'; end if;

  -- Chỉ LỚP NHẬN mới quyết được. Lớp gửi không tự duyệt cho mình — đó là toàn bộ lý do có bước này.
  if not (
    auth_role() = 'admin'
    or is_class_teacher(v_req.to_class_id)
    or exists (select 1 from classes c where c.id = v_req.to_class_id
               and auth_role() = 'principal' and c.campus_id = auth_campus())
  ) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp nhận (hoặc quản trị) mới duyệt được';
  end if;

  if p_approve then
    perform apply_class_transfer(v_req.student_id, v_req.to_class_id);
  end if;

  update class_transfer_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decide_note = p_note
  where id = p_request;

  return case when p_approve then 'approved' else 'rejected' end;
end;
$$;

-- ── Người đề nghị rút lại ─────────────────────────────────────────────────────────────────
create or replace function cancel_class_transfer(p_request uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_req class_transfer_requests%rowtype;
begin
  select * into v_req from class_transfer_requests where id = p_request;
  if v_req.id is null or v_req.status <> 'pending' then
    raise exception 'Đề nghị không còn ở trạng thái chờ';
  end if;
  if not (auth_role() = 'admin' or is_class_teacher(v_req.from_class_id)) then
    raise exception 'Chỉ người đề nghị (hoặc quản trị) mới rút lại được';
  end if;
  update class_transfer_requests
  set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
  where id = p_request;
end;
$$;

revoke all on function request_class_transfer(uuid, uuid, text) from public;
revoke all on function decide_class_transfer(uuid, boolean, text) from public;
revoke all on function cancel_class_transfer(uuid) from public;
revoke all on function apply_class_transfer(uuid, uuid) from public;
grant execute on function request_class_transfer(uuid, uuid, text) to authenticated;
grant execute on function decide_class_transfer(uuid, boolean, text) to authenticated;
grant execute on function cancel_class_transfer(uuid) to authenticated;

comment on table class_transfer_requests is
  'Đề nghị dời học sinh sang lớp khác. Lớp gửi đề nghị, lớp nhận duyệt; trong lúc chờ em vẫn ở lớp cũ.';
