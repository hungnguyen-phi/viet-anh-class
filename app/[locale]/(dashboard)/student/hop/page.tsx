import {redirect} from 'next/navigation';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /student/hop — PHÒNG HỌP LỚP (PHẦN CỦA EM) ĐÃ GỠ (19/08/2026)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án: "bây giờ ko còn họp lớp nữa đâu, chỉ còn họp với buddy thôi". Việc mỗi tuần của
// em nay là biên bản PDR 6 câu ngay trên màn chính (/student) — ký Ghi nhận là tick tuần khoá
// (0154). Chiêm nghiệm/cam kết em từng viết ở đây vẫn hiện trong khu lịch sử họp của màn chính.
//
// Chỉ ẨN, không xoá: mã cũ khôi phục từ git (bản đầy đủ cuối: de4b675), dữ liệu giữ nguyên.
export default async function PhongHopCuaEmPage() {
  redirect('/student');
}
