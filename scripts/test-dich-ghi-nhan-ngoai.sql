-- ĐÍCH GHI NHẬN NGOÀI (0101) — phép kiểm.
--
-- Bốn điều phải đúng cùng lúc:
--   1. Đích 'tick' KHÔNG xê dịch một chữ số nào so với trước — đây là phép kiểm quan trọng nhất,
--      vì view này nuôi mọi màn hình và mọi bảng tổng hợp.
--   2. Đích 'manual' CHƯA đạt → pct = 0, dù bên dưới có bao nhiêu lượt tick đi nữa.
--   3. Đích 'manual' ĐÃ đạt → pct = 1.
--   4. Đích 'manual' không bao giờ bị chấm 'off_track' — không ai đo được nhịp của thứ app không
--      giữ số liệu, gắn nhãn đỏ vì thế là chấm oan.
--
--   npm run sql -- scripts/test-dich-ghi-nhan-ngoai.sql

begin;

create temporary table ket_qua (buoc text, mong_doi text, thuc_te text, dat boolean);

-- Ảnh chụp TRƯỚC (view cũ vẫn đang chạy nếu file này chạy kèm migration).
create temporary table anh_truoc as
select wig_id, pct, status from wig_progress_v;

do $$
declare
  v_wig uuid;
  v_em uuid;
  v_pct numeric;
  v_status text;
begin
  select id into v_wig from wigs where scope = 'class' and period = 'week' limit 1;
  if v_wig is null then
    insert into ket_qua values ('Có WIG để thử', 'có', 'KHÔNG CÓ', false);
    return;
  end if;
  select student_id into v_em from enrollments where is_active limit 1;

  -- ── Đổi sang đích ghi nhận ngoài, CHƯA đạt ──────────────────────────────────────────────
  update wigs set measure_by = 'manual' where id = v_wig;
  select pct, status into v_pct, v_status from wig_progress_v where wig_id = v_wig;
  insert into ket_qua values
    ('Đích manual CHƯA đạt → pct = 0 dù bên dưới vẫn có lượt tick', '0', v_pct::text, v_pct = 0),
    ('Đích manual CHƯA đạt → không bị chấm off_track', 'mid', v_status, v_status = 'mid');

  -- ── Tick "đã đạt" ────────────────────────────────────────────────────────────────────────
  update wigs set achieved_at = now(), achieved_by = v_em where id = v_wig;
  select pct, status into v_pct, v_status from wig_progress_v where wig_id = v_wig;
  insert into ket_qua values
    ('Đích manual ĐÃ đạt → pct = 1', '1', v_pct::text, v_pct = 1),
    ('Đích manual ĐÃ đạt → on_track', 'on_track', v_status, v_status = 'on_track');

  -- Trả về nguyên trạng để phép so bên dưới chỉ đo thay đổi do MIGRATION, không do fixture.
  update wigs set measure_by = 'tick', achieved_at = null, achieved_by = null where id = v_wig;
end $$;

-- ── Đích 'tick': y nguyên từng chữ số ───────────────────────────────────────────────────────
insert into ket_qua
select 'Mọi đích tick KHÔNG xê dịch pct', '0 lệch', count(*)::text || ' lệch', count(*) = 0
from anh_truoc t join wig_progress_v v on v.wig_id = t.wig_id
where v.pct is distinct from t.pct;

insert into ket_qua
select 'Mọi đích tick KHÔNG xê dịch status', '0 lệch', count(*)::text || ' lệch', count(*) = 0
from anh_truoc t join wig_progress_v v on v.wig_id = t.wig_id
where v.status is distinct from t.status;

-- ── View phải mang hai cột mới xuống, nếu không màn hình không biết bày kiểu gì ──────────────
insert into ket_qua
select 'View mang measure_by + achieved_at xuống', '2 cột', count(*)::text || ' cột', count(*) = 2
from information_schema.columns
where table_name = 'wig_progress_v' and column_name in ('measure_by', 'achieved_at');

select
  case when dat then 'OK  ' else 'SAI ' end || ' ' || buoc
    || case when dat then '' else '  → mong ' || mong_doi || ', thực tế ' || thuc_te end as ket_qua
from ket_qua;

select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket from ket_qua;

rollback;
