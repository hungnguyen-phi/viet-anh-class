-- KIỂM 0169 — dọn enum + kind cũ.  Chạy SAU khi apply 0168 RỒI 0169 (cùng buổi).
--
--   npm run sql -- scripts/test-0169-don-enum-kind-cu.sql
--
-- 0169 là tệp DỌN (drop-only) + siết một CHECK: không thêm bảng/policy/luật-theo-vai. Bài này
-- kiểm hai chiều:
--   · CHIỀU THUẬN  — hai enum mồ côi (wig_period/wig_scope) đã biến mất; cột classes.tick_lock_dow
--                    đã biến mất (bảng classes còn); edit_requests.kind chỉ còn ba giá trị PA2
--                    ('doi_ten_thuoc','mo_tuan_da_ky','khac'); comment câu 6 đã cập nhật.
--   · CHIỀU NGƯỢC  — hai enum GIỮ (wig_domain, score_category) VÀ bảng dùng chúng còn nguyên
--                    (drop nhầm là mất cột); một dòng edit_requests kind='rename_lead' (và kind lạ)
--                    PHẢI bị CHECK chặn — nếu 0169 chưa siết thì hai phép này chèn ĐƯỢC → bài đỏ;
--                    các phần GIỮ (điểm danh/PDR/buddy/Hub) còn đủ.
--   · "Chưa vá phải ĐỎ" — chốt chặn đầu tệp: chạy TRƯỚC 0169 (enum/cột/kind cũ còn) raise ngay,
--                    không ra bảng tổng kết. Một phép kiểm luôn xanh là vô dụng.
--
-- Cô lập CHECK: trg_notify_edit_request (AFTER INSERT, GIỮ) bị tắt TRONG transaction rollback này
-- để phép chèn hợp lệ không kéo theo logic thông báo — ta chỉ kiểm ràng buộc kind, không kiểm notify.
--
-- Ghi chú vai: đặc tả yêu cầu đóng vai bằng request.jwt.claims. 0169 KHÔNG có luật theo vai — CHECK
-- áp cho MỌI vai. Giữ MỘT khối role-play chứng minh CHECK chặn 'rename_lead' kể cả khi phiên khai là
-- học sinh; đây KHÔNG phải bằng chứng RLS (run-sql nối bằng quyền postgres, RLS bị bỏ qua).
begin;
set local search_path = public;

-- ── CHỐT CHẶN: chưa vá thì dừng ngay (đỏ) ───────────────────────────────────────────────────
do $$
begin
  if to_regtype('public.wig_period') is not null
     or to_regtype('public.wig_scope') is not null
     or exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='classes' and column_name='tick_lock_dow')
     or exists (select 1 from pg_constraint
                where conname='edit_requests_kind_check'
                  and pg_get_constraintdef(oid) ilike '%rename_lead%')
  then
    raise exception 'CHUA VA 0169: còn dấu vết cũ (type wig_period/wig_scope, cột classes.tick_lock_dow, hoặc kind "rename_lead" trong CHECK) — chạy 0168 rồi 0169 trước.';
  end if;
end $$;

create temporary table kq (buoc text, mong_doi text, thuc_te text, dat boolean) on commit drop;

-- Tắt trigger notify để ba phép chèn thử chỉ đụng CHECK (rollback sẽ khôi phục).
alter table edit_requests disable trigger trg_notify_edit_request;

-- ── 1–2 THUẬN: hai enum mồ côi đã biến mất ──────────────────────────────────────────────────
insert into kq values ('type wig_period đã drop', 'không còn',
  coalesce(to_regtype('public.wig_period')::text, 'không còn'), to_regtype('public.wig_period') is null);
insert into kq values ('type wig_scope đã drop', 'không còn',
  coalesce(to_regtype('public.wig_scope')::text, 'không còn'), to_regtype('public.wig_scope') is null);

