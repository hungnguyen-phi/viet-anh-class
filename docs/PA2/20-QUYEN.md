# 20-QUYEN — Helper, RLS, trigger duyệt/chữ ký/khoá (PA2, bản chốt)

Vì sao tệp này dài gấp đôi tệp schema: hai lỗ critical 18/08 và lỗ `apply_class_transfer` hôm nay
đều KHÔNG nằm ở bảng — nằm ở ACL mặc định, ở view quên `security_invoker`, ở hàm definer quên
revoke. Nên mảng quyền viết SQL nguyên văn, không mô tả. Hai sự thật production chi phối mọi khối:
(1) default ACL của schema `public` cấp ALL trên bảng mới và EXECUTE trên hàm mới cho
`anon, authenticated, service_role` NGAY LÚC TẠO — bảng tạo tệp N mà bật RLS tệp N+1 là mở toang
giữa hai tệp; (2) `revoke … from public` KHÔNG rút quyền của anon/authenticated (họ được cấp đích
danh). Vì thế L1 (bảng sinh ra là đóng, trong CÙNG tệp) và L2 (hàm mới đủ ba dòng revoke/grant)
là bất biến số một. Tên vai trò, tên cột theo 00-TONG-QUAN §3; `uid` = `(select auth.uid())`.

## 0. Vai, predicate gốc (hàm đang chạy — GIỮ NGUYÊN) và luật bất biến

| Vai | Predicate | Ghi chú production |
|---|---|---|
| Em chính chủ | `student_id = uid` + `is_class_student(class_id)` | |
| Em cùng lớp | `is_class_student(class_id)` — chỉ dòng cấp lớp/nhóm/trường | |
| Phụ huynh | `is_my_child(student_id)` · `is_parent_of_class(class_id)` | select-only trừ `cam_ket_xac_nhan`, `edit_requests` |
| GVCN | `is_class_teacher(c)` · `staff_can_manage_class(c)` (= GVCN ∨ admin, KHÔNG BGH) | |
| GVBM | `is_subject_teacher_of_class(c)` (môn bất kỳ) · MỚI `la_gvbm_mon(c, s)` (đúng môn) | |
| BGH | `auth_role()='principal' ∧ is_campus_class(c)` · `staff_can_read_class(c)` | 2/4 BGH đang `campus_id` null — gán trước khi dùng màn mới |
| Admin | `auth_role()='admin'` — luôn một policy `rls_all_<bảng>` riêng | |
| service_role | bypass RLS, chỉ đi qua trigger | dispatcher, cron |

Luật L1–L12: xem 00-TONG-QUAN §4 — mỗi luật có ít nhất một dòng kiểm ở 60-KIEM. Nhắc ba luật hay
quên nhất: L3 (view sửa lại phải LẶP `security_invoker=true`), L6 (`if uid is null then return new`
đầu trigger có vai — nhưng TRẦN dữ liệu như ≤4 mục tiêu vẫn nằm sau nhánh này: hệ thống seed đi
qua, người thật không), L11 (`class_id`, `campus_id` luôn trong whitelist "không phải nội dung").

## 1. Hàm trợ giúp mới (tệp 0163/0164/0165 — đặt TRƯỚC policy dùng chúng)

Mẫu chung: `language sql stable security definer set search_path = public`; kết tệp bằng khối
grant §1.5. Bảng `luot_mo_khoa` phải tạo TRƯỚC `luot_bi_khoa` trong cùng tệp 0165 (hàm `language
sql` bị parse-check lúc create).

### 1.1 Chủ thể

```sql
create or replace function public.thuoc_co_so(p_campus uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_campus is not null and (
       (select auth_role()) = 'admin'
    or (select auth_campus()) = p_campus
    or exists (select 1 from enrollments e join classes c on c.id = e.class_id
               where e.student_id = (select auth.uid()) and e.is_active and c.campus_id = p_campus)
    or exists (select 1 from parent_links pl join enrollments e on e.student_id = pl.student_id
               join classes c on c.id = e.class_id
               where pl.parent_id = (select auth.uid()) and e.is_active and c.campus_id = p_campus)
    or exists (select 1 from classes c where c.homeroom_teacher_id = (select auth.uid()) and c.campus_id = p_campus)
    or exists (select 1 from teaching_assignments ta join classes c on c.id = ta.class_id
               where ta.teacher_id = (select auth.uid()) and ta.is_active and c.campus_id = p_campus));
$$;

create or replace function public.lop_nhap_ho(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nhap_ho from classes where id = c), false);
$$;

create or replace function public.la_gvbm_mon(c uuid, s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s is not null and exists (select 1 from teaching_assignments
    where class_id = c and subject_id = s and teacher_id = (select auth.uid()) and is_active);
$$;

create or replace function public.nhom_class(n uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from nhom where id = n; $$;

create or replace function public.em_trong_nhom(n uuid, s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from nhom_thanh_vien v join nhom g on g.id = v.nhom_id
                 where v.nhom_id = n and v.student_id = s and v.is_active and g.is_active);
$$;

create or replace function public.la_thanh_vien_nhom(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select em_trong_nhom(n, (select auth.uid()));
$$;
```

Ba predicate cấp cho `muc_tieu` (thuoc/cam_ket có bộ RIÊNG — chốt C11/C23, KHÔNG tái dùng):

```sql
-- ĐỌC được dòng của chủ thể này? (dùng chung 3 bảng: thuoc/cam_ket truyền p_campus = null)
create or replace function public.doc_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_cap
    when 'em'     then p_student = (select auth.uid())
                    or is_my_child(p_student)
                    or staff_can_read_class(p_class)                       -- BGH đọc dòng thô: [H-13]
    when 'nhom'   then is_class_student(p_class) or is_parent_of_class(p_class)
                    or staff_can_read_class(p_class)                       -- cả lớp thấy dòng cấp nhóm (chốt C24)
    when 'lop'    then is_class_student(p_class) or is_parent_of_class(p_class)
                    or staff_can_read_class(p_class) or is_subject_teacher_of_class(p_class)
    when 'truong' then thuoc_co_so(p_campus)                               -- em/PH thấy mục tiêu trường [H-11]
    else false end;
$$;

-- GHI NỘI DUNG mục tiêu (tạo/sửa/xoá khi chưa duyệt)
create or replace function public.ghi_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then (p_student = (select auth.uid()) and is_class_student(p_class))
                    or (is_class_teacher(p_class) and lop_nhap_ho(p_class))
    when 'nhom'   then is_class_teacher(p_class)
    when 'lop'    then is_class_teacher(p_class)
                    or ((select auth_role()) = 'principal' and is_campus_class(p_class))
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;

-- NGƯỜI DUYỆT của mục tiêu cấp này (giữ luật 0148: lớp qua tay BGH)
create or replace function public.duyet_duoc_chu_the(p_cap text, p_campus uuid, p_class uuid, p_nhom uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin' or case p_cap
    when 'em'     then is_class_teacher(p_class)
    when 'nhom'   then is_class_teacher(p_class)                           -- [H-06] GVCN tạo nhóm = tự duyệt
    when 'lop'    then (select auth_role()) = 'principal' and is_campus_class(p_class)
    when 'truong' then (select auth_role()) = 'principal' and p_campus = (select auth_campus())
    else false end;
$$;
```

### 1.2 Tra cứu theo id (policy bảng con không join)

