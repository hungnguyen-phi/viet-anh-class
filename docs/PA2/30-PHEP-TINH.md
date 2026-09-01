# 30-PHEP-TINH — Hai hàm lõi, hàm đọc cho màn, véc-tơ kiểm (PA2, bản chốt)

Vì sao mọi số phải đi qua đúng hai hàm: mô hình cũ có bảy chỗ tự cộng và chúng lệch nhau — donut
nói thắng, bảng nói thua. PA2 chốt: `private.gia_thuoc` trả giá một THƯỚC trong một cửa sổ,
`private.so_hien_tai` trả số hiện tại một MỤC TIÊU; mọi view/hàm màn chỉ gọi hai hàm này. Tệp này
là bản chốt sau phản biện: đã sửa gác `viec_bang`/`bang_ron` (can_view_student không có nhánh tự
xem mình), kiêng so bằng DANH TÍNH ngày thay vì số đếm, `chi_tieu_tai` chỉ đọc dòng `hieu_luc`,
kẹp `gop_con='cong'` theo hướng, thêm nhánh `thanh_phan`, chặn đệ quy, và cột `goi_y_may` để
`cam_ket_v` không trùng tên với ảnh chụp `cam_ket.goi_y`. Không hàm nào ở đây GHI dữ liệu.
Tên cột theo 10-SCHEMA; tên hàm theo 00-TONG-QUAN §3. Véc-tơ §5 là hợp đồng với 60-KIEM:
hai bên lệch thì tệp này đúng, sửa bên kia và ghi lý do trong commit (bài học 0132).

## 0. Nền chung

### 0.1 "Hôm nay" ghim được (chốt C26)

Cả hai hàm lõi (và mọi hàm màn suy từ chúng) đọc hôm nay qua:
`v_hom_nay := coalesce(nullif(current_setting('va.hom_nay', true), '')::date, vn_today());`
Production không ai set GUC này; test set để dựng cảnh ở tuần đã đóng. Bản `_luc(timestamptz)`
chỉ dành cho hàm SINH dữ liệu (`sinh_nhac_pdr_luc`, 0159) — không nhân bản sang hàm đọc.

### 0.2 Từ vựng trạng thái (một bộ cho cả thước lẫn mục tiêu)

| Mã | Nghĩa | Màu | Chữ VI |
|---|---|---|---|
| `dat` | đã đạt | xanh | Đã đạt |
| `dang_thang` | đúng/nhanh hơn nhịp | xanh | Đang thắng |
| `dang_giu` | kiêng/giữ: đang giữ được | xanh | Đang giữ được |
| `sat_nut` | chậm nhịp ≤ 10% quãng | vàng | Sát nút |
| `dang_lam` | kỳ mở, chưa đạt, không có nhịp để so | vàng | Đang làm |
| `chua_biet` | không có số | vàng | Chưa biết |
| `can_co` | chậm nhịp > 10% quãng | đỏ | Cần cố lên |
| `vuot` | kiêng/trần: đã quá trần | đỏ | Đã vượt |
| `truot` | kỳ đóng mà không đạt | đỏ | Chưa đạt |
| `mien` | tuần/kỳ nghỉ, thước tạm dừng | xám | Tuần nghỉ |
| `dong` | mục tiêu đóng vì doi/bo | xám | Đã đóng |

`dat boolean` đi kèm: true ⇔ `dat`; false ⇔ `truot/vuot/can_co/sat_nut/dang_thang/dang_lam`
(chưa đạt); **null** ⇔ `chua_biet/mien/dong` và mọi ca "chỉ xét khi hết kỳ" mà kỳ chưa hết.

### 0.3 Tuần, kỳ, tuần học [H-19]

- Tuần ISO thứ Hai giờ VN (`vn_week_start`); nhãn `W..-....` khớp `pdr_da_ky`/`thu_hai_tu_nhan`.
- Kỳ của THƯỚC = `ky_tuan` (1/2/4) tuần, neo `thuoc.tu_tuan`: `k = floor((vn_week_start(ngay) −
  tu_tuan) / (7·ky_tuan))`; `ky_tu = tu_tuan + k·7·ky_tuan`; `ky_den = ky_tu + 7·ky_tuan − 1`.
- Kỳ của MỤC TIÊU (`giu`, `toc_do_ky`) = `ky` ánh xạ tuan→1, hai_tuan→2, **thang→4 tuần ISO**
  (không phải tháng lịch), neo `vn_week_start(bat_dau)`.
- Tuần học = không có dòng `tuan_hoc` hoặc `loai in ('hoc','thi')`. Cơ sở suy qua
  `class_id → classes.campus_id`.
- Kỳ có tuần nghỉ: chỉ tiêu XÉT ĐẠT co theo tuần học `chi_tieu = Σ_w(học(w) ?
  chi_tieu_tai(w)/ky_tuan : 0)`; kỳ KHÔNG có tuần học → `mien`. Trần kẹp (§2.4) dùng chỉ tiêu
  ĐẦY ĐỦ (nghỉ được miễn phạt, không được thưởng thêm). **Tuần có dòng `thuoc_lich_su`
  `chi_tieu_ky null` (tạm dừng) xử đúng như tuần nghỉ trong công thức kỳ** — không kéo cả kỳ
  thành `mien`.
- `private.chi_tieu_tai(p_thuoc, p_tuan)` = `chi_tieu_ky` của dòng `thuoc_lich_su`
  **`trang_thai='hieu_luc'`** có `tu_tuan` lớn nhất ≤ tuần; không có → `thuoc.chi_tieu_ky`;
  dòng `hieu_luc` có `chi_tieu_ky null` → tuần đó `mien`.

Helper thuần trong `private`: `so_tuan_ky(text)→int`, `tuan_la_hoc(campus,tuan)→bool` (definer,
đọc `tuan_hoc`), `so_ngay_hoc(campus,tu,den)→int`, `ky_cua_thuoc(thuoc,ngay)→(ky_tu, ky_den,
so_tuan_hoc, chi_tieu, chi_tieu_day_du, mien)`, `chi_tieu_tai`, `gop_thuoc_kep` (§2.4).
Tất cả revoke đủ `public, anon, authenticated` (chỉ hàm public đã gác gọi).

