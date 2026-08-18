-- CHỐT CHẶN HAI LỖ RÒ CỦA AUDIT 18/08/2026 — chạy SAU khi apply 0150 + 0151
--
--   npm run sql -- scripts/test-audit-lo-ro.sql
--
-- Hai lỗ này đều là "quyền bị mở cho anon/PUBLIC", loại lỗi đã tái sinh vài lần khi thêm cột/
-- tham số. Bài này đóng vai anon THẬT rồi thử khai thác — đỏ là lỗ đã mở lại.
begin;

create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);
grant all on kq to authenticated, anon;

-- ── 1. wig_progress_v: anon KHÔNG đọc được tiến độ học sinh ─────────────────────────────────
do $$
declare v_view int; v_bang int;
begin
  set local role anon;
  begin select count(*) into v_view from wig_progress_v; exception when others then v_view := -1; end;
  begin select count(*) into v_bang from wigs;          exception when others then v_bang := -1; end;
  reset role;
  insert into kq values ('anon đọc wig_progress_v (phải bị RLS chặn = 0 hoặc mất quyền = -1)',
    '0 hoặc -1', v_view::text, v_view <= 0);
  insert into kq values ('anon đọc bảng wigs (mốc: RLS luôn chặn)', '0', v_bang::text, v_bang = 0);
end $$;

-- ── 2. student_checkin(4 tham số): anon/authenticated/PUBLIC KHÔNG có EXECUTE ────────────────
do $$
declare v_acl text;
begin
  select array_to_string(coalesce(p.proacl, '{}'), ',') into v_acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'student_checkin' and p.pronargs = 4;
  insert into kq values ('student_checkin(4) KHÔNG cấp cho anon',
    'không có anon=X', coalesce(v_acl, '(không có hàm)'), v_acl is null or v_acl not like '%anon=X%');
  insert into kq values ('student_checkin(4) KHÔNG cấp cho authenticated',
    'không có authenticated=X', coalesce(v_acl, '(không có hàm)'),
    v_acl is null or v_acl not like '%authenticated=X%');
  insert into kq values ('student_checkin(4) KHÔNG cấp cho PUBLIC',
    'không có =X ở đầu', coalesce(v_acl, '(không có hàm)'),
    v_acl is null or v_acl not like '=X%');
end $$;

-- ── 3. anon gọi thử student_checkin phải BỊ TỪ CHỐI ─────────────────────────────────────────
do $$
begin
  set local role anon;
  begin
    perform student_checkin('00000000-0000-0000-0000-000000000001'::uuid, 'happy'::mood_level, '1.2.3.4', 'sang');
    reset role;
    insert into kq values ('anon gọi student_checkin(4)', 'BỊ CHẶN', 'GỌI ĐƯỢC — LỖ HỔNG', false);
  exception when insufficient_privilege then
    reset role;
    insert into kq values ('anon gọi student_checkin(4)', 'BỊ CHẶN', 'bị chặn (insufficient_privilege)', true);
  when others then
    reset role;
    insert into kq values ('anon gọi student_checkin(4)', 'BỊ CHẶN', 'bị chặn: ' || sqlerrm, true);
  end;
end $$;

select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet
from kq order by dat, buoc;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;

rollback;
