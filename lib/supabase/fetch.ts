import {Agent, fetch as undiciFetch} from 'undici';
import {promises as dnsPromises} from 'node:dns';

// Bộ `fetch` riêng cho mọi lời gọi Supabase TỪ SERVER — giữ kết nối sống lâu + nhớ kết quả DNS.
//
// VÌ SAO PHẢI LÀM (đo được, không phải phòng xa):
// Đường truyền của VPS đang mất ~5.19% gói TCP (bình thường <0.1%). Card mạng của máy không rơi
// gói nào nên chỗ mất nằm ngoài, phía nhà cung cấp — code không chữa được cái đó.
//
// Nhưng mất gói KHÔNG gây hại đều nhau ở mọi lúc:
//   - Lúc BẮT TAY (SYN, TLS hello): chỉ có một gói đang bay, TCP không có gì để suy ra là gói đã
//     mất, nên phải chờ hết thời gian chờ — hàng trăm ms tới 1 giây. Đây là chỗ đau nhất, và đúng
//     là chỗ đo được 8ms → 2299ms.
//   - Trên kết nối ĐÃ MỞ: có luồng gói liên tục, mất một gói thì bên kia báo ngay và vá trong
//     khoảng một vòng đi-về (vài chục ms).
// Node mặc định đóng kết nối sau 4 GIÂY không dùng. Với một app trường học (thao tác thưa, cách
// nhau vài giây tới vài phút) thì gần như mỗi lần bấm lại phải bắt tay từ đầu — tức lần nào cũng
// phơi ra đúng chỗ nhạy cảm nhất. Giữ kết nối 10 phút thì cả một phiên làm việc chỉ bắt tay một lần.
//
// LƯU Ý KỸ THUẬT: `setGlobalDispatcher` của gói undici KHÔNG ảnh hưởng tới `globalThis.fetch`
// (fetch của Node dùng bản undici nhúng sẵn bên trong, là một thực thể khác). Vì vậy phải truyền
// hàm fetch này vào thẳng client Supabase qua `global.fetch` thì mới có tác dụng.
//
// CHỈ DÙNG Ở PHÍA SERVER (Node runtime). Không import vào middleware — middleware chạy ở Edge
// runtime, không có `node:dns` lẫn undici.

// Nhớ kết quả DNS trong 5 phút.
// Lý do: `dns.lookup` không tự nhớ, mỗi lần lại hỏi lại resolver — mà chính chặng này đo được
// 3ms lúc tốt, 1508ms lúc xấu. Tên miền Supabase thì cố định, hỏi lại liên tục là vô ích.
type CacheEntry = {address: string; family: number; at: number};
const DNS_TTL_MS = 5 * 60_000;
const dnsCache = new Map<string, CacheEntry>();

// Chữ ký callback của dns.lookup: khi lỗi thì address/family không có, nên phải cho phép
// truyền thiếu — kiểu LookupFunction của Node không mô tả nhánh lỗi nên phải ép ở chỗ dùng.
type LookupCb = (err: NodeJS.ErrnoException | null, address: string, family: number) => void;

function cachedLookup(hostname: string, _options: unknown, cb: LookupCb): void {
  const hit = dnsCache.get(hostname);
  if (hit && Date.now() - hit.at < DNS_TTL_MS) {
    cb(null, hit.address, hit.family);
    return;
  }
  dnsPromises
    .lookup(hostname)
    .then((r) => {
      dnsCache.set(hostname, {address: r.address, family: r.family, at: Date.now()});
      cb(null, r.address, r.family);
    })
    .catch((err) => {
      // Tra hỏng mà còn bản cũ thì dùng tạm — thà nối tới địa chỉ cũ (Supabase hiếm khi đổi IP)
      // còn hơn để cả trang chết vì một lần DNS trục trặc.
      if (hit) cb(null, hit.address, hit.family);
      else (cb as (e: NodeJS.ErrnoException) => void)(err as NodeJS.ErrnoException);
    });
}

const agent = new Agent({
  // Giữ kết nối rảnh 10 phút thay vì 4 giây mặc định.
  keepAliveTimeout: 600_000,
  keepAliveMaxTimeout: 600_000,
  // Đủ cho vài chục truy vấn song song của một trang mà không mở tràn lan.
  connections: 64,
  connect: {lookup: cachedLookup as never},
});

// Chữ ký khớp `fetch` chuẩn để truyền thẳng vào `global.fetch` của client Supabase.
// Phải ép kiểu: undici và lib.dom khai báo Response/Headers riêng, cùng hình dạng lúc chạy nhưng
// TypeScript coi là hai kiểu khác nhau.
export const supabaseFetch = ((input: unknown, init: unknown) =>
  undiciFetch(input as never, {
    ...(init as Record<string, unknown>),
    dispatcher: agent,
  } as never)) as unknown as typeof globalThis.fetch;