### 0.4 Hợp đồng null — "không ghi ≠ 0"

Không dòng trong cửa sổ → `gia = null`, `so_dong = 0`. Không `coalesce` về 0 ở ĐẦU RA; chỉ dùng
`coalesce(gia,0)` BÊN TRONG phép so "đủ chưa" của `it_nhat` (không làm = không đạt) và KHÔNG BAO
GIỜ cho `nhieu_nhat` (im lặng không phải thắng). Dòng `gia_tri = 0` là dòng thật (đếm vào
`so_dong`, `so_ngay_ghi`). `chua_do_x`: không nội suy, `le_ra = null`, `pct = null`.

### 0.5 Đích tại thời điểm (`lich_su_dich`)

`x, y, ket_thuc` hiệu lực tại `p_ky`: nếu có dòng `lich_su_dich` với `luc::date > p_ky` → lấy bộ
`*_cu` của dòng SỚM NHẤT trong số đó; không có → cột hiện tại của `muc_tieu`. % quá khứ tính theo
đích lúc đó.

## 1. Hàm lõi 1 — `private.gia_thuoc`

```sql
private.gia_thuoc(p_thuoc uuid, p_tu date, p_den date, p_chu_the uuid default null)
returns table (
  gia numeric,                 -- theo gop; NULL = không dòng nào trong cửa sổ
  so_dong int, so_ngay_ghi int,
  so_ngay_ap_dung int,         -- ngày ∈ cửa sổ ∩ [tu_tuan, den_tuan+6], isodow ∈ ngay_ap_dung, thuộc tuần học
  so_ngay_ap_dung_da_qua int,  -- … và ≤ hôm nay (GUC §0.1)
  so_ngay_giu int,             -- KIÊNG: số NGÀY ÁP DỤNG đã qua có dòng ghi (danh tính ngày, không phải so_ngay_ghi)
  so_tuan_hoc int,
  chi_tieu numeric,            -- Σ tuần học trong cửa sổ chi_tieu_tai(w)/ky_tuan; NULL ⇒ mien
  le_ra numeric,               -- nhịp = chi_tieu × da_qua / so_ngay_ap_dung; NULL với moi_nhat/dem_dat_nguong
  dat boolean, trang_thai text,
  ngay_cuoi date, gia_moi_nhat numeric,
  so_em_can int, so_em_ghi int, so_em_dat int   -- chỉ khi p_chu_the null và pham_vi='tung_em'
) language sql stable security definer set search_path = public
```
`revoke all … from public, anon, authenticated;` — definer vì cộng dòng nhiều em; chỉ hàm/view đã
gác gọi. Không tự gác.

### 1.1 Chọn dòng

| `chu_the`/`pham_vi` | `p_chu_the` | Dòng `luot` lấy | `so_em_can` |
|---|---|---|---|
| `em` | bất kỳ (ép = `thuoc.student_id`) | của chính em | null |
| lớp/nhóm `tung_em` | uuid | `student_id = p_chu_the` | null |
| lớp/nhóm `tung_em` | null | mọi dòng của em đang ghi danh/thành viên active | sĩ số / số thành viên |
| `ca_doi` | bỏ qua | `student_id is null` | null |

Cửa sổ: `ngay between p_tu and p_den`. Với `it_nhat`: dòng ngoài `ngay_ap_dung` VẪN đếm vào `gia`
(làm bù — `cho_bu` là luật ghi, không phải luật đọc) và dòng tuần nghỉ vẫn đếm. Với
**`nhieu_nhat` (kiêng): dòng thuộc tuần nghỉ/tuần tạm dừng bị LOẠI khỏi `gia`** — đối xứng với
việc chỉ tiêu đã co, nghỉ không thành nghiêm hơn [H-19].

### 1.2 `gia` theo `gop` (một chủ thể)

| `gop` | `gia` | `gia_moi_nhat`/`ngay_cuoi` |
|---|---|---|
| `tong` | `sum(gia_tri)` | dòng lớn nhất theo `(ngay, stt, created_at)` |
| `moi_nhat` | `gia_tri` của dòng lớn nhất | như trên |
| `dem_dat_nguong` | `count(*) filter (gia_tri >= nguong_moi_lan)` | như trên |

Gộp lớp (`p_chu_the null`, `tung_em`): `tong` → Σ gia từng em (KHÔNG kẹp — kẹp là việc của
`so_hien_tai`); `moi_nhat` → trung bình gia của em có dòng; `dem_dat_nguong` → Σ. `so_em_ghi` =
số em có ≥1 dòng; `so_em_dat` = số em `dat=true` tính riêng từng em. Dòng gộp lớp có
`dat/trang_thai = null` — UI dùng `so_em_dat/so_em_can`; `chi_tieu`, `le_ra` theo ĐẦU EM.

### 1.3 `dat`/`trang_thai` một chủ thể (`mo` = `p_den ≥ hôm nay`)

| `gop` × `chieu_dich` | `dat` | `trang_thai` |
|---|---|---|
| bất kỳ, `chi_tieu null` | null | `mien` |
| `tong` × `it_nhat` | `coalesce(gia,0) >= chi_tieu` | đạt→`dat`; mo: `≥ le_ra`→`dang_thang`, `≥ le_ra − 0.1·chi_tieu`→`sat_nut`, khác→`can_co`; đóng→`truot` |
| `tong` × `nhieu_nhat` | `coalesce(gia,0) > chi_tieu` → **false**; đóng ∧ `so_ngay_giu ≥ so_ngay_ap_dung` → **true**; khác → **null** | `vuot` / `dat` / mo ∧ `so_ngay_giu ≥ so_ngay_ap_dung_da_qua` → `dang_giu` / khác → `chua_biet` |
| `moi_nhat` × `it_nhat` | `gia null`→null; `gia >= chi_tieu` | `chua_biet`/`dat`/`dang_lam` (đóng→`truot`) |
| `moi_nhat` × `nhieu_nhat` | `gia null`→null; `gia <= chi_tieu` | như trên |
| `dem_dat_nguong` × `it_nhat` | `coalesce(gia,0) >= chi_tieu` | `dat`/`dang_lam`/đóng→`truot` |
| `dem_dat_nguong` × `nhieu_nhat` | tổ hợp cấm (CHECK 10-SCHEMA) | — |

