import type {MetadataRoute} from 'next';
import {SITE_URL} from '@/lib/site';

// robots.txt — CỐ Ý chặn mọi trang sau đăng nhập.
//
// Đây không phải web marketing: sau /login là dữ liệu THẬT của trẻ em. Dù đã có middleware +
// RLS chặn, vẫn không có lý do gì để mời bot bò vào những đường dẫn đó (URL dạng
// /student/<uuid> mà lọt vào chỉ mục là rò cả cấu trúc). Chỉ mở trang đăng nhập.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/vi', '/en', '/vi/login', '/en/login', '/login'],
        disallow: [
          '/api/',
          '/auth/',
          '/admin',
          '/student',
          '/roster',
          '/attendance',
          '/wig',
          '/scoreboard',
          '/campus',
          '/report',
          '/timetable',
          '/notifications',
          '/unauthorized',
          // Cùng danh sách cho bản có tiền tố locale.
          '/vi/admin',
          '/vi/student',
          '/vi/roster',
          '/vi/attendance',
          '/vi/wig',
          '/vi/scoreboard',
          '/vi/campus',
          '/vi/report',
          '/vi/timetable',
          '/vi/notifications',
          '/en/admin',
          '/en/student',
          '/en/roster',
          '/en/attendance',
          '/en/wig',
          '/en/scoreboard',
          '/en/campus',
          '/en/report',
          '/en/timetable',
          '/en/notifications',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
