# Mô hình WIG — bản chốt

*Chốt ngày 11/08/2026 với chủ dự án. Mọi con số đọc từ cơ sở dữ liệu thật, không phải ví dụ bịa.*

Tài liệu này là **hợp đồng thi công**: mọi migration và màn hình phải khớp với nó. Nếu một dòng mã
mâu thuẫn với tài liệu, một trong hai cái sai — dừng lại và sửa cho khớp, đừng để tồn tại song
song. Dự án này đã hỏng hai lần theo đúng kiểu ấy (migration lệch với hàm đang chạy trong CSDL).

---

## 0. Bản này thay cho cái gì

PRD v3 §0.1 đặc tả *"WIG cá nhân 1-chạm — GVCN đặt WIG năm cho từng em"*: mục tiêu của em là mục
tiêu lớp **chia cho sĩ số**. App đã xây đúng vậy. Kết quả đo ngày 11/08/2026: **0 WIG cá nhân,
0 biên bản họp** trên toàn hệ thống. Tính năng không hỏng — nó chưa từng có một dòng dữ liệu nào.
Bốn lớp đang hoạt động; lớp duy nhất có WIG tên là "Test".

Chủ dự án chốt bỏ cách chia số, chuyển sang **Individual WIG Plan** — bản 4DX cho trường phổ thông
của chính FranklinCovey (chương trình Leader in Me). Ba câu gốc quyết định toàn bộ thiết kế:

> *"Learn all multiplication facts from the 3's through the 6's by December 15"* — mẫu một WIG của học sinh
> *"Once a student sets a goal **with his or her teacher**"* — em đặt cùng cô
> *"Study my multiplication facts at home for 20 minutes, 5 days a week"* — **việc do chính em chọn**

Khung của nó: *"the gap between where I am now and where I need to be."*

Chi phí di trú của đợt đổi này **bằng 0** vì chưa có dữ liệu cá nhân nào. Sáu tuần nữa thì không.

---

## 1. Ý chính: hai cây TÁCH RỜI

Mục tiêu của em **không cắt ra từ** mục tiêu lớp. Nó là khoảng cách của chính em, nối với mục tiêu
lớp bằng **hướng đi**, không bằng số học.

```
CÂY CỦA LỚP  (cô đặt)
  WIG lớp · Điểm TB Toán 6,5 → 8,0 · 30/06
    └─ mốc tháng/tuần (app sinh, cô chỉnh)
         └─ việc của lớp · "mỗi bạn 3 bài/tuần"

CÂY CỦA EM   (em đặt cùng cô)          ← không cộng, không chia, không tràn
  Minh    · Điểm Toán 5,8 → 7,0 · 31/12   → việc: làm lại bài sai, 3 lần/tuần
  Claudia · Điểm Toán 7,5 → 8,5 · 31/12   → việc: giảng lại cho bạn, 1 buổi/tuần
  Alex    · Nộp bài đúng hạn 60% → 100%   → việc: soạn cặp tối hôm trước
```

Minh yếu tính toán thì đánh tính toán. Claudia đã khá thì đánh chỗ khác. **Không ai lãnh "400 bài"**
— vì con số ấy không mô tả khoảng cách của ai cả.

**Hệ quả kỹ thuật, và đây là lý do bản này ĐƠN GIẢN HƠN bản chia số:** hai cây rời nhau nên lỗi số
học biến mất khỏi kiến trúc. Không còn phép chia sĩ số, không còn tiến độ cá nhân tràn lên điểm thi
đua, không cần luật chống tràn `c.scope = d.scope` của migration 0099, không cần `source_wig_id`
tham gia phép tính.

`source_wig_id` vẫn giữ nhưng **đổi vai**: chỉ để hiện *"con đang góp vào trận đánh nào của lớp"*.
Nó không tham gia bất kỳ phép tính nào.

---

## 2. Thực thể

Bảng `lead_measures` hôm nay đã trỏ `wig_id → wigs.id`, nên **việc treo dưới mục tiêu của em chạy
được ngay, không cần bảng mới**. Chỉ thêm ba thứ:

| Thực thể | Là gì | Bảng |
|---|---|---|
| **WIG lớp** | "Từ X đến Y trước ngày nào" — năm. | `wigs` scope=`class` period=`year` |
| **Mốc nhịp** | Tháng + tuần của chính WIG ấy. **App sinh, cô chỉnh.** | `wigs` scope=`class` period=`month`/`week` |
| **Việc của lớp** | Hành vi chung, cả lớp cùng làm. "Mỗi bạn 3 bài." | `lead_measures` treo dưới WIG tuần |
| **Mục tiêu của em** | Khoảng cách của chính em. Tự do về nội dung và đơn vị. | `wigs` scope=`student` |
| **Việc của em** | Cách em tự chọn để tới đó. | `lead_measures` treo dưới mục tiêu của em |
| **Lượt tick** | Một lần làm xong. | `lead_progress` |
| **Sổ của con** | Chiêm nghiệm hằng tuần của em. | `student_reflections` *(mới)* |

Cột thêm vào `wigs`:

| Cột | Giá trị | Để làm gì |
|---|---|---|
| `kind` | `academic` \| `personal` | mục tiêu của riêng em **không vào điểm thi đua** |
| `status` | `draft` → `sent` → `approved` | em gửi, cô duyệt |
| `set_by` | `student` \| `teacher` | đo tỷ lệ em tự đặt (§4) |
| `measure_by` | `tick` \| `manual` | đích đếm được hay đích ghi nhận ngoài (§5) |
| `achieved_at` / `achieved_by` | ngày + người | với đích ghi nhận ngoài: ai tick "đã đạt", lúc nào |

---

## 3. Trần số lượng — chặn ở CSDL, không phải nhắc trong giao diện

| | Trần | Nguồn |
|---|---|---|
| WIG của **lớp** | **4** — mỗi lĩnh vực một cái | chính sách trường (canon là 2 — xem §7) |
| Mục tiêu của **em** đang chạy | **2** — một học thuật + một của riêng em | Leader in Me |
| Việc của mỗi mục tiêu cá nhân | **1** | ⇒ em không bao giờ tick quá **2 việc của mình** mỗi tuần |

Trần là lý do sống còn của 4DX, không phải lời khuyên mềm: nghiên cứu của FranklinCovey trên
~300.000 người — đội theo 2–3 mục tiêu đạt xuất sắc 2–3; theo 4–10 chỉ đạt 1–2; **theo 11–20 đạt 0**.
App cũ bày ra 12 mục tiêu mỗi lớp. Không bao giờ quay lại con số đó.

---

## 4. Ai ghi, ai đọc

| | GVCN | Học sinh | Phụ huynh | BGH |
|---|---|---|---|---|
| WIG lớp + mốc + việc của lớp | tạo, sửa, xoá | xem | xem | xem |
| **Mục tiêu của em** | **tạo, sửa, xoá thay em** · duyệt · góp ý | tạo, gửi duyệt, xin đổi | xem con mình | xem |
| **Việc của em** | như trên | tạo cùng mục tiêu | xem | xem |
| Lượt tick | **tick hộ**, gỡ tick | tự tick | xem | xem |
| Sổ của con | xem | viết | xem | — |

Cô có **toàn quyền** với mục tiêu của em — chủ dự án chốt vậy để triệt rủi ro "em không gõ thì màn
trống".

### 4.0 Bạn đồng hành hằng tuần (0104)

Individual WIG Plan có "accountability partner" — mỗi em một bạn đồng hành cố định trong tuần,
không phải chọn tuỳ hứng mỗi lần họp. Trước 0104, `buddy_id` chỉ sống trong `wig_meetings`: cô gõ
tay mỗi lần lưu biên bản, không có gì nhớ ai đi với ai tuần trước.