**Kiêng so bằng DANH TÍNH ngày** (vá lỗ dòng lạc chỗ che ngày thiếu): `so_ngay_giu =
count(distinct ngay) filter (isodow(ngay) = any(ngay_ap_dung) ∧ tuần học)` — một dòng ghi thứ Bảy
không che được thứ Sáu bỏ trống.

### 1.4 Kẹp trần theo KỲ — `private.gop_thuoc_kep(p_thuoc, p_tu, p_den, p_kep)`

Thước `tung_em`/`em`: chia cửa sổ theo kỳ của thước; mỗi `(em, kỳ)` góp
`least(gia_em_ky, chi_tieu_day_du_ky)` khi `p_kep` ∧ `gop='tong'` × `it_nhat`. `nhieu_nhat` không
kẹp (vi phạm đếm hết); `ca_doi` không kẹp; `moi_nhat` → trung bình số cuối; `dem_dat_nguong` → Σ.
Kẹp theo KỲ, không theo năm (bài học 0109).

## 2. Hàm lõi 2 — `private.so_hien_tai`

```sql
private.so_hien_tai(p_muc_tieu uuid, p_ky date default null, p_sau int default 0)
returns table (
  so numeric, nguon text,      -- 'ghi_tay'|'he_thong'|'may_tu_thuoc'|'may_tu_con'|'may_tu_thanh_phan'|null
  ngay_nguon date, so_nguon int,
  x numeric, y numeric,        -- đích hiệu lực tại p_ky (§0.5)
  le_ra numeric, pct numeric,  -- pct 0..1, chỉ kiểu có quãng
  dat boolean, trang_thai text,
  ky_tu date, ky_den date, so_ky_giu int, so_ky_xet int,
  tu_so int, mau_so int
) language sql stable security definer set search_path = public
```
`p_sau` là chốt đệ quy: > 3 → trả `so null, trang_thai 'chua_biet'`, không gọi tiếp (lớp hai sau
luật cấp-thấp-lên-cao của `noi_hop_le`).

### 2.1 Lấy `so` theo `nguon_so`

| `nguon_so` | Cách lấy |
|---|---|
| `ghi_tay` / `he_thong` | dòng `so_do` (`thanh_phan_id null`, `ngay <= p_ky`) mới nhất theo `(ngay, created_at)`. `so_do` là "số ĐANG Ở" [H-20]. Với `toc_do_ky`/`giu`: dòng mới nhất TRONG KỲ chứa `p_ky`. Khác nhau chỉ ở `nguon` trả về. |
| `thanh_phan` | mỗi `thanh_phan` lấy dòng `so_do` mới nhất có `thanh_phan_id` đó; gộp theo `gop_thanh_phan`: `trung_binh` = avg các phần CÓ số (không phần nào có → null); `cong` = Σ nhưng đòi ĐỦ mọi phần có số, thiếu phần nào → `so = null` (nửa tổng là số dối). `nguon = 'may_tu_thanh_phan'`. Riêng `kieu_dich='ti_le_dat'` + thành phần: `tu_so` = số phần đạt `nguong` (của từng phần, fallback `nguong_con`), `mau_so` = số phần. |
| `thuoc` | với mỗi dây `noi(vai='gop_so', cha_id=p, con_thuoc_id not null)`, con `duyet='duyet'` ∧ `trang_thai <> 'dong'` (tạm dừng vẫn cộng số đã có): `gop_i = gop_thuoc_kep(con, bat_dau, p_ky, p_kep) × he_so`, `p_kep = cap in ('lop','nhom','truong')` [H-21]. `so = x ± Σ` (`+` tang, `−` giam); thước `gop='moi_nhat'` → `so = gia` (nguồn duy nhất — noi_hop_le đã ép); `toc_do_ky` → Σ trong kỳ chứa `p_ky`, không cộng x; `giu` → số đọc kỳ = moi_nhat của thước trong kỳ. `x null` có dây → `so = Σ` (từ đầu tới giờ), `pct null`. Không dây → `so = x`, `so_nguon = 0`. `chi_huong` KHÔNG BAO GIỜ vào phép cộng. |
| `con` | mỗi dây `gop_so` từ mục tiêu con `trang_thai='duyet'` (hoặc `dong` với `ly_do_dong='dat'`), `sc = so_hien_tai(con, p_ky, p_sau+1)`: xem §2.2. |

### 2.2 `gop_con` — kẹp theo quãng CÓ HƯỚNG của con (vá lỗ con chiều giảm góp âm)

- `cong`: đóng góp của một con = quãng đã đi, kẹp `[0, quãng con]`:
  con `tang` → `least(greatest(sc.so − coalesce(sc.x,0), 0), sc.y − coalesce(sc.x,0))`;
  con `giam` → `least(greatest(sc.x − sc.so, 0), sc.x − sc.y)` (con `giam` không `x` → bỏ con);
  con `sc.so null` → bỏ. `so = x + Σ(đóng góp × he_so)`.
- `trung_binh`: `avg(sc.so)` các con có số; không con nào → null (UI hiện "n/N có số").
- `ti_le_dat`: §2.3.

### 2.3 `ti_le_dat` (mọi `nguon_so`, theo `lay_tu` — cột GIỮ, chốt C16)

Tập con theo `lay_tu` + bộ lọc (`linh_vuc`, `subject_id`, `don_vi_id` của cha, cái nào not null
thì lọc): `muc_tieu_em` → mục tiêu em `duyet` của em ghi danh trong lớp (cap lop) / trong mọi lớp
active cùng cơ sở năm nay (cap truong); `muc_tieu_lop` → mục tiêu lớp `duyet` trong cơ sở;
`thuoc` → thước lớp `tung_em` nối `gop_so` tới cha, xét kỳ hiện tại. Con "đạt": `nguong_con`
not null → `sc.so >= nguong_con` (`giam` → `<=`); null → `sc.dat = true`; `lay_tu='thuoc'` →
`so_em_dat` của `gia_thuoc(…, null)`. **Mẫu số = sĩ số ghi danh** (enrollments active / số lớp
active / thành viên nhóm) — em không có mục tiêu = không đạt. `so = 100·tu_so/mau_so` (mẫu 0 →
null); `dat = so >= y`; trạng thái `dat`/`dang_lam`.

