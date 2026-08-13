-- CHỐT HỌP LÀ MỘT ĐỘNG TÁC RIÊNG, VÀ SỐ ĐO NGOÀI APP CÓ CHỖ ĐỂ GHI.
--
-- Hai việc, cùng một lý do: buổi họp WIG là mốc thời gian chốt mọi con số của tuần, mà app đang
-- đặt cái mốc ấy sai chỗ và thiếu mất một nửa dữ liệu cần chốt.
--
-- ── 1. "LƯU" KHÔNG CÒN LÀ "CHỐT" ────────────────────────────────────────────────────────────
--
-- `tuan_da_hop()` đang trả true ngay khi CÓ MỘT DÒNG biên bản hoặc một dòng ghi nhận việc. Phòng
-- họp chỉ có một nút Lưu nên phần lớn thời gian điều đó trùng với lúc họp xong — nhưng cô lưu
-- giữa chừng (chấm được ba việc, lưu, họp tiếp) là cả tuần đóng sập trong khi buổi họp còn đang
-- chạy: các em hết tick được, và ô số đo dựng ở phần 2 dưới đây cũng hết ghi được, đúng vào lúc
-- buổi họp cần chúng nhất.
--
-- Nay có `chot_at`. Lưu bao nhiêu lần cũng được; tuần chỉ khoá khi có người bấm chốt.
--
-- VÁ DỮ LIỆU CŨ LÀ BẮT BUỘC. Luật cũ là "có biên bản = đã khoá", nên nếu chỉ đổi hàm mà không vá,
-- MỌI tuần đang khoá sẽ bật mở trở lại và tick của các tuần đã tổng kết lại sửa được. Trên
-- production hiện chưa có biên bản nào (0 dòng cả hai bảng, đã kiểm 13/08/2026) nên hai câu vá
-- dưới không đụng gì — chúng ở đây cho môi trường khác và cho lần khôi phục sau này.
--
-- ── 2. SỐ ĐO Ở NGOÀI APP CÓ CHỖ ĐỂ GHI (bảng wig_so_do) ─────────────────────────────────────
--
-- Mục tiêu `measure_by='manual'` — cân nặng, chiều cao, điểm trung bình môn — app không đếm được,
-- nên tới nay nó chỉ có đúng một bit: `achieved_at`, đạt hay chưa. Không có chỗ nào ghi "tháng 9
-- 32kg, tháng 12 34kg", nên không ai đọc ra em đang đi nhanh hay chậm, và buổi họp không có gì
-- để cầm.
--
-- Chủ dự án chốt ba điều, ghi ra đây vì chúng là lý do của từng ràng buộc bên dưới:
--   · em nhập được, cô nhập được, KHÔNG có bước duyệt;
--   · mỗi kỳ một dòng, giữ lịch sử (không phải một ô ghi đè);
--   · đến khi CHỐT HỌP thì khoá.
--
-- Cột `vai_tro` không phải để phân quyền — quyền nằm ở RLS. Nó để MÀN HÌNH NÓI ĐƯỢC AI GHI con số
-- này. Đây là số tự khai, không phải phép đo của máy; app hiển thị nó thì phải hiển thị luôn nguồn,
-- nếu không thì lại rơi vào đúng cái tội §5.0: bày một con số như thể đã được kiểm chứng.

-- ── 1. CHỐT HỌP ─────────────────────────────────────────────────────────────────────────────
alter table wig_meetings
  add column if not exists chot_at timestamptz,
  add column if not exists chot_by uuid references profiles(id) on delete set null;

comment on column wig_meetings.chot_at is
  'Lúc buổi họp được bấm CHỐT. Null = đang họp, còn sửa được. Đây là thứ khoá tick và khoá số đo '
  'của tuần — xem tuan_da_hop().';

-- Vá 1: biên bản lớp đã tồn tại trước bản này đều coi như đã chốt (luật cũ: có biên bản = khoá).
update wig_meetings
set chot_at = created_at
where student_id is null and chot_at is null;

-- Vá 2: tuần nào có ghi nhận việc mà chưa có dòng biên bản lớp thì dựng một dòng đã chốt — luật cũ
-- khoá cả những tuần ấy, và bản này bỏ nhánh đọc wig_meeting_notes trong tuan_da_hop().
insert into wig_meetings (class_id, week_label, week_start, chot_at)
select n.class_id,
       'W' || to_char(n.week_start, 'IW') || '-' || to_char(n.week_start, 'IYYY'),
       n.week_start,
       max(n.updated_at)
from wig_meeting_notes n
where not exists (
  select 1 from wig_meetings m
  where m.class_id = n.class_id and m.student_id is null and m.week_start = n.week_start
)
group by n.class_id, n.week_start;

-- Chữ ký giữ nguyên: hàm này nằm trong RLS của lead_progress (insert/update/delete) và trong
-- StudentScoreboard. Chỉ đổi ĐỊNH NGHĨA "đã họp" — từ "có dòng nào đó" thành "đã bấm chốt".
create or replace function public.tuan_da_hop(p_class uuid, d date)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wig_meetings m
    where m.class_id = p_class
      and m.student_id is null
      and m.week_start = vn_week_start(d)
      and m.chot_at is not null
  );