```sql
create or replace function public.muc_tieu_class(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from muc_tieu where id = m; $$;
create or replace function public.muc_tieu_student(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select student_id from muc_tieu where id = m; $$;
create or replace function public.doc_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;
create or replace function public.ghi_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;
create or replace function public.duyet_duoc_muc_tieu(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id) from muc_tieu where id = m; $$;

create or replace function public.thuoc_class(t uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from thuoc where id = t; $$;
create or replace function public.doc_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
      or (subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;
-- GHI NỘI DUNG thước — bộ riêng, KHÔNG có nhánh principal (chốt C23)
create or replace function public.ghi_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin'
      or (chu_the = 'em' and (student_id = (select auth.uid())
                              or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
      or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
      or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;
-- NGƯỜI DUYỆT thước: GVCN/admin cho MỌI chủ thể, kể cả thước môn (chốt C11, [H-07][H-08])
create or replace function public.duyet_duoc_thuoc(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select staff_can_manage_class(class_id) from thuoc where id = t; $$;
-- Ai GHI HỘ lượt / ghi lượt cả đội (GVCN, GVBM đúng môn, admin)
create or replace function public.ghi_ho_duoc_luot(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select staff_can_manage_class(class_id)
      or (subject_id is not null and la_gvbm_mon(class_id, subject_id))
  from thuoc where id = t; $$;
-- Thước đang nhận lượt của chủ thể p_student (null = lượt cả đội)? — 'gui' vẫn ghi được [H-09]
create or replace function public.thuoc_nhan_luot(t uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from thuoc th
    where th.id = t and th.trang_thai = 'chay' and th.duyet in ('gui','duyet')
      and case when p_student is null then th.pham_vi = 'ca_doi'
          else th.pham_vi = 'tung_em' and case th.chu_the
            when 'em'   then th.student_id = p_student
            when 'lop'  then exists (select 1 from enrollments e
                                     where e.class_id = th.class_id and e.student_id = p_student and e.is_active)
            when 'nhom' then em_trong_nhom(th.nhom_id, p_student) end
          end);
$$;

create or replace function public.cam_ket_student(k uuid) returns uuid
language sql stable security definer set search_path = public as $$ select student_id from cam_ket where id = k; $$;
create or replace function public.doc_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
      or (chu_the = 'em' and is_my_buddy(student_id))                      -- [H-12]
  from cam_ket where id = k; $$;
-- GHI cam kết — bộ riêng, không principal (chốt C23)
create or replace function public.ghi_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select auth_role()) = 'admin'
      or (chu_the = 'em' and (student_id = (select auth.uid())
                              or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
      or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
  from cam_ket where id = k; $$;
-- Cam kết đã được kể lại trong một biên bản ĐÃ KÝ HỢP LỆ → đông cứng
create or replace function public.cam_ket_da_ke_lai(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pdr_ke_lai r join pdr_meetings m on m.id = r.pdr_meeting_id
    where r.cam_ket_id = k and m.acknowledged_at is not null
      and pdr_chu_ky_hop_le(m.student_id, m.type, m.counterpart_id, m.second_buddy_id, m.acknowledged_by, m.class_id));
$$;

create or replace function public.pdr_class(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from pdr_meetings where id = m; $$;
create or replace function public.ghi_duoc_pdr_ke_lai(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pdr_meetings p where p.id = m and p.acknowledged_at is null
    and (p.student_id = (select auth.uid())
         or (is_class_teacher(p.class_id) and lop_nhap_ho(p.class_id))));
$$;
create or replace function public.xac_nhan_duoc_cam_ket(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c.chu_the = 'em' and c.student_id <> (select auth.uid())
     and (is_my_buddy(c.student_id) or is_class_teacher(c.class_id) or is_my_child(c.student_id))
  from cam_ket c where c.id = k; $$;

create or replace function public.doc_duoc_con(p_loai text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_loai when 'muc_tieu' then doc_duoc_muc_tieu(p_id) when 'thuoc' then doc_duoc_thuoc(p_id) else false end; $$;
create or replace function public.ghi_duoc_con(p_loai text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_loai when 'muc_tieu' then ghi_duoc_muc_tieu(p_id) when 'thuoc' then ghi_duoc_thuoc(p_id) else false end; $$;
```

### 1.3 Chữ ký và khoá

```sql
-- L8: chữ ký = chính em; hoặc BẠN TRONG BUỔI HỌP (counterpart/second) ở lớp bật nhập hộ.
-- Thầy cô KHÔNG ký, kể cả gõ acknowledged_by = em (chốt C22).
create or replace function public.pdr_chu_ky_hop_le(p_student uuid, p_type text, p_counterpart uuid,
                                                    p_second uuid, p_by uuid, p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_by is not null and (p_by = p_student
    or (p_type = 'buddy' and p_by in (p_counterpart, p_second) and lop_nhap_ho(p_class)));
$$;

-- Cửa sổ ghi 7 ngày của EM (thầy cô ghi hộ KHÔNG vướng — chốt C25). Không definer, không đọc bảng.
create or replace function public.trong_cua_so_ghi(p_ngay date) returns boolean
language sql stable set search_path = public as $$
  select p_ngay between vn_today() - 6 and vn_today();
$$;

-- Lượt của em p_student ngày p_ngay ĐÃ KHOÁ chưa. Khoá khi có biên bản ký hợp lệ mà (a) ngày ≤ ngày
-- ký (giờ VN) và (b) ngày rơi vào tuần của MỘT cam kết đã kể lại trong biên bản ấy — hoặc, biên bản
-- không kể gì, tuần liền trước tuần họp [H-14: khoá theo TUẦN, mọi thước; tính cả type='coach'].
-- Mở lại duy nhất qua luot_mo_khoa. Gác đầu hàm chống dò: người lạ gọi → false (không tín hiệu).
create or replace function public.luot_bi_khoa(p_student uuid, p_ngay date) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_student = (select auth.uid()) or is_my_child(p_student)
          or exists (select 1 from enrollments e
                     where e.student_id = p_student and e.is_active and staff_can_read_class(e.class_id)))
  and exists (
    select 1 from pdr_meetings m
    where m.student_id = p_student and m.acknowledged_at is not null
      and pdr_chu_ky_hop_le(m.student_id, m.type, m.counterpart_id, m.second_buddy_id, m.acknowledged_by, m.class_id)
      and p_ngay <= (m.acknowledged_at at time zone 'Asia/Ho_Chi_Minh')::date
      and (exists (select 1 from pdr_ke_lai r join cam_ket c on c.id = r.cam_ket_id
                   where r.pdr_meeting_id = m.id
                     and p_ngay between c.tuan_bat_dau and c.tuan_bat_dau + 7 * c.so_tuan - 1)
        or (not exists (select 1 from pdr_ke_lai r where r.pdr_meeting_id = m.id)
            and vn_week_start(p_ngay) = thu_hai_tu_nhan(m.week_label) - 7)))
  and not exists (select 1 from luot_mo_khoa mk
    where mk.student_id = p_student and mk.week_start = vn_week_start(p_ngay) and now() < mk.het_han);
$$;
```

### 1.4 Whitelist dùng chung cho trigger duyệt lại (L5)

```sql
create or replace function private.doi_noi_dung(p_old jsonb, p_new jsonb, p_khong_noi_dung text[])
returns boolean language sql immutable as $$
  select (p_new - p_khong_noi_dung) is distinct from (p_old - p_khong_noi_dung);
$$;
```

### 1.5 Khối grant cuối MỖI tệp helper (L2 — sự thật ACL số 2)

```sql
do $$ declare f text; begin
  foreach f in array array[
    'thuoc_co_so(uuid)','lop_nhap_ho(uuid)','la_gvbm_mon(uuid,uuid)','nhom_class(uuid)',
    'em_trong_nhom(uuid,uuid)','la_thanh_vien_nhom(uuid)',
    'doc_duoc_chu_the(text,uuid,uuid,uuid,uuid)','ghi_duoc_chu_the(text,uuid,uuid,uuid,uuid)',
    'duyet_duoc_chu_the(text,uuid,uuid,uuid,uuid)',
    'muc_tieu_class(uuid)','muc_tieu_student(uuid)','doc_duoc_muc_tieu(uuid)','ghi_duoc_muc_tieu(uuid)',
    'duyet_duoc_muc_tieu(uuid)','thuoc_class(uuid)','doc_duoc_thuoc(uuid)','ghi_duoc_thuoc(uuid)',
    'duyet_duoc_thuoc(uuid)','ghi_ho_duoc_luot(uuid)','thuoc_nhan_luot(uuid,uuid)',
    'cam_ket_student(uuid)','doc_duoc_cam_ket(uuid)','ghi_duoc_cam_ket(uuid)','cam_ket_da_ke_lai(uuid)',
    'pdr_class(uuid)','ghi_duoc_pdr_ke_lai(uuid)','xac_nhan_duoc_cam_ket(uuid)',
    'doc_duoc_con(text,uuid)','ghi_duoc_con(text,uuid)',
    'pdr_chu_ky_hop_le(uuid,text,uuid,uuid,uuid,uuid)','trong_cua_so_ghi(date)','luot_bi_khoa(uuid,date)',
    'goi_y_cam_ket(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function private.doi_noi_dung(jsonb, jsonb, text[]) from public;
grant execute on function private.doi_noi_dung(jsonb, jsonb, text[]) to authenticated;
```
(Chép đủ danh sách — phản biện từng bắt lỗi thiếu `xac_nhan_duoc_cam_ket`/`ghi_duoc_pdr_ke_lai`,
góp ý cuối bắt thêm `goi_y_cam_ket`. Mảng trên là TỔNG: mỗi tệp 0162–0165 chỉ lặp phần chữ ký
nó vừa tạo — cắt theo bảng 50-DI-TRU §1; dán nguyên khối vào 0162 sẽ đổ vì hàm 0163+ chưa tồn tại.
Các hàm tra cứu `*_class/*_student` giữ grant authenticated: policy chạy bằng quyền người gọi;
đầu vào là uuid không đoán được nên rủi ro dò chấp nhận được — ghi nhận, không mở rộng thêm.)