### 2.4 Nội suy "lẽ ra hôm nay" theo NGÀY HỌC

`t(d) = so_ngay_hoc(campus, bat_dau, d) / so_ngay_hoc(campus, bat_dau, ket_thuc)` (mẫu 0 →
`le_ra null`). Neo: `(bat_dau, x)`, các `moc_muc_tieu` tăng dần, `(ket_thuc, y)`; nội suy tuyến
tính theo ngày học trong đoạn chứa d. `x null` → `le_ra null`.
`toi` → d = p_ky · `tran_tich_luy` → d = p_ky, neo đầu `(bat_dau, coalesce(x,0))` ·
`toc_do_ky` → d = ky_den của kỳ chứa p_ky · `giu` → hằng y · `ti_le_dat`, `chu` → null.

### 2.5 Ma trận kiểu × chiều → `pct`, `dat`, `trang_thai`

`het_ky = p_ky > ket_thuc ∨ trang_thai='dong'`; `q = y − x` (giam: `x − y`). Mục tiêu `dong`:
`dat` → `(true, 'dat')`; `doi/bo` → `(null, 'dong')` (vẫn trả `so`).

| Kiểu × chiều | `pct` | `dat` | khi chưa đạt |
|---|---|---|---|
| `toi` × tang | `least(1, greatest(0, (so−x)/q))` | `so >= y` | `so null`→`chua_biet`; `le_ra null`→`dang_lam`; `so >= le_ra`→`dang_thang`; `>= le_ra − 0.1q`→`sat_nut`; khác `can_co`; het_ky→`truot` |
| `toi` × giam | `least(1, greatest(0, (x−so)/q))` | `so <= y` | đảo chiều (`so <= le_ra` thắng; `<= le_ra + 0.1q` sát nút) |
| `toi` × giu | như tang (x<y) hoặc giam (x>y); x=y → pct 1 khi đạt | theo hướng | như trên |
| `tran_tich_luy` (so = Σ vi phạm) | null | `so > y`→**false** ngay; het_ky ∧ `so <= y`→true; khác **null** | `vuot`/`dat`/`so null`→`chua_biet`/`so <= le_ra`→`dang_giu`/`so <= y`→`sat_nut` |
| `giu` | null | het_ky → `so_ky_xet >= 1 ∧ so_ky_giu = so_ky_xet`; khác null | kỳ hiện tại: không số→`chua_biet`; đạt ngưỡng→`dang_giu`; không→`can_co`; het_ky hụt→`truot`. Ngưỡng: `chieu in ('tang','giu')` → `so >= y`; `giam` → `so <= y` [H-29]. Kỳ không số KHÔNG vào `so_ky_xet`. |
| `toc_do_ky` × giam | `least(1, greatest(0, (x−so_ky)/q))` | CHỈ kỳ cuối đã đóng: `so_ky <= y`; khác null | kỳ trống→`chua_biet`; `<= le_ra`→`dang_thang`; `<= le_ra + 0.1q`→`sat_nut`; khác `can_co` |
| `toc_do_ky` × tang | đối xứng | `so_ky >= y` | đối xứng |
| `ti_le_dat` | `least(1, so/y)` | `so >= y` | `dang_lam` |
| `chu` | null | `dong`+`dat` | `dang_lam` |

`so` KHÔNG kẹp ở y (55/50 hiện thật); chỉ `pct` kẹp 0..1. Mục tiêu `nhap/gui/tra_lai` vẫn tính
(màn thêm nhãn "chờ duyệt"); KPI/thi đua chỉ lấy `duyet`.

## 3. Gợi ý Thắng/Thua — `public.goi_y_cam_ket(p_cam_ket uuid)` (chốt C12)

Definer, TỰ GÁC: người gọi không đọc được cam kết (`doc_duoc_cam_ket`) và `auth.uid()` không null
→ trả toàn null. Trả `(goi_y text, so_dat_goi_y numeric, thuoc_trang_thai text)`.
Cửa sổ `[tuan_bat_dau, tuan_bat_dau + 7·so_tuan − 1]`, chủ thể = `cam_ket.student_id`.

1. `xong_at` not null → `'thang'`.
2. `thuoc_id` not null, chủ thể EM → `g = gia_thuoc(thuoc, tu, den, student_id)`:
   `g.trang_thai in ('dat','dang_giu')` → `'thang'`; `in ('truot','vuot')` → `'thua'`;
   `mien`/`chua_biet`/cửa sổ mở chưa đạt → null (kiêng chưa đủ ngày là im lặng, không thua).
3. Cam kết chủ thể LỚP/NHÓM nối thước `tung_em` (vá lỗ gợi ý chết): dùng `so_em_dat/so_em_can`
   của kỳ — cửa sổ đóng ∧ `so_em_dat = so_em_can` → `'thang'`; đóng ∧ thiếu → `'thua'`; mở → null.
4. Không thước (`muc_tieu_id` hoặc `lac_muc_tieu`) → null, kể cả có `so_hua/so_dat`
   ("không chấm cam kết bằng số kết quả").
5. `so_dat_goi_y = g.gia` khi `cam_ket.don_vi_id = thuoc.don_vi_id` — và CHỈ trả cho chính
   em/phụ huynh/thầy cô lớp; bạn cùng nhóm nhận `goi_y` nhưng `so_dat_goi_y = null` [H-12] —
   số hoạt động của bạn không lộ qua đường gợi ý.
6. Cam kết `huy` → null.

## 4. Hàm/view đọc cho từng màn (tệp 0166; gác theo 20-QUYEN §4)

