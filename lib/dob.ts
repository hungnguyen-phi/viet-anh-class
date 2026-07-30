// Ba ô "ngày / tháng / năm" → chuỗi yyyy-mm-dd cho Postgres.
//
// VÌ SAO KHÔNG DÙNG <input type="date">: thứ tự hiển thị của ô đó chạy theo ngôn ngữ của TRÌNH
// DUYỆT, không theo ngôn ngữ của trang. Máy cài tiếng Anh hiện mm/dd/yyyy, nên 09/03 dễ bị hiểu
// thành mùng 3 tháng 9 thay vì mùng 9 tháng 3 — sai ngày sinh của một đứa trẻ mà không ai biết.
// Ba ô có nhãn "Ngày", "Tháng", "Năm" thì không còn chỗ cho nhầm lẫn, ở bất kỳ máy nào.
//
// Ngày không tồn tại thì BÁO LỖI, không tự đoán: 31/02 không phải "mùng 1 tháng 3" mà là người
// dùng gõ sai, phải nói ra để họ sửa.
//
// Để ở lib/ (không nằm trong file 'use server') để test được trực tiếp:
//   node scripts/test-dob.mjs

export type DobParts = {day?: string; month?: string; year?: string};

export function parseDob(p: DobParts, namNay = new Date().getFullYear()): {
  iso: string | null;
  error?: string;
} {
  const d = (p.day ?? '').trim();
  const m = (p.month ?? '').trim();
  const y = (p.year ?? '').trim();

  // Không điền gì — hợp lệ, đây là trường không bắt buộc.
  if (!d && !m && !y) return {iso: null};
  if (!d || !m || !y) return {iso: null, error: 'Ngày sinh phải điền đủ cả ngày, tháng và năm.'};
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y))
    return {iso: null, error: 'Ngày sinh chỉ nhận chữ số: ngày 1–31, tháng 1–12, năm đủ 4 số.'};

  const dd = Number(d);
  const mm = Number(m);
  const yy = Number(y);
  if (mm < 1 || mm > 12) return {iso: null, error: 'Tháng sinh phải từ 1 đến 12.'};
  if (yy < 1900 || yy > namNay)
    return {iso: null, error: `Năm sinh phải trong khoảng 1900–${namNay}.`};
  // Ngày 0 của tháng SAU = ngày cuối của tháng này → tự đúng cả năm nhuận.
  const soNgay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (dd < 1 || dd > soNgay) return {iso: null, error: `Tháng ${mm}/${yy} chỉ có ${soNgay} ngày.`};

  const p2 = (n: number) => String(n).padStart(2, '0');
  return {iso: `${yy}-${p2(mm)}-${p2(dd)}`};
}
