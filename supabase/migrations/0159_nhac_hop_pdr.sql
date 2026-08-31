-- ════════════════════════════════════════════════════════════════════════════════════════════
-- NHẮC TRƯỚC BUỔI HỌP PDR — chủ dự án đặt 31/08/2026
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Lịch PDR đã có từ 0146 (buddy: thứ + giờ hằng tuần; coach: ngày trong tháng), nhưng nó chỉ
-- NẰM IM trên màn của em. Không ai được báo, nên tới ngày thì không ai nhớ — đúng chỗ chủ dự án
-- hỏi "lên lịch để thông báo mọi người".
--
-- BA QUYẾT ĐỊNH ĐÃ CHỐT:
--
-- ① NHẮC ĐÚNG NGƯỜI DỰ BUỔI ẤY, không nhắc cả lớp. Buddy → các em trong nhóm. Coach → em và
--    thầy cô chủ nhiệm. Nhắc cả lớp thì cái chuông thành tiếng ồn, và cái chuông đã ồn thì
--    không ai đọc nữa — kể cả tin thật sự cần đọc.
--
-- ② KHÔNG CẮM CỨNG "nhắc trước bao lâu". Người cài lịch tự chọn ngay trên form: lớp họp giờ ra
--    chơi cần nhắc sáng hôm đó, lớp họp buổi tối cần nhắc từ tối hôm trước. Đoán hộ họ là sai
--    cho một nửa số lớp.
--
-- ③ NHẮC MỘT NGƯỜI MỘT NGÀY MỘT LOẠI. Nhóm buddy 3 em treo lịch lên CẢ BA CẶP (xem 0146), nên
--    một buổi họp sinh ra ba dòng lịch giống hệt. Không chặn thì em nào cũng nhận hai ba lần
--    cùng một câu. Chặn bằng khoá chính của bảng pdr_nhac_da_gui, không bằng code.
--
-- KHÔNG khoá form biên bản theo ngày: em họp sớm hay muộn một hôm là chuyện thường, khoá cứng
-- chỉ đẻ thêm một luồng "xin mở khoá" cho thầy cô. Nhắc là đủ.

-- ── 1. Người cài lịch chọn nhắc khi nào ────────────────────────────────────────────────────
-- Mặc định 'sang_hom_do' cho lịch đã có sẵn: nhắc sáng hôm họp là lựa chọn không bao giờ sai
-- quá xa, còn 'khong' thì lịch cũ lặng lẽ không bao giờ nhắc mà không ai biết vì sao.
alter table pdr_schedules
  add column if not exists nhac_khi text not null default 'sang_hom_do'
  check (nhac_khi in ('khong', 'toi_hom_truoc', 'sang_hom_do', 'mot_gio_truoc'));

-- ── 2. Sổ đã nhắc — chống nhắc trùng (quyết định ③) ────────────────────────────────────────
create table if not exists pdr_nhac_da_gui (
  user_id uuid not null references profiles(id) on delete cascade,
  ngay date not null,
  loai text not null check (loai in ('coach', 'buddy')),
  gui_luc timestamptz not null default now(),
  primary key (user_id, ngay, loai)
);
alter table pdr_nhac_da_gui enable row level security;

-- ── 3. Nhịp chạy ───────────────────────────────────────────────────────────────────────────
-- Bảng một dòng, giữ lần chạy gần nhất. Có nó thì hàm gọi bao nhiêu lần cũng chỉ làm việc thật
-- 10 phút một lần — cần, vì app gọi hàm này mỗi khi ai đó mở trang thông báo.
create table if not exists pdr_nhac_lan_chay (
  mot_dong boolean primary key default true check (mot_dong),
  chay_luc timestamptz not null default now()
);
alter table pdr_nhac_lan_chay enable row level security;
insert into pdr_nhac_lan_chay (mot_dong, chay_luc)
values (true, now() - interval '1 day')
on conflict (mot_dong) do nothing;

