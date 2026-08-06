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

// Năm học của trường Việt Anh: 01/07 → 30/06 năm sau. Trả về dạng '2026-2027'.
//
// SỬA 2026-08-06 — mốc từ tháng 6 sang tháng 7, và khoảng ngày từ 01/09–31/05 sang 01/07–30/06.
// Trước đây NHÃN và KHOẢNG NGÀY nói hai chuyện khác nhau: nhãn đổi ở tháng 6, còn khoảng lại là
// 01/09 → 31/05. Nghĩa là hôm nay (06/08/2026) mang nhãn '2026-2027' nhưng NẰM NGOÀI khoảng ngày
// của chính năm học ấy. Hệ quả thấy được: chủ dự án tạo mục tiêu năm, nó nhận start_date
// 2026-09-01, nên mọi mục tiêu tháng và tuần đều bị đẩy về sau tháng 9 — trong khi trường đã vào
// năm học từ tháng 7. Anh ấy báo đúng: "tháng 7 là bắt đầu kỳ này rồi, không phải t9".
//
// Phải khớp với current_school_year() trong DB (migration 0025, sửa ở 0093).
export function schoolYearLabel(date: Date = new Date()): string {
  const {y, m} = vnParts(date);
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Ngày đầu và ngày cuối của một năm học, tính từ năm đầu của nhãn ('2026-2027' → 2026).
// Khai một chỗ: trước đây hai hàm tự viết lại '-09-01' và '-05-31', nên sửa mốc là phải nhớ sửa
// cả hai — kiểu sót chỉ lộ ra khi một chỗ nói tháng 7 còn chỗ kia vẫn tháng 9.
export const NGAY_DAU_NAM_HOC = '-07-01';
export const NGAY_CUOI_NAM_HOC = '-06-30';

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

// Phạm vi năm học (01/07 → 30/06 năm sau) chứa ngày cho trước.
export function schoolYearRangeVN(date: Date = new Date()): {start: string; end: string; label: string} {
  const label = schoolYearLabel(date); // '2026-2027'
  const first = Number(label.split('-')[0]);
  return {start: `${first}${NGAY_DAU_NAM_HOC}`, end: `${first + 1}${NGAY_CUOI_NAM_HOC}`, label};
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
    return {label: `${y}-${y + 1}`, start: `${y}${NGAY_DAU_NAM_HOC}`, end: `${y + 1}${NGAY_CUOI_NAM_HOC}`};
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

// KHOẢNG NGÀY CHỌN ĐƯỢC KHI ĐÃ CÓ MỤC TIÊU CHA.
//
// Không phải cứ ngày nằm trong cha là chọn được. Luật của server (lib/wig-tao.ts) đòi CẢ KỲ nằm
// trong cha: `ky.start < cha.start_date || ky.end > cha.end_date` là từ chối. Mà tuần chứa ngày
// 01/09 là 31/08 → 06/09 — bắt đầu từ tháng 8. Nên chặn ô lịch đúng bằng khoảng của cha vẫn để
// lọt: người dùng chọn ngày đầu tháng, bấm Lưu, và lại nhận đúng câu "kỳ nằm ngoài mục tiêu cha"
// mà bản sửa này sinh ra để dẹp. Ảnh chụp production 2026-08-06 bắt được cảnh ấy.
//
// Phải lùi vào TUẦN TRỌN VẸN đầu tiên và cuối cùng. Trả về null khi cha ngắn tới mức không chứa
// trọn tuần nào — chỗ gọi phải nói ra thay vì đưa một ô lịch khoá sạch không lý do.
export function tuanTronTrongCha(
  chaStart: string,
  chaEnd: string,
): {min: string; max: string} | null {
  const ngay = 86_400_000;
  const dau = weekRangeVN(new Date(`${chaStart}T12:00:00Z`));
  // Tuần chứa ngày đầu của cha thò ra trước cha thì lấy tuần kế tiếp.
  const min = dau.start >= chaStart ? dau.start : weekRangeVN(new Date(new Date(`${dau.end}T12:00:00Z`).getTime() + ngay)).start;
  const cuoi = weekRangeVN(new Date(`${chaEnd}T12:00:00Z`));
  // Tuần chứa ngày cuối của cha thò ra sau cha thì lấy tuần liền trước.
  const max = cuoi.end <= chaEnd ? cuoi.end : weekRangeVN(new Date(new Date(`${cuoi.start}T12:00:00Z`).getTime() - ngay)).end;
  return min <= max ? {min, max} : null;
}

// Tháng TRỌN VẸN trong cha — cùng lý do: cha bắt đầu ngày 15 thì tháng ấy không nằm trọn.
export function thangTronTrongCha(chaStart: string, chaEnd: string): {min: string; max: string} | null {
  const dauThang = (ym: string) => `${ym}-01`;
  const cuoiThang = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  };
  const ke = (ym: string, b: number) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + b, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  let min = chaStart.slice(0, 7);
  if (dauThang(min) < chaStart) min = ke(min, 1);
  let max = chaEnd.slice(0, 7);
  if (cuoiThang(max) > chaEnd) max = ke(max, -1);
  return min <= max ? {min, max} : null;
}

// MỤC TIÊU CHA CHỌN SẴN CHO MỘT KỲ.
//
// Lỗi đã xảy ra: lớp có mục tiêu tháng 9 (tạo trước) và tháng 8 (tạo sau). Form tạo mục tiêu tuần
// lấy cha = phần tử ĐẦU DANH SÁCH, tức tháng 9, nên ô lịch bị kéo sang tháng 9 và mục tiêu tuần
// vừa tạo rơi vào 07/09 → 13/09 — cách tuần người dùng đang nhìn cả tháng.
//
// Luật: cha nào PHỦ ngày neo thì lấy cha ấy. Không có thì lấy cha sớm nhất còn CHƯA KẾT THÚC —
// kéo tới trước, không kéo ngược về kỳ đã qua. Hết cách mới lấy phần tử đầu.
//
// Đặt ở đây chứ không trong component vì phép này kiểm được bằng số (scripts/test-ky-cha.mjs), và
// vì nó thuộc cùng một họ luật với tuanTronTrongCha/thangTronTrongCha ngay trên.
export function chaPhuKy<T extends {start_date: string; end_date: string}>(
  ds: T[],
  neo: string | undefined,
): T | undefined {
  if (!neo) return ds[0];
  const phu = ds.find((o) => o.start_date <= neo && o.end_date >= neo);
  if (phu) return phu;
  const conHan = ds
    .filter((o) => o.end_date >= neo)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return conHan[0] ?? ds[0];
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
