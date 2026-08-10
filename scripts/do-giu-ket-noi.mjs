// GIỮ KẾT NỐI TỚI SUPABASE CÓ ĐÁNG KHÔNG — đo, đừng đoán.
//
// Audit 10/08/2026 tìm ra: máy chủ và Supabase cùng ở Singapore, bắt tay TCP chỉ 11ms, câu SQL
// chạy 0.8–9.6ms, vậy mà MỘT vòng gọi REST tốn tới 225ms. Phần chênh nằm ở bắt tay lại từ đầu:
// undici (bộ fetch của Node) mặc định đóng kết nối rảnh sau 4 GIÂY. Một trường học không có
// lượt truy cập mỗi bốn giây, nên gần như lượt nào cũng phải TLS lại — và trên đường có 1.77%
// gói phải gửi lại thì chính lúc bắt tay là lúc đắt nhất.
//
// Đo HAI cảnh, vì một trang thật gặp cả hai:
//   1. RỜI RẠC  — vài lượt cách nhau hơn 4 giây (người dùng bấm sang tab khác sau một lúc).
//   2. BẮN LOẠT — 8 truy vấn song song cùng lúc (đúng cái Promise.all mà mỗi trang đang làm).
//      Cảnh này mới là cảnh đắt: mỗi kết nối song song là MỘT lần bắt tay TLS riêng, trừ khi
//      dùng HTTP/2 — khi đó tám truy vấn đi chung một kết nối.
//
//   node scripts/do-giu-ket-noi.mjs            (mặc định: 5 lượt rời rạc giãn 5s, loạt 8)
//   node scripts/do-giu-ket-noi.mjs 5 5000 8
import {readFileSync} from 'node:fs';

const SO_LUOT = Number(process.argv[2] ?? 5);
const GIAN_CACH_MS = Number(process.argv[3] ?? 5000);
const SO_SONG_SONG = Number(process.argv[4] ?? 8);

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

// Câu nhẹ nhất có thể: đọc đúng một dòng, một cột. Mọi mili-giây đo được là chi phí ĐƯỜNG
// TRUYỀN chứ không phải chi phí tính toán — đó mới là thứ cần đo.
const DIA_CHI = `${URL_}/rest/v1/profiles?select=role&limit=1`;
const HEADER = {apikey: KEY, authorization: `Bearer ${KEY}`};

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const tb = (a) => a.reduce((x, y) => x + y, 0) / a.length;

async function motLuot() {
  const t = process.hrtime.bigint();
  const res = await fetch(DIA_CHI, {headers: HEADER, cache: 'no-store'});
  await res.arrayBuffer();
  return Number(process.hrtime.bigint() - t) / 1e6;
}

async function roiRac() {
  const so = [];
  for (let i = 0; i < SO_LUOT; i++) {
    if (i > 0) await ngu(GIAN_CACH_MS);
    so.push(await motLuot());
  }
  return so.slice(1); // bỏ lượt đầu: lượt nào cũng phải mở kết nối lần đầu
}

async function banLoat() {
  await ngu(GIAN_CACH_MS); // để kết nối nguội đúng như khi người dùng vừa mở một trang mới
  const t = process.hrtime.bigint();
  await Promise.all(Array.from({length: SO_SONG_SONG}, () => motLuot()));
  return Number(process.hrtime.bigint() - t) / 1e6;
}

async function doCheDo(ten) {
  const rr = await roiRac();
  const loat = await banLoat();
  console.log(
    `${ten.padEnd(26)} rời rạc: ${rr.map((x) => x.toFixed(0)).join(', ').padEnd(30)} tb ${tb(rr).toFixed(0).padStart(4)}ms  |  loạt ${SO_SONG_SONG} song song: ${loat.toFixed(0)}ms`,
  );
  return {roiRac: tb(rr), loat};
}

console.log(
  `Supabase: ${new URL(URL_).host}\n${SO_LUOT} lượt rời rạc giãn ${GIAN_CACH_MS / 1000}s (dài hơn hạn 4s mặc định), rồi một loạt ${SO_SONG_SONG} truy vấn song song\n`,
);

const ketQua = {};
ketQua.macDinh = await doCheDo('Mặc định (đóng sau 4s)');

const {Agent, setGlobalDispatcher} = await import('undici');

setGlobalDispatcher(new Agent({keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000, connections: 64}));
ketQua.giuH1 = await doCheDo('Giữ 60s (HTTP/1.1)');

setGlobalDispatcher(
  new Agent({keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000, connections: 64, allowH2: true}),
);
ketQua.giuH2 = await doCheDo('Giữ 60s + HTTP/2');

const d = (a, b) => `${(a - b).toFixed(0)}ms (${(((a - b) / a) * 100).toFixed(0)}%)`;
console.log(`
So với mặc định:
  giữ kết nối HTTP/1.1 — mỗi vòng gọi rời rạc nhanh hơn ${d(ketQua.macDinh.roiRac, ketQua.giuH1.roiRac)}, loạt ${SO_SONG_SONG} nhanh hơn ${d(ketQua.macDinh.loat, ketQua.giuH1.loat)}
  giữ kết nối HTTP/2   — mỗi vòng gọi rời rạc nhanh hơn ${d(ketQua.macDinh.roiRac, ketQua.giuH2.roiRac)}, loạt ${SO_SONG_SONG} nhanh hơn ${d(ketQua.macDinh.loat, ketQua.giuH2.loat)}`);
