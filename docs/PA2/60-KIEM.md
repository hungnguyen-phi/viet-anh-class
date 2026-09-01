# 60-KIEM — Hợp đồng kiểm cho PA2 (bản chốt)

Vì sao bộ kiểm được viết TRƯỚC mã: CLAUDE.md §6 — "một phép kiểm luôn xanh là một phép kiểm vô
dụng", và audit 18/08 chứng minh lỗ nằm ở chỗ không ai nhìn (view mất invoker, overload quên
revoke). Bản chốt này đã vá chính các CỔNG bị phản biện bắt: khối quét ACL đổi sang `unnest`
(mẫu LIKE cũ để PUBLIC-grant giữa chuỗi lọt qua), khung test grant thêm SEQUENCE (thiếu là mọi
tệp đổ ở dòng ghi kết quả đầu tiên), regex từ cấm chuẩn NFC + tự kiểm bằng chuỗi mồi, phép TL
dồn cuối tệp (ACCESS EXCLUSIVE giữ tới rollback — không treo bảng production), và mọi kỳ vọng đã
KHỚP bản chốt 00→50 (buddy đọc cam kết = có, cả lớp đọc dòng nhóm = có, thuoc hai cột trạng
thái, `score_category` GIỮ, đổi lớp theo "tuần mở ∧ chưa chấm"). Mảng khác để móc `data-kiem` và
hàm đúng tên ở đây gọi tới; lệch tên thì bảng chốt 00 §3 đúng.

## 0. Luật chung của MỌI bài kiểm

| # | Luật |
|---|---|
| 0.1 | Chỉ dựng cảnh trên lớp `Test`; tài khoản `agent1…4@test.truongvietanh.com`, GVCN `tunhien01@`, HS `test1.hs@`; thêm `agent-ph@test.truongvietanh.com` (vai parent, `parent_links` → agent1). Không đụng alex@, claudia@, lớp thật |
| 0.2 | Mọi `test-*.sql` = MỘT transaction `begin … rollback`, mở đầu `set local lock_timeout = '3s'; set local statement_timeout = '90s';` |
| 0.3 | Mỗi luật ba mặt: đường vui · chặn · chiều ngược (0.5) |
| 0.4 | Đóng vai bằng `set local role authenticated` + `set_config('request.jwt.claims', …, true)`; KHÔNG kiểm luật bằng service_role. **Luật TRẦN (≤4 mục tiêu, ≤4 thước, ≤2 cam kết) kiểm DƯỚI VAI EM** — trigger có nhánh uid-null (L6) nên dựng bằng postgres sẽ lọt oan |
| 0.5 | Chiều ngược hai dạng: (i) luật RLS → ĐC: cùng câu chạy lại bằng `reset role` phải LỌT; (ii) luật trigger/CHECK/unique → TL: `alter table … disable trigger` / `drop constraint` trong savepoint rồi chạy lại phải LỌT. **MỌI phép TL dồn về CUỐI TỆP ngay trước rollback, mỗi phép một savepoint, tổng từ TL đầu tới rollback < 5 giây** (ACCESS EXCLUSIVE giữ tới cuối transaction); hết `lock_timeout` → ghi `BỎ QUA (bảng bận)`, không HỎNG |
| 0.6 | Cảnh dựng ở tuần xa (`vn_week_start()+84`) cho thứ không phụ thuộc hôm nay; hàm đọc ghim mốc bằng GUC **`va.hom_nay`** (chốt C26) — set trong transaction test, production không ai set. NGOẠI LỆ có ghi nhận: bộ véc-tơ 30 §5 dùng quá khứ (cần kỳ đã đóng), neo `T0 = greatest(−91 ngày, đầu năm học)` |
| 0.7 | Không in tên/email/nội dung tự do của học sinh ra stdout — bảng `kq` chỉ chứa đếm, trạng thái, mã lỗi |
| 0.8 | Script `.mjs` đăng nhập magic link qua `token_hash`, CHẶN `generateLink` cho email chưa có hồ sơ; script agent GHI bắt buộc truyền `BASE` tường minh, từ chối production nếu thiếu `--production` |
| 0.9 | Giao diện kết luận bằng ẢNH (kèm phiếu §3.6); số đo chỉ khoanh vùng |
| 0.10 | Kết mỗi bài bằng hai SELECT chuẩn (`ket/buoc/chi_tiet` + `tong_ket/tat_ca_dat`); bộ chạy tổng đọc result set cuối qua `pg`, không parse stdout |
| 0.11 | Khung đầu tệp dưới đây chép NGUYÊN VĂN |
| 0.12 | Migration "mỗi tệp tự begin/commit" có HAI ngoại lệ: 0160 (một câu revoke) và 0161 (một câu alter type) — bài kiểm idempotent bỏ qua hai tệp này |

### 0.11 Khung đầu tệp chung

```sql
-- <TÊN LUẬT> (016x) — npm run sql -- scripts/test-<viec>.sql — tự rollback, ba mặt (60-KIEM §0.5)
begin;
set local lock_timeout = '3s';
set local statement_timeout = '90s';
create table kq (stt serial, buoc text, mong_doi text, thuc_te text, dat boolean);
grant all on kq to authenticated;
grant usage, select on sequence kq_stt_seq to authenticated;   -- serial cần sequence — thiếu là 42501 ngay dòng ghi đầu
create function pg_temp.vai(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); $$;
create function pg_temp.ghi(b text, m text, t text, d boolean) returns void language sql as $$
  insert into kq (buoc, mong_doi, thuc_te, dat) values (b, m, t, d); $$;
create function pg_temp.thu(cau text, out so int, out loi text) language plpgsql as $$
begin execute cau; get diagnostics so = row_count; loi := null;
exception when others then so := -1; loi := sqlstate || ' ' || sqlerrm; end $$;
create table ai as
select c.id as lop, c.campus_id as co_so, c.homeroom_teacher_id as gvcn,
       (array(select e.student_id from enrollments e join profiles p on p.id = e.student_id
              where e.class_id = c.id and e.is_active and p.role = 'student'
                and p.email like 'agent%@test.truongvietanh.com' order by p.email))[1:4] as em,
       (select p.id from profiles p where p.role = 'principal' and p.campus_id = c.campus_id order by p.email limit 1) as bgh,
       (select p.id from profiles p where p.role = 'admin' order by p.email limit 1) as admin,
       (select p.id from profiles p where p.email = 'agent-ph@test.truongvietanh.com') as ph,
       vn_week_start(vn_today()) + 84 as tuan_xa, vn_today() as hom_nay
from classes c where c.name = 'Test' and c.is_active limit 1;
grant all on ai to authenticated;
do $$ begin
  if (select array_length(em,1) from ai) < 4 then raise exception 'Cần 4 agent trong lớp Test: node scripts/agent-hoc-sinh.mjs tao'; end if;
  if (select gvcn from ai) is null then raise exception 'Lớp Test chưa có GVCN'; end if;
end $$;
-- … thân bài … (mọi phép TL dồn xuống CUỐI, trước hai SELECT kết)
reset role;
select case when dat then 'ĐẠT ' else 'HỎNG' end as ket, buoc,
       'mong đợi ' || mong_doi || ', thực tế ' || thuc_te as chi_tiet from kq order by dat, stt;
select count(*) filter (where dat) || '/' || count(*) || ' đạt' as tong_ket, bool_and(dat) as tat_ca_dat from kq;
rollback;
```
Cần "lớp khác": KHÔNG dùng lớp thật — trong transaction dựng
`insert into classes (name, campus_id, is_active, homeroom_teacher_id) values ('KIEM lop 2', co_so, true, <agent hoặc tunhien01 tạm>)`
rồi rollback dọn (0.1); vai "GVCN lớp khác" đóng bằng chủ nhiệm lớp giả ấy.

