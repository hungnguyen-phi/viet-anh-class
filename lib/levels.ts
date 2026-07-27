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

// Cấp có khối đánh số → khối do hệ thống sinh, KHÔNG cho gõ tay (tránh lặp lại mớ
// "7", "6", "k", "Khối" từng có trên production).
export function hasNumberedGrades(level: SchoolLevel | null | undefined): boolean {
  return level != null && GRADE_NUMBERS[level] != null;
}
