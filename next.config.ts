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
  async redirects() {
    return [
      // /messages → /inbox.
      //
      // Trigger pt_after_message() trong migration 0065 ghi notifications.link =
      // '/messages?t=<id>', nhưng màn hình liên lạc lại nằm ở /inbox. Bấm thông báo là rơi vào
      // trang không tồn tại.
      //
      // KHÔNG sửa chuỗi trong migration: thông báo ĐÃ SINH RA vẫn mang '/messages', sửa migration
      // chỉ chữa cho tin mới còn tin cũ hỏng vĩnh viễn.
      //
      // VÌ SAO Ở ĐÂY chứ không phải một page gọi redirect(): đã thử cách đó và đo được là nó
      // KHÔNG sạch. Layout (dashboard) dựng AppNav và bắt đầu stream trước khi page kịp ném
      // redirect, nên status khoá ở 200 và Next phải nhét lệnh chuyển hướng vào body — người dùng
      // thấy nháy qua khung dashboard rồi mới nhảy. redirects() của Next chạy TRƯỚC mọi render
      // nên trả 308 thật, không nháy.
      //
      // permanent: false (307/308 tạm) — nếu sau này đổi ý gộp hai đường dẫn thì trình duyệt
      // không cache vĩnh viễn hướng cũ.
      {source: '/messages', destination: '/inbox', permanent: false},
      {source: '/:locale(vi|en)/messages', destination: '/:locale/inbox', permanent: false},
    ];
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
      // ---- Cache tài nguyên tĩnh ----
      // Next phục vụ file trong public/ với `Cache-Control: public, max-age=0` (vì file có thể
      // đổi giữa các bản build). Hệ quả: mỗi lần mở lại trang login là 54 request kiểm tra lại
      // sprite đám đông — 54 vòng mạng chỉ để nhận 304. Các file dưới đây là tài sản tĩnh KHÔNG
      // bao giờ đổi nội dung, nên cho cache vĩnh viễn.
      //
      // ĐÁNH ĐỔI: đã `immutable` thì trình duyệt sẽ KHÔNG lấy lại dù file có đổi. Muốn thay ảnh
      // thì phải ĐỔI TÊN FILE (vd a01.webp -> a01-v2.webp), sửa nội dung file cũ sẽ không ăn.
      {
        source: '/students/:path*',
        headers: [{key: 'Cache-Control', value: 'public, max-age=31536000, immutable'}],
      },
      {
        // Logo/icon: cache 30 ngày, sau đó dùng bản cũ trong lúc ngầm tải bản mới
        // (stale-while-revalidate) — không immutable để còn đổi được logo mà không đổi tên.
        source: '/:file(logo-viet-anh-128.webp|logo-viet-anh.jpg|icons.svg|favicon.svg)',
        headers: [
          {key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400'},
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
