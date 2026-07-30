import type {Database} from '@/lib/database.types';

// ============================================================
// Chữ nghĩa dùng chung của màn hình Học bạ.
//
// VÌ SAO GOM VÀO MỘT FILE: ba enum của migration 0064 (loại đợt, hạnh kiểm, loại điểm) xuất hiện
// ở CẢ màn hình giáo viên LẪN màn hình phụ huynh. Mỗi nơi tự đặt tên tiếng Việt là kiểu lỗi
// người dùng phát hiện trước mình: cô thấy "Cuối kỳ", phụ huynh thấy "Thi học kỳ", rồi cãi nhau
// xem hai chỗ có phải cùng một cột điểm không. Một bảng chữ, một chỗ sửa.
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

export const TERM_KIND_LABEL: Record<TermKind, string> = {
  giua_ky_1: 'Giữa học kỳ 1',
  hoc_ky_1: 'Học kỳ 1',
  giua_ky_2: 'Giữa học kỳ 2',
  hoc_ky_2: 'Học kỳ 2',
  ca_nam: 'Cả năm',
};

export const CONDUCTS: Conduct[] = ['tot', 'kha', 'trung_binh', 'yeu'];

export const CONDUCT_LABEL: Record<Conduct, string> = {
  tot: 'Tốt',
  kha: 'Khá',
  trung_binh: 'Trung bình',
  yeu: 'Yếu',
};

// Chip hạnh kiểm — chỉ dùng token màu của dự án (success / navy / gold-deep / status-bad),
// không đặt màu tự phát.
export const CONDUCT_CHIP: Record<Conduct, string> = {
  tot: 'border-success/30 bg-success/[0.12] text-success-dark',
  kha: 'border-navy/20 bg-navy/[0.06] text-navy',
  trung_binh: 'border-gold-mid/40 bg-gold/20 text-gold-deep',
  yeu: 'border-status-bad/30 bg-status-bad/[0.08] text-status-bad',
};

// Chỉ MÀU CHỮ, cho những chỗ hiện con số to (thẻ thống kê) — không dùng chung với chip vì chip
// còn mang nền và viền.
export const CONDUCT_TEXT: Record<Conduct, string> = {
  tot: 'text-success-dark',
  kha: 'text-navy',
  trung_binh: 'text-gold-deep',
  yeu: 'text-status-bad',
};

export const SCORE_KINDS: ScoreKind[] = ['mieng', '15p', '1tiet', 'giua_ky', 'cuoi_ky'];

export const SCORE_KIND_LABEL: Record<ScoreKind, string> = {
  mieng: 'Miệng',
  '15p': '15 phút',
  '1tiet': '1 tiết',
  giua_ky: 'Giữa kỳ',
  cuoi_ky: 'Cuối kỳ',
};

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
export function tenCot(subject: string, kind: ScoreKind, ordinal: number): string {
  return `${subject} · ${SCORE_KIND_LABEL[kind]} · lần ${ordinal}`;
}
