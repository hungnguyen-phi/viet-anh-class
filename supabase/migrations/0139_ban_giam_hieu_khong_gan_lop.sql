-- BAN GIÁM HIỆU / QUẢN TRỊ VIÊN KHÔNG GẮN VỚI MỘT LỚP.
--
-- Chủ dự án 16/08/2026: "chỗ admin, tôi cho 1 gvcn làm bgh, thì sao họ vẫn còn gắn với lớp cũ?"
-- Bảng khai sẵn hiện duong@… · Ban giám hiệu · 11A1. Cột lớp của một khai báo chỉ có nghĩa với
-- hai vai: giáo viên (nhận chủ nhiệm lúc đăng nhập lần đầu) và học sinh (vào lớp). Với BGH/admin
-- handle_new_user không dùng tới nó — nên giữ lại chỉ để bày ra một điều sai: người này "thuộc"
-- một lớp mà thực ra không.
--
-- Chuẩn hoá ở CSDL chứ không chỉ ở giao diện: giao diện có thể quên (đúng như đã quên), còn
-- trigger thì gặp dòng nào cũng sửa dòng ấy — kể cả dòng đã nằm sẵn.
set search_path = public;

create or replace function private.khai_bao_bgh_khong_lop() returns trigger
  language plpgsql as $$
begin
  if new.role in ('principal', 'admin') then
    new.class_id := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_khai_bao_bgh_khong_lop on pending_user_grants;
create trigger trg_khai_bao_bgh_khong_lop
  before insert or update of role, class_id on pending_user_grants
  for each row execute function private.khai_bao_bgh_khong_lop();

-- Dòng đã lỡ khai trước hôm nay.
update pending_user_grants set class_id = null
where role in ('principal', 'admin') and class_id is not null;

comment on trigger trg_khai_bao_bgh_khong_lop on pending_user_grants is
  'Khai báo vai BGH/admin thì cột lớp về null — vai ấy không thuộc lớp nào (0139).';
