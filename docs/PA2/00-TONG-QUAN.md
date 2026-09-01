# 00-TONG-QUAN — PA2: mô hình MỤC TIÊU mới, bản hợp nhất cuối

Vì sao có tệp này: sáu mảng đặc tả (schema, quyền, phép tính, màn hình, di trú, kiểm) được viết
song song rồi phản biện chéo — và phản biện tìm ra ~30 chỗ hai mảng nói hai thứ về CÙNG một cột,
một hàm, một tệp migration. Xây theo sáu bản gốc là ra hai bộ mã không lắp được vào nhau.
Tệp này là **bản chốt**: từ điển tên duy nhất, mọi tranh chấp đã xử, mọi lỗi chặn-build và nặng
đã sửa tại chỗ trong 10→60. Từ đây trở đi, **khi tài liệu nào (kể cả THIET_KE_WIG_4DX.md) nói khác
docs/PA2/, thì docs/PA2/ đúng.** Đọc tệp này trước, rồi mới mở tệp mảng.

Bối cảnh không nhắc lại ở các tệp sau: chủ dự án 01/09/2026 quyết xây thẳng mô hình mới theo
Phương án 2 (THIET_KE §2, §5, §6, §7; mọi quyết định cũ ở bảng 5.6 coi như ĐÃ LẬT), không hai mô
hình song song, không cờ theo lớp, không di trú dữ liệu cũ (sao lưu JSON rồi gỡ). Giữ nguyên:
đăng nhập/Hub SSO, hồ sơ, lớp/ghi danh/chuyển lớp, điểm danh + cảm xúc, TKB, buddy + lịch PDR +
nhắc PDR, thông báo, tin nhắn, Hub outbox/dispatcher (chỉ MỞ RỘNG trường). Họp lớp đã gỡ 19/08.

---

## 1. Mô hình một trang

Bốn thực thể sống, một bảng dây, một lớp phép tính:

- **MỤC TIÊU** (`muc_tieu`) — bốn cấp `truong / lop / nhom / em`. Có đích (X→Y, trần, giữ, tốc độ
  kỳ, % đạt, hoặc bằng lời), có hạn, có vòng duyệt (`nhap → gui → duyet / tra_lai → dong`).
  Tối đa 4 `duyet` một chủ thể một năm, tối đa 2 `dang_tap_trung`.
- **THƯỚC** (`thuoc`) — "việc em làm" đo được: chạm / điền số / máy ghi (điểm danh). Có chỉ tiêu
  theo kỳ 1/2/4 tuần, ngày áp dụng, chiều `it_nhat` (làm cho đủ) hoặc `nhieu_nhat` (kiêng).
  Hai cột trạng thái ĐỘC LẬP: `trang_thai` (chay/tam_dung/dong — vòng đời) và `duyet`
  (gui/duyet/tra_lai — vòng duyệt). Thước `gui` của em **vẫn nhận lượt** (không ai phải chờ duyệt
  mới được làm việc tốt). Đổi chỉ tiêu sau duyệt đi qua `thuoc_lich_su`, hiệu lực từ tuần sau.
- **LƯỢT** (`luot`) — một lần ghi của một chủ thể vào một thước một ngày. Em ghi trong cửa sổ
  7 ngày; thầy cô ghi hộ không vướng cửa sổ; **không ai vượt được chữ ký**: tuần đã kể lại trong
  biên bản họp bạn ĐÃ KÝ thì khoá, chỉ mở qua `edit_requests(mo_tuan_da_ky)` → `luot_mo_khoa`
  (48 giờ, có vết).
- **CAM KẾT** (`cam_ket`) — lời hứa 1–4 tuần, KHÔNG có vòng duyệt. Em tự chấm Thắng/Thua từ thứ
  Sáu tuần cuối (máy chỉ **gợi ý**, gợi ý được chụp lại lúc chấm để đo "chấm khác máy"); kể lại
  trong họp bạn qua `pdr_ke_lai` (câu 2 có cấu trúc), câu 6 sinh cam kết mới. Người chứng ghi ở
  `cam_ket_xac_nhan`.
- **DÂY** (`noi`) — nối con (thước hoặc mục tiêu) vào một mục tiêu cha, hai vai: `gop_so` (cộng
  số thật, có hệ số quy đổi) và `chi_huong` (chỉ trỏ hướng, không cộng). Em tự nối `chi_huong`
  lên mục tiêu lớp; `gop_so` lên lớp/trường chỉ thầy cô/BGH.
