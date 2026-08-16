// BỘ ĐỆM TRONG RAM CỦA TIẾN TRÌNH — cho những câu hỏi mà câu trả lời gần như không đổi.
//
// Chủ dự án 16/08/2026: "bộ nhớ ram máy chủ nhiều lắm, cứ thoải mái". Đường ra Supabase của máy
// chủ này mất gói (~3–5 %), nên MỖI vòng đi-về là 150–400 ms và có đuôi tới cả giây. Hai câu hỏi
// đứng đầu mọi trang — "người này là ai" (profiles) và "người này có những lớp nào" (classes) —
// trả lời y hệt nhau hàng trăm lần một ngày. Nhớ chúng 60 giây là bỏ được 1–2 vòng nối tiếp
// khỏi mọi lần mở trang, tức là chính cái chuỗi đang làm người dùng chờ.
//
// LUẬT:
//   · Khoá luôn mang id người dùng. Đệm KHÔNG bao giờ trả dữ liệu của người này cho người khác —
//     RLS đã lọc lúc hỏi, đệm chỉ nhớ lại đúng câu trả lời ấy cho đúng người ấy.
//   · Chỉ nhớ thứ đổi hiếm (vai trò, danh sách lớp). KHÔNG nhớ tick, cam kết, điểm danh — thứ mà
//     một giây cũ đã là sai.
//   · Ai GHI vào bảng được nhớ thì gọi quen() ngay trong action ấy (admin/actions.ts) — người
//     vừa được đổi vai không phải chờ hết 60 giây mới thấy.
//   · Một tiến trình, một bộ đệm. App chạy một container nên không có chuyện hai bản đệm lệch
//     nhau; nếu sau này chạy nhiều bản thì TTL 60 giây là trần lệch tối đa — chấp nhận được cho
//     đúng hai loại dữ liệu này.
//   · Cùng lúc mười request hỏi cùng một khoá thì chỉ MỘT lượt ra Supabase, chín cái kia chờ chung
//     promise (dedupe in-flight). Hỏi lỗi thì không nhớ lỗi.
type O = {het: number; gt: Promise<unknown>};
const kho = new Map<string, O>();

export function nho<T>(khoa: string, ttlMs: number, hoi: () => Promise<T>): Promise<T> {
  const bay = Date.now();
  const co = kho.get(khoa);
  if (co && co.het > bay) return co.gt as Promise<T>;
  const gt = hoi().catch((e) => {
    kho.delete(khoa);
    throw e;
  });
  kho.set(khoa, {het: bay + ttlMs, gt});
  // Không để kho phình vô hạn: quá 5000 khoá thì gạt hết thứ đã hết hạn.
  if (kho.size > 5000) for (const [k, o] of kho) if (o.het <= bay) kho.delete(k);
  return gt;
}

/** Quên theo tiền tố ('' = quên tất cả). Gọi ngay sau khi ghi vào bảng đang được nhớ. */
export function quen(tienTo = ''): void {
  if (!tienTo) {
    kho.clear();
    return;
  }
  for (const k of kho.keys()) if (k.startsWith(tienTo)) kho.delete(k);
}
