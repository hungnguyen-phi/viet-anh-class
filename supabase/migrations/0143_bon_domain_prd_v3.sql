-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0143 — PRD v3 ĐỢT A: BỐN DOMAIN MỚI (Knowledge · Leadership skills · Character · Physical Well-being)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- PRD v3 (anh Nguyễn Mạnh Dương duyệt 17/08/2026), changelog #3–#7: nhóm lĩnh vực gọi là
-- Domain, và bốn domain đổi thành Knowledge / Leadership skills / Character / Physical
-- Well-being. Slot "Tiếng Anh" của v2 trở thành "Character" — map english→character để giữ
-- nguyên mọi dòng dữ liệu cũ (WIG, điểm thi đua) thay vì xoá đi làm lại.
--
-- RENAME VALUE chứ không tạo enum mới + cast: đổi tên giá trị enum là thao tác metadata,
-- không rewrite bảng, không đụng index/policy. Đã soi trước pg_proc, pg_views, pg_policy
-- trên production (18/08/2026): KHÔNG nơi nào hard-code 'skills'/'english'/'physical' —
-- nên đổi tên xong là xong, không có hàm nào âm thầm so sai.
--
-- score_category giữ tên type riêng (không gộp vào wig_domain như DDL mẫu trong PRD):
-- gộp type là ALTER COLUMN ... USING trên scoreboard_entries — rewrite cả bảng điểm thật
-- để đổi một cái tên không ai nhìn thấy. Giá trị hai enum vẫn trùng nhau từng chữ.

alter type wig_area rename to wig_domain;
alter type wig_domain rename value 'skills' to 'leadership_skills';
alter type wig_domain rename value 'english' to 'character';
alter type wig_domain rename value 'physical' to 'physical_wellbeing';

alter type score_category rename value 'skills' to 'leadership_skills';
alter type score_category rename value 'english' to 'character';
alter type score_category rename value 'physical' to 'physical_wellbeing';

-- Nhãn hiển thị theo bảng 4.1 của PRD v3. Màu do trường tự cấu hình — không đụng.
-- Character = 5 Giá trị (quyết định 18/08/2026), icon Heart thay Languages.
update area_config set label_vi = 'Kỹ năng lãnh đạo', label_en = 'Leadership skills'
  where area = 'leadership_skills';
update area_config set label_vi = 'Phẩm chất', label_en = 'Character', icon_name = 'Heart'
  where area = 'character';
update area_config set label_vi = 'Sức khoẻ thể chất', label_en = 'Physical Well-being'
  where area = 'physical_wellbeing';
