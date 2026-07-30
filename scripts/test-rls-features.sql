-- Kiểm ranh giới quyền của 5 bảng mới (0061–0065) bằng RLS THẬT.
--
-- Điểm mấu chốt: dùng HAI phụ huynh của HAI học sinh trong CÙNG lớp 7B1. Bộ ba tài khoản chỉ có
-- một phụ huynh sẽ KHÔNG bắt được lỗi lẫn is_my_child(student) với is_parent_of_class(class) —
-- hai hàm nhìn na ná, cùng chạy đúng khi lớp chỉ có một gia đình.
--
-- Chạy trong một transaction rồi ROLLBACK.
begin;

create temp table kq (nhom text, buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  qtv    uuid := 'dc00a3e7-e7a9-4175-9b37-6dda75a99bc0'; -- admin
  bgh    uuid := '074f1e2e-e7bd-4401-ac03-291b02b37c62'; -- principal Q2 (test2.bgh)
  gv1    uuid := '22ec9392-46c6-420a-bae4-d890bd09d54f'; -- GVCN 7B1
  gv3    uuid := '26f6e5b6-dabd-4f64-8fe1-1a1ffc4da4dd'; -- GVCN 6A2 (lớp+cơ sở khác)
  hs1    uuid := 'f10395c6-9975-4292-a7d8-778a7c72c478'; -- con của ph1, lớp 7B1
  hs2    uuid := '9015d780-587c-4ef9-8dfa-2b2cc2fcde8d'; -- con của ph2, lớp 7B1
  ph1    uuid := '5fbca2bf-9797-4c53-a42e-62199332bb55';
  ph2    uuid := 'c03a5c74-a983-4cdf-99a0-b8d578eb95eb';
  lop    uuid;
  cs     uuid;
  v_post uuid; v_term uuid; v_rev1 uuid; v_rev2 uuid;
  v_alb  uuid; v_th1 uuid; v_th2 uuid;
  n int;
  ds record;
begin
  select id, campus_id into lop, cs from classes where name = '7B1';

  -- ── Gieo dữ liệu bằng quyền postgres (bỏ qua RLS) ──
  insert into homework_posts (class_id, date, subject, content, kind, created_by)
  values (lop, current_date, 'Toán', 'BTVN trang 42', 'assignment', gv1) returning id into v_post;

  insert into homework_done (post_id, student_id) values (v_post, hs1);

  insert into meal_menus (campus_id, date, meal, items, updated_by)
  values (cs, current_date, 'lunch'::meal_slot,
          'Cơm — canh chua — thịt kho', qtv);

  insert into class_albums (class_id, title, created_by) values (lop, 'Hội thao', gv1) returning id into v_alb;
  insert into class_photos (album_id, storage_path, uploaded_by) values (v_alb, lop||'/'||v_alb||'/a.jpg', gv1);

  insert into assessment_terms (campus_id, school_year, kind, name, start_date, end_date, created_by)
  values (cs, '2026-2027',
          'hoc_ky_1'::assessment_term_kind,
          'HK1', current_date - 30, current_date + 30, qtv)
  returning id into v_term;

  -- Phiếu của hs1: ĐÃ công bố. Phiếu của hs2: CHƯA công bố.
  insert into student_term_reviews (term_id, student_id, class_id, comment, published_at, created_by)
  values (v_term, hs1, lop, 'Em tiến bộ rõ', now(), gv1) returning id into v_rev1;
  insert into student_term_reviews (term_id, student_id, class_id, comment, created_by)
  values (v_term, hs2, lop, 'Nháp chưa công bố', gv1) returning id into v_rev2;

  insert into subject_scores (review_id, subject, kind, score, created_by)
  values (v_rev1, 'Toán',
          '1tiet'::score_kind, 8.5, gv1);

  insert into parent_teacher_threads (student_id, class_id, opened_by) values (hs1, lop, ph1) returning id into v_th1;
  insert into parent_teacher_threads (student_id, class_id, opened_by) values (hs2, lop, ph2) returning id into v_th2;
  insert into parent_teacher_messages (thread_id, sender_id, sender_role, sender_side, body)
  values (v_th1, ph1, 'parent', 'parent', 'Chào cô, cháu hôm nay hơi mệt');

  -- ── Chạy cùng một câu hỏi dưới nhiều danh tính ──
  for ds in
    select * from (values
      -- nhóm            nhãn                                  uid   sql                                                                              kỳ vọng
      ('BÁO BÀI','GVCN lớp đó đọc',                    gv1, 'select count(*) from homework_posts where class_id='''||lop||'''', 1),
      ('BÁO BÀI','GVCN lớp khác đọc',                  gv3, 'select count(*) from homework_posts where class_id='''||lop||'''', 0),
      ('BÁO BÀI','Hiệu trưởng cùng cơ sở đọc',         bgh, 'select count(*) from homework_posts where class_id='''||lop||'''', 1),
      ('BÁO BÀI','Học sinh trong lớp đọc',             hs1, 'select count(*) from homework_posts where class_id='''||lop||'''', 1),
      ('BÁO BÀI','Phụ huynh có con trong lớp đọc',     ph1, 'select count(*) from homework_posts where class_id='''||lop||'''', 1),
      ('BÁO BÀI','Phụ huynh KHÁC cùng lớp cũng đọc',   ph2, 'select count(*) from homework_posts where class_id='''||lop||'''', 1),

      ('ĐÃ LÀM','Chính em đó thấy tick của mình',      hs1, 'select count(*) from homework_done where post_id='''||v_post||'''', 1),
      ('ĐÃ LÀM','Bạn cùng lớp KHÔNG thấy tick',        hs2, 'select count(*) from homework_done where post_id='''||v_post||'''', 0),
      ('ĐÃ LÀM','Bố mẹ em đó thấy',                    ph1, 'select count(*) from homework_done where post_id='''||v_post||'''', 1),
      ('ĐÃ LÀM','Bố mẹ em KHÁC KHÔNG thấy',            ph2, 'select count(*) from homework_done where post_id='''||v_post||'''', 0),
      ('ĐÃ LÀM','GVCN thấy',                           gv1, 'select count(*) from homework_done where post_id='''||v_post||'''', 1),
      ('ĐÃ LÀM','Hiệu trưởng KHÔNG thấy',              bgh, 'select count(*) from homework_done where post_id='''||v_post||'''', 0),

      ('THỰC ĐƠN','Phụ huynh cùng cơ sở đọc',          ph1, 'select count(*) from meal_menus where campus_id='''||cs||'''', 1),
      ('THỰC ĐƠN','GVCN cơ sở khác KHÔNG đọc',         gv3, 'select count(*) from meal_menus where campus_id='''||cs||'''', 0),

      ('ẢNH','GVCN lớp đó đọc album',                  gv1, 'select count(*) from class_albums where class_id='''||lop||'''', 1),
      ('ẢNH','Phụ huynh có con trong lớp đọc',         ph1, 'select count(*) from class_albums where class_id='''||lop||'''', 1),
      ('ẢNH','GVCN lớp khác KHÔNG đọc',                gv3, 'select count(*) from class_albums where class_id='''||lop||'''', 0),
      ('ẢNH','GVCN lớp khác KHÔNG đọc ảnh',            gv3, 'select count(*) from class_photos where album_id='''||v_alb||'''', 0),

      ('HỌC BẠ','GVCN đọc phiếu đã công bố',           gv1, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 1),
      ('HỌC BẠ','GVCN đọc cả phiếu CHƯA công bố',      gv1, 'select count(*) from student_term_reviews where id='''||v_rev2||'''', 1),
      ('HỌC BẠ','Hiệu trưởng cùng cơ sở đọc',          bgh, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 1),
      ('HỌC BẠ','GVCN lớp khác KHÔNG đọc',             gv3, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 0),
      ('HỌC BẠ','Bố mẹ đọc phiếu ĐÃ công bố của con',  ph1, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 1),
      ('HỌC BẠ','Bố mẹ KHÔNG đọc phiếu con NHÀ KHÁC',  ph1, 'select count(*) from student_term_reviews where id='''||v_rev2||'''', 0),
      ('HỌC BẠ','Bố mẹ KHÔNG đọc phiếu CHƯA công bố',  ph2, 'select count(*) from student_term_reviews where id='''||v_rev2||'''', 0),
      ('HỌC BẠ','Chính em đọc phiếu đã công bố',       hs1, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 1),
      ('HỌC BẠ','Bạn cùng lớp KHÔNG đọc phiếu em khác',hs2, 'select count(*) from student_term_reviews where id='''||v_rev1||'''', 0),
      ('ĐIỂM','Bố mẹ đọc điểm con mình',               ph1, 'select count(*) from subject_scores where review_id='''||v_rev1||'''', 1),
      ('ĐIỂM','Bố mẹ nhà khác KHÔNG đọc',              ph2, 'select count(*) from subject_scores where review_id='''||v_rev1||'''', 0),
      ('ĐIỂM','Bạn cùng lớp KHÔNG đọc',                hs2, 'select count(*) from subject_scores where review_id='''||v_rev1||'''', 0),
      ('ĐIỂM','GVCN lớp khác KHÔNG đọc',               gv3, 'select count(*) from subject_scores where review_id='''||v_rev1||'''', 0),

      ('TIN NHẮN','Bố mẹ đọc cuộc của con mình',       ph1, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 1),
      ('TIN NHẮN','Bố mẹ KHÔNG đọc cuộc nhà khác',     ph1, 'select count(*) from parent_teacher_threads where id='''||v_th2||'''', 0),
      ('TIN NHẮN','Bố mẹ 2 KHÔNG đọc cuộc nhà 1',      ph2, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 0),
      ('TIN NHẮN','GVCN đọc cuộc lớp mình',            gv1, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 1),
      ('TIN NHẮN','GVCN lớp khác KHÔNG đọc',           gv3, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 0),
      ('TIN NHẮN','Hiệu trưởng KHÔNG đọc cuộc',        bgh, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 0),
      ('TIN NHẮN','Quản trị viên KHÔNG đọc cuộc',      qtv, 'select count(*) from parent_teacher_threads where id='''||v_th1||'''', 0),
      ('TIN NHẮN','Bố mẹ nhà khác KHÔNG đọc nội dung', ph2, 'select count(*) from parent_teacher_messages where thread_id='''||v_th1||'''', 0),
      ('TIN NHẮN','Quản trị viên KHÔNG đọc nội dung',  qtv, 'select count(*) from parent_teacher_messages where thread_id='''||v_th1||'''', 0),
      ('TIN NHẮN','Học sinh KHÔNG đọc cuộc về mình',   hs1, 'select count(*) from parent_teacher_messages where thread_id='''||v_th1||'''', 0)
    ) v(nhom, nhan, uid, cau, ky_vong)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', ds.uid, 'role','authenticated')::text, true);
    perform set_config('role','authenticated', true);
    begin
      execute ds.cau into n;
      perform set_config('role','postgres', true);
      insert into kq values (ds.nhom, ds.nhan, ds.ky_vong||' dòng', n||' dòng');
    exception when others then
      perform set_config('role','postgres', true);
      insert into kq values (ds.nhom, ds.nhan, ds.ky_vong||' dòng', 'chặn '||sqlstate);
    end;
  end loop;

  -- ── Thử GHI trái phép ──
  -- Phụ huynh 2 cố gửi tin vào cuộc của nhà 1
  perform set_config('request.jwt.claims', json_build_object('sub',ph2,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    insert into parent_teacher_messages (thread_id, sender_id, sender_role, sender_side, body)
    values (v_th1, ph2, 'parent', 'parent', 'CHEN NGANG');
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','Phụ huynh chen vào cuộc nhà khác','bị chặn','GHI ĐƯỢC — RÒ!');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','Phụ huynh chen vào cuộc nhà khác','bị chặn','chặn '||sqlstate);
  end;

  -- GVCN lớp khác cố đăng báo bài vào lớp 7B1
  perform set_config('request.jwt.claims', json_build_object('sub',gv3,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    insert into homework_posts (class_id, subject, content) values (lop,'Lý','chen ngang');
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','GVCN lớp khác đăng báo bài','bị chặn','GHI ĐƯỢC — RÒ!');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','GVCN lớp khác đăng báo bài','bị chặn','chặn '||sqlstate);
  end;

  -- Hiệu trưởng cố sửa điểm
  perform set_config('request.jwt.claims', json_build_object('sub',bgh,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  update subject_scores set score = 10 where review_id = v_rev1;
  get diagnostics n = row_count;
  perform set_config('role','postgres', true);
  insert into kq values ('GHI','Hiệu trưởng sửa điểm','0 dòng', n||' dòng');

  -- Học sinh cố tự sửa nhận xét của mình
  perform set_config('request.jwt.claims', json_build_object('sub',hs1,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  update student_term_reviews set comment = 'Em tự khen' where id = v_rev1;
  get diagnostics n = row_count;
  perform set_config('role','postgres', true);
  insert into kq values ('GHI','Học sinh tự sửa nhận xét','0 dòng', n||' dòng');

  -- Học sinh cố tick hộ bạn
  perform set_config('role','authenticated', true);
  begin
    insert into homework_done (post_id, student_id) values (v_post, hs2);
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','Học sinh tick hộ bạn','bị chặn','GHI ĐƯỢC — RÒ!');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GHI','Học sinh tick hộ bạn','bị chặn','chặn '||sqlstate);
  end;

  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims','',true);
end $$;

select nhom, buoc, ky_vong, thuc_te,
       case when ky_vong = thuc_te then 'OK'
            when ky_vong like '%chặn%' and thuc_te like '%chặn%' then 'OK'
            else 'SAI' end as ket_luan
from kq;

select count(*) filter (where
  not (ky_vong = thuc_te or (ky_vong like '%chặn%' and thuc_te like '%chặn%'))) as so_sai,
  count(*) as tong
from kq;

rollback;
