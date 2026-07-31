// Đo thời gian MÁY CHỦ dựng xong mỗi trang, tách khỏi thời gian đường truyền.
//
// Vì sao cần: người dùng chỉ thấy "chậm" và không tách được hai nguyên nhân — máy chủ dựng trang
// lâu (lỗi code) hay gói tin đi lại lâu (lỗi đường truyền). Bộ này đo cả hai:
//   • ttfb  = từ lúc gửi request tới byte đầu tiên = ĐƯỜNG TRUYỀN + MÁY CHỦ DỰNG TRANG
//   • base  = ttfb của /api/health, một route gần như không làm gì
//   • dung  = ttfb - base ≈ RIÊNG phần máy chủ dựng trang. Đây mới là phần code phải chịu.
// Chạy nhiều lượt rồi lấy TRUNG VỊ, vì đường truyền dao động mạnh — trung bình bị một lượt xấu
// kéo lệch, trung vị thì không.
//
//   node scripts/measure-pages.mjs [https://class.vietanh.org] [số-lượt]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6880';
const LUOT = Number(process.argv[3] ?? 5);

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

async function ck(email) {
  const {data: g, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(email + ': ' + error.message);
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: g.properties.hashed_token,
  });
  if (e2) throw new Error(email + ': ' + e2.message);
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

// TTFB thật: đọc CHUNK ĐẦU TIÊN của thân phản hồi rồi mới bấm giờ. Nếu chỉ await fetch() thì với
// Next App Router (stream) con số nhận được là lúc header về, chưa phản ánh việc dựng trang.
async function ttfb(url, cookie) {
  const t0 = performance.now();
  const r = await fetch(url, {headers: cookie ? {cookie} : {}, redirect: 'manual'});
  const reader = r.body?.getReader();
  if (reader) {
    await reader.read();
    await reader.cancel();
  }
  return {ms: performance.now() - t0, status: r.status};
}

const trungVi = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const TRANG = [
  ['teacher', '/'],
  ['teacher', '/roster'],
  ['teacher', '/attendance'],
  ['teacher', '/wig'],
  ['teacher', '/scoreboard'],
  ['teacher', '/timetable'],
  ['teacher', '/homework'],
  ['teacher', '/grades'],
  ['teacher', '/inbox'],
  ['teacher', '/gallery'],
  ['admin', '/admin'],
  ['admin', '/subjects'],
  ['admin', '/menu'],
  ['principal', '/campus'],
  ['parent', '/report'],
  ['student', '/student'],
];

const TK = {
  teacher: 'test1.gvcn@truongvietanh.com',
  admin: 'test3.admin@truongvietanh.com',
  principal: 'test2.bgh@truongvietanh.com',
  parent: 'test1.ph@truongvietanh.com',
  student: 'test1.hs@student.truongvietanh.com',
};

const cookies = {};
for (const v of new Set(TRANG.map((t) => t[0]))) cookies[v] = await ck(TK[v]);

// Mốc nền: route gần như không làm gì. Mọi con số dưới trừ đi mốc này ra phần code phải chịu.
const nen = [];
for (let i = 0; i < LUOT; i++) nen.push((await ttfb(BASE + '/api/health')).ms);
const BASE_MS = trungVi(nen);

console.log(`Đo ${BASE}  ·  ${LUOT} lượt/trang  ·  lấy TRUNG VỊ`);
console.log(`Mốc nền (/api/health): ${Math.round(BASE_MS)} ms — đây là phần đường truyền, không phải code.\n`);
console.log('trang'.padEnd(13) + 'ttfb'.padStart(8) + 'riêng-code'.padStart(12) + '  đánh giá');
console.log('─'.repeat(52));

const bang = [];
for (const [vai, href] of TRANG) {
  // Một lượt làm nóng, không tính: lượt đầu ở dev phải biên dịch, ở production phải nạp cache.
  await ttfb(BASE + href, cookies[vai]);
  const ds = [];
  let st = 0;
  for (let i = 0; i < LUOT; i++) {
    const r = await ttfb(BASE + href, cookies[vai]);
    ds.push(r.ms);
    st = r.status;
  }
  const tv = trungVi(ds);
  const rieng = Math.max(0, tv - BASE_MS);
  bang.push({href, tv, rieng, st});
  const danh = rieng > 1500 ? '⚠⚠ rất chậm' : rieng > 700 ? '⚠ chậm' : '';
  console.log(
    href.padEnd(13) + `${Math.round(tv)}`.padStart(8) + `${Math.round(rieng)}`.padStart(12) + '  ' + danh,
  );
}

const xau = bang.filter((b) => b.rieng > 700).sort((a, b) => b.rieng - a.rieng);
console.log('\n' + '─'.repeat(52));
if (xau.length === 0) {
  console.log('Không trang nào tốn quá 700 ms riêng phần dựng trang.');
} else {
  console.log(`${xau.length} trang tốn quá 700 ms riêng phần dựng trang, nặng nhất trước:`);
  for (const b of xau) console.log(`  ${b.href.padEnd(13)} ${Math.round(b.rieng)} ms`);
}
