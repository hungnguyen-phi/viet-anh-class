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
