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
        ],
      },
    ];
    // CHƯA thêm Content-Security-Policy ở đây: CSP sai một dòng là chặn luôn Google OAuth
    // (accounts.google.com) hoặc Supabase (WSS realtime + REST), và lỗi chỉ hiện lúc chạy thật.
    // Cần làm riêng, bật Report-Only trước rồi đọc report vài ngày mới siết.
  },
};

export default withNextIntl(nextConfig);
