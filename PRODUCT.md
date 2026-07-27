# Product

## Register

product

## Users

Bốn nhóm dùng cùng một app nhưng ở hai trạng thái tâm lý rất khác nhau:

- **Học sinh (lớp 6–12)** — dùng trên điện thoại, giữa giờ ra chơi hoặc buổi tối. Việc chính: tick lead measure của mình, xem điểm cá nhân, xem thi đua lớp, xem thời khoá biểu. Đây là người dùng đông nhất và ít kiên nhẫn nhất.
- **Giáo viên chủ nhiệm** — dùng trên laptop trong giờ hành chính, thường vội. Việc chính: điểm danh, dựng WIG năm/tháng/tuần và lead measure, chạy buổi họp WIG tuần, quản lý danh sách lớp. Đây là người phải **nhập liệu nhiều nhất**.
- **Ban giám hiệu** — xem ở cấp trường: bảng tổng hợp khối → lớp, quản lý giáo viên và khối/lớp trong cơ sở mình.
- **Phụ huynh** — mở link trên điện thoại, xem báo cáo tuần của con. Ít thao tác, chủ yếu đọc.

## Product Purpose

Đưa khung 4DX (4 Disciplines of Execution) vào vận hành lớp học ở Trường Việt Anh: mỗi lớp có WIG năm → tháng → tuần, mỗi WIG có lead measure đo được, học sinh tự tick, buổi họp WIG tuần chốt cam kết cho tuần sau.

Thành công = giáo viên dựng xong WIG tuần trong dưới một phút và không phải nghĩ; học sinh mở app là biết tuần này mình cần làm gì và đã làm tới đâu.

## Brand Personality

**Hai chất, chia theo màn hình** (quyết định của người dùng, 2026-07-27):

- **Màn học sinh** (điểm cá nhân, thi đua, tick lead measure, đăng nhập) — vui tươi, khích lệ. Giữ font Baloo bo tròn, màu gold nổi, hiệu ứng và minh hoạ. Đây là chỗ app được phép có cá tính.
- **Màn quản lý** (WIG, điểm danh, danh sách, thời khoá biểu, quản trị, cơ sở) — là **công cụ làm việc**. Nhãn rõ, ô điền rộng rãi, ít trang trí, mật độ cao được phép. Ở đây font display và màu gold chỉ dùng cho tiêu đề và hành động chính, không rải khắp.

Ba từ: **rõ ràng · khích lệ · không màu mè**.

## Anti-references

> Suy ra từ codebase và ghi chú dự án, chưa được xác nhận trực tiếp — sửa nếu sai.

- **Không giống bảng tính.** Đây là lý do 4DX được đưa vào app thay vì Excel; nếu màn WIG chỉ là một hàng ô nhập cạnh nhau thì app không hơn gì file cũ.
- **Không giống SaaS mẫu.** Không hero-metric (số to + nhãn nhỏ + gradient), không lưới thẻ giống hệt nhau lặp vô tận.
- **Không đổi bản sắc đã có.** Navy #26275d + gold #f9dd0e, Baloo 2 + Nunito, nền trắng — đã chốt, không được đổi khi làm việc khác (xem ghi chú "frontend freeze" của dự án). Cải thiện là **trong** hệ này, không thay hệ.

## Design Principles

1. **Nhập liệu là việc chính, không phải việc phụ.** Giáo viên dựng WIG và điểm danh mỗi tuần. Ô điền phải đủ rộng cho tiếng Việt có dấu; nút phải thẳng hàng và không rớt dòng. Một form khó dùng ở đây tốn nhiều thời gian hơn mọi thứ khác cộng lại.
2. **Một WIG phải đọc được thành câu.** 4DX phát biểu mục tiêu là "Từ X lên Y trước [thời hạn]". Màn hình nào hiện WIG mà không nói được nó là mục tiêu *gì* thì màn hình đó chưa xong.
3. **Tiếng Việt là ngôn ngữ thứ nhất.** Nhãn tiếng Việt dài hơn tiếng Anh ~20–30% và có dấu. Mọi bề rộng cố định phải được thử với chuỗi tiếng Việt thật, không phải với "Target".
4. **Học sinh dùng điện thoại.** Màn học sinh phải đúng ở 360px trước, desktop sau.
5. **Nói thẳng khi hỏng.** Lỗi hiện ngay cạnh ô sai bằng tiếng Việt thường, giữ nguyên nội dung đã gõ. Không toast biến mất, không "Đã xảy ra lỗi".

## Accessibility & Inclusion

- Mục tiêu **WCAG 2.1 AA**. Token màu đã được chỉnh cho mục này (`--color-grey-mid` #6b7093 ≈ 4.8:1 trên trắng); giữ ngưỡng đó khi thêm màu mới.
- Vùng chạm tối thiểu **44×44px** trên màn học sinh (dùng điện thoại, tay trẻ con).
- Tôn trọng `prefers-reduced-motion` — đám đông ở trang đăng nhập và mọi hiệu ứng đã có nhánh tắt.
- Song ngữ Việt–Anh (`next-intl`); mọi chuỗi mới phải có cả hai.
- Dữ liệu trẻ em: không rò rỉ tên/ảnh học sinh sang vai trò không có quyền — đây là ràng buộc thiết kế, không chỉ ràng buộc backend.
