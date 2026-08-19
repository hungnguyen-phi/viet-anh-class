-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0153 — BUDDY LÀ NHÓM 2 HOẶC 3, KHÔNG CÒN GHÉP TỪNG CẶP RỜI
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Chủ dự án 19/08/2026: "buddy bây giờ là bạn học, sẽ có nhóm 2, hoặc 3. ví dụ lớp lẻ thì tất
-- cả đều 2 thì 1 nhóm 3". Tức là: mỗi em thuộc ĐÚNG MỘT nhóm, nhóm có 2 hoặc 3 em.
--
-- KHÔNG dựng bảng nhóm mới. Bảng buddy_pairs (0146) biểu diễn được trọn vẹn: nhóm 2 = 1 cặp,
-- nhóm 3 = 3 cặp đôi một (A-B, A-C, B-C) — và trigger chan_buddy_thu_ba "tối đa 2 buddy/em"
-- sẵn có CHÍNH LÀ chốt "nhóm tối đa 3". Mọi trigger/hàm đang chạy (buddy_cung_lop,
-- apply_class_transfer, is_my_buddy, RLS bp_*) giữ nguyên, không phải đè hàm nào trên
-- production. Thứ đổi là CÁCH TẠO: một nhóm phải ra đời nguyên khối trong một giao dịch —
-- ghép tay 3 cặp mà đứt giữa chừng thì thành "chuỗi" (A-B, A-C mà B với C không phải buddy),
-- họp 1-1-1 của B sẽ thiếu C. Hàm dưới là cửa tạo duy nhất mà giao diện dùng.
--
-- security INVOKER: insert chạy dưới quyền người gọi → RLS bp_manage (chỉ GVCN/BGH/Admin của
-- lớp) và cặp trigger 0146/0151 vẫn là chốt thật; hàm chỉ thêm hai luật của mô hình nhóm:
-- đúng 2–3 em khác nhau, và em nào đang có nhóm thì phải gỡ nhóm cũ trước (mỗi em một nhóm).
create or replace function public.tao_buddy_nhom(p_class uuid, p_members uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  n int;
  i int;
  j int;
begin
  select count(distinct m) into n from unnest(p_members) m;
  if n < 2 or n > 3 or n <> coalesce(array_length(p_members, 1), 0) then
    raise exception 'Nhóm buddy gồm 2 hoặc 3 học sinh khác nhau' using errcode = '23514';
  end if;
  if exists (
    select 1 from buddy_pairs b
    where b.is_active
      and (b.student_id = any(p_members) or b.buddy_id = any(p_members))
  ) then
    raise exception 'Có em đã ở một nhóm buddy khác — gỡ nhóm cũ trước' using errcode = '23514';
  end if;
  -- Mọi cặp đôi một, đầu nhỏ đứng trước (buddy_thu_tu_ck). Cả vòng lặp là MỘT giao dịch:
  -- một cặp bị RLS/trigger chặn là cả nhóm không ra đời — không bao giờ để lại nửa nhóm.
  for i in 1..n - 1 loop
    for j in i + 1..n loop
      insert into buddy_pairs (class_id, student_id, buddy_id, created_by)
      values (p_class,
              least(p_members[i], p_members[j]),
              greatest(p_members[i], p_members[j]),
              (select auth.uid()));
    end loop;
  end loop;
end $$;
-- Đúng bài audit v3: hàm mới nào cũng revoke public/anon trước khi grant (đừng lặp lỗ 0151).
revoke all on function public.tao_buddy_nhom(uuid, uuid[]) from public, anon;
grant execute on function public.tao_buddy_nhom(uuid, uuid[]) to authenticated;
