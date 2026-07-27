// URL công khai của app — dùng cho metadataBase, canonical, sitemap, robots, JSON-LD.
// Đặt qua NEXT_PUBLIC_SITE_URL nếu đổi domain; mặc định là domain đang chạy.
// LƯU Ý: NEXT_PUBLIC_* bị nội tuyến lúc build (xem Dockerfile) → đổi biến này phải BUILD LẠI.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://class.vietanh.org').replace(
  /\/$/,
  '',
);

// Thông tin trường dùng cho Open Graph + JSON-LD. Không phải dữ liệu học sinh nên công khai được.
export const SCHOOL = {
  name: 'Trường Việt Anh',
  appName: 'Viet Anh Class',
  url: 'https://truongvietanh.com',
} as const;