Bảng `buddy_pairs` lưu một dòng / (lớp, tuần, học sinh). GVCN bấm nút **Ghép cặp** ở phòng họp
(`/wig/hop`, khối "Bạn đồng hành tuần tới") — thuật toán (`lib/buddy-pair.ts`) xáo ngẫu nhiên, tránh
lặp lại đúng bạn tuần trước khi còn cách khác, và dồn em lẻ thành một vòng ba (A→B→C→A). Không
cron/edge function — bài học cũ "attendance-reminders chưa deploy" vì phụ thuộc hạ tầng ngoài
Next.js. Nhịp thứ Sáu là quy ước vận hành (cô ghép cho tuần tới vào cuối tuần), không phải luật app
ép. Học sinh thấy "Bạn đồng hành tuần này: X" ngay trên màn của mình, không cần mở biên bản họp.

### 4.1 Cửa sổ một ngày — em được nói lại (0102)

Cô đặt hộ thì mục tiêu vào thẳng `approved`, tức là nếu không có gì thêm, em **mở mắt ra đã thấy
một mục tiêu mang tên mình mà không sửa nổi một chữ**. Đó đúng là thứ 4DX gọi là *dictate*, chỉ
khác là lần này nó có vẻ ngoài của một món quà.

| | 24 giờ đầu | Sau đó |
|---|---|---|
| **Em** | sửa · **xoá** (= "con không nhận") | chỉ xin cô đổi |
| **Cô** | sửa · xoá · thêm | sửa · xoá · thêm |

24 giờ đầu mục tiêu vẫn là **đề nghị**; qua đó nó thành **cam kết** — một cam kết sửa được lúc nào
cũng được thì không phải cam kết. Chốt nằm ở RLS (`rls_update_wig_cua_em`, `rls_delete_wig_cua_em`),
không ở giao diện. Phép kiểm: `scripts/test-cua-so-mot-ngay.sql`.

### Van an toàn ấy có thể nuốt cả thiết kế — nên phải làm cho nó LỘ RA

Nếu cô cứ gõ hộ cho nhanh thì mô hình này thành đúng bản PRD cũ, chỉ khác cái tên, và không ai
biết. Cách chặn rẻ nhất là hiển thị, không phải cấm:

- Màn của em ghi rõ **"cô đặt giúp con"** cạnh mục tiêu, kèm nút *"con muốn đổi"*.
- BGH có **một số duy nhất**: *% mục tiêu do chính em đặt* (`set_by = 'student'`).
  Hôm nay 0%. Mốc cho đợt thử: **≥ 70%**.

Đây là chỉ số cảnh báo sớm cho chính chương trình, không phải để chấm điểm giáo viên.

---

## 5. Phép đo

### 5.0 Hai kiểu đích — luật gốc, áp cho cả lớp lẫn em

Chủ dự án chốt 11/08/2026. Mọi WIG khai báo mình thuộc kiểu nào, và **không có kiểu thứ ba**:

| Kiểu | Ví dụ | Đo thế nào |
|---|---|---|
| `measure_by = 'tick'` | "làm 1200 bài tập", "đọc 20 cuốn sách" | **Máy đếm** từ lượt tick của các việc bên dưới. Có vạch tiến độ thật. |
| `measure_by = 'manual'` | "điểm TB Toán 6,5 → 8,0", "nâng điểm Toán lên 7,0" | **Cô và trò tự ghi nhận ngoài app.** Đạt thì tick — ghi `achieved_at`. **Không vẽ vạch tiến độ.** |

Luật cấm quan trọng nhất của cả tài liệu: **không bao giờ vẽ vạch tiến độ cho đích `manual`.**
Thà hiện *"chưa đạt"* còn hơn hiện một con số không ai nhập. Bản nháp trước của tài liệu này từng
vẽ *"5,8 → 6,4 / 7,0"* — con số 6,4 ấy không có nguồn nào cả, và đó đúng là kiểu hỏng im lặng mà
§9 nói tới.

Với đích `manual`, cái **có** vạch là **việc** bên dưới nó: *"làm lại bài sai — 24/36 lần từ đầu kỳ"*.
Việc thì máy đếm được, vì em tick mỗi lần làm.

