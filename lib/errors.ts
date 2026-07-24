// Ánh xạ lỗi Postgres/PostgREST sang thông báo thân thiện — KHÔNG lộ tên bảng/policy/mã lỗi ra UI.
// Chi tiết kỹ thuật nên log phía server; người dùng cuối chỉ thấy câu dễ hiểu.

type PgError = {code?: string | null; message?: string | null} | null | undefined;

export function friendlyError(error: PgError): string {
  if (!error) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  switch (error.code) {
    case '23505': // unique_violation
      return 'Dữ liệu này đã tồn tại (bị trùng).';
    case '23503': // foreign_key_violation
      return 'Không thực hiện được vì còn dữ liệu liên quan.';
    case '23514': // check_violation
      return 'Giá trị nhập không hợp lệ.';
    case '23502': // not_null_violation
      return 'Thiếu thông tin bắt buộc.';
    case '42501': // insufficient_privilege
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 'P0001': // raise_exception — guard nội bộ đã đặt thông báo tiếng Việt thân thiện
      return error.message || 'Thao tác bị từ chối.';
    default:
      return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
}
