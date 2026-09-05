// TOUR THEO TRANG: Danh sách · Điểm danh · Thời khoá biểu (05/09/2026).
//
// Mỗi tour = một thẻ đọc-trước (trang này để làm gì) rồi từng bước chỉ tận nút. Ba trang này
// nhiều vai cùng dùng (học sinh tổ trưởng, GVCN, admin/BGH, phụ huynh ở TKB) nên bước nào chỉ vai
// này mới có phần tử thì `khiThieu: 'bo'` — tour tự nhảy qua, không hiện thẻ trống.
// Chuỗi ở messages `huongDan.<tour>.<key>`. Phần tử đích gắn `data-hd` trên trang tương ứng:
//   /roster      ds-de-nghi-den · chon-lop · ds-ghi-danh · ds-to-truong · ds-bang · ds-ten-em · ds-thao-tac
//   /attendance  chon-lop · dd-si-so · dd-tuan · dd-chon-ngay · dd-bang · dd-cot · dd-dem
//   /timetable   chon-lop · tkb-tuan · tkb-chu-thich · tkb-luoi (mobile: tkb-ngay) · tkb-nhap-loat ·
//                tkb-sao-chep · tkb-gio-tiet · tkb-ngoai-le · tkb-clb
import type {BuocTour} from './buoc';

export const TOUR_DANH_SACH: BuocTour[] = [
  {key: 'doc1', icon: 'graduation'},
  {key: 'deNghiDen', hd: 'ds-de-nghi-den', khiThieu: 'bo'},
  {key: 'chonLop', hd: 'chon-lop', khiThieu: 'bo'},
  {key: 'ghiDanh', hd: 'ds-ghi-danh', khiThieu: 'bo'},
  {key: 'toTruong', hd: 'ds-to-truong', khiThieu: 'bo'},
  {key: 'bang', hd: 'ds-bang'},
  {key: 'tenEm', hd: 'ds-ten-em', khiThieu: 'bo'},
  {key: 'thaoTac', hd: 'ds-thao-tac', khiThieu: 'bo'},
];

export const TOUR_DIEM_DANH: BuocTour[] = [
  {key: 'doc1', icon: 'calendar'},
  {key: 'chonLop', hd: 'chon-lop', khiThieu: 'bo'},
  {key: 'siSo', hd: 'dd-si-so'},
  {key: 'tuan', hd: 'dd-tuan', khiThieu: 'bo'},
  {key: 'chonNgay', hd: 'dd-chon-ngay', khiThieu: 'bo'},
  {key: 'cot', hd: 'dd-cot', khiThieu: 'bo'},
  {key: 'bang', hd: 'dd-bang', khiThieu: 'bo'},
  {key: 'dem', hd: 'dd-dem', khiThieu: 'bo'},
];

export const TOUR_THOI_KHOA_BIEU: BuocTour[] = [
  {key: 'doc1', icon: 'calendar'},
  {key: 'chonLop', hd: 'chon-lop', khiThieu: 'bo'},
  {key: 'tuan', hd: 'tkb-tuan'},
  {key: 'chuThich', hd: 'tkb-chu-thich'},
  // Máy rộng: lưới 7 ngày. Máy hẹp: một ngày một cột (TkbHomNay) — lưới chỉ dựng khi bấm "Cả tuần".
  {key: 'luoi', hd: 'tkb-luoi', hdPhu: 'tkb-ngay'},
  {key: 'nhapLoat', hd: 'tkb-nhap-loat', khiThieu: 'bo'},
  {key: 'saoChep', hd: 'tkb-sao-chep', khiThieu: 'bo'},
  {key: 'gioTiet', hd: 'tkb-gio-tiet', khiThieu: 'bo'},
  {key: 'ngoaiLe', hd: 'tkb-ngoai-le', khiThieu: 'bo'},
  {key: 'clb', hd: 'tkb-clb', khiThieu: 'bo'},
];
