import {redirect} from 'next/navigation';

// ════════════════════════════════════════════════════════════════════════════
// /wig/hop — PHÒNG HỌP LỚP ĐÃ GỠ (19/08/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án: "bây giờ ko còn họp lớp nữa đâu, chỉ còn họp với buddy thôi". Nhịp giải trình
// tuần nay là họp PDR buddy trên màn của từng em (khoá tick theo chữ ký PDR — 0154); thắng/
// thua cam kết do chính em chốt ở câu 2 PDR.
//
// Trang này chỉ ẨN, không xoá: toàn bộ mã phòng họp (PhongHop, hop-data, actions) và dữ liệu
// biên bản wig_meetings vẫn nguyên — đổi ý thì khôi phục từ git (bản đầy đủ cuối: de4b675).
// URL cũ ai còn giữ thì đưa về trang WIG thay vì 404.
export default async function HopPage() {
  redirect('/wig');
}