-- ── 4. Sinh thông báo ──────────────────────────────────────────────────────────────────────
-- GIỜ VIỆT NAM, không phải giờ máy chủ: "sáng hôm đó" mà tính theo UTC thì nhắc lúc 2 giờ chiều
-- hôm trước. Máy chủ chạy ở đâu cũng không được đổi nghĩa của chữ "sáng".
-- HAI HÀM, không phải một. Bản có tham số cho phép ghim một mốc thời gian để phép kiểm chạy
-- giờ nào, ngày nào cũng ra cùng kết quả (test-nhac-pdr.sql) — nhưng nó KHÔNG mở cho người dùng
-- thường: đưa tham số thời gian vào tay ai cũng gọi được thì một em học sinh gọi với mốc tương
-- lai là bơm được thông báo sớm cho cả lớp. Bản không tham số mới là bản app gọi.
create or replace function sinh_nhac_pdr_luc(p_luc timestamptz) returns int
  language plpgsql security definer set search_path = public as $$
declare
  gio_vn timestamp := (p_luc at time zone 'Asia/Ho_Chi_Minh');
  hom_nay date := gio_vn::date;
  dem int;
begin
  update pdr_nhac_lan_chay set chay_luc = p_luc where chay_luc < p_luc - interval '10 minutes';
  if not found then
    return 0;
  end if;

  -- HAI MỐC CHO MỖI LỊCH, không phải một: buổi của kỳ NÀY và buổi của kỳ SAU.
  --
  -- Chỉ lấy kỳ này thì "nhắc tối hôm trước" chết ở mọi ranh giới kỳ: lịch coach ngày 1 phải nhắc
  -- vào tối ngày cuối THÁNG TRƯỚC, lịch buddy thứ Hai phải nhắc vào tối Chủ Nhật — mà cả hai mốc
  -- ấy đều nằm ở kỳ trước, nên đứng ở kỳ này nhìn thì không bao giờ thấy. Sổ đã nhắc lo phần
  -- trùng lặp, nên sinh dư một mốc không hại gì.
  with lich as (
    select s.id, s.type, s.class_id, s.student_id, s.buddy_pair_id, s.time_slot, s.nhac_khi,
           d.ngay_hop
      from pdr_schedules s
      cross join lateral (
        select case
                 when s.type = 'coach' then date_trunc('month', hom_nay)::date + (s.monthly_day - 1)
                 -- weekday 2..8 kiểu VN (2=T2 … 8=CN) → isodow 1..7; ngày ấy TRONG TUẦN NÀY.
                 else hom_nay + ((s.weekday - 1) - extract(isodow from hom_nay)::int)
               end as ngay_hop
        union all
        select case
                 when s.type = 'coach'
                   then (date_trunc('month', hom_nay) + interval '1 month')::date + (s.monthly_day - 1)
                 else hom_nay + ((s.weekday - 1) - extract(isodow from hom_nay)::int) + 7
               end
      ) d
     where s.is_active and s.nhac_khi <> 'khong'
  ),
  den_gio as (
    select l.*,
           case l.nhac_khi
             when 'toi_hom_truoc' then (l.ngay_hop - 1) + time '19:00'
             -- 'mot_gio_truoc' chỉ có nghĩa khi lịch có giờ (buddy). Lịch coach không có giờ →
             -- rơi về sáng hôm đó, chứ không im lặng nuốt mất cái nhắc người ta đã đặt.
             when 'mot_gio_truoc' then
               case when l.time_slot is null then l.ngay_hop + time '07:00'
                    else (l.ngay_hop + l.time_slot) - interval '1 hour' end
             else l.ngay_hop + time '07:00'
           end as luc_nhac
      from lich l
  ),
  dung_luc as (
    -- Hết ngày họp thì thôi: một cái nhắc đến sau buổi họp không còn là nhắc, nó là rác.
    select * from den_gio where luc_nhac <= gio_vn and gio_vn < ngay_hop + 1
  ),
  nguoi as (
    select d.ngay_hop, d.type, d.time_slot, d.student_id as user_id, 'em' as vai, null::uuid as em
      from dung_luc d where d.type = 'coach' and d.student_id is not null
    union all
    select d.ngay_hop, d.type, d.time_slot, c.homeroom_teacher_id, 'thay_co', d.student_id
      from dung_luc d join classes c on c.id = d.class_id
     where d.type = 'coach' and c.homeroom_teacher_id is not null
    union all
    select d.ngay_hop, d.type, d.time_slot, b.student_id, 'em', null
      from dung_luc d join buddy_pairs b on b.id = d.buddy_pair_id
     where d.type = 'buddy' and b.is_active
    union all
    select d.ngay_hop, d.type, d.time_slot, b.buddy_id, 'em', null
      from dung_luc d join buddy_pairs b on b.id = d.buddy_pair_id
     where d.type = 'buddy' and b.is_active
  ),
  gon as (
    select distinct on (user_id, ngay_hop, type) user_id, ngay_hop, type, time_slot, vai, em
      from nguoi order by user_id, ngay_hop, type, vai
  ),
  ghi_so as (
    insert into pdr_nhac_da_gui (user_id, ngay, loai)
    select user_id, ngay_hop, type from gon
    on conflict (user_id, ngay, loai) do nothing
    returning user_id, ngay, loai
  ),
  da_bao as (
    insert into notifications (user_id, title, body, link)
    select g.user_id,
           case
             when g.vai = 'thay_co' then
               'Nhắc: ' || (case when g.ngay_hop = hom_nay then 'hôm nay' else 'ngày mai' end)
               || ' họp PDR với ' || coalesce(p.full_name, 'học sinh')
             when g.type = 'coach' then
               'Nhắc: ' || (case when g.ngay_hop = hom_nay then 'hôm nay' else 'ngày mai' end)
               || ' em họp PDR với thầy cô'
             else
               'Nhắc: ' || (case when g.ngay_hop = hom_nay then 'hôm nay' else 'ngày mai' end)
               || ' em họp PDR với bạn'
           end,
           case when g.time_slot is null then ''
                else 'Lúc ' || to_char(g.time_slot, 'HH24:MI') end,
           case when g.vai = 'thay_co' then '/roster' else '/student' end
      from ghi_so s
      join gon g on g.user_id = s.user_id and g.ngay_hop = s.ngay and g.type = s.loai
      left join profiles p on p.id = g.em
    returning 1
  )
  select count(*) into dem from da_bao;

  return dem;
