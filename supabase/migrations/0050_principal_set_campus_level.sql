-- 0050 — Hiệu trưởng tự khai cấp học cho CƠ SỞ MÌNH
--
-- Vì sao cần: khối được sinh từ campuses.level, nhưng bảng campuses chỉ admin sửa được
-- (rls_all_campuses). Hệ quả là màn "Quản lý Khối" của HT rơi vào ngõ cụt: nó bảo "hãy chọn cấp
-- học" trong khi HT không có nút nào để chọn.
--
-- Cố ý dùng RPC SECURITY DEFINER thay vì nới policy UPDATE trên campuses: HT chỉ được đổi ĐÚNG
-- MỘT cột (level) của ĐÚNG cơ sở mình. Mở policy UPDATE sẽ cho họ đổi cả tên/mã/trạng thái
-- lưu-trữ của cơ sở — rộng hơn nhiều so với việc cần làm.
create or replace function set_my_campus_level(p_level school_level)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_campus uuid;
begin
  if auth_role() <> 'principal' then
    raise exception 'Chỉ hiệu trưởng được khai cấp học cho cơ sở của mình';
  end if;

  v_campus := auth_campus();
  if v_campus is null then
    raise exception 'Tài khoản chưa được gán cơ sở';
  end if;

  -- Trigger campus_seed_grades chạy ngay sau UPDATE này và sinh khối chuẩn của cấp.
  update campuses set level = p_level where id = v_campus;

  return seed_grades_for_campus(v_campus);
end;
$$;

revoke all on function set_my_campus_level(school_level) from public, anon;
grant execute on function set_my_campus_level(school_level) to authenticated;
