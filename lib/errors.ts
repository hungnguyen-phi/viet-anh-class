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
