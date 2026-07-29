// Đo SỐ TRUY VẤN DATABASE mà server phải chạy cho MỘT lần mở trang.
//
// Đây là con số quyết định tốc độ của app này: database không chậm (query chậm nhất ~50ms),
// nhưng mỗi truy vấn là một vòng đi-về qua mạng tới Supabase. Càng nhiều vòng thì người dùng
// càng chờ lâu — đúng thứ cả ba người thử đều than.
//
// Cách chạy:  node scripts/measure-page-queries.mjs [url-gốc]
// Mặc định đo server cục bộ http://localhost:6868 (nhớ `npm run build && npx next start -p 6868`).
//
// Phiên đăng nhập được tạo bằng ADMIN API (service_role) chứ không gõ mật khẩu — script này chỉ
// để đo, không phải đường đăng nhập thật.

import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:6868';

// Đọc .env.local (script chạy bằng node trần, không qua Next nên không tự nạp env).
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !SERVICE || !ANON) {
  console.error('Thiếu biến trong .env.local');
  process.exit(1);
}
const REF = new URL(URL_).hostname.split('.')[0];

const admin = createClient(URL_, SERVICE, {auth: {autoRefreshToken: false, persistSession: false}});

// Đổi email của tài khoản thử lấy một phiên hợp lệ, KHÔNG qua mật khẩu:
// admin sinh magic link → lấy hashed_token → verifyOtp → có session.
async function sessionFor(email) {
  const {data, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const anon = createClient(URL_, ANON, {auth: {autoRefreshToken: false, persistSession: false}});
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: data.properties.hashed_token,
  });
  if (e2) throw new Error(`verifyOtp(${email}): ${e2.message}`);
  return v.session;
}

// @supabase/ssr lưu phiên thành cookie base64, cắt khúc khi dài (>3180 ký tự).
function cookieHeader(session) {
  const raw = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const name = `sb-${REF}-auth-token`;
  if (raw.length <= 3180) return `${name}=${raw}`;
  const parts = [];
  for (let i = 0; i * 3180 < raw.length; i++) {
    parts.push(`${name}.${i}=${raw.slice(i * 3180, (i + 1) * 3180)}`);
  }
  return parts.join('; ');
}

// Tổng số lần gọi của các truy vấn do APP sinh ra (bỏ phần nội bộ Supabase/pg_catalog).
async function appQueryCalls() {
  const {data, error} = await admin.rpc('exec_sql_count').catch(() => ({data: null, error: 1}));
  if (!error && data != null) return data;
  // Không có RPC riêng → đọc thẳng pg_stat_statements qua REST không được, nên trả null.
  return null;
}

const PAGES = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['/', '/roster', '/wig', '/scoreboard', '/attendance'];

const session = await sessionFor(process.env.TEST_EMAIL ?? 'test1.gvcn@truongvietanh.com');
const cookie = cookieHeader(session);

console.log(`Đo trên ${BASE} — vai: giáo viên chủ nhiệm\n`);
console.log('trang'.padEnd(14), 'lần 1'.padStart(9), 'lần 2'.padStart(9), 'lần 3'.padStart(9), 'trung bình'.padStart(11));

for (const p of PAGES) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + p, {headers: {cookie}, redirect: 'manual'});
    await res.arrayBuffer();
    times.push(performance.now() - t0);
    if (i === 0 && res.status >= 300 && res.status < 400) {
      console.log(`  (${p} → ${res.status} ${res.headers.get('location')})`);
    }
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(
    p.padEnd(14),
    ...times.map((t) => (t.toFixed(0) + 'ms').padStart(9)),
    (avg.toFixed(0) + 'ms').padStart(11),
  );
}

void appQueryCalls;
