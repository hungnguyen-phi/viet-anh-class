// Thu nhỏ + nén ảnh NGAY TRÊN MÁY NGƯỜI GỬI, trước khi tải lên Storage.
//
// VÌ SAO PHẢI LÀM: ảnh chụp bằng điện thoại thường 3–5 MB, có cái 8 MB. Chỗ hiện nó rộng nhất
// trong app là 1160px (ảnh bìa lớp), còn ảnh album thì hiện ở ô vuông nhỏ trong lưới 2–4 cột.
// Tải nguyên cỡ lên nghĩa là MỌI phụ huynh mở trang đều phải kéo về ngần ấy, qua đúng đường
// truyền vốn đã chậm — trả giá nhiều lần cho một lần lười. Một album 12 ảnh × 4 MB là 48 MB chỉ
// để vẽ 12 ô thumbnail.
//
// Làm ở máy người gửi chứ không ở máy chủ: rẻ hơn hẳn (không tốn CPU máy chủ, không cần hàng đợi
// xử lý), và người gửi chỉ chờ thêm vài trăm mili giây — họ đang đứng chờ upload sẵn rồi.
//
// CHỈ CHẠY ĐƯỢC Ở TRÌNH DUYỆT (cần createImageBitmap + canvas). Đừng gọi từ server component.

export type CoAnh = {
  /** Cạnh dài tối đa sau khi thu nhỏ. */
  rong: number;
  /** Chất lượng webp 0–1. */
  chatLuong: number;
};

// Ảnh bìa lớp: hiện hết chiều ngang <main> (tối đa 1160px). Màn Retina cần gấp đôi → 1600 là dư.
export const CO_ANH_BIA: CoAnh = {rong: 1600, chatLuong: 0.82};

// Ảnh album: hiện trong lưới nhiều cột, cạnh lớn nhất khoảng 560px kể cả khi bấm xem to.
// 1280 đủ để phóng to xem mặt, mà nhẹ hơn hẳn ảnh bìa.
export const CO_ANH_ALBUM: CoAnh = {rong: 1280, chatLuong: 0.8};

/**
 * Trả về Blob webp đã thu nhỏ, hoặc chính File gốc nếu không xử lý được.
 *
 * KHÔNG NÉM LỖI, cố ý. Vài kiểu .HEIC của iPhone trình duyệt không giải mã được; lúc đó thà tải
 * lên một ảnh nặng còn hơn chặn người dùng không đăng được gì. Ảnh vốn đã nhỏ mà nén lại còn to
 * hơn thì cũng giữ bản gốc.
 */
export async function thuNhoAnh(file: File, co: CoAnh): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const tiLe = Math.min(1, co.rong / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * tiLe);
    const h = Math.round(bitmap.height * tiLe);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', co.chatLuong),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Đổi đuôi tệp sang .webp khi ảnh đã được nén; giữ nguyên nếu trả về bản gốc. */
export function tenTepSauNen(ten: string, daNen: boolean): string {
  const sach = ten.replace(/[^\w.-]/g, '_');
  return daNen ? sach.replace(/\.[^.]+$/, '') + '.webp' : sach;
}
