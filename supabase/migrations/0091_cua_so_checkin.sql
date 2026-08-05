-- 0091 — Cửa sổ check-in: tick = điểm danh, giờ bấm tự phân loại
--
-- LUẬT (chủ dự án ra):
--   6h30 – 7h00  bấm được → CÓ MẶT, đúng giờ. Cảm xúc sửa được trong khoảng này.
--   7h00 – 8h00  bấm được → CÓ MẶT, MUỘN. Cảm xúc khoá ngay khi gửi.
--   sau 8h00     không bấm được nữa → VẮNG (giáo viên/tổ trưởng sửa được nếu có lý do)
--   16h00        check-in cảm xúc buổi chiều — KHÔNG dính gì tới điểm danh
--
-- Giờ vào lớp 6h45, không khác theo thứ, không khác theo cấp. Vẫn đặt trên TỪNG CƠ SỞ chứ không
-- đặt một hằng số cho cả hệ thống: trường mở thêm cơ sở với giờ khác là chuyện bình thường, và
-- lúc ấy sửa một dòng cấu hình rẻ hơn sửa một migration.

alter table campuses
  add column if not exists gio_vao_lop time not null default '06:45',
  add column if not exists mo_truoc_phut int not null default 15,   -- mở cửa trước giờ vào lớp
  add column if not exists an_han_phut int not null default 15,     -- sau giờ vào lớp vẫn tính đúng giờ
  add column if not exists han_muon_phut int not null default 60,   -- sau đó là muộn, hết hạn thì thôi
  add column if not exists gio_checkin_chieu time not null default '16:00',
  add column if not exists cua_so_chieu_phut int not null default 60;

comment on column campuses.gio_vao_lop is 'Giờ vào lớp. Cửa sổ check-in tính từ đây.';
comment on column campuses.an_han_phut is 'Sau giờ vào lớp bao nhiêu phút vẫn tính ĐÚNG GIỜ.';
comment on column campuses.han_muon_phut is 'Hết ân hạn, còn bấm được bao lâu nữa (tính là MUỘN).';

-- ── Cảm xúc hai buổi ──────────────────────────────────────────────────────────────────────
-- Buổi chiều là một thang đo khác, không phải điểm danh. Phải tách dòng, nếu không lần bấm chiều
-- sẽ đè lên cảm xúc buổi sáng và mất luôn cái đang cần đo.
alter table mood_checkins add column if not exists buoi text not null default 'sang'
  check (buoi in ('sang','chieu'));
alter table mood_checkins drop constraint if exists mood_checkins_student_id_date_key;
create unique index if not exists uq_mood_student_date_buoi
  on mood_checkins (student_id, date, buoi);

