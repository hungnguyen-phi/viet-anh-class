// CỜ "ĐIỀN SẴN MẪU" cho tour tập tạo mục tiêu (05/09/2026).
//
// Tour đặt cờ ngay trước khi mở một hộp (mục tiêu / cam kết / thước đo); hộp mở ra đọc cờ và
// điền sẵn ví dụ để người dùng chỉ việc đọc rồi bấm Lưu. Cờ sống trong sessionStorage — chỉ tab
// này, mất khi đóng tab; tour kết thúc (Bỏ qua/Xong) thì xoá để lần mở hộp sau không bị điền sẵn.
//
// Đọc cờ KHÔNG xoá (React StrictMode gọi initializer hai lần lúc dev); hộp xoá cờ trong useEffect.
export type TangMau = 'mucTieu' | 'camKet' | 'thuoc';
const KHOA = 'va:hd:mau';

export function datCoMau(tang: TangMau) {
  try { sessionStorage.setItem(KHOA, tang); } catch { /* private mode */ }
}
export function docCoMau(tang: TangMau): boolean {
  try { return typeof window !== 'undefined' && sessionStorage.getItem(KHOA) === tang; } catch { return false; }
}
export function xoaCoMau() {
  try { sessionStorage.removeItem(KHOA); } catch { /* private mode */ }
}

/** Mục tiêu / cam kết do tour tập tạo — nhận ra bằng đầu tên, để thẻ mang `data-mau` cho tour chỉ đúng thẻ. */
const DAU_MAU = ['(Tập)', '(Practice)'];
export function laMau(ten: string | null | undefined): boolean {
  return !!ten && DAU_MAU.some((d) => ten.startsWith(d));
}