## 1. Bộ `test-*.sql` — mỗi policy một vai, mỗi luật một chiều ngược

Kỳ vọng dưới đây KHỚP bản chốt (không còn [KHỚP] treo). ĐC/TL/CM theo §0.5; CM = thêm cột mới
trong transaction để chứng minh whitelist.

### 1.1 `test-pa2-don-vi-tuan-hoc-nhom.sql` (0162)
Mọi authenticated đọc `don_vi` ≥1, anon 0 (ĐC) · em insert `don_vi` → 0 dòng; GVCN insert → 1
(H-17) · BGH insert `tuan_hoc` cơ sở mình 1, cơ sở khác 0 (ĐC); `week_start` không thứ Hai →
23514 (TL) · em đọc `tuan_hoc` cơ sở mình (profile campus null, suy qua ghi danh) → n · GVCN
tạo `nhom` 'to' → 1; sửa nhóm 'buddy' → 42501 (TL trigger); em[3] tự thêm mình vào nhóm → 0 (ĐC)
· `tao_buddy_nhom` chiếu cặp buddy — gọi RPC rồi đối chiếu (KHÔNG kỳ vọng trigger tự chạy) ·
mẫu thứ 9 của `muc_tieu_mau` → 23514 (TL).
Ba phép CHUYỂN TỆP vì cần đối tượng 0164+ (góp ý #14) — bài 1.1 nhờ đó chạy trọn ngay sau 0162:
"tuần `nghi`: em ghi `luot` VẪN LỌT" → §1.9; hai phép "đơn vị chỉ là nhãn" → §1.8: đổi `nhan_vi`
đơn vị đang dùng → `gia_thuoc`/`so_hien_tai` KHÔNG đổi, và GỠ dây `gop_so` rồi NỐI LẠI với
`he_so` 0.5 → `so_hien_tai` ĐỔI theo (dây không sửa tại chỗ — 20 §2.16; chứng minh quy đổi đi
qua DÂY, không qua chuỗi tên đơn vị).

### 1.2 `test-pa2-muc-tieu-rang-buoc.sql` (0163) — CHECK, dựng bằng postgres (CHECK ràng cả postgres)
14 dòng theo tên constraint 10-SCHEMA §2.1: (1) toi, y=8, x null, chua_do_x=false → văng
`mt_y_can_x_ck`; (2) + chua_do_x=true → lọt; (3) toi tang 8→6 → văng `mt_chieu_thuan_ck`;
(4) toi giam 8→6 → lọt; (5) giu 8=8 → lọt; (6) toc_do_ky, ky null → văng `mt_ky_can_ck`;
(7) nguon_so='con', cap='em' → văng; (8) con, cap='lop', gop_con null → văng; (9) x=0, y=0,
tran_tich_luy, chieu='giu' → **LỌT** (đích 0 là số thật); (10) chu, x/y null, y_chu có → lọt;
(11) hai mục tiêu cùng lĩnh vực cùng em → **LỌT**; (12) `bat_dau > ket_thuc` → văng; (13)
ti_le_dat, lay_tu null → văng; (14) thanh_phan, gop_thanh_phan null → văng `mt_gop_tp_ck`.
Chiều ngược: TL từng constraint. Trần ≤4 duyet + ≤2 tập trung + "ngoài năm học" (trigger) kiểm ở
1.4 DƯỚI VAI (0.4).

### 1.3 `test-pa2-muc-tieu-quyen.sql` — RLS bốn cấp
Ma trận vai × thao tác (mỗi ô một `pg_temp.thu`; mọi ô 0 có ĐC):

| Thao tác | em chính | em khác cùng lớp | PH của em | PH em khác | GVCN | GVCN lớp giả | BGH cùng CS | BGH khác CS | anon |
|---|---|---|---|---|---|---|---|---|---|
| đọc mt cap='em' của em[1] | 1 | 0 | 1 | 0 | 1 | 0 | 1 [H-13] | 0 | 0 |
| đọc mt cap='lop' | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| đọc mt cap='truong' | 1 [H-11] | 1 | 1 | — | 1 | 1 (cùng CS) | 1 | 0 | 0 |
| đọc mt cap='nhom' (em1,em2 trong nhóm) | 1 | **em[3] = 1** (chốt C24) | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| insert cap='em' student=em[1] | 1 | 0 (giả student_id em[1]) | 0 | 0 | 0 (trừ nhap_ho — 1.15) | 0 | 0 | 0 | 0 |
| insert cap='lop' | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| insert cap='truong' | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| em[1] update student_id → em[2] (mt của mình) | 0 dòng (WITH CHECK cột dòng mới) | | | | | | | | |

### 1.4 `test-pa2-muc-tieu-duyet.sql` — vòng duyệt + whitelist
Em insert 'duyet' → ép về 'gui' (TL) · em update → 'duyet' → 42501 (TL) · GVCN duyệt mt em → 1,
`duyet_boi/duyet_at` đặt · GVCN sửa `ten` mt em đã duyệt → 42501 (TL `trg_mt_truoc_sua`) · em
sửa `y_so` sau duyệt → về 'gui', `duyet_boi` null, `lich_su_dich` +1 · em sửa
`chieu/kieu_dich/nguon_so/gop_con/don_vi_id` sau duyệt → về 'gui' (nhóm 0151 từng sót) · GVCN
trả lại không lý do → 23514; có lý do → em đọc được `ly_do_tra_lai` · em đóng 'dong'/'dat' → 1,
KHÔNG về 'gui'; em MỞ LẠI mt 'dong' → 42501, admin → 1 [H-10] · **CM**: `alter table muc_tieu
add column kiem_cot_moi text` trong transaction, em sửa nó sau duyệt → về 'gui' (cột mới tự là
nội dung — nếu trigger viết blacklist thì phép này HỎNG) · GVCN duyệt mt LỚP mình tạo → 42501
(0148); BGH duyệt → 1 · BGH sửa `ten` mt trường mình → GIỮ 'duyet' (người duyệt = người ghi),
`lich_su_dich` +1 · em rút về nháp kèm `duyet_boi` giả → cột vẫn null · TRẦN dưới vai em: mt thứ
5 'duyet' → 23514; thứ 5 ở 'nhap' → lọt; `dang_tap_trung` thứ 3 → 23514; `ket_thuc` ngoài năm
học → 23514 · uid null (reset role) update nội dung → lọt không đổi trạng thái (0135).

### 1.5 `test-pa2-so-do.sql`
Em ghi hôm nay → 1, `nguoi_ghi` = em · ghi bù `hom_nay − 20` → 1 (không trần [H-20]) · ngày mai
→ 23514 "Chưa tới ngày đó mà" (TL) · `gia_tri = 0` → 1 · em ghi vào mt lớp → 0 (ĐC) · GVCN ghi mt
lớp (student null) → 1; GVCN ghi mt EM lớp thường → 0 (ĐC) · em[2] đọc so_do em[1] → 0 (ĐC) · PH
em[1] đọc → n, PH khác → 0 · ghi vào mt `nguon_so='thuoc'` → 23514 "máy tự cộng" (TL) · mt
`thanh_phan`: thiếu `thanh_phan_id` → 23514; 4 dòng 4 phần → `so_hien_tai` gộp đúng (V-M-14) ·
em insert `nguon='he_thong'` → 42501 (TL) · sửa dòng `created_at` 8 ngày trước (postgres dựng)
→ 0 dòng (ĐC).

### 1.6 `test-pa2-thuoc-rang-buoc.sql` — CHECK + trần
(1) cham, moi_lan null → văng; (2) dem_dat_nguong, nguong null → văng; (3) moi_nhat ×
nhieu_nhat → lọt; (4) ky_tuan 3 → văng; (5) ngay_ap_dung '{}' → văng, '{1,3,5}' lọt; (6)
tu_tuan > den_tuan → văng; (7) khoá chủ thể sai → văng; (8) ca_doi + chu_the em → văng; (9)
TRẦN dưới vai: em[1] có 2 thước riêng chay + 2 thước lớp tung_em → thêm riêng thứ 3 → 23514
nêu "4"; (10) GVCN thêm thước lớp tung_em thứ 3 → 23514 nêu SỐ em vướng, KHÔNG tên; (11) thước
lớp `ca_doi` thứ 3 → lọt; (12) đóng 1 thước riêng rồi thêm → lọt (dong không tính trần); (13)
GVBM thêm thước môn thứ 2 cùng lớp → văng unique `thuoc_mon_uidx`; thước môn TÍNH vào trần 4
của em; (14) `ten` không bắt đầu động từ → LỌT ở CSDL (cảnh báo mềm UI). TL từng luật ở cuối.

### 1.7 `test-pa2-thuoc-duyet-mot-lan.sql` — hai cột + `da_tung_duyet`
Em tạo → `trang_thai='chay'`, `duyet='gui'` · em ghi lượt khi 'gui' → 1 (H-09) · em tự
`duyet='duyet'` → 42501 · GVCN duyệt → `duyet='duyet'`, `da_tung_duyet=true` · **GVCN tạo thước
LỚP → `duyet='duyet'` NGAY (chốt C11/H-07); GVCN duyệt thước MÔN của GVBM → 1 (H-08)** · em sửa
`chi_tieu_ky` trực tiếp sau duyệt → 42501 · em thêm `thuoc_lich_su` tu_tuan = tuần này → 23514;
tuần sau hạ 10% → 'hieu_luc'; hạ lần 2 → 'cho_duyet' ∧ `thuoc.duyet='gui'`; hạ 40% lần đầu →
'cho_duyet' · **khi 'gui' vì hạ: em sửa `ten`/`chi_tieu_ky` trực tiếp → VẪN 42501
(da_tung_duyet — vá lách vòng duyệt)**; em xoá dòng cho_duyet của mình → thuoc.duyet TRỞ VỀ
'duyet' (thls_sau_xoa) · GVCN duyệt dòng cho_duyet → 'hieu_luc' ∧ thuoc 'duyet' · `chi_tieu_tai`
với dòng cho_duyet → dùng số CŨ (V-T-09c) · em update `student_id` thước mình → em[2] → 42501
"Không đổi được chủ của việc" · GVBM tạo thước môn → 'gui'; GVBM khác môn đọc → 0 · BGH insert
thước lớp → 0 dòng (chốt C23, ĐC) · em[2] đọc thước riêng em[1] → 0; thước lớp tung_em → 1;
ca_doi → 1 · xoá thước có lượt → 23503 (TL).

### 1.8 `test-pa2-noi.sql`
Em nối thước riêng →(chi_huong)→ mt riêng → 1 · cùng con → mt thứ 2 chi_huong → 1 · em nối
gop_so thước riêng (cùng đơn vị) → mt riêng nguon_so='thuoc' → 1 · dây gop_so thứ 2 cùng con →
văng unique (TL drop index) · gop_so khi cha `nguon_so='ghi_tay'` → 23514 (TL) · gop_so khi con
là thước mà cha nguon_so='con' → 23514 · **em nối `chi_huong` lên mt LỚP → 1 (chốt C15)**; em
nối `gop_so` lên mt lớp → 0 dòng (ĐC) · GVCN nối gop_so mt em (duyet) → lớp → 1; BGH → trường
→ 1 · dây gop_so từ thước `moi_nhat` khi cha đã có dây khác → 23514 "nguồn duy nhất" · mt lớp
nối gop_so mt lớp khác (cùng cấp) → 23514 "cấp thấp lên cấp cao" (TL — chống vòng) · insert
`noi_tu_dong=true, vai='gop_so'` giả máy → 42501 (TL) · em[2] đọc dây em[1] → 0 (ĐC) · gop_so
khi con `duyet='gui'` → 1 (dây tạo được, số chưa cộng — V-M-09 con 'gui' không tính).

### 1.9 `test-pa2-luot-cua-so-va-khoa.sql` — bảng nhạy nhất
Cảnh: thước riêng cham {1..7} của em[1]; thước lớp tung_em; ca_doi; kiêng. em[1]–em[2] buddy.

| # | Phép | Mong đợi |
|---|---|---|
| 1–5 | em ghi hôm nay / −6 / −7 / +1 / gia_tri 0 | 1 / 1 / 0 dòng (ĐC) / 0 (ĐC) / 1 |
| 6 | gia_tri −1 | 23514 (TL CHECK) |
| 7 | lượt thứ 2 cùng ngày stt 2 → 1; trùng (thuoc, chu_the_key, ngay, stt) → văng unique (TL) | |
| 8 | gia_tri 999 cho cham | LỌT (cảnh báo mềm — lật #14) |
| 9–11 | em ghi thước lớp tung_em → 1 (student=em); em ghi ca_doi → 0 (ĐC); GVCN ghi ca_doi student null → 1 | |
| 12 | em ghi vào thước riêng em[2] | 0 (ĐC) |
| 13 | ngày ngoài ngay_ap_dung, cho_bu=false → 23514; cho_bu=true → 1 (TL) | |
| 14 | KHOÁ: dựng cam kết tuần này em[1] + biên bản buddy + `pdr_ke_lai(ket_qua='thang')` + em[1] ký → em ghi `v_ngay = greatest(tuan_bat_dau, hom_nay−1)` | 0 dòng (ĐC) — thứ Hai thì v_ngay = hom_nay, dựng lượt TRƯỚC lúc ký rồi kiểm SỬA/XOÁ thay vì ghi (ghi chú trong tệp, không BỎ QUA oan) |
| 15 | ngày cùng tuần > ngày ký (nếu hôm nay < CN) | 1 — CN thì `BỎ QUA` |
| 16 | em ghi tuần này vào thước KHÔNG trong cam kết đã kể | 0 (khoá theo TUẦN [H-14]) |
| 17 | sửa/xoá lượt tuần đã ký | 0 (ĐC) |
| 18 | cô gõ `acknowledged_by = gvcn` → 42501; **cô gõ `acknowledged_by = em[1]` → 42501** (L8/C22 — "chữ ký của chính người bấm") | TL |
| 19 | biên bản CHƯA ký → ghi bù bình thường | 1 |
| 20 | GVCN ghi hộ vào tuần ĐÃ ký | 0 (ĐC — không vượt chữ ký) |
| 21 | GVCN ghi hộ ngày −20 (quá 7 ngày, lớp THƯỜNG) | **1** (chốt C25 — ghi hộ không cửa sổ, không cần nhap_ho) |
| 22 | em gửi `edit_requests(mo_tuan_da_ky, tuan=T)` → GVCN duyệt → +1 `luot_mo_khoa` het_han ≈ +48h → em sửa lượt tuần T → 1; GVCN `update het_han=now()` → em sửa → 0; em tự insert `luot_mo_khoa` → 0; audit có 'mo_tuan_da_ky' không kèm tên | TL trigger `er_sau_duyet` |
| 23 | biên bản RỖNG (không pdr_ke_lai) ký → tuần liền trước khoá; duyệt mo_tuan_da_ky với `tuan` = tuần đó → mở được | vá "khoá vĩnh viễn" |
| 24 | em A gửi edit_request mang `student_id = B` | 0 dòng (policy §2.15) |
| 25 | **VƯỢT KHOÁ QUA CAM KẾT**: em sửa `tuan_bat_dau/so_tuan` của cam kết ĐÃ kể lại trong biên bản ký → 42501; em XOÁ cam kết đã kể lại → văng FK restrict; em xoá `pdr_ke_lai` sau ký → 42501 (TL `pkl_truoc_xoa`); em chấm lại `ket_qua` sau ký → 42501 | ba cửa cùng đóng |
| 26 | anon select/insert luot | 0 (ĐC) |

### 1.10 `test-pa2-cam-ket.sql`
Em tạo so_tuan 1, không neo → 1, `hieu_luc` ngay, không cột duyệt · neo mt 'gui' → 1 (lật #16) ·
so_tuan 5/0 → văng · **trần THEO TUẦN: A(t1–t2) + B(t3–t4) có sẵn → C(t1–t4) LỌT; D thêm phủ t1
→ 23514** (chốt C28, TL) · so_hua không đơn vị → văng `ck_don_vi_ck` · em chấm 'thang' TRƯỚC thứ
Sáu tuần cuối → 23514 "Đợi đến thứ Sáu"; có `xong_at` → chấm được ngay; tới thứ Sáu (ghim GUC)
→ 1, `cham_boi` = em, **`goi_y` được chụp** · em[2] chấm của em[1] → 0 (ĐC) · GVCN chấm cam kết
EM → 42501 (TL); GVCN chấm cam kết LỚP → 1; BGH chấm cam kết lớp → 0 dòng (chốt C23) · em sửa
`noi_dung` sau khi ĐÃ CHẤM → 42501 (khoá sau chấm); 'huy' sau chấm/kể lại → 42501 · em BỎ CHẤM
(ket_qua → null, chưa kể) → 1, `cham_*`/`goi_y`/`so_dat` về null · sửa lén `cham_boi` không đổi
ket_qua → bị ghi đè giá trị cũ · `cam_ket_xac_nhan`: em[2] buddy → 1 với `vai='buddy'` DÙ gửi
'thay_co' (trigger suy vai); em[3] không buddy → 0; GVCN → 1 'thay_co'; PH em[1] → 1; PH khác →
0; em tự xác nhận → 0 · `pdr_ke_lai`: em[1] kể cam kết mình → 1; của em[2] → 23514; `so_dat` khi
cam kết không `so_hua` → 23514; kể `ket_qua=null` khi em ĐÃ tự chấm 'thang' → cam_ket GIỮ
'thang'; UPDATE 'thang'→null trước ký → cam_ket bị xoá kết quả · **em[2] (buddy) đọc cam kết
em[1] → 1 [H-12]; em[3] → 0; PH em[1] → 1; qua `cam_ket_v` buddy thấy `goi_y_may` nhưng
`so_dat_goi_y` = null** (V-G-10).

### 1.11 `test-pa2-nhap-ho.sql` — khối 1–3
Lớp chưa bật: GVCN insert mt/thước/cam kết cấp em → 0 (ĐC) · admin bật `classes.nhap_ho` → 1;
**BGH cùng cơ sở bật → 1 [H-15]; GVCN bật → 42501** (TL protect_class) · GVCN nhập mt cho em →
`nguoi_nhap_ho`=GVCN, trang_thai='gui'; GVCN duyệt luôn → OK [H-16]; `ty_le_em_tu_dat` đếm
`so_nhap_ho`=1 · GVCN gõ sáu câu biên bản → `nguoi_nhap_ho` = GVCN; **GVCN gõ sáu câu ở lớp
KHÔNG bật → 42501** (vá pdr_truoc_sua) · buddy sửa q3 KHÔNG kèm ký → 42501/0 dòng (policy đòi
acknowledged_at not null); buddy ký sạch → 1, `acknowledged_by` = buddy; buddy ký kèm sửa q3 →
42501 · biên bản nhập hộ chưa ký → không khoá lượt · tắt cờ → mọi phép nhập hộ về 0/42501.

### 1.12 `test-pa2-hub-luot.sql`
Em ghi lượt thước cham it_nhat có dây chi_huong → outbox +1: `source_table='luot'`, payload đủ
`student_id, class_id, area, lead_title, logged_date, value, nguoi_ghi` (7 khoá, KHÔNG hơn) ·
không dây → `area` JSON null · lĩnh vực 'khac' → null · ca_doi → 0 · kiêng → 0; cùng lượt ở
thước it_nhat → 1 (ĐC thay TL) · `moi_nhat` → 0 · **thước `he_thong` nhận lượt từ trigger điểm
danh → 0 dòng outbox** (không đếm đôi) · `gia_tri = 0` → 0 · GVCN ghi hộ → `nguoi_ghi` = gvcn ≠
`student_id` · update/delete lượt → không thêm dòng · **chiều ngược dạng TL**: savepoint, disable
`trg_hub_hang_doi_luot`, ghi lượt hợp lệ → outbox 0 dòng mới, rollback savepoint ·
`alter table hub_event_outbox rename to x_tmp` trong savepoint rồi ghi lượt → **lượt VẪN lọt**
kèm WARNING (mẫu 0157), đổi tên lại · em/GVCN select outbox → từ chối (ĐC).

### 1.13 `test-pa2-doi-lop.sql`
Dựng em[4]: mt riêng + thước riêng + cam kết MỞ chưa chấm + cam kết mở ĐÃ chấm + cam kết hết
hạn + dây gop_so lên mt lớp Test + thành viên một nhóm. Admin gọi
`apply_class_transfer(em[4], lop_giả)` (lớp giả §0.11): mt/thước sang lớp mới, **`campus_id` mt
đổi theo lớp mới** (dựng lớp giả ở CƠ SỞ giả để kiểm) · cam kết mở CHƯA chấm → dời; mở ĐÃ chấm
→ Ở LẠI; hết hạn → ở lại (chốt C20) · thành viên nhóm cũ `is_active=false` · dây lên mt lớp Test
CÒN NGUYÊN (không cột nhãn — màn suy từ class_id lệch) · GVCN lớp giả đọc mt em[4] → 1; GVCN
Test → 0 · buddy_pairs/pdr_schedules tắt (luật cũ) · **chiều ngược**: `update enrollments set
class_id=…` trực tiếp bằng postgres KHÔNG dời mt (cửa duy nhất là hàm — 0155) ·
`has_function_privilege('anon', 'apply_class_transfer(uuid,uuid)', 'execute') = false` — chạy
TRƯỚC 0160 phải = true (đó là lỗ đang mở, bằng chứng bài đo đúng chỗ).

### 1.14 `test-view-invoker-revoke.sql` — quét TOÀN BỘ, chạy sau MỖI migration
(a) mọi view public có `security_invoker=true` (đọc `reloptions`); chiều ngược: trong savepoint
`create or replace view <view mới> as select …` KHÔNG kèm option → dòng ấy phải HỎNG (đúng lỗ
0150) rồi rollback. (b) hàm SECURITY DEFINER public/private không mở cho anon/PUBLIC — **quét
bằng unnest, không LIKE**:
```sql
select n.nspname || '.' || p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private') and p.prosecdef
  and p.proname <> all (ALLOW_CU) and p.proname <> all (ALLOW_DI_SAN)
  and (p.proacl is null                                  -- mặc định = PUBLIC có EXECUTE
       or exists (select 1 from unnest(p.proacl) a
                  where split_part(a::text, '=', 1) in ('', 'anon') and a::text like '%=%X%'));
-- 0 dòng là ĐẠT. Chiều ngược: savepoint, grant execute … to anon một hàm definer mới → phải HỎNG.
```
`ALLOW_CU` = 14 helper 0003/0004 (auth_role, is_class_*, is_my_child, is_my_student,
is_parent_of_class, is_campus_class, staff_can_*, can_view_student, vn_today, app_today,
vn_week_start, current_school_year). `ALLOW_DI_SAN` = ảnh chụp definer cũ anon còn EXECUTE trước
0160 (`wig_class, lead_class, wig_student, hs_ghi_bien_ban` bản cũ, `kieu_don_vi`, …) — dán cứng
kèm ngày; **`test-pa2-khong-con-gi-tro-toi.sql` thêm một dòng: sau chặng ⑤ mọi tên trong
ALLOW_DI_SAN không còn tồn tại** (quên dọn là đỏ đúng chỗ). (c) anon đóng vai thật select
count(*) từ MỌI bảng mới → 0/mất quyền. (d) mọi bảng public `relrowsecurity=true`. (e)
`has_schema_privilege('anon','private','USAGE') = false`. (f) policy bảng MỚI không mở
public/anon — **có ngoặc**:
```sql
select tablename, policyname from pg_policies
where tablename = any (BANG_MOI) and ('anon' = any(roles) or roles = '{public}'::name[]);
```

### 1.15 `test-pa2-so-gop-dinh-vien.sql`
Em[1] gọi `thuoc_lop_dem(thước lớp)` → số, KHÔNG cột tên/uuid em khác (kiểm `proargnames` +
kiểu trả về) · em lớp giả gọi → 0 dòng · PH → số · anon → insufficient_privilege ·
`muc_tieu_lop_dem` mẫu số = sĩ số ghi danh (kể em chưa nối dây) · **nhóm buddy 2 người: em gọi
`thuoc_lop_dem(thước nhóm)` → `gia_lop/trung bình` = null, vẫn "x/2 bạn đủ"** (L7) ·
`bang_lop_em` chỉ GVCN/BGH/admin; em → 0 · thời gian `bang_lop_em` lớp Test < 500 ms
(`clock_timestamp()`, ngưỡng mềm — ghi số, không HỎNG) · em A gọi `viec_bang()`/`bang_ron()`
không tham số → CÓ dòng (V-N-00); B gọi cho A → 0.

### 1.16 `test-pa2-khong-con-gi-tro-toi.sql` — 50-DI-TRU §3.7 (chạy trước 0168 phải khớp SỐ
mong đợi từng câu; sau 0169 phải 0; kèm câu "wig_domain + score_category PHẢI CÒN" và câu
"tên PA2 không trùng danh sách drop").

### 1.17 Sửa bài cũ còn dùng
`test-audit-lo-ro.sql` mục 1 → view mới (hoặc bỏ — 1.14 đã quét toàn bộ) · `test-nhac-pdr.sql`,
`test-pdr-rieng-tu.sql`, `test-buddy-nhom.sql`, `test-diem-danh-cua-em.sql`, `test-rls-*.sql`
GIỮ NGUYÊN, chạy lại ở §7.

## 2. Phép tính — hợp đồng với 30

Véc-tơ do 30-PHEP-TINH §5 SỞ HỮU (V-T/V-M/V-G/V-N/V-D — đã gồm chiều ngược "Sai nếu");
`test-phep-tinh-thuoc.sql` / `-muc-tieu.sql` / `-goi-y.sql` / `-bang-ron.sql` /
`-thi-dua-ba-so.sql` nhúng đúng dữ liệu ấy, dựng bằng postgres (kiểm SỐ HỌC — quyền đã kiểm §1),
ghim `va.hom_nay`, so lệch `> 0.001` là HỎNG in mã véc-tơ. Oracle ba chiều:
`scripts/test-phep-tinh-oracle.mjs --seed 42` (30 §5.7). Tên cột dùng trong test = tên trả về
của 30 §1–§2 (gia, le_ra, so_ngay_giu, pct 0..1, nguon 'may_tu_*') — không tự đặt.

## 3. Kiểm giao diện thật — agent trên lớp Test

### 3.1 Hạ tầng
`scripts/lib/agent-cdp.mjs` (moTrinhDuyet, veDangNhap, datPhien, mo, bam, go, chon, chonNgay,
choChu, chup, docChu, csdl, chanProduction) — rút từ `chup-trang.mjs`/`test-mobile.mjs`, giữ
chốt chặn tài khoản ma + `--production`. `agent-hoc-sinh.mjs`: nhánh `xoa` theo bảng mới (thứ
tự FK: `pdr_ke_lai → cam_ket_xac_nhan → cam_ket → luot → noi → thuoc_lich_su → thuoc → so_do →
lich_su_dich → moc_muc_tieu → thanh_phan → muc_tieu → nhom_thanh_vien → …`), thêm `agent-ph@`,
lệnh `ghep-buddy`.

**Móc `data-kiem` — hợp đồng với 40 (thuộc tính tĩnh, không đụng style/i18n):**

| Màn | data-kiem bắt buộc |
|---|---|
| `/student` | `bang-ron`, `the-muc-tieu[data-id]`, `nut-them-muc-tieu`, `o-trong-muc-tieu`, `khoi-viec`, `hang-thuoc[data-id]`, `o-tuan[data-ngay]`, `nut-ghi`/`o-so`, `nut-them-viec`, `khoi-cam-ket`, `nut-them-cam-ket`, `the-cam-ket[data-id]`, `nut-thang`, `nut-thua`, `khoi-hop-ban`, `nut-mo-hop` |
| Form mục tiêu | `mt-buoc-1/2/3`, `mt-chon-mau`, `mt-mau[data-id]`, `mt-ten`, `mt-linh-vuc`, `mt-x`, `mt-y`, `mt-chua-do-x`, `mt-don-vi`, `mt-chieu-tang/giam/giu`, `mt-kieu-dich`, `mt-han`, `mt-cau-rap-lai`, `mt-gui`, `mt-loi` |
| Form thước | `th-ten`, `th-cach-ghi-cham/dien-so`, `th-don-vi`, `th-moi-lan`, `th-chi-tieu`, `th-ky-tuan`, `th-chieu-it-nhat/nhieu-nhat`, `th-gop`, `th-ngay-ap-dung[data-thu]`, `th-cho-bu`, `th-noi-muc-tieu`, `th-gui`, `th-loi` |
| Form cam kết | `ck-noi-dung`, `ck-so-tuan`, `ck-co-so`, `ck-so-hua`, `ck-don-vi`, `ck-chon-viec[data-id]`, `ck-chon-muc-tieu`, `ck-lac`, `ck-gui`, `ck-loi` |
| Họp bạn | `hb-ke-lai` (`hb-ke-thang/thua`, `hb-so-dat`), `hb-q3..q5`, `hb-q6-noi-dung`, `hb-q6-so-tuan`, `hb-q6-viec`, `hb-luu`, `hb-ky`, `hb-da-ky` |
| `/wig` (cô) | `lop-the-muc-tieu`, `lop-o-ghi-so-hom-nay`, `lop-nut-ghi-so`, `lop-viec-hang`, `lop-dem-du`, `lop-o-ca-doi`, `lop-cam-ket-thang/thua`, `cho-duyet-hang[data-loai∈{muc_tieu,thuoc,ha_chi_tieu}]`, `nut-duyet`, `nut-tra-lai`, `o-ly-do`, `nut-tam-dung`, `nut-ket-thuc`, `nut-ghi-bu` |
| `/roster` | `tab-nhom` (Q7 — nhóm ở roster) |
| `/campus` | `cs-muc-tieu-truong`, `cs-lop-cham`, `cs-tuan-hoc` (tab-tuan-hoc Ở ĐÂY), `cs-cong-tac-nhap-ho`, `cs-cho-duyet-lop` |
| `/report` | `ph-the-muc-tieu`, `ph-viec`, `ph-cam-ket` |

`scripts/test-data-kiem.mjs` (offline) grep từng tên trong `components/` — thiếu là đỏ.

### 3.2 Kịch bản chuỗi `scripts/agent-mot-tuan.mjs` (8 bước, chạy T5/T6; T2 tự chuyển ghi bù +
kể tuần trước, in ra)

| Bước | Vai | Làm gì (qua UI) — đối chiếu CSDL sau bước | Ảnh |
|---|---|---|---|
| ① dat-muc-tieu | agent1 | 4 mục tiêu: (a) từ mẫu chỉ điền số; (b) toi×giam tự viết; (c) chu; (d) tran_tich_luy. Gửi thiếu đơn vị → `mt-loi` đúng ô, Ô SỐ KHÔNG BỊ XOÁ (bài 31/08); mục tiêu thứ 5 → chặn tiếng người. CSDL: 4 dòng 'gui', (a) có `mau_id` | 01-em-form-b1..b3, 01-em-4-the |
| ② co-duyet | tunhien01 | duyệt 3, trả lại (b) kèm lý do → agent1 sửa → gửi lại → duyệt; cô KHÔNG có ô sửa `ten` của em (đối chiếu: không `mt-ten` trong hàng của cô). CSDL: 4 'duyet', `lich_su_dich` 1, `ly_do_tra_lai` từng có | 02-* |
| ③ viec-va-cam-ket | agent1 | thước cham "Đọc sách" (chi_huong → (a)); dien_so "Chạy bộ"; kiêng "Không quên vở" (chi_huong → (b)); thước thứ 5 → chặn "4"; cam kết có số 12 km chọn việc theo data-id; cam kết 2 `lac` → cảnh báo mềm vẫn lưu; cam kết 3 → chặn. Em GHI ĐƯỢC NGAY khi thước 'gui' (H-09) | 03-* |
| ④ ghi-5-ngay | agent1, agent2, agent3 | agent1 chạm T2..T6 (T5 trống, T6 ×2), điền 3;4;0;5, kiêng 0,0,1,0,0; agent2 ghi 2 ngày; agent3 dồn CN; ô −7 ngày KHOÁ (không nut-ghi); 999 → cảnh báo mềm vẫn lưu. CSDL: luot đúng; outbox +n cho thước thường, KHÔNG cho kiêng | 04-em-12-o-360, 04-canh-bao-999 |
| ⑤ hop-voi-ban | agent1 ↔ agent2 | câu 2 kể 2 cam kết (thang + so_dat 12; thua); gợi ý đứng cạnh, không tự chấm; cam kết 2-tuần đang chạy hiện `q2ChuaToiHan`, KHÔNG bắt chấm (Q11); q3–q5; câu 6 hứa mới 2 tuần; agent2 xem được, KHÔNG sửa được; agent1 ký → chip; quay lại /student: ô tuần đã kể KHOÁ, ô sau ngày ký còn mở. Đối chiếu ghi-khi-khoá bằng supabase-js anon → 0 dòng | 05-* |
| ⑥ co-ghi-so-lop | tunhien01 | mt lớp ghi_tay + ô "Ghi số hôm nay" 6,8; mt lớp nguon 'con'; thước lớp tung_em + ca_doi điền số; "n/N bạn đủ" đúng đếm; cam kết lớp chấm Thắng; duyệt 3 thước em; tạm dừng ca_doi từ tuần sau; "Ghi bù cho em" ngày −10 → 1 (C25); cô KHÔNG có nút chấm cam kết em; cô KHÔNG có nút sửa tuần học (tuần học ở /campus) | 06-* |
| ⑦ bgh-xem | principal | CHỈ ĐỌC qua UI: /campus thấy mục tiêu trường, bảng lớp chậm có số, lịch tuần học, công tắc nhập hộ; KHÔNG bấm ghi gì (mọi phép GHI của BGH — tạo mt trường, tuan_hoc, duyệt lớp, bật nhap_ho — đã kiểm rollback ở §1.1/1.3/1.11; agent không ghi dưới danh tính người thật) | 07-bgh-campus |
| ⑧ ph-xem | agent-ph | /report thấy 4 mt + việc + cam kết của agent1 (chỉ đọc); docChu KHÔNG chứa tên agent2 | 08-ph-360 |

Sau ⑧: `--don` gọi `agent-hoc-sinh.mjs xoa` + xoá mọi thứ cấp lớp/trường có tiền tố `KIEM `,
in bảng 0 dòng còn lại. Bước trước SAI thì không chạy bước sau.

### 3.3 Chụp 360px — `scripts/chup-man-pa2.mjs`
`TRANG` mới (cập nhật cả `test-mobile.mjs` cùng danh sách): hs `/student`, hs
`/student?week=<tuần trước>`, gvcn `/`, gvcn `/wig`, gvcn `/wig?tab=cho-duyet`, gvcn `/roster`
(tab nhóm), gvcn `/student/<agent1>`, bgh `/campus`, ph `/report`, admin `/admin/class/<Test>`.
Bỏ `/wig/chi-tiet`, `/wig/hop`, `/student/hop`, `/meeting`. `KICH_BAN` cảnh bấm-mới-hiện:
form-muc-tieu-b1/b2/b3, form-thuoc, form-cam-ket, o-ghi-dien-so, hop-ban-cau-2,
co-ghi-so-hom-nay, cho-duyet-tra-lai, ngan-keo-dieu-huong — mỗi cảnh kiểm phần tử CAO > 0.
Chuỗi dài nhất hai lớp: (1) dữ liệu xấu nhất trên agent3 (tên 120 ký tự, đơn vị "khách quan
tâm", số `12 345,5`, cam kết 200 ký tự) — cờ `--xau-nhat` ở bước ③; (2) `VA_LOCALE_DAI=1`
[H-27] nạp vi.json + nối 30% `ă` (giữ `{tham số}` và thẻ), CHỈ dev. Bốn số đo `do-mobile.js`
chạy kèm; ảnh cắt > 2000px ghi `biCat`.

### 3.4 `scripts/test-man-pa2-that.mjs` — fetch mọi TRANG bằng cookie từng vai: 200, không
`Application error`/`relation "`/`does not exist`/`NEXT_NOT_FOUND`/khoá i18n đứng lẻ, CÓ
`data-kiem` gốc của màn. Chạy trước mọi lượt chụp.

### 3.5 `scripts/seed-lop-test.sql` (bản mới) — idempotent, tiền tố `KIEM `: 3 mẫu, 1 mt lớp mỗi
kiểu toi/giu/ti_le_dat/chu, thước tung_em + ca_doi, don_vi đủ bộ, tuan_hoc năm nay (Tết nghỉ);
`set local session_replication_role = replica` hoặc disable `trg_hub_hang_doi_luot` trong cùng
transaction (dữ liệu gieo không sang Hub).

### 3.6 Phiếu nhìn ảnh (điền tay mỗi lượt chụp; lưu `docs/PA2/kiem/<ngày>-phieu.md`)

| Ảnh | Phải thấy | Không được thấy |
|---|---|---|
| /student 360 | băng rôn 1 dòng; ≤4 thẻ có SỐ + NGUỒN + NGÀY; 12 ô đủ, ô hôm nay nổi; chạm ≥44px | chữ cắt không "…"; số tràn thẻ; WIG/lead/PDR/buddy/"luỹ kế"; "cô" trần; vạch tiến độ khi chưa có số |
| Form 3 bước | nhãn thật; lỗi đỏ đúng ô; GIÁ TRỊ CÒN NGUYÊN sau lỗi; câu ráp đúng ngữ pháp | placeholder làm nhãn; `<select>` hệ thống; ngày mm/dd |
| Họp bạn | mỗi cam kết một dòng; cam kết chưa tới hạn có chip riêng; gợi ý CẠNH nút; sau ký chip xanh | nút Thắng/Thua chọn sẵn |
| /wig 1366+360 | ô Ghi số ở MỌI mt ghi_tay; "n/m bạn đủ" đúng; Chờ duyệt chỉ mục tiêu+thước+hạ chỉ tiêu | hàng cam kết trong Chờ duyệt; tên em trong số gộp khi xem vai em |
| /campus, /report | số kèm nguồn; PH chỉ thấy con | tên em khác |

## 4. Luật ② — `scripts/test-tu-cam-man-em.mjs` (offline)

- Phạm vi: GIÁ TRỊ chuỗi VI (không quét TÊN KHOÁ — namespace `pdr`/`buddy` còn giữ) trong
  `NS_MAN_EM` = {student, pdr, buddy, nav, common, notif, report, attendance, menu, timetable,
  login, unauthorized, tuan, bangEm, mucTieu, viec, camKet}; namespace mới có `useTranslations`
  trong `components/student|muc-tieu/**` mà không nằm trong NS_MAN_EM → SAI.
- Regex (u flag, chuỗi normalize **NFC** trước khi so): `\bWIG\b` (mọi hoa thường), `\blead\b`,
  `\blag\b`, `\bmeasure\b`, `\bPDR\b`, `\bbuddy\b`, **`/(luỹ|lũy)\s+kế/iu`**, và "cô" trần
  `(?<![\p{L}])cô(?![\p{L}])` trừ `(?<![Tt]hầy )`. Bỏ tham số ICU trước khi so.
- **Self-test đầu tệp**: quét mảng mồi `['luỹ kế','lũy kế','WIG','wig','thầy cô','Thầy cô',
  'Cô Lan','buddy']` — kết quả khác kỳ vọng → thoát 1 (máy quét cũng có chiều ngược).
- Ba nguồn ngoài JSON: (a) `raise exception '…'`/notification trong `supabase/migrations/016*.sql`;
  (b) chuỗi Việt cứng trong JSX màn em (bóc comment); (c) `pg_proc.prosrc` hàm sinh thông báo
  cho `/student` (cần DATABASE_URL, thiếu thì nói ra và bỏ qua).
- Hôm nay bài này PHẢI ĐỎ (~52 chuỗi dính, phần lớn trong namespace sẽ xoá) — chiều ngược sẵn;
  xanh ở tiêu chí chặng ③. Chạy kèm `test-khoa-dich.mjs`, `test-en-locale.mjs`.

## 5. `test-pa2-rls-tre-em.sql` — cổng bắt buộc trước go-live

Cảnh: em[1] đủ bộ (mt + so_do + thước + luot + cam kết + xác nhận + biên bản + pdr_ke_lai);
em[2] buddy của em[1]; em[3] cùng lớp không buddy; agent-ph → em[1]; GVCN Test; GVCN lớp giả;
BGH cùng/khác cơ sở; anon.

| Đọc dòng thô của em[1] | em[1] | em[2] buddy | em[3] | em lớp giả | PH em[1] | PH khác | GVCN Test | GVCN giả | BGH cùng | BGH khác | anon |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `luot` / `so_do` / `thuoc` riêng / `noi` | n | 0 | 0 | 0 | n | 0 | n | 0 | n [H-13] | 0 | 0 |
| `cam_ket` | n | **n** [H-12] | 0 | 0 | n | 0 | n | 0 | n | 0 | 0 |
| `pdr_ke_lai` (em[2] là counterpart) | n | n (người dự) | 0 | 0 | 0 (PDR không mở cho PH — 0146) | 0 | n | 0 | n | 0 | 0 |
| `luot` dòng em[1] trong thước lớp | n | 0 | 0 | 0 | n | 0 | n | 0 | n | 0 | 0 |

- Mọi ô 0 có ĐC. `update/insert luot` giả `student_id = em[2]` bởi em[1] → 0. PostgREST giả
  claims em[1] lọc `student_id=eq.em2` → 0.
- Hàm gộp: cột trả về không `uuid[]`/tên (kiểm `proargnames`/`prorettype`); em lớp giả gọi → 0
  dòng; nhóm 2 người → tổng null (L7).
- Policy bảng mới không mở public/anon (câu CÓ NGOẶC — §1.14f).
Chạy ở MỌI tiêu chí chặng và trước mỗi merge chạm `supabase/migrations`.

## 6. Hub hai tầng

- CSDL: §1.12. Lưu ý tầng: OUTBOX lưu `student_id` + `nguoi_ghi`; lớp HTTP dispatcher đổi
  `student_id` → `user_id` (webhook.ts) — bài SQL kiểm `student_id`, bài mjs kiểm `user_id`.
- Node: `scripts/test-hub-dispatcher.mjs` (local, Hub giả cổng ngẫu nhiên; kịch bản 200 /
  `already_promoted` / `--503-lan-dau` / `--400`): ghi lượt + check-in QUA UI → ≤20s Hub giả
  nhận `viec_dan_dat.tick` đúng `external_id` HMAC, payload ⊇ 6 trường cũ + `nguoi_ghi`,
  KHÔNG khoá ngoài allow-list {class_id, area, lead_title, logged_date, value, user_id,
  nguoi_ghi}; `diem_danh.danh_dau` không đổi; outbox sent/pending-retry/failed đúng kịch bản;
  Rổ Đỏ: log body không bao giờ chứa q3/mood/noi_dung/full_name/email. Hợp đồng chữ:
  `docs/PA2/hub-hop-dong.md` chép bảng 50 §5; script so khoá trong `buildLeadTickEvent` với
  tài liệu — lệch là đỏ. Chưa ký [H-03]: chạy `--truoc-ky` đảo kỳ vọng (lượt area-null →
  `failed('chua_ky_hop_dong')`).

## 7. Hồi quy phần GIỮ NGUYÊN (sau 0169 và sau mỗi merge chạm lib/middleware/migrations)

| Khu | Bài |
|---|---|
| CSDL sạch | `test-pa2-khong-con-gi-tro-toi.sql` |
| Lỗ rò | `test-view-invoker-revoke.sql`, `test-pa2-rls-tre-em.sql`, `test-audit-lo-ro.sql` (mục 1 đã sửa), `test-rls-bgh-hoc-sinh.sql`, `test-rls-parent-active.sql`, `test-rls-features.sql`, `test-rls-subjects.sql`, `test-rls-review-update.sql`, `test-subject-grade-guard.sql`, `test-gan-lop-de-len-admin.sql`, `test-phu-huynh-mail-truong.sql`, `test-dang-nhap-lan-dau.sql` |
| Điểm danh + cảm xúc | `test-diem-danh-cua-em.sql`; check-in qua UI (bài Hub §6) |
| Buddy + PDR + nhắc | `test-buddy-nhom.sql`, `test-pdr-rieng-tu.sql`, `test-nhac-pdr.sql`, `test-buddy-mot-nghia.mjs` — `pdr_meetings` chỉ THÊM cột/policy, 0146 không bị create-or-replace |
| Đổi lớp | `test-doi-lop.mjs` (cũ) + `test-pa2-doi-lop.sql` |
| Thông báo | `test-nhac-pdr.sql`; notifications không dòng mới link `/meeting`/`/wig/hop` |
| TKB/thực đơn/lớp/quản trị | `test-nav.mjs`, `test-man-pa2-that.mjs`, `test-admin-man.mjs`, `test-vao-dung-cho.mjs`, `test-sua-hoc-sinh.mjs`, `test-xep-lop-hoc-sinh-lo-lung.mjs`, `test-parent-class.mjs`, `test-class-cover.mjs`, `test-mui-gio.mjs`, `test-nam-hoc.mjs` (bỏ `ngayCuaKy`) |
| Offline | `test-client-namespaces.mjs`, `test-khoa-dich.mjs`, `test-tuong-phan.mjs`, `test-tu-cam-man-em.mjs`, `test-data-kiem.mjs`, `test-features-content.mjs`, `test-public-origin.mjs` |
| Mobile | `test-mobile.mjs <base> 360,390 <dir> hs,gvcn,ph,bgh,admin` + `chup-man-pa2.mjs` + phiếu §3.6 |
| Deploy | `/api/health` đúng SHA rồi mới chạy lại hàng "Lỗ rò" + `test-man-pa2-that.mjs` trên production |

Xoá khỏi bộ: 23 `.sql` + 13 `.mjs` + 5 script dữ liệu cũ (danh sách kiểm kê, PR-5);
`test-moi-lan-tick.mjs` THAY bằng `test-phep-tinh-oracle.mjs` (không tắt oracle — đổi oracle,
ghi lý do trong commit).

## 8. Tiêu chí "xong" từng chặng (bằng chứng vào `docs/PA2/kiem/<chặng>-bang-chung.md`)

| Chặng | Tiêu chí |
|---|---|
| ① PR-1 + chạy 0160–0167 | (a) mỗi tệp 0162–0167 chạy 2 lần liên tiếp không lỗi (0160/0161 miễn — §0.12); (b) toàn bộ §1.1–1.15 ĐẠT, mỗi tệp ≥1 chiều ngược đã chạy (không toàn BỎ QUA); (c) §7 hàng Lỗ rò + Buddy/PDR + Điểm danh vẫn đạt; (d) types sinh lại, `tsc --noEmit` sạch; (e) các [H] nhóm A của 0160/0161 đã gật |
| ② phép tính | (a) 30 §5 đủ véc-tơ; (b) ba tệp test-phep-tinh + oracle `--seed 42` 0 lệch; (c) `test-pa2-so-gop-dinh-vien` đạt, `bang_lop_em` < 500ms; (d) `test-view-invoker-revoke` đạt sau mỗi create-or-replace view; (e) grep `reduce(` trong components/student|muc-tieu chỉ còn UI thuần (soi tay, ghi kết quả) |
| ③ PR-3 màn em | (a) `test-data-kiem.mjs` đủ móc; (b) agent ①③④⑤ xanh trên localhost VÀ production lớp Test sau deploy; (c) `test-tu-cam-man-em.mjs` = 0 trong NS_MAN_EM; khoa-dich/client-namespaces/en-locale/tuong-phan đạt; (d) `chup-man-pa2` 360/390 vai hs: 0 tràn/thoát/chạm nhỏ, ảnh đã nhìn theo phiếu, phiếu lưu; (e) lỗi máy chủ không xoá ô đã gõ (bước ① kiểm); (f) `test-man-pa2-that` 200 `/student`; (g) [H-03] đã ký hoặc `--truoc-ky` đang bật |
| ④ PR-4 màn cô/BGH/PH | (a) agent ②⑥⑦⑧ xanh; (b) ảnh 1366+360 vai gvcn/bgh/ph/admin + phiếu; (c) `test-nav` mọi tab mọi vai; (d) `test-admin-man`, `test-vao-dung-cho`; (e) Chờ duyệt không hàng cam kết (docChu theo data-loai); (f) PH không thấy tên em khác; (g) cổng `test-khong-doc-bang-cu.mjs` = 0 |
| ⑤ PR-5 dọn | (a) TRƯỚC 0168: `test-pa2-khong-con-gi-tro-toi` khớp số mong đợi từng câu; grep bảng cũ trong app/components/lib = 0; production `/api/health` đúng SHA PR-4 + `test-man-pa2-that` 200; (b) sao lưu JSON, chủ dự án xác nhận nhận; [H-04][H-05] gật; (c) 0168 + 0169; bài (a) về 0 + hai câu "PHẢI CÒN" xanh; (d) toàn bộ §7; (e) `test-mobile` TRANG mới; (f) i18n: xoá ≈470 khoá, 0 mồ côi, NAMESPACE_CHO_CLIENT đã đổi; (g) tài liệu 50 §7 xong; (h) ALLOW_DI_SAN rỗng (§1.14) |
| ⑥ Hub + vận hành | (a) `test-hub-dispatcher` xanh 3 kịch bản; (b) `hub-hop-dong.md` đã ký; (c) production: lượt của agent1 → outbox `sent` ≤ 30s (SELECT); (d) `kiem-pa2.mjs --tat-ca` toàn xanh; (e) một tuần thật trên lớp Test (agent-mot-tuan chạy T5), ảnh cuối tuần lưu `docs/PA2/kiem/tuan-that/` |

Điều kiện chung: làm trên nhánh `pa2/…`, PR, chủ dự án merge; không kết luận trước khi
`/api/health` trả đúng SHA.

## 9. Bộ chạy tổng — `scripts/kiem-pa2.mjs`

`--sql` (mọi test-*.sql PA2 + hồi quy §7, qua `pg`, đọc result set cuối `tat_ca_dat`) ·
`--offline` · `--web <base>` · `--agent <base>` · `--tat-ca <base>`. Danh sách bài là hằng `BAI`
chia nhóm; `--kiem-danh-sach` báo tệp test chưa được liệt kê (chống bài mồ côi). Thiếu
`DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` → in "máy này chỉ chạy được nhóm offline; mở trình
duyệt tự nhìn" (CLAUDE.md §8), không đòi khoá. Tóm tắt ghi `docs/PA2/kiem/<ngày>-tom-tat.md`
(bài, kết quả, thời gian, SHA, `/api/health`). KHÔNG thêm vào CI (cần khoá production) — chạy
tay trước PR, dán tóm tắt vào mô tả PR.

## 10. [HỎI] của mảng này
Đã gom về 00-TONG-QUAN §6: [H-11]–[H-16] (các ô ma trận đánh dấu), [H-27] (VA_LOCALE_DAI),
[H-03] (Hub). Không gật dòng nào → bài chạy theo mặc định và in `GHI CHÚ [H-nn chưa chốt]`.