## 2. Policy từng bảng

Mẫu tên: `rls_<lệnh>_<bảng>`, khe hẹp `rls_<việc>`, admin luôn `rls_all_<bảng>`
(`using/with check ((select auth_role()) = 'admin')` — không chép lại từng bảng dưới đây).
Mọi policy `to authenticated`; `(select …)` cho hàm không nhận cột (L10).

### 2.1 `don_vi` — chỉ thầy cô nuôi danh mục [H-17]

```sql
create policy rls_select_don_vi on don_vi for select to authenticated using (true);
create policy rls_staff_ghi_don_vi on don_vi for insert to authenticated
  with check ((select auth_role()) in ('teacher','principal','admin') and created_by = (select auth.uid()));
```
Không update/delete (đơn vị đã dùng thì bất biến; admin qua `rls_all`). Em gặp thiếu đơn vị:
UI hiện "nhờ thầy cô thêm".

### 2.2 `tuan_hoc`

```sql
create policy rls_select_tuan_hoc on tuan_hoc for select to authenticated using (thuoc_co_so(campus_id));
create policy rls_bgh_ghi_tuan_hoc on tuan_hoc for all to authenticated
  using ((select auth_role()) = 'principal' and campus_id = (select auth_campus()))
  with check ((select auth_role()) = 'principal' and campus_id = (select auth_campus()));
```

### 2.3 `nhom`, `nhom_thanh_vien`

```sql
create policy rls_select_nhom on nhom for select to authenticated
  using (is_class_student(class_id) or is_parent_of_class(class_id)
         or staff_can_read_class(class_id) or is_subject_teacher_of_class(class_id));
create policy rls_manage_nhom on nhom for all to authenticated
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
create policy rls_select_ntv on nhom_thanh_vien for select to authenticated
  using (is_class_student(nhom_class(nhom_id)) or is_parent_of_class(nhom_class(nhom_id))
         or staff_can_read_class(nhom_class(nhom_id)) or is_subject_teacher_of_class(nhom_class(nhom_id)));
create policy rls_manage_ntv on nhom_thanh_vien for all to authenticated
  using (staff_can_manage_class(nhom_class(nhom_id))) with check (staff_can_manage_class(nhom_class(nhom_id)));
```
Trigger dữ liệu chặn sửa tay nhóm `loai='buddy'` (chiếu từ `buddy_pairs` qua RPC `tao_buddy_nhom`):
trong `rls_manage_nhom` không phân biệt được — thêm vế `using (… and (loai <> 'buddy' or (select
auth_role()) = 'admin'))` cho update/delete? Không — giữ policy gọn, chặn ở trigger `ntv_hop_le` +
trigger nhỏ `nhom_buddy_chi_may` (before update/delete on nhom: `old.loai='buddy'` và uid không
null và không cờ `va.chieu_buddy` → 42501 'Nhóm bạn học sửa ở trang Danh sách lớp').

### 2.4 `muc_tieu_mau`

```sql
create policy rls_select_mtm on muc_tieu_mau for select to authenticated
  using (is_class_student(class_id) or is_parent_of_class(class_id) or staff_can_read_class(class_id));
create policy rls_manage_mtm on muc_tieu_mau for all to authenticated
  using (staff_can_manage_class(class_id)) with check (staff_can_manage_class(class_id));
```

### 2.5 `muc_tieu`

```sql
create policy rls_select_muc_tieu on muc_tieu for select to authenticated
  using (doc_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
create policy rls_insert_muc_tieu on muc_tieu for insert to authenticated
  with check (created_by = (select auth.uid())
              and ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
-- UPDATE mở cho cả người ghi lẫn người duyệt; trigger §3.2 quyết cột nào ai được đụng.
-- WITH CHECK trên CỘT DÒNG MỚI — tự chặn trò đổi student_id/class_id sang người khác.
create policy rls_update_muc_tieu on muc_tieu for update to authenticated
  using (ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
         or duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id))
  with check (ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
              or duyet_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id));
create policy rls_delete_muc_tieu on muc_tieu for delete to authenticated
  using (trang_thai in ('nhap','gui','tra_lai')
         and ghi_duoc_chu_the(cap, campus_id, class_id, nhom_id, student_id)
         and not exists (select 1 from so_do s where s.muc_tieu_id = muc_tieu.id)
         and not exists (select 1 from noi n where n.cha_id = muc_tieu.id or n.con_muc_tieu_id = muc_tieu.id)
         and not exists (select 1 from cam_ket c where c.muc_tieu_id = muc_tieu.id and c.trang_thai = 'hieu_luc'));
```
(Hai vế `not exists` trên `noi`/`cam_ket` thêm ở 0165 bằng `drop policy if exists + create` —
0163 tạo bản chưa có hai vế đó, ghi chú trong tệp.) Toàn bộ luật "thầy cô không sửa nội dung
của em" nằm ở trigger §3.2 — đúng lý do 0133 chọn trigger thay `with check`.

### 2.6 `moc_muc_tieu`, `thanh_phan`, `lich_su_dich`

```sql
create policy rls_select_moc on moc_muc_tieu for select to authenticated using (doc_duoc_muc_tieu(muc_tieu_id));
create policy rls_manage_moc on moc_muc_tieu for all to authenticated
  using (ghi_duoc_muc_tieu(muc_tieu_id)) with check (ghi_duoc_muc_tieu(muc_tieu_id));
-- thanh_phan: y hệt moc_muc_tieu (đổi tên); kèm trigger tp_sau_ghi §3.2.
create policy rls_select_lsd on lich_su_dich for select to authenticated using (doc_duoc_muc_tieu(muc_tieu_id));
-- lich_su_dich KHÔNG có policy ghi — chỉ trigger definer ghi; admin qua rls_all.
```

### 2.7 `so_do`

```sql
create policy rls_select_so_do on so_do for select to authenticated
  using (student_id = (select auth.uid())
         or (student_id is null and doc_duoc_muc_tieu(muc_tieu_id))
         or (student_id is not null and (is_my_child(student_id)
             or staff_can_read_class(muc_tieu_class(muc_tieu_id)))));
create policy rls_insert_so_do on so_do for insert to authenticated
  with check (nguon = 'tay' and nguoi_ghi = (select auth.uid()) and ghi_duoc_muc_tieu(muc_tieu_id));
create policy rls_update_so_do on so_do for update to authenticated
  using (nguon = 'tay' and created_at > now() - interval '7 days'
         and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)))
  with check (nguon = 'tay' and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)));
create policy rls_delete_so_do on so_do for delete to authenticated
  using (nguon = 'tay' and created_at > now() - interval '7 days'
         and (nguoi_ghi = (select auth.uid()) or ghi_duoc_muc_tieu(muc_tieu_id)));
```
Luật NGÀY (không tương lai, không trước `bat_dau`, đúng chủ thể, đúng nguồn) nằm ở trigger
`so_do_truoc_ghi` (10-SCHEMA §7) để văng 23514 tiếng người thay vì 0-dòng im lặng. Sau 7 ngày là
lịch sử — sửa bằng dòng mới.

### 2.8 `thuoc`

```sql
create policy rls_select_thuoc on thuoc for select to authenticated
  using (doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
         or (subject_id is not null and la_gvbm_mon(class_id, subject_id)));
-- INSERT tường minh, KHÔNG nhánh principal (chốt C23)
create policy rls_insert_thuoc on thuoc for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid()) and is_class_student(class_id))
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
    or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))));
create policy rls_update_thuoc on thuoc for update to authenticated
  using (ghi_duoc_thuoc(id) or duyet_duoc_thuoc(id))
  with check (   -- trên CỘT DÒNG MỚI, không qua hàm nhận id (vá lỗ WITH CHECK đọc dòng cũ)
       (select auth_role()) = 'admin'
    or (chu_the = 'em' and (student_id = (select auth.uid())
                            or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))
    or (chu_the = 'lop' and subject_id is not null and la_gvbm_mon(class_id, subject_id))
    or staff_can_manage_class(class_id));
create policy rls_delete_thuoc on thuoc for delete to authenticated
  using (duyet <> 'duyet' and not da_tung_duyet and ghi_duoc_thuoc(id));
```

### 2.9 `thuoc_lich_su`

