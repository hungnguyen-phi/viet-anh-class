// GỬI KÈM BẢN DỰ PHÒNG — kiểm bằng một máy chủ giả, không đụng mạng thật.
//
// Vì sao phải có: lib/gui-kem-du-phong.ts bọc `fetch` của MỌI truy vấn Supabase phía máy chủ.
// Sai một nhịp trong đám async ấy thì hoặc trang trắng, hoặc — tệ hơn nhiều — một câu GHI bị gửi
// hai lần và một em điểm danh thành hai dòng. Bốn điều dưới đây phải đúng, và phải đúng cả khi
// người sau vào dọn mã:
//
//   1. Trả lời nhanh  → chỉ MỘT lượt gọi đi ra (không tốn thêm gì cho 9/10 trường hợp).
//   2. Trả lời chậm   → có bản dự phòng, và lấy đúng nội dung của bản về trước.
//   3. KHÔNG PHẢI GET → tuyệt đối không nhân bản, dù chậm tới đâu.
//   4. Cả hai cùng hỏng → ném lỗi thật ra ngoài, không nuốt.
//
//   node --experimental-strip-types scripts/test-gui-kem-du-phong.mjs
import {createServer} from 'node:http';
import {fetchKemDuPhong} from '../lib/gui-kem-du-phong.ts';

const ketQua = [];
const kiem = (ten, dat, chiTiet = '') =>
  ketQua.push({ten, dat, chiTiet});

// Máy chủ giả: /nhanh trả ngay, /cham trả sau 400ms, /hong đóng phựt.
let demTheoDuong = {};
const server = createServer((req, res) => {
  demTheoDuong[req.url] = (demTheoDuong[req.url] ?? 0) + 1;
  const lan = demTheoDuong[req.url];
  if (req.url.startsWith('/hong')) {
    res.destroy();
    return;
  }
  const cham = req.url.startsWith('/cham');
  // Bản dự phòng (lượt thứ 2) trả NGAY để mô phỏng "đi đường khác, không dính gói vừa rơi".
  const doTre = cham && lan === 1 ? 400 : 0;
  setTimeout(() => {
    res.writeHead(200, {'content-type': 'text/plain'});
    res.end(`lan-${lan}`);
  }, doTre);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const goc = `http://127.0.0.1:${server.address().port}`;

// ── 1. Nhanh: đúng một lượt ────────────────────────────────────────────────────────────────
demTheoDuong = {};
const r1 = await fetchKemDuPhong(`${goc}/nhanh`);
const t1 = await r1.text();
await new Promise((r) => setTimeout(r, 300)); // đợi qua ngưỡng để chắc chắn không có bản thứ hai
kiem(
  'Trả lời nhanh thì KHÔNG bắn bản dự phòng',
  demTheoDuong['/nhanh'] === 1 && t1 === 'lan-1',
  `số lượt=${demTheoDuong['/nhanh']}, nội dung=${t1}`,
);

// ── 2. Chậm: có bản dự phòng, và lấy bản về trước ──────────────────────────────────────────
demTheoDuong = {};
const batDau = Date.now();
const r2 = await fetchKemDuPhong(`${goc}/cham`);
const t2 = await r2.text();
const mat = Date.now() - batDau;
kiem(
  'Trả lời chậm thì bắn bản dự phòng và lấy bản về trước',
  demTheoDuong['/cham'] === 2 && t2 === 'lan-2' && mat < 350,
  `số lượt=${demTheoDuong['/cham']}, nội dung=${t2}, mất ${mat}ms (bản chính 400ms)`,
);

// ── 3. Câu GHI: tuyệt đối không nhân bản ───────────────────────────────────────────────────
demTheoDuong = {};
const r3 = await fetchKemDuPhong(`${goc}/cham`, {method: 'POST', body: 'x'});
await r3.text();
kiem(
  'POST (câu ghi) KHÔNG BAO GIỜ được nhân bản',
  demTheoDuong['/cham'] === 1,
  `số lượt=${demTheoDuong['/cham']} — nếu là 2 thì một lượt điểm danh sẽ thành hai dòng`,
);

// ── 4. Hỏng cả hai: ném lỗi thật ───────────────────────────────────────────────────────────
let daNem = null;
try {
  await fetchKemDuPhong(`${goc}/hong`);
} catch (e) {
  daNem = e;
}
kiem('Cả hai bản đều hỏng thì ném lỗi ra ngoài', daNem !== null, daNem ? String(daNem.message ?? daNem).slice(0, 60) : 'KHÔNG ném');

// ── 5. Người gọi tự cầm tín hiệu huỷ thì đứng ngoài ────────────────────────────────────────
demTheoDuong = {};
const bo = new AbortController();
const r5 = await fetchKemDuPhong(`${goc}/cham`, {signal: bo.signal});
await r5.text();
kiem(
  'Có signal của người gọi thì không xen vào',
  demTheoDuong['/cham'] === 1,
  `số lượt=${demTheoDuong['/cham']}`,
);

server.close();

for (const r of ketQua) {
  console.log(`${r.dat ? 'OK  ' : 'SAI '} ${r.ten}${r.dat ? '' : `  → ${r.chiTiet}`}`);
}
const dat = ketQua.filter((r) => r.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