- **Phép tính** — MỌI số trên MỌI màn đi qua đúng hai hàm lõi `private.gia_thuoc` (giá một thước
  trong một cửa sổ) và `private.so_hien_tai` (số hiện tại của một mục tiêu). Không màn nào tự cộng.

```
                    ┌──────────────── muc_tieu cap='truong' ────────────────┐
                    │  nguon_so: ghi_tay │ he_thong │ con(gop_con) │ thuoc  │
                    └──▲───────────────────────▲───────────────────────▲────┘
              noi gop_so│ (BGH nối)            │                       │
        ┌───────────────┴──┐          ┌────────┴────────┐              │
        │ muc_tieu cap=lop │◄─────────┤ muc_tieu cap=em │              │
        └───▲──────────▲───┘ noi      └───▲─────────▲───┘              │
   noi gop_so│(GVCN nối) \  chi_huong     │gop_so    │chi_huong        │
        ┌────┴─────┐      \ (em tự nối)   │(em, của  │                 │
        │  thuoc   │       ─────────┐ ┌───┴───┐      │            ┌────┴────┐
        │ lop/nhom │                └─┤ thuoc │──────┘            │ so_do   │
        └────▲─────┘                  │ em    │                   │ (ghi tay│
             │ luot (em ghi / cô ghi  └───▲───┘                   │ /máy)   │
             │  hộ / máy từ điểm danh)    │ luot (cửa sổ 7 ngày,  └─────────┘
             │                            │  khoá theo chữ ký PDR)
        ┌────┴────────────────────────────┴────┐     ┌───────────────────────┐
        │ cam_ket (tuần, không duyệt, tự chấm) ├────►│ pdr_ke_lai (câu 2) +  │
        └──────────────────────────────────────┘     │ pdr_meetings (chữ ký) │
                                                     └───────────────────────┘
```

---

## 2. Từ điển thuật ngữ — chữ trên màn ↔ tên trong máy

Luật ② CLAUDE.md: bản VI không có WIG/lead/lag/measure/PDR/buddy/"luỹ kế"/"cô" trần. Bản EN giữ
thuật ngữ 4DX. Bảng này là chuẩn cho mọi chuỗi mới.

| Khái niệm | Chữ VI trên màn | Chữ EN | Bảng/cột |
|---|---|---|---|
| WIG | Mục tiêu | WIG | `muc_tieu` |
| Lead measure | Việc (em làm) | Lead measure | `thuoc` |
| Tick/log | Lượt ghi / Ghi | Log entry | `luot` |
| Weekly commitment | Cam kết | Commitment | `cam_ket` |
| PDR with buddy | Họp với bạn | PDR with buddy | `pdr_meetings` (giữ) |
| Buddy | Bạn (cùng nhóm) | Buddy | `buddy_pairs` (giữ), `nhom` loai='buddy' |
| Lag/actual | Số hiện tại / Đang ở | Current value | `so_do`, `private.so_hien_tai` |
| Target | Đích (Từ X đến Y) | Target | `muc_tieu.x_so/y_so` |
| Scoreboard | Bảng của em / của lớp | Scoreboard | màn `/student`, `/wig` |
| Cadence sign-off | Ghi nhận (chữ ký) | Acknowledge | `pdr_meetings.acknowledged_*` |
| Unit | Đơn vị | Unit | `don_vi` |
| Alignment | Hướng tới / Góp số vào | Aligned to / Feeds into | `noi.vai` |
| Domain | Lĩnh vực | Domain | enum `wig_domain` (+`khac`) |
| Từ đầu tới giờ (không "luỹ kế") | Từ đầu tới giờ | So far | — |

---

## 3. BẢNG TÊN CHỐT — mọi tranh chấp giữa sáu mảng, xử một lần

Mọi tệp 10→60 đã được sửa theo bảng này. Ai viết mã thấy chỗ nào còn lệch bảng này thì bảng này đúng.