$$;

-- ── 2. SỐ ĐO TỰ NHẬP ────────────────────────────────────────────────────────────────────────

-- Mục tiêu này của em nào. `wig_class` đã có sẵn; thiếu vế còn lại nên thêm, để RLS bên dưới không
-- phải viết truy vấn con lặp lại ở năm chỗ.
create or replace function public.wig_student(w uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from wigs where id = w;
$$;

create table if not exists wig_so_do (
  id uuid primary key default gen_random_uuid(),
  wig_id uuid not null references wigs(id) on delete cascade,
  -- KỲ = tuần chứa buổi họp sẽ chốt con số này. Dùng ngày thứ Hai chứ không dùng nhãn chữ: nhãn
  -- là ô chữ tự do ở panel sửa WIG, sửa ngày mà quên nhãn là cả cây tổng hợp mù (sự cố 7B1).
  week_start date not null,
  gia_tri numeric not null,
  ghi_chu text,
  nguoi_nhap uuid references profiles(id) on delete set null,
  -- Ai ghi: để màn hình nói ra nguồn của con số, không phải để phân quyền.
  vai_tro text not null check (vai_tro in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mỗi kỳ đúng một dòng. Nhập lại trong cùng tuần là SỬA dòng ấy, không phải đẻ dòng thứ hai —
  -- hai con số cho cùng một tuần thì buổi họp không biết đọc cái nào.
  unique (wig_id, week_start)
);

comment on table wig_so_do is
  'Số đo tự khai cho mục tiêu measure_by=manual (cân nặng, chiều cao, điểm TB môn). Em hoặc cô ghi, '
  'mỗi tuần một dòng, khoá khi buổi họp WIG của lớp được chốt. KHÔNG phải phép đo của máy — mọi chỗ '
  'hiển thị phải nói rõ ai ghi.';

create index if not exists wig_so_do_wig_idx on wig_so_do (wig_id, week_start desc);

alter table wig_so_do enable row level security;

-- ĐỌC: đúng những người vốn đã được đọc mục tiêu ấy. Chính em; phụ huynh/GVCN/BGH qua
-- can_view_student; và nhân sự của lớp (mục tiêu lớp không có student_id).
create policy rls_select_wig_so_do on wig_so_do
for select using (
  wig_student(wig_id) = (select auth.uid())
  or can_view_student(wig_student(wig_id))
  or staff_can_read_class(wig_class(wig_id))
);

-- GHI: chính em, hoặc nhân sự quản lý lớp. VÀ tuần chưa chốt — chặn ở CSDL chứ không chỉ ở màn
-- hình, vì "khoá khi họp xong" là một lời hứa với buổi họp, không phải một gợi ý giao diện.
create policy rls_insert_wig_so_do on wig_so_do
for insert with check (
  (wig_student(wig_id) = (select auth.uid()) or staff_can_manage_class(wig_class(wig_id)))
  and not tuan_da_hop(wig_class(wig_id), week_start)
);

create policy rls_update_wig_so_do on wig_so_do
for update using (
  (wig_student(wig_id) = (select auth.uid()) or staff_can_manage_class(wig_class(wig_id)))
  and not tuan_da_hop(wig_class(wig_id), week_start)
) with check (
  (wig_student(wig_id) = (select auth.uid()) or staff_can_manage_class(wig_class(wig_id)))
  and not tuan_da_hop(wig_class(wig_id), week_start)
);

create policy rls_delete_wig_so_do on wig_so_do
for delete using (
  (wig_student(wig_id) = (select auth.uid()) or staff_can_manage_class(wig_class(wig_id)))
  and not tuan_da_hop(wig_class(wig_id), week_start)
);

-- `updated_at` phải do CSDL giữ: nó là bằng chứng "ghi lúc nào so với lúc chốt họp", mà bằng chứng
-- thì không để phía gọi tự khai.
create or replace function private.wig_so_do_cham_gio()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wig_so_do_cham_gio on wig_so_do;
create trigger wig_so_do_cham_gio before update on wig_so_do
for each row execute function private.wig_so_do_cham_gio();

-- Số đo chỉ có nghĩa với đích ghi-nhận-ngoài. Mục tiêu đếm bằng tick đã có lượt tick làm nguồn;
-- cho ghi tay vào đó là mở đúng cái cửa hậu mà cả 0101 lẫn 0107 đi bịt.
create or replace function private.so_do_chi_cho_dich_ngoai()
returns trigger language plpgsql as $$
declare k text;
begin
  select measure_by into k from wigs where id = new.wig_id;
  if k is distinct from 'manual' then
    raise exception 'Mục tiêu này đo bằng lượt tick, không nhập số tay được.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists so_do_chi_cho_dich_ngoai on wig_so_do;
create trigger so_do_chi_cho_dich_ngoai before insert or update on wig_so_do
for each row execute function private.so_do_chi_cho_dich_ngoai();