| Đối tượng | Kiểu | Gác | Trả về / dùng ở |
|---|---|---|---|
| `muc_tieu_v` | view invoker trên `muc_tieu` + lateral `so_hien_tai(id)` | RLS muc_tieu | mọi cột + 16 cột §2 + `ten_don_vi` — thẻ em/cô/BGH/PH |
| `cam_ket_v` | view invoker + lateral `goi_y_cam_ket(id)` | RLS cam_ket | cột cam_ket + **`goi_y_may`, `so_dat_goi_y`** (đổi tên — `goi_y` là ảnh chụp lúc chấm đã có trong bảng) + `tuan_ket_thuc` |
| `viec_bang(p_student default null)` | definer | `p_student := coalesce(p_student, auth.uid())`; `p_student = (select auth.uid()) or can_view_student(p_student)` | một dòng/thước em phải ghi + thước `ca_doi` (cờ `chi_xem`), với `gia_thuoc` kỳ hiện tại, `ky_tu/ky_den`, `ten_don_vi`, `cach_ghi`, `chieu_dich`, `ngay_ap_dung`, `cho_bu` — khối "Việc em làm". 7 ô ngày: app đọc thẳng `luot` của chính em + `luot_bi_khoa`/`trong_cua_so_ghi`, KHÔNG hàm mới |
| `bang_ron(p_student default null)` | definer | như viec_bang | §4.1 |
| `thuoc_12_tuan(p_thuoc, p_chu_the default null, p_tuan_cuoi default null)` | definer | thước đọc được ∧ (`p_chu_the = uid` ∨ `is_my_child` ∨ `staff_can_read_class`; null chỉ với `ca_doi`/nhân sự) | 12 dòng tuần: cột `gia_thuoc` + `ky_tu/ky_den/ky_trang_thai` + `la_tuan_hoc` |
| `thuoc_lop_dem(p_thuoc, p_tuan default null)` | definer | `is_class_student ∨ staff_can_read_class ∨ is_parent_of_class` | CHỈ số đếm: `si_so, so_em_ghi, so_em_dat, gia_lop, chi_tieu, le_ra, mien`; **`si_so < 3` ∧ người gọi là học sinh → `gia_lop/trung bình` null** (L7) |
| `muc_tieu_lop_dem(p_muc_tieu)` | definer | như trên theo lớp của mục tiêu | `(so_dat, si_so, so_huong_vao)` — chuỗi `bangEm.caLop`, `mucTieu.nEmHuongVao` |
| `metrics_tuan(p_class, p_tu, p_den default null, p_student default null)` | definer | nhân sự: đủ; học sinh: ép `p_student = uid` + dòng lớp; PH: `is_my_child` | mỗi `(student_id∣null, week_start)`: `thuoc_tong, thuoc_dat, thuoc_mien, ck_tong, ck_thang, ck_thua, ck_chua_cham, pdr_da_ky` — thay `metrics_tuan_v` |
| `bang_lop_em(p_class, p_tuan default null)` | definer | `staff_can_read_class` | mỗi em: tên + đếm thước/cam kết/mục tiêu/`pdr_da_ky` — bảng lớp của cô |
| `bang_lop_thuoc(p_class, p_tuan default null)` | definer | `staff_can_read_class` | mỗi thước lớp/nhóm: `gia_lop, so_em_*, le_ra, trang_thai, mien` |
| `ty_le_em_tu_dat(p_class)` | definer | `staff_can_read_class` | `(so_muc_tieu, so_tu_dat, so_nhap_ho, ty_le)` — loại `nguoi_nhap_ho` |
| `co_so_tong_hop(p_tuan default null)` | definer | `auth_role()='admin' ∨ (principal ∧ campus)` | mỗi lớp active: `class_id, class_name, grade_name, grade_sort, gvcn_ten, si_so, mt_lop_duyet, mt_pct, mt_lop_dang_thang, mt_lop_can_co, thuoc_dat_pct, ck_giu_pct, pdr_ky_pct, cho_duyet` (đếm mục tiêu lớp 'gui' + thước 'gui') — trang BGH; `thu_tu_sap` app tự tính |
| `thi_dua_lop(p_class)` | definer | `is_class_student ∨ is_parent_of_class ∨ staff_can_read_class` | `(diem_muc_tieu, diem_thuoc, diem_cam_ket)` §4.2 |
| `class_competition_scores()` | definer, GIỮ CHỮ KÝ 5 cột (chốt C19) | như bản chạy | `score` = trung bình các số không null của ba điểm §4.2; cả ba null → 0 |
| `campus_rollup()` | definer, giữ chữ ký + tên cột `wig_count` | như bản chạy | `wig_count` := đếm `muc_tieu` cap='lop' `duyet` |
| drop ở 0168 | `child_*`, `school_wig_rollup`, `class_lead_board`, `pdr_bang`, `cam_ket_goi_y`, `metrics_tuan_v`, `lead_tuan_v`, `wig_progress_v` | | PH dùng `muc_tieu_v` + `viec_bang(con)` + `metrics_tuan(class,…,con)` |

KHÔNG có view per-chủ-thể kiểu `thuoc_tuan_v` (view invoker + lateral definer trên chủ thể khác
= rò dòng bạn cùng lớp — đúng hình lỗ 0150); mọi thứ per-chủ-thể đi qua hàm definer TỰ GÁC ở trên.

### 4.1 Băng rôn (`bang_ron`)

Tuần hiện tại W. Tuần nghỉ của cơ sở → `'nghi'`. `viec_tong` = thước em phải ghi có kỳ hiện tại
không `mien`; `viec_dung_nhip` = thước `trang_thai in ('dat','dang_thang','dang_giu')`. `ck_tong`
= cam kết `hieu_luc` phủ W; `ck_giu` = `ket_qua='thang'` ∨ (`ket_qua null` ∧ gợi ý `'thang'`).
`viec_tong + ck_tong = 0` → `'chua_co'` (im lặng, không "cần cố lên");
`r = (viec_dung_nhip + ck_giu)/(viec_tong + ck_tong)`: r=1 → `'dang_thang'`; r ≥ 0.5 →
`'sat_nut'`; khác → `'can_co'`. Trả thêm các số đếm cho `bangEm.tomTat`.

### 4.2 Thi đua — ba số tách (`thi_dua_lop`), `score` chỉ để xếp [H-22]

