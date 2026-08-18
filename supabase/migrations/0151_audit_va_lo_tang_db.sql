-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0151 — VÁ CÁC LỖ TẦNG DB TỪ AUDIT 18/08/2026 (dàn agent + kiểm sống trên production)
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. [CRITICAL] student_checkin(4 tham số) đang cho anon/PUBLIC gọi → GIẢ ĐIỂM DANH ──────────
-- student_checkin là SECURITY DEFINER, ghi thẳng attendance_records + mood_checkins cho một
-- p_student BẤT KỲ, và tự nhận p_ip do người gọi nhập (nên bỏ qua cổng IP). Thiết kế: CHỈ
-- service_role gọi (app đi qua createAdminClient sau khi đọc IP thật từ header). Nhưng chuỗi
-- revoke cũ (0032/0037/0082) chỉ nhắm overload 3 THAM SỐ; bản 4 tham số (thêm p_buoi ở 0091)
-- CHƯA từng bị revoke. ACL production 18/08: {=X, anon=X, authenticated=X} — kẻ CHƯA đăng nhập
-- dùng anon key công khai cũng gọi được. Đây đúng là lỗ 0032 từng vá, tái sinh khi thêm tham số.
revoke all on function public.student_checkin(uuid, mood_level, text, text) from public, anon, authenticated;
grant execute on function public.student_checkin(uuid, mood_level, text, text) to service_role;

-- ── 2. [HIGH] 6 FK v3 trỏ profiles thiếu ON DELETE → không xoá được tài khoản trẻ em ──────────
-- Chuẩn dự án (0021): mọi FK về profiles phải SET NULL/CASCADE để admin_delete_user (xoá dữ liệu
-- theo yêu cầu phụ huynh) chạy trót lọt. Em A từng đứng ở counterpart_id trong biên bản PDR của
-- em B → xoá A văng foreign_key_violation. NOT NULL thì phải nới trước mới SET NULL được.
alter table pdr_meetings alter column counterpart_id drop not null;
alter table buddy_pairs  alter column created_by     drop not null;
alter table pdr_schedules alter column created_by    drop not null;

alter table pdr_meetings drop constraint pdr_meetings_counterpart_id_fkey,
  add constraint pdr_meetings_counterpart_id_fkey foreign key (counterpart_id) references profiles(id) on delete set null;
alter table pdr_meetings drop constraint pdr_meetings_second_buddy_id_fkey,
  add constraint pdr_meetings_second_buddy_id_fkey foreign key (second_buddy_id) references profiles(id) on delete set null;
alter table pdr_meetings drop constraint pdr_meetings_acknowledged_by_fkey,
  add constraint pdr_meetings_acknowledged_by_fkey foreign key (acknowledged_by) references profiles(id) on delete set null;
alter table buddy_pairs drop constraint buddy_pairs_created_by_fkey,
  add constraint buddy_pairs_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;
alter table pdr_schedules drop constraint pdr_schedules_created_by_fkey,
  add constraint pdr_schedules_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;
alter table wigs drop constraint wigs_approved_by_fkey,
  add constraint wigs_approved_by_fkey foreign key (approved_by) references profiles(id) on delete set null;

-- Khi acknowledged_by bị SET NULL lúc xoá người ký, acknowledged_at vẫn còn → check cũ
-- `(acknowledged_at is null) = (acknowledged_by is null)` sẽ nổ. Nới: "đã ký (có giờ) mà người
-- ký đã bị xoá" là trạng thái HỢP LỆ; chỉ cấm chiều ngược (có người ký mà không có giờ ký).
alter table pdr_meetings drop constraint if exists pdr_meetings_check1;
do $$
declare cn text;
begin
  select conname into cn from pg_constraint
  where conrelid='pdr_meetings'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%acknowledged_at%';
  if cn is not null then execute format('alter table pdr_meetings drop constraint %I', cn); end if;
end $$;
alter table pdr_meetings add constraint pdr_ack_hop_le
  check (acknowledged_by is null or acknowledged_at is not null);

