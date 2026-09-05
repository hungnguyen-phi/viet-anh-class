// TOUR TẬP TẠO MỤC TIÊU MẪU (05/09/2026) — chủ dự án: "vào là hướng dẫn tạo một mục tiêu mẫu, cho
// đến cam kết tuần, cho đến thước đo luôn; sau đó chỉ họ xoá, còn xoá hay không thì tuỳ".
//
// Cách chạy: mỗi bước `tuBam` — nút Tiếp của thẻ tour BẤM HỘ (mở hộp / Tiếp trong hộp / Lưu); hộp mở
// từ tour được ĐIỀN SẴN mẫu (cờ `datCoMau` đặt ở `truoc`, form đọc bằng `docCoMau`). Người dùng chỉ
// đọc từng ô rồi bấm Tiếp. Thẻ mẫu nhận ra bằng đầu tên "(Tập)" → `data-mau`, nên các bước sau
// chỉ đúng nút TRONG thẻ mẫu ('@[data-mau] …'), không lẫn với mục tiêu thật.
//
// Học sinh: mục tiêu gửi đi phải chờ thầy cô duyệt mới hiện chỗ cam kết/thước đo — các bước ấy sẽ
// ra thẻ "chưa có nút" (vẫn nói đủ nội dung), và tour nói rõ vì sao. Thầy cô: mục tiêu của mình
// được duyệt ngay nên đi trọn một mạch.
import type {BuocTour} from './buoc';
import {datCoMau} from './mau';

const CHO = 15000; // sau một lần Lưu, trang dựng lại trên VPS mất 1–5 s

function tour(vai: 'em' | 'gv'): BuocTour[] {
  const p = vai; // tiền tố data-hd: em-* / gv-*
  const datMucTieu = vai === 'em' ? 'em-dat-muc-tieu' : 'gv-dat-muc-tieu-toi';
  return [
    {key: 'doc1', icon: 'sparkles'},
    // ① Mở hộp đặt mục tiêu (điền sẵn mẫu).
    {key: 'moHop', hd: datMucTieu, hdPhu: '@[data-kiem="nut-them-muc-tieu"]', tuBam: true, nhanTiep: 'moHop', khiThieu: 'thay', truoc: () => datCoMau('mucTieu')},
    {key: 'b1', hd: 'mt-b1', bam: 'mt-tiep', tuBam: true, nhanTiep: 'tiepTrongHop', khiThieu: 'thay', cho: 3000},
    {key: 'b2', hd: 'mt-b2', bam: 'mt-tiep', tuBam: true, nhanTiep: 'tiepTrongHop', khiThieu: 'thay', cho: 3000},
    {key: 'b3', hd: 'mt-b3', bam: 'mt-luu', tuBam: true, nhanTiep: vai === 'em' ? 'gui' : 'luu', khiThieu: 'thay', cho: 3000},
    // ② Thẻ mẫu hiện ra.
    {key: 'the', hd: '@[data-mau]', khiThieu: 'thay', cho: CHO},
    // ③ Cam kết tuần trong thẻ mẫu.
    {key: 'moCamKet', hd: `@[data-mau] [data-hd="${p}-them-cam-ket"]`, tuBam: true, nhanTiep: 'moHop', khiThieu: 'thay', truoc: () => datCoMau('camKet')},
    {key: 'ckForm', hd: 'ck-form', bam: 'ck-luu', tuBam: true, nhanTiep: 'luu', khiThieu: 'thay', cho: 3000},
    {key: 'cham', hd: `@[data-mau] [data-hd="${p}-cham"]`, khiThieu: 'thay', cho: CHO},
    // ④ Thước đo dẫn dắt dưới cam kết mẫu.
    {key: 'moThuoc', hd: `@[data-mau] [data-hd="${p}-them-thuoc"]`, tuBam: true, nhanTiep: 'moHop', khiThieu: 'thay', truoc: () => datCoMau('thuoc')},
    {key: 'ttForm', hd: 'tt-form', bam: 'tt-luu', tuBam: true, nhanTiep: 'luu', khiThieu: 'thay', cho: 3000},
    {key: 'tick', hd: `@[data-mau] [data-hd="${p}-tick"]`, khiThieu: 'thay', cho: CHO},
    // ⑤ Giữ hay xoá — tuỳ người dùng.
    {key: 'xoa', hd: `@[data-mau] [data-hd="${p}-sua"]`, khiThieu: 'thay'},
  ];
}

export const TOUR_TAO_MAU_EM: BuocTour[] = tour('em');
export const TOUR_TAO_MAU_GV: BuocTour[] = tour('gv');
