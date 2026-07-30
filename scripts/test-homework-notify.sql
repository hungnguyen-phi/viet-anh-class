begin;
create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;
do $$
declare lop uuid; gv1 uuid := '22ec9392-46c6-420a-bae4-d890bd09d54f';
        n_hs int; n_ph int; n1 int; n2 int; v_post uuid;
begin
  select id into lop from classes where name='7B1';
  select count(*) into n_hs from enrollments where class_id=lop and is_active;
  select count(distinct pl.parent_id) into n_ph from enrollments e
    join parent_links pl on pl.student_id=e.student_id where e.class_id=lop and e.is_active;
  select count(*) into n1 from notifications;
  insert into homework_posts (class_id, subject, content, kind, created_by)
  values (lop,'Toán','BTVN trang 42','assignment',gv1) returning id into v_post;
  select count(*) into n2 from notifications;
  insert into kq values ('Đăng bài → sinh thông báo', (n_hs+n_ph)||' cái', (n2-n1)||' cái');
  select count(*) into n1 from notifications;
  update homework_posts set content='BTVN trang 43' where id=v_post;
  select count(*) into n2 from notifications;
  insert into kq values ('SỬA bài → KHÔNG sinh thêm', '0 cái', (n2-n1)||' cái');
  select count(*) into n1 from notifications n
    join enrollments e on e.student_id=n.user_id
    where e.class_id=lop and n.link='/homework';
  insert into kq values ('Thông báo tới đúng học sinh trong lớp', n_hs||' cái', n1||' cái');
end $$;
select buoc, ky_vong, thuc_te, case when ky_vong=thuc_te then 'OK' else 'SAI' end ket_luan from kq;
rollback;