```sql
create policy rls_select_thls on thuoc_lich_su for select to authenticated using (doc_duoc_thuoc(thuoc_id));
create policy rls_insert_thls on thuoc_lich_su for insert to authenticated
  with check (nguoi_doi = (select auth.uid()) and ghi_duoc_thuoc(thuoc_id));
create policy rls_duyet_thls on thuoc_lich_su for update to authenticated
  using (duyet_duoc_thuoc(thuoc_id)) with check (duyet_duoc_thuoc(thuoc_id));
create policy rls_delete_thls on thuoc_lich_su for delete to authenticated
  using (trang_thai = 'cho_duyet' and nguoi_doi = (select auth.uid()));
```

### 2.10 `luot`

```sql
create policy rls_select_luot on luot for select to authenticated
  using (student_id = (select auth.uid())
         or (student_id is null and doc_duoc_thuoc(thuoc_id))
         or (student_id is not null and (is_my_child(student_id)
             or staff_can_read_class(thuoc_class(thuoc_id)) or ghi_ho_duoc_luot(thuoc_id))));
-- EM tự ghi: cửa sổ 7 ngày + khoá chữ ký
create policy rls_em_ghi_luot on luot for insert to authenticated
  with check (student_id = (select auth.uid()) and nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and thuoc_nhan_luot(thuoc_id, student_id)
              and trong_cua_so_ghi(ngay)
              and not luot_bi_khoa(student_id, ngay));
-- THẦY CÔ ghi hộ / lượt cả đội: KHÔNG cửa sổ (để "quá 7 ngày nhờ thầy cô" có thật — C25),
-- vẫn KHÔNG vượt chữ ký.
create policy rls_thay_co_ghi_luot on luot for insert to authenticated
  with check (nguoi_ghi = (select auth.uid()) and nguon = 'tay'
              and ghi_ho_duoc_luot(thuoc_id)
              and thuoc_nhan_luot(thuoc_id, student_id)
              and (student_id is null or not luot_bi_khoa(student_id, ngay)));
create policy rls_update_luot on luot for update to authenticated
  using (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)))
  with check (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
              and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));
create policy rls_delete_luot on luot for delete to authenticated
  using (nguon = 'tay' and (student_id is null or not luot_bi_khoa(student_id, ngay))
         and ((student_id = (select auth.uid()) and trong_cua_so_ghi(ngay)) or ghi_ho_duoc_luot(thuoc_id)));
```
0164 tạo bốn policy này KHÔNG có ba vế `luot_bi_khoa` (hàm chưa tồn tại); 0165 `drop policy if
exists` rồi tạo lại NGUYÊN VĂN như trên — ghi rõ ở cả hai tệp, giữa 0164 và 0165 chưa ai ghi lượt
vì màn mới chưa lên (PR-3).

### 2.11 `luot_mo_khoa`

```sql
create policy rls_select_lmk on luot_mo_khoa for select to authenticated
  using (student_id = (select auth.uid()) or is_my_child(student_id) or staff_can_read_class(class_id));
create policy rls_dong_som_lmk on luot_mo_khoa for update to authenticated
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id) and het_han <= now());   -- GVCN chỉ ĐÓNG SỚM
```
Chỉ trigger duyệt `edit_requests` sinh dòng (§3.7); không ai insert qua RLS.

### 2.12 `cam_ket` — không duyệt

```sql
create policy rls_select_cam_ket on cam_ket for select to authenticated
  using (doc_duoc_chu_the(chu_the, null, class_id, nhom_id, student_id)
         or (chu_the = 'em' and is_my_buddy(student_id)));
create policy rls_insert_cam_ket on cam_ket for insert to authenticated
  with check (created_by = (select auth.uid()) and (
       (chu_the = 'em' and student_id = (select auth.uid()) and is_class_student(class_id))
    or (chu_the = 'em' and is_class_teacher(class_id) and lop_nhap_ho(class_id))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id))));
create policy rls_update_cam_ket on cam_ket for update to authenticated
  using (ghi_duoc_cam_ket(id))
  with check (
       (select auth_role()) = 'admin'
    or (chu_the = 'em' and (student_id = (select auth.uid())
                            or (is_class_teacher(class_id) and lop_nhap_ho(class_id))))
    or (chu_the in ('lop','nhom') and is_class_teacher(class_id)));
create policy rls_delete_cam_ket on cam_ket for delete to authenticated
  using (ket_qua is null and not cam_ket_da_ke_lai(id)
         and not exists (select 1 from cam_ket_xac_nhan x where x.cam_ket_id = cam_ket.id)
         and ghi_duoc_cam_ket(id));
```

### 2.13 `cam_ket_xac_nhan`

```sql
create policy rls_select_ckxn on cam_ket_xac_nhan for select to authenticated using (doc_duoc_cam_ket(cam_ket_id));
create policy rls_insert_ckxn on cam_ket_xac_nhan for insert to authenticated
  with check (nguoi_id = (select auth.uid()) and xac_nhan_duoc_cam_ket(cam_ket_id));
create policy rls_sua_ckxn on cam_ket_xac_nhan for update to authenticated
  using (nguoi_id = (select auth.uid())) with check (nguoi_id = (select auth.uid()));
create policy rls_xoa_ckxn on cam_ket_xac_nhan for delete to authenticated using (nguoi_id = (select auth.uid()));
```

### 2.14 `pdr_ke_lai`

```sql
create policy rls_select_pkl on pdr_ke_lai for select to authenticated
  using (is_pdr_participant(pdr_meeting_id) or staff_can_read_class(pdr_class(pdr_meeting_id)));
create policy rls_manage_pkl on pdr_ke_lai for all to authenticated
  using (ghi_duoc_pdr_ke_lai(pdr_meeting_id)) with check (ghi_duoc_pdr_ke_lai(pdr_meeting_id));
```

### 2.15 Bảng GIỮ nhưng phải sửa

**`pdr_meetings`** — thêm MỘT policy khe hẹp cho bạn ký ở lớp nhập hộ (đọc lại `pg_policies`
trước khi thêm; policy đang chạy giữ nguyên). WITH CHECK đòi `acknowledged_at is not null` —
bạn chỉ có đúng MỘT kiểu update là KÝ, không sửa-rồi-ký-hai-bước:

```sql
create policy pdr_buddy_ky on pdr_meetings for update to authenticated
  using (type = 'buddy' and acknowledged_at is null and lop_nhap_ho(class_id)
         and (select auth.uid()) in (counterpart_id, second_buddy_id))
  with check (type = 'buddy' and lop_nhap_ho(class_id)
              and acknowledged_by = (select auth.uid()) and acknowledged_at is not null);
```

**`edit_requests`** — policy insert đặt lại (vá lỗ em A gửi yêu cầu mang student_id của B):

```sql
drop policy if exists rls_insert_edit_requests on edit_requests;
create policy rls_insert_edit_requests on edit_requests for insert to authenticated
  with check (requester_id = (select auth.uid())
              and ((is_class_student(class_id) and student_id = (select auth.uid()))
                   or is_my_child(student_id)
                   or (kind = 'mo_tuan_da_ky' and staff_can_manage_class(class_id))));
```
(GVCN tự gửi rồi tự duyệt `mo_tuan_da_ky`: dấu vết là mục đích, không phải bốn mắt.)

**`classes.nhap_ho`** — mở rộng `protect_class_privileged_cols` (đọc `pg_get_functiondef` + md5
trước khi đè): thêm vế `new.nhap_ho is distinct from old.nhap_ho` vào nhóm cột đặc quyền, nhưng
riêng `nhap_ho` cho qua khi `auth_role() = 'admin'` HOẶC (`auth_role() = 'principal'` và
`is_campus_class(new.id)`) [H-15]; các cột cũ giữ nguyên chỉ-admin.

**`hub_event_outbox`** — không đổi (RLS bật, không policy, revoke authenticated/anon).

### 2.16 `noi` — dây có vai (RLS theo chủ thể của CHA, đọc đòi cả con; góp ý #1)