| # | Tranh chấp | CHỐT | Ghi chú |
|---|---|---|---|
| C1 | Kế hoạch tệp migration (10 §9 vs 50 §1.1 đá nhau) | **0160→0169, 10 tệp — bảng ở §5 dưới và 50-DI-TRU §1** là nguồn chân lý duy nhất; 10-SCHEMA không giữ bảng riêng | hotfix revoke = 0160 |
| C2 | Trạng thái `thuoc`: 1 cột / 2 cột / boolean | **Hai cột**: `trang_thai in ('chay','tam_dung','dong')` + `duyet in ('gui','duyet','tra_lai')` + `da_tung_duyet boolean` | chở được C107 (gui vẫn ghi) và luật hạ chỉ tiêu |
| C3 | Cấu trúc `noi` | **Hai FK thật** `con_muc_tieu_id`/`con_thuoc_id` + hai cột GENERATED `con_loai`, `con_id` | mọi truy vấn đa hình cũ vẫn biên dịch, toàn vẹn tham chiếu thật |
| C4 | FK buổi họp trong `pdr_ke_lai` | `pdr_meeting_id` | khớp `cam_ket.pdr_meeting_id` |
| C5 | Cờ nhập hộ (3 tên, 3 bảng) | **`classes.nhap_ho`**, không có bảng `lop_cau_hinh` | `protect_class_privileged_cols` mở rộng; ai bật → [H-15] |
| C6 | Người tạo | `created_by` (cột hệ thống tiếng Anh) | `tao_boi`/`boi` bỏ |
| C7 | Người duyệt/đóng/chấm | `duyet_boi, duyet_at, ly_do_tra_lai, dong_boi, dong_at, ly_do_dong, cham_boi, cham_at, nguoi_ghi, nguoi_sua, sua_at, nguoi_doi, nguoi_nhap_ho, mo_boi, mo_at` | nghiệp vụ tiếng Việt không dấu; `ghi_chu_duyet`/`duyet_by`/`nguoi_duyet` bỏ |
| C8 | Môn | `subject_id` | khớp `teaching_assignments` |
| C9 | Thành viên nhóm | `nhom_thanh_vien.is_active` boolean | `den_ngay` bỏ |
| C10 | `thuoc_lich_su` cột tuần + trạng thái | `tu_tuan` + `trang_thai in ('hieu_luc','cho_duyet','tu_choi')` + `la_ha` | `hieu_luc_tu` bỏ; `chi_tieu_tai` CHỈ đọc dòng `hieu_luc` |
| C11 | Ai duyệt THƯỚC | **`duyet_duoc_thuoc` = `staff_can_manage_class(class_id)`** (GVCN/admin) cho MỌI chủ thể của thước, kể cả thước môn; KHÔNG đi qua `duyet_duoc_chu_the` | mục tiêu lớp vẫn qua BGH (0148) |
| C12 | Hàm gợi ý Thắng/Thua (3 tên) | **`public.goi_y_cam_ket(uuid)`** — definer, tự gác, trả null khi không đọc được | `goi_y_thang_thua`, `private.goi_y_cam_ket` bỏ |
| C13 | `edit_requests.kind` | Giai đoạn xây: `('rename_lead','doi_ten_thuoc','mo_tuan_da_ky','khac')`; 0169 mới bỏ `rename_lead` (pending → 'khac' trước) | app cũ còn tạo `rename_lead` tới PR-4 |
| C14 | Cơ chế `mo_tuan_da_ky` | Cột mới **`edit_requests.tuan date`** (thứ Hai tuần xin mở); duyệt → insert `luot_mo_khoa(student, class, week_start=tuan, het_han=+48h)` | không suy tuần từ biên bản → mở được cả tuần fallback của biên bản rỗng |
| C15 | Em nối dây lên mục tiêu lớp | **`chi_huong`: ĐƯỢC** (policy, không cần RPC); `gop_so` lên lớp/trường: chỉ GVCN/BGH/admin | 60 §1.8 đã đảo kỳ vọng theo |
| C16 | `lay_tu`, `chieu='giu'` | **GIỮ cả hai** (`lay_tu` cho `ti_le_dat`; `chieu in ('tang','giam','giu')`) | 10 "lệch doc" cũ về hai mục này bị huỷ |
| C17 | `nguon_so='thanh_phan'` | GIỮ, kèm `gop_thanh_phan in ('cong','trung_binh')`; `so_hien_tai` có nhánh tính | khớp véc-tơ IELTS 4 kỹ năng |
| C18 | Hub payload | 6 trường cũ giữ tên+nghĩa (`student_id, class_id, area, lead_title, logged_date, value`) **+ `nguoi_ghi`**; KHÔNG gửi `nguon`/`pham_vi`; `thuoc_id` = [H-23] mặc định không; `area` được null; area lấy theo dây `gop_so` trước, `chi_huong` sau (created_at sớm nhất); lọc bỏ: `student_id null`, `gia_tri ≤ 0`, kiêng (`nhieu_nhat`), đo (`moi_nhat`), **`cach_ghi='he_thong'`/`nguon='he_thong'`** | một bản ký duy nhất, 50 §5 |
| C19 | `class_competition_scores` | GIỮ nguyên chữ ký 5 cột; ba số tách nằm ở hàm MỚI `thi_dua_lop(p_class)`; score = trung bình các số không null của ba điểm | class_ranks/campus_ranks không đụng |
| C20 | Thân `apply_class_transfer` (3 bản) | MỘT bản duy nhất ở 10-SCHEMA §6: cờ `va.doi_lop` + đổi cả `campus_id` + tắt `nhom_thanh_vien` + điều kiện cam kết `hieu_luc ∧ ket_qua is null ∧ tuần còn mở`; KHÔNG đụng `noi` (màn suy "góp vào lớp cũ" từ `cha.class_id <> con.class_id`) | 50 chỉ giữ vị trí tệp + md5 guard |
| C21 | Helper nhóm | `nhom_class(n)`, `em_trong_nhom(n,s)`, `la_thanh_vien_nhom(n)` | `is_nhom_member` bỏ |
| C22 | Chữ ký biên bản | `acknowledged_by` LUÔN = uid người bấm (L8). Lớp `nhap_ho`: **bạn trong buổi họp** (counterpart/second_buddy) ký bằng tên mình. Thầy cô KHÔNG ký, kể cả gõ `acknowledged_by=em` | đã quyết, không còn là [HỎI] |
| C23 | BGH đặt thước/cam kết lớp, chấm cam kết lớp | **KHÔNG** — thước/cam kết là của đội; policy insert/update viết tường minh không có nhánh principal; chấm cam kết lớp = GVCN/admin | BGH vẫn ĐỌC đủ |
| C24 | Dòng cấp `nhom` ai đọc | **Cả lớp đọc** (nhóm là đơn vị công khai trong lớp) | 60 §1.3 kỳ vọng em ngoài nhóm đọc = 1 |
| C25 | GVCN ghi hộ lượt | KHÔNG vướng cửa sổ 7 ngày (để "quá 7 ngày → nhờ thầy cô" có thật), KHÔNG cần cờ nhập hộ; vẫn bị khoá chữ ký | nhập hộ chỉ dành cho NỘI DUNG (mục tiêu/thước/cam kết/sáu câu) |
| C26 | Ghim thời gian khi test | MỘT cơ chế: GUC **`va.hom_nay`** — hai hàm lõi VÀ trigger chấm cam kết (luật thứ Sáu, 20 §3.4) đọc `coalesce(nullif(current_setting('va.hom_nay',true),'')::date, vn_today())`; bản `_luc()` chỉ giữ cho hàm SINH dữ liệu (0159) | 60 §0.6 sửa theo |
| C27 | `cam_ket` CHECK chấm | `ck_cham_ck: (ket_qua is null) = (cham_at is null)` — không trói `cham_boi` (FK set null) | |
| C28 | Trần 2 cam kết | Đếm **theo từng tuần** (generate_series), chặn khi một tuần nào đó đã có 2 | A(1–2)+B(3–4)+C(1–4) phải LỌT |
| C29 | So sánh thời gian | MỌI so timestamptz↔date đi qua `at time zone 'Asia/Ho_Chi_Minh'` hoặc `vn_today()` | vết xe 0019 |
| C30 | `wig_domain`, `area_config`, `score_category` | `wig_domain` GIỮ + thêm `khac` (0161); `area_config` GIỮ + 1 dòng `khac`; `score_category` **GIỮ** (scoreboard_entries đang dùng) | 60 §1.17 sửa theo |