end $$;

-- Bản app gọi: không tham số, luôn là "bây giờ".
create or replace function sinh_nhac_pdr() returns int
  language sql security definer set search_path = public as $$
  select sinh_nhac_pdr_luc(now());
$$;

-- REVOKE PHẢI GỌI ĐÍCH DANH authenticated/anon, không chỉ public: Postgres cấp EXECUTE cho
-- PUBLIC theo mặc định, mà trên Supabase hai vai này còn được cấp riêng nữa — nên "revoke from
-- public" một mình KHÔNG gỡ được quyền của họ. Phép kiểm test-nhac-pdr.sql bắt đúng chỗ này:
-- thiếu dòng dưới thì một em học sinh gọi hàm với mốc tương lai là bơm thông báo cho cả lớp.
revoke all on function sinh_nhac_pdr_luc(timestamptz) from public, anon, authenticated;
revoke all on function sinh_nhac_pdr() from public, anon, authenticated;
grant execute on function sinh_nhac_pdr() to authenticated;

-- ── 5. Ai chạy hàm này ─────────────────────────────────────────────────────────────────────
-- Ưu tiên pg_cron 10 phút một lần. Bọc trong DO có bắt lỗi vì extension có thể chưa bật trên
-- project, mà một migration KHÔNG được đổ vì thứ không phải phần cốt lõi của nó.
--
-- Không có pg_cron cũng KHÔNG mất tính năng: đây là chuông TRONG APP, người ta chỉ thấy nó khi
-- mở app — nên app tự gọi sinh_nhac_pdr() lúc mở trang thông báo là đủ, và bảng lần-chạy ở trên
-- giữ cho nó không chạy dày. pg_cron chỉ giúp thông báo có sẵn từ trước khi họ mở.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('nhac-hop-pdr')
    where exists (select 1 from cron.job where jobname = 'nhac-hop-pdr');
  perform cron.schedule('nhac-hop-pdr', '*/10 * * * *', 'select public.sinh_nhac_pdr()');
  raise notice 'pg_cron: da hen nhac-hop-pdr moi 10 phut';
exception when others then
  raise notice 'pg_cron chua bat (%) — app se tu goi sinh_nhac_pdr() o trang thong bao', sqlerrm;
end $$;
