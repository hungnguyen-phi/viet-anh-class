// ĐƠN VỊ ĐO KIỂU GÌ — tệp riêng, KHÔNG phụ thuộc gì.
//
// Tách riêng (không dùng alias `@/`) để bộ kiểm nạp thẳng được bằng
// `node --experimental-strip-types`. Đây là một khái niệm độc lập (một danh sách và một phép so),
// nên đứng riêng vừa kiểm được vừa đúng chỗ hơn.

/**
 * BA KIỂU, phân theo đúng một câu hỏi: CỘNG LẠI CÓ NGHĨA KHÔNG?
 *
 *   'luot'  — buổi, lần, ngày: một lần làm LÀ một đơn vị, không có gì để hỏi thêm. MỘT CHẠM.
 *   'luong' — tiết, giờ, phút, bài, trang, km: cộng lại có nghĩa, nhưng mỗi lần một lượng khác
 *             nhau. Phải hỏi "mỗi lần bao nhiêu" — cố định (một chạm × hệ số) hoặc mỗi lần một
 *             khác (ô điền số).
 *   'do'    — điểm, kg, cm, %: cộng lại KHÔNG có nghĩa. 7 điểm thứ Hai với 8 điểm thứ Tư không
 *             phải 15 điểm. Loại này không có lưới ngày; nó đi ô số đo mỗi tuần (0108), nơi con
 *             số MỚI NHẤT mới là con số thật.
 */
export type KieuDonVi = 'luot' | 'luong' | 'do';

export type DonVi = {
  ma: string;
  kieu: KieuDonVi;
};

/**
 * DANH SÁCH ĐỂ CHỌN, thay cho ô gõ tay.
 *
 * Gõ tay thì app phải ĐOÁN kiểu từ chuỗi chữ — "tiet" không dấu, "Bài" hoa, "buoi" — và đoán sai
 * là hỏi sai câu hỏi tiếp theo. Chọn từ danh sách thì luật lộ ra ngay lúc chọn, và không còn
 * trạng thái "chưa gõ đơn vị" khiến bước ③ im lặng bỏ mất câu hỏi của nó.
 *
 * "tiết" nằm ở 'luong' chứ không phải 'luot': một buổi học có thể 2 tiết, nên phải hỏi. Chủ dự án
 * chỉ ra 13/08/2026.
 *
 * Vẫn cho gõ đơn vị KHÁC — danh sách này không thể phủ hết mọi môn, mọi trường. Đơn vị lạ rơi về
 * 'luong': hỏi "mỗi lần bao nhiêu" bao giờ cũng an toàn hơn là mặc định 1 rồi đếm sai.
 */
// Mã đơn vị GIEO VÀO CSDL (don_vi.ma) — dữ liệu dùng chung, không phải nhãn; nhãn hiển thị đọc từ
// don_vi.nhan_vi / nhan_en. Cố ý không qua messages (audit 04/09).
export const DON_VI: DonVi[] = [
  {ma: 'buổi', kieu: 'luot'},
  {ma: 'lần', kieu: 'luot'},
  {ma: 'ngày', kieu: 'luot'},
  {ma: 'tiết', kieu: 'luong'},
  {ma: 'giờ', kieu: 'luong'},
  {ma: 'bài', kieu: 'luong'},
  {ma: 'điểm', kieu: 'do'},
  {ma: 'kg', kieu: 'do'},
  {ma: 'cm', kieu: 'do'},
  // Dưới đây KHÔNG bày trong dropdown (giữ nó ngắn), nhưng vẫn phải nằm trong bảng phân loại: em
  // gõ tay qua ô "Khác…" thì chúng phải về đúng kiểu, không rơi vào mặc định.
  {ma: 'phút', kieu: 'luong'},
  {ma: 'trang', kieu: 'luong'},
  {ma: 'quyển', kieu: 'luong'},
  {ma: 'từ', kieu: 'luong'},
  {ma: 'km', kieu: 'luong'},
  {ma: '%', kieu: 'do'},
];


const BO_DAU = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** Bỏ dấu + thường hoá để so/tìm tên tiếng Việt ("Hung" khớp "Hùng"). Cùng luật với cột
 *  `full_name_khong_dau` trên CSDL (0187) — hai bên phải cho ra cùng một chuỗi. */
export const boDau = BO_DAU;

// Bảng tra đã bỏ dấu, để đơn vị gõ tay ("tiet", "GIỜ", "Bài ") vẫn về đúng kiểu.
const THEO_MA = new Map(DON_VI.map((d) => [BO_DAU(d.ma), d.kieu]));

/**
 * Kiểu của một đơn vị. Dùng ở CẢ máy chủ (nơi quyết định thật) lẫn form (nơi bày ô).
 * Đơn vị lạ hoặc bỏ trống → 'luong': hỏi thêm một câu an toàn hơn là mặc định 1 rồi đếm sai.
 */
export function kieuDonVi(unit: string | null | undefined): KieuDonVi {
  const u = BO_DAU(unit ?? '');
  if (!u) return 'luong';
  const thang = THEO_MA.get(u);
  if (thang) return thang;
  // "giờ học", "bài tập", "điểm trung bình" — khớp theo từ đầu.
  for (const [ma, kieu] of THEO_MA) if (u.startsWith(ma + ' ')) return kieu;
  return 'luong';
}

/** Đơn vị này có nằm trong danh sách chọn không — để form biết mở ô "Khác…" hay không. */
export function coTrongDanhSach(unit: string | null | undefined): boolean {
  return DON_VI.some((d) => d.ma === (unit ?? '').trim());
}
