-- Chứng minh lỗi: một em rời lớp giữa đợt là GVCN không lưu được nhận xét cho CẢ LỚP.
begin;

create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  gv1  uuid := '22ec9392-46c6-420a-bae4-d890bd09d54f'; -- GVCN 7B1
  qtv  uuid := 'dc00a3e7-e7a9-4175-9b37-6dda75a99bc0';
  hs1  uuid := 'f10395c6-9975-4292-a7d8-778a7c72c478';
  hs2  uuid := '9015d780-587c-4ef9-8dfa-2b2cc2fcde8d';
  lop uuid; cs uuid; v_term uuid; n int;
begin
  select id, campus_id into lop, cs from classes where name = '7B1';
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
