import {todayInVN} from '@/lib/dates';

// ============================================================
// Định dạng thời gian cho màn hình Liên lạc (phụ huynh ↔ GVCN).
//
// VÌ SAO KHÔNG dùng `new Date(...).toLocaleString()` trần: máy chủ chạy UTC, lệch 7 tiếng so với
// giờ Việt Nam. Tin nhắn gửi lúc 6 giờ sáng thứ Bảy sẽ hiện thành 11 giờ tối thứ Sáu — sai ngày,
// mà đây đúng là loại nhầm lẫn khiến phụ huynh tưởng giáo viên nhắn lúc nửa đêm.
// Mọi bộ định dạng dưới đây đóng đinh timeZone như lib/dates.ts đã làm cho phần ngày tháng.
//
// Khởi tạo Intl ở cấp module (một lần cho cả tiến trình): dựng lại mỗi dòng tin là tốn thật —
// một cuộc trao đổi dài render vài trăm mốc thời gian.
// ============================================================
const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Trần độ dài một tin — BẰNG ĐÚNG ràng buộc CHECK của cột body trong 0065
 * (`length(btrim(body)) between 1 and 2000`).
 *
 * Để ở đây vì cả ô soạn tin (client) lẫn server action đều cần, mà file 'use server' thì không
 * export được hằng số (chỉ được export hàm async). Sửa số này mà không sửa migration là vô ích:
 * cơ sở dữ liệu mới là nơi chốt.
 */
export const GIOI_HAN_KY_TU = 2000;

const fmtGio = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fmtNgay = new Intl.DateTimeFormat('vi-VN', {timeZone: TZ, day: '2-digit', month: '2-digit'});
const fmtNgayDayDu = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
// 'en-CA' cho ra 'YYYY-MM-DD' — cùng khuôn với todayInVN() nên so sánh chuỗi được thẳng.
const fmtNgayISO = new Intl.DateTimeFormat('en-CA', {timeZone: TZ});

/**
 * Hàm dịch truyền từ ngoài vào.
 *
 * Hai hàm dưới đây trước kia ghép thẳng chữ tiếng Việt ("Hôm nay", "phút", "giờ", "ngày") vào
 * chuỗi trả về, nên bản tiếng Anh vẫn ra tiếng Việt. Chúng là hàm THUẦN, không phải component,
 * nên không gọi được useTranslations — cách đúng là nhận hàm dịch qua tham số, và nơi gọi (đều
 * là component) truyền vào.
 */
type Dich = (key: string, values?: Record<string, string | number>) => string;

/**
 * Mốc thời gian của một tin: 'Hôm nay 14:05' · '28/07 14:05' · '28/07/2025 14:05'.
 *
 * Bỏ năm khi cùng năm với hôm nay: hàng chục dòng trong một cuộc trao đổi, bốn chữ số lặp lại
 * chỉ làm chật mắt. Khác năm thì hiện đủ, vì lúc đó năm mới là thông tin.
 */
export function khiNao(iso: string | null, t: Dich): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const ngay = fmtNgayISO.format(d);
  const homNay = todayInVN();
  if (ngay === homNay) return t('todayAt', {time: fmtGio.format(d)});
  const cungNam = ngay.slice(0, 4) === homNay.slice(0, 4);
  return `${(cungNam ? fmtNgay : fmtNgayDayDu).format(d)} ${fmtGio.format(d)}`;
}

/**
 * Đã trôi qua bao lâu kể từ mốc đó: '20 phút' · '5 giờ' · '3 ngày'.
 *
 * Ở đây dùng Date.now() là ĐÚNG, không phạm luật "đừng lấy hôm nay bằng new Date()": ta đang
 * trừ hai mốc để ra một KHOẢNG, mà khoảng thì không phụ thuộc múi giờ. Chỉ khi cần biết "hôm nay
 * là ngày nào" mới phải đi qua giờ VN (xem khiNao ở trên).
 */
export function daCho(iso: string | null, t: Dich): string {
  if (!iso) return '—';
  const moc = new Date(iso).getTime();
  if (Number.isNaN(moc)) return '—';
  const phut = Math.max(0, Math.floor((Date.now() - moc) / 60_000));
  if (phut < 60) return t('agoMinutes', {n: phut});
  const gio = Math.floor(phut / 60);
  if (gio < 24) return t('agoHours', {n: gio});
  return t('agoDays', {n: Math.floor(gio / 24)});
}

/** Số giờ đã chờ — để tô màu mức khẩn. Trả về 0 khi không có mốc. */
export function soGioCho(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}
