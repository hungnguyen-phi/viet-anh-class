# 40-MAN-HINH — Màn từng vai, bảng chuỗi vi/en, câu lỗi (PA2, bản chốt)

Vì sao bảng chuỗi nằm trong đặc tả chứ không "để lúc code tính": luật ② là luật cứng — bản VI
không WIG/lead/PDR/buddy/"luỹ kế"/"cô" trần, và chuỗi VI dài hơn EN 20–30% nên quyết định bố cục
phải cầm chuỗi thật. Bản này đã sửa theo phản biện: `noiDungPh` hết chữ "lead", chữ ký tách hai
chuỗi theo cờ nhập hộ, luật "chấm từ thứ Sáu" đã XUỐNG trigger (màn chỉ mờ nút), ghi-bù tách khỏi
nhập-hộ, bế tắc ký-với-cam-kết-nhiều-tuần đã gỡ (chỉ đếm cam kết TỚI HẠN), màn BGH gọi đúng
`co_so_tong_hop`. Luật ① giữ nguyên tuyệt đối: navy `#26275d` + gold `#f9dd0e`, Baloo 2 + Nunito,
nền trắng, tái dùng `components/ui/` — mọi màn mới là màn TRONG hệ này. Mọi form theo bài học
31/08: MỌI ô nhập trong form `useActionState` là controlled. Tên hàm đọc số theo 30-PHEP-TINH §4;
móc `data-kiem` theo 60-KIEM §3.1.

## A. Route, nav, nguyên tắc

- Giữ URL `/wig` [H-26], nhãn tab `nav.wig` = "Mục tiêu"/"WIG". Gỡ route `/meeting`,
  `/wig/chi-tiet`, `/wig/hop`, `/student/hop` (PR-4); `robots.ts` bỏ `/meeting`.
- Vị trí khu (ngân sách nav — NAV_IA): màn em `/student`; màn cô `/wig` (mục tiêu lớp, việc lớp,
  cam kết lớp, các em, mẫu, chờ duyệt); **nhóm quản ở `/roster`** (cạnh khu bạn học);
  **lịch tuần học sửa ở `/campus`** (cấp cơ sở), `/wig` chỉ XEM (`lichXem`).
- Server action theo QUY ƯỚC APP §1 (kiểu A trả state, câu lỗi trỏ đúng ô, kiểm `data.length===0`
  sau ghi); mọi số đọc từ hàm 30 §4, KHÔNG tự cộng ở component (L12).
- Namespace client mới thêm vào `NAMESPACE_CHO_CLIENT`: `tuan, bangEm, mucTieu, viec, camKet,
  duyet, lopMucTieu, coSoMucTieu` (8 cái — H.1 kiểm); namespace gỡ: `goal, wig, meeting,
  studentWig, metrics, scoreboard`.

## B. Màn của em — `/student` (viết lại `StudentScoreboard`)

