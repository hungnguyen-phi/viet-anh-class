-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0157 — HUB: HÀNG ĐỢI SỰ KIỆN cho tick lead measure (viec_dan_dat.tick)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- VÌ SAO CẦN HÀNG ĐỢI (chứ không gọi thẳng như điểm danh):
-- Điểm danh có MỘT cửa server duy nhất (checkinMood() → RPC service_role), nên webhook gắn thẳng
-- vào đó là xong. Tick lead measure thì KHÔNG: cả LeadTicker.tsx (em tự tick) lẫn TickCuaLop.tsx
-- (cô tick việc chung của lớp) ghi THẲNG vào `lead_progress` bằng supabase-js phía TRÌNH DUYỆT,
-- dưới quyền RLS — không có một dòng server nào đứng giữa để gọi hộ webhook. Muốn không phải viết
-- lại hai UI đã rất tinh (useOptimistic, khoá từng ô — xem comment trong LeadTicker.tsx) thành
-- server action chỉ để có chỗ gắn một lời gọi HTTP, thì để DATABASE tự ghi nhận sự kiện bằng
-- trigger, rồi một tiến trình Node NGOÀI đường tick của em đọc hàng đợi này và gửi đi.
--
-- CHỈ TICK CỦA MỘT EM (student_id IS NOT NULL). Lượt tick "của lớp" (TickCuaLop.tsx ghi
-- student_id = null, xem comment ở đó) không gắn được với ai — đúng rổ Xanh, nhưng app đã khai
-- roDuLieu='vang' cho toàn bộ đăng ký, và Hub chưa cần loại sự kiện lớp-không-gắn-em ở đợt này nên
-- trigger bỏ qua thẳng, đỡ phải định nghĩa thêm một event_type chưa ai dùng.
--
-- external_id KHÔNG tính ở đây (xem lib/hub/webhook.ts): HMAC cần một khoá bí mật, và khoá đó chỉ
-- nằm ở biến môi trường phía Node — nhét nó vào một GUC của Postgres là thêm một chỗ nữa phải nhớ
-- xoay khi trường đổi khoá (xem mục 4.6 của bản đấu nối: "Nhà trường đổi chuỗi lúc nào cũng được").
-- Trigger chỉ ghi NGUYÊN LIỆU đã lọc rổ Vàng; dispatcher tính external_id lúc gửi.
create table if not exists hub_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_table text not null,
  source_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- Một dòng lead_progress chỉ sinh MỘT lượt hàng đợi — tick rồi bỏ tick rồi tick lại trong lúc
  -- dispatcher chưa kịp chạy không đẻ ra ba bản ghi trùng nội dung cho cùng một dòng nguồn.
  unique (source_table, source_id)
);

create index if not exists hub_event_outbox_pending_idx
  on hub_event_outbox(created_at) where status = 'pending';

alter table hub_event_outbox enable row level security;
revoke all on hub_event_outbox from authenticated, anon;

-- Payload đã BÓC RỔ ĐỎ NGAY TRONG SQL: chỉ tên việc (do GVCN đặt, không phải chữ học sinh gõ),
-- lĩnh vực, ngày, số lượng. Không tên/email học sinh (Hub nhận diện em qua user_id = auth.uid()
-- lấy từ chính token đăng nhập của em ở app này — xem mục 4.2 của bản đấu nối), không nội dung tự
-- do nào. Cùng kỷ luật với BuddyFact ở lib/buddy.ts (docs/DATA_GOVERNANCE.md §7).
create or replace function private.hub_hang_doi_tick_dan_dat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_area text;
  v_title text;
begin
  if new.student_id is null then
    return new; -- lượt của lớp, không gắn em — xem ghi chú đầu file.
  end if;

  select c.class_id, c.area::text, lm.title
    into v_class_id, v_area, v_title
  from lead_measures lm
  join commitments c on c.id = lm.commitment_id
  where lm.id = new.lead_measure_id;

  if v_class_id is null then
    return new; -- dữ liệu không đủ để dựng sự kiện (không nên xảy ra, nhưng đừng chặn lượt tick).
  end if;

  insert into hub_event_outbox (event_type, source_table, source_id, payload)
  values (
    'viec_dan_dat.tick',
    'lead_progress',
    new.id,
    jsonb_build_object(
      'student_id', new.student_id,
      'class_id', v_class_id,
      'area', v_area,
      'lead_title', v_title,
      'logged_date', new.logged_date,
      'value', new.value
    )
  )
  on conflict (source_table, source_id) do nothing;

  return new;
exception
  -- Một trigger lỗi không được phép làm rớt cú tick của em — đây là phần PHỤ (báo về Hub), phần
  -- CHÍNH (ghi tick) đã xảy ra rồi lúc trigger này chạy (AFTER INSERT). Ghi log rồi cho qua.
  when others then
    raise warning 'hub_hang_doi_tick_dan_dat: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_hub_hang_doi_tick on lead_progress;
create trigger trg_hub_hang_doi_tick
  after insert on lead_progress
  for each row execute function private.hub_hang_doi_tick_dan_dat();