```sql
create policy rls_select_noi on noi for select to authenticated
  using (doc_duoc_muc_tieu(cha_id) and doc_duoc_con(con_loai, con_id));

create policy rls_insert_noi on noi for insert to authenticated
  with check (created_by = (select auth.uid()) and noi_tu_dong = false
              and doc_duoc_muc_tieu(cha_id) and ghi_duoc_con(con_loai, con_id)
              and (vai = 'chi_huong'                          -- em tự HƯỚNG lên mục tiêu lớp (C15)
                   or (vai = 'gop_so' and ghi_duoc_muc_tieu(cha_id))));
              -- gop_so: em chỉ lên mục tiêu CỦA CHÍNH EM (ghi_duoc = true); lớp/trường = GVCN/BGH/admin

create policy rls_delete_noi on noi for delete to authenticated
  using (ghi_duoc_con(con_loai, con_id) or ghi_duoc_muc_tieu(cha_id));

create policy rls_all_noi on noi for all to authenticated
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');
```
KHÔNG có policy UPDATE: dây không sửa tại chỗ — gỡ rồi nối lại (dòng mới, `created_by`/`he_so`
mới). Máy nối tự động (`noi_tu_dong = true`, chỉ `chi_huong`) đi qua trigger definer với cờ
`va.noi_tu_dong` (khe hẹp 0155) — không policy nào mở cho người gõ. Luật dữ liệu của dây
(`noi_hop_le`: cùng đơn vị hoặc `he_so`, `cha.nguon_so`, cap(con) < cap(cha) với dây mt→mt,
`moi_nhat` phải là dây `gop_so` duy nhất, con `duyet in ('gui','duyet')` — chỉ CỘNG khi
`duyet='duyet'`) nằm ở 10-SCHEMA §4.4.

## 3. Trigger duyệt / chữ ký / khoá (schema `private`, `security definer set search_path = public`, KHÔNG `of <cột>`)

### 3.2 `muc_tieu` — `mt_truoc_them`, `mt_truoc_sua`, `mt_ghi_lich_su_dich`, `tp_sau_ghi`

