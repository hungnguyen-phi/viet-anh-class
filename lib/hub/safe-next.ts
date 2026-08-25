// ĐƯỜNG NỘI BỘ AN TOÀN — MỘT NƠI DUY NHẤT ĐỊNH NGHĨA "next hợp lệ là gì".
//
// Tách ra từ app/[locale]/(auth)/auth/callback/route.ts (nơi quy tắc này ra đời) để route mới
// app/api/hub/doi-ma dùng LẠI đúng một hàm — không chép tay biểu thức chính quy ra chỗ thứ hai.
// Hai bản chép tay là hai chỗ có thể lệch nhau một ký tự, và một ký tự lệch ở đây là mở đường
// open-redirect (dẫn người vừa đăng nhập qua Hub sang một trang bất kỳ ngoài app).
export function safeNextPath(raw: string | null | undefined): string | null {
  return raw && /^\/(?![/\\])/.test(raw) ? raw : null;
}
