// URL công khai của app — dùng cho metadataBase, canonical, sitemap, robots, JSON-LD.
// Đặt qua NEXT_PUBLIC_SITE_URL nếu đổi domain; mặc định là domain đang chạy.
// LƯU Ý: NEXT_PUBLIC_* bị nội tuyến lúc build (xem Dockerfile) → đổi biến này phải BUILD LẠI.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://class.truongvietanh.com'
).replace(/\/$/, '');

// Thông tin trường dùng cho Open Graph + JSON-LD. Không phải dữ liệu học sinh nên công khai được.
export const SCHOOL = {
  name: 'Trường Việt Anh',
  appName: 'Việt Anh Class',
  url: 'https://truongvietanh.com',
} as const;

// TÍNH NĂNG TẠM ẨN (chủ dự án 04/09/2026): album ảnh lớp chưa cần — giữ code, tắt cửa vào.
// Bật lại: đổi thành true (route /gallery + hai nút dẫn vào tự hiện).
export const BAT_ALBUM_ANH = false;
