-- ════════════════════════════════════════════════════════════════════════════
-- 0099 — WIG NĂM CỦA EM NỐI VÀO WIG NĂM CỦA LỚP
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án (10/08/2026): "wig năm của em phải liên kết với wig năm của lớp chứ? […] gv đặt wig
-- năm của lớp là điểm trung bình 8.0, thì em cũng đạt điểm tb 8.0; hoặc lớp làm 1000 bài tập về
-- nhà, lớp có 10 em thì mỗi em 100 bài tập về nhà/năm."
--
-- Đúng hình tháp 4DX. Bản cũ để giáo viên gõ tay bốn con số cho mỗi em, `parent_wig_id` bỏ trống,
-- nên hai tầng trôi khỏi nhau ngay từ ngày đầu và không ai đối chiếu được. Từ nay WIG năm cá nhân
-- SINH RA TỪ WIG năm của lớp và mang parent_wig_id trỏ về nó (phần suy ra mục tiêu nằm ở app).
--
-- MIGRATION NÀY CHỈ LÀM MỘT VIỆC, VÀ LÀ VIỆC BẮT BUỘC PHẢI LÀM TRƯỚC:
-- chặn tiến độ của WIG lớp bị thổi lên bởi việc riêng của các em.
--
-- private.wig_actual đi ĐỆ QUY xuống mọi con qua parent_wig_id. Ngày mai WIG năm của lớp có thêm
-- ba mươi đứa con là WIG cá nhân của ba mươi em, thì cứ mỗi lượt tick việc riêng của một em lại
-- cộng thẳng vào tiến độ WIG của lớp — và vào điểm thi đua toàn trường. Lớp nào có nhiều em chăm
-- làm việc riêng sẽ leo hạng mà không cần làm gì cho mục tiêu chung.
--
-- Luật mới: CON PHẢI CÙNG SCOPE VỚI CHA thì mới được cộng vào. Cây của lớp (năm → tháng → tuần)
-- vẫn cộng như cũ; cây cá nhân của em vẫn cộng như cũ; hai cây chạm nhau ở chỗ nối nhưng con số
-- không tràn qua nhau. Muốn biết cả lớp làm được bao nhiêu thì nhìn việc CHUNG — thứ mọi em cùng
-- tick, và từ 0098 mỗi em phải tự đủ phần mình.
create or replace function private.wig_actual(w uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  with recursive descendants as (
    select id, class_id, scope, start_date, end_date from wigs where id = w
    union all
    select c.id, c.class_id, c.scope, c.start_date, c.end_date
    from wigs c
    join descendants d on c.parent_wig_id = d.id
    -- Đây là cả migration này: không bước từ cây lớp sang cây cá nhân, và ngược lại.
    where c.scope = d.scope
  ),
  viec as (
    select d.class_id, d.scope, d.start_date, d.end_date,
           lm.id as lead_id, lm.target_value, lm.unit_per_tick
    from descendants d
    join lead_measures lm on lm.wig_id = d.id
  ),
  theo_em as (
    select v.lead_id, v.class_id, v.scope,
           case
             when v.target_value > 0
               then least(sum(lp.value) * v.unit_per_tick, v.target_value)
             else sum(lp.value) * v.unit_per_tick
           end as gop
    from viec v
    join lead_progress lp
      on lp.lead_measure_id = v.lead_id
     and lp.logged_date between v.start_date and v.end_date
    group by v.lead_id, v.class_id, v.scope, v.target_value, v.unit_per_tick, lp.student_id
  )
  select coalesce(sum(
    case
      when t.scope = 'class' then t.gop / greatest(
        (select count(*) from enrollments e where e.class_id = t.class_id and e.is_active), 1)
      else t.gop
    end
  ), 0)
  from theo_em t;
$function$;
