begin;
create temp table kq (buoc text, ky_vong text, thuc_te text) on commit drop;
do $$
declare lop uuid; gv1 uuid;
        n_hs int; n_ph int; n1 int; n2 int; v_post uuid;
  v_moc timestamptz;
begin
  -- LỚP THẬT BẤT KỲ, không bám cứng vào một tên. Lớp '7B1' từng dùng để thử đã không còn trong
  -- CSDL (dọn cùng đợt đổi mô hình WIG) — bám cứng vào một tên là chọn cách phép kiểm chắc chắn
  -- mục theo thời gian. Đây đúng bẫy "test-man-wig-that.mjs" đã ghi: xanh giả ở một lớp trống.
  select c.id, c.homeroom_teacher_id into lop, gv1
  from classes c
  where c.is_active and c.homeroom_teacher_id is not null
    and exists (select 1 from enrollments e where e.class_id = c.id and e.is_active)
  limit 1;
  if lop is null then
    insert into kq values ('Có lớp để thử', 'có lớp có GVCN và học sinh', 'KHÔNG CÓ');
    return;
  end if;
  select count(*) into n_hs from enrollments where class_id=lop and is_active;
  select count(distinct pl.parent_id) into n_ph from enrollments e
    join parent_links pl on pl.student_id=e.student_id where e.class_id=lop and e.is_active;
  select count(*) into n1 from notifications;
  -- MỐC THỜI GIAN, để phép đo cuối chỉ đếm những thông báo VỪA SINH RA. Không có mốc này thì nó
  -- đếm mọi thông báo '/homework' từ trước tới nay của lớp — kể cả dòng còn lại của một lượt chạy
  -- khác — rồi báo lệch ("mong 4, thực tế 5") như thể trigger gửi thừa.
  -- `now()`, KHÔNG PHẢI `clock_timestamp()`: trong một transaction, now() đứng yên ở lúc mở
  -- transaction, mà thông báo sinh ra mang đúng dấu ấy (created_at default now()). Lấy
  -- clock_timestamp() là mốc muộn hơn chính dòng vừa sinh, và phép đo đếm ra 0.
  v_moc := now();
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
    where e.class_id=lop and n.link='/homework' and n.created_at >= v_moc;
  insert into kq values ('Thông báo tới đúng học sinh trong lớp', n_hs||' cái', n1||' cái');
end $$;
select buoc, ky_vong, thuc_te, case when ky_vong=thuc_te then 'OK' else 'SAI' end ket_luan from kq;
rollback;