---

## 4. Luật bất biến (rút gọn — bản đầy đủ ở 20-QUYEN §0)

L1 bảng sinh ra là đóng (enable RLS + revoke anon + grant authenticated trong CÙNG tệp create).
L2 hàm mới đủ ba dòng revoke/grant (revoke `from public, anon` — thêm `authenticated` nếu chỉ máy gọi).
L3 view luôn `with (security_invoker = true)` + revoke anon, LẶP LẠI ở mọi lần sửa (lỗ 0150).
L4 policy = AI được ghi; trigger = GHI THẾ NÀO MỚI CÓ NGHĨA (áp cả service_role); errcode 42501/23514/23503, câu tiếng người.
L5 trigger duyệt so cột bằng WHITELIST "cột không phải nội dung" — cột mới tự rơi vào nhóm phải duyệt lại.
L6 `if (select auth.uid()) is null then return new` đầu trigger có yếu tố vai; cờ phiên `va.*` chỉ mở khe hẹp có điều kiện nội dung.
L7 dòng thô của một em: chỉ em / phụ huynh / thầy cô lớp (+GVBM đúng môn với thước môn); bạn cùng lớp chỉ thấy SỐ ĐẾM qua hàm definer tự gác; nhóm < 3 người không trả tổng/trung bình cho học sinh.
L8 không ai ký thay em (C22).
L9 `class_id`/`campus_id` của dòng cấp em chỉ hệ thống đổi (`apply_class_transfer`, cờ `va.doi_lop`); không trigger nào trên `enrollments`.
L10 policy `to authenticated`; bọc `(select …)` cho hàm không nhận cột.
L11 (mới, từ phản biện) whitelist là "cột KHÔNG phải nội dung"; `class_id, campus_id` luôn nằm trong whitelist của mọi bảng có chúng.
L12 (mới) mọi số một màn cần đều qua `private.gia_thuoc` / `private.so_hien_tai`; không view nào gọi hàm definer trả DÒNG của người khác.

