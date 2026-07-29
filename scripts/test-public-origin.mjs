// Kiểm publicOrigin() — hàm quyết định địa chỉ gốc cho MỌI redirect phía server.
// Chạy: node scripts/test-public-origin.mjs
//
// Vì sao phải có test cho một hàm 15 dòng: chính chỗ này đã gây ra lỗi người thử gặp thật
// ("Hmmm… can't reach this page — 0.0.0.0:8080" sau khi đăng nhập Google), và nếu làm ẩu theo
// hướng ngược lại thì mở luôn lỗ host-header injection. Hai phía đều không lộ ra khi bấm tay
// trên máy dev, nên phải kiểm bằng test.

const SITE_URL = 'https://class.vietanh.org';

// Bản sao logic của lib/public-origin.ts (file .ts không import thẳng vào node được).
// Nếu sửa file kia thì sửa cả đây — test sẽ vô nghĩa nếu hai bên lệch nhau.
function publicOrigin(headers) {
  const get = (k) => headers[k.toLowerCase()] ?? null;
  const host = get('x-forwarded-host') ?? get('host');
  if (!host) return SITE_URL;
  const siteHost = new URL(SITE_URL).host;
  if (host === siteHost) return SITE_URL;
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const proto = get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }
  return SITE_URL;
}

const cases = [
  // [tên, headers, kỳ vọng]
  ['production qua Cloudflare/Coolify', {'x-forwarded-host': 'class.vietanh.org', 'x-forwarded-proto': 'https'}, 'https://class.vietanh.org'],
  ['production chỉ có Host', {host: 'class.vietanh.org'}, 'https://class.vietanh.org'],

  // ĐÂY LÀ LỖI THẬT ĐÃ GẶP: container bind 0.0.0.0:8080 lọt vào Host.
  ['Host là địa chỉ bind của container', {host: '0.0.0.0:8080'}, 'https://class.vietanh.org'],
  ['Host là 0.0.0.0 không cổng', {host: '0.0.0.0'}, 'https://class.vietanh.org'],

  // Dev cục bộ phải ở lại localhost, không được văng sang production.
  ['dev localhost:6868', {host: 'localhost:6868'}, 'http://localhost:6868'],
  ['dev 127.0.0.1:3000', {host: '127.0.0.1:3000'}, 'http://127.0.0.1:3000'],
  ['dev localhost sau proxy https', {host: 'localhost:3000', 'x-forwarded-proto': 'https'}, 'https://localhost:3000'],

  // HOST-HEADER INJECTION: header do client gửi, giả được → tuyệt đối không tin.
  ['giả Host = evil.com', {host: 'evil.com'}, 'https://class.vietanh.org'],
  ['giả X-Forwarded-Host = evil.com', {'x-forwarded-host': 'evil.com', host: 'class.vietanh.org'}, 'https://class.vietanh.org'],
  ['giả domain lồng class.vietanh.org.evil.net', {host: 'class.vietanh.org.evil.net'}, 'https://class.vietanh.org'],
  ['giả subdomain evil.class.vietanh.org', {host: 'evil.class.vietanh.org'}, 'https://class.vietanh.org'],
  ['giả localhost.evil.net', {host: 'localhost.evil.net'}, 'https://class.vietanh.org'],

  // Không có header nào.
  ['không có Host', {}, 'https://class.vietanh.org'],
];

let failed = 0;
for (const [name, headers, want] of cases) {
  const got = publicOrigin(headers);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      want ${want}\n      got  ${got}`);
}

console.log(`\n${cases.length - failed}/${cases.length} đạt`);
process.exit(failed === 0 ? 0 : 1);