-- ── 3 THUẬN: cột classes.tick_lock_dow đã biến mất (bảng classes vẫn còn) ────────────────────
insert into kq
select 'classes.tick_lock_dow đã drop (classes còn)', 'cột mất, bảng còn',
       case when to_regclass('public.classes') is not null then 'bảng còn; ' else 'BẢNG MẤT; ' end
       || case when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='classes' and column_name='tick_lock_dow')
               then 'cột CÒN' else 'cột mất' end,
       to_regclass('public.classes') is not null
         and not exists(select 1 from information_schema.columns
                        where table_schema='public' and table_name='classes' and column_name='tick_lock_dow');

-- ── 4 THUẬN: edit_requests_kind_check siết về đúng 3 giá trị PA2, bỏ rename_lead ─────────────
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'edit_requests_kind_check';
  insert into kq values ('edit_requests_kind_check = 3 giá trị PA2',
    'có doi_ten_thuoc/mo_tuan_da_ky/khac, KHÔNG có rename_lead',
    coalesce(v_def, '(không thấy constraint)'),
    v_def is not null
      and v_def ilike '%doi_ten_thuoc%' and v_def ilike '%mo_tuan_da_ky%' and v_def ilike '%khac%'
      and v_def not ilike '%rename_lead%');
end $$;

-- ── 5 THUẬN + 6/7 NGƯỢC: chèn thử edit_requests (dùng lớp Test) ──────────────────────────────
do $$
declare v_class uuid; v_student uuid;
begin
  select c.id into v_class from classes c where c.name = 'Test' limit 1;
  select e.student_id into v_student from enrollments e join classes c on c.id = e.class_id
    where c.name = 'Test' and e.is_active limit 1;

  if v_class is null or v_student is null then
    insert into kq values ('chèn edit_requests (cần lớp Test)', 'có lớp+em Test',
      'THIẾU lớp/em Test — bỏ qua 3 phép chèn', false);
    return;
  end if;

  -- 5 THUẬN: kind hợp lệ chèn được
  begin
    insert into edit_requests (id, class_id, student_id, requester_id, kind, tuan)
    values (gen_random_uuid(), v_class, v_student, v_student, 'mo_tuan_da_ky', vn_week_start(vn_today()));
    insert into kq values ('kind hợp lệ (mo_tuan_da_ky) chèn được', 'chèn được', 'chèn được', true);
  exception when others then
    insert into kq values ('kind hợp lệ (mo_tuan_da_ky) chèn được', 'chèn được', 'LỖI: ' || sqlerrm, false);
  end;

  -- 6 NGƯỢC: rename_lead bị CHECK chặn
  begin
    insert into edit_requests (id, class_id, student_id, requester_id, kind)
    values (gen_random_uuid(), v_class, v_student, v_student, 'rename_lead');
    insert into kq values ('kind "rename_lead" bị CHECK chặn', 'BỊ CHẶN',
      'CHÈN ĐƯỢC — CHECK chưa bỏ rename_lead', false);
  exception when check_violation then
    insert into kq values ('kind "rename_lead" bị CHECK chặn', 'BỊ CHẶN', 'bị chặn (check_violation)', true);
  end;

  -- 7 NGƯỢC: kind lạ bị CHECK chặn
  begin
    insert into edit_requests (id, class_id, student_id, requester_id, kind)
    values (gen_random_uuid(), v_class, v_student, v_student, 'lung_tung_123');
    insert into kq values ('kind lạ "lung_tung_123" bị CHECK chặn', 'BỊ CHẶN', 'CHÈN ĐƯỢC — CHECK hở', false);
  exception when check_violation then
    insert into kq values ('kind lạ "lung_tung_123" bị CHECK chặn', 'BỊ CHẶN', 'bị chặn (check_violation)', true);
  end;
end $$;