- `diem_muc_tieu` = `round(avg(pct)·100, 1)` trên mục tiêu `cap='lop'` `duyet`,
  `kieu_dich in ('toi','toc_do_ky','ti_le_dat')`, `pct` not null; không có → null
  (`chu/giu/tran_tich_luy` không vào — không quãng).
- `diem_thuoc` = `100·Σ ô đạt / Σ ô xét` trên ô `(chủ thể, thước, kỳ)` có `ky_den` trong 4 tuần
  ĐÃ ĐÓNG gần nhất; bỏ ô `mien`/`chua_biet`; mẫu 0 → null.
- `diem_cam_ket` = `100·thang/(thang+thua)` trên cam kết `hieu_luc` cửa sổ kết thúc trong 4 tuần
  đã đóng và ĐÃ CHẤM; chưa chấm không vào mẫu [H-22]; mẫu 0 → null.
- `score` = trung bình các số không null; cả ba null → 0. UI hiện ba số tách, không hiện score.
`class_competition_scores()` giữ 5 cột và tính `score` đúng công thức này; `class_ranks`/
`campus_ranks` không sửa.

### 4.3 Chỉ mục cần cho hai hàm lõi

`luot(thuoc_id, ngay)` · `luot(student_id, ngay)` · `so_do(muc_tieu_id, ngay desc, created_at desc)`
· `noi(cha_id)` + unique `(con_loai, con_id) where vai='gop_so'` · `tuan_hoc pk(campus_id,
week_start)` · `thuoc_lich_su(thuoc_id, tu_tuan desc)` · `moc_muc_tieu unique(muc_tieu_id, ngay)`
— tất cả đã khai ở 10-SCHEMA.

Hub (`private.hub_hang_doi_luot`): đặc tả + SQL ở 10-SCHEMA §5.2, hợp đồng ký ở 50-DI-TRU §5 —
tệp này không giữ bản thứ hai (bài học "hai bản hợp đồng").

## 5. Véc-tơ kiểm — dữ liệu vào → số ra (nguồn chân lý cho `test-phep-tinh-*.sql` + oracle)

Cảnh chung: **`T0 = greatest(vn_week_start(vn_today()) − 91, thứ Hai đầu tiên ≥ 01/08 của năm học
hiện tại)`** — đầu năm học các véc-tơ đòi "kỳ đã đóng" tự ghi `BỎ QUA (đầu năm học)` thay vì
HỎNG; đây là ngoại lệ có ghi nhận của luật tuần-xa 60-KIEM §0.6, và mọi phép "hôm nay" ghim qua
GUC `va.hom_nay` (§0.1). `T1 = T0+7` là tuần **nghỉ** (`tuan_hoc(campus Test, T1, 'nghi')`),
`T2 = T0+14`, `T3 = T0+21`. Em A = test1.hs, em B = agent1, N = sĩ số Test đọc lúc chạy.
Mục tiêu nền: `bat_dau = T0`, `ket_thuc = T0+139` (20 tuần, 19 tuần học = 133 ngày học).
Cột "Sai nếu" là chiều ngược: giá trị một cách làm ngây thơ trả về — test phải phân biệt được.

### 5.1 `test-phep-tinh-thuoc.sql` (V-T)

| # | Thước / dữ liệu | Gọi | Mong đợi | Sai nếu |
|---|---|---|---|---|
| V-T-01 | lớp tung_em, cham, tong×it_nhat, chỉ tiêu 3, ky 1, ngày {1..5}, tu_tuan T0. A: T0, T0+1, T0+3 mỗi dòng 1 | (T0, T0+6, A), hom_nay = T0+7 | gia 3, so_dong 3, chi_tieu 3, le_ra 3, dat t, 'dat' | |
| V-T-01b | như trên, B không dòng | (T0, T0+6, B) | gia NULL, so_dong 0, dat f, 'truot' | gia 0 |
| V-T-01c | như trên | (T0, T0+6, NULL) | gia 3, so_em_can N, so_em_ghi 1, so_em_dat 1, dat NULL | dat t |
| V-T-02 | T1 (tuần nghỉ), A: T1 một dòng 1 | (T1, T1+6, A) | gia 1, so_tuan_hoc 0, chi_tieu NULL, dat NULL, 'mien' | 'truot' |
| V-T-03 | em dien_so, tong×it_nhat, 60, {1..7}. A tuần T2: 20, **0**, 25 | (T2, T2+6), hom_nay > T2+6 | gia 45, so_dong 3, dat f, 'truot' | so_dong 2 (bỏ dòng 0) |
| V-T-04 | kiêng tong×nhieu_nhat, trần 1, {1..5}. A tuần T2: 0,0,1,0,0 | (T2, T2+6, A), đóng | gia 1, so_ngay_giu 5, dat t, 'dat' | |
| V-T-04b | B tuần T2: 4 ngày 0 (thiếu 1) | (T2, T2+6, B), đóng | gia 0, so_ngay_giu 4, dat NULL, 'chua_biet' | dat t (im lặng = thắng) |
| V-T-04c | A tuần T3: hai dòng 1,1 | (T3, T3+6, A) | gia 2, dat f, 'vuot' | |
| V-T-04d | tuần mở W, A ghi 0 đủ mọi ngày áp dụng đã qua | (W, W+6, A) | dat NULL, 'dang_giu' | 'dat' |
| V-T-04e | như V-T-04, A ghi 0 các ngày T2..T5 (thiếu T6) + MỘT dòng 0 vào thứ Bảy | (T2, T2+6, A), đóng | so_ngay_giu 4, dat NULL, 'chua_biet' | dat t (đếm dòng thay vì danh tính ngày) |
| V-T-04f | kiêng kỳ 1 tuần, tuần T1 NGHỈ, A lỡ 1 lần trong T1 | (T1, T1+6, A) | chi_tieu NULL, gia loại dòng tuần nghỉ → 'mien' | 'vuot' (nghỉ thành nghiêm hơn) |
| V-T-05 | moi_nhat×it_nhat, 8. A: T2+1 = 7; T2+3 stt1 = 7, stt2 = 9 | (T2, T2+6, A) | gia 9, ngay_cuoi T2+3, le_ra NULL, dat t | gia 7 / gia 23 |
| V-T-05b | B không dòng | (T2, T2+6, B) | gia NULL, dat NULL, 'chua_biet' | 'truot' |
| V-T-06 | dem_dat_nguong, ngưỡng 8, chỉ tiêu 2. A: 7, 8, 9.5, 8 | (T2, T2+6, A) | gia 3, dat t | gia 32.5 |
| V-T-07 | lớp ca_doi, dien_so, tong, 50. Dòng đội: 20, 35 | (T2, T2+6, NULL) và (T2, T2+6, A) | cả hai: gia 55, dat t, so_em_can NULL | hai lần gọi khác nhau |
| V-T-08 | ky_tuan 4, chỉ tiêu kỳ 20, {1..7}. A: 5 dòng T0 + 8 T2 + 3 T3 (=16) | (T0, T0+27, A), đóng | so_tuan_hoc 3, chi_tieu 15, gia 16, dat t | chi_tieu 20 → dat f |
| V-T-08b | như trên, 14 dòng | (T0, T0+27, A), đóng | dat f, 'truot' | |
| V-T-08c | như V-T-08 | (T0, T0+6, A) | so_tuan_hoc 1, chi_tieu 5, le_ra 5, gia 5, dat t | |
| V-T-09 | `thuoc_lich_su(T2, 10, hieu_luc)` cho thước V-T-01 | (T2, T2+6, A) với 3 dòng | chi_tieu 10, dat f | chi_tieu 3 |
| V-T-09b | `thuoc_lich_su(T3, NULL, hieu_luc)` (tạm dừng) | (T3, T3+6, A) | 'mien' | |
| V-T-09c | `thuoc_lich_su(T2, 1, cho_duyet)` | (T2, T2+6, A) | chi_tieu vẫn 3 (dòng cho_duyet KHÔNG vào) | chi_tieu 1 — vượt vòng duyệt bằng phép đọc |
| V-T-10 | thước V-T-01, A thêm dòng thứ Bảy T0+5 = 1 (cho_bu) | (T0, T0+6, A) | gia 4, so_ngay_ap_dung 5 | gia 3 |