---

## 5. Thứ tự làm — 5 chặng (5 PR) và 10 tệp migration

Migration: `0160 → 0169`, mỗi tệp tự `begin; … commit;` **trừ 0160 và 0161** (mỗi tệp đúng MỘT
câu — `revoke` / `alter type` — không bọc; khớp 60-KIEM §0.12).
Chi tiết nội dung từng tệp + lý do thứ tự: 50-DI-TRU §1. Tóm:

| Tệp | Nội dung một dòng |
|---|---|
| `0160_hotfix_khoa_apply_class_transfer.sql` | Vá lỗ đang mở: revoke EXECUTE của anon/authenticated — chạy NGAY, tách được thành hotfix trước PA2 [H-01] |
| `0161_pa2_linh_vuc_khac.sql` | MỘT câu: `alter type wig_domain add value if not exists 'khac';` [H-02] |
| `0162_pa2_nen_don_vi_tuan_hoc_nhom.sql` | `don_vi`+seed, `tuan_hoc`, `nhom`, `nhom_thanh_vien`, `muc_tieu_mau`, `classes.nhap_ho`, `pdr_meetings.nguoi_nhap_ho`, dòng `area_config('khac')`, helper nền |
| `0163_pa2_muc_tieu_va_so_do.sql` | `muc_tieu`, `moc_muc_tieu`, `thanh_phan`, `lich_su_dich`, `so_do` + helper chủ thể + trigger duyệt/trần + RLS |
| `0164_pa2_thuoc_va_luot.sql` | `thuoc`, `thuoc_lich_su`, `luot` + helper + trần 4 + `private.gia_thuoc` + RLS lượt (cửa sổ; CHƯA khoá chữ ký) |
| `0165_pa2_cam_ket_noi_va_khoa.sql` | `cam_ket`, `cam_ket_xac_nhan`, `pdr_ke_lai`, `noi`, `luot_mo_khoa`, `edit_requests` mở rộng, `goi_y_cam_ket`, `luot_bi_khoa` + ĐẶT LẠI policy lượt (thêm khoá), `private.so_hien_tai`, trigger PDR |
| `0166_pa2_ham_doc_va_thi_dua.sql` | View invoker + hàm màn (viec_bang, bang_ron, …, co_so_tong_hop, thi_dua_lop) + viết lại `class_competition_scores`/`campus_rollup` (md5 guard) |
| `0167_pa2_hub_doi_lop_va_nguon_he_thong.sql` | Trigger Hub trên `luot`, `apply_class_transfer` bản hợp nhất (md5 guard), trigger điểm danh → `luot`/`so_do` |
| `0168_go_mo_hinh_muc_tieu_cu.sql` | DROP mô hình cũ (9 bảng, 3 view, hàm, publication) — chỉ chạy ở chặng ⑤, sau sao lưu + gật [H-04] |
| `0169_don_enum_va_kind_cu.sql` | `wig_period`/`wig_scope`, `classes.tick_lock_dow`, siết `edit_requests.kind`, comment |

