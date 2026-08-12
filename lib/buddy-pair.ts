// GHÉP CẶP BẠN ĐỒNG HÀNH — thuật toán thuần, không đụng CSDL, để test được không cần mở kết nối.
//
// Luật: mỗi em đúng một bạn, tránh lặp lại đúng bạn tuần trước nếu còn cách khác, và nếu số em lẻ
// thì dồn ba em cuối thành một VÒNG (A→B→C→A) — mỗi em vẫn có đúng một `buddy_id`, chỉ khác là
// không đối xứng cho riêng bộ ba đó. Xem lý do ở supabase/migrations/0104.

export function ghepCapBuddy(
  hocSinh: string[],
  tuanTruoc: Map<string, string>,
  rng: () => number = Math.random,
): Map<string, string> {
  const ket: Map<string, string> = new Map();
  if (hocSinh.length < 2) return ket;

  // Xáo ngẫu nhiên (Fisher-Yates) — thử tối đa 20 lần, giữ lần XÁO ÍT TRÙNG NHẤT với tuần trước.
  // Không cần đúng 0 trùng bằng mọi giá — lớp nhỏ (< 4 em) có thể không tránh được trùng.
  let tot: string[] = hocSinh;
  let itTrungNhat = Infinity;
  for (let lan = 0; lan < 20; lan++) {
    const thu = [...hocSinh];
    for (let i = thu.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [thu[i], thu[j]] = [thu[j], thu[i]];
    }
    const soTrung = demTrung(thu, tuanTruoc);
    if (soTrung < itTrungNhat) {
      itTrungNhat = soTrung;
      tot = thu;
      if (soTrung === 0) break;
    }
  }

  const le = tot.length % 2 === 1;
  const soDoi = le ? (tot.length - 3) / 2 : tot.length / 2;
  for (let i = 0; i < soDoi; i++) {
    const [a, b] = [tot[i * 2], tot[i * 2 + 1]];
    ket.set(a, b);
    ket.set(b, a);
  }
  if (le) {
    // Ba em cuối, xếp vòng tròn.
    const [a, b, c] = tot.slice(-3);
    ket.set(a, b);
    ket.set(b, c);
    ket.set(c, a);
  }
  return ket;
}

function demTrung(danhSach: string[], tuanTruoc: Map<string, string>): number {
  let n = 0;
  const le = danhSach.length % 2 === 1;
  const soDoi = le ? (danhSach.length - 3) / 2 : danhSach.length / 2;
  for (let i = 0; i < soDoi; i++) {
    const a = danhSach[i * 2];
    const b = danhSach[i * 2 + 1];
    if (tuanTruoc.get(a) === b) n++;
  }
  return n;
}
