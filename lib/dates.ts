// Helper ngày tháng dùng chung: nhãn tuần ISO 'W38-2026' và nhãn năm học VN.

export function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${String(weekNo).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

// Năm học VN bắt đầu tháng 9 (index 8). Trả về dạng '2026-2027'.
export function schoolYearLabel(date: Date): string {
  const y = date.getFullYear();
  return date.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Ngày hôm nay theo múi giờ Việt Nam, dạng 'YYYY-MM-DD' (fallback nếu RPC app_today lỗi).
export function todayInVN(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}
