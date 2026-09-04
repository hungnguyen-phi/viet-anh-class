// Ánh xạ lỗi Postgres/PostgREST sang thông báo thân thiện — KHÔNG lộ tên bảng/policy/mã lỗi ra UI.
// Chi tiết kỹ thuật nên log phía server; người dùng cuối chỉ thấy câu dễ hiểu.

// ════════════════════════════════════════════════════════════════════════════
// ĐÁNH DẤU "ĐÂY LÀ TIN XẤU"
// ════════════════════════════════════════════════════════════════════════════
//
// Cả app chuyển thông báo sau thao tác qua ?flash= trên URL. Chuỗi đó không mang theo thông tin
// việc vừa rồi THÀNH hay BẠI — nên hộp thông báo phải đoán, và nó đoán là thành: viền xanh, dấu
// tích, chữ xanh. Câu "Bạn không có quyền thực hiện thao tác này." vì thế hiện ra trông y hệt
// "Đã lưu". Cô giáo liếc thấy dấu tích xanh là đóng máy, WIG tuần không tồn tại, và sáng thứ Hai
// màn hình học sinh trống trơn.
//
// Vì sao đánh dấu vào CHÍNH CÂU CHỮ chứ không thêm một tham số: mỗi trang có một hàm flash riêng
// và câu thông báo nằm ở vị trí tham số khác nhau (`flash(msg)`, `gradesFlash(ctx, msg)`,
// `galleryFlash(classId, albumId, msg)`…). Thêm tham số thì phải sửa đúng vị trí ở từng nơi và
// sai một chỗ là chỗ đó lặng lẽ giữ nguyên hành vi cũ. Bọc câu chữ thì chỗ nào cũng như chỗ nào.
//
// Dấu là chuỗi ASCII đọc được, cố ý: nếu có hàm flash nào bị sót không gỡ dấu thì người dùng
// thấy ngay "!!LOI!!Bạn không có quyền…" — xấu, nhưng KÊU. Hỏng lặng lẽ mới là thứ đã gây ra
// chính lỗi này.
export const DAU_LOI = '!!LOI!!';

/** Bọc một câu báo THẤT BẠI trước khi đưa vào flash. */
export function loi(msg: string): string {
  return DAU_LOI + msg;
}

/** Gỡ dấu ra khỏi câu — mọi hàm flash gọi cái này trước khi đặt lên URL. */
export function tachLoi(msg: string): {msg: string; laLoi: boolean} {
  return msg.startsWith(DAU_LOI)
    ? {msg: msg.slice(DAU_LOI.length), laLoi: true}
    : {msg, laLoi: false};
}

type PgError = {code?: string | null; message?: string | null} | null | undefined;

// Tám câu lỗi chung nằm ở messages/*.json (`common.loi*`) — bản tiếng Việt dưới đây là mặc định khi
// nơi gọi không đưa hàm dịch (action cũ). Action mới truyền `t` của namespace `common`
// (getTranslations('common')) để người dùng bản EN không đọc lỗi tiếng Việt (audit 04/09).
export type DichLoi = (key: string, vars?: Record<string, string | number>) => string;

const MAC_DINH_VI: Record<string, string> = {
  loiChung: 'Đã xảy ra lỗi. Vui lòng thử lại.',
  loiTrung: 'Dữ liệu này đã có rồi (bị trùng).',
  loiLienQuan: 'Không thực hiện được vì còn dữ liệu liên quan.',
  loiKhongHopLe: 'Giá trị nhập không hợp lệ.',
  loiThieu: 'Thiếu thông tin bắt buộc.',
  loiQuyen: 'Bạn không có quyền thực hiện thao tác này.',
  loiTuChoi: 'Thao tác bị từ chối.',
  loiMa: 'Đã xảy ra lỗi (mã {ma}). Thử lại, và đọc mã này cho bộ phận kỹ thuật.',
};

export function friendlyError(error: PgError, t?: DichLoi): string {
  // Không truyền t → fallback tiếng Việt. Mọi server action đã được rà (04/09) để truyền t của
  // namespace 'common' (có loiChung…loiMa) nên đường fallback chỉ còn cho chỗ gọi ngoài request.
  const d: DichLoi = t ?? ((key, vars) => MAC_DINH_VI[key].replace('{ma}', String(vars?.ma ?? '')));
  if (!error) return d('loiChung');
  switch (error.code) {
    case '23505': // unique_violation
      return d('loiTrung');
    case '23503': // foreign_key_violation
      return d('loiLienQuan');
    case '23514': // check_violation — CÓ THỂ là trigger tự raise câu tiếng Việt (dùng errcode 23514,
      // ví dụ "Ngày của mục tiêu phải nằm trong năm học…"). Đừng nuốt câu ấy bằng câu chung chung:
      // chỉ generic khi là lỗi CHECK gốc của Postgres (câu tiếng Anh "violates check constraint").
      return error.message && !/check constraint/i.test(error.message) ? error.message : d('loiKhongHopLe');
    case '23502': // not_null_violation
      return d('loiThieu');
    case '42501': // insufficient_privilege
      return d('loiQuyen');
    case 'P0001': // raise_exception — guard nội bộ đã đặt thông báo tiếng Việt thân thiện
      return error.message || d('loiTuChoi');
    default:
      // KÈM MÃ LỖI cho những trường hợp chưa dịch.
      //
      // Câu "Đã xảy ra lỗi. Vui lòng thử lại." trần trụi từng làm mất trắng một lần chẩn: nút thêm
      // dải wifi hỏng suốt (mã 42P10 — upsert trỏ vào một chỉ mục biểu thức, xem migration 0086),
      // nhưng người dùng chỉ đọc được đúng câu vô nghĩa ấy, còn người sửa thì không có gì để lần.
      // Mã lỗi Postgres không phải bí mật và không phải PII; nó là thứ duy nhất trong câu này dẫn
      // được về đúng dòng code. Ai không quan tâm thì bỏ qua phần trong ngoặc.
      return error.code ? d('loiMa', {ma: error.code}) : d('loiChung');
  }
}
