-- BIÊN BẢN HỌP LUÔN CÓ NGÀY THỨ HAI, VÀ NHÃN TUẦN CHỈ CÓ MỘT DẠNG.
--
-- Hai vết nứt lộ ra 16/08/2026 khi dựng lại phòng họp quanh trục cam kết:
--
--   1. Bốn dòng wig_meetings mang week_label 'W33-2026' nhưng week_start NULL — đường ghi chú
--      Buddy (student/actions.ts) chèn dòng mới chỉ với nhãn. Mọi màn hình nay tra theo NGÀY
--      (0080: nhãn là chữ để đọc, ngày mới là khoá), nên dòng không có ngày là dòng vô hình.
--   2. Kịch bản gieo dữ liệu viết nhãn '32-2026' (thiếu chữ W) trong khi app viết 'W32-2026'.
--      Khoá duy nhất (student_id, week_label) không bắt được, nên cùng một em cùng một tuần có
--      HAI dòng — và dòng em tự gõ (ff1…ff4) bị dòng gieo che mất trên màn của cô.
--
-- Chốt ở CSDL, không chỉ sửa hai chỗ gọi: trigger điền week_start từ nhãn khi thiếu, và ép nhãn
-- về đúng dạng 'Wnn-yyyy' bằng CHECK. Dữ liệu cũ dọn ngay trong migration này.
set search_path = public;

-- ── 1. DỌN: nhãn thiếu W ────────────────────────────────────────────────────────────────────
-- Dòng nào đổi nhãn xong sẽ trùng với một dòng 'W…' đã có (cùng em, cùng tuần) thì XOÁ dòng
-- gieo — dòng của em (có hs_go_luc, hoặc đơn giản là dòng đúng dạng) thắng.
delete from wig_meetings cu
where cu.week_label ~ '^\d{2}-\d{4}$'
  and exists (
    select 1 from wig_meetings moi
    where moi.week_label = 'W' || cu.week_label
      and moi.class_id = cu.class_id
      and moi.student_id is not distinct from cu.student_id
  );
update wig_meetings set week_label = 'W' || week_label where week_label ~ '^\d{2}-\d{4}$';

-- ── 2. DỌN: thiếu ngày thứ Hai ─────────────────────────────────────────────────────────────
update wig_meetings set week_start = thu_hai_tu_nhan(week_label) where week_start is null;

-- ── 3. CHỐT: từ nay ─────────────────────────────────────────────────────────────────────────
create or replace function private.bien_ban_dien_ngay() returns trigger
  language plpgsql as $$
begin
  if new.week_start is null and new.week_label is not null then
    new.week_start := thu_hai_tu_nhan(new.week_label);
  end if;
  return new;
end $$;

drop trigger if exists trg_bien_ban_dien_ngay on wig_meetings;
create trigger trg_bien_ban_dien_ngay
  before insert or update of week_label, week_start on wig_meetings
  for each row execute function private.bien_ban_dien_ngay();

alter table wig_meetings drop constraint if exists wig_meetings_week_label_ck;
alter table wig_meetings add constraint wig_meetings_week_label_ck
  check (week_label ~ '^W\d{2}-\d{4}$');

comment on trigger trg_bien_ban_dien_ngay on wig_meetings is
  'Thiếu week_start thì suy từ week_label — mọi màn hình tra biên bản theo ngày (0080/0140).';
