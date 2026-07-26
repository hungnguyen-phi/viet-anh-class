# Role Matrix — Viet Anh Class

*Nguồn chuẩn: PRD §2, §7.1, §7.2. Bản hợp nhất 1 trang để team & IT đối chiếu nhanh khi viết RLS và UI.*

## 1. Ma trận vai trò × quyền

| Vai trò | Đăng nhập | Phạm vi **xem** | Phạm vi **sửa** | Trang mặc định sau login |
| :-- | :-- | :-- | :-- | :-- |
| **Admin** | Google `@truongvietanh.com` (cờ admin) | Tất cả cơ sở, tất cả bảng | Tất cả (gồm sửa điểm danh ngày cũ) | `/admin` |
| **BGH / Principal** | Google `@truongvietanh.com` | Mọi lớp/HS/scoreboard trong **campus mình** | Cấu hình campus; **không** sửa điểm danh tay (chỉ xem/duyệt) | `/campus` |
| **GVCN / Teacher** | Google `@truongvietanh.com` | Toàn bộ dữ liệu **lớp mình** | Điểm danh (hôm nay + bổ sung/sửa **7 ngày gần nhất**), WIG lớp, lead measure, biên bản họp | Trang lớp `/` |
| **Học sinh / Student** | Google `@student.truongvietanh.com` | Dữ liệu **lớp mình** + WIG/lead **cá nhân** | Tiến độ lead cá nhân (khoá sau 24h), ghi chú Buddy | `/student/[id]` |
| **Phụ huynh / Parent** | Magic link/OTP (email đã được Admin mời) | **CHỈ báo cáo đã lọc về con mình** | Không sửa gì (read-only) | `/report` |

**Năng lực phụ (không phải role riêng):**
- **Attendance leader** = cờ `enrollments.is_attendance_leader` do GVCN bật cho 1 HS trong lớp → được ghi **điểm danh hôm nay** của lớp đó (không sửa ngày cũ, không chạm lớp khác — khác GVCN, leader KHÔNG có backfill 7 ngày).
- **pending** = trạng thái tạm khi user mới sai miền/chưa gán → bị chặn ở middleware, thấy trang "Tài khoản chưa được cấp quyền".

## 2. Vai trò → predicate RLS (helper §9.3)

| Vai trò | Predicate then chốt | Bảng áp dụng chính |
| :-- | :-- | :-- |
| Admin | `auth_role() = 'admin'` | mọi bảng (for all) |
| BGH | `auth_role()='principal' AND <class>.campus_id = auth_campus()` | attendance, wigs, scoreboard… (select) |
| GVCN | `is_class_teacher(class_id)` (attendance: + `date between vn_today()-6 and vn_today()`) | attendance, wigs, lead, meetings (for all) |
| Học sinh | `is_class_student(class_id)`; tự ghi khi `student_id = auth.uid()` | wigs (**CHỈ read** — 0041 bỏ `wig_student_self_update`), lead_measures (chỉ read), lead_progress (self, **khoá theo ngày: `logged_date = vn_today()`** — 0039) |
| Phụ huynh | `is_my_child(student_id)` | mọi bảng có `student_id` (select-only) |
| Attendance leader | `is_attendance_leader(class_id) AND date = current_date` | attendance_records (write) |

**Ai đặt WIG & lead measure** — **GVCN**, theo PRD §7 + §6.2 màn 5-6 (thiết lập WIG/LM tuần sau trong buổi
họp Coach × Buddy). Đã chốt cả 3 tầng: UI (`StudentWigSetup` render dưới `canManage`), server action
(`createStudentYearWigs` / `createStudentWeekWigs` / `editStudentWig` / `deleteStudentWig` đều
`requireRole(['teacher','admin'])`), và RLS (`wig_manage` + `lm_manage` = `staff_can_manage_class`; 0041 bỏ
`wig_student_self_update` vốn cho học sinh tự hạ `target_value` qua API). Học sinh chỉ **tick tiến độ**.

> **Còn thiếu so với PRD §7:** dòng "Học sinh … **ghi chú Buddy**" chưa có đường thực hiện —
> `wig_meetings` mới chỉ có `wm_student_select` (đọc), mọi thao tác ghi thuộc `wm_teacher_all`/`wm_admin_all`.
> Cần thiết kế riêng: buddy được ghi vào trường nào, và chặn buddy sửa phần của GVCN.

**Yêu cầu-sửa (`edit_requests`)** — GVCN/Admin là người **duyệt** (`er_staff_update`), giữ đúng cơ chế cam kết
4DX: lead measure / WIG tuần chốt trong buổi họp Coach × Buddy, học sinh **không tự đổi target**. Người gửi
(HS/PH) chỉ được **sửa lời nhắn hoặc rút lại yêu cầu của mình khi còn `pending`** (`er_requester_update` /
`er_requester_delete`, 0040) — `WITH CHECK` giữ `status = 'pending'` nên không thể tự duyệt. Rút lại giải
phóng unique index `edit_requests_pending_uidx` (0035) để gửi lại yêu cầu mới.

## 3. Phụ huynh — danh sách trắng/đen trường dữ liệu (§7.2)

- **ĐƯỢC thấy (về con mình):** họ tên con, lớp, tổng quan điểm danh (số vắng/trễ theo tuần/tháng), tiến độ WIG cá nhân 4 lĩnh vực, điểm thi đua cá nhân, nhận xét tổng hợp của GVCN, WIG/LM tuần sau.
- **KHÔNG thấy:** danh sách/dữ liệu HS khác, ghi chú nội bộ lớp, dữ liệu thô điểm danh của HS khác.
