import type {Database} from '@/lib/database.types';

// ============================================================
// Hằng số dùng chung của màn hình Học bạ.
//
// VÌ SAO GOM VÀO MỘT FILE: ba enum của migration 0064 (loại đợt, hạnh kiểm, loại điểm) xuất hiện
// ở CẢ màn hình giáo viên LẪN màn hình phụ huynh. Mỗi nơi tự đặt tên là kiểu lỗi người dùng phát
// hiện trước mình: cô thấy "Cuối kỳ", phụ huynh thấy "Thi học kỳ", rồi cãi nhau xem hai chỗ có
// phải cùng một cột điểm không. Một bảng chữ, một chỗ sửa.
//
// CHỮ thì nằm ở file dịch (grades.termKinds.* / grades.conducts.* / grades.scoreKinds.*), không
// ở đây — trước kia ba bảng nhãn tiếng Việt viết cứng ngay trong file này nên bản tiếng Anh của
// cả màn hình giáo viên lẫn học bạ gia đình vẫn ra tiếng Việt. File này giờ chỉ giữ thứ KHÔNG
// phụ thuộc ngôn ngữ: danh sách khoá, thứ tự hiển thị, và lớp CSS của chip.
//
// Thứ tự trong các mảng là thứ tự HIỂN THỊ và trùng thứ tự enum trong Postgres — nhờ vậy
// `.order('kind')` ở truy vấn ra đúng dãy này, không phải sắp lại ở client.
// ============================================================

export type TermKind = Database['public']['Enums']['assessment_term_kind'];
export type Conduct = Database['public']['Enums']['conduct_rating'];
export type ScoreKind = Database['public']['Enums']['score_kind'];

export const TERM_KINDS: TermKind[] = [
  'giua_ky_1',
  'hoc_ky_1',
  'giua_ky_2',
  'hoc_ky_2',
  'ca_nam',
];

export const CONDUCTS: Conduct[] = ['tot', 'kha', 'trung_binh', 'yeu'];

// Chip hạnh kiểm — chỉ dùng token màu của dự án (success / navy / gold-deep / status-bad),
// không đặt màu tự phát.
export const CONDUCT_CHIP: Record<Conduct, string> = {
  tot: 'border-success/30 bg-success/[0.12] text-success-dark',
  kha: 'border-navy/20 bg-navy/[0.06] text-navy',
  trung_binh: 'border-gold-mid/40 bg-gold/20 text-gold-text',
  yeu: 'border-status-bad/30 bg-status-bad/[0.08] text-status-bad',
};

// Chỉ MÀU CHỮ, cho những chỗ hiện con số to (thẻ thống kê) — không dùng chung với chip vì chip
// còn mang nền và viền.
export const CONDUCT_TEXT: Record<Conduct, string> = {
  tot: 'text-success-dark',
  kha: 'text-navy',
  trung_binh: 'text-gold-text',
  yeu: 'text-status-bad',
};

export const SCORE_KINDS: ScoreKind[] = ['mieng', '15p', '1tiet', 'giua_ky', 'cuoi_ky'];

/**
 * Hiện một con điểm theo lối Việt Nam: dấu PHẨY thập phân, và không kéo lê số 0 vô nghĩa
 * (9 chứ không phải 9,00 — bảng 30 em × 8 môn mà toàn '0' thừa thì đọc rất mệt).
 *
 * Không làm tròn thêm lần nữa: view `subject_term_summary_v` đã round(...,2) rồi, làm tròn chồng
 * lên là hai màn hình ra hai con số khác nhau cho cùng một em.
 */
export function soVN(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/[.,]$/, '')
    .replace('.', ',');
}

/** Nhãn đầy đủ của một cột điểm: "Toán · 15 phút · lần 2". */
export function tenCot(
  subject: string,
  kind: ScoreKind,
  ordinal: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  return t('columnName', {subject, kind: t(`scoreKinds.${kind}`), ordinal});
}