-- ── 8 THUẬN: comment câu 6 đã cập nhật theo PA2 ─────────────────────────────────────────────
insert into kq
select 'comment pdr_meetings.q6_commitment cập nhật PA2', 'nhắc cam_ket.pdr_meeting_id',
       coalesce(left(col_description('public.pdr_meetings'::regclass,
         (select ordinal_position from information_schema.columns
          where table_schema='public' and table_name='pdr_meetings' and column_name='q6_commitment')), 42), '(không có comment)'),
       coalesce(col_description('public.pdr_meetings'::regclass,
         (select ordinal_position from information_schema.columns
          where table_schema='public' and table_name='pdr_meetings' and column_name='q6_commitment')), '') ilike '%cam_ket.pdr_meeting_id%';

-- ── 9/10 NGƯỢC: hai enum GIỮ còn nguyên + bảng dùng chúng còn (bắt drop nhầm) ────────────────
insert into kq values ('GIỮ enum wig_domain (area_config dùng)', 'còn',
  coalesce(to_regtype('public.wig_domain')::text, 'MẤT'),
  to_regtype('public.wig_domain') is not null and to_regclass('public.area_config') is not null);
insert into kq values ('GIỮ enum score_category (scoreboard_entries dùng)', 'còn',
  coalesce(to_regtype('public.score_category')::text, 'MẤT'),
  to_regtype('public.score_category') is not null and to_regclass('public.scoreboard_entries') is not null);

-- ── 11 NGƯỢC: các phần GIỮ (điểm danh/PDR/buddy/Hub) không gãy ───────────────────────────────
do $$
declare v_thieu text := '';
begin
  if to_regclass('public.attendance_records') is null then v_thieu := v_thieu || 'attendance_records '; end if;
  if to_regclass('public.pdr_meetings')       is null then v_thieu := v_thieu || 'pdr_meetings ';       end if;
  if to_regclass('public.pdr_schedules')      is null then v_thieu := v_thieu || 'pdr_schedules ';      end if;
  if to_regclass('public.buddy_pairs')        is null then v_thieu := v_thieu || 'buddy_pairs ';        end if;
  if to_regclass('public.hub_event_outbox')   is null then v_thieu := v_thieu || 'hub_event_outbox ';   end if;
  if not exists(select 1 from pg_proc where proname = 'mark_attendance') then v_thieu := v_thieu || 'mark_attendance() '; end if;
  insert into kq values ('phần GIỮ (điểm danh/PDR/buddy/Hub) còn đủ', 'không thiếu gì',
    case when v_thieu = '' then 'đủ' else 'THIẾU: ' || v_thieu end, v_thieu = '');
end $$;

-- ── 12 VAI (không phải kiểm RLS): CHECK chặn rename_lead bất kể phiên khai là học sinh ───────
do $$
declare v_class uuid; v_student uuid;
begin
  select c.id into v_class from classes c where c.name = 'Test' limit 1;
  select e.student_id into v_student from enrollments e join classes c on c.id = e.class_id
    where c.name = 'Test' and e.is_active limit 1;
  if v_class is null or v_student is null then
    insert into kq values ('CHECK chặn rename_lead ở phiên học sinh', 'BỊ CHẶN', 'thiếu lớp/em Test — bỏ qua', false);
    return;
  end if;
  perform set_config('request.jwt.claims',
    '{"sub":"' || v_student || '","role":"authenticated","user_role":"student"}', true);
  begin
    insert into edit_requests (id, class_id, student_id, requester_id, kind)
    values (gen_random_uuid(), v_class, v_student, v_student, 'rename_lead');
    insert into kq values ('CHECK chặn rename_lead ở phiên học sinh', 'BỊ CHẶN', 'CHÈN ĐƯỢC', false);
  exception when check_violation then
    insert into kq values ('CHECK chặn rename_lead ở phiên học sinh', 'BỊ CHẶN', 'bị chặn (check_violation)', true);
  end;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Tổng kết ────────────────────────────────────────────────────────────────────────────────
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
