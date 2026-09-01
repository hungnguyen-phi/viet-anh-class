# 50-DI-TRU-VA-DON — Thứ tự làm, sao lưu, gỡ mô hình cũ (PA2, bản chốt)

Vì sao mảng này là trọng tài: `main` = production, migration chạy tay, drop không có undo. Mọi
con số/đối tượng dưới đây đọc từ CATALOG production 01/09/2026 bằng SELECT (không tin tệp
migration — `lead_class` đã từng lệch). Bản chốt sau phản biện: dãy tệp là **0160→0169 duy nhất**
(bảng §1 này thắng mọi bảng khác, kể cả bản cũ của 10-SCHEMA), thứ tự phụ thuộc đã sửa
(`so_hien_tai` nằm SAU `noi`; policy `luot` hai bước; `luot_mo_khoa` có chỗ sinh ra), md5-guard
chấp nhận chạy lại, `rename_lead` sống tới 0169, và hợp đồng Hub chỉ còn MỘT bản ký. Nguyên tắc
xuyên suốt: **migration chỉ THÊM đi trước mã; mã thôi đọc bảng cũ đi trước migration DROP** —
không có thời điểm nào production ở trạng thái "mã đọc bảng không tồn tại".

## 0. Tóm một màn hình

| Việc | Quyết định | Lý do một dòng |
|---|---|---|
| Song song hai mô hình / cờ theo lớp / di trú dữ liệu cũ | KHÔNG | chủ dự án 01/09: chưa ai dùng — sao lưu JSON rồi gỡ |
| Số migration | **0160 → 0169** (10 tệp, §1) — nguồn chân lý duy nhất | 0160 = hotfix lỗ đang mở; 0161 = 1 câu enum |
| Số PR | 5 PR ↔ 5 chặng (§4), mỗi PR tự đứng | main = production |
| Drop khi nào | 0168/0169 ở PR-5, ≥ 7 ngày sau PR-4 [H-05], cổng grep = 0, có chữ gật [H-04] | đường lùi của PR-3/4 là "revert code, bảng cũ còn" |
| Hub | Giữ `event_type` + 6 trường; thêm `nguoi_ghi`; `area` được null; nguồn `luot`; ký văn bản TRƯỚC PR-3 [H-03] | §5 là BẢN KÝ duy nhất |
| `database.types.ts` | Sinh lại HAI lần: sau 0167 (vào PR-2) và sau 0169 (vào PR-5) | §6 |

Sự thật đã xác minh, KHÁC kiểm kê nháp: (1) `score_category` KHÔNG mồ côi — `scoreboard_entries`
(bảng giữ) dùng → **không drop**; (2) danh sách hàm drop lấy từ `pg_trigger`/`pg_proc`, không từ
regex (regex sót 8 hàm chỉ dùng new/old); (3) `protect_class_privileged_cols` không chạm
`tick_lock_dow` → drop cột an toàn sau khi drop `tick_open`; (4) cron chỉ có `nhac-hop-pdr`;
(5) publication `supabase_realtime` đang có `wig_meetings`.

## 1. Dãy migration 0160 → 0169 (tên tệp ĐẦY ĐỦ — người viết không tự đặt lại)

