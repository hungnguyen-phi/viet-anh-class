// ĐƠN VỊ ĐO KIỂU GÌ — tệp riêng, KHÔNG phụ thuộc gì.
//
// Để rời khỏi lib/wig-tao.ts vì tệp ấy dùng alias `@/` nên bộ kiểm không nạp thẳng được bằng
// `node --experimental-strip-types`. Đây là một khái niệm độc lập (một danh sách chữ và một
// phép so), nên đứng riêng vừa kiểm được vừa đúng chỗ hơn.

/**
 * ĐƠN VỊ NÀY ĐO KIỂU GÌ — quyết định ô ngày trông ra sao (0110).
 *
 * Ba kiểu, và chúng khác nhau ở chỗ CỘNG LẠI có nghĩa không:
 *
 *   'luot'  — ngày, buổi, tiết, lần, hôm: một lần làm là một đơn vị. MỘT CHẠM. Đây là việc em làm
 *             mỗi ngày nên phải giữ đúng một chạm; thêm một bước gõ vào đây là thêm ma sát vào
 *             chỗ ít chịu được ma sát nhất.
 *   'luong' — giờ, phút, bài, trang, từ, km, lead: cộng lại CÓ nghĩa nhưng mỗi hôm một khác. Một
 *             chạm nói dối: em học 3 giờ hôm nay, 1 giờ hôm sau, tick đều ra 1-1. → Ô ĐIỀN SỐ.
 *   'do'    — điểm, kg, cm, %, hạng: cộng lại KHÔNG có nghĩa. Được 7 điểm thứ Hai và 8 điểm thứ Tư
 *             không phải là 15 điểm. Loại này KHÔNG có lưới ngày; nó đi đường `measure_by='manual'`
 *             + ô số đo mỗi kỳ (0108), nơi con số mới nhất mới là con số thật.
 *
 * Không đoán bằng máy học gì cả — một danh sách chữ, so sau khi bỏ dấu và hạ chữ thường. Đơn vị lạ
 * rơi về 'luong': điền số bao giờ cũng nói đúng hơn một chạm, và người dùng sửa được.
 */
export type KieuDonVi = 'luot' | 'luong' | 'do';

const BO_DAU = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

const DV_LUOT = ['ngay', 'buoi', 'tiet', 'lan', 'hom', 'bua', 'chuyen', 'vong'];
const DV_DO = ['diem', 'kg', 'cm', 'm', 'kilogam', 'ki lo', 'phan tram', '%', 'hang', 'bac', 'muc'];

export function kieuDonVi(unit: string | null | undefined): KieuDonVi {
  const u = BO_DAU(unit ?? '');
  if (!u) return 'luong';
  if (DV_DO.some((x) => u === x || u.startsWith(x + ' '))) return 'do';
  if (DV_LUOT.some((x) => u === x || u.startsWith(x + ' '))) return 'luot';
  return 'luong';
}
