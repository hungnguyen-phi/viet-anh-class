-- KIỂM 0191 — trang_layout() khớp từng câu lẻ dưới cùng RLS; anon/khách null. Tự rollback.
-- Chạy CHƯA áp 0191 phải đỏ ở ① (hàm không tồn tại).
begin;

do $$
declare
  v_hs uuid; v_gv uuid; v_admin uuid;
  j jsonb; v_chuong int; v_tt boolean; v_tin int;
begin
  select id into v_hs from profiles where email = 'test1.hs@student.truongvietanh.com';
  select id into v_gv from profiles where email = 'tunhien01@truongvietanh.com';
  select id into v_admin from profiles where email = 'test3.admin@truongvietanh.com';

  -- ① Học sinh: giả phiên authenticated, so từng trường với câu lẻ
  perform set_config('request.jwt.claims', json_build_object('sub', v_hs, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_hs::text, true);
  set local role authenticated;
  j := public.trang_layout();
  if j is null then raise exception 'CA1: trang_layout trả null cho học sinh'; end if;
  select count(*) into v_chuong from notifications where user_id = v_hs and read = false;
  if (j->>'chuong')::int <> v_chuong then raise exception 'CA1: chuông lệch % vs %', j->>'chuong', v_chuong; end if;
  select exists (select 1 from enrollments where student_id = v_hs and is_active and is_attendance_leader) into v_tt;
  if (j->>'toTruong')::boolean <> v_tt then raise exception 'CA1: cờ tổ trưởng lệch'; end if;
  if (j->>'tinNhan')::int <> 0 then raise exception 'CA1: học sinh phải có tinNhan = 0, được %', j->>'tinNhan'; end if;
  reset role;

  -- ② Giáo viên: tinNhan = pt_unread_total()
  perform set_config('request.jwt.claims', json_build_object('sub', v_gv, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_gv::text, true);
  set local role authenticated;
  j := public.trang_layout();
  select coalesce(public.pt_unread_total(), 0) into v_tin;
  if (j->>'tinNhan')::int <> v_tin then raise exception 'CA2: tinNhan GV lệch % vs %', j->>'tinNhan', v_tin; end if;
  if (j->>'toTruong')::boolean then raise exception 'CA2: GV không thể là tổ trưởng'; end if;
  reset role;

  -- ③ Admin: có tinNhan (số ≥ 0), không lỗi
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  j := public.trang_layout();
  if j is null or (j->>'tinNhan')::int < 0 then raise exception 'CA3: admin lỗi'; end if;
  reset role;

  -- ④ Anon: không gọi được (0187 thu ACL) hoặc trả null
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    set local role anon;
    j := public.trang_layout();
    if j is not null then raise exception 'CA4: anon phải nhận null'; end if;
  exception when insufficient_privilege then null;   -- bị revoke = đúng
  end;
  reset role;
end $$;

rollback;
