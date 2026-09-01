<!-- Tạo 01/09/2026 bằng một quy trình 32 tác nhân (5 người đọc độc lập → danh mục 75 ca → 5 hướng thiết kế → 15 lượt phản biện → 2 giám khảo → tổng hợp + phản biện + sửa). Các khẳng định về code (tệp:dòng) và con số trên production đã được kiểm lại tay trước khi lưu. Đây là TÀI LIỆU ĐỀ XUẤT, chưa phải quyết định — bảng hỏi ở mục 8 là chỗ chủ dự án gật/không gật từng dòng. -->

# Mô hình WIG/4DX cho Việt Anh Class — hai phương án

*Tổng hợp 01/09/2026 từ 5 thiết kế + 15 phản biện + 2 giám khảo + 5 bản đọc (tài liệu, CSDL, giao diện, dữ liệu thật, canon). Mọi dẫn chiếu tệp:dòng và con số đã kiểm lại trên repo và production (chỉ SELECT) trong phiên này. Ký hiệu trong bảng ca: ✔ đúng · ◐ đúng nhưng khó dùng · S chạy nhưng cho kết quả sai · ✘ không diễn đạt được.*

---

## 1. Vấn đề đúng là gì

1. Dữ liệu WIG trên production rất nhỏ: **16 WIG · 33 cam kết · 32 việc · 65 lượt tick · 1 số đo**; chỉ **2/28 lớp** dùng thật (Test 7 em, Marketing 6 em), **25 lớp trống**, lớp thật 12A1 mang **2 WIG rác** của bộ kiểm. Rủi ro di trú nhỏ; rủi ro sai mô hình lớn vì tiết đặt mục tiêu đầu năm đang tới.
2. Người dùng thật (Marketing) nói **cả ba tầng bằng con số kết quả**: "3000 Qualified Lead" (năm) → "Tạo ra 50 Qlead" (tuần) → "Viết 3 bài blog" nhưng ô số ghi **30** (việc). Tầng giữa không có cột số (`supabase/migrations/0121_mot_tang_wig_nam_va_cam_ket_tuan.sql`, quyết định 14/08), nên số tràn xuống ô "Mục tiêu (số)" của việc (`messages/vi.json:438`).
3. App **đoán bản chất con số từ chuỗi đơn vị** (`lib/don-vi.ts:68-76`; bản SQL `kieu_don_vi` ở `0113_don_vi_do_lai_lay_so_cuoi.sql:27-50`): 2/4 WIG manual thật (lead, khách hàng) **không có ô ghi số** ở màn cô (`components/wig/BangTienDo.tsx:241` đòi `kieuDonVi==='do'`) trong khi màn em có (`components/student/MucTieuCuaCon.tsx:331` đòi `measure_by==='manual'`); em **không được khai** đo bằng gì (`app/[locale]/(dashboard)/student/actions.ts:828-829` suy từ đơn vị); **26/26 việc của em** mang đơn vị của WIG vì form ép (`…/student/actions.ts:1576`) — còn 0/6 việc do cô đặt trùng.
4. Số đã ghi **không vào phép tính**: WIG "thể lực 6→8" đã ghi 8 nhưng `wig_progress_v` với manual chỉ đọc `achieved_at` (`0109_vong_tron_do_dung_quang_duong.sql:102`) → vẫn "Chưa đạt"; WIG lớp Test "1200 bài" hiện **11** trong khi 7 WIG em nối vào nó giữ **52 lượt** (`0124_so_cua_viec_bo_theo_tuan_cua_cam_ket.sql:22-29` chỉ đi qua `commitments.wig_id`, không qua `source_wig_id`).
5. Việc **chết theo tuần** (`lead_measures.commitment_id NOT NULL`, `0121:98-100`) → không có xu hướng lead measure; 3/3 việc điền số bị **cảnh báo đỏ sai** (`app/[locale]/(dashboard)/wig/page.tsx:284` không xét `nhap_luong`).
6. **Hai màn hai luật**: sửa WIG lớp đòi số nguyên (`app/[locale]/(dashboard)/wig/actions.ts:258-266`) trong khi tạo nhận số lẻ; cả hai form chặn X ≥ Y (`lib/wig-tao.ts:173-178`, `student/actions.ts:813-818`) làm nhánh đi xuống của `toi_dich` (`0113:94-99`) thành mã chết — mục tiêu giảm, đích 0, giữ mức đều không đặt được.

Gốc chỉ có ba: **(a)** bản chất con số được đoán, không được khai; **(b)** con số không có chỗ ở tầng người nói ra nó; **(c)** thước tuần không sống qua tuần. Mọi triệu chứng còn lại là hệ quả.

---

## 2. Nguyên tắc chung mọi phương án phải thoả

1. **Khai, không đoán**: cách gộp / hướng / nguồn số là cột người dùng chọn; đơn vị chỉ là nhãn hiển thị — *C03 (lead manual không có ô số), C38 ("buồi"), C48 (km bị cộng dồn), C98 ("points" EN).*
2. **Con số đứng ở tầng người nói ra nó**: 3000 lead ở năm, 50 lead ở tuần, 3 bài blog ở việc — *C19, C23, C42.*
3. **Lead/lag là tương đối theo tầng; app không phán đơn vị nào "nghe như kết quả"** (lập trường chủ dự án 01/09) — *C16, C32.*
4. **Mỗi con số hiện kèm nguồn và ngày; vạch chỉ vẽ từ số có nguồn** ("em ghi 25/08", "máy cộng từ 3 việc") — *C02, C03.*
5. **Không ghi ≠ 0**: ô trống là "chưa biết", số 0 là "có làm, được 0"; với việc kiêng, im lặng không phải thắng — *C26, C41, C92.*
6. **Gộp số giữa các tầng chỉ qua dây khai rõ vai** (góp số / chỉ hướng); máy không bao giờ tự cộng — *C14, C37, C90.*
7. **Người chấm, máy gợi ý; không có gì để đo thì không gợi thua** — *C20, C21, C50.*
8. **Trần "ít mà tập trung" đếm theo người phải theo dõi**, không theo cam kết hay chủ thể — *C24, C105 (trần 0137 đã học bài này).*
9. **Luật ở CSDL, và mọi cột ngữ nghĩa mới phải vào vòng duyệt/khoá** — bốn trigger đang so danh sách cột cố định (`0151:62-77`, `0151:98-112`, `0155` tuple, `0141:32`) là chỗ cả 5 hướng cùng ngã — *C96.*
10. **Không lệch giữa các hàm đọc số**: liệt kê chỗ đọc bằng grep, không bằng trí nhớ; một hàm đọc số cho mọi view — *C33 (hai thước cho một cột), C113.*
11. **Chữ lớp 5 trên bản VI; bản EN giữ thuật ngữ v3** (19/08) — *C25 ("WIG" trên màn em), C98.*
12. **Dữ liệu di trú mập mờ thì hỏi người, không đoán từ chuỗi** — *C03/C04 (hai WIG Marketing: số mới thêm hay tổng đến nay?).*
13. **Ranh giới dữ liệu trẻ em giữ nguyên**: dòng thô của một em chỉ em/phụ huynh/thầy cô lớp đọc (`0048_rls_performance.sql:221-222`); số gộp cho bạn cùng lớp đi qua hàm định-nghĩa-viên trả **số đếm** — *C24, C105.*

---

## 3. Danh mục ca

Cột "Nay" chấm theo mã đang chạy; cột PA1/PA2 ghi dấu + cơ chế giải. PA2 chấm **trên đặc tả §5, chưa có mã** — ✔ nghĩa là có bảng/cột/hàm cụ thể giải nó.

