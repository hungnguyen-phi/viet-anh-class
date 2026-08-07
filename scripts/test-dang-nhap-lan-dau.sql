-- ĐĂNG NHẬP LẦN ĐẦU CỦA TỪNG VAI — ai vào cũng phải ra đúng vai và đúng lớp (migration 0097).
--
--   npm run sql -- scripts/test-dang-nhap-lan-dau.sql
--
-- Vì sao có file này: cô Kim Phượng bấm đăng nhập Google thì bị đá về trang login kèm "Database
-- error saving new user". Hai chốt chặn của chính mình đấm nhau — handle_new_user tự gán lớp cho
-- giáo viên, còn trg_protect_class_cols chặn mọi thay đổi cột chủ nhiệm trừ khi là quản trị viên.
-- Lúc đăng nhập lần đầu thì chưa có phiên nào, nên chốt chặn thấy "không phải admin" và ném lỗi
-- ngay giữa transaction tạo tài khoản.
--
-- Cái đáng sợ là nó IM: người dùng chỉ thấy một câu tiếng Anh vô nghĩa rồi văng về trang login,
-- không có gì chỉ ra rằng lỗi nằm ở phía trường. Nên từ nay phải có bộ kiểm đi hết BỐN vai.
--
-- Tạo tài khoản thật để trigger chạy y như lúc bấm đăng nhập Google, rồi ROLLBACK — không để lại
-- tài khoản ma nào.
begin;

create temp table kq (vai text, ky_vong text, thuc_te text) on commit drop;
-- Đoạn cuối chạy dưới vai 'authenticated' để chốt chặn thật sự có hiệu lực; vai ấy phải ghi được
-- vào bảng kết quả, không thì chính bảng kết quả lại là thứ chặn bộ kiểm.
grant all on kq to authenticated;

do $$
declare
  v_lop uuid; v_ten_lop text; v_cs uuid; v_hs uuid;
  v_id uuid; v_ket text;
