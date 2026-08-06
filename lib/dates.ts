// Helper ngày tháng dùng chung: nhãn tuần ISO 'W38-2026' và nhãn năm học VN.
// QUAN TRỌNG: mọi tính toán ngày phải theo lịch VIỆT NAM, không theo giờ local
// của server (= UTC trên Vercel). Nếu không, khung 00:00–07:00 giờ VN sẽ tính nhầm
// sang ngày/tuần hôm trước → biên bản họp gán sai tuần, mất khỏi báo cáo phụ huynh.

// Lấy năm/tháng/ngày theo lịch Việt Nam từ một Date (mặc định: bây giờ).
function vnParts(date: Date): {y: number; m: number; d: number} {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // 'YYYY-MM-DD'
  const [y, m, d] = s.split('-').map(Number);
  return {y, m, d};
}

export function isoWeekLabel(date: Date = new Date()): string {
  const {y, m, d} = vnParts(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${String(weekNo).padStart(2, '0')}-${dt.getUTCFullYear()}`;
}

// Năm học VN. Mốc chuyển ở tháng 6 (hè = chuẩn bị năm học mới): tháng 6→12 thuộc
// năm học Y-(Y+1), tháng 1→5 thuộc (Y-1)-Y. Trả về dạng '2026-2027'.
// Phải khớp với current_school_year() trong DB (migration 0025).
export function schoolYearLabel(date: Date = new Date()): string {
  const {y, m} = vnParts(date);
  return m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Ngày hôm nay theo múi giờ Việt Nam, dạng 'YYYY-MM-DD' (fallback nếu RPC app_today lỗi).
export function todayInVN(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

// Bảy ngày của tuần ISO chứa `today` (Thứ Hai → Chủ Nhật), dạng 'YYYY-MM-DD'.
//
// Nhận vào MỘT CHUỖI NGÀY chứ không phải Date: nơi gọi đã có sẵn ngày theo giờ VN (todayInVN
// hoặc app_today), và nếu nhận Date thì lại phải đổi múi giờ lần nữa — mỗi lần đổi là một cơ hội
// lệch 7 tiếng trong khung 00:00–07:00. Tính bằng UTC trên chuỗi đã chuẩn hoá thì không lệch.
//
// Trước đây đoạn này được chép tay trong StudentScoreboard; nay bảng tick của GVCN cần đúng
// 7 ngày ấy để xếp cột, nên tách ra dùng chung — hai bản chép tay là hai cơ hội lệch nhau.
export function weekDaysVN(today: string): string[] {
  const monday = new Date(`${today}T00:00:00Z`);
  const isoDow = monday.getUTCDay() === 0 ? 7 : monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (isoDow - 1));
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Thứ trong tuần theo ISO (1=T2 … 7=CN) của một chuỗi ngày 'YYYY-MM-DD'.
export function isoDowVN(day: string): number {
  const n = new Date(`${day}T00:00:00Z`).getUTCDay();
  return n === 0 ? 7 : n;
}

// Phạm vi tuần ISO (Thứ Hai → Chủ Nhật) chứa ngày cho trước, theo lịch VN.
export function weekRangeVN(date: Date = new Date()): {start: string; end: string; label: string} {
  const {y, m, d} = vnParts(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7; // Thứ Hai=1 … Chủ Nhật=7
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (dayNum - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return {start: fmt(monday), end: fmt(sunday), label: isoWeekLabel(date)};
}

// Tuần KẾ TIẾP theo giờ VN — dùng cho "Kế hoạch tuần sau" trong buổi họp WIG, để GVCN không
// phải tự gõ nhãn kỳ (gõ sai định dạng là WIG không khớp tuần nào).
export function nextWeekRangeVN(date: Date = new Date()): {start: string; end: string; label: string} {
  return weekRangeVN(new Date(date.getTime() + 7 * 86_400_000));
}

// ============================================================
// ĐIỀU HƯỚNG THEO TUẦN — nút ← → ở trang quản lý WIG.
//
// Nhóm hàm này trao đổi bằng CHUỖI 'YYYY-MM-DD' của thứ Hai, không phải Date. Phần còn lại của
// hệ thống đã nói chuyện với nhau bằng chuỗi ngày theo lịch VN (todayInVN, weekDaysVN, tham số
// p_week_start của RPC class_lead_board); nhét Date vào giữa là thêm một lần quy đổi múi giờ,
// tức thêm một cơ hội lệch 7 tiếng trong khung 00:00–07:00 — đúng loại lỗi cả file này đang tránh.
// ============================================================

// Date "không thể trượt ngày" từ một chuỗi ngày: giữa trưa UTC = 19h giờ VN CÙNG NGÀY.
//
// Vì sao không dùng T00:00:00Z: các hàm nhận Date ở dưới (isoWeekLabel, weekOptions, monthOptions)
// đều quy đổi sang lịch VN thêm một lần nữa. Mốc nửa đêm UTC cho biên an toàn đúng bằng 0 — lệch
// một tiếng theo chiều nào cũng rơi sang ngày khác. Mốc giữa trưa cho biên 12 tiếng cả hai phía.
export function vnNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

// Chuỗi ngày này có TỒN TẠI trên lịch không.
//
// Bắt buộc phải có vì ?week= đến thẳng từ thanh địa chỉ: người ta sửa được, link cũ dán lại được.
// Mọi hàm bên dưới đều kết thúc bằng toISOString(), và Date hỏng thì hàm đó NÉM RangeError — cả
// trang trắng vì một ký tự thừa trên URL. Phải kiểm bằng cách QUAY VÒNG chứ không chỉ bằng regex:
// '2026-02-31' khớp regex nhưng Date đẩy nó thành 03-03, so lại là lệch.
export function isValidDayVN(s: string | null | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Thứ Hai của tuần chứa `day`.
//
// Dùng để CHUẨN HOÁ ?week= trước khi truyền đi bất cứ đâu: RPC class_lead_board / class_tick_matrix
// (0073) KHÔNG tự ép về đầu tuần — chúng lấy nguyên cửa sổ [p_week_start, p_week_start+6]. Đưa vào
// một ngày giữa tuần là cửa sổ trượt sang tuần sau, lặng lẽ, không báo gì.
export function mondayOf(day: string): string {
  return weekDaysVN(day)[0];
}

// Thứ Hai cách `monday` đúng `delta` tuần (âm = lùi về quá khứ).
export function shiftWeeks(monday: string, delta: number): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

// Nhãn ISO + hai đầu mốc của tuần bắt đầu từ `monday`. Cùng hình dạng với weekRangeVN() để hai
// thứ thay nhau được ở nơi gọi (weekRangeVN đi từ Date, hàm này đi từ chuỗi ngày).
export function weekFromMonday(monday: string): {start: string; end: string; label: string} {
  const days = weekDaysVN(monday);
  return {start: days[0], end: days[6], label: isoWeekLabel(vnNoon(days[0]))};
}

// N nhãn tuần gần nhất (mới → cũ) cho ô CHỌN tuần, thay ô nhập text tự do.
export function recentWeekLabels(count = 6, date: Date = new Date()): string[] {
  return Array.from({length: count}, (_, i) =>
    isoWeekLabel(new Date(date.getTime() - i * 7 * 86_400_000)),
  );
}

// Phạm vi năm học VN (01/09 → 31/05 năm sau) chứa ngày cho trước.
export function schoolYearRangeVN(date: Date = new Date()): {start: string; end: string; label: string} {
  const label = schoolYearLabel(date); // '2026-2027'
  const first = Number(label.split('-')[0]);
  return {start: `${first}-09-01`, end: `${first + 1}-05-31`, label};
}

// ============================================================
// Danh sách KỲ để CHỌN — thay ô nhập "Nhãn kỳ" tự do.
// Lý do phải làm: trên production, cột period_label của WIG năm đang có CẢ '2026' (3 dòng,
// T1–T12) LẪN '2026-2027' (8 dòng, T6–T5) — hai quy ước lẫn nhau trong cùng một cột, đúng hậu
// quả của việc để GVCN tự gõ. Sinh nhãn từ danh sách thì luôn đúng định dạng, và start/end
// cũng tự khớp theo nhãn (trước đây nhập tay, gõ lệch là WIG không khớp kỳ nào).
// ============================================================
export type PeriodOption = {label: string; start: string; end: string};

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function schoolYearOptions(count = 2, date: Date = new Date()): PeriodOption[] {
  const first = Number(schoolYearLabel(date).split('-')[0]);
  return Array.from({length: count}, (_, i) => {
    const y = first + i;
    return {label: `${y}-${y + 1}`, start: `${y}-09-01`, end: `${y + 1}-05-31`};
  });
}

// Nhãn tháng dạng '2026-09', phạm vi = ngày 1 → ngày cuối tháng đó.
export function monthOptions(back = 1, forward = 4, date: Date = new Date()): PeriodOption[] {
  const {y, m} = vnParts(date);
  const out: PeriodOption[] = [];
  for (let i = -back; i <= forward; i++) {
    const t = new Date(Date.UTC(y, m - 1 + i, 1));
    const yy = t.getUTCFullYear();
    const mm = t.getUTCMonth() + 1;
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); // ngày 0 của tháng sau = ngày cuối
    out.push({label: `${yy}-${String(mm).padStart(2, '0')}`, start: ymd(yy, mm, 1), end: ymd(yy, mm, last)});
  }
  return out;
}

// Nhãn tuần ISO dạng 'W38-2026', phạm vi Thứ Hai → Chủ Nhật.
export function weekOptions(back = 2, forward = 4, date: Date = new Date()): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = -back; i <= forward; i++) {
    out.push(weekRangeVN(new Date(date.getTime() + i * 7 * 86_400_000)));
  }
  return out;
}

export function periodOptions(period: 'year' | 'month' | 'week'): PeriodOption[] {
  if (period === 'year') return schoolYearOptions();
  if (period === 'month') return monthOptions();
  return weekOptions();
}

// ============================================================
// NGÀY CỦA MỘT KỲ, TRA TỪ NHÃN — nguồn sự thật của mọi lệnh tạo WIG.
// ============================================================
//
// Trước đây form gửi lên cả ba thứ: nhãn kỳ, ngày đầu, ngày cuối. Chúng phải khớp nhau mới đúng
// mà không có gì bảo đảm chuyện đó, và hậu quả đã thấy trên production: cột period_label của WIG
// năm có cả '2026' lẫn '2026-2027' lẫn lộn, còn WIG tuần thì có cái lệch một hai hôm so với tuần
// lịch — nên màn hình giáo viên và màn hình học sinh cắt ra hai kết quả khác nhau (sự cố 7B1).
//
// Nay trình duyệt chỉ gửi NHÃN, server tra ngày ở đây. Nhãn không nằm trong danh sách thì từ chối
// thẳng. Đặt trong lib/dates.ts vì cả trang /wig lẫn phòng họp đều tạo WIG — hai bản chép tay là
// hai cơ hội trôi khỏi nhau.
//
// Cửa sổ rộng hơn danh sách mà form bày ra, cố ý: người dùng có thể đang đứng ở một tuần đã lùi
// vài bước, và chặn đúng bằng danh sách hiển thị thì họ bấm Lưu ra lỗi mà không hiểu vì sao.
// MỘT NƠI KHAI CỬA SỔ, HAI NƠI DÙNG.
//
// ngayCuaKy nhận nhãn nằm trong cửa sổ này; ô chọn ngày trên form bị chặn min/max cũng bằng đúng
// cửa sổ này. Khai hai chỗ là mở đường cho cảnh người dùng chọn được một ngày mà server từ chối —
// và lời từ chối ấy sẽ nói "nhãn kỳ không hợp lệ", câu chẳng liên quan gì tới việc họ vừa làm.
export const CUA_SO_KY = {
  year: {lui: 4, toi: 0},
  month: {lui: 6, toi: 12},
  week: {lui: 12, toi: 12},
} as const;

export function ngayCuaKy(
  period: 'year' | 'month' | 'week',
  label: string,
  now: Date = new Date(),
): {start: string; end: string} | null {
  const ngay = 86_400_000;
  const ds =
    period === 'year'
      ? schoolYearOptions(CUA_SO_KY.year.lui, new Date(now.getTime() - 365 * ngay))
      : period === 'month'
        ? monthOptions(CUA_SO_KY.month.lui, CUA_SO_KY.month.toi, now)
        : weekOptions(CUA_SO_KY.week.lui, CUA_SO_KY.week.toi, now);
  const hit = ds.find((o) => o.label === label);
  return hit ? {start: hit.start, end: hit.end} : null;
}

// Chặn đầu–cuối cho ô chọn ngày của form tạo mục tiêu.
//
// Tính Ở SERVER rồi truyền xuống, không tính trong component: mọi hàm ở trên đều lấy `new Date()`
// làm mốc, mà giờ máy chủ và giờ máy người dùng lệch nhau là hydrate lệch — đúng lý do cả ba danh
// sách kỳ hiện có cũng đang được tính ở server (xem ghi chú đầu TaoWigMenu).
export function gioiHanChonKy(now: Date = new Date()): {
  week: {min: string; max: string};
  month: {min: string; max: string};
} {
  const w = weekOptions(CUA_SO_KY.week.lui, CUA_SO_KY.week.toi, now);
  const m = monthOptions(CUA_SO_KY.month.lui, CUA_SO_KY.month.toi, now);
  return {
    week: {min: w[0].start, max: w[w.length - 1].end},
    // <input type="month"> nhận min/max dạng 'YYYY-MM' — đúng bằng nhãn kỳ tháng, không cần đổi.
    month: {min: m[0].label, max: m[m.length - 1].label},
  };
}
