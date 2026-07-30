-- 0070 — Chặn gắn môn SAI KHỐI vào lớp, và gieo bộ môn cho lớp thì gieo ĐÚNG KHỐI.
--
-- HAI LỖ CÒN LẠI CỦA 0069, đã ghi ra lúc đó nhưng chưa bịt:
--
--   (1) subject_fits_grade() được VIẾT nhưng KHÔNG TRIGGER NÀO GỌI. Nghĩa là bảng subject_grades
--       ("Vật lí dạy lớp 10-12") chỉ là chữ trang trí — vẫn gắn được Vật lí vào lớp 6 và không
--       gì kêu. Bảng nào cũng vậy: một ràng buộc không ai kiểm thì không phải ràng buộc.
--
--   (2) seed_class_subjects() gieo MỌI môn đang dùng, không lọc khối. Bấm "bổ sung môn chuẩn"
--       cho lớp 6 là lớp đó có luôn Vật lí, Hoá học, Sinh học, Giáo dục kinh tế và pháp luật —
--       bốn môn cấp ba. Rồi ô chọn môn lúc nhập điểm đầy môn không học, và giáo viên chọn nhầm.
--
-- BỐN MÔN CHƯA KHAI LỚP VẪN CHỌN ĐƯỢC CHO MỌI LỚP — không đổi.
-- Bảng môn của trường để trống ở "Lịch sử và Địa lí", "Tin học", "Oxford English" (và Hoá học
-- chỉ đánh dấu lớp 10). subject_fits_grade() đã coi "chưa khai lớp" = không hạn chế, nên siết
-- lần này KHÔNG chặn nhầm bốn môn đó. Đó cũng là lối thoát có sẵn: trường nào không muốn ràng
-- buộc một môn thì cứ để trống danh sách lớp của nó.

set search_path = public;

-- ── (1) Chặn gắn môn sai khối ───────────────────────────────────────────────
--
-- QUẢN TRỊ VIÊN ĐƯỢC VƯỢT, cố ý. Trường thật có ngoại lệ — lớp 9 chuyên học trước một môn lớp 10
-- chẳng hạn. Chặn cứng cả admin thì họ không còn đường nào ngoài việc sửa danh sách lớp của môn
-- đó cho TOÀN TRƯỜNG, tức là mở ngoại lệ của một lớp ra thành quy tắc chung — tệ hơn hẳn.
-- Đây cũng đúng lối 0064 đã đặt: admin vượt được term_is_locked. Giữ một vai "biết mình đang làm
-- gì" nhất quán trong cả hệ thống, thay vì mỗi bảng một luật.
--
-- Câu báo lỗi nêu ĐỦ ba thứ người sửa cần: môn nào, môn đó dạy lớp mấy, và lớp này là khối mấy.
-- Báo "vi phạm ràng buộc" trống không thì người dùng chỉ biết là hỏng, không biết sửa gì.
create or replace function class_subject_grade_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_mon   text;
  v_lop   text;
  v_khoi  smallint;
  v_cac   text;
begin
  if auth_role() = 'admin'::user_role then
    return new;                       -- xem lý do ở khối comment trên
  end if;

  if subject_fits_grade(new.subject_id, new.class_id) then
    return new;
  end if;

  select s.name into v_mon from subjects s where s.id = new.subject_id;
  select c.name, g.sort_order into v_lop, v_khoi
    from classes c left join grades g on g.id = c.grade_id
   where c.id = new.class_id;
  select string_agg(sg.grade_no::text, ', ' order by sg.grade_no) into v_cac
    from subject_grades sg where sg.subject_id = new.subject_id;

  raise exception
    'Môn "%" chỉ dạy lớp %, không gắn vào lớp % (khối %) được. Muốn dạy thật thì thêm khối % vào môn này ở màn Danh mục môn.',
    coalesce(v_mon, '?'), coalesce(v_cac, '—'), coalesce(v_lop, '?'),
    coalesce(v_khoi::text, '—'), coalesce(v_khoi::text, '—');
end $$;

revoke all on function class_subject_grade_guard() from public, anon, authenticated;

drop trigger if exists trg_class_subject_grade_guard on class_subjects;
create trigger trg_class_subject_grade_guard
  before insert or update of subject_id, class_id on class_subjects
  for each row execute function class_subject_grade_guard();


-- ── (2) Gieo bộ môn cho lớp thì gieo ĐÚNG KHỐI ──────────────────────────────
-- Chỉ thêm một vế subject_fits_grade so với bản ở 0069. Phần kiểm quyền giữ nguyên.
--
-- Trả về SỐ MÔN ĐÃ THÊM như cũ, nhưng giờ con số đó có nghĩa hơn: gieo cho lớp 6 ra 8 môn chứ
-- không phải 14, và 6 môn cấp ba không lọt vào ô chọn của lớp đó nữa.
create or replace function seed_class_subjects(p_class uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare v_n int; v_campus uuid;
begin
  select c.campus_id into v_campus from classes c where c.id = p_class;
  if v_campus is null then raise exception 'Không thấy lớp'; end if;

  if not (staff_can_manage_class(p_class)
          or (auth_role() = 'principal'::user_role and v_campus = auth_campus())) then
    raise exception 'Chỉ giáo viên chủ nhiệm lớp, ban giám hiệu cơ sở này hoặc quản trị viên được sửa chương trình của lớp';
  end if;

  insert into class_subjects (class_id, subject_id, created_by)
  select p_class, s.id, auth.uid()
  from subjects s
  where s.is_active
    and (s.campus_id is null or s.campus_id = v_campus)
    -- MỚI: bỏ qua môn không dạy khối này. Môn chưa khai lớp vẫn vào (hàm coi là không hạn chế).
    and subject_fits_grade(s.id, p_class)
  on conflict (class_id, subject_id) do nothing;   -- gọi lại bao nhiêu lần cũng an toàn

  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function seed_class_subjects(uuid) from public, anon;
grant execute on function seed_class_subjects(uuid) to authenticated;


-- ── (3) Trigger từ thời khoá biểu cũng phải theo luật ───────────────────────
-- 0069 có trigger: xếp một tiết vào TKB thì tự thêm cặp (lớp, môn) vào class_subjects. Trigger đó
-- chạy SECURITY DEFINER nên KHÔNG vướng trigger mới ở trên khi người xếp là admin — nhưng với
-- giáo viên thì sẽ vướng, và đó là điều ĐÚNG: xếp Vật lí vào lưới lớp 6 lẽ ra phải bị chặn ngay
-- lúc xếp lịch, chứ không phải để lọt rồi mới lộ ra ở bảng điểm.
--
-- Không sửa gì thêm ở đây; ghi lại để người sau đọc trigger kia không tưởng là bỏ sót.