### 5.2 `test-phep-tinh-muc-tieu.sql` (V-M)

| # | Mục tiêu | Dữ liệu | p_ky | Mong đợi | Sai nếu |
|---|---|---|---|---|---|
| V-M-01 | em toi×tang ghi_tay 6,5→8 | so_do T0+3=6,5; T2+1=7,2 | T2+6 | so 7,2; le_ra 6,5 + 1,5·14/133 ≈ 6,6579; pct ≈ 0,4667; dat f; 'dang_thang' | le_ra nội suy theo ngày lịch |
| V-M-01b | + moc_muc_tieu(T2+6, 7,5) | như trên | T2+6 | le_ra 7,5; 'can_co' (7,2 < 7,35) | 'dang_thang' |
| V-M-01c | + so_do T3 = 8,1 | | T3+6 | dat t, 'dat', pct 1 | |
| V-M-01d | chua_do_x (x null) | | T2+6 | le_ra NULL, pct NULL, 'dang_lam' | |
| V-M-02 | toi×giam 20→17 | so_do T2 = 18,2 | T2+6 | so 18,2; le_ra = 20 − 3·14/133 ≈ 19,6842; pct 0,6; 'dang_thang' | pct −0,6 |
| V-M-03 | lớp tran_tich_luy y 3, ghi_tay | so_do T0+2=1; T2+2=2 | T2+6 | so 2; le_ra 3·14/133 ≈ 0,3158; dat NULL; 'sat_nut' | dat t (chưa hết kỳ) |
| V-M-03b | như trên | | ket_thuc+1 | dat t, 'dat' | |
| V-M-03c | + so_do T3 = 4 | | T3+6 | dat f, 'vuot' | |
| V-M-04 | em giu tang y 8, ky thang, ghi_tay | so_do T0+3=8,5; T2+1=7,9; T0+30=8,2 | T0+34 | ky_tu T0+28, so 8,2, so_ky_xet 2, so_ky_giu 1, dat NULL, 'dang_giu' | so_ky_giu 2 (lấy số đầu kỳ) |
| V-M-04b | như trên | | ket_thuc+1 | dat f, 'truot' (kỳ 1 hụt: 7,9) | dat t |
| V-M-04c | bỏ dòng T2+1 | | ket_thuc+1 | so_ky_xet 2, so_ky_giu 2, dat t (kỳ trống không xét) | dat f vì kỳ trống |
| V-M-05 | em toc_do_ky×giam 20→5, ky thang, nguon thuoc (dây gop_so từ thước kiêng) | luot kỳ 1 Σ12; kỳ 2 Σ6 (tới T0+34) | T0+34 | so 6; ky_tu T0+28; le_ra 20 − 15·49/133 ≈ 14,4737; dat NULL; 'dang_thang' | so 18 (cộng dồn) |
| V-M-06 | lớp ti_le_dat y 80, lay_tu muc_tieu_em, lọc subject Toán | A: mt Toán duyet dat t; B: mt Toán duyet dat f; A có mt Văn dat t (bị lọc) | nay | tu_so 1, mau_so N, so 100/N, dat f | mau_so 2 (đếm con có dây) |
| V-M-06b | + nguong_con 7, mt B so 7,5 | | nay | tu_so 2 | |
| V-M-07 | chu | — | nay | so NULL, pct NULL, dat f, 'dang_lam'; sau dong/dat → dat t | |
| V-M-08 | lớp con + trung_binh | 3 con: A 7,5; B 6,5; C không số | nay | so 7,0; so_nguon 3 | so 4,67 (C = 0) |
| V-M-09 | lớp con + cong, 0→1200 | A "0→40" so 50; B "0→30" so 10; C 'gui' so 20 | nay | so 50 (A kẹp 40; C không tính) | 60 / 80 |
| V-M-09b | + con GIẢM 20→17 đang 18,2; + con tăng đi lùi (so < x) | | nay | con giảm góp 1,8; con lùi góp 0 | góp âm |
| V-M-10 | lớp toi×tang nguon thuoc, dây gop_so thước V-T-01 (chỉ tiêu 3) | T0: A5 B2 · T1 nghỉ: A4 · T2: A3 B3 | T2+6 | so 14 (kẹp kỳ: 3+2 · 3 · 3+3) | 17 (không kẹp) / 6 (kẹp năm) |
| V-M-10b | dây he_so 2 | | T2+6 | so 28 | |
| V-M-10c | dây đổi thành chi_huong | | T2+6 | so 0 (= x), so_nguon 0 | so 14 |
| V-M-10d | mục tiêu CAP='em' của A, thước của A | A T0: 5 | T0+6 | so 5 (cá nhân không kẹp) | 3 |
| V-M-11 | V-M-01 + lich_su_dich(y 8→9, luc = T2+3 12:00) | | T2 / T3 | y 8 tại T2; y 9 tại T3 | |
| V-M-12 | V-M-01 nhưng dong/doi | | nay | dat NULL, 'dong', so 7,2 | |
| V-M-13 | hai mục tiêu lớp nối gop_so VÒNG (dựng bằng postgres, lách noi_hop_le) | | nay | không đổ; so NULL (chốt độ sâu) | stack depth exceeded |
| V-M-14 | em thanh_phan 4 kỹ năng, gop trung_binh, so_do 7; 6; 6,5; (phần 4 trống) | | nay | so 6,5 (avg 3 phần có số), nguon 'may_tu_thanh_phan' | đếm phần trống = 0 |
| V-M-14b | như trên, gop cong | | nay | so NULL (thiếu một phần) | so 19,5 |
| V-M-15 | nguon_so he_thong (chuyên cần lớp), 7 dòng attendance giả | | nay | so = % present+late; nguon 'he_thong' | |