### Cây của lớp

1. **Đóng góp của một em vào một việc của lớp** = `min(tổng tick × unit_per_tick, mục tiêu việc)`
   Chặn trần theo từng em — một em chăm không gánh cho cả lớp. *(Giữ từ migration 0098.)*
2. **Tiến độ WIG lớp** = **tổng** đóng góp của mọi em. **Không chia sĩ số.**

Điểm 2 là chỗ sửa lỗi đang chạy trên production. Hôm nay hàm `private.wig_actual` chia cho sĩ số,
nên tử số mang đơn vị *"trung bình mỗi em"* còn `target_value` mang đơn vị *"tổng cả lớp"* —
**hai vế của phép chia không cùng thang**. Đo trên lớp Test (3 em, việc "mỗi bạn 3 bài", mốc tuần 25):

| | Hôm nay | Đúng ra |
|---|---|---|
| 2 em đã tick, mỗi em 1 bài | 0,67/25 = **2,7%** | 2/25 = **8%** |
| Cả 3 em làm đủ 3 bài — lớp thắng tuyệt đối | 3/25 = **12%** | 9/25 = **36%** |
| WIG năm | 0,67/1200 = **0,06%** | 2/1200 |

Bảng xếp hạng thi đua tính từ WIG **năm**, nên hôm nay nó là một cột gần bằng 0 suốt năm dù lớp làm
tốt đến đâu.

### Cây của em

**Tiến độ mục tiêu của em** = tick của chính em trên **việc của chính em**. Không mượn, không chia,
không cộng lên đâu cả.

Mục tiêu `kind = 'personal'` **không vào** `class_competition_scores` và không vào bảng của BGH.

### Đơn vị

Mốc tháng/tuần **thừa kế `unit` từ WIG năm**, không có ô cho cô gõ. Hôm nay lớp Test có năm tính
bằng *"bài"*, tháng tính bằng *"buổi"*, và cả ba vẫn cộng chung. Không ai cố tình làm sai — cấu trúc
cho phép sai nên nó sai. App sinh mốc thì lỗi này biến mất **bằng kiến trúc**, không phải bằng vá.

### Cảnh báo lệch nhịp

Khi hai vế cùng thang, phép so này mới làm được:

```
nhịp tuần cần  =  mốc tuần của WIG lớp
việc tuần cho  =  Σ mục tiêu các việc × sĩ số
```

Trên lớp Test ngay lúc này: mốc tuần cần **25 bài**, việc "mỗi bạn 3 bài" × 3 em cho tối đa **9**.
**Hụt 64%.** Cô đã chia đúng theo thời gian (1200 ÷ 48 tuần ≈ 25) — chỗ hụt nằm ở *việc*, và hôm
nay không màn hình nào nói ra. App chỉ nói *"đang ở đâu"*, chưa bao giờ nói *"lẽ ra phải ở đâu"*.
Đó là Kỷ luật 3 của 4DX, và nó phải hiện **ngay lúc cô đang gõ**.

---

## 6. Luồng

### 6.1 Cô đặt WIG lớp — một lần mỗi năm, ~10 phút

```
1  Khai WIG năm      6 ô · một lĩnh vực · lặp tối đa 4 lần
2  App sinh mốc      tháng + tuần, chia đều theo tuần học
3  Cô chỉnh nhịp     hạ tháng Tết, hạ tháng thi · tổng luôn khớp đích
4  Tạo việc của lớp  app cảnh báo lệch nhịp ngay tại chỗ
```

Từ **12 lượt khai** (3 cấp × 4 lĩnh vực) xuống **4**. Không có form nào cho từng em.

### 6.2 Tiết đặt mục tiêu — 2–3 lần mỗi năm

Đây là chỗ khác bản PRD nhiều nhất, và là lý do bản này không đội chi phí cho cô: đặt mục tiêu
**không phải việc hành chính** — nó là **một tiết học**, cả lớp cùng làm, mỗi em gõ trên máy của
mình. Cô dạy một tiết rồi duyệt tại chỗ, không nhập hộ 30 em.

