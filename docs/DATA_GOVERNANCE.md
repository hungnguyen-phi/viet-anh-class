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

## 7. Bên thứ ba: Buddy 4DX là LLM (OpenRouter → DeepSeek)

> ⚠️ **Đây là lần đầu dữ liệu đi RA KHỎI vành đai RLS.** Quyết định 2026-07-26: "Buddy" trong nhịp
> 4DX không phải bạn cùng lớp mà là LLM gọi qua OpenRouter (model mặc định `deepseek/deepseek-chat`).
> §2.1 nói "RLS là cổng duy nhất" — điều đó vẫn đúng với mọi truy cập *đọc/ghi dữ liệu*, nhưng một
> lệnh gọi LLM thì gửi nội dung sang hạ tầng của nhà cung cấp khác. Nhà trường **cần biết và đồng ý**
> trước khi bật trên dữ liệu học sinh THẬT.

**Cách giảm rủi ro đã cài trong code** (`lib/buddy.ts`):
- Hợp đồng kiểu dữ liệu `BuddyFact` **chỉ cho phép**: nhãn lĩnh vực, mục tiêu, số đã đạt, số ngày còn
  lại. **Không** tên, **không** email, **không** UUID, **không** tên lớp/trường, **không** điểm danh,
  **không** cảm xúc. Prompt cấm mô hình nhắc tới dữ liệu ngoài số liệu được cho.
- `OPENROUTER_API_KEY` là **server-only** (không `NEXT_PUBLIC_*`), đặt ở env runtime của Coolify.
  Thiếu key → tính năng tự tắt, phần còn lại của app không ảnh hưởng.
- Ghi chú do **server** sinh và ghi bằng `service_role` (`askBuddyNote`) → học sinh không ghi trực tiếp
  vào `wig_meetings`, không tự bịa nội dung Buddy. Lưu ở `wig_meetings.buddy_note` (migration 0042),
  kèm `buddy_note_model` để truy vết model đã dùng.
- Giới hạn **1 lần/ngày/học sinh** (theo giờ VN) — vừa chặn chi phí vừa giảm lượng dữ liệu gửi ra.

**Còn phải làm trước khi bật cho học sinh thật:** xin đồng ý của nhà trường (và phụ huynh nếu trường
yêu cầu); đọc chính sách lưu log/huấn luyện của OpenRouter + DeepSeek và ghi lại kết luận vào đây;
cân nhắc bật "zero data retention" nếu gói OpenRouter cho phép.