Bố cục dọc, đúng ở 360px trước: ① Hero + điểm danh cảm xúc (GIỮ nguyên khối cũ) → ② **băng rôn
5 giây** (`bang_ron()`: một dòng ĐANG THẮNG / SÁT NÚT / CẦN CỐ LÊN / tuần nghỉ / im lặng khi
`chua_co`) → ③ khu **Mục tiêu của em** (≤4 thẻ `muc_tieu_v`: câu đích, "Đang ở {so} {dv}" + nguồn
+ ngày, thanh ngang + vạch "hôm nay lẽ ra" khi có quãng, nhãn trạng thái `mucTieu.tt_*`, chip chờ
duyệt/trả lại kèm lời nhắn, nút Ghi số khi `nguon_so='ghi_tay'/'thanh_phan'`, dây "Hướng tới/Góp
số vào", đóng/sửa/tập trung) + nút thêm (mẫu của lớp trước, tự viết sau) → ④ khu **Việc em làm**
(`viec_bang()`: mỗi thước một hàng — 12 ô tuần `thuoc_12_tuan` + 7 ô ngày tuần đang xem; ô ngày
đọc `luot` của chính em; ô mở/khoá theo `trong_cua_so_ghi` + `luot_bi_khoa` — khoá thì nói lý do
bằng chữ `viec.ngayKhoa7`/`ngayKhoaKy`; chạm hoặc điền số theo `cach_ghi`; kiêng ghi 0 =
giữ được) → ⑤ khu **Cam kết tuần này** (`cam_ket_v`: ≤2 thẻ; nút Thắng/Thua chỉ MỞ từ thứ Sáu
tuần cuối hoặc khi có `xong_at` — trigger là luật thật, nút mờ kèm tooltip; gợi ý máy
(`goi_y_may`) đứng CẠNH nút, không tự chọn; người chứng hiện `camKet.xacNhan*`) → ⑥ khu **Họp
của em** (HopPdr: câu 1 nhắc lời hứa, câu 2 kể lại TỪNG cam kết tới hạn qua `pdr_ke_lai` — cam
kết nhiều tuần chưa tới hạn hiện chip `camKet.tuanN` + `pdr.q2ChuaToiHan`, KHÔNG bắt chấm; q3–q5
giữ; câu 6 = form cam kết mới 1–4 tuần; nút Ghi nhận theo L8) → ⑦ MyRequests/RequestInbox theo
kind mới. Tuần điều hướng bằng `WeekNav` giữ nguyên.

Form 3 bước mục tiêu (`FormMucTieu3Buoc`) và form 4 bước việc (`FormViec`): cấu trúc + `data-kiem`
theo 60 §3.1; mọi ô controlled; câu ráp lại (`cauChot*`/`cauRap`) cập nhật sống; lỗi máy chủ
không xoá ô đã gõ; `mt-loi`/`th-loi` trỏ đúng ô.

## C. Màn cô — `/wig`, và BGH — `/campus`

**`/wig` (GVCN):** đầu trang BA SỐ TÁCH (`thi_dua_lop` — không cộng thành một điểm, `baSoHint`);
khu Mục tiêu lớp (thẻ `muc_tieu_v` + ô "Ghi số hôm nay" cho mọi mục tiêu `ghi_tay` bất kể đơn
vị); khu Việc của lớp (`bang_lop_thuoc`: "n/m bạn đủ", lượt `ca_doi` cô điền); khu Cam kết lớp
(cô chấm — chỉ GVCN/admin); khu Các em (`bang_lop_em`: đếm, cột Họp bạn `pdr_da_ky`, nút "Ghi bù
cho em" MỌI LỚP — C25; lớp `nhap_ho` thêm nút nhập nội dung hộ); khu Mẫu (≤8, `muc_tieu_mau`);
khu Chờ duyệt (`duyet` namespace — CHỈ mục tiêu `gui` cấp em + thước `gui` + `thuoc_lich_su`
`cho_duyet`; KHÔNG có hàng cam kết; thước lớp hạ >30% cũng hiện ở đây vì GVCN tự duyệt lại — Q6).
Mục tiêu LỚP cô tạo → gửi BGH (`mucTieu.choBghDuyet` — khoá nằm ở namespace `mucTieu`, F8 không
có khoá này; góp ý #11).

**`/campus` (BGH):**
- C1 `MucTieuTruong3Buoc`: thẻ mục tiêu cấp trường (`muc_tieu_v`), đủ 4 nhóm `nguonSo`
  (`gopCon`, `layTu`, `locLinhVuc`, `thanhPhan`); BGH tạo là `duyet` ngay. Rỗng: `mucTieuTrong`.
- C2 `ChoDuyetLop`: mục tiêu lớp `gui` trong cơ sở → `NutDuyet`/trả lại (Popup lý do). KHÔNG có
  thước ở đây (thước do GVCN duyệt — C11).
- C3 `LopDiCham`: bảng từ **`co_so_tong_hop`** (đúng tên hàm 30 §4): cột lớp · GVCN (`gvcn_ten`)
  · % tới đích (`mt_pct`, null → "—") · việc (`thuoc_dat_pct`) · cam kết (`ck_giu_pct`) · họp
  (`pdr_ky_pct`) · chờ duyệt (`cho_duyet`). Sắp theo `thu_tu_sap` = trung bình các % có số, TÍNH
  PHÍA APP, không render, không lưu; tô `bg-status-bad/[0.06]` khi có ≥1 số < 50%. Rỗng:
  `lopChamTrong` ("chưa vào cuộc, không phải đang thua").
- C4 `LichTuanHoc` (client): lưới 52 tuần (desktop) / danh sách theo tháng (360px). Action
  `datTuanHoc(week_start, loai_dich)` nhận **loại ĐÍCH tường minh** (không "kế tiếp"), trả loại
  hiện hành để client hoàn màu; ô disable lúc pending. **Tuần < tuần hiện tại: Popup xác nhận
  "Đổi tuần đã qua sẽ tính lại thắng/thua của mọi lớp trong cơ sở" + `log_audit('doi_tuan_hoc_qua_khu')`.**
- C5 `CongTacNhapHo`: mỗi lớp một hàng, chip bật/tắt `classes.nhap_ho` — BGH cùng cơ sở + admin
  [H-15] (`protect_class_privileged_cols` đã mở vế này — 20 §2.15).

## D. Phụ huynh `/report`, admin, IntroGuide

- `/report`: khối `report.wigProgress` = ≤4 thẻ `muc_tieu_v` chỉ đọc (con); `report.viecTuan` =
  hàng việc chỉ đọc (12 ô + 7 ô, không nút); `report.camKetTuan` = thẻ cam kết chỉ đọc — nút
  `camKet.xacNhanNut` ĐỂ SAU [H-28]; vai buddy hiện `camKet.xacNhanBan` (không tên bạn);
  `report.hopBan/hopChua` theo `pdr_da_ky`. Không LLM, không tên bạn khác.
- Admin: đếm `muc_tieu`+`thuoc` thay `wigs`; bỏ link `/meeting`; chữ `admin.*` đổi "WIG"→"mục tiêu".
- `IntroGuide.tsx`: bước "Lớp mình làm việc thế nào?" viết lại bằng ba chữ Mục tiêu / Việc em làm
  / Cam kết, bỏ "(WIG)".

## E. Quyết định của mảng màn (đã hợp nhất với 00 §3)

| # | Quyết định | Một dòng |
|---|---|---|
| Q1 | Giữ URL `/wig`, đổi nhãn | không đụng 6 tệp hạ tầng vì một chuỗi |
| Q2 | Thanh ngang + vạch "lẽ ra" thay donut | đọc được ở 360px |
| Q3 | Tuần `thi` tính như tuần học | §0.3 của 30 |
| Q4 | 12 ô = 12 tuần, màu theo kỳ chứa tuần | đọc được ky_tuan 2/4 không đổi lưới |
| Q5 | Chấm từ thứ Sáu tuần cuối = TRIGGER (23514), màn chỉ mờ nút | luật quyền nằm ở CSDL |
| Q6 | Thước lớp hạ >30% → GVCN tự duyệt lại (C11) — hiện ở Chờ duyệt của `/wig`, không sang BGH | |
| Q7 | Nhóm ở `/roster`; lịch tuần học sửa ở `/campus` | ngân sách nav |
| Q8 | `XinSuaMucTieu` gỡ; em sửa thẳng → về `gui`; edit_requests còn `doi_ten_thuoc, mo_tuan_da_ky, khac` | trigger whitelist đã lo |
| Q9 | Câu 2 kể lại ghi `pdr_ke_lai`, kết quả chép về `cam_ket` | một sự thật hai chỗ đọc |
| Q10 | Ghi bù (mọi lớp, GVCN) TÁCH khỏi nhập hộ (khối 1–3, nội dung) | C25 |
| Q11 | Cam kết nhiều tuần: câu 2 chỉ BẮT chấm cam kết tới hạn (`tuan_ket_thuc ≤ tuần kể lại`) | gỡ bế tắc ký |

## F. BẢNG CHUỖI i18n

Thêm bằng `node scripts/them-khoa-i18n.mjs '{"ns.key":["vi","en"]}'`; xoá namespace cũ bằng
`xoa-khoa-i18n.mjs`. Cột EN giữ thuật ngữ v3; `{…}` là tham số ICU. **Khoá đếm ở cột EN dùng ICU
plural** (`{n, plural, one {# week} other {# weeks}}`) — bảng dưới viết dạng other cho gọn,
người thêm khoá tự bọc plural cho: conLai, tuanNhieu, ackCon, lichSuDich, nEmHuongVao, xemDaDong,
canhBaoNhieu, chuaCham, du4/du2 (EN).

### F1. `tuan` (client)

| key | vi | en |
|---|---|---|
| weekPrev | Tuần trước | Previous week |
| weekNext | Tuần sau | Next week |
| weekNow | TUẦN NÀY | THIS WEEK |
| weekPast | ĐÃ QUA | PAST |
| weekFuture | SẮP TỚI | UPCOMING |
| weekPick | Chọn tuần | Pick a week |
| weekPickHint | Chọn một ngày bất kỳ — máy tự lấy trọn tuần có ngày đó. | Pick any day — the whole week containing it is used. |
| hoc | Tuần học | School week |
| nghi | Tuần nghỉ | Break week |
| thi | Tuần thi | Exam week |
| nghiBanner | Tuần này nghỉ — không tính thắng thua. Em vẫn ghi việc được nếu muốn. | Break week — no win/loss this week. You can still log lead measures. |
| thiBanner | Tuần thi — chúc em thi tốt! Việc vẫn ghi như thường. | Exam week — good luck! Lead measures are logged as usual. |
| conLai | còn {n} tuần học | {n} school weeks left |

### F2. `bangEm` (client)

| key | vi | en |
|---|---|---|
| thang | ĐANG THẮNG | WINNING |
| satNut | SÁT NÚT | CLOSE CALL |
| canCo | CẦN CỐ LÊN | PUSH HARDER |
| chuaCo | CHƯA CÓ VIỆC NÀO | NOTHING TO TRACK YET |
| chuaCoHint | Thêm một việc để làm mỗi ngày, bảng sẽ cho em biết đang thắng hay thua. | Add a lead measure and this board will tell you if you're winning. |
| tomTat | Việc đủ {du}/{tong} · Cam kết giữ {giu}/{ck} | Lead measures met {du}/{tong} · Commitments kept {giu}/{ck} |
| tomTatChuaCham | Việc đủ {du}/{tong} · {n} cam kết chưa chấm | Lead measures met {du}/{tong} · {n} commitments unscored |
| khuMucTieu | Mục tiêu của em | My WIGs |
| khuViec | Việc em làm | My lead measures |
| khuCamKet | Cam kết tuần này | This week's commitments |
| khuHop | Họp của em | My meetings |
| daChotHop | Tuần này đã chốt trong buổi họp với bạn — muốn sửa thì nhờ thầy cô. | This week is locked by your PDR sign-off — ask your teacher to change anything. |
| caLop | Cả lớp: {n}/{si} bạn đã đạt | Class: {n}/{si} students reached it |
| xemDaDong | Mục tiêu đã đóng ({n}) | Closed WIGs ({n}) |

### F3. `mucTieu` (client) — thẻ

| key | vi | en |
|---|---|---|
| tt_dat | Đã đạt | Achieved |
| tt_dang_thang | Đang thắng | Winning |
| tt_dang_giu | Đang giữ được | Holding |
| tt_sat_nut | Sát nút | Close call |
| tt_dang_lam | Đang làm | In progress |
| tt_chua_biet | Chưa biết | Unknown |
| tt_can_co | Cần cố lên | Push harder |
| tt_vuot | Đã vượt | Over the cap |
| tt_truot | Chưa đạt | Not achieved |
| tt_mien | Tuần nghỉ | Break |
| tt_dong | Đã đóng | Closed |
| choDuyet | Chờ thầy cô duyệt | Awaiting teacher approval |
| choBghDuyet | Chờ ban giám hiệu duyệt | Awaiting principal approval |
| traLai | Thầy cô trả lại | Returned by teacher |
| lyDoTraLai | Thầy cô nhắn: {note} | Teacher's note: {note} |
| nhap | Nháp — chưa gửi | Draft — not sent |
| daDong | Đã đóng | Closed |
| dangTapTrung | Đang tập trung | In focus |
| tapTrung | Tập trung vào mục tiêu này | Focus on this WIG |
| boTapTrung | Thôi tập trung | Remove focus |
| tapTrungDu | Em đang tập trung 2 mục tiêu rồi — bỏ một cái trước nhé. | You already focus on 2 WIGs — unfocus one first. |
| tuDen | Từ {x} lên {y} {dv} · trước {ngay} | From {x} to {y} {dv} · by {ngay} |
| tuDenGiam | Từ {x} xuống {y} {dv} · trước {ngay} | From {x} down to {y} {dv} · by {ngay} |
| chuaBietDen | Chưa biết đang ở đâu → {y} {dv} · trước {ngay} | Starting point unknown → {y} {dv} · by {ngay} |
| giuMuc | Giữ {dau} {y} {dv} suốt năm | Keep {dau} {y} {dv} all year |
| moiKyKhongQua | Mỗi {ky} không quá {y} {dv} | No more than {y} {dv} per {ky} |
| caNamKhongQua | Cả năm không quá {y} {dv} | No more than {y} {dv} all year |
| dangO | Đang ở {so} {dv} | Now at {so} {dv} |
| nguonEm | em ghi {ngay} | you logged {ngay} |
| nguonThayCo | thầy cô ghi {ngay} | teacher logged {ngay} |
| nguonMay | máy cộng từ {n} việc | auto-summed from {n} lead measures |
| nguonHeThong | máy ghi từ {nguon} {ngay} | system from {nguon} {ngay} |
| nguonCon | gộp từ {n} mục tiêu | rolled up from {n} WIGs |
| nguonThanhPhan | máy gộp từ {n} phần | combined from {n} components |
| chuaCoSo | Chưa có số nào — ghi số đầu tiên nhé. | No number yet — log the first one. |
| leRaHomNay | Hôm nay lẽ ra {so} {dv} | Should be {so} {dv} by today |
| dangGiuDuoc | Đang giữ được | Holding |
| daVuot | Đã vượt: {so}/{y} {dv} | Over the cap: {so}/{y} {dv} |
| kyNay | {ky} này: {so}/{y} {dv} | This {ky}: {so}/{y} {dv} |
| daDat | Đã đạt | Achieved |
| chuaDat | Chưa đạt | Not yet |
| chuaBiet | Chưa biết | Unknown |
| huongVao | Hướng tới mục tiêu lớp: {ten} | Aligned to class WIG: {ten} |
| gopVao | Góp số vào: {ten} | Feeds into: {ten} |
| gopVaoLopCu | Góp vào lớp cũ: {ten} | Feeds into former class: {ten} |
| ghiSo | Ghi số | Log a number |
| ghiSoHoi | Số của em hôm {ngay} | Your number on {ngay} |
| ghiSoNgay | Ngày đo | Date measured |
| ghiSoLuu | Ghi | Save |
| ghiSoTrung | Hôm đó em đã ghi rồi — máy sẽ dùng số mới, các lần ghi cũ vẫn xem lại được. | You already logged that day — the app uses the newest number; older entries stay in the history. |
| xemCacLanGhi | Xem các lần ghi | View log history |
| lanGhiTrong | Chưa có lần ghi nào. | Nothing logged yet. |
| sua | Sửa | Edit |
| suaVi | Vì sao em đổi số? | Why change the numbers? |
| suaVeChoDuyet | Sửa xong, mục tiêu quay lại chờ thầy cô duyệt. | After editing, the WIG goes back for approval. |
| dong | Đóng mục tiêu | Close WIG |
| dongVi | Vì sao em đóng mục tiêu này? | Why are you closing this WIG? |
| dongDat | Em đã đạt | I achieved it |
| dongDoi | Em đổi mục tiêu khác | I'm changing to another WIG |
| dongBo | Em thôi mục tiêu này | I'm dropping it |
| xoa | Xoá | Delete |
| xoaHoi | Xoá mục tiêu này? Chỉ xoá được khi chưa có số nào ghi dưới nó. | Delete this WIG? Only possible while nothing has been logged under it. |
| du4 | Em đang có 4 mục tiêu — đủ rồi. Đóng một mục tiêu nếu muốn thêm. | You have 4 WIGs — that's the limit. Close one to add another. |
| trong | Em chưa có mục tiêu nào. | No WIG yet. |
| trongMau | Bắt đầu từ mẫu của lớp — em chỉ cần điền số. | Start from a class template — you only fill in the numbers. |
| them | Đặt mục tiêu | Add a WIG |
| themTuMau | Chọn từ mẫu của lớp | Pick from class templates |
| tuViet | Em tự viết | Write my own |
| linhVucKhac | Khác | Other |
| lichSuDich | Đã đổi đích {n} lần | Target changed {n} times |
| nEmHuongVao | {n} em hướng vào mục tiêu này | {n} students aligned to this WIG |

### F4. `mucTieu` — form 3 bước

| key | vi | en |
|---|---|---|
| formTitle | Đặt mục tiêu của em | Set my WIG |
| formTitleSua | Sửa mục tiêu | Edit WIG |
| formTitleLop | Mục tiêu của lớp | Class WIG |
| formTitleTruong | Mục tiêu của cơ sở | Campus WIG |
| formTitleHo | Đặt mục tiêu cho {ten} | Set a WIG for {ten} |
| chipGoGiup | Thầy cô gõ giúp | Typed by teacher |
| mauLop | Mẫu của lớp | Class templates |
| mauChon | Dùng mẫu này | Use this template |
| mauKhoa | Chữ lấy từ mẫu — em chỉ điền số. | Text comes from the template — just fill in the numbers. |
| mauSuaChu | Sửa chữ | Edit text |
| buoc1 | ① Em muốn tiến bộ ở việc gì? | ① What do you want to get better at? |
| buoc1Lop | ① Lớp muốn đạt điều gì? | ① What will the class achieve? |
| buoc2 | ② Từ đâu tới đâu, trước ngày nào? | ② From where to where, by when? |
| buoc3 | ③ Đọc lại câu mục tiêu | ③ Read your WIG back |
| ten | Em muốn | I want to |
| tenLop | Lớp sẽ | The class will |
| tenPh | vd: nâng điểm Toán | e.g. raise my Maths score |
| linhVuc | Lĩnh vực | Domain |
| mon | Môn (nếu có) | Subject (optional) |
| monChon | Chọn môn | Pick a subject |
| tu | Từ | From |
| den | Đến | To |
| donVi | Đơn vị | Unit |
| donViChon | Chọn đơn vị | Pick a unit |
| donViThieu | Thiếu đơn vị em cần? Nhờ thầy cô thêm nhé. | Missing a unit? Ask your teacher to add it. |
| chuaBietX | Em chưa biết mình đang ở đâu | I don't know my starting point yet |
| kieuSo | Số này là số em… | This number is one I… |
| kieuDem | ĐẾM — cộng dần lên (bài, buổi, lần) | COUNT — adds up (exercises, sessions, times) |
| kieuDo | ĐO — đo lại mỗi lần (điểm, phút chạy, %) | MEASURE — re-measured each time (score, minutes, %) |
| giuMucNam | Giữ mức này suốt năm | Keep this level all year |
| giamTheo | Em muốn ít đi theo cách nào? | How should it go down? |
| giamTuan | Mỗi tuần không quá {y} | At most {y} per week |
| giamThang | Mỗi 4 tuần không quá {y} | At most {y} per 4 weeks |
| giamNam | Cả năm không quá {y} | At most {y} all year |
| chieuHoi | Vậy là em muốn | So you want it to |
| chieuTang | tăng lên | go up |
| chieuGiam | giảm xuống | go down |
| truocNgay | Trước ngày | By |
| tuNgay | Bắt đầu từ | Starting |
| khongSo | Mục tiêu này không đếm bằng số | This WIG has no number |
| yChu | Em sẽ đạt được gì? (viết bằng lời) | What will you achieve? (in words) |
| gopLop | Mục tiêu này hướng tới mục tiêu nào của lớp? (không bắt buộc) | Which class WIG does this align to? (optional) |
| gopLopKhong | Không hướng tới mục tiêu lớp nào | Not aligned to a class WIG |
| cauChot | Em sẽ {ten}, từ {x} {chieu} {y} {dv}, trước {ngay}. | I will {ten}, from {x} {chieu} {y} {dv}, by {ngay}. |
| cauChotChuaX | Em sẽ {ten}, tới {y} {dv}, trước {ngay}. | I will {ten}, reaching {y} {dv}, by {ngay}. |
| cauChotGiu | Em sẽ {ten}: giữ {dau} {y} {dv} suốt năm. | I will {ten}: keep {dau} {y} {dv} all year. |
| cauChotKy | Em sẽ {ten}: mỗi {ky} không quá {y} {dv}. | I will {ten}: at most {y} {dv} per {ky}. |
| cauChotNam | Em sẽ {ten}: cả năm không quá {y} {dv}. | I will {ten}: at most {y} {dv} all year. |
| cauChotChu | Em sẽ {ten}: {chu}. | I will {ten}: {chu}. |
| cauChotTrong | Điền ba bước trên, câu mục tiêu của em sẽ hiện ở đây. | Fill in the three steps and your WIG sentence appears here. |
| phepTinhTang | Cần thêm {can} {dv} trong {n} tuần học — khoảng {moiTuan} {dv} mỗi tuần. | You need {can} more {dv} over {n} school weeks — about {moiTuan} {dv} a week. |
| phepTinhGiam | Cần giảm {can} {dv} trong {n} tuần học. | You need to drop {can} {dv} over {n} school weeks. |
| phepTinhChuaX | Ghi số đầu tiên xong, máy sẽ tính em cần thêm bao nhiêu. | Once you log your first number, the app works out how much you need. |
| phepTinhDem | Máy sẽ cộng số từ việc em làm mỗi ngày — thêm một việc góp số ngay sau khi gửi nhé. | The app sums this from your daily lead measures — add one that feeds in right after sending. |
| phepTinhGiu | Còn {n} tuần học phải giữ. | {n} school weeks left to hold it. |
| gui | Gửi thầy cô xem | Send to my teacher |
| guiBgh | Gửi ban giám hiệu duyệt | Send for principal approval |
| luuNhap | Lưu nháp | Save draft |
| luu | Lưu | Save |
| thoi | Thôi | Cancel |
| daGui | Đã gửi thầy cô. Em thêm một việc để làm mỗi ngày nhé? | Sent to your teacher. Add a daily lead measure now? |
| themViecNgay | Thêm việc ngay | Add a lead measure |
| deSau | Để sau | Later |
| nguonSo | Số này lấy từ đâu? | Where does this number come from? |
| nguonThuoc | Cộng từ việc / mục tiêu được nối vào | Summed from linked lead measures / WIGs |
| nguonGhiTay | Ghi tay | Logged by hand |
| nguonHeThongChon | Máy tính từ điểm danh | Computed from attendance |
| nguonConChon | Gộp từ mục tiêu của các em / các lớp | Rolled up from student / class WIGs |
| nguonThanhPhanChon | Ghi tay theo từng phần | Logged by hand per component |
| gopCon | Gộp thế nào? | How to roll up? |
| gopCong | Cộng | Sum |
| gopTrungBinh | Trung bình | Average |
| gopTiLe | % đạt ngưỡng | % reaching a threshold |
| nguongCon | Ngưỡng đạt | Threshold |
| layTu | Lấy từ | Take from |
| layTuEm | Mục tiêu của các em | Student WIGs |
| layTuLop | Mục tiêu của các lớp | Class WIGs |
| locLinhVuc | Lọc theo lĩnh vực | Filter by domain |
| thanhPhan | Các phần (vd 4 kỹ năng, 8 môn) | Components (e.g. 4 skills, 8 subjects) |
| thanhPhanThem | Thêm phần | Add component |
| thanhPhanTen | Tên phần | Component name |
| noiThem | Nối thêm nguồn số | Link another source |
| noiGopSo | Cộng số vào | Feeds numbers in |
| noiChiHuong | Chỉ hướng tới | Aligned only |
| noiHeSo | Hệ số | Factor |
| noiKhacDonVi | Khác đơn vị — điền hệ số quy đổi | Different unit — enter a conversion factor |
| noiGo | Gỡ dây | Unlink |
| noiTrong | Chưa nối nguồn số nào. | No source linked yet. |

### F5. `viec` (client)

| key | vi | en |
|---|---|---|
| chipLop | Của lớp | Class |
| chipNhom | Nhóm {ten} | Group {ten} |
| chipChoDuyet | Chờ thầy cô duyệt | Awaiting approval |
| chipTamDung | Tạm dừng | Paused |
| chipTuTuanSau | Từ tuần sau: {n} {dv} | From next week: {n} {dv} |
| chiTieu | ít nhất {n} {dv} / {ky} | at least {n} {dv} / {ky} |
| chiTieuKhongQua | không quá {n} {dv} / {ky} | at most {n} {dv} / {ky} |
| kyTuan | tuần | week |
| ky2Tuan | 2 tuần | 2 weeks |
| ky4Tuan | 4 tuần | 4 weeks |
| muoiHaiTuan | 12 tuần gần đây | Last 12 weeks |
| tuanNayDuoc | Tuần này: {so}/{n} {dv} | This week: {so}/{n} {dv} |
| du | Đủ | Met |
| chuaDu | Chưa đủ | Not met |
| dangChay | Đang làm | In progress |
| oNghi | Nghỉ | Break |
| oChuaBatDau | Chưa bắt đầu | Not started |
| ngayChua | Chưa ghi | Not logged |
| ngayKhoa7 | Quá 7 ngày — nhờ thầy cô ghi giúp | Older than 7 days — ask your teacher |
| ngayKhoaKy | Đã chốt trong buổi họp với bạn | Locked by your PDR sign-off |
| ngayTuongLai | Chưa tới | Not yet |
| ngayKhongTinh | Không tính ngày này | Not a scheduled day |
| ngayBu | Ghi bù | Catch-up |
| chamThem | Thêm một lần | Add one |
| chamBot | Bớt một lần | Remove one |
| chamNhieu | Hôm nay em đã ghi {n} lần — nhiều hơn mọi khi, đúng chứ? | You've logged {n} today — more than usual, correct? |
| dienHoi | Hôm {ngay} em làm được bao nhiêu {dv}? | How many {dv} on {ngay}? |
| dienKhong | 0 cũng được — có làm mà được 0 khác với không ghi. | 0 is fine — doing it and getting 0 is different from not logging. |
| kiengHoi | Hôm {ngay} em lỡ mấy lần? | How many slips on {ngay}? |
| kiengKhong | Hôm nay 0 lần | 0 today |
| kiengNhac | Với việc kiêng, không ghi là chưa biết — ghi 0 khi em giữ được nhé. | For a "don't" measure, no log means unknown — log 0 on days you held firm. |
| heThong | Máy ghi từ {nguon} | Logged by the system from {nguon} |
| heThongDiemDanh | điểm danh | attendance |
| ghiLoi | Không ghi được — thử lại nhé. | Couldn't save — try again. |
| trong | Em chưa có việc nào để làm mỗi ngày. | No lead measure yet. |
| trongHint | Việc là thứ nhỏ em làm đều mỗi ngày để tới mục tiêu. | A lead measure is the small thing you do every day to reach your WIG. |
| them | Thêm việc | Add a lead measure |
| du4 | Em đang theo dõi 4 việc — đủ rồi. Kết thúc một việc trước khi thêm. | You're tracking 4 lead measures — that's the limit. End one before adding. |
| ketThuc | Kết thúc việc này | End this lead measure |
| ketThucHoi | Kết thúc "{ten}" từ tuần sau? Các lần đã ghi vẫn giữ. | End "{ten}" from next week? Logged entries are kept. |
| xoa | Xoá | Delete |
| xoaHoi | Xoá việc này? Chỉ xoá được khi chưa ghi lần nào. | Delete this lead measure? Only possible before any entry is logged. |
| formTitle | Thêm việc em làm | Add a lead measure |
| formTitleLop | Việc của lớp | Class lead measure |
| formTitleSua | Sửa việc | Edit lead measure |
| nut1 | ① Việc gì? | ① What action? |
| nut2 | ② Em ghi thế nào? | ② How do you log it? |
| nut3 | ③ Bao nhiêu là đủ? | ③ How much is enough? |
| nut4 | ④ Ngày nào? | ④ Which days? |
| ten | Em sẽ | I will |
| tenLop | Lớp sẽ | The class will |
| tenPh | vd: làm bài tập Toán | e.g. do Maths homework |
| tenDongTu | Bắt đầu bằng một việc làm: "đọc", "chạy", "làm"… | Start with an action verb: "read", "run", "do"… |
| cachCham | Chạm một cái mỗi lần làm | Tap once each time I do it |
| cachDien | Điền số mỗi ngày | Type a number each day |
| cachHeThong | Máy tự ghi (điểm danh) | System-logged (attendance) |
| moiLan | Mỗi lần chạm tính | Each tap counts |
| chieuItNhat | Ít nhất | At least |
| chieuKhongQua | Không quá | No more than |
| moiKy | mỗi | per |
| ngayApDung | Những ngày em làm | Days you do it |
| choBu | Quên thì ghi bù vào ngày khác được | If I forget, I can log it on another day |
| tuTuan | Bắt đầu từ | Starting |
| tuTuanNay | tuần này | this week |
| tuTuanSau | tuần sau | next week |
| giupMucTieu | Việc này giúp mục tiêu nào? | Which WIG does this serve? |
| giupKhong | Không thuộc mục tiêu nào | No WIG |
| congVaoMucTieu | Cộng số của việc này vào mục tiêu | Feed this number into the WIG |
| congVaoKhac | Không cộng được: khác đơn vị với mục tiêu ({dv}). | Can't feed in: unit differs from the WIG ({dv}). |
| congVaoSauDuyet | Số sẽ cộng vào mục tiêu sau khi thầy cô duyệt việc này. | Numbers feed in once your teacher approves this lead measure. |
| cauRap | Mỗi {ky} em {ten} {chieu} {n} {dv}, vào {ngay}. Em ghi bằng cách {cach}. | Every {ky} I {ten} {chieu} {n} {dv}, on {ngay}. I log it by {cach}. |
| cauRapTrong | Điền bốn bước trên, câu việc của em sẽ hiện ở đây. | Fill in the four steps and your lead measure sentence appears here. |
| canhBaoNhieu | Cần {n} lần mà tuần chỉ có {d} ngày em chọn — làm nhiều lần một ngày cũng được, hoặc chọn thêm ngày. | {n} times but only {d} chosen days — several a day is fine, or pick more days. |
| gui | Gửi thầy cô xem | Send to my teacher |
| luu | Lưu | Save |
| daGui | Đã gửi thầy cô. Em ghi được ngay từ hôm nay. | Sent. You can start logging today. |
| phamVi | Ai làm việc này? | Who does this? |
| phamViTungEm | Từng em tự ghi | Each student logs their own |
| phamViCaDoi | Cả lớp cùng một con số, thầy cô ghi | One number for the whole class, teacher logs |
| gopKhac | Cách gộp khác | Other ways to aggregate |
| gopTong | Cộng các lần | Sum entries |
| gopMoiNhat | Lấy số mới nhất | Latest value |
| gopDemNguong | Đếm số lần đạt ngưỡng | Count entries above a threshold |
| nguongMoiLan | Ngưỡng mỗi lần | Per-entry threshold |
| suaChiTieu | Sửa chỉ tiêu (từ tuần sau) | Change target (from next week) |
| suaChiTieuVi | Vì sao đổi? | Why the change? |
| haNhieu | Hạ quá 30% hoặc hạ lần hai trong năm — việc sẽ quay lại chờ duyệt. | Dropping over 30% or a second drop this year sends it back for approval. |
| tamDung | Tạm dừng từ tuần sau | Pause from next week |
| chayLai | Chạy lại từ tuần sau | Resume from next week |
| ketThucTuanSau | Kết thúc từ tuần sau | End from next week |
| nEmDu | {n}/{si} bạn đủ tuần này | {n}/{si} students met it this week |
| doThi | 12 tuần | 12 weeks |
| doThiChiTieu | chỉ tiêu | target |
| chonNhom | Nhóm | Group |

### F6. `camKet` (client)

| key | vi | en |
|---|---|---|
| chipSo | {dat}/{hua} {dv} | {dat}/{hua} {dv} |
| chipChuaDien | chưa điền số | number not entered |
| giupViec | Giúp việc: {ten} | Serves lead measure: {ten} |
| giupMucTieu | Giúp mục tiêu: {ten} | Serves WIG: {ten} |
| lac | Chưa nối vào mục tiêu nào | Not linked to any WIG |
| tuanNay | Tuần này | This week |
| tuanN | Tuần {n}/{tong} | Week {n} of {tong} |
| chuaToiHan | Chưa tới hạn chấm — hết tuần {tong} mới chấm. | Not due yet — score after week {tong}. |
| thang | Thắng | Win |
| thua | Thua | Loss |
| chuaCham | Chưa chấm | Not scored |
| choThuSau | Đợi đến thứ Sáu tuần cuối rồi chấm nhé. | Wait until Friday of the final week to score. |
| goiYThang | Máy thấy việc đủ {so}/{n} — có vẻ Thắng. Em tự chấm nhé. | Lead measure met {so}/{n} — looks like a Win. You decide. |
| goiYThua | Máy thấy việc mới {so}/{n} — có vẻ chưa. Em tự chấm nhé. | Lead measure at {so}/{n} — looks short. You decide. |
| goiYKhong | Không có việc để máy so — em tự chấm. | Nothing for the app to compare — you decide. |
| soDatHoi | Em đạt được bao nhiêu {dv}? | How many {dv} did you reach? |
| xacNhan | {ten} đã xác nhận | Confirmed by {ten} |
| xacNhanBan | Bạn cùng nhóm đã xác nhận | Confirmed by a buddy |
| xacNhanThayCo | Thầy cô đã xác nhận | Confirmed by teacher |
| xacNhanPhuHuynh | Bố mẹ đã xác nhận | Confirmed by parent |
| xacNhanNut | Mình xác nhận | I confirm |
| xacNhanYKien | Nhận xét (không bắt buộc) | Comment (optional) |
| cuaBan | Cam kết của {ten} | {ten}'s commitments |
| cuaBanTrong | {ten} chưa hứa gì tuần này. | {ten} has no commitment this week. |
| them | Cam kết | Make a commitment |
| du2 | Em đang có 2 cam kết — đủ rồi. Làm xong hoặc huỷ một cái trước nhé. | You have 2 commitments — the limit. Finish or cancel one first. |
| trong | Tuần này em chưa hứa gì. | No commitment this week. |
| trongHint | Hứa 1–2 việc nhỏ, làm được thật. | Promise 1–2 small things you will really do. |
| sua | Sửa | Edit |
| huy | Huỷ cam kết | Cancel commitment |
| huyHoi | Huỷ cam kết này? | Cancel this commitment? |
| nghi | Tuần nghỉ — cam kết này không tính thắng thua. | Break week — this commitment isn't scored. |
| daKeLai | Đã kể lại trong buổi họp | Reviewed in your PDR |
| formTitle | Cam kết tuần này | This week's commitment |
| formTitleTuanSau | Cam kết cho tuần sau | Commitment for next week |
| formTitleLop | Cam kết của lớp | Class commitment |
| noiDung | Tuần này em hứa làm gì? | What do you commit to this week? |
| noiDungLop | Tuần này cả lớp hứa làm gì? | What does the class commit to this week? |
| noiDungPh | vd: Đăng 3 bài và tìm 50 khách quan tâm | e.g. Post 3 times and collect 50 leads |
| coSo | Cam kết có con số? | Does it have a number? |
| soHua | Đạt | Reach |
| giup | Việc này giúp gì? | What does it serve? |
| giupChon | Chọn việc hoặc mục tiêu | Pick a lead measure or WIG |
| giupViecDangLam | Việc em đang làm | My current lead measures |
| giupMucTieuCuaEm | Mục tiêu của em | My WIGs |
| giupKhongCo | Không thuộc mục tiêu nào | None |
| lacCanhBao | Cam kết không gắn với mục tiêu nào — vẫn lưu được, nhưng không tính vào mục tiêu của em. | Not linked to a WIG — it saves, but won't count toward any WIG. |
| baoLau | Trong bao lâu? | For how long? |
| tuan1 | 1 tuần | 1 week |
| tuanNhieu | {n} tuần | {n} weeks |
| dungTiep | Dùng tiếp việc tuần trước | Continue last week's |
| cauChot | Tuần {khoang} em hứa: {noiDung}{so}. {giup} | Week {khoang}: I commit to {noiDung}{so}. {giup} |
| cauChotSo | , đạt {hua} {dv} | , reaching {hua} {dv} |
| luu | Lưu cam kết | Save commitment |
| daLuu | Đã lưu cam kết. | Commitment saved. |

### F7. `pdr` (giữ namespace; sửa VI, thêm, xoá)

| key | vi | en | ghi chú |
|---|---|---|---|
| title | Họp với bạn | PDR with buddy | sửa |
| titleCoach | Họp với thầy cô | PDR with your teacher | sửa |
| noBuddy | Thầy cô chưa ghép bạn cùng nhóm cho em. | No buddy assigned yet. | sửa |
| nhip | Biên bản của tuần đang mở: nhìn lại tuần đó, rồi câu 6 hứa cho tuần kế tiếp ({tuanSau}). | Minutes for the week shown: look back at it, then question 6 commits for the week after ({tuanSau}). | sửa |
| nhipKhongTuan | Biên bản của tuần đang mở: nhìn lại tuần đó, rồi câu 6 hứa cho tuần kế tiếp. | Minutes for the week shown: look back at it, then question 6 commits for the week after. | sửa |
| q1CamKet | Tuần qua em đã hứa: | Last week you committed to: | mới |
| q2 | Kết quả ra sao? Chấm từng cam kết. | How did it go? Score each commitment. | sửa |
| q2Trong | Tuần qua em không có cam kết nào — kể lại em đã làm gì nhé. | No commitment last week — tell what you did. | mới |
| q2ChuaToiHan | Cam kết này còn chạy — kể tình hình thôi, chưa cần chấm. | Still running — just tell how it's going, no score needed. | mới |
| q2Them | Kể thêm | Anything else | mới |
| q6 | Tuần tới em hứa làm gì? | What do you commit to for next week? | sửa |
| q6Hint | Hứa 1–2 việc nhỏ, có thể kéo dài 1–4 tuần. | Promise 1–2 small things, lasting 1–4 weeks. | mới |
| ackCon | Còn {n} cam kết TỚI HẠN chưa chấm ở câu 2. | {n} due commitments still unscored in question 2. | mới |
| ackKhoa | Ghi nhận xong, các lần ghi của tuần này khoá lại — sửa gì thì làm trước khi bấm nhé. | After sign-off, this week's entries lock — fix anything first. | mới |
| goGiup | Thầy cô gõ giúp | Typed by teacher | mới |
| kyCuaEm | Em bấm Ghi nhận trên máy của em. | You tap Acknowledge on your own device. | mới — lớp thường |
| kyCuaEmNhapHo | Em hoặc bạn em bấm Ghi nhận trên máy của em. | You or your buddy tap Acknowledge on your own device. | mới — chỉ lớp nhập hộ |
| acked, thisWeek, tuanDaQua, chiTuanNong, q1, q3, q4, q5, save, ackBtn, expand, collapse, coachDay | giữ nguyên | | |
| linkWig, pickWig, q2Win, q2Lose | **xoá** | | |

### F8. `duyet` (client)

| key | vi | en |
|---|---|---|
| duyet | Duyệt | Approve |
| daDuyet | Đã duyệt | Approved |
| traLai | Trả lại | Return |
| traLaiTitle | Trả lại kèm lời nhắn | Return with a note |
| traLaiNhan | Nhắn cho em | Note to the student |
| traLaiGui | Gửi lại cho em | Send back |
| choDuyet | Chờ duyệt | Awaiting approval |
| choDuyetN | Chờ duyệt ({n}) | Awaiting approval ({n}) |
| khongCo | Không có gì chờ duyệt. | Nothing awaiting approval. |
| loaiMucTieu | Mục tiêu | WIG |
| loaiViec | Việc | Lead measure |
| loaiHaChiTieu | Hạ chỉ tiêu {cu} → {moi} (từ tuần sau) | Target drop {cu} → {moi} (from next week) |
| loaiSua | Sửa sau khi duyệt | Edited after approval |
| cua | của {ten} | by {ten} |
| luuY | Cam kết tuần không cần duyệt — em tự hứa, tự chấm. | Weekly commitments need no approval — students set and score their own. |

### F9. `lopMucTieu` (client)

| key | vi | en |
|---|---|---|
| title | Mục tiêu của lớp | Class WIGs |
| baSoMucTieu | Mục tiêu: {n}/{tong} đúng nhịp | WIGs on pace: {n}/{tong} |
| baSoViec | Việc tuần này: {n}/{tong} bạn đủ | Lead measures this week: {n}/{tong} students met |
| baSoCamKet | Cam kết: giữ {n}/{tong} | Commitments kept: {n}/{tong} |
| baSoHint | Ba số tách nhau — không cộng thành một điểm. | Three separate numbers — not blended into one score. |
| khuMucTieu | Mục tiêu của lớp | Class WIGs |
| khuViec | Việc của lớp | Class lead measures |
| khuCamKet | Cam kết của lớp tuần này | Class commitments this week |
| khuCacEm | Các em tuần này | Students this week |
| khuMau | Mẫu mục tiêu cho các em | WIG templates for students |
| themMucTieu | Thêm mục tiêu lớp | Add class WIG |
| themViec | Thêm việc của lớp | Add class lead measure |
| themCamKet | Cam kết của lớp | Class commitment |
| du4 | Lớp đang có 4 mục tiêu đang chạy — đóng một cái để thêm. | The class has 4 active WIGs — close one to add another. |
| ghiSoHomNay | Ghi số hôm nay | Log today's number |
| ghiSoNgay | Ngày | Date |
| ghiSoGhi | Ghi | Save |
| nguonSoDong | Nguồn số: cộng từ {n} việc / mục tiêu | Source: summed from {n} lead measures / WIGs |
| mucTieuTrong | Lớp chưa có mục tiêu nào. Đặt 1–4 mục tiêu cho năm học. | No class WIG yet. Set 1–4 for the school year. |
| viecTrong | Lớp chưa có việc chung nào. | No class lead measure yet. |
| camKetTrong | Tuần này lớp chưa có cam kết. | No class commitment this week. |
| cacEmTrong | Chưa có em nào trong lớp. | No students in this class. |
| cotEm | Em | Student |
| cotMucTieu | Mục tiêu | WIGs |
| cotViec | Việc | Lead |
| cotCamKet | Cam kết | Commit. |
| cotHop | Họp bạn | PDR |
| cotChoDuyet | Chờ duyệt | Pending |
| chuaCham | +{n} chưa chấm | +{n} unscored |
| hopDaKy | Đã ghi nhận | Signed |
| hopChua | Chưa | Not yet |
| xemEm | Xem bảng của em | Open student board |
| mauTrong | Chưa có mẫu. Tạo 3–5 mẫu để các em chỉ điền số. | No templates. Create 3–5 so students only fill in numbers. |
| mauThem | Thêm mẫu | Add template |
| mauTen | Tên mẫu | Template name |
| mauGoiY | Số gợi ý | Suggested numbers |
| mauXoa | Xoá mẫu | Delete template |
| mauXoaHoi | Xoá mẫu này? Mục tiêu các em đã đặt từ mẫu vẫn giữ. | Delete this template? WIGs already set from it are kept. |
| mauDu | Tối đa 8 mẫu. | Up to 8 templates. |
| lichXem | Do ban giám hiệu đặt · {nghi} tuần nghỉ, {thi} tuần thi | Set by the principal · {nghi} break weeks, {thi} exam weeks |
| ghiBu | Ghi bù cho em | Catch-up log for a student |
| ghiBuNgay | Ghi bù cho em ngày {ngay} | Catch-up log for {ngay} |
| ghiBuKhoa | Tuần này em đã ghi nhận buổi họp — mở lại qua yêu cầu sửa có lưu vết. | The student has signed this week — reopen via a tracked edit request. |
| nhapHoBat | Lớp này được thầy cô nhập nội dung giúp (khối 1–3). Chữ ký buổi họp vẫn là của em. | Teacher may enter content for students in this class (grades 1–3). PDR sign-off stays the student's. |
| nhomTitle | Nhóm trong lớp | Groups |
| nhomTrong | Chưa có nhóm nào. Nhóm dùng cho việc và mục tiêu chung của vài em. | No groups yet. Groups share lead measures and WIGs among a few students. |
| nhomThem | Tạo nhóm | Create group |
| nhomTen | Tên nhóm | Group name |
| nhomThanhVien | Thành viên | Members |
| nhomTuBan | từ nhóm bạn | from buddy pairing |
| nhomGo | Giải tán nhóm | Disband group |
| nhomGoHoi | Giải tán nhóm {ten}? Việc và mục tiêu của nhóm sẽ đóng từ tuần sau. | Disband {ten}? Its lead measures and WIGs close from next week. |

(Khu `nhom*` render ở trang `/roster` — Q7; giữ namespace `lopMucTieu` để chuỗi ở một chỗ.)

### F10. `coSoMucTieu` (client vì `LichTuanHoc`)

| key | vi | en |
|---|---|---|
| khuMucTieu | Mục tiêu của cơ sở | Campus WIGs |
| themMucTieu | Thêm mục tiêu cơ sở | Add campus WIG |
| mucTieuTrong | Cơ sở chưa có mục tiêu nào. | No campus WIG yet. |
| tuDo | Tự đo | Measured directly |
| cuon | Gộp từ các lớp | Rolled up from classes |
| gopDong | Gộp từ {n} {loai} · {cach} · ngưỡng {nguong} | Rolled up from {n} {loai} · {cach} · threshold {nguong} |
| khuChoDuyet | Mục tiêu lớp chờ duyệt | Class WIGs awaiting approval |
| choDuyetTrong | Không có mục tiêu lớp nào chờ duyệt. | No class WIG awaiting approval. |
| khuLopCham | Lớp nào đi chậm | Classes falling behind |
| lopChamTrong | Chưa lớp nào có mục tiêu — chưa vào cuộc, không phải đang thua. | No class has a WIG yet — not started, not losing. |
| cotLop | Lớp | Class |
| cotGvcn | GVCN | Homeroom |
| cotMucTieu | % tới đích | % to target |
| cotViec | Việc tuần | Lead measures |
| cotCamKet | Cam kết giữ | Commitments kept |
| cotHop | Em đã họp bạn | PDR signed |
| cotChoDuyet | Chờ duyệt | Pending |
| chuaCoSo | — | — |
| khuLich | Lịch tuần học {nam} | School calendar {nam} |
| lichHint | Bấm một tuần để đổi: học → nghỉ → thi. Tuần nghỉ chỉ miễn thắng thua, không chặn ghi. | Tap a week to cycle: school → break → exam. Break weeks skip win/loss but never block logging. |
| lichQuaKhu | Đổi tuần ĐÃ QUA sẽ tính lại thắng/thua của mọi lớp trong cơ sở. Đổi chứ? | Changing a PAST week recalculates win/loss for every class on campus. Change it? |
| lichLuu | Đã lưu | Saved |
| lichLoi | Không lưu được tuần {tuan}. | Couldn't save week {tuan}. |
| thang | Tháng {m} | Month {m} |
| khuNhapHo | Thầy cô nhập giúp (khối 1–3) | Teacher-assisted entry (grades 1–3) |
| nhapHoHint | Bật cho lớp nhỏ: thầy cô nhập mục tiêu, việc, cam kết và biên bản giúp em; chữ ký buổi họp vẫn là của em hoặc bạn em. | Turn on for young classes: the teacher enters WIGs, lead measures, commitments and minutes; PDR sign-off stays with the student or buddy. |
| nhapHoBat | Đang bật | On |
| nhapHoTat | Tắt | Off |
| nhapHoDoi | Đổi | Toggle |

### F11. Sửa chữ ở namespace GIỮ lại

| key | vi mới | en |
|---|---|---|
| nav.wig | Mục tiêu | WIG |
| nav.meeting | **xoá** | |
| buddy.title | Bạn cùng nhóm & lịch họp | Buddies & PDR schedule |
| buddy.coachTitle | Họp 1-1 với thầy cô (hằng tháng) | 1-on-1 PDR with the teacher (monthly) |
| admin.linkWig | Mục tiêu → việc → cam kết của lớp | Class WIGs → lead measures → commitments |
| admin.linkMeeting | **xoá** | |
| admin.classHasData | Lớp còn {n} mục tiêu | Class still has {n} WIGs |
| admin.cannotDeleteClass / confirmDeleteClass | thay "WIG" → "mục tiêu", giữ phần còn lại | thay tương ứng |
| class.noClassTeacher | thay "WIG" → "Mục tiêu" | thay "WIG" → "WIGs" |
| student.moodHint | Màu theo nhịp mục tiêu của em — càng xanh càng vui. | Colour follows your WIG pace — greener is happier. |
| student.requestKind_doi_ten_thuoc | Đổi tên việc | Rename the lead measure |
| student.requestKind_mo_tuan_da_ky | Mở lại tuần đã chốt | Reopen a signed week |
| student.requestKind_khac | Việc khác | Something else |
| student.requestRenameTitle | Xin thầy cô đổi tên việc cho đúng việc thật của em | Ask your teacher to rename this lead measure to match what you actually do |
| student.requestKind_undo_tick / add_tick / change_target / rename_lead / other, tickWeekLocked, undoError + nhóm LeadTicker/StudentMeetings/buddy* (theo [H-24] Sư Tử) | **xoá** | |
| report.wigProgress | Mục tiêu của con năm nay | Your child's WIGs this year |
| report.viecTuan | Việc con làm tuần này | Lead measures this week |
| report.camKetTuan | Cam kết tuần này | This week's commitments |
| report.hopBan | Con đã họp với bạn tuần này | PDR with buddy done this week |
| report.hopChua | Tuần này con chưa họp với bạn | No PDR with buddy this week |
| report.noWeekData | Tuần này con chưa có việc hay cam kết nào. | No lead measure or commitment this week. |
| report.weekResult, wigWon, leadDone, won, notWon, reflection, nextWeek, noMeeting, noWeeks | **xoá** | |

## G. Câu lỗi máy chủ (action viết cứng VI — một bảng để hai action không nói hai giọng)

Trigger 23514/42501 đã có câu riêng (10 §8, 20 §5) — action HIỆN THẲNG qua `friendlyError`,
không dịch lại. Bảng dưới là lỗi Ở TẦNG ACTION (kiểm sớm hoặc RLS trả 0 dòng):

| Action | Điều kiện | Câu |
|---|---|---|
| mọi action em | không phải chính em, không nhập hộ | Chỉ em mới ghi được phần này. |
| mọi action | RLS trả 0 dòng | Không lưu được — em không có quyền với lớp này. |
| luuMucTieu | ≥4 duyệt đang chạy (kiểm sớm cho câu đẹp; trigger vẫn là luật) | Em đang có 4 mục tiêu rồi. Đóng một mục tiêu trước nhé. |
| luuMucTieu | kieu ĐẾM, chưa dây, chưa x | (không lỗi — hiện `phepTinhDem`) |
| datTapTrung | đã 2 | Em đang tập trung 2 mục tiêu rồi — bỏ một cái trước nhé. |
| ghiLuot | ngày ngoài 7 ngày, không phải thầy cô | Chỉ ghi được trong 7 ngày gần nhất — nhờ thầy cô ghi giúp. |
| ghiLuot | tuần đã ký (`luot_bi_khoa`) | Ngày này đã khoá sau buổi họp với bạn. |
| ghiLuot | gia_tri < 0 | Số phải từ 0 trở lên. |
| ghiLuot | thước dong/tam_dung | Việc này đang tạm dừng hoặc đã kết thúc. |
| ghiBuLuot (cô) | tuần đã ký | Tuần này em đã ghi nhận buổi họp — mở lại qua yêu cầu sửa có lưu vết. |
| luuViec | vượt 4 hàng (em) | Em đang theo dõi 4 việc rồi. Kết thúc một việc trước nhé. |
| luuViecLop | làm {n} em vượt 4 | Thêm việc này thì {n} em vượt 4 việc phải ghi. Kết thúc một việc lớp trước, hoặc đặt "Cả lớp cùng một con số". |
| luuCamKet | ≥2 phủ một tuần | Em đang có 2 cam kết rồi. Làm xong hoặc huỷ một cái trước nhé. |
| chamCamKet | trước thứ Sáu tuần cuối | (trigger 23514 "Đợi đến thứ Sáu tuần cuối rồi chấm nhé" — action hiện nguyên; nút đã mờ sẵn) |
| chamCamKetLop | không phải GVCN/admin | Chỉ thầy cô chủ nhiệm chấm cam kết của lớp. |
| ghiNhanPdr | còn cam kết TỚI HẠN chưa chấm | Còn {n} cam kết chưa chấm Thắng/Thua ở câu 2. |
| ghiNhanPdr | thầy cô bấm | Chữ ký là của em hoặc bạn em — thầy cô không ký thay. |
| ghiNhanPdr | bạn bấm ở lớp KHÔNG nhập hộ | Ở lớp mình, chỉ em bấm Ghi nhận được — em bấm trên máy của em nhé. |
| suaChiTieu | hạ >30% | (không lỗi — về chờ duyệt, message "Đã lưu, chờ duyệt lại vì hạ nhiều.") |
| duyet* | không phải staff lớp | Bạn không chủ nhiệm lớp này. |
| duyetMucTieuLop | GVCN tự duyệt mục tiêu lớp | Mục tiêu của lớp do ban giám hiệu duyệt. |
| datTuanHoc | ngoài năm học | Tuần này không thuộc năm học đang mở. |
| datTuanHoc | tuần đã qua, chưa xác nhận | (Popup `lichQuaKhu` trước khi gọi; action ghi `log_audit`) |
| luuMau | >8 | Tối đa 8 mẫu. |
| luuDonVi (em) | — | Nhờ thầy cô thêm đơn vị này nhé. |

## H. Việc kiểm sau khi dựng (bắt buộc trước khi kết luận — chi tiết ở 60-KIEM)

1. `node scripts/test-client-namespaces.mjs` — 8 namespace mới có trong `NAMESPACE_CHO_CLIENT`.
2. `node scripts/test-tuong-phan.mjs` — chữ <14px chỉ `gold-text/success-dark/warn-text`.
3. `node scripts/test-en-locale.mjs` — không chuỗi Việt cứng trên `/en`.
4. `node scripts/test-tu-cam-man-em.mjs` — quét GIÁ TRỊ chuỗi (không quét tên khoá) theo 60 §4;
   thay hẳn lệnh `rg` thô (tên khoá `pdr`/`buddy` còn giữ nên grep thô không bao giờ về 0).
5. `node scripts/test-mobile.mjs <base> 360,390 <thư mục> hs,gvcn,bgh,ph` với `TRANG` mới —
   **nhìn ảnh** theo phiếu 60 §3.6: hàng việc 12 ô + 7 ô, băng rôn, form bước ②, LichTuanHoc
   dạng danh sách, ba số tách.
6. `node scripts/test-chu-thua-tren-man-em.mjs` (selector đổi theo `data-kiem` mới).
7. `node scripts/test-nav.mjs` — mọi tab mọi vai, không 404 sau khi gỡ `/meeting`,
   `/wig/chi-tiet`, `/wig/hop`, `/student/hop`.
8. Ba hàm thuần có test đơn vị (`node --test`): `lib/muc-tieu/nhip.ts`, `cau-chot.ts`,
   `tuan-hoc.ts`.