| Chặng/PR | Gồm | Điều kiện qua |
|---|---|---|
| ① `pa2/1-nen-csdl` | 0160–0167 + toàn bộ `scripts/test-pa2-*.sql` + script sao lưu bản 2 + docs/PA2 + CLAUDE.md §5 | KHÔNG đổi một byte mã app; mọi test chặng ① của 60-KIEM §8 xanh |
| ② `pa2/2-nen-app` | `database.types.ts` sinh lại (có cả cũ lẫn mới), `gen:types`, webhook/dispatcher nhận trường mở rộng, tách `checkinMood` + action edit_requests ra tệp riêng, xoá i18n mồ côi | trang y hệt trước |
| ③ `pa2/3-man-em` | Màn em + form 3 bước + việc 12 ô + cam kết + HopPdr/pdr-actions mới; **ký hợp đồng Hub [H-03] TRƯỚC merge** | 60-KIEM §8 chặng ③ |
| ④ `pa2/4-man-co` | `/wig`, `/`, `/campus`, `/report`, `/admin`, gỡ component cũ; cổng grep `test-khong-doc-bang-cu.mjs` = 0 là điều kiện merge; merge ≤ 1 tuần sau ③ | 60-KIEM §8 chặng ④; bắt đầu đếm 7 ngày |
| ⑤ `pa2/5-don` | Sao lưu → `kiem-truoc-drop` → 0168 → 0169 → test không-còn-gì → `gen:types` → commit types → merge (merge là bước CUỐI) | 60-KIEM §8 chặng ⑤ |

---

## 6. Danh sách [HỎI] chủ dự án — gom MỘT chỗ duy nhất

Nhóm A — **chặn tệp/PR, chưa gật chưa chạy**:

| # | Câu hỏi | Chặn | Mặc định nếu im lặng |
|---|---|---|---|
| H-01 | Vá ngay lỗ `apply_class_transfer` (anon gọi được RPC chuyển lớp trên production) — 0160 có thể tách hotfix chạy trước cả PA2? | 0160 | **KHÔNG chạy gì cho tới khi gật** (đây là migration production) |
| H-02 | Thêm `khac` vào enum `wig_domain` + một dòng `area_config` (nhãn "Khác"/"Other", màu `#6b7093`, icon `circle-dashed`, sort 99)? | 0161 | Thêm |
| H-03 | Hợp đồng Hub mới (bảng 50-DI-TRU §5): `area` được null, thêm `nguoi_ghi`, nguồn `luot`, lọc kiêng/đo/hệ thống/ca_đội — ký văn bản với phía os.truongvietanh.com | PR-3 | Chưa ký thì dispatcher chạy chế độ `--truoc-ky` (giữ nghĩa cũ, lượt không dây → `failed('chua_ky_hop_dong')`) |
| H-04 | 0168 drop `wigs` đang chứa 2 dòng `KIEMTUDONG-XOA-*` của lớp thật 12A1 (đã nằm trong bản sao lưu) | 0168 | **KHÔNG chạy 0168** |
| H-05 | Project Supabase có PITR/daily backup không — quyết độ dài quan sát trước 0168 | 0168 | 7 ngày + bản JSON |

Nhóm B — **đã chọn mặc định, gật thì giữ nguyên, không gật thì chỗ đổi ghi trong tệp mảng**:

| # | Điều đã chọn | Tệp chi tiết |
|---|---|---|
| H-06 | Mục tiêu NHÓM do GVCN tạo: hiệu lực ngay (người tạo = người duyệt) | 20 §1.1 |
| H-07 | Thước lớp/nhóm GVCN tạo: hiệu lực ngay, không qua BGH | 20 §3.3 |
| H-08 | Thước môn của GVBM: GVCN duyệt | 20 §3.3 |
| H-09 | Thước `duyet='gui'` của em: ghi lượt được ngay (C107) | 20 §1.2 |
| H-10 | Mở lại mục tiêu đã `dong`: chỉ admin | 20 §3.2 |
| H-11 | Em/phụ huynh thấy mục tiêu trường + số đo trường (bức tường) | 20 §1.1 |
| H-12 | Bạn cùng nhóm đọc CAM KẾT của nhau (không đọc lượt/số đo; `so_dat_goi_y` ẩn với bạn) | 20 §2.12, 30 §4.1 |
| H-13 | BGH cùng cơ sở đọc dòng thô cấp em (theo `can_view_student` hiện hành) — hay chỉ số gộp? | 20 §1.1, 60 §5 |
| H-14 | Khoá chữ ký theo TUẦN (mọi thước của em trong tuần đã kể lại), tính cả biên bản `type='coach'` | 20 §1.3 |
| H-15 | `classes.nhap_ho` do BGH cùng cơ sở + admin bật | 20 §2.15, 40 C5 |
| H-16 | Lớp nhập hộ: GVCN vừa nhập vừa duyệt được | 20 §3 |
| H-17 | `don_vi`: chỉ thầy cô/BGH/admin thêm; em gặp thiếu → "nhờ thầy cô thêm" | 20 §2.1 |
| H-18 | "Hạ lần thứ hai trong kỳ": kỳ = năm học (mốc tháng 7) | 20 §3.3 |
| H-19 | "Tháng" của `ky` = 4 tuần ISO; kỳ có tuần nghỉ co chỉ tiêu theo tuần học, kỳ toàn nghỉ = miễn; thước kiêng loại dòng tuần nghỉ khỏi `gia` | 30 §1.2, §2.3 |
| H-20 | `so_do` là "số đang ở" kể cả `tran_tich_luy`; ghi bù không trần ngày (trong `[bat_dau, hôm nay]`) | 30 §3.1 |
| H-21 | `gop_con='cong'` kẹp theo quãng CÓ HƯỚNG của con; mục tiêu cá nhân không kẹp thước | 30 §3.1 |
| H-22 | Thi đua: score = trung bình ba số có mặt; cam kết CHƯA chấm không vào mẫu số | 30 §4.2 |
| H-23 | Hub KHÔNG gửi `thuoc_id` | 50 §5 |
| H-24 | Sư Tử (LLM): gỡ hẳn cùng mô hình cũ (buddy_messages, BuddyAuto/Chat, lib/buddy.ts, 3 action), ghi nợ | 50 §3, 40 E |
| H-25 | `student_reflections` (2 dòng, thôi bày 16/08): gỡ cùng 0168 (đã sao lưu) | 50 §3 |
| H-26 | Giữ route `/wig`, nhãn tab đổi "Mục tiêu" | 40 A |
| H-27 | Công tắc dev `VA_LOCALE_DAI` (ngôn ngữ giả dài 30%, chỉ `NODE_ENV!=='production'`) | 60 §3.3 |
| H-28 | Phụ huynh làm người chứng cam kết: để sau (PARENT_PORTAL=false), UI chỉ đọc | 40 D |
| H-29 | `kieu_dich='giu'`: `chieu in ('tang','giu')` = giữ TRÊN ngưỡng (≥y); `giam` = giữ DƯỚI (≤y) | 30 §3.4 |

Không gật dòng nào của nhóm B thì bài kiểm tương ứng chạy theo mặc định và in `GHI CHÚ [H-nn chưa chốt]`.

---

## 7. Bản đồ bộ tệp

- `00-TONG-QUAN.md` — tệp này. Từ điển + tên chốt + chặng + [HỎI].
- `10-SCHEMA.md` — DDL chạy được cho 18 bảng mới + alter bảng giữ + trigger dữ liệu/máy + `apply_class_transfer`.
- `20-QUYEN.md` — helper, policy từng bảng, trigger duyệt/chữ ký/khoá/nhập hộ, sổ câu lỗi.
- `30-PHEP-TINH.md` — hai hàm lõi, hàm/view màn, Hub, véc-tơ kiểm.
- `40-MAN-HINH.md` — màn từng vai, bảng chuỗi vi/en đầy đủ, câu lỗi máy chủ, việc kiểm giao diện.
- `50-DI-TRU-VA-DON.md` — 10 tệp migration + thứ tự + sao lưu + drop + 5 PR + hợp đồng Hub + đường lùi.
- `60-KIEM.md` — hợp đồng kiểm: khung test SQL, bộ tệp test, agent trên lớp Test, cổng go-live.