begin
  -- ── GIÁO VIÊN được mời kèm một lớp CHƯA AI chủ nhiệm ───────────────────────────────────
  select id, name, campus_id into v_lop, v_ten_lop, v_cs
    from classes where homeroom_teacher_id is null limit 1;
  if v_lop is null then
    -- Mọi lớp đều đã có chủ nhiệm thì dựng tạm một lớp để thử.
    select id into v_cs from campuses limit 1;
    insert into classes (campus_id, grade_id, name, school_year)
    values (v_cs, (select id from grades where campus_id = v_cs limit 1), 'Lớp kiểm thử', '2026-2027')
    returning id, name into v_lop, v_ten_lop;
  end if;

  insert into pending_user_grants (email, role, class_id, campus_id)
  values ('kiem.gv@truongvietanh.com', 'teacher', v_lop, v_cs)
  on conflict (email) do update set role = 'teacher', class_id = v_lop, campus_id = v_cs;

  v_id := gen_random_uuid();
  begin
    insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
    values (v_id, 'kiem.gv@truongvietanh.com', '{"full_name":"Cô Kiểm Thử"}'::jsonb,
            '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    v_ket := coalesce((select role::text from profiles where id = v_id), '(không có hồ sơ)')
             || ' · nhận lớp: '
             || coalesce((select name from classes where homeroom_teacher_id = v_id), 'KHÔNG NHẬN ĐƯỢC');
  exception when others then
    v_ket := 'NỔ: ' || sqlerrm;
  end;
  insert into kq values ('Giáo viên chủ nhiệm', 'teacher · nhận lớp: ' || v_ten_lop, v_ket);

  -- ── HỌC SINH được mời vào một lớp ──────────────────────────────────────────────────────
  insert into pending_user_grants (email, role, class_id, campus_id)
  values ('kiem.hs@truongvietanh.com', 'student', v_lop, v_cs)
  on conflict (email) do update set role = 'student', class_id = v_lop, campus_id = v_cs;
  v_id := gen_random_uuid();
  begin
    insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
    values (v_id, 'kiem.hs@truongvietanh.com', '{}'::jsonb,
            '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    v_ket := coalesce((select role::text from profiles where id = v_id), '(không có hồ sơ)')
             || ' · vào lớp: '
             || coalesce((select c.name from enrollments e join classes c on c.id = e.class_id
                           where e.student_id = v_id and e.is_active limit 1), 'KHÔNG VÀO ĐƯỢC');
  exception when others then
    v_ket := 'NỔ: ' || sqlerrm;
  end;
  insert into kq values ('Học sinh', 'student · vào lớp: ' || v_ten_lop, v_ket);

  -- ── BAN GIÁM HIỆU được mời kèm cơ sở ───────────────────────────────────────────────────
  insert into pending_user_grants (email, role, campus_id)
  values ('kiem.bgh@truongvietanh.com', 'principal', v_cs)
  on conflict (email) do update set role = 'principal', class_id = null, campus_id = v_cs;
  v_id := gen_random_uuid();
  begin
    insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
    values (v_id, 'kiem.bgh@truongvietanh.com', '{}'::jsonb,
            '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    v_ket := coalesce((select role::text from profiles where id = v_id), '(không có hồ sơ)')
             || ' · có cơ sở: ' || (select (campus_id is not null)::text from profiles where id = v_id);
  exception when others then
    v_ket := 'NỔ: ' || sqlerrm;
  end;
  insert into kq values ('Ban giám hiệu', 'principal · có cơ sở: true', v_ket);

  -- ── PHỤ HUYNH được mời gắn với một em ──────────────────────────────────────────────────
  select id into v_hs from profiles where role = 'student' limit 1;
  if v_hs is not null then
    insert into parent_invitations (email, student_id, status)
    values ('kiem.ph@truongvietanh.com', v_hs, 'pending')
    on conflict (email, student_id) do update set status = 'pending';
    v_id := gen_random_uuid();
    begin
      insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
      values (v_id, 'kiem.ph@truongvietanh.com', '{}'::jsonb,
              '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
      v_ket := coalesce((select role::text from profiles where id = v_id), '(không có hồ sơ)')
               || ' · số con: ' || (select count(*)::text from parent_links where parent_id = v_id);
    exception when others then
      v_ket := 'NỔ: ' || sqlerrm;
    end;
    insert into kq values ('Phụ huynh', 'parent · số con: 1', v_ket);
  end if;

  -- ── CHỐT CHẶN VẪN PHẢI CÒN NGUYÊN ──────────────────────────────────────────────────────
  -- Mở khe cho lúc đăng ký mà lỡ mở luôn cho mọi người thì còn tệ hơn lỗi ban đầu.
  -- Phải là một giáo viên KHÁC người đang chủ nhiệm lớp ấy, không thì cột không đổi giá trị,
  -- chốt chặn không có gì để chặn, và phép kiểm báo "thủng" vì lý do sai. Đã dính đúng bẫy này.
  declare v_gv_khac uuid;
  begin
    select id into v_gv_khac from profiles
     where role = 'teacher' and id is distinct from (select homeroom_teacher_id from classes where id = v_lop)
     limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_gv_khac::text)::text, true);
    perform set_config('role', 'authenticated', true);
    -- ĐO BẰNG GIÁ TRỊ SAU CÙNG, không bằng "có ném lỗi hay không".
    -- Luật RLS có thể chặn im: câu update chạy xong, không dòng nào đổi, KHÔNG có lỗi nào. Phép
    -- kiểm bắt lỗi sẽ kết luận "không chặn" trong khi thực tế đã chặn — đỏ vì lý do sai.
    declare v_truoc uuid; v_sau uuid;
    begin
      select homeroom_teacher_id into v_truoc from classes where id = v_lop;
      begin
        update classes set homeroom_teacher_id = v_gv_khac where id = v_lop;
      exception when others then null;
      end;
      select homeroom_teacher_id into v_sau from classes where id = v_lop;
      insert into kq values ('Giáo viên tự phong chủ nhiệm', 'bị chặn',
        case when v_sau is not distinct from v_truoc then 'bị chặn đúng' else 'KHÔNG CHẶN — thủng rồi' end);
    end;
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

select vai, ky_vong, thuc_te,
       case when thuc_te = ky_vong then 'ĐẠT'
            when ky_vong = 'bị chặn' and thuc_te like 'bị chặn%' then 'ĐẠT'
            else 'SAI' end as ket_luan
  from kq;

rollback;
