-- BAN GIÁM HIỆU DỰNG ĐƯỢC DANH SÁCH HỌC SINH — NHƯNG CHỈ TRONG CƠ SỞ MÌNH (migration 0094).
--
--   npm run sql -- scripts/test-rls-bgh-hoc-sinh.sql
--
-- Câu hỏi then chốt: mở quyền cho BGH xong, họ có với sang được cơ sở KHÁC không? Nếu có thì
-- việc mở quyền này biến "hiệu trưởng một cơ sở" thành "quản trị viên toàn trường" mà không ai
-- định thế. Bộ kiểm dựng hẳn một cơ sở thứ hai để hỏi đúng câu đó.
--
-- Chạy trong transaction rồi ROLLBACK — không để lại gì trên dữ liệu thật.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;
-- Nửa sau bộ kiểm chạy dưới vai 'authenticated' để RLS thật sự có hiệu lực; vai ấy phải ghi được
-- vào bảng kết quả, không thì chính bảng kết quả lại là thứ chặn bộ kiểm.
grant all on kq to authenticated;

do $$
declare
  v_bgh uuid; v_cs_minh uuid; v_lop_minh uuid;
  v_cs_khac uuid; v_lop_khac uuid; v_khoi_khac uuid;
  v_email_hs text; v_ket text; v_duoc boolean;
begin
  -- Lấy một hiệu trưởng CÓ cơ sở. Không đóng cứng id: dữ liệu đổi lúc nào không ai báo.
  select id, campus_id into v_bgh, v_cs_minh
    from profiles where role = 'principal' and campus_id is not null limit 1;
  if v_bgh is null then
    insert into kq values ('Tiền đề', 'có ít nhất 1 hiệu trưởng đã gán cơ sở', 'KHÔNG CÓ — bỏ qua cả bộ kiểm');
    return;
  end if;

  select id into v_lop_minh from classes where campus_id = v_cs_minh limit 1;
  if v_lop_minh is null then
    insert into kq values ('Tiền đề', 'cơ sở của hiệu trưởng có ít nhất 1 lớp', 'KHÔNG CÓ — bỏ qua cả bộ kiểm');
    return;
  end if;

  -- Cơ sở thứ hai, dựng tạm trong chính transaction này rồi rollback.
  insert into campuses (name, code) values ('Cơ sở kiểm thử tạm', 'KIEMTHU') returning id into v_cs_khac;
  insert into grades (campus_id, name, sort_order) values (v_cs_khac, 'Khối kiểm thử', 1)
    returning id into v_khoi_khac;
  insert into classes (campus_id, grade_id, name, school_year)
    values (v_cs_khac, v_khoi_khac, 'Lớp kiểm thử', '2026-2027') returning id into v_lop_khac;

  v_email_hs := 'kiem.rls.bgh@student.truongvietanh.com';

  -- ── Từ đây trở đi, mọi lệnh chạy DƯỚI DANH NGHĨA HIỆU TRƯỞNG ─────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_bgh::text)::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1. Ghi danh vào lớp TRONG cơ sở mình: email chưa có tài khoản nên trả 'not_found' — điều đó
  --    đã đủ chứng minh hàm KHÔNG chặn quyền, vì chặn quyền thì nó ném lỗi trước khi tra email.
  begin
    v_ket := enroll_student_by_email(v_lop_minh, v_email_hs);
    insert into kq values ('BGH ghi danh vào lớp trong cơ sở mình', 'qua được cửa quyền', 'qua được (trả ' || v_ket || ')');
  exception when others then
    insert into kq values ('BGH ghi danh vào lớp trong cơ sở mình', 'qua được cửa quyền', 'BỊ CHẶN: ' || sqlerrm);
  end;

  -- 2. Ghi danh vào lớp Ở CƠ SỞ KHÁC: phải bị chặn.
  begin
    v_ket := enroll_student_by_email(v_lop_khac, v_email_hs);
    insert into kq values ('BGH ghi danh vào lớp cơ sở KHÁC', 'bị chặn', 'KHÔNG CHẶN — trả ' || v_ket);
  exception when others then
    insert into kq values ('BGH ghi danh vào lớp cơ sở KHÁC', 'bị chặn', 'bị chặn đúng');
  end;

  -- 3. Cho rời lớp ở cơ sở khác: phải bị chặn.
  begin
    perform unenroll_student(v_lop_khac, v_bgh);
    insert into kq values ('BGH cho rời lớp ở cơ sở KHÁC', 'bị chặn', 'KHÔNG CHẶN');
  exception when others then
    insert into kq values ('BGH cho rời lớp ở cơ sở KHÁC', 'bị chặn', 'bị chặn đúng');
  end;

  -- 4. Mời một em vào lớp trong cơ sở mình, rồi hỏi: BGH có được điền thông tin cho em ấy không.
  v_ket := invite_student_to_class(v_lop_minh, v_email_hs);
  select can_manage_student_email(v_email_hs) into v_duoc;
  insert into kq values ('BGH sửa được thông tin em mình vừa mời', 'true', v_duoc::text);

  -- 5. Ghi thật vào bảng: đúng cửa RLS chứ không chỉ đúng hàm kiểm.
  begin
    insert into student_details (email, full_name, date_of_birth, parent_phone)
    values (v_email_hs, 'Em Kiểm Thử', date '2010-05-05', '0900000000');
    insert into kq values ('BGH ghi được ngày sinh / SĐT phụ huynh', 'ghi được', 'ghi được');
  exception when others then
    insert into kq values ('BGH ghi được ngày sinh / SĐT phụ huynh', 'ghi được', 'BỊ CHẶN: ' || sqlerrm);
  end;

  -- 6. Em ở CƠ SỞ KHÁC thì không được đụng vào.
  perform invite_student_to_class(v_lop_khac, 'kiem.rls.ngoai@student.truongvietanh.com');
  select can_manage_student_email('kiem.rls.ngoai@student.truongvietanh.com') into v_duoc;
  insert into kq values ('BGH sửa thông tin em ở cơ sở KHÁC', 'false', v_duoc::text);

  -- 7. Không được tự nâng vai: 0049 chặn BGH mời admin/principal. Kiểm lại vì bản này đụng vào
  --    đúng vùng quyền ấy.
  begin
    insert into pending_user_grants (email, role, campus_id)
    values ('kiem.rls.leo@truongvietanh.com', 'admin', v_cs_minh);
    insert into kq values ('BGH tự mời thêm quản trị viên', 'bị chặn', 'KHÔNG CHẶN');
  exception when others then
    insert into kq values ('BGH tự mời thêm quản trị viên', 'bị chặn', 'bị chặn đúng');
  end;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

select buoc,
       ky_vong,
       thuc_te,
       case
         when ky_vong = 'true'  and thuc_te = 'true'  then 'ĐẠT'
         when ky_vong = 'false' and thuc_te = 'false' then 'ĐẠT'
         when ky_vong = 'bị chặn' and thuc_te like 'bị chặn%' then 'ĐẠT'
         when ky_vong like 'qua được%' and thuc_te like 'qua được%' then 'ĐẠT'
         when ky_vong = 'ghi được' and thuc_te = 'ghi được' then 'ĐẠT'
         else 'SAI'
       end as ket_luan
  from kq;

rollback;
