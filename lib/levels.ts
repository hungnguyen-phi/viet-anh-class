import type {Database} from '@/lib/database.types';

export type SchoolLevel = Database['public']['Enums']['school_level'];

// Cấp học một cơ sở có thể thuộc về. Thứ tự này là thứ tự hiển thị trong ô chọn.
export const SCHOOL_LEVELS: SchoolLevel[] = ['mam_non', 'tieu_hoc', 'thcs', 'thpt'];

// Khối tự sinh theo cấp — PHẢI khớp hàm standard_grade_numbers() ở migration 0047.
// Dùng ở client chỉ để HIỂN THỊ trước cho người dùng biết sẽ sinh ra gì; nguồn sự thật là DB.
export const GRADE_NUMBERS: Record<SchoolLevel, number[] | null> = {
  mam_non: null, // nhà trẻ/mầm/chồi/lá không đánh số, mỗi trường gọi một kiểu → nhập tay
  tieu_hoc: [1, 2, 3, 4, 5],
  thcs: [6, 7, 8, 9],
  thpt: [10, 11, 12],
};

// MỘT CƠ SỞ MANG NHIỀU CẤP.
//
// Trường liên cấp là chuyện bình thường: Việt Anh Gò Vấp dạy cả THCS lẫn THPT. Mô hình cũ chỉ cho
// một cấp mỗi cơ sở, nên nhãn ghi "THPT" trong khi cơ sở đang có Khối 6→12 — nói sai — và mục Khối
// bị khoá ở chế độ tự sinh của riêng cấp ấy.
//
// Các hàm dưới đây nhận MẢNG cấp và phải khớp standard_grade_numbers_multi() ở migration 0087.

/** Hợp các dải khối chuẩn của mọi cấp đã chọn. NULL = không cấp nào đánh số khối (chỉ mầm non). */
export function gradeNumbersFor(levels: SchoolLevel[] | null | undefined): number[] | null {
  if (!levels || levels.length === 0) return null;
  const nums = new Set<number>();
  for (const lv of levels) for (const n of GRADE_NUMBERS[lv] ?? []) nums.add(n);
  return nums.size === 0 ? null : [...nums].sort((a, b) => a - b);
}

/**
 * Khối có do hệ thống sinh hết không → có khoá ô gõ tay không.
 *
 * Khoá là để tránh lặp lại mớ "7", "6", "k", "Khối" từng có trên production. Nhưng CHỈ khoá khi
 * MỌI cấp đã chọn đều đánh số: cơ sở có mầm non thì phải gõ tay được (Nhà trẻ, Mầm, Chồi, Lá…),
 * mà nếu nó dạy cả tiểu học nữa thì khoá cứng sẽ chặn luôn phần phải gõ tay ấy.
 */
export function hasNumberedGrades(levels: SchoolLevel[] | null | undefined): boolean {
  if (!levels || levels.length === 0) return false;
  return levels.every((lv) => GRADE_NUMBERS[lv] != null);
}

/** Nhãn gọn cho danh sách cấp, dùng khi hiện chip trên thẻ cơ sở. */
export function levelLabels(
  levels: SchoolLevel[] | null | undefined,
  t: (key: string) => string,
): string {
  if (!levels || levels.length === 0) return '';
  // Giữ đúng thứ tự SCHOOL_LEVELS chứ không theo thứ tự người dùng tick, để hai cơ sở cùng cấp
  // luôn hiện giống nhau.
  return SCHOOL_LEVELS.filter((lv) => levels.includes(lv))
    .map((lv) => t(`level_${lv}`))
    .join(' · ');
}
