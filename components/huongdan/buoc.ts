// ĐỊNH NGHĨA CÁC TOUR HƯỚNG DẪN — chỉ tận nút (04/09/2026, chủ dự án: "ai biết đọc là hiểu").
//
// Mỗi tour = vài THẺ ĐỌC TRƯỚC (tổng quan, không chỉ nút) rồi từng BƯỚC chỉ vào một phần tử có
// `data-hd="<id>"` trên màn. Chuỗi nằm ở messages `huongDan.<tour>.<buoc>.{tieuDe,noiDung}`.
// Bước có `hanhDong: true` = bước mời người dùng thử bấm; bấm vào phần tử đích thì tour tự sang
// bước kế. Bước có `truoc` = việc cần làm trước khi chỉ (vd mở sheet/popup).
// Phần tử không có trên màn (em chưa có mục tiêu) → bước tự chuyển sang thẻ "chưa có gì ở đây".

export type BuocTour = {
  /** Khoá chuỗi trong messages: huongDan.<tour>.<key>.tieuDe / .noiDung */
  key: string;
  /** data-hd của phần tử đích. Không có = thẻ đọc-trước (không spotlight). */
  hd?: string;
  /** Icon lucide cho thẻ đọc-trước. */
  icon?: 'sparkles' | 'calendar' | 'target' | 'shield' | 'graduation';
  /** Bước mời bấm thử: bấm trúng phần tử đích → tự sang bước kế. */
  hanhDong?: boolean;
  /** Khi phần tử đích không có trên màn: 'bo' = bỏ qua bước; 'thay' = hiện thẻ "chưa có gì". */
  khiThieu?: 'bo' | 'thay';
  /** Việc cần làm trước khi chỉ (mở sheet/popup). Trả về true nếu đã làm. */
  truoc?: () => boolean | void;
};

export type TenTour = 'hocSinh' | 'giaoVien' | 'quanTri';

// Phiên bản nội dung — đổi số này khi sửa tour đáng kể để người đã xem được xem lại.
export const PHIEN_BAN_TOUR = 1;

export const TOUR_HOC_SINH: BuocTour[] = [
  {key: 'doc1', icon: 'sparkles'},
  {key: 'doc2', icon: 'calendar'},
  {key: 'doc3', icon: 'target'},
  {key: 'camXuc', hd: 'em-cam-xuc', khiThieu: 'bo'},
  {key: 'tuan', hd: 'tuan'},
  {key: 'mucTieuLop', hd: 'em-muc-tieu-lop', khiThieu: 'bo'},
  {key: 'datMucTieu', hd: 'em-dat-muc-tieu', hanhDong: false, khiThieu: 'thay'},
  {key: 'theMucTieu', hd: 'em-the-muc-tieu', khiThieu: 'thay'},
  {key: 'ghiSo', hd: 'em-ghi-so', khiThieu: 'bo'},
  {key: 'themCamKet', hd: 'em-them-cam-ket', khiThieu: 'thay'},
  {key: 'chamCamKet', hd: 'em-cham', khiThieu: 'thay'},
  {key: 'themThuoc', hd: 'em-them-thuoc', khiThieu: 'thay'},
  {key: 'tickNgay', hd: 'em-tick', khiThieu: 'thay'},
  {key: 'sua', hd: 'em-sua', khiThieu: 'bo'},
  {key: 'hopBan', hd: 'em-hop-ban', khiThieu: 'bo'},
  {key: 'thanhDuoi', hd: 'thanh-duoi', khiThieu: 'bo'},
  {key: 'chuong', hd: 'chuong'},
  {key: 'menu', hd: 'menu'},
];

export const TOUR_GIAO_VIEN: BuocTour[] = [
  {key: 'doc1', icon: 'graduation'},
  {key: 'doc2', icon: 'calendar'},
  {key: 'doc3', icon: 'target'},
  {key: 'chonLop', hd: 'chon-lop', khiThieu: 'bo'},
  {key: 'lopTruong', hd: 'gv-lop-truong'},
  {key: 'lichHop', hd: 'gv-lich-hop', khiThieu: 'bo'},
  {key: 'tuan', hd: 'tuan'},
  {key: 'baSo', hd: 'gv-ba-so'},
  {key: 'datMucTieuToi', hd: 'gv-dat-muc-tieu-toi', khiThieu: 'thay'},
  {key: 'camKetToi', hd: 'gv-them-cam-ket', khiThieu: 'thay'},
  {key: 'chamToi', hd: 'gv-cham', khiThieu: 'thay'},
  {key: 'thuocToi', hd: 'gv-tick', khiThieu: 'thay'},
  {key: 'cacEm', hd: 'gv-cac-em'},
  {key: 'choDuyet', hd: 'gv-cho-duyet'},
  {key: 'tabKhac', hd: 'menu'},
  {key: 'chuong', hd: 'chuong'},
];

export const TOUR_QUAN_TRI: BuocTour[] = [
  {key: 'doc1', icon: 'shield'},
  {key: 'chonLop', hd: 'chon-lop', khiThieu: 'bo'},
  {key: 'quanTri', hd: 'ad-tab', khiThieu: 'thay'},
  {key: 'coSo', hd: 'ad-co-so', khiThieu: 'thay'},
  {key: 'menu', hd: 'menu'},
];

export const TOURS: Record<TenTour, BuocTour[]> = {
  hocSinh: TOUR_HOC_SINH,
  giaoVien: TOUR_GIAO_VIEN,
  quanTri: TOUR_QUAN_TRI,
};

/** Tour của trang đang đứng theo vai. Không khớp → null (nút "?" sẽ mời đi tới trang có tour). */
export function tourChoTrang(pathname: string, role: string): TenTour | null {
  const p = pathname.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
  if (role === 'student') return p.startsWith('/student') ? 'hocSinh' : null;
  if (role === 'teacher') return p.startsWith('/wig') ? 'giaoVien' : null;
  if (role === 'admin' || role === 'principal') {
    if (p.startsWith('/admin') || p.startsWith('/campus') || p.startsWith('/wig')) return 'quanTri';
    return null;
  }
  return null;
}

/** Trang "nhà" của tour — để nút "Đi tới trang đó" khi đang ở chỗ khác. */
export function trangCuaTour(tour: TenTour): string {
  return tour === 'hocSinh' ? '/student' : tour === 'giaoVien' ? '/wig' : '/admin';
}

/** Tour mặc định theo vai (lần đầu đăng nhập). */
export function tourTheoVai(role: string): TenTour | null {
  if (role === 'student') return 'hocSinh';
  if (role === 'teacher') return 'giaoVien';
  if (role === 'admin' || role === 'principal') return 'quanTri';
  return null;
}
