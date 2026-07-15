# Data Governance — Viet Anh Class

*Nguồn chuẩn: PRD §7.2, §12. App chứa dữ liệu THẬT của học sinh và mở cho phụ huynh + nhiều cấp lãnh đạo → đây là nhóm nguyên tắc bắt buộc tuân thủ.*

## 1. Phân loại dữ liệu
- **Nhạy cảm cao (PII học sinh):** điểm danh, đánh giá, tiến độ, biên bản họp, liên kết phụ huynh–học sinh. Mọi truy cập phải qua RLS.
- **Nội bộ:** cấu hình lớp/campus, WIG, lead measure.
- **Công khai trong app:** scoreboard tổng hợp ở cấp lớp (không lộ dữ liệu thô HS khác cho phụ huynh).

## 2. Nguyên tắc kiểm soát truy cập
1. **RLS là cổng duy nhất** — mọi truy cập client dùng `anon key` + RLS; bật RLS cho **mọi** bảng (kiểm bằng `get_advisors` security).
2. **Service-role chỉ ở server** — không bao giờ đặt `service_role key` vào `NEXT_PUBLIC_*`; chỉ Edge Function/server action dùng. Rà ở M3 & M7.
3. **`getUser()` không `getSession()`** ở mọi kiểm tra phía server (revalidate với Auth server).
4. **Tối thiểu hoá cho phụ huynh** — mọi truy vấn của phụ huynh đi qua `is_my_child(student_id)` (xem ROLE_MATRIX §3).
5. **Giới hạn miền email 3 lớp** (Auth Hook + trigger + middleware) — không tin kiểm tra phía client.

## 3. Audit log (§12.4)
Ghi tối thiểu: truy cập **báo cáo nhạy cảm** (parent/BGH report), **đổi vai trò**, **gán/huỷ `parent_links`**, thao tác Admin tạo/xoá lớp & user. Mỗi dòng: ai, làm gì, đối tượng, thời điểm. Bảng `audit_log` tạo ở migration `0008`.

## 4. Sao lưu & khôi phục (§12.6)
Bật **Point-in-Time Recovery** của Supabase + export định kỳ. (PITR có thể cần gói trả phí — quyết ở M8.)

## 5. An toàn khi phát triển/thử nghiệm (§12.1)
Chỉ dùng **dữ liệu GIẢ** (seed). **Tuyệt đối không** nhập thông tin thật của học sinh khi build/demo/UAT. Project test/branch tách khỏi production.

## 6. Cổng review độc lập & sở hữu (§12.5, To-Do #2)
- **Trước go-live:** đội IT/kỹ thuật trường **review RLS & phân quyền độc lập** — cổng bắt buộc, không bỏ qua. Bằng chứng đính kèm = bộ test RLS PASS (xem PILOT_SUCCESS_METRICS §3).
- **Sở hữu:** owner/billing Supabase + Vercel nên là **tài khoản IT trường**, không phải cá nhân.
