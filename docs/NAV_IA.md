# Điều hướng — vì sao thêm tính năng mà KHÔNG thêm bấy nhiêu tab

Đợt thử tháng 7/2026 sinh ra 7 tính năng mới. Nếu mỗi tính năng một tab thì thanh menu của giáo
viên nhảy từ 6 lên 10 mục.

Không làm được. Thanh nav là `overflow-x-auto` với thanh cuộn **ẩn** — quá chỗ thì mục bị đẩy ra
ngoài màn hình mà không có dấu hiệu nào cho người dùng biết là còn nữa. Và chuyện này ĐÃ xảy ra
một lần: comment trong `components/shell/AppNav.tsx` ghi *"Trước đây 'Thông báo' là một tab trong
thanh nav, mà GVCN có 8 tab nên chữ bị đè nhau"* — nên "Thông báo" mới bị hạ xuống thành icon
chuông.

Đo thực tế trên production (viewport 1528px, vai giáo viên): 6 tab hiện chiếm ~624px, logo 178px,
cụm phải ~350px → còn trống ~376px. Máy tính trường phổ biến là 1366px, tức là còn trống ~214px.
Mỗi tab chữ tiếng Việt tốn ~95–130px. Vậy ngân sách thật chỉ khoảng **hai tab**.

## Quy tắc

| Loại | Cách vào | Vì sao |
|---|---|---|
| Dùng **hằng ngày** | Tab trong nav | Đáng số chỗ nó chiếm |
| Dùng **thường xuyên**, ít hơn | Icon ở cụm phải | Tốn ~40px thay vì ~110px |
| **Thỉnh thoảng** mới xem | Thẻ / nút trong trang liên quan | Không tốn chỗ nào |

## Chốt cho 7 tính năng

**Tab mới** (dùng hằng ngày):
- `/homework` · **Báo bài** — giáo viên đăng mỗi ngày; học sinh và phụ huynh mở mỗi tối.
- `/grades` · **Học bạ** — điểm số + nhận xét + rèn luyện gom một chỗ (ba thứ này cùng là "đánh
  giá một em trong một đợt", tách ba tab là vô lý).

**Icon ở cụm phải** (cạnh chuông thông báo):
- `/inbox` · **Liên lạc** — tin nhắn phụ huynh ↔ giáo viên. Có chấm đỏ khi chưa đọc, giống chuông.
  Đặt cạnh chuông vì cùng họ "có gì mới cho tôi".

**Không tốn chỗ nào**:
- **Thời khoá biểu cho phụ huynh** — `/timetable` ĐÃ tồn tại và RLS đã cho phụ huynh đọc
  (`is_parent_of_class`). Chỉ thiếu đúng hai thứ: link trong nav của phụ huynh, và nhánh `parent`
  trong `getMyClass()` (trước đây trả `null` nên họ mở ra thấy "Chưa có lớp").
- **Thực đơn** — `/menu` là trang soạn cho quản trị/ban giám hiệu; phụ huynh và học sinh xem qua
  thẻ nhúng sẵn trong trang của họ. Xem thực đơn là việc liếc một cái, không đáng một tab.
- **Hình ảnh** — `/gallery` mở từ nút trong Danh sách lớp (giáo viên) và thẻ trong Báo cáo
  (phụ huynh). Xem ảnh là việc thỉnh thoảng.

## Số tab sau khi làm xong

| Vai | Trước | Sau |
|---|---|---|
| Giáo viên | 6 | 8 (+ Báo bài, Học bạ) |
| Quản trị viên | 7 | 9 |
| Ban giám hiệu | 3 | 4 (+ Học bạ — họ xin "biết thông tin điểm số, rèn luyện") |
| Phụ huynh | 1 | 4 (+ Báo bài, Học bạ, Thời khoá biểu) |
| Học sinh | 2 | 4 (+ Báo bài, Học bạ) |

Quản trị viên 9 tab là mức chật nhất. Chấp nhận được vì họ dùng máy bàn màn hình lớn, và tab đầu
của họ (`/admin`) là nơi họ ở lâu nhất chứ không phải đi tới đi lui giữa các tab.
