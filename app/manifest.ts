import type {MetadataRoute} from 'next';
import {SCHOOL} from '@/lib/site';

// PWA manifest (Next tự phục vụ ở /manifest.webmanifest).
//
// Icon hiện dùng favicon.svg + logo .jpg vì repo CHƯA có PNG 192/512 và apple-touch-icon.png —
// tôi không tạo được file ảnh, cần xuất từ logo gốc rồi đặt vào public/. Khai SVG vẫn chạy trên
// Chrome/Android, nhưng iOS thì cần apple-touch-icon.png thật mới có icon đẹp khi "Add to Home
// Screen". Đừng khai đường dẫn PNG chưa tồn tại — trình duyệt sẽ báo lỗi icon 404.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SCHOOL.appName} — ${SCHOOL.name}`,
    short_name: SCHOOL.appName,
    description: 'Lãnh đạo lớp học theo khung 4DX — Trường Việt Anh',
    start_url: '/vi',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#26275d',
    lang: 'vi',
    icons: [
      {src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any'},
      {src: '/logo-viet-anh.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any'},
    ],
  };
}
