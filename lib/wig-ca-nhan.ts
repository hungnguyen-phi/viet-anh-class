// MỤC TIÊU NĂM CỦA EM SUY RA TỪ MỤC TIÊU NĂM CỦA LỚP.
//
// Chủ dự án nêu đúng hai kiểu chỉ tiêu, và chúng chia xuống theo hai cách khác hẳn nhau:
//
//   · MỨC     — "điểm trung bình 8.0". Lớp 8.0 thì mỗi em cũng 8.0. Chia cho sĩ số là vô nghĩa
//                (mỗi em 0.8 điểm?).
//   · KHỐI LƯỢNG — "1000 bài tập về nhà". Lớp 10 em thì mỗi em 100 bài.
//
// Một luật, một chỗ: form của giáo viên đoán sẵn cách chia và hiện con số bằng hàm này, rồi
// server TÍNH LẠI cũng bằng hàm này — không tin con số form gửi lên. Trước đây kiểu tính rải hai
// nơi là kiểu sinh ra sai lệch âm thầm (xem bài học 0076/0077 và 0098).

export type CachChia = 'muc' | 'chia';

// Bỏ dấu để so đơn vị: production có cả 'buoi' lẫn 'buổi' trong cùng một cột (dữ liệu cũ gõ
// không dấu). Khớp cách private.bo_dau() làm dưới CSDL.
function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

// Những đơn vị đo MỨC ĐẠT, không phải khối lượng làm được.
const DON_VI_MUC = ['diem', 'd', '%', 'phan tram', 'gpa', 'muc', 'hang', 'xep loai', 'sao'];

/** Đơn vị này nên CHIA ĐỀU theo sĩ số hay mỗi em đạt bằng lớp? true = chia đều. */
export function chiaTheoSiSo(unit: string | null): boolean {
  if (!unit) return true;
  return !DON_VI_MUC.includes(boDau(unit));
}

/**
 * Mục tiêu của một em.
 *
 * LÀM TRÒN LÊN khi chia: 1000 bài cho 3 em ra 333.33 — để 333 thì cả lớp cộng lại được 999, hụt
 * đúng một bài so với điều lớp đã hứa. Làm tròn lên thì cả lớp luôn cộng đủ hoặc hơn.
 */
export function mucTieuCuaEm(targetLop: number, siSo: number, cach: CachChia): number {
  if (cach === 'muc') return targetLop;
  const n = siSo > 0 ? siSo : 1;
  // Làm tròn 9 chữ số trước khi ceil: 21/0.7 trong số thực nhị phân ra 30.000000000000004, và
  // Math.ceil biến nó thành 31 (cùng cái bẫy đã gặp ở cảnh báo lead measure).
  return Math.max(1, Math.ceil(Number((targetLop / n).toFixed(9))));
}