### 5.3 `test-phep-tinh-goi-y.sql` (V-G)

| # | Cam kết | Mong đợi |
|---|---|---|
| V-G-01 | tuần T2, thước của A đủ chỉ tiêu | 'thang' |
| V-G-02 | tuần T2, thước V-T-01, B không dòng, cửa sổ đóng | 'thua' |
| V-G-03 | thước kiêng, B 4/5 ngày | NULL (không phải 'thua') |
| V-G-04 | chỉ muc_tieu_id, so_hua 50, so_dat 55 | goi_y NULL, so_dat giữ nguyên |
| V-G-05 | xong_at not null, không thước | 'thang' |
| V-G-06 | lac_muc_tieu | NULL |
| V-G-07 | tuần mở, thước it_nhat đã đạt / chưa đạt | 'thang' / NULL |
| V-G-08 | so_tuan 2, thước ky 1, tuần 1 đạt tuần 2 hụt (Σ < 2 chỉ tiêu) | 'thua' (xét cả cửa sổ) |
| V-G-09 | em gọi cho cam kết của bạn KHÔNG cùng nhóm | NULL toàn bộ (tự gác) |
| V-G-10 | BẠN CÙNG NHÓM (buddy) gọi cho cam kết của bạn | goi_y có, **so_dat_goi_y NULL** |
| V-G-11 | cam kết LỚP nối thước tung_em, kỳ đóng đủ so_em_dat = so_em_can / thiếu | 'thang' / 'thua' |

### 5.4 `test-phep-tinh-bang-ron.sql` (V-N)

V-N-00 **A tự gọi `bang_ron()`/`viec_bang()` không tham số → CÓ dòng** (chiều ngược của lỗ
can_view_student) · V-N-01 tuần nghỉ → 'nghi' · V-N-02 A: 2 thước (1 dang_thang, 1 can_co) + 1
cam kết gợi ý thắng → r = 2/3 → 'sat_nut', các số đếm đúng · V-N-03 không thước không cam kết →
'chua_co' · V-N-04 tất cả đúng nhịp → 'dang_thang' · V-N-05 B gọi `bang_ron(A)` → 0 dòng ·
V-N-06 `bang_lop_em`: thước lớp tung_em 2/4 em đủ → 'viec 2/4'; em không phải ghi (ca_doi) không
vào mẫu.

### 5.5 `test-phep-tinh-thi-dua-ba-so.sql` (V-D)

V-D-01 lớp có mt toi pct 0,6 + mt chu + mt giu → diem_muc_tieu 60 (sai nếu 30/20) ·
V-D-02 **12 ô** (em, thước, kỳ) đóng trong 4 tuần: 2 `mien` + 1 `chua_biet` bị bỏ, 6/9 đạt →
diem_thuoc ≈ 66,7 (sai nếu 50 = 6/12) · V-D-03 5 cam kết: 3 thắng 1 thua 1 chưa chấm →
diem_cam_ket 75 (sai nếu 60) · V-D-04 score = avg các số có mặt; lớp không thước →
score = avg(diem_muc_tieu, diem_cam_ket) · V-D-05 `class_ranks` vẫn trả đúng bộ cột như trước
(không drop function đổi chữ ký).

### 5.6 `test-hub-luot.sql` — ở 60-KIEM §1.12 (đối chiếu payload theo 10-SCHEMA §5.2; thêm ca
thước `he_thong` → 0 dòng outbox).

### 5.7 Oracle độc lập `scripts/test-phep-tinh-oracle.mjs`

Đọc CÙNG bảng véc-tơ (tệp này, parse markdown), tính bằng JS thuần viết ĐỘC LẬP (không import
`lib/*`), so ba chiều JS ↔ bảng ↔ SQL (gọi `private.*` qua `pg`, transaction rollback, set GUC
`va.hom_nay`). Lệch = một bên sai; KHÔNG sửa oracle cho khớp SQL mà không ghi lý do (0132).
Thêm 200 véc-tơ ngẫu nhiên `--seed 42` cho tổ hợp `gop × chieu_dich × cho_bu × ky_tuan`
(chỉ so JS ↔ SQL); in véc-tơ lệch đầu tiên dạng JSON để dán vào bảng làm ca tay.

## 6. [HỎI] của mảng này

Đã gom về 00-TONG-QUAN §6: H-19 (tháng 4 tuần, tuần nghỉ), H-20 (so_do số đang ở, ghi bù),
H-21 (kẹp), H-22 (thi đua), H-29 (hướng giữ), H-12 (so_dat_goi_y với bạn). Không còn [HỎI]
riêng lẻ trong thân tệp.
