# Pilot Success Metrics — Viet Anh Class

*Nguồn chuẩn: PRD §3 (KPI app) + bổ sung chỉ số vận hành/áp dụng cho pilot 1 cơ sở. Dùng làm tiêu chí Go/No-Go mở rộng campus #2.*

## 1. KPI sản phẩm (từ §3)

| # | Chỉ số | Mục tiêu | Đo bằng |
| :- | :-- | :-- | :-- |
| 1 | Tỷ lệ lớp điểm danh mỗi ngày học | **≥ 95%** | `attendance_records` có dòng/lớp/ngày học |
| 2 | Lớp pilot có đủ WIG 4 lĩnh vực ở 3 cấp (năm/tháng/tuần) | **100%** | đếm `wigs` theo area × period/lớp |
| 3 | Tuần có họp WIG (biên bản trong app) | **≥ 90%** | `wig_meetings` theo `week_label` |
| 4 | Độ trễ cập nhật scoreboard sau nhập liệu | **< 3 giây** | đo realtime 2 thiết bị (E2E) |
| 5 | Alignment: % lead measure có WIG cha hợp lệ | cao (chốt khi seed) | `lead_measures` join `wigs.parent_wig_id` |

## 2. Chỉ số áp dụng & vận hành (pilot)

| Chỉ số | Mục tiêu gợi ý | Đo bằng |
| :-- | :-- | :-- |
| GVCN active hằng tuần | ≥ 90% lớp pilot | login + ghi điểm danh/họp trong tuần |
| Học sinh đăng nhập & tick lead | ≥ 70% HS/tuần | `lead_progress.logged_by = student` |
| Phụ huynh xem báo cáo | ≥ 60% PH/tháng | audit log truy cập `/report` |
| Uptime app | ≥ 99% giờ học | Vercel/Supabase monitoring |

## 3. Cổng bảo mật (bắt buộc, §12.3)
- **Bộ test RLS PASS 100%** — đặc biệt **0 rò rỉ chéo học sinh** (phụ huynh A không đọc được bất kỳ dòng nào của HS không phải con A).
- `get_advisors` (security) **không còn cảnh báo** "RLS disabled" / lỗ hổng.
- IT trường ký duyệt review độc lập (xem DATA_GOVERNANCE §6).

## 4. Quyết định Go/No-Go mở rộng
Chỉ bật campus #2 khi: KPI 1–4 đạt trong **≥ 4 tuần liên tục**, cổng bảo mật §3 xanh, và không có sự cố quyền riêng tư nghiêm trọng trong pilot.
