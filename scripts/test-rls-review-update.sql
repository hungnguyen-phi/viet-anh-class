-- Chứng minh lỗi: một em rời lớp giữa đợt là GVCN không lưu được nhận xét cho CẢ LỚP.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  gv1 uuid; qtv uuid; hs1 uuid; hs2 uuid;
  lop uuid; cs uuid; v_term uuid; n int;
begin
  -- LỚP THẬT BẤT KỲ có GVCN và ít nhất hai em. Bám cứng tên '7B1' và bốn uuid là chọn cách phép
  -- kiểm chắc chắn mục theo thời gian — lớp ấy đã không còn trong CSDL từ đợt đổi mô hình WIG.
  select c.id, c.campus_id, c.homeroom_teacher_id into lop, cs, gv1
  from classes c
  where c.is_active and c.homeroom_teacher_id is not null
    and (select count(*) from enrollments e where e.class_id = c.id and e.is_active) >= 2
  limit 1;
  select id into qtv from profiles where role = 'admin' limit 1;
  if lop is null or qtv is null then
    insert into kq values ('Có lớp và quản trị viên để thử', 'có', 'KHÔNG CÓ');
    return;
  end if;
  select student_id into hs1 from enrollments
   where class_id = lop and is_active order by student_id limit 1;
  select student_id into hs2 from enrollments
   where class_id = lop and is_active order by student_id desc limit 1;
  insert into assessment_terms (campus_id, school_year, kind, name, start_date, end_date, created_by)
  values (cs,'2026-2027','hoc_ky_1','HK1', current_date-30, current_date+30, qtv) returning id into v_term;
  insert into student_term_reviews (term_id, student_id, class_id, comment, created_by)
  values (v_term, hs1, lop, 'nháp', gv1), (v_term, hs2, lop, 'nháp', gv1);

  -- Bình thường: GVCN lưu nhận xét cho cả lớp
  perform set_config('request.jwt.claims', json_build_object('sub',gv1,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    update student_term_reviews set comment = 'cô nhận xét' where term_id = v_term;
    get diagnostics n = row_count;
    perform set_config('role','postgres', true);
    insert into kq values ('Cả lớp còn học · lưu nhận xét', '2 dòng', n||' dòng');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('Cả lớp còn học · lưu nhận xét', '2 dòng', 'BỊ CHẶN '||sqlstate);
  end;

  -- Một em chuyển trường giữa đợt
  update enrollments set is_active = false where student_id = hs2 and class_id = lop;

  perform set_config('role','authenticated', true);
  begin
    update student_term_reviews set comment = 'cô nhận xét lần 2' where term_id = v_term;
    get diagnostics n = row_count;
    perform set_config('role','postgres', true);
    insert into kq values ('MỘT em đã rời lớp · lưu cả lớp', '2 dòng', n||' dòng');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('MỘT em đã rời lớp · lưu cả lớp', '2 dòng', 'BỊ CHẶN '||sqlstate);
  end;

  -- Công bố cả lớp
  perform set_config('role','authenticated', true);
  begin
    update student_term_reviews set published_at = now() where term_id = v_term;
    get diagnostics n = row_count;
    perform set_config('role','postgres', true);
    insert into kq values ('MỘT em đã rời lớp · công bố cả lớp', '2 dòng', n||' dòng');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('MỘT em đã rời lớp · công bố cả lớp', '2 dòng', 'BỊ CHẶN '||sqlstate);
  end;

  -- Vẫn phải chặn: GVCN lập phiếu MỚI cho em không thuộc lớp mình
  perform set_config('role','authenticated', true);
  begin
    insert into student_term_reviews (term_id, student_id, class_id, comment)
    values (v_term, 'ce4271d7-32ad-4e95-9221-b6f00df884e4', lop, 'em lớp khác');
    perform set_config('role','postgres', true);
    insert into kq values ('Lập phiếu cho em KHÔNG thuộc lớp', 'bị chặn', 'GHI ĐƯỢC — RÒ!');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('Lập phiếu cho em KHÔNG thuộc lớp', 'bị chặn', 'chặn '||sqlstate);
  end;

  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims','',true);
end $$;

select buoc, ky_vong, thuc_te,
  case when ky_vong=thuc_te then 'OK'
       when ky_vong like '%chặn%' and thuc_te like '%chặn%' then 'OK'
       else 'SAI' end as ket_luan
from kq;

rollback;
