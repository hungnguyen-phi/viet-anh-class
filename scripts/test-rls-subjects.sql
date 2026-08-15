-- Kiểm ranh giới quyền của giáo viên bộ môn (migration 0069).
--
-- Câu hỏi then chốt: cô dạy TOÁN lớp 7B1 có ghi được điểm NGỮ VĂN của chính lớp đó không?
-- Nếu có thì bảng phân công vô nghĩa — cấp quyền theo LỚP chứ không theo (lớp, môn).
-- Bộ kiểm này cố tình dựng đúng tình huống đó.
--
-- Chạy trong transaction rồi ROLLBACK.
begin;

create temp table kq (nhom text, buoc text, ky_vong text, thuc_te text) on commit drop;

do $$
declare
  qtv   uuid; bgh uuid; gvcn uuid;
  gvbm  uuid; -- giáo viên bộ môn: sẽ được phân công dạy TOÁN ở lớp đang thử
  gvla  uuid; -- GVCN lớp khác, không dạy gì ở lớp đang thử
  hs1   uuid;
  ph1   uuid;
  lop uuid; cs uuid; m_toan uuid; m_van uuid;
  v_term uuid; v_rev uuid; n int; ds record;
begin
  -- LỚP THẬT có GVCN, và KHỐI của nó phải khớp với môn Toán/Văn (subject_fits_grade). Bám cứng
  -- tên '7B1' cùng sáu uuid là chọn cách phép kiểm mục theo thời gian — lớp ấy đã không còn.
  select c.id, c.campus_id, c.homeroom_teacher_id into lop, cs, gvcn
  from classes c
  join grades g on g.id = c.grade_id
  where c.is_active and c.homeroom_teacher_id is not null
    and exists (select 1 from enrollments e where e.class_id = c.id and e.is_active)
  order by g.sort_order
  limit 1;
  select id into qtv from profiles where role = 'admin' limit 1;
  select id into bgh from profiles where role = 'principal' and campus_id is not null limit 1;
  select c.homeroom_teacher_id into gvla
  from classes c where c.is_active and c.homeroom_teacher_id is not null and c.id <> lop limit 1;
  -- Giáo viên bộ môn: một người KHÁC GVCN, để phân công dạy đúng một môn ở lớp này.
  select p.id into gvbm from profiles p
  where p.role = 'teacher' and p.id <> gvcn and p.id is distinct from gvla limit 1;
  select e.student_id into hs1 from enrollments e where e.class_id = lop and e.is_active limit 1;
  select pl.parent_id into ph1 from parent_links pl where pl.student_id = hs1 limit 1;
  if lop is null or qtv is null or bgh is null or gvbm is null or gvla is null then
    insert into kq values ('DỰNG', 'Đủ vai để thử', 'có', 'THIẾU VAI');
    return;
  end if;
  select id into m_toan from subjects where code = 'TOAN' and campus_id is null;
  select id into m_van  from subjects where code = 'VAN'  and campus_id is null;

  -- Lớp học cả Toán lẫn Văn
  insert into class_subjects (class_id, subject_id) values (lop, m_toan), (lop, m_van)
  on conflict do nothing;

  -- Cô Lan CHỈ được phân công dạy TOÁN ở lớp này
  insert into teaching_assignments (class_id, subject_id, teacher_id)
  values (lop, m_toan, gvbm) on conflict do nothing;

  insert into assessment_terms (campus_id, school_year, kind, name, start_date, end_date, created_by)
  values (cs,'2026-2027','hoc_ky_1','HK1', current_date-30, current_date+30, qtv) returning id into v_term;
  insert into student_term_reviews (term_id, student_id, class_id, created_by)
  values (v_term, hs1, lop, gvcn) returning id into v_rev;

  -- Gieo sẵn một con điểm Toán và một con điểm Văn
  insert into subject_scores (review_id, subject_id, kind, score, created_by)
  values (v_rev, m_toan, '1tiet', 8, gvcn), (v_rev, m_van, '1tiet', 7, gvcn);

  -- ── GHI ĐIỂM ──
  for ds in
    select * from (values
      ('GHI ĐIỂM','GV bộ môn ghi điểm MÔN MÌNH',            gvbm, 'toan', true),
      ('GHI ĐIỂM','GV bộ môn ghi điểm MÔN KHÁC cùng lớp',   gvbm, 'van',  false),
      ('GHI ĐIỂM','GV không dạy lớp này ghi điểm',          gvla, 'toan', false),
      ('GHI ĐIỂM','GVCN ghi điểm mọi môn',                  gvcn, 'van',  true),
      ('GHI ĐIỂM','Hiệu trưởng ghi điểm',                   bgh,  'toan', false),
      ('GHI ĐIỂM','Quản trị viên ghi điểm',                 qtv,  'van',  true)
    ) v(nhom, nhan, uid, mon, duoc)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', ds.uid, 'role','authenticated')::text, true);
    perform set_config('role','authenticated', true);
    begin
      update subject_scores set score = 9
       where review_id = v_rev
         and subject_id = (case when ds.mon = 'toan' then m_toan else m_van end);
      get diagnostics n = row_count;
      perform set_config('role','postgres', true);
      insert into kq values (ds.nhom, ds.nhan,
        case when ds.duoc then 'sửa được' else 'không sửa được' end,
        case when n > 0 then 'sửa được' else 'không sửa được' end);
    exception when others then
      perform set_config('role','postgres', true);
      insert into kq values (ds.nhom, ds.nhan,
        case when ds.duoc then 'sửa được' else 'không sửa được' end, 'chặn '||sqlstate);
    end;
  end loop;

  -- ── ĐỔI MÔN CỦA MỘT CON ĐIỂM (lỗ mà thiết kế cảnh báo) ──
  -- Cô dạy Toán sửa dòng điểm Toán của mình rồi ĐỔI subject_id sang Văn. USING cho qua vì dòng CŨ
  -- là Toán; chỉ WITH CHECK mới bắt được. Thiếu vế đó là ghi được vào môn không phải của mình.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gvbm, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    update subject_scores set subject_id = m_van
     where review_id = v_rev and subject_id = m_toan;
    get diagnostics n = row_count;
    perform set_config('role','postgres', true);
    insert into kq values ('GHI ĐIỂM','GV bộ môn ĐỔI môn của con điểm sang môn khác',
      'không sửa được', case when n>0 then 'SỬA ĐƯỢC — RÒ!' else 'không sửa được' end);
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('GHI ĐIỂM','GV bộ môn ĐỔI môn của con điểm sang môn khác',
      'không sửa được', 'chặn '||sqlstate);
  end;

  -- ── ĐỌC ──
  for ds in
    select * from (values
      ('ĐỌC','GV bộ môn đọc điểm MÔN MÌNH',          gvbm, 'toan', 1),
      ('ĐỌC','GV bộ môn đọc điểm MÔN KHÁC cùng lớp', gvbm, 'van',  0),
      ('ĐỌC','GV không dạy lớp này đọc điểm',        gvla, 'toan', 0),
      ('ĐỌC','GVCN đọc mọi môn',                     gvcn, 'van',  1),
      ('ĐỌC','Hiệu trưởng đọc mọi môn',              bgh,  'van',  1),
      ('ĐỌC','Phụ huynh đọc khi CHƯA công bố',       ph1,  'toan', 0)
    ) v(nhom, nhan, uid, mon, ky_vong)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', ds.uid, 'role','authenticated')::text, true);
    perform set_config('role','authenticated', true);
    select count(*) into n from subject_scores
     where review_id = v_rev
       and subject_id = (case when ds.mon = 'toan' then m_toan else m_van end);
    perform set_config('role','postgres', true);
    insert into kq values (ds.nhom, ds.nhan, ds.ky_vong||' dòng', n||' dòng');
  end loop;

  -- ── NHẬN XÉT + HẠNH KIỂM: giáo viên bộ môn KHÔNG chạm ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', gvbm, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  update student_term_reviews set comment = 'GVBM viết' where id = v_rev;
  get diagnostics n = row_count;
  perform set_config('role','postgres', true);
  insert into kq values ('NHẬN XÉT','GV bộ môn sửa nhận xét/hạnh kiểm','0 dòng', n||' dòng');

  -- ── PHÂN CÔNG: ai được cấp quyền cho ai ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', gvbm, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    insert into teaching_assignments (class_id, subject_id, teacher_id)
    values (lop, m_van, gvbm);
    perform set_config('role','postgres', true);
    insert into kq values ('PHÂN CÔNG','GV tự phân công thêm môn cho mình','bị chặn','GHI ĐƯỢC — RÒ!');
  exception when others then
    perform set_config('role','postgres', true);
    insert into kq values ('PHÂN CÔNG','GV tự phân công thêm môn cho mình','bị chặn','chặn '||sqlstate);
  end;

  -- ── THÔI DẠY thì mất quyền NGAY ──
  update teaching_assignments set is_active = false
   where class_id = lop and subject_id = m_toan and teacher_id = gvbm;
  perform set_config('request.jwt.claims',
    json_build_object('sub', gvbm, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  update subject_scores set score = 5 where review_id = v_rev and subject_id = m_toan;
  get diagnostics n = row_count;
  perform set_config('role','postgres', true);
  insert into kq values ('THÔI DẠY','GV đã thôi dạy vẫn sửa điểm?','0 dòng', n||' dòng');

  -- ── DANH MỤC MÔN: hiệu trưởng không được sửa môn DÙNG CHUNG ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', bgh, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  update subjects set name = 'Văn' where id = m_van;
  get diagnostics n = row_count;
  perform set_config('role','postgres', true);
  insert into kq values ('DANH MỤC','Hiệu trưởng đổi tên môn dùng chung','0 dòng', n||' dòng');

  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims','',true);
end $$;

-- "chặn 42501" là kết quả MẠNH HƠN "không sửa được / 0 dòng", không phải khác kết quả: Postgres
-- ném lỗi thay vì lặng lẽ không đụng dòng nào. Cả hai đều nghĩa là KHÔNG GHI ĐƯỢC, nên tính đạt.
create or replace function _kq_dat(ky_vong text, thuc_te text) returns boolean
  language sql immutable as $$
  select ky_vong = thuc_te
      or (thuc_te like 'chặn %' and ky_vong in ('bị chặn', 'không sửa được', '0 dòng'));
$$;

select nhom, buoc, ky_vong, thuc_te,
       case when _kq_dat(ky_vong, thuc_te) then 'OK' else 'SAI' end as ket_luan
from kq;

select count(*) filter (where not _kq_dat(ky_vong, thuc_te)) as so_sai, count(*) as tong from kq;

drop function _kq_dat(text, text);

rollback;
