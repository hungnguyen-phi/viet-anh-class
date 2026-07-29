import {SITE_URL} from '@/lib/site';

// Địa chỉ CÔNG KHAI của app cho một request cụ thể — dùng làm gốc cho mọi redirect phía server.
//
// VÌ SAO KHÔNG DÙNG THẲNG `request.url`:
// App chạy trong container Next standalone, bind vào 0.0.0.0:8080, đứng sau Coolify + Cloudflare.
// Trong tình huống đó `request.url` là địa chỉ NỘI BỘ của container. Redirect dựng từ nó ra
// "http://0.0.0.0:8080/..." — trình duyệt người dùng không bao giờ mở được. Đây đúng là lỗi
// người thử gặp sau khi bấm "Đăng nhập với Google" (ERR_ADDRESS_INVALID), và là loại lỗi CHỈ
// xuất hiện trên bản chạy thật: máy dev không có proxy nên không bao giờ thấy.
//
// VÌ SAO CŨNG KHÔNG DÙNG THẲNG SITE_URL:
// SITE_URL là domain production. Cắm cứng nó thì máy dev chạy localhost hễ bị đá về /login là
// văng thẳng sang class.vietanh.org — mất phiên, không debug được.
//
// VÌ SAO PHẢI CÓ DANH SÁCH CHO PHÉP:
// Header Host / X-Forwarded-Host do CLIENT gửi lên, có thể giả. Tin nó vô điều kiện là mở
// đường cho host-header injection: kẻ tấn công gửi `Host: evil.com` rồi dụ app phát ra redirect
// tới evil.com. Vì vậy chỉ chấp nhận đúng domain production và các địa chỉ máy cục bộ; mọi giá
// trị lạ đều rơi về SITE_URL.
export function publicOrigin(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host');
  const host = forwarded ?? request.headers.get('host');
  if (!host) return SITE_URL;

  const siteHost = new URL(SITE_URL).host;
  if (host === siteHost) {
    return SITE_URL;
  }

  // Máy cục bộ: cổng nào cũng được (6868 khi dev, 3000/3001 khi chạy thử bản build).
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }

  // Host lạ (kể cả 0.0.0.0 của chính container, hoặc header bị giả) → dùng domain đã khai.
  return SITE_URL;
}