```sql
create or replace function private.mt_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_duyet boolean; v_y1 int;
begin
  if v_me is null then return new; end if;                                   -- L6
  new.created_by := v_me;
  v_y1 := split_part(new.nam_hoc, '-', 1)::int;
  if new.bat_dau < make_date(v_y1, 7, 1) or new.ket_thuc > make_date(v_y1 + 1, 7, 31) then
    raise exception 'Ngày của mục tiêu phải nằm trong năm học %', new.nam_hoc using errcode = '23514';
  end if;
  v_duyet := duyet_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  if new.cap = 'em' and v_me <> new.student_id then
    new.nguoi_nhap_ho := v_me;                                               -- nhập hộ: dấu vết
    if new.trang_thai not in ('nhap','gui') then new.trang_thai := 'gui'; end if;  -- không tự có hiệu lực
  elsif v_duyet then
    if new.trang_thai is distinct from 'nhap' then new.trang_thai := 'duyet'; end if;
  elsif new.trang_thai not in ('nhap','gui') then
    raise exception 'Mục tiêu mới chỉ ở dạng nháp hoặc gửi duyệt' using errcode = '42501';
  end if;
  if new.trang_thai = 'duyet' then
    perform private.mt_kiem_tran(
      new.cap || ':' || coalesce(new.student_id::text, new.nhom_id::text, new.class_id::text, new.campus_id::text),
      new.nam_hoc, null);        -- KHÔNG new.chu_the_key: cột GENERATED còn NULL trong BEFORE INSERT (góp ý #3)
    new.duyet_boi := v_me; new.duyet_at := now();
  else
    new.duyet_boi := null; new.duyet_at := null;
  end if;
  if new.dang_tap_trung then
    perform private.mt_kiem_tap_trung(
      new.cap || ':' || coalesce(new.student_id::text, new.nhom_id::text, new.class_id::text, new.campus_id::text), null);
  end if;
  new.dong_boi := null; new.dong_at := null; new.ly_do_dong := null;
  return new;
end $$;
```
Hai hàm trần nhỏ (dùng cả ở `mt_truoc_sua`; `p_tru` = id bỏ qua):
`private.mt_kiem_tran(p_key, p_nam, p_tru)` → đếm `muc_tieu` cùng `chu_the_key`+`nam_hoc`
`trang_thai='duyet'` ≥ 4 → 23514 "Đã có 4 mục tiêu đang chạy — đóng bớt một cái trước";
`private.mt_kiem_tap_trung(p_key, p_tru)` → đếm `dang_tap_trung ∧ trang_thai <> 'dong'` ≥ 2 →
23514 "Đang tập trung 2 mục tiêu rồi — bỏ một cái trước nhé". `chu_the_key` GENERATED còn NULL
trong BEFORE INSERT nên khối trên TỰ GHÉP key từ cột gốc (đã sửa khớp — góp ý #3);
`mt_truoc_sua` (UPDATE) dùng `old.chu_the_key` đã stored. Không trigger BEFORE INSERT nào khác
được đọc cột generated của chính dòng đang chèn — luật chung, `ck_truoc_them` với
`tuan_ket_thuc` cũng vậy (10-SCHEMA §4.1).

```sql
create or replace function private.mt_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['trang_thai','duyet_boi','duyet_at','ly_do_tra_lai',
      'dong_boi','dong_at','ly_do_dong','dang_tap_trung','nguoi_nhap_ho','updated_at',
      'class_id','campus_id'];                                               -- L11
  v_doi boolean; v_ghi boolean; v_duyet boolean; v_key text;
begin
  if v_me is null then return new; end if;
  if (new.class_id is distinct from old.class_id or new.campus_id is distinct from old.campus_id)
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của mục tiêu chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_duyet := duyet_duoc_chu_the(new.cap, new.campus_id, new.class_id, new.nhom_id, new.student_id);
  v_key   := old.chu_the_key;

  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung mục tiêu của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    if old.trang_thai = 'dong' then
      raise exception 'Mục tiêu đã đóng, không sửa được nữa' using errcode = '42501';
    end if;
    if new.cap = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    -- Người sửa KHÔNG đồng thời là người duyệt-của-cấp → nội dung về 'gui' (nháp giữ nháp).
    -- (v_duyet ∧ v_ghi chỉ đúng với BGH-mục tiêu trường/lớp, GVCN-nhóm, GVCN-em ở lớp nhập hộ [H-16].)
    if not (v_duyet and v_ghi) and old.trang_thai in ('gui','duyet','tra_lai') then
      new.trang_thai := 'gui'; new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
    end if;
  end if;

  if old.trang_thai = 'dong' and new.trang_thai <> 'dong' and (select auth_role()) <> 'admin' then
    raise exception 'Mục tiêu đã đóng — muốn mở lại thì nhờ quản trị' using errcode = '42501';   -- [H-10]
  end if;

  if new.trang_thai is distinct from old.trang_thai
     and not (v_doi and new.trang_thai = 'gui' and old.trang_thai in ('gui','duyet','tra_lai')) then
    case new.trang_thai
      when 'duyet' then
        if not v_duyet then
          raise exception '%', case new.cap when 'lop' then 'Mục tiêu của lớp do ban giám hiệu duyệt'
                                            else 'Chỉ thầy cô chủ nhiệm mới duyệt được mục tiêu này' end
            using errcode = '42501';
        end if;
        perform private.mt_kiem_tran(v_key, new.nam_hoc, new.id);
        new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null;
      when 'tra_lai' then
        if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
        if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
          raise exception 'Trả lại thì phải ghi lý do để em biết sửa gì' using errcode = '23514';
        end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'gui' then
        if not v_ghi then raise exception 'Chỉ chủ mục tiêu mới gửi duyệt được' using errcode = '42501'; end if;
        new.duyet_boi := null; new.duyet_at := null;
      when 'nhap' then
        if not v_ghi or old.trang_thai not in ('gui','tra_lai') then
          raise exception 'Chỉ rút về nháp khi mục tiêu đang chờ duyệt hoặc bị trả lại' using errcode = '42501';
        end if;
        new.duyet_boi := null; new.duyet_at := null; new.ly_do_tra_lai := null;
      when 'dong' then
        if not (v_ghi or v_duyet) then
          raise exception 'Không có quyền đóng mục tiêu này' using errcode = '42501';
        end if;
        if new.ly_do_dong not in ('dat','doi','bo') then
          raise exception 'Đóng mục tiêu thì chọn: đã đạt, đổi mục tiêu khác, hay thôi không theo nữa'
            using errcode = '23514';
        end if;
        new.dong_boi := v_me; new.dong_at := now();
      else
        raise exception 'Trạng thái không hợp lệ' using errcode = '23514';
    end case;
  end if;

  if new.dang_tap_trung and not old.dang_tap_trung then
    perform private.mt_kiem_tap_trung(v_key, new.id);
  end if;
  -- Không ai nhét tay chữ ký: trạng thái không đổi (hoặc đổi sang đích không phải duyet/dong)
  -- thì chữ ký giữ nguyên giá trị cũ / giá trị đã null hoá ở nhánh trên.
  if new.trang_thai = old.trang_thai then
    new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;
    new.dong_boi := old.dong_boi;  new.dong_at := old.dong_at;
  end if;
  return new;
end $$;
```

`private.mt_ghi_lich_su_dich` (after update): `(x_so, y_so, ket_thuc)` đổi → insert `lich_su_dich`
(x/y/ket_thuc cũ-mới, `ai = auth.uid()`, `luc = now()`), return null.

`private.tp_sau_ghi` (after insert/update/delete on `thanh_phan`): người ghi không phải
`duyet_duoc_muc_tieu(muc_tieu_id)` và mục tiêu đang `duyet`/`tra_lai` → `update muc_tieu set
trang_thai = 'gui', duyet_boi = null, duyet_at = null` (thành phần là nội dung).

### 3.3 `thuoc` + `thuoc_lich_su` — duyệt MỘT lần, nội dung đông cứng theo `da_tung_duyet`

```sql
create or replace function private.th_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then return new; end if;
  new.created_by := v_me;
  if new.tu_tuan is null then new.tu_tuan := vn_week_start(); end if;
  new.trang_thai := 'chay'; new.da_tung_duyet := false;
  if new.chu_the = 'em' and v_me <> new.student_id then
    new.nguoi_nhap_ho := v_me; new.duyet := 'gui';
  elsif staff_can_manage_class(new.class_id) and new.chu_the in ('lop','nhom') and new.subject_id is null then
    new.duyet := 'duyet'; new.da_tung_duyet := true;                        -- [H-07]
  else
    new.duyet := 'gui';                                                     -- em; GVBM thước môn chờ GVCN [H-08]
  end if;
  if new.duyet = 'duyet' then new.duyet_boi := v_me; new.duyet_at := now();
  else new.duyet_boi := null; new.duyet_at := null; end if;
  perform private.th_kiem_tran(new);                                        -- trần ≤4 hàng/em, §3.3b
  return new;
end $$;

create or replace function private.th_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['trang_thai','cho_bu','den_tuan','duyet','duyet_boi',
      'duyet_at','ly_do_tra_lai','da_tung_duyet','nguoi_nhap_ho','updated_at','class_id'];
  v_doi boolean; v_ghi boolean; v_duyet boolean;
begin
  if v_me is null then return new; end if;
  new.duyet_boi := old.duyet_boi; new.duyet_at := old.duyet_at;   -- ép về old NGAY ĐẦU (góp ý #15):
  new.da_tung_duyet := old.da_tung_duyet;                         -- chỉ nhánh duyệt phía dưới mới được đổi
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của việc chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if (new.chu_the, new.student_id, new.nhom_id, new.subject_id)
     is distinct from (old.chu_the, old.student_id, old.nhom_id, old.subject_id) then
    raise exception 'Không đổi được chủ của việc — tạo việc mới' using errcode = '42501';
  end if;
  -- Đổi tên qua yêu cầu đã duyệt: cờ phiên + ĐÚNG MỘT cột đổi (điều kiện nội dung kèm cờ — L6)
  if coalesce(current_setting('va.doi_ten_qua_yeu_cau', true), '') = '1'
     and not private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung || array['ten']) then
    return new;
  end if;
  v_doi   := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ghi   := ghi_duoc_thuoc(new.id);
  v_duyet := duyet_duoc_thuoc(new.id);
  if v_doi then
    if not v_ghi then
      raise exception 'Thầy cô không sửa nội dung việc của em — góp ý rồi để em tự sửa' using errcode = '42501';
    end if;
    if old.da_tung_duyet then                                               -- đông cứng kể cả khi duyet='gui'
      raise exception 'Việc này thầy cô đã duyệt rồi. Muốn đổi chỉ tiêu thì đổi từ tuần sau; muốn đổi tên thì gửi yêu cầu cho thầy cô'
        using errcode = '42501';
    end if;
    if exists (select 1 from luot l where l.thuoc_id = new.id)
       and (new.cach_ghi, new.gop, new.chieu_dich, new.don_vi_id, new.pham_vi, new.ky_tuan, new.tu_tuan, new.nguong_moi_lan)
           is distinct from (old.cach_ghi, old.gop, old.chieu_dich, old.don_vi_id, old.pham_vi, old.ky_tuan, old.tu_tuan, old.nguong_moi_lan) then
      raise exception 'Đã có lượt ghi — kết thúc việc này và tạo việc mới' using errcode = '23514';
    end if;
    if old.duyet = 'tra_lai' then new.duyet := 'gui'; new.ly_do_tra_lai := null; end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
  end if;
  if new.duyet is distinct from old.duyet and not (v_doi and new.duyet = 'gui') then
    if new.duyet = 'duyet' then
      if not v_duyet then raise exception 'Chỉ thầy cô chủ nhiệm mới duyệt được việc này' using errcode = '42501'; end if;
      new.duyet_boi := v_me; new.duyet_at := now(); new.ly_do_tra_lai := null; new.da_tung_duyet := true;
      update thuoc_lich_su set trang_thai = 'hieu_luc', duyet_boi = v_me, duyet_at = now()
        where thuoc_id = new.id and trang_thai = 'cho_duyet';
    elsif new.duyet = 'tra_lai' then
      if not v_duyet then raise exception 'Chỉ người duyệt mới trả lại được' using errcode = '42501'; end if;
      if coalesce(btrim(new.ly_do_tra_lai), '') = '' then
        raise exception 'Trả lại thì phải ghi lý do' using errcode = '23514';
      end if;
      new.duyet_boi := null; new.duyet_at := null;
    elsif new.duyet = 'gui' then
      if not v_ghi then raise exception 'Chỉ chủ việc mới gửi duyệt được' using errcode = '42501'; end if;
    end if;
  end if;             -- không cần nhánh restore: đã ép về old ngay đầu hàm, kể cả ca (v_doi ∧ duyet='gui')
  if new.den_tuan is distinct from old.den_tuan and new.den_tuan is not null and new.den_tuan < vn_week_start() then
    raise exception 'Kết thúc việc sớm nhất là hết tuần này' using errcode = '23514';
  end if;
  if new.trang_thai is distinct from old.trang_thai and not (v_ghi or v_duyet) then
    raise exception 'Không có quyền tạm dừng hay đóng việc này' using errcode = '42501';
  end if;
  return new;
end $$;
```

**§3.3b Trần theo người** — `private.th_kiem_tran(t thuoc)`: đếm "hàng thước một em phải ghi"
(thước `em` + lớp/nhóm `tung_em` + môn, `trang_thai = 'chay'`); thước `em` → em ấy > 4 → 23514
"Đang theo dõi 4 việc rồi — kết thúc một việc trước nhé" (câu trung tính); thước lớp/nhóm
`tung_em` → đếm từng em bị ảnh hưởng, có em vượt → 23514 "Thêm việc này thì {n} em vượt 4 việc
phải ghi" (KHÔNG nêu tên). `ca_doi` và `tam_dung`/`dong` không tính.

**`thls_truoc_them`** (before insert): `tu_tuan` thứ Hai (CHECK có); khi uid ≠ null đòi
`tu_tuan >= vn_week_start() + 7` (23514 "Chỉ tiêu mới chỉ có hiệu lực từ tuần sau");
`nguoi_doi := coalesce(uid, nguoi_doi)`; `v_cu` = chỉ tiêu `hieu_luc` mới nhất trước `tu_tuan`
(mặc định `thuoc.chi_tieu_ky`); `la_ha` = dễ đi (`nhieu_nhat`: mới > cũ; khác: mới < cũ);
`v_so_lan_ha` = đếm dòng `la_ha ∧ trang_thai <> 'tu_choi'` từ 01/07 năm học [H-18]. Nếu uid null
hoặc `duyet_duoc_thuoc` → `hieu_luc` + chữ ký; elsif `la_ha` ∧ (|Δ|/nullif(|cũ|, 0) > 0.30 ∨ đã
hạ ≥ 1 lần) → `cho_duyet` + `update thuoc set duyet = 'gui'` (GIỮ
`duyet_boi/duyet_at/da_tung_duyet` — nội dung vẫn đông cứng, chỉ treo cờ chờ duyệt lại);
else `hieu_luc`. Chia 0 (góp ý #19): `nullif` làm vế tỉ lệ NULL khi chỉ tiêu cũ = 0 → vế ấy
không kích (không đổ 22012); vế "đã hạ ≥ 1 lần" vẫn đếm bình thường — hạ từ 0 không thể xảy ra
với `it_nhat` (số mới ≥ 0), còn kiêng nới trần từ 0 vẫn bị bắt ở lần nới thứ hai.

**`thls_truoc_sua`** (before update): nội dung đông cứng (`doi_noi_dung` với whitelist
`['trang_thai','duyet_boi','duyet_at']` → 42501 "Dòng thay đổi chỉ tiêu không sửa được — tạo dòng
mới"); chuyển trạng thái chỉ `cho_duyet → hieu_luc/tu_choi` bởi `duyet_duoc_thuoc` (42501); đặt
chữ ký; nếu hết dòng `cho_duyet` khác → `update thuoc set duyet = 'duyet' where id = … and duyet = 'gui'`.

**`thls_sau_xoa`** (after delete): dòng `cho_duyet` bị chủ rút mà không còn dòng `cho_duyet` nào
khác và `thuoc.duyet = 'gui'` ∧ `da_tung_duyet` → trả `duyet = 'duyet'` (chữ ký cũ còn nguyên).

### 3.4 `cam_ket` — `ck_truoc_them`, `ck_truoc_sua`

`ck_truoc_them` (before insert): L6; `created_by := uid`; nhập hộ ghi `nguoi_nhap_ho`; xoá sạch
`ket_qua/cham_boi/cham_at/so_dat/xong_at/goi_y` (không chấm lúc tạo); ép `trang_thai := 'hieu_luc'`;
kiểm em ghi danh active tại `class_id`; `thuoc_id`/`muc_tieu_id` (nếu có) thuộc CÙNG chủ thể
(của em, hoặc lớp/nhóm của em — mục tiêu `gui` neo được, lật #16); `pdr_meeting_id` ⇒
`pdr_meetings.student_id = new.student_id`; và **trần 2/tuần đếm THEO TỪNG TUẦN** (chốt C28):

```sql
  v_ket_thuc := new.tuan_bat_dau + (new.so_tuan - 1) * 7;      -- KHÔNG đọc cột generated trong BEFORE
  select max(so) into v_max from (
    select count(*) as so
    from generate_series(new.tuan_bat_dau, v_ket_thuc, interval '7 days') w
    join cam_ket k on k.trang_thai = 'hieu_luc' and k.id is distinct from new.id
       and k.chu_the = new.chu_the and k.class_id = new.class_id
       and k.student_id is not distinct from new.student_id
       and k.nhom_id is not distinct from new.nhom_id
       and w::date between k.tuan_bat_dau and k.tuan_bat_dau + (k.so_tuan - 1) * 7
    group by w) s;
  if coalesce(v_max, 0) >= 2 then
    raise exception 'Mỗi tuần chỉ nên giữ nhiều nhất 2 cam kết — ít mà chắc' using errcode = '23514';
  end if;
```

`ck_truoc_sua` (before update) — hợp nhất mọi vá của phản biện:

```sql
declare
  v_me uuid := (select auth.uid());
  v_khong_noi_dung constant text[] := array['ket_qua','cham_boi','cham_at','so_dat','xong_at',
      'goi_y','trang_thai','nguoi_nhap_ho','updated_at','class_id'];
  v_tu_pdr boolean := coalesce(current_setting('va.tu_pdr', true), '') = '1';
  v_doi boolean; v_ket_thuc date; v_cham_doi boolean;
begin
  if v_me is null and not v_tu_pdr then return new; end if;
  if new.class_id is distinct from old.class_id
     and coalesce(current_setting('va.doi_lop', true), '') <> '1' then
    raise exception 'Lớp của cam kết chỉ đổi khi em chuyển lớp' using errcode = '42501';
  end if;
  if v_tu_pdr then return new; end if;               -- pkl_sau_ghi tự đặt đủ bộ chấm — khe hẹp có điều kiện
  v_doi := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), v_khong_noi_dung);
  v_ket_thuc := new.tuan_bat_dau + (new.so_tuan - 1) * 7;
  if v_doi then
    if cam_ket_da_ke_lai(new.id) then
      raise exception 'Cam kết này đã được kể lại trong buổi họp nên không sửa được nữa' using errcode = '42501';
    end if;
    if old.ket_qua is not null then
      raise exception 'Cam kết đã chấm rồi — muốn sửa thì nhờ thầy cô' using errcode = '42501';
    end if;
    if new.chu_the = 'em' and v_me <> new.student_id then new.nguoi_nhap_ho := v_me; end if;
    if (new.tuan_bat_dau, new.so_tuan) is distinct from (old.tuan_bat_dau, old.so_tuan) then
      perform private.ck_kiem_tran_tuan(new);        -- đổi tuần thì đếm lại trần
    end if;
  end if;
  v_cham_doi := (new.ket_qua, new.so_dat, new.xong_at) is distinct from (old.ket_qua, old.so_dat, old.xong_at);
  if v_cham_doi then
    if new.chu_the = 'em' then
      if v_me <> new.student_id and not (is_class_teacher(new.class_id) and lop_nhap_ho(new.class_id)) then
        raise exception 'Em tự chấm Thắng/Thua cho cam kết của mình; thầy cô chỉ chấm cam kết của lớp'
          using errcode = '42501';
      end if;
    elsif not (is_class_teacher(new.class_id) or (select auth_role()) = 'admin') then
      raise exception 'Cam kết của lớp do thầy cô chủ nhiệm chấm' using errcode = '42501';
    end if;
    if cam_ket_da_ke_lai(new.id) then                -- ký là chốt — không chấm lại sau ký
      raise exception 'Cam kết này đã chốt trong buổi họp — muốn sửa thì nhờ thầy cô mở tuần' using errcode = '42501';
    end if;
    if new.ket_qua is not null and old.ket_qua is null then
      if coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today()) < v_ket_thuc + 4
         and new.xong_at is null then                -- đọc cùng GUC va.hom_nay với hai hàm lõi (C26, góp ý #10)
        raise exception 'Đợi đến thứ Sáu tuần cuối rồi chấm nhé' using errcode = '23514';
      end if;
      new.cham_boi := v_me; new.cham_at := now();
      select g.goi_y into new.goi_y
        from public.goi_y_cam_ket(new.id) g;         -- ảnh chụp gợi ý LÚC chấm; hàm trả BẢNG — không gán thẳng (góp ý #2)
      new.xong_at := coalesce(new.xong_at, now());
    elsif new.ket_qua is null and old.ket_qua is not null then
      new.cham_boi := null; new.cham_at := null; new.goi_y := null;
      new.so_dat := null; new.xong_at := null;       -- bỏ chấm (cùng người được chấm)
    else
      new.cham_boi := v_me; new.cham_at := now();    -- sửa so_dat/xong_at trên dòng đã chấm
    end if;
  else
    new.cham_boi := old.cham_boi; new.cham_at := old.cham_at; new.goi_y := old.goi_y;  -- chống giả chữ ký
  end if;
  if new.trang_thai = 'huy' and old.trang_thai <> 'huy'
     and (cam_ket_da_ke_lai(new.id) or old.ket_qua is not null) then
    raise exception 'Cam kết đã kể lại hoặc đã chấm thì không huỷ được' using errcode = '42501';
  end if;
  return new;
end
```

### 3.5 `cam_ket_xac_nhan` — `ckxn_dung_vai` (before insert): `nguoi_id := uid`; `vai` SUY từ quan
hệ (`is_class_teacher` → 'thay_co'; `is_my_child` → 'phu_huynh'; `is_my_buddy` → 'buddy'), không
tin cột gửi lên; không quan hệ nào → 42501.

### 3.6 `pdr_ke_lai` + `pdr_meetings`

```sql
create or replace function private.pkl_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pdr_meetings%rowtype; c cam_ket%rowtype;
begin
  select * into p from pdr_meetings where id = new.pdr_meeting_id;
  select * into c from cam_ket where id = new.cam_ket_id;
  if c.chu_the <> 'em' or c.student_id is distinct from p.student_id then
    raise exception 'Chỉ kể lại cam kết của chính em' using errcode = '23514';
  end if;
  if c.tuan_bat_dau > thu_hai_tu_nhan(p.week_label) then
    raise exception 'Cam kết này chưa bắt đầu, chưa kể lại được' using errcode = '23514';
  end if;
  if p.acknowledged_at is not null and (select auth.uid()) is not null then
    raise exception 'Biên bản đã ký, không kể lại thêm được' using errcode = '42501';
  end if;
  if new.so_dat is not null and c.so_hua is null then
    raise exception 'Cam kết này không hứa con số — chỉ chấm thắng/thua thôi' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.pkl_truoc_xoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is not null
     and exists (select 1 from pdr_meetings m where m.id = old.pdr_meeting_id and m.acknowledged_at is not null) then
    raise exception 'Biên bản đã ký — muốn sửa thì nhờ thầy cô mở tuần' using errcode = '42501';
  end if;
  return old;
end $$;

-- Câu 2 chốt → chép về cam_ket (cam_ket là nguồn duy nhất của kết quả; pdr_ke_lai là bản kể):
--   INSERT ket_qua null  → KHÔNG đụng cam_ket (không xoá điểm em tự chấm — "chưa biết" ≠ "bỏ chấm")
--   INSERT/UPDATE ket_qua ≠ null → chép sang, chữ ký = em
--   UPDATE ≠null → null (đổi ý trước khi ký) → xoá bản chép
create or replace function private.pkl_sau_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pdr_meetings%rowtype;
begin
  select * into p from pdr_meetings where id = new.pdr_meeting_id;
  perform set_config('va.tu_pdr', '1', true);
  if new.ket_qua is not null then
    update cam_ket set ket_qua = new.ket_qua, so_dat = coalesce(new.so_dat, so_dat),
           cham_boi = p.student_id, cham_at = now(),
           goi_y = (select g.goi_y from public.goi_y_cam_ket(new.cam_ket_id) g),
           xong_at = coalesce(xong_at, now())
     where id = new.cam_ket_id;
  elsif tg_op = 'UPDATE' and old.ket_qua is not null then
    update cam_ket set ket_qua = null, so_dat = null, cham_boi = null, cham_at = null,
           goi_y = null, xong_at = null
     where id = new.cam_ket_id;
  end if;
  perform set_config('va.tu_pdr', '', true);
  return null;
end $$;
```

`private.pdr_truoc_sua` (before update on `pdr_meetings`): L6; đã ký → đông cứng trừ admin
(42501 "Biên bản đã ký, không sửa được nữa"). Tính MỘT lần
`v_doi_sau_cau := private.doi_noi_dung(to_jsonb(old), to_jsonb(new), <mọi cột trừ q1..q6>)`.
(a) `v_me <> new.student_id` ∧ `v_doi_sau_cau`: nếu không (`is_class_teacher(new.class_id)` ∧
`lop_nhap_ho`) → 42501 "Chỉ em mới sửa được câu trả lời của mình"; hợp lệ thì
`new.nguoi_nhap_ho := v_me` — nhánh này chạy VÔ ĐIỀU KIỆN, không nằm trong nhánh ký (vá lỗ
buddy sửa-rồi-ký-hai-bước; policy §2.15 là lớp thứ hai). (b) Ký (`new.acknowledged_at` not null):
`acknowledged_by = v_me` bắt buộc (42501 "Chữ ký phải là của chính người bấm");
`pdr_chu_ky_hop_le(...)` (42501 "Chỉ em, hoặc bạn cùng nhóm ở lớp được nhập hộ, mới ký được biên
bản"); người ký ≠ em ∧ `v_doi_sau_cau` → 42501 "Bạn chỉ ký, không sửa câu trả lời của bạn".

### 3.7 `edit_requests` — áp dụng khi duyệt, có kiểm đích + dấu vết

`private.er_truoc_sua` (before update): (a) `status` rời `pending` → `resolved_by := uid`,
`resolved_at := now()` (app không tự điền); (b) vá policy update 0048 (requester sửa được lúc
pending): khi `old.status = 'pending'` và người gõ không có `staff_can_manage_class(class_id)`,
bộ `(student_id, class_id, kind, ref_id, tuan)` đổi → 42501 "Muốn đổi nội dung yêu cầu thì rút
rồi gửi lại" — chặn em A biến yêu cầu hợp lệ thành `mo_tuan_da_ky` mang tên em B (góp ý #8).

```sql
create or replace function private.er_sau_duyet() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_th thuoc%rowtype;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.kind = 'doi_ten_thuoc' then
      select * into v_th from thuoc where id = new.ref_id;
      if v_th.id is null or v_th.class_id is distinct from new.class_id
         or (v_th.chu_the = 'em' and v_th.student_id is distinct from new.student_id) then
        raise exception 'Yêu cầu này không trỏ vào việc của đúng lớp/đúng em' using errcode = '23514';
      end if;
      perform set_config('va.doi_ten_qua_yeu_cau', '1', true);
      update thuoc set ten = btrim(new.message) where id = new.ref_id;
      perform set_config('va.doi_ten_qua_yeu_cau', '', true);
    elsif new.kind = 'mo_tuan_da_ky' then
      insert into luot_mo_khoa (student_id, class_id, week_start, mo_boi, mo_at, het_han, edit_request_id)
      values (new.student_id, new.class_id, new.tuan,
              coalesce(new.resolved_by, (select auth.uid())), now(), now() + interval '48 hours', new.id);
      perform log_audit('mo_tuan_da_ky', jsonb_build_object('edit_request', new.id, 'tuan', new.tuan));
    end if;                                          -- 'rename_lead' cũ: app cũ tự áp, trigger không đụng
  end if;
  return null;
end $$;
```
Cửa sổ 48 giờ: đủ một tối + một buổi học, tự đóng không cần ai bấm; GVCN đóng sớm qua §2.11.
Vì `tuan` do người xin chỉ đích danh, cả tuần-fallback của biên bản rỗng cũng mở được (vá lỗ
"khoá vĩnh viễn").

## 4. Hàm gộp trả số — nguyên tắc (thân hàm ở 30-PHEP-TINH §4)

1. `public`, `security definer`, **gác quyền trong WHERE cuối câu**; sai vai → 0 dòng, không lỗi.
2. Trả số đếm/tổng/%; KHÔNG trả `student_id[]`/tên/nội dung của em khác; tên chỉ sau
   `staff_can_read_class`.
3. Mẫu số luôn là SĨ SỐ GHI DANH đang học (hoặc số thành viên nhóm) — không phải số em có dòng.
4. Nhóm nhỏ: `si_so < 3` và người gọi là học sinh → `tong/trung_binh` trả null (giữ `so_dat/si_so`
   dạng "x/2 bạn đủ") — dòng thô không đội lốt số đếm (L7).
5. `viec_bang`/`bang_ron` gác `p_student = (select auth.uid()) or can_view_student(p_student)` —
   `can_view_student` production KHÔNG có nhánh tự xem mình (vá lỗ màn em trống).
6. Hai hàm lõi `private.gia_thuoc`/`so_hien_tai` KHÔNG gác (chỉ tính) — revoke đủ ba vai, chỉ
   hàm/view public đã gác gọi chúng; `private` không có endpoint PostgREST.

## 5. Sổ câu lỗi tầng quyền (P0001 hiện nguyên câu qua `friendlyError`)

| errcode | Câu | Ở đâu |
|---|---|---|
| 42501 | Thầy cô không sửa nội dung mục tiêu của em — góp ý rồi để em tự sửa | §3.2 |
| 42501 | Mục tiêu của lớp do ban giám hiệu duyệt / Chỉ thầy cô chủ nhiệm mới duyệt được mục tiêu này | §3.2 |
| 23514 | Trả lại thì phải ghi lý do để em biết sửa gì | §3.2 |
| 42501 | Mục tiêu đã đóng — muốn mở lại thì nhờ quản trị | §3.2 |
| 23514 | Đã có 4 mục tiêu đang chạy — đóng bớt một cái trước | §3.2 |
| 42501 | Việc này thầy cô đã duyệt rồi. Muốn đổi chỉ tiêu thì đổi từ tuần sau; muốn đổi tên thì gửi yêu cầu cho thầy cô | §3.3 |
| 23514 | Chỉ tiêu mới chỉ có hiệu lực từ tuần sau | §3.3 |
| 42501 | Không đổi được chủ của việc — tạo việc mới | §3.3 |
| 23514 | Mỗi tuần chỉ nên giữ nhiều nhất 2 cam kết — ít mà chắc | §3.4 |
| 42501 | Em tự chấm Thắng/Thua cho cam kết của mình; thầy cô chỉ chấm cam kết của lớp | §3.4 |
| 23514 | Đợi đến thứ Sáu tuần cuối rồi chấm nhé | §3.4 |
| 42501 | Cam kết này đã chốt trong buổi họp — muốn sửa thì nhờ thầy cô mở tuần | §3.4 |
| 23514 | Cam kết này không hứa con số — chỉ chấm thắng/thua thôi | §3.6 |
| 42501 | Biên bản đã ký, không sửa được nữa / Chữ ký phải là của chính người bấm / Bạn chỉ ký, không sửa câu trả lời của bạn | §3.6 |
| (0 dòng im lặng) | App tự nói: "Chỉ ghi được trong 7 ngày gần nhất — nhờ thầy cô ghi giúp" · "Tuần này đã chốt trong buổi họp với bạn — cần sửa thì nhờ thầy cô mở lại". Biết lý do bằng cách gọi `trong_cua_so_ghi(ngay)` và `luot_bi_khoa(uid, ngay)` trước khi mở ô | màn em |
