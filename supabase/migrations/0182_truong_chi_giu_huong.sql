-- 0182 — LỚP → TRƯỜNG CHỈ GIỮ HƯỚNG (chủ dự án đổi 03/09/2026, ngay sau 0181)
--
-- 0181 cho lớp→trường cộng số khi cùng đơn vị. Chủ dự án bỏ: mục tiêu trường ĐO THEO CÁCH RIÊNG
-- (ban giám hiệu tự ghi số), lớp nối vào chỉ để cùng một hướng. Cộng số qua `noi` giờ CHỈ còn
-- một cặp: mục tiêu cá nhân (cap='em') → mục tiêu lớp.
--
-- Đối chiếu: noi_wig_len_tren bản live = đúng bản 0181 vừa chạy (chưa ai vá thêm).

-- 1. noi_wig_len_tren — bỏ nhánh gop_so cho cặp lớp→trường; giữ nguyên phần còn lại của 0181.
create or replace function public.noi_wig_len_tren(p_con uuid, p_cha uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); con muc_tieu%rowtype; cha muc_tieu%rowtype;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  select * into con from muc_tieu where id = p_con;
  select * into cha from muc_tieu where id = p_cha;
  if con.id is null or cha.id is null then
    raise exception 'Không thấy mục tiêu để nối' using errcode = '23503';
  end if;
  if not ghi_duoc_muc_tieu(p_con) then
    raise exception 'Chỉ chủ mục tiêu mới nối được nó lên trên' using errcode = '42501';
  end if;
  if not ( (con.cap = 'em'  and con.student_id = v_me and cha.cap = 'lop'
            and cha.class_id = con.class_id and (is_class_teacher(con.class_id) or (select auth_role()) = 'admin'))
        or (con.cap = 'lop' and cha.cap = 'truong' and cha.trang_thai = 'duyet'
            and cha.campus_id = con.campus_id) ) then
    raise exception 'Chỉ nối được mục tiêu của mình lên mục tiêu lớp, hoặc mục tiêu lớp lên mục tiêu trường cùng cơ sở'
      using errcode = '42501';
  end if;
  insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'chi_huong', v_me)
    on conflict do nothing;
  -- 0182: cộng số CHỈ cho cá nhân→lớp. Lớp→trường luôn chỉ giữ hướng — trường đo theo cách riêng.
  if con.cap = 'em' and con.don_vi_id is not null and con.don_vi_id = cha.don_vi_id then
    -- Đổi nguồn số của cha TRƯỚC — trg_noi_hop_le đòi cha nguon_so='con' rồi mới nhận dây gop_so.
    if cha.nguon_so is distinct from 'con' then
      perform set_config('va.doi_nguon_so', '1', true);
      update muc_tieu set nguon_so = 'con', gop_con = 'cong' where id = p_cha;
      perform set_config('va.doi_nguon_so', '', true);
    end if;
    insert into noi (cha_id, con_muc_tieu_id, vai, created_by) values (p_cha, p_con, 'gop_so', v_me)
      on conflict do nothing;
  end if;
end $$;

-- 2. Dọn dây gop_so lớp→trường lỡ tạo trong khoảng 0181→0182 (vòng test sống trên lớp Test).
--    Chạy bằng postgres nên auth.uid() null → mt_truoc_sua cho qua (nhánh L6).
delete from noi n
using muc_tieu cha, muc_tieu con
where n.cha_id = cha.id and n.con_muc_tieu_id = con.id
  and n.vai = 'gop_so' and cha.cap = 'truong' and con.cap = 'lop';

update muc_tieu
set nguon_so = 'ghi_tay', gop_con = null
where cap = 'truong' and nguon_so = 'con'
  and not exists (select 1 from noi where cha_id = muc_tieu.id and vai = 'gop_so');
