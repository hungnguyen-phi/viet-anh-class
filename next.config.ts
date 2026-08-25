import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Gói build tự chứa (server.js + deps đã tree-shake) cho deploy container — image gọn ~1/5.
  // An toàn vì app KHÔNG đọc file runtime qua process.cwd()/fs; message next-intl nạp bằng
  // dynamic import nên được Next tracer gói sẵn vào standalone.
  output: 'standalone',
  // undici KHÔNG được đem vào bundle (xem instrumentation.ts — nó chỉnh bộ giữ kết nối tới
  // Supabase). Webpack cố gói thì vỡ ngay lúc build: undici nạp 'node:console', 'node:crypto'…
  // bằng scheme node: mà loader không xử lý. Khai external là Next để nguyên lời gọi require lúc
  // chạy, và bộ tracer của standalone tự chép thư viện vào node_modules của bản gói.
  serverExternalPackages: ['undici'],
  // ĐỨNG SẴN Ở ĐÓ TRƯỚC KHI NGƯỜI TA TỚI (16/08/2026).
  //
  // Mọi trang sau đăng nhập là force-dynamic, và Next mặc định staleTimes.dynamic = 0: thứ vừa
  // tải trước KHÔNG được dùng lại cho cú bấm thật — nên prefetch từng bị tắt cả app vì chỉ tốn
  // công máy chủ. Nay cho trang dynamic sống 30 giây trong bộ nhớ đệm phía trình duyệt: thanh
  // menu tải trước từng tab sau khi trang hiện xong (components/shell/NapTruoc.tsx), và cú bấm
  // trong 30 giây kế là hiện NGAY, không phải chờ đường truyền một lần nữa. Server action nào gọi
  // revalidatePath vẫn xoá đệm như thường, nên việc mình vừa làm không bao giờ hiện bản cũ.
  // 30 giây, không hơn: dữ liệu ở đây là tick của em, cam kết vừa duyệt — để lâu là nói dối.
  experimental: {staleTimes: {dynamic: 30, static: 300}},
  // DẤU PHIÊN BẢN BẢN BUILD — chữa lỗi "Ứng dụng gặp sự cố" sau mỗi lần deploy.
  //
  // Không có nó thì mỗi lần đẩy bản mới, MỌI TAB ĐANG MỞ đều hỏng: trình duyệt giữ mã của bản cũ,
  // còn máy chủ đã là bản mới, nên bấm bất cứ nút nào chạy server action là văng ra màn hình lỗi
  // toàn trang. Chủ dự án gặp đúng cảnh này khi bấm Đăng xuất 19 phút sau một lần deploy — và với
  // nhịp deploy nhiều lần một ngày thì đây không phải chuyện hiếm.
  //
  // Đặt deploymentId là Next gắn dấu bản build vào mọi request tài nguyên và mọi server action;
  // khi phát hiện lệch bản, nó tự tải lại trang thay vì ném lỗi.
  // Dùng luôn NEXT_PUBLIC_GIT_SHA — biến đã có sẵn trong Dockerfile và CI, mỗi commit một giá trị.
  deploymentId: process.env.NEXT_PUBLIC_GIT_SHA,
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
      // ---- NHÚNG VÀO HUB (school Super App hub.truongvietanh.com, mục 3 bản đấu nối) ----
      //
      // TƯỞNG BAN ĐẦU LÀ SAI, SỬA LẠI SAU KHI ĐO (25/08/2026): bản đầu định LOẠI /login khỏi diện
      // được nhúng — tưởng "màn đăng nhập của app không bao giờ nên bị nhúng". Nhưng đọc lại đúng
      // luồng ở mục 3.2: Hub nhúng một URL TRẦN, và với người CHƯA có phiên, đường dẫn đó tự
      // redirect vào ĐÚNG /login — HubEmbedGate.tsx (mount trên trang /login) mới là nơi bắt tay
      // lấy danh tính. Loại /login khỏi diện nhúng nghĩa là trình duyệt chặn hẳn không vẽ trang đó
      // trong khung Hub — bắt tay không bao giờ chạy được, tính năng nhúng coi như chết ngay từ
      // bước đầu. Vẫn AN TOÀN vì `frame-ancestors` chỉ cho phép ĐÚNG origin của Hub, không phải
      // "ai cũng nhúng được" — /login vẫn không nhúng được bởi trang nào khác ngoài Hub.
      //
      // Nên: áp CSP enforced cho TẤT CẢ đường dẫn (trừ /api — không phải HTML, không cần khai).
      // `X-Frame-Options: DENY` ở block trên vẫn giữ nguyên, không gỡ: trình duyệt hiện đại (mọi
      // trình duyệt trường dùng) ưu tiên CSP `frame-ancestors` hơn `X-Frame-Options` khi cả hai
      // cùng có mặt — đây là hành vi chuẩn hoá (CSP2 cố ý "obsolete" X-Frame-Options cho việc
      // này), không phải suy đoán. Chưa cấu hình NEXT_PUBLIC_HUB_ORIGIN thì rơi về 'none' — không
      // đổi hành vi hiện tại một chút nào cho tới khi biến này thật sự được đặt.
      {
        source: '/:path((?!api).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${process.env.NEXT_PUBLIC_HUB_ORIGIN || "'none'"}`,
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
