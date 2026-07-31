// MẪU — scripts/measure-query-waterfall.mjs chép file này ra gốc dự án thành
// `instrumentation-node.ts` lúc chạy, rồi XOÁ khi xong. Xem cảnh báo ở file mẫu kia.
//
// Việc của nó: ghi lại MỌI request đi tới Supabase kèm mốc bắt đầu/kết thúc, để phân tích được
// bao nhiêu truy vấn xếp hàng chờ nhau (waterfall) — thứ mà bấm giờ tổng không cho biết.
//
// Vì sao phải đo bằng cách này chứ không bấm giờ trang: đường truyền VPS↔Supabase dao động
// 20–100 lần giữa các lượt, nên thời gian tường không tách được "code chậm" khỏi "mạng xấu".
// Số VÒNG MẠNG XẾP HÀNG thì tất định — đo ở đâu cũng ra cùng một con số.

import {appendFileSync, mkdirSync} from 'node:fs';

const LOG = '.measure/queries.ndjson';
mkdirSync('.measure', {recursive: true});

const goc = globalThis.fetch;
const t0Chung = performance.now();

// Bọc MỎNG nhất có thể: truyền thẳng tham số gốc, trả thẳng Response gốc, KHÔNG clone, KHÔNG đọc
// body, lỗi ném lại nguyên trạng. Mọi thứ khác là cơ hội làm hỏng hành vi thật — mà chính chỗ này
// đã từng làm hỏng đăng nhập production một lần.
globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  // Chỉ ghi request tới Supabase; bỏ qua mọi thứ khác (Next tự gọi rất nhiều).
  if (!url.includes('.supabase.co')) return goc(input as RequestInfo, init);

  const method =
    init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');

  const t0 = performance.now() - t0Chung;
  try {
    const res = await goc(input as RequestInfo, init);
    ghi(url, method, t0, res.status);
    return res;
  } catch (e) {
    ghi(url, method, t0, 0);
    throw e;
  }
};

function ghi(url: string, method: string, t0: number, status: number) {
  const t1 = performance.now() - t0Chung;
  try {
    // Bỏ phần gốc URL cho gọn, giữ đường dẫn + query để biết hỏi bảng nào với điều kiện gì.
    const u = new URL(url);
    // `op` = tên gọn để đọc bảng: bảng nào, hoặc rpc nào. Bỏ tiền tố /rest/v1/ cho đỡ rối.
    const op = (u.pathname.replace(/^\/rest\/v1\//, '').replace(/^\/auth\/v1\//, 'auth:') || '?')
      .replace(/^rpc\//, 'rpc:');
    appendFileSync(
      LOG,
      JSON.stringify({
        t0,
        t1,
        dur: t1 - t0,
        ms: Math.round(t1 - t0),
        method,
        op,
        path: u.pathname + u.search,
        status,
      }) + '\n',
    );
  } catch {
    // Ghi log hỏng thì im lặng — bộ đo không được phép làm sập trang đang đo.
  }
}