-- ── 3. [MEDIUM] Vòng duyệt WIG bị xuyên: em đổi area/measure_by/start_date/period_label của WIG
--       ĐÃ DUYỆT mà status vẫn 'approved'. Danh sách "nội dung đổi" viết trước v3, thiếu đúng
--       những cột v3 biến thành khoá cứng. Đọc pg_proc production trước khi đè (luật dự án).
create or replace function private.wig_em_sua_thi_cho_duyet()
returns trigger
language plpgsql
as $function$
begin
  if new.scope <> 'student' then
    return new;
  end if;
  if new.student_id is not distinct from (select auth.uid()) then
    if new.title         is distinct from old.title
    or new.target_value  is distinct from old.target_value
    or new.baseline      is distinct from old.baseline
    or new.unit          is distinct from old.unit
    or new.end_date      is distinct from old.end_date
    or new.kind          is distinct from old.kind
    or new.source_wig_id is distinct from old.source_wig_id
    -- v3 (0151): area/measure_by/start_date/period_label cũng là NỘI DUNG. area+period_label là
    -- khoá wigs_em_domain_uidx — đổi chúng là đổi hẳn mục tiêu, phải duyệt lại.
    or new.area          is distinct from old.area
    or new.measure_by    is distinct from old.measure_by
    or new.start_date    is distinct from old.start_date
    or new.period_label  is distinct from old.period_label
    then
      new.status := 'sent';
    else
      new.status := old.status;
    end if;
    new.set_by := old.set_by;
  end if;
  return new;
end $function$;

-- ── 4. [MEDIUM] GVCN sửa NỘI DUNG WIG lớp SAU khi BGH duyệt mà không bị đưa về 'sent' ─────────
-- trg cũ chỉ BEFORE UPDATE OF status nên cú sửa nội dung không gọi hàm. Mở rộng cột theo dõi +
-- thêm nhánh: GVCN đổi nội dung WIG lớp đã duyệt → về 'sent', BGH duyệt lại.
create or replace function private.wig_lop_qua_tay_bgh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scope = 'class' and auth_role() = 'teacher' then
    if tg_op = 'INSERT' and new.status = 'approved' then
      new.status := 'sent';
    elsif tg_op = 'UPDATE' then
      if new.status = 'approved' and old.status is distinct from 'approved' then
        raise exception 'WIG của lớp do ban giám hiệu duyệt' using errcode = '42501';
      elsif old.status = 'approved' and (
           new.title         is distinct from old.title
        or new.target_value  is distinct from old.target_value
        or new.baseline      is distinct from old.baseline
        or new.unit          is distinct from old.unit
        or new.end_date      is distinct from old.end_date
        or new.start_date    is distinct from old.start_date
        or new.area          is distinct from old.area
        or new.measure_by    is distinct from old.measure_by
      ) then
        new.status := 'sent';   -- sửa mục tiêu đã duyệt ⇒ chờ BGH duyệt lại
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_wig_lop_qua_tay_bgh on wigs;
create trigger trg_wig_lop_qua_tay_bgh
  before insert or update on wigs
  for each row execute function private.wig_lop_qua_tay_bgh();

-- ── 5. [MEDIUM] Ghép buddy không kiểm hai em CÙNG LỚP + là học sinh → đọc hồ sơ chéo lớp ──────
-- taoBuddyPair insert thẳng từ form; bảng/RLS chỉ hỏi staff_can_manage_class(class_id). GVCN lớp
-- A ghép được một uuid lớp khác → is_my_buddy (0146) mở prof_buddy_read cho đọc hồ sơ em lớp
-- khác. Chốt ở CSDL: cả student_id lẫn buddy_id phải đang học ĐÚNG class_id và role='student'.
create or replace function private.buddy_cung_lop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from enrollments e join profiles p on p.id = e.student_id
                 where e.student_id = new.student_id and e.class_id = new.class_id
                   and e.is_active and p.role = 'student')
     or not exists (select 1 from enrollments e join profiles p on p.id = e.student_id
                 where e.student_id = new.buddy_id and e.class_id = new.class_id
                   and e.is_active and p.role = 'student') then
    raise exception 'Buddy phải là hai học sinh đang học cùng lớp này' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_buddy_cung_lop on buddy_pairs;
create trigger trg_buddy_cung_lop
  before insert or update of student_id, buddy_id, class_id on buddy_pairs
  for each row when (new.is_active) execute function private.buddy_cung_lop();