**Màn của em — bốn bước có dẫn dắt:**

```
① Con đang ở đâu?
    Trận đánh của lớp: Điểm TB Toán 6,5 → 8,0
    Điểm Toán của con bây giờ:  [ 5,8 ]

② Con muốn tới đâu, trước khi nào?
    Con sẽ [ nâng điểm Toán ]  từ [ 5,8 ] đến [ 7,0 ]  trước ngày [ 31/12 ]

③ Mỗi tuần con làm gì để tới đó?
    [ Làm lại bài sai sau mỗi buổi kiểm tra ]
    Con làm vào những thứ nào?  [2][4][6]  → vậy là 3 lần mỗi tuần.
    ⓘ Việc phải là thứ CON TỰ LÀM ĐƯỢC, không phải chờ ai.

④ [ Gửi cô xem ]   + [ Con muốn thêm một mục tiêu của riêng con ]
```

Bước ③ là hai tính chất bắt buộc của lead measure trong canon — *dự báo được* và *tự làm được* —
viết lại thành câu một đứa trẻ hiểu.

**Màn của cô — theo dõi trực tiếp trong tiết:**

```
TIẾT ĐẶT MỤC TIÊU · 10A1 · học kỳ I        28 xong · 2 đang gõ · 0 chưa mở
⏳ Chờ duyệt (3)
   Minh   5,8 → 7,0 Toán · 31/12 · việc: làm lại bài sai 3 lần/tuần
                                        [ Duyệt ]  [ Góp ý ]
   Hà     "học giỏi hơn"   ⚠ chưa đo được  [ Góp ý: đặt con số cụ thể ]
✎ Đang gõ: Tuấn, Ngọc                     [ Ngồi gõ cùng em ]
```

App tự bắt mục tiêu không đo được trước khi cô phải đọc từng cái.

### 6.3 Mỗi tuần — cô gần như không phải làm gì

Màn của em: **một** bảng tick, **hai** nhãn.

```
Mục tiêu của con · nâng điểm Toán 5,8 → 7,0 · trước 31/12
   Con đã đạt chưa?   [ ] chưa      ← cô và trò tự ghi nhận ngoài, đạt thì tick
   Việc của con: làm lại bài sai   ████████░░  24/36 lần từ đầu kỳ

Việc tuần này
   ○ của con  — làm lại bài sai         ●●○  2/3
   ○ của lớp  — làm bài tập về nhà      ●●●  3/3 ✔

Tuần này con thấy sao?  [__________________]   ← Sổ của con
```

Mục tiêu là đích `manual` nên **không có vạch tiến độ** — chỉ có ô "đã đạt". Cái có vạch là *việc*,
vì việc thì máy đếm được.

**Bạn đồng hành:** thứ 6, app ghép cặp, hai em xem sổ nhau, một nút *"đã gặp bạn"*. Cột `buddy_id`
đã nằm sẵn trong `wig_meetings` từ migration 0002.

**Cô:** chỉ nhìn một bảng — em nào hai tuần liền không tick. Không nhập gì.

### 6.4 Họp WIG lớp — 25 phút, thứ 2

Ba khối, và **không khối nào tạo WIG mới**. Đây là chỗ đổi so với app hôm nay: bước 3 hiện đang đẻ
ra một WIG tuần mới mỗi tuần, khiến số WIG phình theo thời gian và mỗi cái có thể lệch đơn vị với
cha nó.

```
① Tuần rồi     việc của lớp thắng/thua · em nào đủ, em nào chưa
② Bảng điểm    tiến độ so với mốc — "lẽ ra ở đâu"
③ Tuần tới     chỉnh chỉ tiêu của VIỆC · ghi vật cản + cách cô dọn đường
```

### 6.5 Bức tường WIG

Một màn cho cả lớp xem: WIG lớp ở trên, mục tiêu của từng em ở dưới, mỗi cái một vạch. Bản số của
*WIG wall* dán tường trong chương trình gốc — thứ làm em thấy mình thuộc về một trận đánh chung.

