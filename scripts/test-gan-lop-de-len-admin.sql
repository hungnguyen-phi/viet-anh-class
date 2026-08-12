-- BUG 0105 — admin đang kiêm GVCN của lớp, mời giáo viên mới cho ĐÚNG lớp đó, giáo viên mới đăng
-- nhập lần đầu phải NHẬN ĐƯỢC lớp — không được lặng thinh vì lớp "đã có ai đó" (chính là admin).
--
--   npm run sql -- scripts/test-gan-lop-de-len-admin.sql
--
-- Chủ dự án báo 12/08/2026: tạo giáo viên mới, gán cho lớp mình đang đứng tên GVCN (vì cũng là
-- admin), giáo viên mới đăng nhập vào thì báo "không có lớp". 0097 viết
-- `where id = v_grant.class_id and homeroom_teacher_id is null` — chỉ gán khi lớp CHƯA có ai,
-- sai với đúng ca này. 0105 bỏ điều kiện đó.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;
grant all on kq to authenticated;

do $$
declare
  v_admin uuid; v_lop uuid; v_ten_lop text; v_cs uuid;
  v_id uuid; v_chu_nhiem_moi uuid;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  if v_admin is null then
    insert into kq values ('Có admin để thử', 'có', 'KHÔNG CÓ admin nào', false);
    return;
  end if;

  -- Dựng đúng cảnh: một lớp mà ADMIN đang đứng tên chủ nhiệm.
  select id into v_cs from campuses limit 1;
  insert into classes (campus_id, grade_id, name, school_year, homeroom_teacher_id)
  values (v_cs, (select id from grades where campus_id = v_cs limit 1), 'Lớp kiểm 0105', '2026-2027', v_admin)
  returning id, name into v_lop, v_ten_lop;

  -- Admin mời giáo viên mới, chọn ĐÚNG lớp đang tự đứng tên — đúng thao tác chủ dự án làm.
  insert into pending_user_grants (email, role, class_id, campus_id)
  values ('kiem.0105@truongvietanh.com', 'teacher', v_lop, v_cs)
  on conflict (email) do update set role = 'teacher', class_id = v_lop, campus_id = v_cs;

  v_id := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
  values (v_id, 'kiem.0105@truongvietanh.com', '{"full_name":"Cô Kiểm 0105"}'::jsonb,
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  select homeroom_teacher_id into v_chu_nhiem_moi from classes where id = v_lop;

  insert into kq values (
    'Giáo viên mới nhận đúng lớp admin từng đứng tên',
    'chính giáo viên mới',
    case when v_chu_nhiem_moi = v_id then 'chính giáo viên mới'
         when v_chu_nhiem_moi = v_admin then 'VẪN LÀ ADMIN — bug cũ'
         else 'khác: ' || coalesce(v_chu_nhiem_moi::text, 'null') end,
    v_chu_nhiem_moi = v_id
  );

  insert into kq values (
    'Hồ sơ giáo viên mới có role=teacher',
    'teacher',
    coalesce((select role::text from profiles where id = v_id), '(không có hồ sơ)'),
    (select role = 'teacher' from profiles where id = v_id)
  );

  insert into kq values (
    'Lời mời đã được dọn sau khi dùng',
    '0 dòng còn lại',
    (select count(*) from pending_user_grants where lower(email) = 'kiem.0105@truongvietanh.com')::text || ' dòng',
    not exists (select 1 from pending_user_grants where lower(email) = 'kiem.0105@truongvietanh.com')
  );
exception when others then
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;

select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

rollback;