-- ── 6. [MEDIUM] Đổi area của WIG năm không lan xuống area của cam kết đang treo dưới ───────────
-- commitments.area chỉ thừa kế MỘT LẦN lúc insert (cam_ket_hop_le). Cô đổi domain WIG lớp thì
-- cam kết cũ giữ area cũ → lệch cây tổng hợp. Đồng bộ bằng trigger; nhưng update commitments của
-- EM sẽ bị chi_em_va_bgh_sua_cam_ket (0133) chặn area — nên đặt cờ phiên để nó biết đây là ĐỒNG
-- BỘ HỆ THỐNG, không phải cô sửa lời hứa.
create or replace function private.dong_bo_area_cam_ket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.area is distinct from old.area then
    perform set_config('app.dong_bo_area', '1', true);
    update commitments set area = new.area where wig_id = new.id and area is distinct from new.area;
    perform set_config('app.dong_bo_area', '0', true);
  end if;
  return null;
end;
$$;
drop trigger if exists trg_dong_bo_area_cam_ket on wigs;
create trigger trg_dong_bo_area_cam_ket
  after update of area on wigs
  for each row execute function private.dong_bo_area_cam_ket();

-- Cho phép cú đồng bộ area đi qua chốt 0133 (đọc pg_proc production trước khi đè — giữ nguyên
-- toàn bộ thân, chỉ chèn một nhánh thoát khi cờ đồng bộ bật).
create or replace function private.chi_em_va_bgh_sua_cam_ket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me  uuid := (select auth.uid());
  v_vai user_role := auth_role();
begin
  if v_me is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- ĐỒNG BỘ AREA do trigger dong_bo_area_cam_ket đẩy xuống: không phải cô sửa lời hứa, cho qua.
  if tg_op = 'UPDATE' and coalesce(current_setting('app.dong_bo_area', true), '0') = '1'
     and (new.title, new.wig_id, new.class_id, new.student_id, new.week_start, new.set_by)
         is not distinct from
         (old.title, old.wig_id, old.class_id, old.student_id, old.week_start, old.set_by) then
    return new;
  end if;

  if old.student_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.student_id is not distinct from v_me or v_vai in ('admin', 'principal') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Cam kết này là của em, thầy cô không xoá được. Nhờ em sửa, hoặc báo quản trị.'
      using errcode = '42501';
  end if;

  if (new.title, new.area, new.wig_id, new.class_id, new.student_id, new.week_start, new.set_by)
     is distinct from
     (old.title, old.area, old.wig_id, old.class_id, old.student_id, old.week_start, old.set_by)
  then
    raise exception 'Cam kết là lời hứa của em — thầy cô duyệt hoặc chấm V/X, không sửa lời. Nhờ em sửa lại.'
      using errcode = '42501';
  end if;

  return new;
end $function$;

-- ── 7. [MEDIUM] Chuyển lớp/rời lớp không tắt buddy + lịch PDR của lớp cũ ──────────────────────
-- GVCN lớp mới không thấy (RLS) nên không sửa được dữ liệu treo từ lớp cũ. Rời lớp = tắt cờ, nên
-- buddy/lịch cũng chỉ TẮT (is_active=false), giữ lịch sử. Đọc pg_proc production trước khi đè.
create or replace function public.apply_class_transfer(p_student uuid, p_to_class uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update enrollments set is_active = false, is_attendance_leader = false
  where student_id = p_student and is_active and class_id <> p_to_class;

  -- Buddy + lịch PDR của các lớp em đang rời: tắt, đừng để treo ở lớp cũ.
  update buddy_pairs set is_active = false
    where is_active and class_id <> p_to_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id <> p_to_class and student_id = p_student;

  insert into enrollments (class_id, student_id, is_active)
  values (p_to_class, p_student, true)
  on conflict (class_id, student_id) do update set is_active = true;
end;
$function$;

create or replace function public.unenroll_student(p_class uuid, p_student uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (
    is_class_teacher(p_class)
    or auth_role() = 'admin'
    or (auth_role() = 'principal'
        and exists (select 1 from classes c where c.id = p_class and c.campus_id = auth_campus()))
  ) then
    raise exception 'Không có quyền';
  end if;
  update enrollments set is_active = false, is_attendance_leader = false
    where class_id = p_class and student_id = p_student;
  update buddy_pairs set is_active = false
    where is_active and class_id = p_class and (student_id = p_student or buddy_id = p_student);
  update pdr_schedules set is_active = false
    where is_active and class_id = p_class and student_id = p_student;
end $function$;
