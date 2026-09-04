import type {MetadataRoute} from 'next';
import {SCHOOL} from '@/lib/site';

// PWA manifest (Next tự phục vụ ở /manifest.webmanifest).
//
// Icon: favicon.svg (any/maskable — SVG co giãn mọi cỡ, Chrome/Android nhận) + logo-viet-anh-128.webp
// (128 — bản nhẹ 2,8 KB) + logo-viet-anh.jpg (512). Repo CHƯA có PNG 192/512 và apple-touch-icon.png
// — iOS "Add to Home Screen" muốn icon đẹp thì cần PNG 180×180 thật; xuất từ logo gốc rồi khai thêm.
// Đừng khai đường dẫn PNG chưa tồn tại — trình duyệt báo lỗi icon 404.
//
// start_url là màn của học sinh (700 em dùng điện thoại) — middleware tự đưa vai khác về nhà của
// họ. display standalone + portrait: chạy như app, không thanh địa chỉ.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SCHOOL.appName} — ${SCHOOL.name}`,
    short_name: SCHOOL.appName,
    description: 'Mục tiêu, cam kết và thước đo mỗi tuần của lớp — Trường Việt Anh',
    id: '/vi',
    start_url: '/vi',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#26275d',
    lang: 'vi',
    categories: ['education'],
    icons: [
      {src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any'},
      {src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable'},
      {src: '/logo-viet-anh-128.webp', sizes: '128x128', type: 'image/webp', purpose: 'any'},
      {src: '/logo-viet-anh.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any'},
    ],
  };
}