| Tệp | Nội dung (đặc tả chi tiết ở đâu) | Chạy khi |
|---|---|---|
| `0160_hotfix_khoa_apply_class_transfer.sql` | `revoke all on function public.apply_class_transfer(uuid, uuid) from public, anon, authenticated;` — hàm definer, hai hàm gọi nó (`request_class_transfer`, `decide_class_transfer`) chạy bằng postgres nên vẫn sống. KHÔNG bọc begin/commit cũng được (một câu) | NGAY khi [H-01] gật — tách được thành hotfix trước cả PA2 |
| `0161_pa2_linh_vuc_khac.sql` | MỘT câu: `alter type wig_domain add value if not exists 'khac';` — không bọc transaction, không câu nào khác (run-sql.mjs gửi cả tệp một cú → giá trị enum mới không dùng được cùng transaction, bài học 0115) | sau [H-02] |
| `0162_pa2_nen_don_vi_tuan_hoc_nhom.sql` | 10-SCHEMA §1: `don_vi`+seed, `tuan_hoc`, `nhom`, `nhom_thanh_vien` (+`ntv_hop_le`), `muc_tieu_mau` (+`mtm_tran_tam`), `classes.nhap_ho` + mở rộng `protect_class_privileged_cols` (md5 guard), `pdr_meetings.nguoi_nhap_ho`, dòng `area_config('khac')`, helper `thuoc_co_so/lop_nhap_ho/la_gvbm_mon/nhom_class/em_trong_nhom/la_thanh_vien_nhom` + **viết lại `tao_buddy_nhom`** (md5 guard — bản 0153 chưa chiếu sang `nhom`, góp ý #6) + policy 20 §2.1–2.4 + khối grant | sau 0161 (dùng giá trị `khac`) |
| `0163_pa2_muc_tieu_va_so_do.sql` | 10 §2: `muc_tieu`, `moc_muc_tieu`, `thanh_phan`, `lich_su_dich`, `so_do` + `so_do_truoc_ghi` + helper chủ thể/`muc_tieu_*` (20 §1.1–1.2 phần mục tiêu) + trigger 20 §3.2 + policy 20 §2.5–2.7 (bản delete CHƯA có vế noi/cam_ket) | sau 0162 (FK don_vi, nhom, muc_tieu_mau) |
| `0164_pa2_thuoc_va_luot.sql` | 10 §3: `thuoc`, `thuoc_lich_su`, `luot` + `luot_truoc_ghi`, `th_truoc_xoa` + helper thước (20 §1.2) + trigger 20 §3.3 + trần + `private.chi_tieu_tai`, `ky_cua_thuoc`, `gop_thuoc_kep`, **`private.gia_thuoc`** (chỉ đọc thuoc/luot/tuan_hoc/nhom_thanh_vien — đủ bảng) + policy 20 §2.8–2.10 (bản `luot` CHƯA có vế `luot_bi_khoa`) | sau 0162; sau 0163 cho dễ lùi |
| `0165_pa2_cam_ket_noi_va_khoa.sql` | 10 §4: `cam_ket`, `cam_ket_xac_nhan`, `pdr_ke_lai`, `noi` (+`noi_hop_le`), `luot_mo_khoa`, `edit_requests` MỞ RỘNG (giữ `rename_lead`) + `mt_truoc_xoa` + helper cam_ket/pdr/`pdr_chu_ky_hop_le`/`luot_bi_khoa` + `public.goi_y_cam_ket` + **`private.so_hien_tai`** (đọc noi — giờ mới tồn tại) + trigger 20 §3.4–3.7 + policy 20 §2.11–2.15 + **ĐẶT LẠI 4 policy `luot` (drop if exists + create nguyên văn 20 §2.10, thêm vế khoá)** + đặt lại `rls_delete_muc_tieu` (thêm vế noi/cam_ket) | sau 0163 + 0164 (FK thuoc, muc_tieu, pdr_meetings) |
| `0166_pa2_ham_doc_va_thi_dua.sql` | 30 §4: view `muc_tieu_v`, `cam_ket_v` + hàm màn (`viec_bang`, `bang_ron`, `thuoc_12_tuan`, `thuoc_lop_dem`, `muc_tieu_lop_dem`, `metrics_tuan`, `bang_lop_em`, `bang_lop_thuoc`, `ty_le_em_tu_dat`, `co_so_tong_hop`, `thi_dua_lop`) + VIẾT LẠI `class_competition_scores()` (giữ chữ ký 5 cột) và `campus_rollup()` (giữ chữ ký + tên cột `wig_count`) — cả hai md5-guard §1.3, thân cũ chép vào chú thích cuối tệp để lùi | sau 0165 |
| `0167_pa2_hub_doi_lop_va_nguon_he_thong.sql` | 10 §5–§6: `private.hub_hang_doi_luot` + trigger; `private.nguon_he_thong_diem_danh` + trigger trên `attendance_records`; `apply_class_transfer` bản hợp nhất + `unenroll_student` (md5 guard; thân cũ chép chú thích cuối tệp) | sau 0165 (đọc noi/cam_ket); KHÔNG chờ [H-03] — trước PR-3 chưa có lượt nào |
| `0168_go_mo_hinh_muc_tieu_cu.sql` | §3.1–3.5: guard đếm + đánh `failed` outbox cũ + drop publication (có điều kiện) + 3 view + 31 hàm public + 9 bảng cascade + 25 hàm trigger `private` | **PR-5**: sau sao lưu + `kiem-truoc-drop.sql` xanh + cổng grep = 0 + `/api/health` = SHA PR-4 + [H-04][H-05] gật + chủ dự án ngồi cùng |
| `0169_don_enum_va_kind_cu.sql` | §3.6: `wig_period`, `wig_scope` (GIỮ `wig_domain`, `score_category`), `classes.tick_lock_dow`, xử lý `rename_lead` pending rồi siết `edit_requests_kind_check` về `('doi_ten_thuoc','mo_tuan_da_ky','khac')`, comment `pdr_meetings.q6_commitment` | ngay sau 0168, cùng buổi |

Mỗi tệp 0162–0169 tự `begin; … commit;`, `if not exists`/`drop … if exists` để dán lại được.
Mỗi tệp kèm `scripts/test-pa2-<việc>.sql` (60-KIEM §1) có chiều ngược; sau MỖI tệp chạy
`test-view-invoker-revoke.sql` + `test-audit-lo-ro.sql`.

### 1.2 Vì sao thứ tự này an toàn

- **FK**: bảng mới không FK nào trỏ vào bảng cũ và ngược lại → 0160–0167 và 0168 độc lập hoàn
  toàn; FK duy nhất cũ→giữ là `commitments.pdr_meeting_id → pdr_meetings on delete set null`
  (chiều con — drop `commitments` không đụng `pdr_meetings`).
- **Hàm `language sql` bị parse lúc CREATE** → mọi hàm phải nằm cùng-hoặc-sau tệp tạo bảng nó
  đọc: `gia_thuoc` ở 0164 (sau thuoc/luot), `so_hien_tai`/`luot_bi_khoa`/`goi_y_cam_ket` ở 0165
  (sau noi/cam_ket/pdr_ke_lai/luot_mo_khoa), hàm màn ở 0166.
- **Policy `luot` hai bước** (0164 cửa-sổ, 0165 thêm khoá): giữa hai tệp chưa ai ghi lượt vì màn
  mới chưa lên (PR-3) — ghi chú trong cả hai tệp để người chạy không tưởng lỗi.
- **Hai hàm sống được viết lại TRƯỚC khi drop nguồn cũ** (0166 trước 0168): `class_ranks` (trang
  lớp GVCN `/`) và `campus_rollup` (`/campus`) đi qua `class_competition_scores` → không khoảnh
  khắc nào trang đổ 500 vì hàm gọi bảng đã mất.
- **Hub**: `unique (source_table, source_id)` phân biệt `'lead_progress'`/`'luot'` — hai trigger
  sống chung 0167→0168; dispatcher đọc payload tự chứa nên dòng pending cũ vẫn gửi được, nhưng
  0168 vẫn đánh `failed` chúng (dữ liệu đã bỏ).
- **Enum**: 0161 một câu, không transaction — 0162 mới dùng `'khac'`.

### 1.3 Khung tệp + md5 guard CHẠY LẠI ĐƯỢC

```sql
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 016x — PA2: <TÊN>. Chủ dự án 01/09/2026: xây thẳng PA2, không song song, không di trú.
-- Đặc tả: docs/PA2/. Tệp CHỈ THÊM — không sửa/xoá đối tượng mô hình cũ (drop ở 0168).
-- ═══════════════════════════════════════════════════════════════════════════════════
begin;
set local search_path = public;
-- … create table + L1 + policy + trigger + khối grant L2 …
commit;
```

Guard trước MỌI `create or replace` hàm đang chạy (0162 protect_class, 0166 hai hàm thi đua,
0167 apply_class_transfer/unenroll) — chấp nhận HAI md5 để tệp dán lại được:

```sql
do $$ declare v text := md5(pg_get_functiondef('public.apply_class_transfer(uuid,uuid)'::regprocedure));
begin
  if v = '<md5 bản MỚI trong tệp này>' then raise notice '0167: đã là bản PA2, đè lại y nguyên';
  elsif v <> 'c30ee9da19236f8a57fe52d93045a070' then
    raise exception '0167: apply_class_transfer trên production đã khác bản đã đọc 01/09 — đọc lại pg_proc trước khi đè';
  end if;
end $$;
```
md5 đọc 01/09: `apply_class_transfer` `c30ee9da19236f8a57fe52d93045a070` ·
`class_competition_scores` `2f611dff248388e1ec29926b979205a7` · `campus_rollup`
`d24e8eeb6a8c9301b9b28eb1233ee4a0`. Thân cũ chép nguyên vào CHÚ THÍCH CUỐI TỆP tương ứng —
chỗ duy nhất được chép định nghĩa cũ vào repo (để lùi, §8).

## 2. Sao lưu JSON — `scripts/sao-luu-muc-tieu-cu.mjs` bản 2 (sửa tệp đang có, giữ cách gọi)

`node scripts/sao-luu-muc-tieu-cu.mjs [thư-mục-đích]` (mặc định `../Viet-Anh-class-sao-luu/`,
NGOÀI repo). Ba tệp `<YYYY-MM-DD-HHmm>-…`: `muc-tieu-cu.json` (`{sao_luu_luc, git_sha, csdl:
{host, db}, ghi_chu, bang: {<tên>: {cot, dong}}, dem}`), `kiem-truoc-drop.sql` (một khối
`do $$ … $$` RAISE EXCEPTION nếu count(*) bất kỳ bảng nào khác `dem` — chạy ngay trước 0168),
`manifest.txt` (sha256 + bảng đếm — commit vào `docs/PA2/sao-luu/`, KHÔNG chứa dữ liệu).

Danh sách bảng (đúng 9 bảng bị drop + 1 truy vấn phụ): `wigs, commitments, lead_measures,
lead_progress, wig_so_do, wig_meetings, wig_meeting_notes, student_reflections, buddy_messages`
+ `hub_event_outbox where source_table = 'lead_progress'`. KHÔNG có `scoreboard_entries` (bảng
giữ); CỐ Ý không sao lưu `pdr_meetings` (bảng giữ, 0 dòng — ghi ra để người chạy khỏi tưởng sót,
góp ý #18). Luật kỹ thuật: (1) phiên chỉ đọc `set default_transaction_read_only = on; set
statement_timeout = '120s';` (2) lấy bằng `select coalesce(json_agg(t), '[]'::json) from <bảng> t`
— JSON dựng phía Postgres, driver pg không phá `date`/`numeric`; (3) cột tự mô tả từ
`information_schema.columns`; (4) KHÔNG in nội dung dòng ra console (chữ trẻ em); (5) từ chối ghi
vào trong repo (`git rev-parse --show-toplevel`) trừ manifest; (6) `git_sha` + `csdl.host` cắt
mật khẩu; (7) ghi xong đọc lại, parse, so `dem` — lệch là thoát mã 1 và xoá tệp. Cách phục hồi
ghi trong `ghi_chu` (dựng CSDL trống 0001…0159, `json_populate_recordset` theo thứ tự FK,
disable trigger all) — KHÔNG viết script phục hồi trước.

## 3. Tệp 0168/0169 — nội dung drop và lệnh kiểm

### 3.1 Guard đầu 0168

```sql
begin;
set local search_path = public;
do $$ declare r record; begin
  for r in select 'wigs' b, count(*) n from wigs union all select 'commitments', count(*) from commitments
    union all select 'lead_measures', count(*) from lead_measures union all select 'lead_progress', count(*) from lead_progress
    union all select 'wig_meetings', count(*) from wig_meetings union all select 'wig_meeting_notes', count(*) from wig_meeting_notes
    union all select 'wig_so_do', count(*) from wig_so_do union all select 'student_reflections', count(*) from student_reflections
    union all select 'buddy_messages', count(*) from buddy_messages
  loop raise notice '0168 sắp drop % : % dòng', r.b, r.n; end loop;
end $$;
update hub_event_outbox set status = 'failed', last_error = '0168: mo hinh muc tieu cu da bo'
  where source_table = 'lead_progress' and status = 'pending';
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'wig_meetings')
  then alter publication supabase_realtime drop table wig_meetings; end if;   -- có điều kiện, không đổ oan
end $$;
```

### 3.2 View (3) → 3.3 Hàm public (31) → 3.4 Bảng (9) → 3.5 Hàm trigger private (25)

```sql
drop view if exists metrics_tuan_v, lead_tuan_v, wig_progress_v;

drop function if exists
  cam_ket_goi_y(uuid), child_class_progress(uuid), child_week_report(uuid, text), child_weeks(uuid),
  class_lead_board(uuid, date, uuid), class_tick_matrix(uuid, date),
  cuon_so_lieu_lop(uuid), cuon_so_lieu(uuid[]), cuon_dem(uuid),
  em_dat_du(uuid, uuid, integer, date, date), lop_dat_du(uuid, integer, date, date), wig_dat(uuid), so_do_moi_nhat(uuid),
  hs_ghi_bien_ban(uuid, text, date, text, text), hs_ghi_bien_ban(uuid, text, date, text, text, text, text, text),
  hs_tham_gia(uuid, text, date), mo_phong_hop(uuid, date, text), phong_dang_mo(uuid, text),
  lead_class(uuid), wig_class(uuid), wig_student(uuid),
  lead_day_ok(uuid, date), lead_measure_canh_bao(uuid), pdr_bang(uuid, date), school_wig_rollup(date),
  tuan_da_chot(uuid, uuid, date), tuan_da_hop(uuid, date), tick_open(uuid),
  kieu_don_vi(text), notify_student_meeting(), wig_meeting_note_dung_lop(), ty_le_cuon(uuid);
-- ty_le_cuon: kiểm kê xếp GỠ nhưng catalog 01/09 không thấy theo regex — `if exists` vô hại
-- (góp ý #5); nếu nó tồn tại với CHỮ KÝ KHÁC thì câu kiểm dưới bắt được, sửa chữ ký rồi mới chạy.
-- Trước khi viết 0168 chạy lại: select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname in ('ty_le_cuon','so_do_moi_nhat','wig_dat') — còn chữ ký nào thêm đúng chữ ký đó.

drop table if exists
  buddy_messages, wig_meeting_notes, wig_so_do, lead_progress, lead_measures,
  commitments, wig_meetings, wigs, student_reflections
cascade;   -- cascade dọn 25 trigger, 42 policy, index, FK nội bộ
-- [H-04] wigs còn 2 dòng KIEMTUDONG-XOA-* của 12A1 (lớp thật) — có trong sao lưu, PHẢI có chữ gật.
-- [H-25] student_reflections; [H-24] buddy_messages (0 dòng — kiểm SELECT trước, Sư Tử gỡ hẳn).

drop function if exists
  private.cam_ket_hop_le(), private.cam_ket_trang_thai(), private.chan_qua_hai_cam_ket(),
  private.chi_em_va_bgh_sua_cam_ket(), private.dem_lan_sua_cam_ket(), private.khoa_sau_khi_chot(),
  private.chan_qua_hai_viec(), private.chan_qua_muoi_viec(), private.lead_theo_cam_ket(),
  private.viec_em_sua_thi_cam_ket_cho_duyet(), private.chan_luong_vo_ly(), private.hub_hang_doi_tick_dan_dat(),
  private.tick_dung_thu(), private.bien_ban_dien_ngay(), private.so_do_chi_cho_dich_ngoai(),
  private.wig_so_do_cham_gio(), private.chan_wig_lop_thu_nam(), private.chan_em_tu_duyet(),
  private.chi_em_va_bgh_sua_muc_tieu(), private.dong_bo_area_cam_ket(), private.noi_muc_tieu_len_lop(),
  private.wig_em_sua_thi_cho_duyet(), private.wig_lop_qua_tay_bgh(),
  private.wig_actual(uuid), private.wig_actual_so(uuid);
commit;
```
GIỮ: `pdr_da_ky`, `is_pdr_participant`, `is_my_buddy`, `tao_buddy_nhom`, `unenroll_student`,
`sinh_nhac_pdr*`, `vn_*`, `thu_hai_tu_nhan`, `toi_dich`, `notify_edit_request`, `class_ranks`,
`campus_ranks`, `class_competition_scores`, `campus_rollup` (đã viết lại 0166),
`private.quang_duong`, `private.bo_dau`.

### 3.6 Tệp 0169

```sql
begin;
-- MỌI dòng rename_lead (kể cả approved/rejected cũ) đều vi phạm CHECK mới → chuyển hết về 'khac'
-- trước khi siết; message giữ vết gốc. Hôm nay bảng 0 dòng, nhưng app cũ còn sinh tới PR-4.
update edit_requests set kind = 'khac', message = 'rename_lead cũ: ' || coalesce(message, '')
  where kind = 'rename_lead';
alter table edit_requests drop constraint edit_requests_kind_check;
alter table edit_requests add constraint edit_requests_kind_check
  check (kind in ('doi_ten_thuoc', 'mo_tuan_da_ky', 'khac'));
drop type if exists wig_period;   -- phụ thuộc = 0 sau 3.4
drop type if exists wig_scope;
-- wig_domain GIỮ (area_config + muc_tieu.linh_vuc); score_category GIỮ (scoreboard_entries).
alter table classes drop column if exists tick_lock_dow;   -- tick_open đã drop; protect_class không chạm
comment on column pdr_meetings.q6_commitment is
  'Lời hứa tự do của em ở câu 6 (giữ để đọc lại). Từ PA2 cam kết có cấu trúc ở cam_ket.pdr_meeting_id, câu 2 ở pdr_ke_lai — không còn sinh commitments.';
commit;
```
### 3.7 `scripts/test-pa2-khong-con-gi-tro-toi.sql` — chạy TRƯỚC 0168 (phải THẤY danh sách) và SAU 0169 (phải 0)

Bảy câu SELECT, mỗi câu ghi SỐ MONG ĐỢI trước-drop làm comment cạnh câu (chiều ngược = lần chạy
trước 0168 phải khớp con số, thấy 0 lúc đó là regex sai — dừng lại):
- A. hàm còn nhắc tên cũ trong `prosrc` (regex `\m(wigs|commitments|lead_measures|lead_progress|wig_meetings|wig_meeting_notes|wig_so_do|student_reflections|buddy_messages|wig_progress_v|lead_tuan_v|metrics_tuan_v|wig_actual|wig_actual_so|lead_class|wig_class|wig_student|tuan_da_hop|tuan_da_chot|tick_lock_dow)\M`) — trước: ≈56 (31 public + 25 private), sau: 0.
- B. view đọc bảng cũ — trước: 3, sau: 0.
- C. policy bảng còn lại nhắc hàm/bảng cũ — trước: 0 đã xác minh (3 policy buddy_messages rơi theo bảng), sau: 0.
- D. trigger gọi hàm sắp drop — join `pg_trigger` với ĐỦ danh sách 25 tên của §3.5 — trước: ĐẾM
  TỪ `pg_trigger` lúc viết test rồi ghi số thật vào comment cạnh câu (≤ 25, vì
  `wig_actual`/`wig_actual_so` và `chan_qua_muoi_viec` không gắn trigger nào — góp ý #16), sau: 0.
- E. publication có `wig_meetings` — trước: 1, sau: 0.
- F. `pg_depend` của `wig_period/wig_scope` (deptype 'n') — trước: >0, sau: 0. **Thêm câu ngược:
  `wig_domain` và `score_category` PHẢI CÒN** (bắt drop nhầm).
- G. bảng cũ + `classes.tick_lock_dow` còn tồn tại — trước: 10, sau: 0.
- H. outbox pending nguồn `lead_progress` — sau: 0.
- I. **không hàm/trigger PA2 nào trùng tên danh sách drop** (so tập tên mới của 10/20 với §3.3+§3.5) — luôn 0.

### 3.8 Cổng grep phía mã — `scripts/test-khong-doc-bang-cu.mjs` (offline; điều kiện merge PR-4, PR-5)

MỘT mảng hằng `TEN_CU` khai đầu tệp = {12 bảng/view cũ} ∪ {31 tên hàm public của §3.3} ∪
{`tick_lock_dow`, `postgres_changes…wig_meetings`}; regex `.from('…')`, `.rpc('…')` SINH từ mảng
đó (không chép tay hai lần — phản biện đã bắt sót 8 tên). Tự kiểm: mảng phải khớp đúng số phần
tử §3.3 (in lệch là đỏ). Quét `app/ components/ lib/ scripts/` trừ `lib/database.types.ts`,
`supabase/`, chính script này + `sao-luu-muc-tieu-cu.mjs` + `test-pa2-khong-con-gi-tro-toi.sql`.

## 4. Năm PR lên `main`

| PR | Nhánh | Gồm | Production sau merge |
|---|---|---|---|
| PR-1 Nền CSDL | `pa2/1-nen-csdl` | 0160…0167, mọi `scripts/test-pa2-*.sql`, `test-view-invoker-revoke.sql`, `test-khong-doc-bang-cu.mjs`, `test-pa2-khong-con-gi-tro-toi.sql`, `sao-luu-muc-tieu-cu.mjs` bản 2, `pa2-lui-nen.sql` (§8), `docs/PA2/*`, CLAUDE.md §5 → `0001…0167` | KHÔNG đổi byte mã nào. Chủ dự án chạy 0160→0167 theo thứ tự, mỗi tệp xong chạy test của nó |
| PR-2 Nền app | `pa2/2-nen-app` | `database.types.ts` sinh lại (cũ + mới), `scripts/sinh-types.mjs` + `gen:types`, `lib/hub/webhook.ts` + `dispatcher.ts` nhận payload mở rộng (§5), tách `checkinMood` → `student/mood-actions.ts` và action edit_requests → `student/yeu-cau-actions.ts` (chỉ DI CHUYỂN), xoá i18n MỒ CÔI, `test-mobile.mjs` bỏ route stub | Trang y hệt; dispatcher gửi được cả `lead_progress` cũ lẫn `luot` (chưa có) |
| PR-3 Màn em + PDR | `pa2/3-man-em` | 40 §B: StudentScoreboard viết lại + component mới + HopPdr/pdr-actions + student/actions viết lại (gỡ 21 action cũ) + kind mới + namespace mới; **Sư Tử gỡ [H-24]**; **[H-03] ký Hub TRƯỚC merge** | Em ghi bảng mới; màn cô còn màn cũ (bảng cũ còn, không sập) → merge PR-4 CÙNG TUẦN, tốt nhất cùng ngày |
| PR-4 Màn cô/BGH/PH/admin | `pa2/4-man-co` | 40 §C–D; gỡ 17 tệp `components/wig/*`, `lib/wig-tao.ts`, `lib/don-vi.ts`, `lib/hop-data.ts`, route cũ; xoá namespace `wig/meeting/goal/metrics`; `robots.ts`; IntroGuide; AppNav; **cổng `test-khong-doc-bang-cu.mjs` = 0 là điều kiện merge** | Không tệp mã nào đọc bảng cũ. Chờ `/api/health` đúng SHA → test-nav, test-mobile, chụp lớp Test → BẮT ĐẦU ĐẾM 7 NGÀY |
| PR-5 Dọn | `pa2/5-don` | 0168, 0169; types sinh lại; xoá 23 `test-*.sql` + 13 `test-*.mjs` + 5 script dữ liệu cũ (kiểm kê §4); `seed-lop-test.sql` mới; `agent-hoc-sinh.mjs xoa` theo bảng mới; `test-audit-lo-ro.sql` mục 1 → view mới; `lib/dates.ts` bỏ 11 hàm chết; tài liệu §7; manifest sao lưu; CLAUDE.md §3 + §5 → `0001…0169` | Quy trình MỘT chiều, merge là bước CUỐI: sao lưu → `kiem-truoc-drop.sql` → 0168 → 0169 → `test-pa2-khong-con-gi-tro-toi.sql` = 0 → `npm run gen:types` → commit vào PR-5 → merge. (Migration không tự chạy ở CI nên chạy từ nhánh được; KHÔNG merge trước — types mới chỉ đúng sau 0169) |

Cổng chung mọi PR: build xanh CI, `test-client-namespaces.mjs`, `test-tuong-phan.mjs`,
`test-en-locale.mjs`; PR có màn thì đính ảnh 360px lớp Test. Sau merge: `curl -s
https://class.truongvietanh.com/api/health` đúng SHA rồi mới đo. Push: `gh auth switch --user
hungnguyen-phi`; không `--no-verify`. Thứ tự thời gian: PR-1 → chạy 0160–0167 → PR-2 → ký Hub →
PR-3 → PR-4 (≤1 tuần) → 7 ngày → PR-5.

## 5. Hợp đồng Hub — BẢN KÝ DUY NHẤT (gửi nguyên văn cho phía os.truongvietanh.com)

| # | Trường/hành vi | Hôm nay | Từ PA2 | Loại |
|---|---|---|---|---|
| 1 | `event_type` | `viec_dan_dat.tick` | giữ | — |
| 2 | `external_id` | HMAC(secret, `viec_dan_dat.tick:<lead_progress.id>`) | cùng công thức, id từ `luot.id` — không gian id mới, không trùng | Hub không cần làm gì |
| 3 | `payload.user_id` (lớp HTTP; outbox lưu `student_id`) | student_id | giữ (em sở hữu lượt, kể cả cô ghi hộ) | — |
| 4 | `payload.class_id` | uuid | giữ | — |
| 5 | `payload.area` | 1 trong 4, not null | **được null** (không dây, hoặc lĩnh vực `khac`); chọn theo dây `gop_so` trước, `chi_huong` sau (created_at sớm nhất) | **ĐỔI HỢP ĐỒNG** |
| 6 | `payload.lead_title` | tên việc theo tuần | tên THƯỚC (bền qua nhiều tuần) | nghĩa giữ |
| 7 | `payload.logged_date` | trong tuần hiện tại | lùi tới 7 ngày (em) hoặc xa hơn (cô ghi bù); có thể T7/CN | nới |
| 8 | `payload.value` | numeric > 0 | numeric > 0 (`gia_tri = 0` KHÔNG gửi) | giữ |
| 9 | `payload.nguoi_ghi` | — | **MỚI**: uuid người bấm; = user_id khi em tự ghi, id thầy cô khi ghi hộ | THÊM trường |
| 10 | Lọc | chỉ lượt có student_id | + bỏ kiêng (`nhieu_nhat`), số đo (`moi_nhat`), **`cach_ghi='he_thong'`/`nguon='he_thong'`** (điểm danh đã đi đường `diem_danh.danh_dau` — không đếm đôi), `ca_doi` | ít sự kiện hơn, mỗi sự kiện = một lần làm việc |
| 11 | update/delete | không gửi | không gửi | — |
| 12 | `diem_danh.danh_dau`, header, HMAC, mã 200/202/503/4xx | — | không đổi | — |
| 13 | `thuoc_id` | — | KHÔNG gửi [H-23] | — |

Ba câu cần trả lời VĂN BẢN trước merge PR-3: (a) khoá lạ `nguoi_ghi` có bị 400 không — có thì
Hub deploy trước; (b) `area: null` chấp nhận hay bỏ khoá; (c) có muốn `thuoc_id` không (mặc định
không). Chưa ký: dispatcher chế độ `--truoc-ky` — lượt không dây (`area null`) đánh
`failed('chua_ky_hop_dong')`, lượt có area gửi như cũ.

Phía Node (PR-2): `buildLeadTickEvent` kiểu `area: string | null` + khoá `nguoi_ghi`;
`dispatcher.ts` ép kiểu thêm hai trường (dòng `lead_progress` cũ không có `nguoi_ghi` → gửi null
đúng nghĩa); không đổi `HubEventType`/`sendHubEvent`. Seed lớp Test sau này: `alter table luot
disable trigger trg_hub_hang_doi_luot` trong cùng transaction (dữ liệu gieo không thành sự kiện).

## 6. `lib/database.types.ts`

| Lần | Sau khi | Vào PR | Kết quả |
|---|---|---|---|
| 1 | 0160→0167 chạy trên production | PR-2 | có cả cũ lẫn mới; `tsc --noEmit` vẫn xanh |
| 2 | 0168+0169 | PR-5 | mất bảng/enum cũ; `Enums.wig_domain` có `khac`; tsc xanh = cổng thứ hai sau grep |

`scripts/sinh-types.mjs` (thêm ở PR-2): đọc `DATABASE_URL` từ `.env.local`; **kiểm cổng: URL
chứa `:6543` hoặc `pgbouncer=true` → in hướng dẫn đổi sang chuỗi session 5432 rồi thoát mã 1**;
chạy `npx -y supabase@2.116.0 gen types typescript --db-url … --schema public` → ghi tệp; in
`git diff --stat`; thoát 1 nếu rỗng/thiếu `public: {`. Không sửa tay tệp sinh. Máy chỉ có hai
khoá NEXT_PUBLIC không chạy được — đúng CLAUDE.md §8, không bảo xin thêm khoá.

## 7. Tài liệu viết lại (PR-5 trừ ghi khác)

`docs/MO_HINH_WIG.md` thay hẳn nội dung GIỮ TÊN TỆP (ba chỗ đang trỏ tới) — dàn ý 9 mục theo
bản cũ của mảng này · `docs/ROLE_MATRIX.md` (predicate mới, trang mặc định HS `/student`, đoạn
"Ai đặt mục tiêu/thước/cam kết", edit_requests kind mới) · `docs/DATA_GOVERNANCE.md` (thêm
`luot/so_do/cam_ket/pdr_ke_lai` nhạy cảm cao; nguyên tắc số-gộp-definer; §7 Sư Tử → sử liệu 5
dòng; §8 Hub theo bảng §5; PITR + chỗ để bản JSON) · `docs/NAV_IA.md` (PR-4) · CLAUDE.md §3 bản
đồ mới + §4 "bảng mới cũng chỉ thử trên lớp Test"; §5 số migration (PR-1: `…0167`, PR-5:
`…0169`) · `README.md` (số migration, chú thích ảnh, tên thư mục, mô tả MO_HINH_WIG) ·
`docs/PILOT_SUCCESS_METRICS.md` (KPI theo bảng mới) · `PRODUCT.md:11-42` (bốn tầng PA2) ·
`docs/viet-anh-class-claude.md:91` (ví dụ mới) · `docs/DEPLOY.md`/`M8_HARDENING.md` (chú thích
sử liệu `wig_actual` gỡ 0168) · `docs/PA2/sao-luu/<mốc>-manifest.txt` + `docs/PA2/00-NHAT-KY-CHAY.md`
(ngày giờ từng migration, SHA `/api/health`, kết quả test — PR-1 tạo, cập nhật dần).

## 8. Đường lùi (nói thật)

| PR | Lùi mã | Lùi CSDL | Mất gì |
|---|---|---|---|
| PR-1 | revert (chỉ tệp) | `scripts/pa2-lui-nen.sql` (một transaction): drop 18 bảng mới cascade + hàm mới theo danh sách tường minh + `alter table classes drop column nhap_ho` + `delete from area_config where area='khac'` + `create or replace` BA hàm về thân cũ (chép ở chú thích 0166/0167, so md5 sau khi đè) + khôi phục `edit_requests_kind_check` = `('rename_lead')` + drop cột `edit_requests.tuan`. Enum `khac` không xoá được — vô hại | không gì (bảng rỗng) |
| PR-2 | revert | không cần | types về bản cũ |
| PR-3 | revert → em về màn cũ đọc bảng cũ (còn nguyên) | không cần; dữ liệu đã ghi vào bảng mới NẰM LẠI, màn cũ không thấy, không hỏng | sự kiện `luot` đã sang Hub không rút được → vì thế ký Hub trước, thử lớp Test trước |
| PR-4 | revert → cô về `/wig` cũ | không cần | lệch pha như giữa PR-3/PR-4 |
| PR-5 | revert phần mã/tài liệu | **SAU 0168 KHÔNG CÓ ĐƯỜNG LÙI BẰNG SQL** — chỉ còn (a) bản JSON §2, (b) PITR nếu gói có [H-05]. Điều kiện đã liệt kê ở §1 hàng 0168 | dữ liệu thử tháng 8 của Test/Marketing — đã sao lưu |

## 9. [HỎI] của mảng này (chi tiết ở 00-TONG-QUAN §6)

[H-01] hotfix 0160 · [H-02] enum `khac` · [H-03] ký Hub trước PR-3 · [H-04] drop `wigs` có 2 dòng
12A1 · [H-05] PITR/độ dài quan sát · [H-23] `thuoc_id` · [H-24] Sư Tử + `buddy_messages` ·
[H-25] `student_reflections` · [H-26] giữ `/wig`.
