-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0137 — MỖI LÚC CHỈ THEO HAI VIỆC DẪN DẮT
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 16/08/2026, nói hai lần cho hai phía:
--   · màn của em : "leadmeasure 1 lần chỉ 2 cái cùng lúc thôi mà"
--   · màn của cô : "bên giáo viên cũng thế, chỉ được theo 2 leadmeasure cùng lúc thôi"
--
-- Đây đúng là luật của 4DX, và là luật khó giữ nhất: cái gì cũng đáng theo dõi, nên danh sách cứ
-- dài ra cho tới lúc không ai nhìn nữa. Trần cũ ở đây là MƯỜI việc mỗi tuần (chan_qua_muoi_viec,
-- 0121) — con số ấy chưa bao giờ là một quyết định, nó chỉ là một cái chặn cho khỏi chạy loạn.
--
-- ── ĐẾM THEO NGƯỜI THEO DÕI, KHÔNG THEO CAM KẾT ──────────────────────────────────────────────
--
-- "Hai việc cùng lúc" là hai việc mà MỘT NGƯỜI phải theo, không phải hai việc mỗi cam kết. Lớp có
-- hai cam kết, mỗi cam kết hai việc, là bốn việc trên màn của mọi em — đúng cái mà chủ dự án vừa
-- nhìn thấy và gọi là "nhiều như thế này".
--
-- Nên trần đếm theo (chủ sở hữu, tuần):
--   · việc của LỚP  → mọi việc treo dưới mọi cam kết CỦA LỚP trong tuần ấy, tối đa 2.
--   · việc của EM   → mọi việc treo dưới cam kết CỦA CHÍNH EM trong tuần ấy, tối đa 2.
--
-- Hai bộ đếm tách nhau: em vẫn thấy tối đa 2 việc chung + 2 việc riêng. Gộp làm một là bắt em bỏ
-- việc riêng của mình chỉ vì lớp đã dùng hết chỗ.
create or replace function private.chan_qua_hai_viec()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lop   uuid;
  v_em    uuid;
  v_tuan  date;
  v_dang  int;
begin
  select c.class_id, c.student_id, c.week_start into v_lop, v_em, v_tuan
  from commitments c where c.id = new.commitment_id;

  select count(*) into v_dang
  from lead_measures lm
  join commitments c on c.id = lm.commitment_id
  where c.class_id = v_lop
    and c.week_start = v_tuan
    and c.student_id is not distinct from v_em
    and lm.id is distinct from new.id;

  if v_dang >= 2 then
    raise exception 'Mỗi lúc chỉ theo 2 việc dẫn dắt thôi — ít thì mới nhìn nổi. Bỏ bớt một việc rồi thêm.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- Trần cũ (mười việc) thôi không cần nữa: hai thì đã chặt hơn mười.
drop trigger if exists trg_chan_qua_muoi_viec on lead_measures;
drop trigger if exists trg_chan_qua_hai_viec on lead_measures;
create trigger trg_chan_qua_hai_viec
  before insert or update of commitment_id on lead_measures
  for each row execute function private.chan_qua_hai_viec();

-- ── DỌN CHO DỮ LIỆU HIỆN TẠI KHỚP LUẬT ───────────────────────────────────────────────────────
--
-- Lớp Test đang có BA việc chung trong tuần này, cả ba do script gieo của tôi viết ra. Việc thứ ba
-- ("Làm bài thứ Sáu") sau khi 0136 dọn mấy lượt tick sai thứ thì không còn lượt nào — nên xoá nó
-- không mất công của em nào. Xoá luôn cam kết rỗng còn lại, để trên màn không có một dòng cam kết
-- treo lơ lửng chẳng có việc gì dưới.
--
-- CÓ ĐIỀU KIỆN, KHÔNG XOÁ THEO TÊN: chỉ đụng vào việc KHÔNG CÒN LƯỢT TICK NÀO, và chỉ ở phần vượt
-- quá hai. Còn một lượt tick là còn công của một đứa trẻ — thà để dữ liệu lệch luật một tuần rồi
-- cô tự bỏ, còn hơn máy tự xoá.
with xep as (
  select lm.id,
         row_number() over (
           partition by c.class_id, c.week_start, c.student_id
           order by (select count(*) from lead_progress lp where lp.lead_measure_id = lm.id) desc,
                    lm.created_at
         ) as thu_tu,
         (select count(*) from lead_progress lp where lp.lead_measure_id = lm.id) as so_luot
  from lead_measures lm
  join commitments c on c.id = lm.commitment_id
)
delete from lead_measures lm
using xep
where xep.id = lm.id and xep.thu_tu > 2 and xep.so_luot = 0;

delete from commitments c
where not exists (select 1 from lead_measures lm where lm.commitment_id = c.id)
  and c.verdict is null
  and not exists (
    select 1 from lead_progress lp
    join lead_measures lm2 on lm2.id = lp.lead_measure_id
    where lm2.commitment_id = c.id
  )
  and c.title in ('Không ai để trống thứ Sáu');
