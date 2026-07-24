import type {ReadonlyHeaders} from 'next/dist/server/web/spec-extension/adapters/headers';

// Lấy IP công cộng thật của client từ header (server-side, không tin dữ liệu client gửi qua body).
// Thứ tự ưu tiên theo hạ tầng phổ biến (Vercel/proxy): x-forwarded-for (IP đầu = client thật).
export function clientIp(h: ReadonlyHeaders): string | null {
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = h.get('x-real-ip') ?? h.get('x-vercel-forwarded-for');
  return real ? normalizeIp(real.trim()) : null;
}

// Bỏ tiền tố IPv4-mapped-IPv6 (::ffff:1.2.3.4 → 1.2.3.4) để khớp CIDR IPv4.
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
