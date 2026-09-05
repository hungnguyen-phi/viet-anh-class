// TOUR TẬP TẠO MỤC TIÊU MẪU (05/09/2026) — chủ dự án: "vào là hướng dẫn tạo một mục tiêu mẫu, cho
// đến cam kết tuần, cho đến thước đo luôn; sau đó chỉ họ xoá, còn xoá hay không thì tuỳ" và
// "bắt giáo viên tự thao tác, như hướng dẫn tân thủ game".
//
// Cách chạy: bước `batBuoc` KHÔNG có nút Tiếp — người dùng phải bấm đúng chỗ đang sáng (dấu +,
// nút Tiếp trong hộp, nút Lưu). Hộp mở từ tour được ĐIỀN SẴN mẫu (cờ `datCoMau` đặt ở `truoc`, form
// đọc bằng `docCoMau`) để chỉ cần đọc rồi bấm. Bước Lưu có `choDong`: đợi hộp đóng mới sang bước;
// máy chủ báo lỗi thì thẻ nói rõ. Thẻ mẫu nhận ra bằng đầu tên "(Tập)" → `data-mau`, nên các bước
// sau chỉ đúng nút TRONG thẻ mẫu ('@[data-mau] …'), không lẫn với mục tiêu thật.
//
// Học sinh: mục tiêu gửi đi phải chờ thầy cô duyệt mới hiện chỗ cam kết/thước đo — các bước ấy
// hiện thẻ "chưa có nút" với ghi chú đúng lý do (`chuaCoViChoDuyet`). Thầy cô đi trọn một mạch.
import type {BuocTour} from './buoc';
import {datCoMau} from './mau';

const CHO = 15000; // sau một lần Lưu, trang dựng lại trên VPS mất 1–5 s

function tour(vai: 'em' | 'gv'): BuocTour[] {
  const p = vai; // tiền tố data-hd: em-* / gv-*
  const datMucTieu = vai === 'em' ? 'em-dat-muc-tieu' : 'gv-dat-muc-tieu-toi';
  // Em: các bước sau khi gửi mục tiêu chỉ có nút khi thầy cô đã duyệt — ghi chú thiếu nói đúng lý do.
  const thieu = vai === 'em' ? {ghiChuThieu: 'chuaCoViChoDuyet'} : {};
  const lam = {hanhDong: true, batBuoc: true} as const;
  return [
    {key: 'doc1', icon: 'sparkles'},
    // ① Bấm dấu + → hộp đặt mục tiêu mở ra (điền sẵn mẫu).
    {key: 'moHop', hd: datMucTieu, hdPhu: '@[data-kiem="nut-them-muc-tieu"]', ...lam, khiThieu: 'thay', truoc: () => datCoMau('mucTieu')},
    // Khoanh CẢ form (có thanh nút dính đáy) — bấm đúng nút Tiếp / Lưu trong hộp mới sang bước.
    {key: 'b1', hd: 'mt-form', bam: 'mt-tiep', ...lam, khiThieu: 'thay', cho: 3000},
    {key: 'b2', hd: 'mt-form', bam: 'mt-tiep', ...lam, khiThieu: 'thay', cho: 1500},
    {key: 'b3', hd: 'mt-form', bam: 'mt-luu', ...lam, choDong: true, khiThieu: 'thay', cho: 1500},
    // ② Thẻ mẫu hiện ra (đọc).
    {key: 'the', hd: '@[data-mau]', khiThieu: 'thay', cho: CHO},
    // ③ Cam kết tuần trong thẻ mẫu.
    {key: 'moCamKet', ...thieu, hd: `@[data-mau] [data-hd="${p}-them-cam-ket"]`, ...lam, khiThieu: 'thay', truoc: () => datCoMau('camKet')},
    {key: 'ckForm', ...thieu, hd: 'ck-form', bam: 'ck-luu', ...lam, choDong: true, khiThieu: 'thay', cho: 3000},
    {key: 'cham', ...thieu, hd: `@[data-mau] [data-hd="${p}-cham"]`, khiThieu: 'thay', cho: CHO},
    // ④ Thước đo dẫn dắt dưới cam kết mẫu.
    {key: 'moThuoc', ...thieu, hd: `@[data-mau] [data-hd="${p}-them-thuoc"]`, ...lam, khiThieu: 'thay', truoc: () => datCoMau('thuoc')},
    {key: 'ttForm', ...thieu, hd: 'tt-form', bam: 'tt-luu', ...lam, choDong: true, khiThieu: 'thay', cho: 3000},
    // Tick thử ô hôm nay — bấm vào hàng ô ngày là xong bước.
    {key: 'tick', ...thieu, hd: `@[data-mau] [data-hd="${p}-tick"]`, ...lam, khiThieu: 'thay', cho: CHO},
    // ⑤ Giữ hay xoá — tuỳ người dùng (đọc).
    {key: 'xoa', ...thieu, hd: `@[data-mau] [data-hd="${p}-sua"]`, khiThieu: 'thay'},
  ];
}

export const TOUR_TAO_MAU_EM: BuocTour[] = tour('em');
export const TOUR_TAO_MAU_GV: BuocTour[] = tour('gv');