-- ── Cửa sổ của hôm nay, theo giờ Việt Nam ────────────────────────────────────────────────
-- Trả về mốc thời gian THẬT (timestamptz) để mọi chỗ so sánh cùng một cách, thay vì mỗi nơi tự
-- ghép ngày với giờ rồi lệch nhau.
create or replace function checkin_windows(p_campus uuid)
returns table (
  mo_luc timestamptz, het_dung_gio timestamptz, het_muon timestamptz,
  chieu_mo timestamptz, chieu_dong timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (vn_today() + c.gio_vao_lop - make_interval(mins => c.mo_truoc_phut)) at time zone 'Asia/Ho_Chi_Minh',
    (vn_today() + c.gio_vao_lop + make_interval(mins => c.an_han_phut))   at time zone 'Asia/Ho_Chi_Minh',
    (vn_today() + c.gio_vao_lop + make_interval(mins => c.an_han_phut + c.han_muon_phut)) at time zone 'Asia/Ho_Chi_Minh',
    (vn_today() + c.gio_checkin_chieu) at time zone 'Asia/Ho_Chi_Minh',
    (vn_today() + c.gio_checkin_chieu + make_interval(mins => c.cua_so_chieu_phut)) at time zone 'Asia/Ho_Chi_Minh'
  from campuses c where c.id = p_campus;
$$;

revoke all on function checkin_windows(uuid) from public;
grant execute on function checkin_windows(uuid) to authenticated;

-- ── Check-in ──────────────────────────────────────────────────────────────────────────────
-- Trả về: 'ok' (đúng giờ) · 'late' · 'closed' (ngoài cửa sổ) · 'blocked' (sai mạng)
--         · 'no_class' · 'mood_only' (trường chưa khai mạng) · 'chieu'
create or replace function student_checkin(p_student uuid, p_mood mood_level, p_ip text, p_buoi text default 'sang')
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_class uuid; v_campus uuid; v_da_khai boolean;
  v_hom_nay date := vn_today();
  w record;
  v_bay_gio timestamptz := now();
begin
  v_da_khai := truong_da_khai_mang();
  if v_da_khai and not ip_allowed(p_ip) then
    return 'blocked';
  end if;

  select e.class_id, c.campus_id into v_class, v_campus
  from enrollments e join classes c on c.id = e.class_id
  where e.student_id = p_student and e.is_active limit 1;

  if v_class is null then
    -- Chưa có lớp thì vẫn ghi cảm xúc, nhưng không có điểm danh nào để nói tới.
    insert into mood_checkins (student_id, class_id, date, mood, buoi)
      values (p_student, null, v_hom_nay, p_mood, coalesce(p_buoi,'sang'))
      on conflict (student_id, date, buoi) do update set mood = excluded.mood, updated_at = now();
    return 'no_class';
  end if;

  select * into w from checkin_windows(v_campus);

  -- BUỔI CHIỀU: chỉ là thang đo cảm xúc. Không đụng tới điểm danh, không mở/khoá gì của buổi sáng.
  if coalesce(p_buoi,'sang') = 'chieu' then
    if v_bay_gio < w.chieu_mo or v_bay_gio > w.chieu_dong then
      return 'closed';
    end if;
    insert into mood_checkins (student_id, class_id, date, mood, buoi)
      values (p_student, v_class, v_hom_nay, p_mood, 'chieu')
      on conflict (student_id, date, buoi) do update set mood = excluded.mood, updated_at = now();
    return 'chieu';
  end if;

  -- BUỔI SÁNG.
  if v_bay_gio < w.mo_luc or v_bay_gio > w.het_muon then
    return 'closed';
  end if;

  -- Cảm xúc: sửa được tới hết khung đúng giờ, sau đó KHOÁ.
  -- Ghi rồi khoá chứ không chặn ghi: em bấm lúc 7h30 vẫn phải nói được hôm nay mình thế nào,
  -- chỉ là nói một lần.
  insert into mood_checkins (student_id, class_id, date, mood, buoi)
    values (p_student, v_class, v_hom_nay, p_mood, 'sang')
    on conflict (student_id, date, buoi) do update
      set mood = case when now() <= (select het_dung_gio from checkin_windows(v_campus))
                      then excluded.mood else mood_checkins.mood end,
          updated_at = now();

  if not v_da_khai then
    return 'mood_only';
  end if;

  insert into attendance_records (class_id, student_id, date, status, marked_by)
    values (v_class, p_student, v_hom_nay,
            case when v_bay_gio <= w.het_dung_gio then 'present' else 'late' end,
            p_student)
    on conflict (class_id, student_id, date) do update
      set status = case
        -- Giáo viên đã đánh Có phép thì giữ nguyên: quyết định của người lớn không bị em ghi đè.
        when attendance_records.status = 'excused' then attendance_records.status
        else excluded.status
      end;

  return case when v_bay_gio <= w.het_dung_gio then 'ok' else 'late' end;
end;
$$;

-- ── Sổ điểm danh một ngày, TÍNH RA chứ không ghi sẵn ─────────────────────────────────────
--
-- Vì sao không có công việc chạy nền đánh vắng hàng loạt lúc 8h: một dòng "vắng" ghi vào cơ sở dữ
-- liệu là một dòng phụ huynh sẽ đọc. Nếu sáng đó dải mạng đổi IP (chuyện có thật với đường truyền
-- IP động) thì cả trường không ai check-in được, và công việc nền sẽ ghi VẮNG cho toàn trường —
-- im lặng, hàng loạt, và không tự gỡ được.
--
-- Nên "vắng" là thứ SUY RA lúc đọc: không có dòng nào + đã quá hạn = vắng. Giáo viên đánh tay thì
-- mới có dòng thật. Và trang gọi hàm này còn nhận được `ai_cung_khong_bam` để cảnh báo thay vì
-- kết luận.
create or replace function class_attendance_day(p_class uuid, p_date date default null)
returns table (
  student_id uuid, ho_ten text, trang_thai text,
  gio_bam timestamptz, nguoi_danh uuid, tu_dong boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_date date := coalesce(p_date, vn_today());
  v_campus uuid;
  w record;
begin
  if not (auth_role() in ('admin','principal') or is_class_teacher(p_class) or is_attendance_leader(p_class)) then
    raise exception 'Khong co quyen xem so diem danh cua lop nay';
  end if;

  select campus_id into v_campus from classes where id = p_class;
  select * into w from checkin_windows(v_campus);

  return query
  select
    p.id, coalesce(p.full_name, p.email),
    coalesce(
      a.status::text,
      case
        -- Ngày khác hôm nay thì cửa sổ đã đóng từ lâu; hôm nay thì phải chờ hết hạn muộn.
        when v_date < vn_today() or now() > w.het_muon then 'absent'
        else 'unknown'
      end
    ),
    a.created_at,
    a.marked_by,
    (a.marked_by is not null and a.marked_by = p.id)   -- tự em bấm, không phải ai đánh hộ
  from enrollments e
  join profiles p on p.id = e.student_id
  left join attendance_records a
    on a.class_id = p_class and a.student_id = p.id and a.date = v_date
  where e.class_id = p_class and e.is_active
  order by coalesce(p.full_name, p.email);
end;
$$;

revoke all on function class_attendance_day(uuid, date) from public;
grant execute on function class_attendance_day(uuid, date) to authenticated;
