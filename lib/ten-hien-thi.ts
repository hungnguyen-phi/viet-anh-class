// TÊN HIỆN TRÊN MÀN HÌNH cho một người, khi hồ sơ chưa có tên.
//
// MỘT LUẬT, DÙNG Ở MỌI CHỖ. Trước 13/08/2026 mỗi màn tự bịa một cách rơi: phòng họp WIG hiện
// "—" ở khối "Từng em" (cô nhìn một ô trống, không biết đang ghi cho ai) nhưng lại hiện NGUYÊN
// EMAIL ở bảng số liệu ngay phía trên cùng trang; danh sách lớp thì rơi về UUID. Ba cách hiện
// cho cùng một em, trong cùng một buổi họp.
//
// Luật chốt:
//   1. Có `full_name` → dùng.
//   2. Không thì lấy PHẦN TRƯỚC @ của email. Buổi họp WIG chiếu lên máy chiếu cả lớp cùng nhìn,
//      nên bày nguyên "test1.hs@student.truongvietanh.com" là bày địa chỉ thư của một đứa trẻ
//      cho cả phòng; phần trước @ đủ để nhận ra em nào mà không kèm theo cái địa chỉ.
//   3. Không có gì cả → một câu nói thẳng là hồ sơ còn thiếu, chứ không phải một dấu gạch.
//
// KHÔNG BAO GIỜ rơi về UUID: "0226fd73-…" không giúp ai nhận ra ai, mà lại lộ khoá chính.

export const TEN_CHUA_CO = 'Chưa có tên';

export function tenHienThi(
  fullName?: string | null,
  email?: string | null,
  chuaCo: string = TEN_CHUA_CO,
): string {
  const ten = (fullName ?? '').trim();
  if (ten) return ten;
  const e = (email ?? '').trim();
  if (e) {
    const truoc = e.split('@')[0].trim();
    if (truoc) return truoc;
  }
  return chuaCo;
}
