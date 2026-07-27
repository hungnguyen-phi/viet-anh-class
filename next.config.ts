import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Gói build tự chứa (server.js + deps đã tree-shake) cho deploy container — image gọn ~1/5.
  // An toàn vì app KHÔNG đọc file runtime qua process.cwd()/fs; message next-intl nạp bằng
  // dynamic import nên được Next tracer gói sẵn vào standalone.
  output: 'standalone',
  // Đừng quảng cáo stack cho người quét: bỏ header `x-powered-by: Next.js`.
  poweredByHeader: false,
  images: {
    // Cho phép ảnh từ Supabase Storage (ảnh bìa lớp, avatar). Host sẽ thêm sau khi tạo project.
    remotePatterns: [{protocol: 'https', hostname: '*.supabase.co'}],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Ép HTTPS 2 năm. An toàn vì domain đã chạy TLS qua Cloudflare; KHÔNG thêm `preload`
          // cho tới khi trường chắc chắn mọi subdomain đều có HTTPS (preload rất khó gỡ).
          {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains'},
          // Chặn trình duyệt tự "đoán" kiểu file — hạn chế XSS qua file tải lên (ảnh bìa lớp).
          {key: 'X-Content-Type-Options', value: 'nosniff'},
          // Chặn nhúng app vào iframe site khác (clickjacking). App không có nhu cầu được nhúng.
          {key: 'X-Frame-Options', value: 'DENY'},
          // Rò rỉ đường dẫn nội bộ ra site ngoài là rủi ro thật: URL có dạng /student/<uuid>.
          {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
          // App không dùng camera/mic/định vị → tắt hẳn, kể cả với iframe con.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // CSP ở chế độ REPORT-ONLY: trình duyệt chỉ ghi log vi phạm, KHÔNG chặn gì.
          // Cố ý chưa bật chế độ chặn — CSP sai một dòng là chặn luôn Google OAuth
          // (accounts.google.com) hoặc Supabase (REST + WSS realtime), mà lỗi chỉ lộ ra lúc
          // người thật dùng. Cách chuyển sang chặn: mở DevTools → Console vài ngày với các
          // luồng thật (đăng nhập Google, check-in, realtime điểm danh, upload ảnh bìa), hết
          // cảnh báo thì đổi key thành 'Content-Security-Policy'.
          //
          // 'unsafe-inline' cho script là BẮT BUỘC với Next App Router: RSC payload nằm trong
          // thẻ <script> inline. Muốn bỏ thì phải làm nonce qua middleware — việc riêng.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Ảnh: Supabase Storage (bìa lớp, avatar) + data/blob cho preview lúc upload.
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              // Supabase REST/Auth + realtime (wss), và OpenRouter thì gọi từ SERVER nên
              // KHÔNG cần khai ở đây.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              // Google OAuth redirect đi ra ngoài chứ không nhúng iframe → form-action.
              "form-action 'self' https://accounts.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