---

## 7. Cố ý lệch canon — ghi rõ để sau này không ai tưởng là quên

| Chỗ lệch | Canon nói | Ta làm | Vì sao |
|---|---|---|---|
| **4 WIG mỗi lớp** | tối đa 2 mỗi đội | 4, mỗi lĩnh vực một | Chính sách trường: lớp nào cũng phủ đủ 4 lĩnh vực. Chủ dự án chốt 11/08/2026. Trần **chặn ở CSDL**. |
| **Cô được đặt hộ mục tiêu của em** | *"em đặt cùng cô"* | cô có toàn quyền tạo/sửa/xoá | Triệt rủi ro màn trống. Bù bằng chỉ số *% em tự đặt* (§4) — lệch thì lộ ra, không lặng lẽ. |
| **Không có cam kết tuần của cá nhân** | Kỷ luật 4: *"team members create their own commitments"* | không có | Chủ dự án cân nhắc rồi bỏ 11/08/2026: *"lời hứa vô thưởng vô phạt"*. Chỉ giữ thứ đo được. |

Ba chỗ này là **quyết định**, không phải thiếu sót. Ai đọc mã sau này thấy chúng thì đừng "sửa lại
cho đúng chuẩn" — đọc bảng này trước.

---

## 8. Đã bỏ — đừng đi tìm

- **Scoreboard 4 hạng mục + `sub_category`** (5 Giá trị / 7 Thói quen / DEAR / Thể chất / Khác) và
  edge function tính điểm. PRD v3 §4 ghi ⬜ *"vẫn trong phạm vi 100%"*. **Chủ dự án bỏ 11/08/2026.**
  Cột `sub_category` trên `lead_measures` để nguyên, không dùng.
- **Chia mục tiêu lớp cho sĩ số** để ra mục tiêu của em — thay bằng §1.
- **Cam kết / lời hứa tuần của học sinh** — xem §7.
- **Ô "em đề nghị việc cho lớp"** — bỏ, thêm sau nếu cần.

---

## 9. Cái app CHƯA đo được — đã có lời giải, ghi lại để không ai đào lại

Đọc ngày 11/08/2026: bảng điểm danh **0 dòng**, bảng điểm môn **0 dòng**. Trường chưa dùng app để
điểm danh hay nhập điểm. Nghĩa là app **không thể tự đo kết quả**, chỉ tự đo được hành vi — trong
4DX, việc là *lead measure*, kết quả là *lag measure*; app mới có nửa đầu.

**Chốt của chủ dự án 11/08/2026:** không cố xây nửa sau. *"Cô và trò tự ghi nhận ở bên ngoài, khi
nào đạt thì tick vào."* Đó chính là `measure_by = 'manual'` ở §5.0.

Điều này **đúng chuẩn hơn là né tránh**: trong Leader in Me, cuốn sổ của em ghi điểm bài kiểm tra
khi có bài kiểm tra, không phải mỗi ngày. App đo cái đo được (việc, hằng ngày) và ghi nhận cái
không đo được (kết quả, khi nó xảy ra).

Việc còn lại của app chỉ là: **đừng nói dối**. Không vạch tiến độ cho đích `manual`, và ghi rõ ngày
ai tick "đã đạt".

---

## 10. Chỉ số nghiệm thu

Không phải "đã xây xong tính năng", mà:

1. **Cô tốn bao nhiêu phút mỗi tuần.** Vượt **20 phút** là hỏng — nó sẽ bị bỏ như mọi thứ thêm việc
   cho giáo viên.
2. **% mục tiêu do chính em đặt.** Hôm nay 0%. Mốc: **≥ 70%**. Đây là chỉ số cảnh báo sớm cho cả
   mô hình (§4).
3. **Bao nhiêu lớp thật có WIG.** Hôm nay 1/4, và lớp đó tên "Test".
4. **Số trên bảng thi đua có nhúc nhích không.** Hôm nay 0,06% và đứng yên.
