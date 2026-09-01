-- CỘT MỐC KẾ HOẠCH: bước xong → so_do đúng %; RLS theo mục tiêu cha (0172)
--
--   npm run sql -- scripts/test-0172-cot-moc-ke-hoach.sql
--
-- Tự rollback. Cần 0172 đã áp. Kiểm: (1) thêm bước không đụng so_do tới khi XONG; (2) đánh xong
-- 2 bước 30+50 → so_do = 80; (3) bỏ xong một bước → so_do giảm; (4) em KHÁC không đọc/ghi buoc.
begin;
create table kq (buoc text, mong_doi text, thuc_te text, dat boolean);

-- Một em thật ở lớp Test + một em khác để thử RLS.
create table ai as
select (select array_agg(student_id order by student_id)
        from (select student_id from enrollments e join classes c on c.id=e.class_id
              where c.name='Test' and c.is_active and e.is_active order by student_id limit 2) x) as em,
       (select c.id from classes c where c.name='Test' and c.is_active limit 1) as lop,
       (select c.campus_id from classes c where c.name='Test' and c.is_active limit 1) as cs;
grant all on kq, ai to authenticated;

do $$ begin
  if (select array_length(em,1) from ai) < 2 then raise exception 'Lớp Test cần >=2 em'; end if;
end $$;

-- Tạo mục tiêu KẾ HOẠCH của em[1] (dưới quyền định-nghĩa-viên để khỏi vướng vòng duyệt).
create table mt as
with x as (
  insert into muc_tieu (cap, campus_id, class_id, student_id, nam_hoc, ten, linh_vuc,
                        kieu_dich, chieu, nguon_so, loai_moc, x_so, y_so, ket_thuc, trang_thai, don_vi_id)
  select 'em', cs, lop, em[1], '2026-2027', 'KIỂM kế hoạch', 'knowledge',
         'toi', 'tang', 'ghi_tay', 'ke_hoach', 0, 100, '2027-06-30', 'duyet', '07163e38-9c76-4e32-b265-89645be35aaa'
  from ai returning id
) select id from x;
grant all on mt to authenticated;

-- Thêm 3 bước: 30 + 50 + 20 = 100.
create table buocs as
with x as (
  insert into buoc (muc_tieu_id, thu_tu, tieu_de, phan_tram)
  select (select id from mt), t.i, t.ten, t.pt
  from (values (1,'Chọn đề',30::numeric),(2,'Thí nghiệm',50),(3,'Viết báo cáo',20)) t(i,ten,pt)
  returning id, phan_tram
) select id, phan_tram from x;
grant all on buocs to authenticated;

-- ① Chưa xong bước nào → so_do = 0 (trigger đã ghi một dòng 0).
do $$ declare v numeric; begin
  select gia_tri into v from so_do where muc_tieu_id=(select id from mt) and nguon='he_thong'
    order by created_at desc limit 1;
  insert into kq values ('Chưa xong bước nào → so_do', '0', coalesce(v::text,'(không có)'), coalesce(v,-1)=0);
end $$;

-- ② Đánh xong bước 30 và 50 → so_do = 80.
update buoc set xong_at = now() where muc_tieu_id=(select id from mt) and phan_tram in (30,50);
do $$ declare v numeric; begin
  select gia_tri into v from so_do where muc_tieu_id=(select id from mt) and nguon='he_thong'
    order by created_at desc, id desc limit 1;
  insert into kq values ('Xong 30+50 → so_do', '80', coalesce(v::text,'?'), coalesce(v,-1)=80);
end $$;

-- ②b Bộ tính THẬT (so_hien_tai) thấy pct = 80% qua đường của em.
do $$ declare v numeric; begin
  select (h.pct*100)::numeric into v from private.so_hien_tai((select id from mt)) h;
  insert into kq values ('so_hien_tai pct sau 30+50', '80', coalesce(round(v)::text,'?'), coalesce(round(v),-1)=80);
end $$;

-- ③ Bỏ xong bước 50 → so_do = 30.
update buoc set xong_at = null where muc_tieu_id=(select id from mt) and phan_tram=50;
do $$ declare v numeric; begin
  select gia_tri into v from so_do where muc_tieu_id=(select id from mt) and nguon='he_thong'
    order by created_at desc, id desc limit 1;
  insert into kq values ('Bỏ xong bước 50 → so_do', '30', coalesce(v::text,'?'), coalesce(v,-1)=30);
end $$;

-- ④ EM KHÁC (em[2]) không đọc được buoc của em[1].
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select em[2] from ai), 'role','authenticated')::text, true);
do $$ declare v int; begin
  select count(*) into v from buoc where muc_tieu_id=(select id from mt);
  insert into kq values ('Em khác đọc buoc', '0', v||' dòng', v=0);
end $$;
do $$ declare v int; begin
  insert into buoc (muc_tieu_id, thu_tu, tieu_de, phan_tram)
  values ((select id from mt), 9, 'CHEN LEN', 5);
  get diagnostics v = row_count;
  insert into kq values ('Em khác thêm buoc', 'bị chặn', v||' dòng chèn', false);
exception when others then
  insert into kq values ('Em khác thêm buoc', 'bị chặn', 'bị chặn ('||sqlstate||')', sqlstate in ('42501','23514'));
end $$;
reset role;

select buoc, mong_doi, thuc_te, case when dat then 'ĐẠT' else '*** SAI ***' end ket from kq;
select count(*) filter (where dat)||'/'||count(*)||' đạt' tong from kq;
rollback;
