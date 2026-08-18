-- TRẦN 4 MỤC TIÊU NĂM CỦA LỚP (0106) — phép kiểm.
--
-- Luật đang kiểm (§3 docs/MO_HINH_WIG.md): mỗi lớp có ĐÚNG bốn mục tiêu năm, một cho mỗi lĩnh vực.
-- Trần này trước đây chỉ do `wigs_lop_ky_uidx` chặn gián tiếp — nó chặn TRÙNG
-- (class_id, area, period, period_label), nên đổi nhãn kỳ đúng một dấu gạch ("2026–2027" vs
-- "2026-2027") là đẻ được cái thứ năm. Nay trigger private.chan_wig_lop_thu_nam đếm theo NGÀY
-- GIAO NHAU, không theo nhãn — và đây là bài kiểm cho đúng cái lỗ ấy.
--
-- Bốn điều phải đúng cùng lúc:
--   1. Bốn mục tiêu năm (bốn lĩnh vực) · chèn được hết
--   2. Cái thứ NĂM cùng nhãn kỳ · bị từ chối
--   3. Cái thứ NĂM ĐỔI NHÃN KỲ · VẪN bị từ chối  ← chỗ hở cũ
--   4. Mục tiêu năm của một lớp KHÁC · không bị vạ lây
--
--   npm run sql -- scripts/test-tran-wig-lop.sql

begin;

create temp table kq (buoc text, ky_vong text, thuc_te text, dat boolean) on commit drop;

do $$
declare
  v_lop uuid; v_lop2 uuid; areas text[]; a text; i int := 0; loi text;
begin
  select id into v_lop from classes where is_active order by created_at limit 1;
  select id into v_lop2 from classes where is_active and id <> v_lop order by created_at limit 1;
  if v_lop is null then
    insert into kq values ('Có lớp để thử', 'có', 'KHÔNG CÓ lớp nào', false);
    return;
  end if;

  -- Dọn chỗ: lớp thật có thể đã có mục tiêu năm rồi, mà bài kiểm này đếm số. Xoá trong
  -- transaction sẽ rollback nên dữ liệu thật không suy suyển.
  delete from wigs where class_id = v_lop and scope = 'class' and period = 'year';

  select enum_range(null::wig_domain)::text[] into areas;

  -- ① Bốn lĩnh vực, bốn mục tiêu — phải lọt hết.
  foreach a in array areas loop
    i := i + 1;
    insert into wigs (class_id, scope, kind, status, set_by, measure_by, area,
                      period, period_label, title, baseline, target_value, unit,
                      start_date, end_date)
    values (v_lop, 'class', null, 'approved', null, 'tick', a::wig_domain,
            'year', 'TEST-TRAN', 'thử trần ' || a, 0, 100, 'lần',
            current_date, current_date + 300);
  end loop;
  insert into kq values ('Bốn mục tiêu năm · chèn được', '4 cái', i || ' cái', i = 4);

  -- ② Cái thứ năm, CÙNG nhãn kỳ.
  begin
    insert into wigs (class_id, scope, kind, status, set_by, measure_by, area,
                      period, period_label, title, baseline, target_value, unit,
                      start_date, end_date)
    values (v_lop, 'class', null, 'approved', null, 'tick', areas[1]::wig_domain,
            'year', 'TEST-TRAN', 'cái thứ năm', 0, 100, 'lần',
            current_date, current_date + 300);
    insert into kq values ('Cái thứ 5 cùng nhãn kỳ · bị chặn', 'bị từ chối', 'CHÈN ĐƯỢC', false);
  exception when others then
    loi := sqlerrm;
    insert into kq values ('Cái thứ 5 cùng nhãn kỳ · bị chặn', 'bị từ chối', 'từ chối: ' || left(loi, 60), true);
  end;

  -- ③ Cái thứ năm ĐỔI NHÃN KỲ — đúng chỗ hở cũ. Nhãn khác, lĩnh vực khác nhau nốt, nên
  -- wigs_lop_ky_uidx hoàn toàn không đụng tới; chỉ trigger đếm ngày mới bắt được.
  begin
    insert into wigs (class_id, scope, kind, status, set_by, measure_by, area,
                      period, period_label, title, baseline, target_value, unit,
                      start_date, end_date)
    values (v_lop, 'class', null, 'approved', null, 'tick', areas[2]::wig_domain,
            'year', 'TEST-TRAN-KHAC', 'cái thứ năm đổi nhãn', 0, 100, 'lần',
            current_date, current_date + 300);
    insert into kq values ('Cái thứ 5 ĐỔI NHÃN KỲ · vẫn bị chặn', 'bị từ chối', 'CHÈN ĐƯỢC — trần bốc hơi', false);
  exception when others then
    loi := sqlerrm;
    insert into kq values ('Cái thứ 5 ĐỔI NHÃN KỲ · vẫn bị chặn', 'bị từ chối', 'từ chối: ' || left(loi, 60), true);
  end;

  -- ④ Lớp khác không bị vạ lây: trần là của TỪNG lớp.
  if v_lop2 is null then
    insert into kq values ('Lớp khác không vạ lây', 'chèn được', 'bỏ qua — chỉ có một lớp', true);
  else
    begin
      delete from wigs where class_id = v_lop2 and scope = 'class' and period = 'year';
      insert into wigs (class_id, scope, kind, status, set_by, measure_by, area,
                        period, period_label, title, baseline, target_value, unit,
                        start_date, end_date)
      values (v_lop2, 'class', null, 'approved', null, 'tick', areas[1]::wig_domain,
              'year', 'TEST-TRAN', 'lớp khác', 0, 100, 'lần',
              current_date, current_date + 300);
      insert into kq values ('Lớp khác không vạ lây', 'chèn được', 'chèn được', true);
    exception when others then
      insert into kq values ('Lớp khác không vạ lây', 'chèn được', 'BỊ TỪ CHỐI: ' || left(sqlerrm, 60), false);
    end;
  end if;
exception when others then
  insert into kq values ('Chạy trọn phép kiểm', 'không lỗi', 'LỖI ' || sqlstate || ' ' || sqlerrm, false);
end $$;

select case when dat then 'OK  ' else 'HỎNG' end as ket, buoc, ky_vong as "mong đợi", thuc_te as "thực tế"
from kq;

select count(*) filter (where dat) || '/' || count(*) || ' đạt.' as "Kết quả" from kq;

rollback;
