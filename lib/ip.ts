import type {ReadonlyHeaders} from 'next/dist/server/web/spec-extension/adapters/headers';

// Lấy IP công cộng THẬT của người dùng từ header (server-side, không tin dữ liệu client gửi lên).
//
// VÌ SAO PHẢI ƯU TIÊN cf-connecting-ip:
// App chạy sau Cloudflare (proxy BẬT). Cloudflare tự ghi ĐÈ x-forwarded-for bằng chuỗi của nó,
// và tuỳ chặng còn có thêm proxy của Coolify nối tiếp phía sau — nên phần tử đầu của
// x-forwarded-for KHÔNG chắc là người dùng. Bằng chứng thật: bảng school_networks của trường
// đang lưu 162.158.163.250 và 104.23.175.175 — cả hai đều là IP của CHÍNH CLOUDFLARE, không
// phải IP đường truyền của trường. Hệ quả: cổng IP check-in vừa chặn nhầm học sinh ở trường,
// vừa có thể cho qua bất kỳ ai đi qua cùng một edge Cloudflare.
//
// cf-connecting-ip do Cloudflare tự đặt và không thể bị client giả (Cloudflare ghi đè mọi giá
// trị người dùng tự gửi lên), nên đây là nguồn đáng tin nhất khi đứng sau Cloudflare.
export function clientIp(h: ReadonlyHeaders): string | null {
  // ── CHỐT CHỐNG GIẢ IP (audit 18/08/2026) ─────────────────────────────────────────────────────
  // Nếu cổng origin (IP VPS) còn truy cập được TRỰC TIẾP (không qua Cloudflare), kẻ tấn công tự
  // đặt header cf-connecting-ip: một IP trong dải trường rồi gọi thẳng — cổng IP check-in tin
  // ngay, giả được "đang ở trường". Vá bằng BÍ MẬT DÙNG CHUNG: đặt env CF_PROXY_SECRET, rồi tạo
  // một Transform Rule ở Cloudflare thêm header `x-cf-verify: <cùng bí mật>` cho mọi request qua
  // proxy. Client bên ngoài không biết bí mật nên không giả được. Khi CF_PROXY_SECRET CHƯA đặt
  // (trạng thái hiện tại — cổng IP cũng chưa bật dải nào), hành vi giữ nguyên như cũ để không
  // gãy gì; bật cả hai cùng lúc khi trường bắt đầu dùng cổng IP thật. Xem DEPLOY.md.
  const secret = process.env.CF_PROXY_SECRET;
  const quaCloudflareThat = !secret || h.get('x-cf-verify') === secret;

  // 1) Cloudflare — chính xác nhất trong hạ tầng hiện tại. Chỉ tin khi request thật sự qua CF.
  if (quaCloudflareThat) {
    const cf = h.get('cf-connecting-ip') ?? h.get('true-client-ip');
    if (cf) return normalizeIp(cf.trim());
  }

  // 2) Proxy khác: phần tử ĐẦU của x-forwarded-for là client (các proxy nối thêm về sau).
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }

  // 3) Hạ tầng cũ / chạy local.
  const real = h.get('x-real-ip') ?? h.get('x-vercel-forwarded-for');
  return real ? normalizeIp(real.trim()) : null;
}

// Bỏ tiền tố IPv4-mapped-IPv6 (::ffff:1.2.3.4 → 1.2.3.4) để khớp CIDR IPv4.
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