| id | Diễn đạt | Tầng | Bản chất | Nay | PA1 (tối ưu trong app) | PA2 (xây lại) |
|---|---|---|---|---|---|---|
| C01 | Lớp cộng dồn từ hành vi (1200 bài) | Năm | hành vi lượng | ✔¹ | ✔ + cô chọn `lay_tu` để cộng WIG em | ✔ dây `gop_so` |
| C02 | Điểm TB thể lực 6→8, cô ghi tuần | Năm | kết quả đo | ◐ | ✔ `so_moi_nhat` đọc số đo; vạch + nguồn | ✔ `do_lai` |
| C03 | 3000 lead / 1600 khách, thống kê ngoài | Năm | kết quả đếm | ✘ | ✔ ô số theo `measure_by`; `cach_gop` cô khai (hỏi qua `can_xac_nhan`) | ✔ `nguon_so=ghi_tay` |
| C04 | "Từ 1020 lên 1600" mà X ghi 0 | Năm | kết quả đếm | S | ✔ "☐ chưa biết đang ở đâu" = null + cảnh báo mềm tiêu đề↔ô | ✔ CHECK theo `chieu` |
| C05 | WIG đi xuống (kg, giây; lần/tháng) | Năm | kết quả đo | ✘ | ◐ kg/giây ✔ (`huong=xuong`); "lần/tháng" cần chu kỳ | ✔ `chieu=giam` · `toc_do_ky` |
| C06 | Đích bằng 0 (0 buổi vắng cả năm) | Năm | kết quả đếm | ✘ | ◐ đích 0 hợp lệ, hiện "đang giữ được", không tự "đã đạt" | ✔ `tran_tich_luy`, chỉ xét khi hết kỳ |
| C07 | Số lẻ, sửa sau khi tạo | Năm | kết quả đo | S | ✔ `lib/wig-luat.ts`, bỏ `isInteger` khi manual | ✔ |
| C08 | % học sinh đạt một đích con | Năm | tỉ lệ người | ◐ | ◐ `nguong_con`; em thấy chỉ khi gật 14/08 | ✔ `nguong_con` + hàm định-nghĩa-viên đếm |
| C09 | % HS có 6/8 môn ≥ 6,5 | Năm | tỉ lệ người | ✘ | ✘ | ✔ `thanh_phan` + `nguong_con` |
| C10 | WIG trường cuộn từ lớp | Năm | tỉ lệ | ✔ | ✔ + `lop_dat_du` lọc lĩnh vực | ✔ |
| C11 | Tỉ lệ % không phải tỉ lệ người | Năm | kết quả đo | ◐ | ◐ ghi tay %; không suy từ tick | ✔ thước lớp `tung_em` → `gop=ti_le_dat` |
| C12 | "Từ X đến Y" bằng chữ | Năm | định tính | ✘ | ✘ `target_value NOT NULL` (`0002:81`) | ✔ `x_chu/y_chu`, số null |
| C13 | Mốc Z khác cuối năm | Năm | kết quả đo | ◐ | ◐ lớp đặt được hạn; khoá `0119:17-19` vẫn chặn HK2 | ✔ `ket_thuc` tự do, khoá theo trạng thái đang chạy |
| C14 | WIG em nối WIG lớp khác bản chất | Năm | kết quả đo | ◐ | ✔ chip "cùng hướng", không cộng; GVCN gỡ dây | ✔ dây `chi_huong` |
| C15 | WIG em = lớp chia nhỏ | Năm | hành vi lượng | ✔ | ✔ | ✔ |
| C16 | Em muốn ghi nhận ngoài | Năm | kết quả đếm | S | ✔ em khai `measure_by` (nấc 0) | ✔ |
| C17 | Giữ điểm TB ≥ 8 cả năm | Năm | ngưỡng | ✘ | ✔ `giu_nguong` + số đo theo ngày; hiện "x/y lần giữ được" | ✔ `chieu=giu` |
| C18 | Cam kết hành vi + việc đúng hành vi | Tuần | tần suất | ✔ | ✔ | ✔ |
| C19 | Cam kết mang số kết quả (50 lead) | Tuần | kết quả đếm | ✘ | ✔ `so_hua/so_dat` (cần gật lật 14/08) | ✔ `so_hua/so_dat` |
| C20 | Deliverable một lần | Tuần | khác | ◐ | ◐ hết gợi thua; vẫn chấm ở PDR tuần sau | ✔ `xong_at` |
| C21 | Cam kết không có việc | Tuần | kết quả đếm | S | ✔ gợi ý null, không lưu 'lose' | ✔ |
| C22 | Cam kết em treo WIG lớp | Tuần | khác | ◐ | ✔ sau nấc 2 (lọc `approved` + `lay_tu`) | ✔ dây |
| C23 | 50 lead bằng cách mỗi em 3 bài blog | Xuyên | kết quả đếm | ✘ | ◐ hai số hai chỗ ✔; "mỗi em tick" chờ C24 | ✔ `so_hua` + thước `tung_em` |
| C24 | Việc chung, từng em tick phần mình | Việc | hành vi lượng | ✘ | ◐ chỉ khi gật lật một nửa 16/08 | ✔ `pham_vi=tung_em` |
| C25 | Cam kết sinh từ câu 6 PDR | Tuần | tần suất | ◐ | ◐ hết gợi thua, thêm việc tại chỗ; vẫn về `sent` (0141) | ✔ không duyệt cam kết |
| C26 | Phủ định: không lần nào | Xuyên | tần suất | ◐ | ✔ `huong=xuong` + nút "giữ được" ghi 0 | ✔ |
| C27 | Một chạm theo thứ cụ thể | Việc | tần suất | ✔ | ✔ | ✔ |
| C28 | Lượng cố định mỗi lần | Việc | hành vi lượng | ✔ | ✔ không còn phụ thuộc đơn vị WIG | ✔ |
| C29 | 30 phút/tối dưới WIG điểm | Xuyên | hành vi lượng | S | ✔ đơn vị việc riêng; không cộng lên vì khác `cach_gop` | ✔ |
| C30 | Điền số biến thiên (em) | Việc | hành vi lượng | ◐ | ✔ trần 10×; ô trống = không ghi | ✔ |
| C31 | Điền số của LỚP | Việc | hành vi lượng | S | ✔ `TickCuaLop` ô số + khoá duy nhất lượt lớp | ✔ `ca_doi` |
| C32 | Việc = kết quả trung gian em điền | Việc | kết quả đếm | ◐ | ✔ nhãn hỏi đúng đơn vị của việc | ✔ |
| C33 | Cân mỗi sáng, lấy số mới nhất | Việc | kết quả đo | S | ✔ đưa về tầng mục tiêu: số đo theo ngày (không có việc kiểu đo lại) | ✔ `so_do` theo ngày |
| C34 | Ngưỡng chất lượng mỗi lần (≥ 8) | Việc | ngưỡng | ✘ | ◐ chỉ qua cam kết có số "3 bài ≥ 8" | ✔ `nguong_moi_lan` |
| C35 | Đích số lẻ (2,5 km) | Việc | hành vi lượng | S | ✔ | ✔ |
| C36 | Đội một bộ đếm, số mỗi ngày khác | Xuyên | hành vi lượng | ✘ | ✔ `TickCuaLop` ô số | ✔ `ca_doi` |
| C37 | Đơn vị việc khác đơn vị WIG | Xuyên | hành vi lượng | S | ✔ ô đơn vị của việc | ✔ |
| C38 | Đơn vị sai chính tả / lạ | Việc | tần suất | S | ✔ đơn vị = nhãn | ✔ |
| C39 | Lead measure sống nhiều tuần | Việc | tần suất | ✘ | ✘ | ✔ `thuoc.tu_tuan/den_tuan` |
| C40 | Làm bù ngoài ngày đã chọn | Việc | tần suất | ◐ | ✔ tách cửa sổ / "cả tuần cần" | ✔ |
| C41 | Có làm, được 0 | Việc | kết quả đếm | ✘ | ✔ `value ≥ 0` | ✔ |
| C42 | Lag tầng dưới = lead tầng trên | Xuyên | kết quả đếm | ✘ | ✔ ba chỗ: số đo năm · `so_hua` tuần · việc | ✔ + dây |
| C43 | Hai WIG cùng domain | Năm | kết quả đo | ✘ | ✘ khoá `0145:15-17` | ✔ lĩnh vực là nhãn, ≤ 4 |
| C44 | Ngoài khung 4 domain (Marketing) | Năm | kết quả đếm | ◐ | ◐ | ✔ `linh_vuc=khac` |
| C45 | Tiền / tiết kiệm | Xuyên | hành vi lượng | ◐ | ✔ góp (`cong_don`) hay số dư (`so_moi_nhat`) do khai | ✔ |
| C46 | Nhịp lặp (1 buổi/tuần suốt năm) | Năm | tần suất | ◐ | ◐ giữ như nay | ✔ `giu_nhip` |
| C47 | Mọi bài kiểm tra ≥ 8 | Năm | ngưỡng | ✘ | ✔ `giu_nguong` + số đo theo ngày | ✔ `nguong_moi_lan` |
| C48 | Chạy 1 → 3 km liên tục | Năm | kết quả đo | S | ✔ em khai `so_moi_nhat` | ✔ |
| C49 | 100% nộp đúng hạn (của em) | Xuyên | tần suất | ◐ | ◐ ghi tay %; không suy từ tick | ✔ `nguon_so=thuoc`, `gop=ti_le` |
| C50 | Cô chốt Thắng/Thua cam kết LỚP | Tuần | khác | ✘ | ✔ nút riêng (chạm 19/08, cần gật) | ✔ |
| C51 | Việc tự tick từ điểm danh | Việc | tần suất | ✘ | ✘ | ✔ `nguon=he_thong` (định-nghĩa-viên, bọc lỗi) |
| C90 | Lớp = tổng WIG em qua dây | Xuyên | hành vi lượng | S | ✔ `lay_tu='muc_tieu_em'`, chỉ WIG đã duyệt, kẹp trần | ✔ dây `gop_so` |
| C91 | Khối 1–3 thầy cô nhập giúp | Xuyên | khác | ✘ | ✘ | ✔ `nguoi_nhap_ho`; chữ ký vẫn của em |
| C92 | Kiêng — đích là trần | Việc | tần suất | ✘ | ✔ `huong=xuong`; nút "lỡ 1 lần" / "giữ được"; Hub lọc | ✔ `chieu_dich=nhieu_nhat` |
| C93 | Nhiều lần trong ngày | Việc | tần suất | ✘ | ✔ `toi_da_ngay`, value tăng cùng dòng | ✔ |
| C94 | Chu kỳ dài hơn tuần | Tuần | khác | ✘ | ✘ | ✔ `ky` thước · `so_tuan` cam kết (chạm #1 18/08) |
| C95 | Mốc trung gian, "lẽ ra ở đâu" | Năm | kết quả đo | ✘ | ◐ đọc `expected_pct` tuyến tính | ✔ `moc` + `tuan_hoc` |
| C96 | Đổi / đóng mục tiêu giữa năm | Năm | khác | ✘ | ✘ | ✔ `closed` + `lich_su_dich` |
| C97 | Chuyển lớp mang theo mục tiêu | Xuyên | khác | S | S (giữ nguyên) | ✔ nối vào `apply_class_transfer` |
| C98 | Đơn vị tiếng Anh / ghép | Xuyên | khác | S | ✔ mã đơn vị + nhãn vi/en | ✔ bảng `don_vi` |
| C99 | Một việc nhiều mục tiêu | Xuyên | hành vi lượng | ✘ | ✘ | ✔ `chi_huong` nhiều-nhiều |
| C100 | Cuộn không kiểm domain / ngưỡng | Xuyên | tỉ lệ | S | ◐ lọc lĩnh vực + `nguong_con`; chưa phân biệt môn | ✔ `nguong_con` + `mon_id` |
| C101 | WIG trường không phải cuộn | Năm | kết quả đo | ✘ | ✘ | ✔ mọi kiểu + RLS đọc số đo trường |
| C102 | Lớp = trung bình số đo các em | Xuyên | kết quả đo | ✘ | ✘ | ✔ `gop=trung_binh` qua dây |
| C103 | Số đo nhiều lần/tuần, ghi bù | Năm | kết quả đo | ◐ | ✔ `wig_so_do` theo ngày | ✔ `so_do` theo ngày |
| C104 | Ghi bù trước PDR; ký giữa tuần | Việc | tần suất | ✘ | ◐ ghi bù qua `edit_requests` kind `add_tick` | ✔ cửa sổ 7 ngày, khoá tuần được nghiệm thu |
| C105 | Nhóm con (tổ, cặp buddy) | Xuyên | tần suất | ✘ | ✘ | ✔ `nhom` + đếm qua định-nghĩa-viên |
| C106 | Người chứng xác nhận | Tuần | khác | ✘ | ✘ | ✔ `cam_ket_xac_nhan` (buddy/thầy cô) |
| C107 | Khoảng trống chờ duyệt | Xuyên | khác | ◐ | ◐ | ✔ dây tới mục tiêu `gui` được, có nhãn |
| C108 | Cam kết không thuộc mục tiêu | Tuần | khác | ✘ | ✘ | ✔ `lac_muc_tieu` |
| C109 | Tuần nghỉ | Xuyên | khác | ✘ | ✘ | ✔ `tuan_hoc` (miễn, không chặn ghi) |
| C110 | Điểm từ bảng điểm có sẵn | Năm | kết quả đo | ✘ | ✘ | ◐ cơ chế qua `subject_scores`; hôm nay 0 dòng, môn là text |
| C111 | GVBM đặt việc môn mình | Xuyên | hành vi lượng | ✘ | ✘ | ◐ thước môn ngăn riêng; phân công 0 dòng active |
| C112 | WIG em nhiều thành phần | Năm | ngưỡng | ✘ | ✘ | ✔ `thanh_phan` |
| C113 | Giữa tuần biết thắng/thua | Xuyên | kết quả đếm | ✘ | ◐ nhịp việc ở cả 3 màn; cam kết có số chưa có nhịp | ✔ `so_do` theo ngày + nhịp theo cặp |

**Tổng**: Nay ✔ 6 · ◐ 18 · S 15 · ✘ 36. **PA1** ✔ 38 · ◐ 18 · S 1 · ✘ 18. **PA2** ✔ 73 · ◐ 2 · S 0 · ✘ 0.

¹ C01 ✔ chỉ đúng cho đường cô tick việc lớp (11 lượt `student_id null`); 52 lượt của 7 WIG em nối vào WIG 1200 không lên — đó là C90 (S). Cột PA1: các ✔ có điều kiện gật được ghi ngay trong ô (C19, C22, C50; C24 ◐); C46 và C97 giữ nguyên mức hôm nay vì PA1 không đụng tới chúng.

---

## 4. PHƯƠNG ÁN TỐI ƯU TRONG APP HIỆN TẠI

Khung: **Hướng B** (mỗi con số tự khai cách gộp / hướng / ngưỡng) làm xương; **khuôn câu của Hướng D** làm mặt cho trẻ; **tuần 0 của Hướng A** làm bước đầu không cần migration; **dây có vai và `can_xac_nhan` của Hướng E** cho phép cộng lên lớp và cho di trú. Giữ nguyên ba tầng, ba bảng, toàn bộ policy; chỉ thêm cột, sửa hàm đọc số, đổi form.

### 4.1 Mô hình

Bốn khai báo cho một con số — tất cả là cột người dùng chọn, đơn vị chỉ là nhãn:

| Khai báo | Mục tiêu năm (`wigs`) | Cam kết (`commitments`) | Việc (`lead_measures`) |
|---|---|---|---|
| Nguồn số | `measure_by` (đã có): tick / manual / cuon — **em cũng chọn** | tay người (`so_dat`) | tay người |
| Cách gộp `cach_gop` (mới) | `cong_don` · `so_moi_nhat` · `ti_le_nguoi_dat` | so `so_dat` với `so_hua` | `dem_lan` (bấm, × `unit_per_tick`) · `cong_don` (điền số) — **không** có kiểu đo lại ở tầng việc: số đo đi qua `wig_so_do` theo ngày |
| Hướng `huong` (mới) | len / xuong + cờ `giu_nguong` | `huong_hua` | len / xuong |
| Ngưỡng / dây | `nguong_con` (cuộn); WIG lớp tick khai `lay_tu` ∈ {viec, muc_tieu_em} | — | `toi_da_ngay`; đơn vị riêng; cửa sổ tách "cả tuần cần" |

```
MỤC TIÊU NĂM   measure_by × cach_gop × huong (+ giu_nguong · nguong_con · lay_tu)
   số = tick  → Σ việc dưới cam kết ĐÃ DUYỆT (lay_tu=viec)  HOẶC  Σ WIG em đã duyệt cùng cach_gop+đơn vị, kẹp trần mỗi em (lay_tu=muc_tieu_em)
      = manual → wig_so_do theo NGÀY (số mới nhất / Σ)   = cuon → % em đạt ngưỡng của LỚP, lọc lĩnh vực
   └─ CAM KẾT TUẦN  câu chữ · [Cam kết có con số? so_hua / so_dat] · Thắng/Thua do người (em ở PDR; cô cho cam kết LỚP)
        └─ VIỆC  dem_lan | cong_don · huong · đơn vị riêng · cửa sổ ≠ "cả tuần cần" · toi_da_ngay
source_wig_id = hướng đi (chip "góp vào / cùng hướng"), không cộng gì trừ khi cô chọn lay_tu=muc_tieu_em
```

Khuôn câu (mặt trước) ↔ cột (mặt sau):

| Người chọn | Lưu thành |
|---|---|
| "Mỗi ngày em làm một việc" · thứ · "mỗi ngày [n] lần" | `dem_lan`, `huong=len`, `toi_da_ngay=n`, `target` = số thứ × n (sửa được) |
| "Tuần này em làm được [100] [trang] bằng cách …" · ☐ "mỗi lần đều bằng nhau [20]" | tích: `dem_lan`, `unit_per_tick=20`; không tích: `cong_don`, `nhap_luong=true`, `target=100` |
| "Em sẽ không [quên vở] quá [1] lần" | `dem_lan`, `huong=xuong`, `target=1` (0 hợp lệ) |
| "Em làm xong [poster] trước [thứ Sáu]" | cam kết không việc; máy không gợi ý; em tự chấm ở PDR |
| Mục tiêu: "Số này là số em ĐẾM / em ĐO" + "Số lấy từ đâu" + ☐ "Giữ mức này suốt năm" | `cach_gop`, `measure_by`, `giu_nguong` |

### 4.2 Bản đồ tệp (đường dẫn đầy đủ)

- Màn em: `components/student/FormMucTieu.tsx`, `components/student/MucTieuCuaCon.tsx`, `components/student/OSoDo.tsx`, `components/wig/CamKetCuaEm.tsx`, `components/wig/SuaCamKet.tsx`, `components/student/LeadTicker.tsx`, `components/student/StudentScoreboard.tsx`, `components/student/HopPdr.tsx`; action: `app/[locale]/(dashboard)/student/actions.ts`, `app/[locale]/(dashboard)/student/pdr-actions.ts`.
- Màn cô: `components/wig/TaoWigMenu.tsx`, `components/wig/BangTienDo.tsx`, `components/wig/DatCamKetLop.tsx`, `components/wig/SuaCamKetLop.tsx`, `components/wig/ViecTuan.tsx`, `components/wig/TickCuaLop.tsx`, `components/wig/BangCacEm.tsx`, `components/wig/ChiTietTuan.tsx`; `app/[locale]/(dashboard)/wig/page.tsx`, `app/[locale]/(dashboard)/wig/actions.ts`.
- Luật dùng chung: `lib/wig-tao.ts`, `lib/don-vi.ts`, `lib/hop-data.ts`, `lib/hub/webhook.ts`; chuỗi `messages/vi.json`, `messages/en.json`.

### 4.3 Thứ tự làm — bốn nấc, mỗi nấc một PR tự đứng

**Nấc 0 — app thôi đoán, không migration (3–4 ngày, revert bằng một PR).**
1. `components/wig/BangTienDo.tsx:241`: điều kiện ô "Số của lớp tuần này" đổi từ `kieuDonVi(d.unit)==='do'` sang `d.measureBy==='manual' && d.measureBy!=='cuon'` — cùng luật với `components/student/MucTieuCuaCon.tsx:331`. **Đây là lật commit 9a5d3d5 (14/08/2026, chủ dự án: "ô số đo mỗi tuần theo KIỂU ĐƠN VỊ") — làm theo lập trường 01/09 "app không được phán xử đơn vị"; vẫn ghi vào bảng hỏi §8 để chủ dự án xác nhận.** Ngay lập tức hai WIG Marketing có chỗ ghi số.
2. `app/[locale]/(dashboard)/student/actions.ts:828-829`: bỏ suy `measure_by` từ đơn vị; `components/student/FormMucTieu.tsx` thêm hai thẻ "Số em ĐẾM — mỗi lần làm là cộng thêm" / "Số em ĐO — số mới nhất mới là thật" (mặc định gợi theo đơn vị, em đổi được); server chỉ nhận ∈ {tick, manual}. Lật quyết định 13/08 (0110, chủ dự án). Khi em đổi ô này trên WIG đã duyệt: báo trước "về chờ thầy cô duyệt lại" (trigger `0151:62-77` coi `measure_by` là nội dung).
3. Cảnh báo sai: `app/[locale]/(dashboard)/wig/page.tsx:284` → `quaNhieu: !l.nhap_luong && soTickCan > tran`; `components/student/LeadTicker.tsx:403` thêm `!l.nhapLuong`. Sửa **kỳ vọng** của `scripts/test-moi-lan-tick.mjs` (loại việc `nhap_luong` khỏi phép so trang↔SQL, ghi lý do đầu tệp) — không tắt test (bài học `0132`).
4. `lib/wig-luat.ts` (mới) — một bộ luật cho hai màn: hướng đi (tick ⇒ X < Y; manual ⇒ X ≥ Y được, X = Y là "giữ mức"), số lẻ (chỉ đòi nguyên với việc bấm một chạm hệ số 1), `toiDich` chép đúng `0113:89-100`. Dùng ở `lib/wig-tao.ts:168-178`, `student/actions.ts:809-818`, `wig/actions.ts:258-268` (bỏ `Number.isInteger` khi manual), `components/wig/TaoWigMenu.tsx:145,417,430` (step theo `measure_by`), `components/wig/ViecTuan.tsx:181,222` + `wig/actions.ts:161-162`. Kèm `scripts/test-wig-luat.mjs` chạy **trước** khi vá phải đỏ ở C05/C07/C35.
5. Đọc `expected_pct` đã có sẵn trong `wig_progress_v` mà `wig/page.tsx:380-403` bỏ qua → dòng "Theo nhịp đều, hôm nay lẽ ra ~{n}%" cho WIG tick.
6. Chữ trên màn — **chỉ bản VI**; bản EN giữ thuật ngữ v3 (quyết định 19/08; `messages/en.json:433` "WIG & Lead measures", `:490` "Lead measures — teacher ticks" để nguyên; khoá mới thêm ở cả hai tệp): `wig.title` → "Mục tiêu & Việc"; `wig.workToTick` (`vi.json:490`) → "Việc của lớp — thầy cô ghi"; `wig.addWork`/`wig.leadTitle` (`:491`, `:440`) → "Thêm việc"/"Tên việc"; `wig.target` (`:438`) "Mục tiêu (số)" → "Cả tuần cần"; `verdictLostTag` (`:549`) "Chưa đạt" → "Thua"; `components/wig/BangCacEm.tsx:186` "V"/"X" → "Thắng"/"Thua"; `pdr.linkWig`/`pdr.pickWig` (`components/student/HopPdr.tsx:217,224`) và `pdr-actions.ts:187,205` bỏ chữ "WIG"; `student.tickWeekLocked` (`:705`) bỏ "PDR"; `components/wig/SuaCamKetLop.tsx:59` "Tuần này em làm gì" → "Việc của lớp"; tách `meeting.commitmentPlaceholder` thành hai bản em/cô; `wig.noWeekWigsHow`/`addWorkNeedsWig`/`noWigs` viết lại (đang chỉ tới "tháng rồi tuần", "mục tiêu tuần", "khung trên" đã bỏ).
7. Câu đọc lại trước nút Lưu ở màn cô (như `goal.preview` của em) + cảnh báo mềm "Tiêu đề nói 1020 → 1600 nhưng ô 'đang ở' để 0" — **không** ép sửa: đổi `baseline` của WIG lớp đã duyệt đưa nó về `sent` (`0151:98-112`), cả lớp mất đường đặt cam kết tới khi BGH duyệt lại.
8. **Không làm ở nấc 0**: em treo cam kết dưới WIG lớp, đơn vị việc tự do dưới WIG tick, "việc đếm số", "Từ" bắt buộc, "Tick giúp em" — chúng mở lỗ mà không có CSDL đỡ (xem §7).

**Nấc 1 — migration `0160_moi_con_so_khai_cach_gop.sql` (4–5 ngày).** Mỗi tệp tự `begin/commit` vì `scripts/run-sql.mjs:96-97` chạy nguyên chuỗi không bọc transaction; đọc `pg_constraint`/`pg_proc` ngay trước khi chạy; mọi cột NOT NULL mới có **default tạm** để code cũ vẫn chạy trong cửa sổ migration→deploy (gỡ default ở 0161). PA1 không đụng enum nào.
- `wigs`: `cach_gop` (default tạm `'cong_don'`; CHECK ∈ cong_don/so_moi_nhat/ti_le_nguoi_dat), `huong` default `'len'`, `giu_nguong` bool, `nguong_con` numeric, `lay_tu` default `'viec'` (CHECK viec/muc_tieu_em). Backfill: cuon → `ti_le_nguoi_dat` (0 dòng); manual + `kieu_don_vi='do'` → `so_moi_nhat` (2 dòng: thể lực, Toán em); **2 WIG manual Marketing (lead, khách hàng) → `so_moi_nhat` tạm + `can_xac_nhan=true`** — không đoán, hỏi cô "số ghi mỗi tuần là tổng đến nay hay số mới thêm?"; tick → `cong_don` (12 dòng, gồm 2 WIG rác 12A1 — không đụng gì khác, xin xoá trước). Drop `wig_target_pos` (`0020_data_integrity.sql:53`) → CHECK `target_value ≥ 0 and (target_value > 0 or huong='xuong' or giu_nguong)`; CHECK hướng↔X,Y theo `lib/wig-luat.ts`. **Không** đụng `wig_cuon_ck`/`wig_school_cuon_ck` (`0116:80-95`).
- `lead_measures`: `cach_gop` (default tạm `'dem_lan'`; CHECK dem_lan/cong_don), `huong` default `'len'`, `toi_da_ngay` int default 1. CHECK: `cong_don ⇒ nhap_luong and unit_per_tick = 1`; `dem_lan ⇒ not nhap_luong`. Backfill: 3 `nhap_luong` → `cong_don`, 29 còn lại → `dem_lan`. `unit` giữ nullable (form nấc 3 luôn gửi).
- `commitments` (**cần gật lật 14/08; không gật thì bỏ trọn khối này, phần còn lại không phụ thuộc**): `so_hua`, `don_vi_hua`, `huong_hua` default `'len'`, `so_dat`, `so_dat_by`, `so_dat_at`; CHECK `(so_hua is null) = (don_vi_hua is null)`, `so_dat is null or so_hua is not null`. Backfill null cho 33 dòng — không bóc số từ tiêu đề.
- `wig_so_do`: cột `ngay date` (1 dòng cũ: `ngay = week_start`), trigger BEFORE `week_start := vn_week_start(ngay)`, drop UNIQUE `(wig_id, week_start)` (đọc tên thật trong `pg_constraint`), UNIQUE `(wig_id, ngay)`. `ghiSoDo` (`student/actions.ts:1283-1292`) sửa **trong cùng PR** để gửi `ngay`; nhánh `23505 → update theo week_start` bỏ.
- `lead_progress`: drop `lead_progress_value_pos` (`0020:23`) → CHECK `value ≥ 0`; unique `(lead_measure_id, logged_date) where student_id is null` — đã kiểm 01/09: **0 cặp trùng** trong 11 lượt lớp, tạo được ngay.
- **Bốn trigger duyệt phải biết cột mới** (chỗ cả B/D/E cùng ngã): `private.wig_em_sua_thi_cho_duyet` (`0151:62-77`) và `private.wig_lop_qua_tay_bgh` (`0151:98-112`) thêm `cach_gop/huong/giu_nguong/nguong_con`; tuple của `private.chi_em_va_bgh_sua_muc_tieu` (`0155`) thêm bốn cột ấy, riêng `source_wig_id` và `lay_tu` xếp vào nhóm **cô được sửa** (đó là hướng đi và phép cộng của lớp, không phải lời của em); `private.cam_ket_trang_thai` (`0141:32`) coi `so_hua/don_vi_hua/huong_hua` là nội dung → em đổi là về `sent`; tuple của `private.chi_em_va_bgh_sua_cam_ket` (`0151`) thêm ba cột ấy vào nhóm cô không sửa; `so_dat`: cô ghi cho cam kết LỚP, em cho cam kết của em (cùng nhóm với `verdict`). Viết theo lối **whitelist "cột KHÔNG phải nội dung"** để cột thêm sau này mặc định phải duyệt lại (đúng lời cảnh báo trong `0133`).
- Test SQL đi kèm, chạy trước phải đỏ: `test-cach-gop-cot.sql`, `test-so-do-theo-ngay.sql`, `test-luot-lop-unique.sql`, `test-cam-ket-co-so.sql`, `test-trigger-duyet-cot-moi.sql` (em đổi `huong` → về `sent`; cô đổi `so_hua` của em → 42501).

**Nấc 2 — migration `0161_phep_gop_doc_khai_bao.sql` (8–10 ngày).** Liệt kê chỗ đọc số bằng `grep -n "kieu_don_vi\|quang_duong\|measure_by = 'manual'\|wig_actual"` trên `supabase/migrations`, `lib`, `components`, `app` — không bằng trí nhớ. Mỗi hàm: đọc `pg_proc` rồi mới `create or replace`, ghi md5 cũ vào header.
- Mới: `private.gia_viec(lead, em, tu, den)`; `private.viec_dat` — len: `gia ≥ target`; xuong: `gia ≤ target` **và** có ghi nhận ở mọi ngày cửa sổ đã qua (không ghi ≠ 0; thiếu ngày → chưa biết); `toi_dich(so, dich, huong text)` — revoke public/anon cho overload mới, giữ bản 3-numeric vì `class_lead_board` (`0122:116`) và scripts còn gọi; `private.quang_duong(dich, dang_o, huong)` — giữ bản 2 tham số nhưng viết lại thân **cùng lúc** để `class_competition_scores` (`0109:250-275`, là hàm riêng, không đọc view) không lệch. GRANT execute cho `authenticated, service_role` như `0116:293` — view invoker gọi hàm definer, thiếu grant là lỗi 42501 cho cả trường mà build vẫn xanh.
- Viết lại: `private.wig_actual_so` (`0124`) theo ma trận `measure_by × cach_gop` + `lay_tu` + **lọc `c.status='approved'`** + kẹp `least(gia, target)` mỗi (việc, em); `private.wig_actual` (`0116:297-309`) — manual đọc `wig_so_do` (số mới nhất theo `ngay desc` hoặc Σ); `wig_dat` (`0116:124-154`) bỏ `kieu_don_vi`; `giu_nguong`: "đang giữ" ≠ "đã đạt" — đã đạt chỉ khi `achieved_at` hoặc đã hết `end_date` với mọi số đo đạt; `em_dat_du` + `lop_dat_du` (`0116:159-188`) lọc `area` và so `nguong_con`; `ty_le_cuon` truyền `area/nguong_con`; `so_do_moi_nhat` order by `ngay desc`; `wig_progress_v` (`0109`/`0150`) pct theo `huong/giu`, manual dùng số đo, **giữ đủ cột cũ và `security_invoker=true`**; `child_class_progress` (`0109`); `class_competition_scores` (`0109:250-275`); `school_wig_rollup`, `class_lead_board`, `child_week_report` (`0122`); `pdr_bang` (`0129`); `cam_ket_goi_y` (`0121:297-326`): có `so_hua` → theo `so_dat` (null ⇒ null); có việc → `bool_and(viec_dat)`; không gì → **null** và `verdict_goi_y` lưu null; `lead_tuan_v`/`metrics_tuan_v` (`0147:14-43`): `duoc = gia_viec`, cột `dat = viec_dat`, cột mới `can_toi_hom_nay` (= target × ngày cửa sổ đã qua / tổng) và `dung_nhip`; `private.chan_luong_vo_ly` (`0110:38-53`): `dem_lan` len ⇒ `1 ≤ value ≤ toi_da_ngay`, `dem_lan` xuong ⇒ `value ≥ 0`, `cong_don` ⇒ `value ≤ 10 × target` (chống gõ thừa số 0, không chặn "đọc dồn Chủ nhật"); `lead_measure_canh_bao` (`0132`): `qua_nhieu` chỉ với `dem_lan`, `lech_don_vi` → `lech_ban_chat`; trigger Hub `private.hub_hang_doi_tick_dan_dat` (`0157:63-97`): **bỏ qua lượt của việc `huong='xuong'`** (lần vi phạm không phải "tick việc dẫn dắt") và thêm `logged_by` vào payload — `lib/hub/webhook.ts:106-126` và dispatcher đổi theo, **báo phía os.truongvietanh.com trước**; `private.noi_muc_tieu_len_lop` (`0155`) giữ nguyên (dây chỉ là hướng đi).
- Bốn bản sao công thức phía client đọc cột `dat/duoc` của view thay vì tính lại: `lib/hop-data.ts:102`, `components/student/StudentScoreboard.tsx:539-548`, `components/wig/BangCacEm.tsx:104-116`, `components/wig/ChiTietTuan.tsx:79`; `LeadTicker.tsx:148` (cập nhật lạc quan) theo `cach_gop`.
- Test: `test-gia-viec.sql` (2 cach_gop × 2 huong × em/lớp, value 0, không ghi ≠ 0), `test-wig-huong-giu.sql` (60→52, đích 0, giữ ≥ 8 rơi một ngày), `test-lay-tu-khong-dem-doi.sql`, `test-cuon-loc-linh-vuc.sql`, `test-view-invoker-revoke.sql` (hai lỗ 18/08), `test-hub-loc-kieng.sql`; sửa kỳ vọng `test-dem-theo-luong.sql` luật 3 (trần 10×); `test-kieu-don-vi.mjs` → `test-suy-cach-gop-mot-lan.mjs` (kiểm bảng ánh xạ backfill, so bộ khớp chứ không so danh sách); `npm run gen:types`.

**Nấc 3 — giao diện (9–11 ngày; chụp 360 px với chuỗi VI dài nhất trước khi merge; đọc thử với 2–3 em lớp Test).**
- Khối khuôn câu dùng chung (`components/wig/KhuonCau.tsx`) thay khối đong đếm ở `CamKetCuaEm.tsx:202-253`, `SuaCamKet.tsx:128-151`, `ViecTuan.tsx:217-268`, `SuaCamKetLop.tsx`; bốn nút như bảng §4.1; câu ráp lại hiện ngay dưới ("Tuần này em làm được 100 trang bằng cách đọc sách mỗi tối, giúp mục tiêu Đọc 12 cuốn."); câu chốt có phép tính ("Vậy là: 5 ngày × 20 phút = 100 phút mỗi tuần"). Mặc định của VIỆC luôn là "Mỗi ngày em làm một việc" — không suy từ đơn vị WIG. Màn cô thêm dòng "Cả lớp một số — thầy cô ghi mỗi ngày" (việc lớp mặc định); "mỗi bạn tự tick phần mình" chỉ xuất hiện nếu chủ dự án gật lật một nửa 16/08 (C24).
- Ô tích **"Cam kết có con số?"** → `[50] [lead ▾] ☐ càng ít càng tốt`; cuối tuần / câu 2 PDR: "Tuần rồi được bao nhiêu lead? [42]" → `so_dat`; "Máy thấy: 42/50 — chưa tới. Em chấm: ○ Thắng ○ Thua". Cảnh báo mềm khi việc bên dưới cùng đơn vị cùng đích với cam kết (chống "chép số xuống").
- Form mục tiêu (em: `FormMucTieu.tsx`; cô: `TaoWigMenu.tsx:321-335` bỏ dropdown "Đo bằng gì"): "Từ [X] đến [Y] [đơn vị ▾] · trước [ngày]"; **"☐ Em chưa biết mình đang ở đâu"** = `baseline null` (khác 0); "Số này là gì?" ○ em ĐẾM ○ em ĐO ○ (lớp/trường) tỉ lệ bạn đạt · "Số lấy từ đâu?" ○ từ việc em tick ○ em/thầy cô ghi số · "☐ Giữ mức này suốt năm"; câu chốt "Vậy là: từ 18 giây xuống 15 giây — càng nhỏ càng tốt — em ghi số mỗi lần chạy." Không dùng ví dụ cân nặng trên màn em (dữ liệu cơ thể trẻ, `docs/DATA_GOVERNANCE.md`). Hạn ngoài năm học báo lỗi thay vì kẹp âm thầm (`student/actions.ts:893-894`).
- WIG lớp tick: "Cộng từ đâu? ○ Việc của lớp ○ Mục tiêu của các bạn (cùng đơn vị, đã duyệt)" → `lay_tu`. Ghi chú phát hành cho GVCN lớp Test: chọn cái thứ hai là WIG "1200 bài" nhảy 11 → 63.
- Thẻ mục tiêu (`BangTienDo.tsx`, `MucTieuCuaCon.tsx`, `components/student/OSoDo.tsx`): vạch khi có số + "Đang ở: 7,0 · em ghi 25/08"; ô "Số hôm nay [ ] · ngày [▾]" + "Các lần đã ghi" (sửa, ghi bù theo ngày); chip "Số đã tới đích — em xác nhận" chỉ khi máy thấy; bỏ nút "Đánh dấu đã đạt" khi chưa tới; `giu_nguong` hiện "x/y lần giữ được". Chip dây: "Góp vào mục tiêu lớp …" (khi `lay_tu=muc_tieu_em` và cùng bản chất) / "Cùng hướng với …" (khác); GVCN gỡ dây được.
- `LeadTicker.tsx`: "Đến hôm nay lẽ ra 3 — em đã 2" tô xanh/vàng/đỏ theo cửa sổ, đảo chiều với `xuong`; ô số "Hôm nay em làm được [ ] — 0 cũng được" (bỏ "trống → 1" ở `:187`); bấm lần 2 hiện "2/3"; việc kiêng có hai nút "Hôm nay em lỡ 1 lần" / "Hôm nay em giữ được"; `luongQuaLon` (`vi.json:812`) → "Nhiều hơn cả tuần đấy — em chắc chứ?". `BangCacEm`/`DaiChiSo` đọc `dung_nhip`; `school_wig_rollup` thêm cột `viec_dung_nhip` — C113 vẫn ◐ vì cam kết có số chỉ có một số đạt cuối tuần.
- `TickCuaLop.tsx:62-69`: với `cong_don` hiện ô số mỗi ngày (khoá duy nhất lượt lớp đỡ phía sau).
- Nút "Thắng/Thua" cho cam kết **LỚP** trên `/wig`: action mới `chamCamKetLop` trong `wig/actions.ts` (ghi `verdict, verdict_goi_y, verdict_by, verdict_at`; RLS `rls_cam_ket_gvcn` đã cho) — **không** tái dùng `ketThucBuoiHop` (`wig/hop/actions.ts:131-172` luôn ghi `chot_at` và khoá tick cả lớp).
- Ghi bù: mở giao diện cho `edit_requests` kind `add_tick` đã có (`0045_edit_request_kinds.sql:21`; xử lý cạnh `undo_tick` ở `student/actions.ts:704`) — em xin, cô duyệt và app ghi với `logged_by` = cô. Không mở cửa sổ 7 ngày trong PA1.
- Đơn vị: dropdown lưu mã, nhãn theo locale qua helper (`nhanDonVi`) — bản EN không in "điểm"; rà ~15 chỗ render `{unit}` thô.
- Nhãn PDR: `pdr.title` → "Họp với bạn", `titleCoach` → "Họp với thầy cô"; gợi ý câu 2 chỉ khi cam kết có việc hoặc có số.

### 4.4 Quyết định cũ bị lật trong PA1

| # | Quyết định | Ngày · ai | Lật thế nào, vì sao |
|---|---|---|---|
| 1 | Ô số đo theo kiểu đơn vị (`9a5d3d5`; `BangTienDo.tsx:241`) | 14/08 · chủ dự án | Toàn phần: theo `measure_by` ở cả hai màn. Chính WIG "3000 Qualified Lead" manual không có chỗ ghi; lập trường 01/09 |
| 2 | Em không khai đo bằng gì, suy từ đơn vị (0110; `student/actions.ts:828-829`) | 13/08 · chủ dự án | Toàn phần: em chọn như cô đã chọn từ 17/08 (`TaoWigMenu.tsx:321-335`); RLS `rls_insert_wig_cua_em` chưa từng giới hạn |
| 3 | Kiểu đơn vị suy từ chuỗi quyết định phép gộp (`dc7892c`/`635b22e`; 0113) | 13–14/08 · chủ dự án | Toàn phần: `cach_gop` là cột khai; `kieu_don_vi` chỉ chạy một lần trong backfill và gợi ý mặc định |
| 4 | Cam kết không mang số (0121; `lib/wig-tao.ts:217-219`) | 14/08 (gốc 11/08) · chủ dự án | Tuỳ chọn `so_hua/so_dat`; lời của chính chủ dự án 01/09 "Cam kết tuần là tạo ra 50 lead"; 3/6 cam kết lớp và 2/7 cam kết em thật có số |
| 5 | Không vẽ vạch cho manual (`docs/MO_HINH_WIG.md:175`; 0101/0107/0109) | 11/08 · chủ dự án | Một phần: vạch chỉ khi có số do người ghi, luôn kèm nguồn + ngày; chưa có số thì "Chưa có số" |
| 6 | `source_wig_id` không tham gia phép tính (`docs/MO_HINH_WIG.md:59-60`) | 11/08 · chủ dự án | Có điều kiện: chỉ khi cô chọn `lay_tu=muc_tieu_em`, chỉ WIG em đã duyệt, cùng bản chất, kẹp trần mỗi em — không cộng ngầm |
| 7 | Một ngày không ghi quá chỉ tiêu tuần (0110:38-53) | 13/08 · chủ dự án | `cong_don` chặn > 10×; số đo không so với đích |
| 8 | `wig_so_do` một dòng/tuần (0108) | 13/08 · chủ dự án | Theo ngày — chính ví dụ "T2 35 kg, T3 35,4" của chủ dự án 14/08 |
| 9 | CHECK `value > 0`, `target_value > 0` (`0020:23,53`) | 24/07/2026 · commit `dcdf6e1` "Audit Phase 2", đội kỹ thuật | Thay bằng CHECK theo `cach_gop/huong`: "có làm được 0" và "đích 0" là số thật |
| 10 | Chặn X ≥ Y (`lib/wig-tao.ts:173` 11/08; `student/actions.ts:813` 13/08) | 11–13/08 · chủ dự án | Chỉ giữ cho tick (máy cộng chỉ tăng); manual mở cho giảm/giữ — nhánh `toi_dich` đi xuống đã có từ 14/08 |
| 11 | Số lần/tuần = số thứ đã bật (0103) | 12/08 · chủ dự án | Tách cửa sổ và "cả tuần cần", mặc định vẫn = số thứ nên ca "đặt 5 ngày vẫn là 3" không tái diễn |
| 12 | Việc của em thừa kế đơn vị WIG (0110; 16/08) | 13/08, 16/08 · chủ dự án | Ô đơn vị riêng; 26/26 việc em trùng đơn vị WIG là dấu form ép |
| 13 | Máy gợi thua khi cam kết không việc (`0121:322`) | 14/08 · chủ dự án | Gợi ý null |
| 14 | Bỏ cảnh báo lệch đơn vị (`c044a59`) | 15/08 · chủ dự án | Thay bằng cảnh báo lệch bản chất một câu, chỉ khi việc khác `cach_gop`/đơn vị với WIG tick |
| 15 | Thắng/thua chỉ em tự chấm (0154) | 19/08 · chủ dự án | **Có giới hạn**: cô chấm **cam kết LỚP** bằng nút riêng; không mở lại họp lớp; 6 cam kết lớp thật hiện không ai chấm được, `school_wig_rollup.wigs_won` đứng 0 |
| 16 | Cột `source_wig_id` là nội dung cô không được sửa (0133/0155) | 15/08 · chủ dự án | Nhỏ: cô gỡ/nối dây hướng đi được (dây là chuyện của lớp, không phải lời của em) |
| 17 | Việc lớp: cô tick, em không thấy (`4ebc9a7`) | 16/08 · chủ dự án | **Chỉ nếu gật**: thêm lựa chọn "mỗi bạn tự tick" (C24 ◐); mặc định vẫn như cũ |

### 4.5 Đường đi dữ liệu cũ

| Dữ liệu 01/09 | Sau PA1 | Cần người |
|---|---|---|
| 29 việc một chạm (bài 24, lần 4, "buồi" 1) | `dem_lan`; Σ value × 1 y hệt; "buồi" chỉ còn là nhãn, hết bị hỏi thừa | không |
| 3 việc `nhap_luong` (lead ×2, bài blog) | `cong_don`; hết cảnh báo đỏ sai; việc lớp "Viết 3 bài blog" 30 giữ nguyên | hỏi cô Marketing: 30 cả lớp hay 3 mỗi em (`can_xac_nhan`) |
| 65 lượt tick (11 lượt lớp, 0 trùng ngày) | không đổi dòng nào; khoá duy nhất lượt lớp tạo được ngay | không |
| 2 WIG manual điểm (thể lực 6→8; Toán em 7→10) | `so_moi_nhat`; thể lực có số 8 ≥ 8 → chip "Số đã tới đích — xác nhận?" (trước là "Chưa đạt") | cô bấm xác nhận |
| 2 WIG manual Marketing (lead, khách hàng) | `so_moi_nhat` tạm + `can_xac_nhan`; 0 dòng số đo nên đổi qua lại không mất gì; "1020→1600" baseline 0 giữ, chỉ cảnh báo mềm | cô trả lời cách ghi; cô tự sửa X (biết trước là về chờ BGH duyệt) |
| 12 WIG tick (Test lớp + 9 em + 2 rác 12A1) | `cong_don`; WIG Test "1200 bài" chỉ đổi số khi cô chọn `lay_tu` | chủ dự án cho xoá 2 WIG rác 12A1 **trước** 0160 (mục 9 CLAUDE.md) |
| 33 cam kết (16 verdict) | `so_hua` null toàn bộ; 5 cam kết thật có số trong tiêu đề → thẻ gợi "Cam kết này có con số? Thêm để máy đếm"; `verdict_goi_y` cũ giữ nguyên | cô/em tự điền nếu muốn |
| 1 dòng `wig_so_do` | `ngay = 10/08/2026` | không |
| 26 lớp không có dữ liệu WIG (25 trống + 12A1 sau khi xoá rác) | không có gì để chuyển | không |

Đường lùi: nấc 0 revert bằng một PR; nấc 1 có migration "quay về" (drop cột mới, dựng lại CHECK cũ) chạy được chừng nào chưa có dòng nào dùng giá trị mới; nấc 2 đọc `pg_proc` và giữ md5 cũ để đè lại.

### 4.6 Bộ kiểm cần viết

- Thuần: `scripts/test-wig-luat.mjs`.
- SQL tự rollback, chạy trước vá phải đỏ: `test-cach-gop-cot.sql`, `test-so-do-theo-ngay.sql`, `test-luot-lop-unique.sql`, `test-cam-ket-co-so.sql`, `test-trigger-duyet-cot-moi.sql`, `test-gia-viec.sql`, `test-wig-huong-giu.sql`, `test-lay-tu-khong-dem-doi.sql`, `test-cuon-loc-linh-vuc.sql`, `test-view-invoker-revoke.sql`, `test-hub-loc-kieng.sql`.
- Dựng thật với phiên lớp Test: `test-loi-khai.mjs` (WIG manual "lead" có ô số ở `/wig`; WIG tick "điểm" không có; 3 việc `nhap_luong` hết đỏ; `TickCuaLop` có ô số; em thấy hai thẻ "đếm/đo"); `test-mobile.mjs` chụp 4 form 360 px; `chup-trang.mjs` thẻ việc kiêng/đếm/điền.
- Sửa kỳ vọng (không tắt): `test-moi-lan-tick.mjs`, `test-dem-theo-luong.sql` luật 3, `test-kieu-don-vi.mjs` → kiểm bảng ánh xạ backfill; các test cố ý kiểm luật bị lật (`test-khong-ve-vach-gia`, chặn X ≥ Y) viết lại thành luật mới, ghi lý do trong commit.
- Sau mỗi PR: `curl -s https://class.truongvietanh.com/api/health` đúng SHA rồi mới chụp `/wig` và `/student`.

### 4.7 Ước lượng

**25–30 ngày người**, 4 PR: nấc 0 3–4 · nấc 1 4–5 · nấc 2 8–10 · nấc 3 9–11 (gồm ~45 khoá vi/en, helper nhãn đơn vị, ảnh 360 px, chạy lớp Test một tuần thật với 4 agent sau mỗi nấc). Chưa tính thời gian chờ chủ dự án gật và cô Marketing trả lời `can_xac_nhan`. Người mới vào repo cộng 3–4 ngày đọc 0100–0159.

### 4.8 Cái PA1 KHÔNG cứu được

18 ca ✘ đúng theo cột PA1 của §3: **C09, C12, C39, C43, C51, C91, C94, C96, C99, C101, C102, C105, C106, C108, C109, C110, C111, C112** — và C97 giữ mức S. Tất cả là cấu trúc: việc sống nhiều tuần, khoá 1 WIG/domain, định tính, vòng đời mục tiêu, chu kỳ dài, một việc nhiều mục tiêu, nhóm con, tuần nghỉ, nguồn hệ thống, GVBM, nhập hộ, người chứng, lạc mục tiêu, WIG trường/cuộn trung bình, chuyển lớp. Chúng chỉ giải được khi xây lại (§5). Ghi rõ điều này vào `docs/MO_HINH_WIG.md` §5.1 để không ai tưởng PA1 là mô hình đủ.

---

## 5. PHƯƠNG ÁN XÂY LẠI ("mặc cho đập đi xây lại")

Bộ xương của **Hướng C** (bốn tầng, bảng mới đứng cạnh bảng cũ, bật theo lớp), với tầng khai báo gọn của B/E, dây có vai của E, mặt trước khuôn câu của D, và bốn chỗ sửa mà cả ba giám khảo/phản biện cùng chỉ: phép tính theo từng cặp kiểu đích × chiều, quyền qua hàm định-nghĩa-viên, khoá chữ ký theo tuần được nghiệm thu, di trú không đoán.

### 5.1 Mô hình đích

```
MỤC TIÊU  ("Mục tiêu")      Từ X đến Y trước Z · mọi cấp trường/lớp/nhóm/em · số đích + số đo theo NGÀY
  └─ THƯỚC ("Việc em làm")   lead measure: sống nhiều tuần · chỉ tiêu mỗi kỳ · ghi mỗi ngày · 12 ô tuần
       └─ CAM KẾT TUẦN ("Cam kết")  1–2 việc cụ thể của tuần · được mang số · trỏ vào thước hoặc mục tiêu · Thắng/Thua tự báo · người chứng
NHỊP  ghi mỗi ngày → họp với bạn mỗi tuần → họp với thầy cô mỗi tháng · trên LỊCH TUẦN HỌC (tuần nghỉ chỉ MIỄN, không chặn)
DÂY   con → cha · vai gop_so (số cộng lên, MỘT dây/con) hoặc chi_huong (chỉ hiện "phục vụ", NHIỀU-NHIỀU)
```

Chữ trên màn giữ **"Cam kết"** (32 chuỗi, 700 người đã quen) — không đổi sang "Lời hứa". Bản EN giữ thuật ngữ v3.

### 5.2 Schema (migration đánh số tiếp từ 0160, không sửa tệp đã chạy; mỗi tệp một transaction; `alter type` tách tệp riêng)

- **`don_vi`** (id, mã, nhãn vi, nhãn en, nhóm) — mọi phép gộp/so khớp dùng **id**, không so chuỗi.
- **`muc_tieu`**: `cap` {truong, lop, nhom, em} + `campus_id/class_id/nhom_id/student_id` (**giữ `class_id` cho mục tiêu em**, cập nhật khi chuyển lớp); `linh_vuc` {4 domain, khac} là NHÃN, `mon_id` null → `subjects` (`0069_subjects_and_teaching.sql:25`); `ten`; `x_chu/y_chu`; `x_so/y_so/don_vi_id`; `chua_do_x`; `chieu` {tang, giam, giu}; `kieu_dich` {toi, tran_tich_luy, giu, toc_do_ky, ti_le_dat, chu}; `nguon_so` {thuoc, ghi_tay, he_thong, con}; `gop_con` {cong, trung_binh, ti_le_dat} + `nguong_con` + `lay_tu`; `ky` (cho `toc_do_ky`: tuan/thang); `bat_dau/ket_thuc` tự do trong năm học; `trang_thai` {nhap, gui, duyet, tra_lai, dong} + `ly_do_dong` {dat, doi, bo}; `dang_tap_trung` (≤ 2); `nguoi_nhap_ho`. CHECK: `y_so ⇒ x_so or chua_do_x`; `tang ⇒ x<y`, `giam ⇒ x>y`, `giu` tự do; `toc_do_ky ⇒ ky`; `nguon_so=con ⇒ cap ∈ {lop, truong} và gop_con`. Không unique theo lĩnh vực; ≤ 4 mục tiêu `duyet` đang chạy / chủ thể / năm.
- **`moc_muc_tieu`** (ngày, giá trị mong — rải theo tuần học), **`thanh_phan`** (tên, ngưỡng, chiều, don_vi_id — cho "6/8 môn ≥ 6,5", IELTS 4 kỹ năng), **`lich_su_dich`** (X/Y cũ-mới, lúc, ai, lý do — % quá khứ tính theo đích tại thời điểm), **`so_do`** (muc_tieu_id | thanh_phan_id, `chu_the` null, `ngay`, `gia_tri`, `nguon` {tay, he_thong}, `nguoi_ghi` — nhiều dòng/tuần, ghi bù ngày cũ).
- **`thuoc`**: `chu_the` {lop, nhom, em} + khoá tương ứng; `ten` (cảnh báo mềm bắt đầu bằng động từ); `cach_ghi` {cham, dien_so, he_thong}; `don_vi_id`; `moi_lan`; `toi_da_ngay`; `chi_tieu_ky`; `ky_tuan` {1, 2, 4}; `chieu_dich` {it_nhat, nhieu_nhat}; `nguong_moi_lan`; `gop` {tong, moi_nhat, dem_dat_nguong}; `pham_vi` {tung_em, ca_doi}; `ngay_ap_dung` + `cho_bu`; `tu_tuan/den_tuan`; `trang_thai` {chay, tam_dung, dong}; `duyet` (một lần khi tạo); `mon_id`; `nguoi_nhap_ho`. **Trần đếm theo người phải ghi**: tổng hàng thước một em phải ghi (riêng + lớp `tung_em` + nhóm + môn) ≤ 4; thước `ca_doi` không tính vào em; thước môn của GVBM có ngăn riêng ≤ 1/môn/lớp. **`thuoc_lich_su`**: sửa chỉ tiêu có hiệu lực từ tuần sau; hạ quá 30 % hoặc hạ lần thứ hai trong kỳ → về `gui`.
- **`noi`** (con_loai/con_id → cha_loai/cha_id, `vai` {gop_so, chi_huong}, `he_so`, `boi`, `noi_tu_dong`). Unique partial `(con_loai, con_id) where vai='gop_so'` — **"một con một dây" chỉ áp cho `gop_so`; `chi_huong` là nhiều-nhiều** (C99). Trigger `noi_hop_le`: `gop_so` chỉ khi cha `nguon_so ∈ {thuoc, con}`, `cha.lay_tu` khớp loại con, cùng `don_vi_id` hoặc có `he_so`, con đã `duyet`; máy chỉ tự nối `chi_huong`; nối vào mục tiêu LỚP/TRƯỜNG chỉ GVCN/BGH (RLS của bảng `noi` theo chủ thể của **cha**).
- **`luot`** (thuoc_id, `student_id` null, `ngay`, `stt`, `gia_tri ≥ 0`, `nguoi_ghi`, `nguon`) — khoá duy nhất dùng cột `chu_the_key` không null (tránh NULL khác nhau như `uq_lead_progress_daily` hôm nay); không trần giá trị ở CSDL, chỉ cảnh báo mềm.
- **`cam_ket`** (giữ tên): `chu_the`; `tuan_bat_dau`; `so_tuan` 1–4; `noi_dung`; `so_hua/don_vi_id/so_dat`; `thuoc_id` null; `muc_tieu_id` null; `lac_muc_tieu`; `ket_qua` {thang, thua} null + `cham_boi` + `goi_y`; `xong_at`; `pdr_meeting_id`; `nguoi_nhap_ho`; `trang_thai` {hieu_luc, huy} — **không duyệt**. **`cam_ket_xac_nhan`** (ai, vai {buddy, thay_co, phu_huynh}, ý kiến). **`pdr_ke_lai`** (pdr_id, cam_ket_id, ket_qua, so_dat) — câu 2 có cấu trúc.
- **`tuan_hoc`** (campus_id, week_start, loai {hoc, nghi, thi}); **`nhom`** + `nhom_thanh_vien`; `buddy_pairs` chiếu thành nhóm `buddy`.
- **Hub**: giữ `hub_event_outbox`; trigger trên `luot` với payload thêm `nguoi_ghi`, `area` lấy từ mục tiêu qua dây `chi_huong` đầu tiên (null nếu không có — **đổi hợp đồng, ký với phía Hub trước**); lọc `chieu_dich=nhieu_nhat` và `gop=moi_nhat` khỏi sự kiện "tick"; **tắt trigger trong transaction di trú**.

### 5.3 Phép tính — một hàm đọc số có chiều kỳ

`private.gia_thuoc(thuoc, tu, den, chu_the)` và `private.so_hien_tai(muc_tieu, ky)`; mọi view/nhắc/gợi ý gọi hai hàm này. Trần "một em không gánh cả lớp" kẹp **theo kỳ** (không kẹp cả năm).

| Kiểu đích × chiều | Số hiện tại | "Đạt" khi | Nhịp / màu |
|---|---|---|---|
| `toi` tăng | Σ / số mới nhất | ≥ Y | nội suy X→mốc→Y theo tuần học |
| `toi` giảm (`do_lai`) | số mới nhất | ≤ Y | đảo chiều |
| `tran_tich_luy` (đích 0, "không quá N cả năm") | Σ vi phạm | **chỉ xét khi hết kỳ** và Σ ≤ Y; giữa kỳ hiện "đang giữ được / đã vượt" | Σ so với mốc trần |
| `giu` (≥ 8 suốt năm) | x/y kỳ giữ được | **chỉ xét khi hết kỳ**, mọi kỳ có số đo đều đạt; kỳ không có số đo = chưa biết | theo kỳ hiện tại |
| `toc_do_ky` ("20 → 5 lần/tháng") | số của kỳ hiện tại | kỳ cuối ≤/≥ Y | theo kỳ |
| `ti_le_dat` (cuộn) | % con đạt `nguong_con` trong bộ lọc (lĩnh vực, môn, đơn vị) — **mẫu số là sĩ số ghi danh**, không phải số con có dây | ≥ ty_le_can | — |
| `chu` | — | người đóng "đã đạt" | không vào thi đua % |
| Thước `tong`/`it_nhat` | Σ trong kỳ | ≥ chỉ tiêu | chỉ tiêu × ngày áp dụng đã qua / tổng |
| Thước `tong`/`nhieu_nhat` (kiêng) | Σ vi phạm | ≤ chỉ tiêu **và** có ghi nhận đủ ngày cửa sổ đã qua (không ghi ≠ 0) | đảo chiều |
| Thước `moi_nhat`, `dem_dat_nguong` | số cuối / n lần đạt | theo chiều / n ≥ chỉ tiêu | không tô nhịp ngày (`nhip=khi_co`) |

Gợi ý Thắng/Thua: có việc → theo thước; có `so_hua` → hiện `so_dat/so_hua` **cạnh** gợi ý, không chấm cam kết bằng số kết quả; không gì → im lặng. Thi đua lớp: ba số tách (mục tiêu % tới đích chỉ với kiểu có quãng · thước tuần đạt · cam kết giữ), không trộn kiểu `chu/giu/tran`.

### 5.4 Quyền và khoá

- Dòng thô `luot`/`so_do` của một em: chính em, phụ huynh, thầy cô lớp — đúng ranh giới `0048:221-222` hôm nay. Mọi số gộp mà em/phụ huynh nhìn thấy ("23/30 bạn đủ", "% lớp đạt", trung bình lớp) đi qua hàm **security definer trả số đếm** (như `class_lead_board`), không mở dòng của bạn cùng lớp. Bảng `thuoc`, `muc_tieu`, `cam_ket`, `noi` có RLS tường minh mô phỏng `rls_select_wigs` (`0048:370-371`); mọi view `security_invoker=true`; `test-view-invoker-revoke.sql` kiểm hai lỗ 18/08 ở mỗi migration.
- Trigger duyệt viết theo **whitelist "cột không phải nội dung"** (trạng thái, người duyệt, achieved, verdict…) — cột thêm sau rơi vào nhóm phải duyệt lại.
- **Khoá theo chữ ký**: câu 2 kể lại cam kết tuần W qua `pdr_ke_lai`; ký thì khoá mọi `luot` có `ngay` thuộc tuần của các cam kết đã kể lại và ≤ ngày ký; cửa sổ trượt 7 ngày cho ghi bù trước khi ký; thầy cô ghi hộ mang `nguoi_ghi` và **không vượt** chữ ký (tuần đã ký chỉ mở qua `edit_requests` có dấu vết).
- **Nhập hộ khối 1–3**: cờ admin bật theo lớp (không dựa `classes.grade` là text — 23/28 lớp để trống, còn lại "Khối 6", "Khối 10"…); thầy cô nhập nội dung ba tầng và sáu câu, **chữ ký là của em hoặc buddy**; biên bản không có chữ ký em không khoá tick và không tính KPI PDR; chỉ số "% em tự đặt" loại dòng nhập hộ.
- **Nguồn hệ thống**: trigger AFTER security definer + `exception when others then raise warning` (mẫu `0157:93-98`), lọc theo chủ thể của thước chứ không theo jsonb người gõ; đợt đầu chỉ `attendance_records` (7 dòng, trực nhật ghi dưới RLS `att_leader_insert` `0004:130-131` — nếu không bọc là rớt điểm danh cả trường). Bảng điểm: **`subject_scores`** (`0064_grades.sql:362`), điểm chỉ lấy khi `student_term_reviews.published_at` (`0064:140`) không null, nối qua `subject_scores.review_id` (`0064:364`) — cùng luật `review_visible_to_family` (`0064:443-451`); `subject` là text (`0064:371`) nên phải ánh xạ sang `subjects` trước; hôm nay 0 dòng → để đợt cuối (C110 ◐).
- **Chuyển lớp (C97)**: nối vào `apply_class_transfer` (`0089_doi_lop_co_duyet.sql:84`, bản mới `0151:226`) — hàm đã là cửa duy nhất và đã cập nhật `buddy_pairs`/`pdr_schedules`; thêm: `muc_tieu.class_id`, `thuoc.class_id`, cam kết tuần đang mở → lớp mới; GVCN mới thấy và duyệt tiếp qua `class_id`; dây lên mục tiêu lớp cũ giữ với nhãn "góp vào lớp cũ" tới khi em/cô nối lại; không đặt trigger song song trên `enrollments` (bài học 0155).

### 5.5 Màn hình

- **Bảng của em**: băng rôn 5 giây "ĐANG THẮNG / SÁT NÚT / CẦN CỐ LÊN" + "việc đủ 2/3 · cam kết giữ 1/1"; ≤ 4 thẻ mục tiêu ("Từ 6,5 lên 8,0 điểm Toán · trước 31/12 · Đang ở 7,2 (em ghi 25/10) · Hôm nay lẽ ra 7,0"); khối "Việc em làm" mỗi thước một hàng, 12 ô tuần, ô ghi theo `cach_ghi`, ghi bù trong 7 ngày; "Cam kết tuần này" ≤ 2 với "Cam kết có con số?"; form mục tiêu 3 bước với nút đầu tiên **"Chọn từ mẫu của lớp"** (thầy cô tạo 3–5 mẫu, em chỉ điền số); khuôn câu 4 nút + câu ráp lại; "Chọn việc đang làm" theo id (không nhận diện theo tên); họp với bạn: câu 2 kể lại từng cam kết, câu 6 hứa mới (1–4 tuần); tuần nghỉ: băng rôn "Tuần này nghỉ — không tính thắng thua", ô ghi vẫn mở.
- **Màn cô**: bảng lớp 4 thẻ với ô "Ghi số hôm nay" cho mọi mục tiêu ghi tay (không nhìn đơn vị); "Việc của lớp" (`tung_em` "23/30 bạn đủ" / `ca_doi` ô số), nút tạm dừng/kết thúc từ tuần sau, đồ thị 12 tuần; cam kết lớp chấm ngay trên bảng; "Chờ duyệt" chỉ mục tiêu + thước (không duyệt cam kết); nhóm & lịch tuần học; "Ghi giúp em" cho lớp bật cờ.
- **BGH**: mục tiêu cơ sở tự đo ("Chuyên cần 92 → 97 %") cạnh mục tiêu cuộn; lớp nào đi chậm; lịch tuần học; công tắc nhập hộ.
- Chữ: "Mục tiêu / Việc em làm / Cam kết / Thắng – Thua / Từ đầu tới giờ / thầy cô"; không "lead", "WIG", "PDR", "buddy", "trần" trên bản VI; không ví dụ cơ thể (cân nặng) trên màn trẻ và mặc định riêng tư cho đơn vị cơ thể.

### 5.6 Quyết định cũ bị lật trong PA2

| # | Quyết định | Ngày · ai | Vì sao lật / giới hạn |
|---|---|---|---|
| 1 | Cam kết không mang số (0121) | 14/08 (gốc 11/08) · chủ dự án | Canon: commitment "what you'll do, when, and what the outcome should be"; lời chủ dự án 01/09 |
| 2 | Việc treo dưới cam kết, chết theo tuần (`0121:98-100`) | 14/08 · chủ dự án | Đảo chiều so với canon; mất xu hướng 12 tuần; lead measure thành to-do list |
| 3 | Việc khoá khi thêm; sửa → về `sent` (0129, 0141) | 15–16/08 · chủ dự án | Thước sống nhiều tuần giải bằng `thuoc_lich_su` có hiệu lực tuần sau + khoá mềm |
| 4 | Cam kết của em phải duyệt (`06e9c13`, 0141) | 16/08 · chủ dự án | Canon "commitments must come from the participants"; duyệt từng tuần tốn giờ cô (> 20 phút/tuần là hỏng, `docs/MO_HINH_WIG.md` §10); xoá khoảng trống C107 |
| 5 | Trần 2 việc/tuần (0137) | 16/08 · chủ dự án | Trần theo tuần chỉ có nghĩa khi việc chết theo tuần; thay bằng ≤ 4 hàng thước một em phải ghi |
| 6 | Đúng 4 WIG, 1/domain (PRD v3 §4.2; 0145) | 17/08 · Nguyễn Mạnh Dương duyệt; 18/08 · chủ dự án | Chặn C43/C96/C112; canon Rule 1; thay: ≤ 4 mục tiêu năm, lĩnh vực là nhãn (+ khac), ≤ 2 "đang tập trung"; KPI "100 % em có 4 WIG" → "≥ 1 mục tiêu đang tập trung" |
| 7 | Hai kiểu đích tick/manual, cấm vẽ vạch manual (`docs/MO_HINH_WIG.md` §5.0) | 11/08 · chủ dự án | Hai kiểu không chứa giảm/giữ/ngưỡng/tỉ lệ/trung bình/chữ; vạch chỉ từ số có nguồn |
| 8 | Kiểu đơn vị suy từ chuỗi (0110/0113) | 13–14/08 · chủ dự án | Đã sai thật trên dữ liệu; canon bắt khai |
| 9 | Việc lớp: cô tick, em không thấy (`4ebc9a7`) | 16/08 · chủ dự án | `pham_vi` khai: `tung_em` (em thấy, em ghi) hoặc `ca_doi` (cô ghi) — cách cũ vẫn là một lựa chọn |
| 10 | Không xây "nửa sau" (`docs/MO_HINH_WIG.md` §9) | 11/08 · chủ dự án | Chốt khi bảng 0 dòng; nay điểm danh có 7 dòng và đã gửi Hub; nguồn hệ thống là tuỳ chọn, ghi tay vẫn mặc định |
| 11 | Hai cây tách rời, `source_wig_id` không tính (`docs/MO_HINH_WIG.md` §1) | 11/08 · chủ dự án | Dây có vai: `chi_huong` là mặc định (đúng Leader in Me), `gop_so` chỉ khi cô/BGH nối và tương thích |
| 12 | Cô không đặt hộ mục tiêu/cam kết/tick của em (0133, `f8815b2`) | 15–16/08 · chủ dự án | Giữ cho khối 4–12; khối 1–3 nhập **nội dung** có dấu vết, không ký thay; chốt cũ ra đời khi CSDL chỉ có lớp 10–12 |
| 13 | CHECK `value > 0`, `target > 0` (`0020:23,53`) | 24/07/2026 · commit `dcdf6e1`, đội kỹ thuật | "Có làm được 0" và đích 0 là số thật |
| 14 | `chan_luong_vo_ly` một ngày ≤ tuần (`0110:38-53`) | 13/08 · chủ dự án | Cảnh báo mềm thay chặn |
| 15 | Chặn X ≥ Y (`lib/wig-tao.ts:173`; `student/actions.ts:813`) | 11–13/08 · chủ dự án | `chieu` khai tường minh |
| 16 | Cam kết chỉ gắn WIG **đã duyệt** (0121, 0148; PRD v3 §4.2) | 0121 14/08 & 0148 18/08 · **chủ dự án**; PRD v3 17/08 · **Nguyễn Mạnh Dương duyệt** | Tuần đầu năm cô chưa duyệt 4×30 WIG thì em không hứa, không tick, biên bản PDR không lưu; nay gắn được với nhãn "chờ duyệt", KPI vẫn đếm mục tiêu đã duyệt |
| 17 | Cam kết bắt buộc neo **một** WIG (`wig_id NOT NULL`, 0121) | 14/08 · chủ dự án | PRD v3 §6.2.7 cho lưu kèm cảnh báo; `lac_muc_tieu` không tính vào mục tiêu nào |
| 18 | Máy gợi thua khi không việc (`0121:322`) | 14/08 · chủ dự án | Không có gì để đo thì không gợi |
| 19 | Học sinh không thấy mục tiêu cuộn (`0116:28-29`, "nhìn 86 % làm em rối") | 14/08 · chủ dự án | Bức tường WIG (`docs/MO_HINH_WIG.md` §6.5); em thấy "Cả lớp: 12/30 bạn đã đạt" qua số đếm, không thấy dòng của bạn |
| 20 | Tick chỉ trong tuần hiện tại; ký khoá cả tuần (0154) | 19/08 · chủ dự án | Khoá 00:00 thứ Hai đóng trước bước Account; thay bằng cửa sổ 7 ngày + khoá theo tuần được nghiệm thu, giữ tinh thần "ký là chốt" |
| 21 | Thắng/thua chỉ em tự chấm (0154) | 19/08 · chủ dự án | Có giới hạn: cô chấm cam kết **LỚP**; cam kết em vẫn em chấm |
| 22 | WIG trường bắt buộc cuộn (`0116:92-95`) | 14/08 · chủ dự án | Trường cần "chuyên cần 92 → 97 %", "0 vụ" — mọi kiểu thước, có RLS đọc số đo trường cho BGH |
| 23 | Case kép phải tách thành nhiều mục tiêu (`0116:30-32`) | 14/08 · chủ dự án | Mâu thuẫn với 1/domain; `thanh_phan` trong một mục tiêu |
| 24 | Không tầng tháng (câu hỏi mở #1) | 18/08 · chủ dự án | **Chạm có giới hạn, không lật**: `ky` của thước (tuan/hai_tuan/thang) và `so_tuan` 1–4 của cam kết là chu kỳ đếm của một thước / độ dài một lời hứa với coach — **không** có mục tiêu tháng, không mốc/vòng duyệt tháng. Ghi ở đây để chủ dự án gật |
| 25 | Không có lịch tuần nghỉ; bỏ "hạ tháng Tết" (`fb8dab7`, 0121) | 14/08 · chủ dự án | `tuan_hoc` cấp cơ sở do BGH khai; miễn, không chặn ghi |

### 5.7 Đường chuyển 700 người và dữ liệu thật

1. 0160–0166: bảng mới rỗng, màn mới ẩn sau cờ `lop.mo_hinh_moi`; mọi migration một transaction, có tệp kiểm sau chạy; `test-view-invoker-revoke.sql` + test chiều ngược cho từng policy mới.
2. **25 lớp trống bật cờ ngay** (không có gì để chuyển). 12A1 bật **sau** khi chủ dự án cho xoá 2 WIG rác.
3. Lớp Test: chạy 0167 (idempotent, giữ `id_cu`, sao lưu JSON 6 bảng trước, **tắt trigger Hub outbox trong transaction** để 65 lượt cũ không bắn lại với `external_id` mới — `lib/hub/webhook.ts:34-38` băm theo id dòng nguồn). **Không đoán**: mọi WIG manual, mọi việc `nhap_luong`, hai lượt "2 rồi 12", `source_wig_id` (chép thành `chi_huong` với cờ `noi_tu_dong`) ra bảng `can_xac_nhan` cho người khai; `lead_measures` cùng (chủ thể, tên, đơn vị) qua các tuần gộp thành một thước với `thuoc_lich_su` theo tuần; cam kết 2 việc nối cả hai bằng `chi_huong`; `so_hua` null, hiện "chưa điền" khác "không số". Agent1–4 thao tác một tuần thật; ảnh 360 px.
4. Marketing (13 người thật): sau khi cô trả lời điểm mờ, cutover đầu tuần sau khi PDR đã ký, có thông báo, "Sổ cũ (chỉ xem)". Trong lúc chờ, Marketing sống trên PA1.
5. Sau 2 tuần ổn: 0168 khoá ghi bảng cũ; drop không sớm hơn cuối năm học và chỉ khi chủ dự án cho phép.
6. Đường lùi nói thật: trước bước 5 tắt cờ được nhưng dữ liệu ghi vào bảng mới trong 1–2 tuần **không tự về** — phải có script ngược tối thiểu `luot → lead_progress` và `so_do → wig_so_do`; sau bước 5 chỉ còn phục hồi từ bản sao JSON.
7. Hub: ký hợp đồng mới (`area` qua dây, `nguoi_ghi`, lọc kiêng/đo) với phía os.truongvietanh.com **trước** khi bật Marketing.

### 5.8 Ước lượng

**120–160 ngày người** (một người 6–8 tháng; hai người song song CSDL/UI ~4 tháng, UI phụ thuộc view nên không chia đôi được). Gồm: CSDL 12 bảng + ~30 policy + hàm/view + 12 test SQL; script di trú + ngược + sao lưu; màn em/cô/BGH; nguồn hệ thống (điểm danh trước); i18n; kiểm thật; đóng cờ theo lớp; viết lại `docs/MO_HINH_WIG.md` (đang tả mô hình đã bỏ ở §3b), `ROLE_MATRIX.md`, `DATA_GOVERNANCE.md` (Hub, số hệ thống); đổi hợp đồng Hub; sinh lại `lib/database.types.ts`; cập nhật `test-mobile`/`chup-trang` cho route mới. Điều kiện: chủ dự án chốt bằng văn bản bảng §5.6 và ba điểm mờ di trú **trước ngày 1**; đóng băng sửa lớn bản cũ một học kỳ.

### 5.9 Được và mất

**Được**: mọi cách diễn đạt trong danh mục có chỗ đứng; lead measure có xu hướng; cô hết duyệt từng tuần; trẻ nhỏ và lớp ngoài khung (Marketing, CLB) có đường; số trên bảng kèm nguồn nên không còn "hỏng im lặng".
**Mất**: 4–8 tháng không sửa lớn bản cũ; 700 người học lại form (khuôn câu giúp nhưng vẫn là form mới); phải đổi hợp đồng Hub; 25 lật quyết định — chỉ cần chủ dự án giữ lại "đúng 4 WIG" hay "cam kết không số" là mô hình quay về lai ghép và C19/C43/C112 rơi lại ✘.

---

## 6. Ý hay từ các hướng thua đã ghép vào

| Ý | Từ | Ghép vào |
|---|---|---|
| Ô số theo `measure_by` ở cả hai màn; em khai "đo bằng gì"; tắt cảnh báo sai với `nhap_luong`; sửa kỳ vọng test thay vì tắt | A | PA1 nấc 0 |
| `lib/wig-luat.ts` một luật hai màn + test thuần đỏ trước vá | A | PA1 nấc 0 |
| Đọc `expected_pct` sẵn có → "lẽ ra hôm nay" rẻ nhất | A | PA1 nấc 0 (tạm tới khi PA2 có mốc) |
| Câu đọc lại trước nút Lưu ở màn cô; cảnh báo mềm tiêu đề ↔ ô X | A | PA1 nấc 0 |
| Nút Thắng/Thua cam kết lớp qua **action mới**, không qua phòng họp | A | PA1 nấc 3, PA2 |
| Chia PR nhỏ, chờ `/api/health` đúng SHA, chụp lớp Test | A | cả hai |
| `cach_gop / huong / nguong` là cột khai; backfill một lần có bảng đối chiếu; câu chốt có phép tính; `gia_viec` một hàm gộp; số đo theo ngày | B | PA1 nấc 1–3 (bỏ `so_moi_nhat/dem_lan_dat` ở tầng việc), PA2 |
| Cảnh báo lệch **bản chất** một câu thay lệch đơn vị | B | PA1 nấc 2 |
| Cách đếm khoá sau lượt ghi đầu; form sửa hiện chữ khoá | B | PA1 nấc 3 |
| Khuôn câu 4 nút, câu ráp lại, "☐ Em chưa biết mình đang ở đâu", cảnh báo mềm thay chặn, ô "0 cũng được", `nguoi_go` tách chủ thể, chip "thầy cô gõ giúp" | D | PA1 nấc 3, PA2 |
| "Dùng tiếp việc tuần trước" — nhưng khoá theo id, hiện lại chuẩn cũ | D (sửa theo E) | PA2 |
| Dây có vai `gop_so/chi_huong`; máy không tự nối `gop_so`; cha chọn `lay_tu` một trong hai nguồn | E | PA1 (`lay_tu`), PA2 (`noi`) |
| Nguồn + ngày dưới mọi con số | E | PA1 nấc 3, PA2 |
| "Cam kết có con số?" là ô tích tuỳ chọn; gợi V/X theo việc, số lời hứa hiện cạnh | E (sửa nhãn) | PA1, PA2 |
| `can_xac_nhan` cho dữ liệu mập mờ — hỏi người, không đoán | E | PA1 backfill, PA2 di trú |
| Tách cửa sổ được bấm khỏi "cả tuần cần" | E | PA1 nấc 3, PA2 |
| Bộ kiểm tổ hợp `cach_gop × huong × phạm vi` chạy trước mỗi `create or replace`; đọc `pg_trigger` chứ không chỉ `pg_proc` | E | PA1 nấc 2, PA2 |
| "Chọn từ mẫu của lớp"; băng rôn 5 giây; không duyệt cam kết từng tuần; `thuoc_lich_su` (+ khoá mềm); `tuan_hoc` cấp cơ sở; `lich_su_dich`; `closed`; `thanh_phan`; bật theo lớp + sổ cũ chỉ đọc + sao lưu JSON; `test-view-invoker-revoke.sql` | C | PA2 (băng rôn và "mẫu của lớp" có thể vào PA1 nấc 3 nếu còn ngày) |
| Nhập hộ: thầy cô nhập nội dung, chữ ký của em/buddy, KPI loại nhập hộ | C + phản biện | PA2 |
| Đảo trigger duyệt thành whitelist "cột không phải nội dung" | rút từ mọi phản biện | PA1 nấc 1, PA2 |
| Bảng điểm là `subject_scores` đã công bố (qua `review_id`), không phải `subject_grades`; trigger nguồn bọc lỗi | rút từ mọi phản biện | PA2, và §7 |

---

## 7. Việc KHÔNG nên làm và vì sao

1. **Không** mở "em treo cam kết dưới WIG lớp" + đơn vị việc tự do khi chưa lọc `approved` và chưa có `lay_tu` (A đợt 2): `wig_actual_so` (`0124:22-49`) cộng mọi việc bất kể đơn vị, không lọc trạng thái cam kết, trần là đích do chính em khai — một em đẩy được điểm thi đua của lớp thật.
2. **Không** đưa kiểu "số mới nhất / đếm lần đạt ngưỡng" xuống tầng việc (B): là lag đội lốt lead, chiếm trần `0137`, bơm số kết quả vào KPI "hoàn thành lead measure"; số đo thuộc tầng mục tiêu theo ngày.
3. **Không** dùng "việc đếm số" làm chỗ chứa con số lời hứa (A): trigger `0110:38-53` chặn `value > target` cho **mọi** vai — tuần thắng 55/50 không ghi được, "nhờ cô ghi giúp" là ngõ cụt; `cam_ket_goi_y` chấm hành vi bằng kết quả.
4. **Không** dựng nguồn bảng điểm trên `subject_grades` (`0069:409-413` là bảng môn × khối): bảng điểm là `subject_scores` (0 dòng, môn text), cổng công bố nằm ở `student_term_reviews.published_at` (`0064:140`) — làm sai là đẩy điểm chưa công bố tới em và phụ huynh. Cắt khỏi MVP của cả hai phương án.
5. **Không** tái dùng `ketThucBuoiHop` để chấm cam kết lớp (`wig/hop/actions.ts:131-172` luôn ghi `chot_at` → khoá tick, số đo, cam kết cả lớp qua `tuan_da_hop`).
6. **Không** làm `lead_measures.commitment_id` nullable (D, E) mà chưa viết lại `lead_class` (`0122:352-360`), ba policy `lead_progress` (`0154:36-75`), `rls_select_lead_measures` (`0048:201-204`), trigger Hub (`0157:70-72` trả về im lặng khi `class_id` null) và đổi FK `on delete cascade` (`0121:98`) — nếu không em không tick được, Hub mất sự kiện, xoá một cam kết cũ kéo mất thước và tick nhiều tuần.
7. **Không** thêm cột ngữ nghĩa mà không đưa vào bốn trigger duyệt/khoá (`0151:62-77`, `0151:98-112`, `0155`, `0141:32`) — em đổi hướng/cách gộp sau duyệt mà trạng thái vẫn `approved`, cô sửa được cột quyết định phép tính của em.
8. **Không** bỏ `class_id` của WIG em (E 0168): gãy ≥ 6 policy/trigger (`rls_select_wigs` `0048:370-371`, `rls_insert_wig_cua_em`, `rls_bgh_*`, 0155) cho lợi ích hôm nay bằng 0 (0 em có hai ghi danh active).
9. **Không** mở dòng thô `luot`/`so_do`/`wig_so_do` cho bạn cùng lớp đọc (C §3.9, E `so_ghi`): trái `0048:221-222` và `docs/DATA_GOVERNANCE.md`; số gộp đi qua hàm định-nghĩa-viên trả số đếm.
10. **Không** đổi "Cam kết" thành "Lời hứa" trên màn; **không** in "lead" trên bản VI; **không** làm phẳng bản EN (19/08).
11. **Không** đoán từ chuỗi đơn vị trong backfill/di trú (C 0167, D 0160): WIG "1020 → 1600 khách hàng" là số dư, gán "cộng dồn" là hai lần ghi thành 2 420/1 600 "đã đạt".
12. **Không** để thầy cô ký biên bản PDR thay em (khoá tick của em bằng chữ ký không phải của em; KPI PDR nuôi bằng biên bản tự viết tự ký).
13. **Không** ép "Từ" bắt buộc ở form **Sửa** WIG lớp đã duyệt: về `sent` theo `0151:98-112`, cả lớp Marketing mất đường đặt cam kết; dùng "☐ chưa biết" + cảnh báo mềm.
14. **Không** tắt `test-moi-lan-tick.mjs` hay bất kỳ oracle độc lập nào — sửa kỳ vọng và ghi lý do (bài học `0132`).
15. **Không** bật lại họp lớp; **không** làm "Tick giúp em" vượt chữ ký PDR (`rls_all_lead_progress` không bị `pdr_da_ky` ràng; Hub không mang `logged_by`).
16. **Không** gộp nhiều bảng vào một migration không transaction (`scripts/run-sql.mjs:96-97` chạy nguyên chuỗi); `alter type … add value` tách tệp riêng (PA1 không cần).
17. **Không** làm PA1 và PA2 song song trên production không staging; **không** khởi công PA2 trước khi PA1 nấc 3 chạy hai tuần trên lớp Test và cho thấy ca nào thật sự còn cần tầng mới.

---

## 8. Khuyến nghị cuối

**Làm gì trước, theo thứ tự**

1. **Tuần này — PA1 nấc 0** (không migration, một PR, revert được): giáo viên Marketing có chỗ ghi 3 000 lead, hết cảnh báo đỏ sai, em được khai "đếm hay đo", hai màn một luật, chữ Thắng/Thua thay V/X. Nấc này chạm `9a5d3d5` và 0110 (14/08, 13/08 — chủ dự án) nhưng đúng lập trường 01/09; vẫn xin một chữ gật để chốt.
2. **PA1 nấc 1 → 2 → 3** theo ba PR kế tiếp, mỗi PR chờ `/api/health` đúng SHA rồi chạy lớp Test một tuần thật; tổng 25–30 ngày người. Ghi rõ trong `docs/MO_HINH_WIG.md` §5.1: "đây là bản vá để app thôi đoán và con số có chỗ đứng, chưa phải mô hình đủ" kèm 18 ca ✘ ở §4.8.
3. **PA2**: chuẩn bị đặc tả (§5) song song, **không viết SQL** cho tới khi PA1 nấc 3 chạy hai tuần trên Test. Nấc 0–3 của PA1 chính là nửa đầu của xây lại (khai thay đoán, số đo theo ngày, dây có vai); phần còn lại của PA2 (thước nhiều tuần, lĩnh vực nhãn, nhóm, tuần nghỉ, nguồn hệ thống, nhập hộ) lúc đó sẽ lộ ra là cần tới đâu. Quyết định 120–160 ngày người nên gật vào lúc đó, không phải hôm nay.

**Bảng hỏi một lần — chủ dự án gật/không gật từng dòng (mục 9 CLAUDE.md)**

| # | Quyết định cần gật | Cho phương án | Không gật thì |
|---|---|---|---|
| 1 | Ô số theo `measure_by`, em khai đo bằng gì (lật `9a5d3d5` 14/08 và 0110 13/08 theo lập trường 01/09) | PA1 nấc 0 | Marketing tiếp tục không có chỗ ghi số |
| 2 | Cam kết được mang số tuỳ chọn (`so_hua/so_dat`) — lật 14/08 | PA1 nấc 1, PA2 | bỏ 6 cột; C19/C23/C42/C50 quay về ✘ |
| 3 | Cô chấm Thắng/Thua cho cam kết **LỚP** bằng nút riêng — chạm 19/08, không mở họp lớp | PA1 nấc 3, PA2 | 6 cam kết lớp thật không ai chấm; `wigs_won` đứng 0 |
| 4 | WIG lớp tick được cộng từ WIG em đã duyệt khi cô chọn (`lay_tu`) — lật có điều kiện "hai cây tách rời" 11/08 | PA1 nấc 2 | C90 giữ S; màn em vẫn hứa "góp vào" mà số không lên |
| 5 | Vạch tiến độ cho số ghi tay có nhãn nguồn + ngày — lật một phần 11/08 | PA1 nấc 3, PA2 | số đo vẫn là ngõ cụt (C02) |
| 6 | GVCN được gỡ/nối dây hướng đi của mục tiêu em (cột `source_wig_id`, `lay_tu`) — nới 0133 | PA1 nấc 1 | C14 giữ ◐ |
| 7 | Việc lớp có lựa chọn "mỗi bạn tự tick phần mình" — lật một nửa 16/08 | PA1 nấc 3 (tuỳ chọn), PA2 | C24 ✘, C23 ◐ trong PA1 |
| 8 | Xoá 2 WIG rác `KIEMTUDONG-XOA-*` trên 12A1 (lớp thật) trước 0160 | cả hai | migration đụng dòng lớp thật dù chỉ thêm cột |
| 9 | Cô Marketing trả lời ba điểm mờ: "3000 lead"/"1600 khách hàng" là tổng đến nay hay số mới thêm; "Viết 3 bài blog" 30 là cả lớp hay mỗi em; hai lượt "2 rồi 12" là số ngày hay luỹ kế | PA1 backfill, PA2 di trú | số hiện kèm "kiểm lại cách ghi" tới khi có trả lời |
| 10 | Đổi hợp đồng Hub: thêm `logged_by`, lọc lần vi phạm khỏi "tick việc dẫn dắt" (PA1); `area` qua dây, bắn từ `luot` (PA2) | PA1 nấc 2, PA2 | Hub đếm lần "quên vở" như một lần làm việc |
| 11 | Toàn bộ bảng lật §5.6 (25 dòng), đặc biệt: thước sống nhiều tuần; không duyệt cam kết từng tuần; 4 domain thành nhãn ≤ 4 mục tiêu; nhập hộ khối 1–3 chỉ nội dung; cửa sổ 7 ngày + khoá theo tuần nghiệm thu; em thấy mục tiêu cuộn; `ky` thước / `so_tuan` cam kết chạm "không tầng tháng" | PA2 | không chốt trước ngày 1 thì không khởi công |

Không gật dòng nào thì rút đúng dòng đó; nấc 0 và khuôn câu vẫn đứng vững.