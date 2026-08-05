// Đo tốc độ màn Quản trị bằng phiên đăng nhập thật.
//
// Có file này vì "thấy chậm" không sửa được — phải biết chậm ở đâu. Nó tách ra ba con số:
//   · TTFB  — byte đầu tiên về. Đo phần máy chủ phải làm XONG trước khi mở miệng.
//   · xong  — đọc hết thân. Chênh với TTFB chính là phần được truyền dần (Suspense).
//   · /api/health — không chạm cơ sở dữ liệu, nên là mốc nền của riêng đường truyền.
//
//   node scripts/do-toc-do-admin.mjs [BASE]     mặc định https://class.vietanh.org
//
// Số đo tham chiếu (production, 2026-08-05, TRƯỚC khi tách trang thành ba mảnh):
//   /api/health                143 ms
//   /admin?size=10             TTFB 414 · xong 1379
//   /admin?vai=student&size=10 TTFB 385 · xong 1456
//   /admin?size=50             TTFB 543 · xong 1561
// Một vòng đi-về container → Supabase lúc đó: trung vị 251 ms (xem /api/diag).
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'https://class.vietanh.org';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {persistSession: false},
});
const {data: g} = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: 'test3.admin@truongvietanh.com',
});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

const trungVi = (t) => [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)];

async function do_(duong, lan = 7) {
  const ttfb = [];
  const xong = [];
  for (let i = 0; i < lan; i++) {
    const s = Date.now();
    const r = await fetch(BASE + duong, {headers: {cookie}});
    ttfb.push(Date.now() - s);
    await r.text();
    xong.push(Date.now() - s);
  }
  return {duong, ttfb: trungVi(ttfb), xong: trungVi(xong), maxXong: Math.max(...xong)};
}

console.log(BASE);
console.log('đường dẫn'.padEnd(32), 'TTFB'.padStart(6), 'xong'.padStart(7), 'chậm nhất'.padStart(11));
for (const d of [
  '/api/health',
  '/admin?size=10',
  '/admin?vai=student&size=10',
  '/admin?size=50',
  '/admin?vai=teacher&size=10',
]) {
  const k = await do_(d);
  console.log(
    k.duong.padEnd(32),
    String(k.ttfb).padStart(6),
    String(k.xong).padStart(7),
    String(k.maxXong).padStart(11),
  );
}

// /api/diag đo TỪ TRONG container ra Supabase — tách được "mạng của người đo" khỏi "mạng của máy
// chủ". Chỉ quản trị viên gọi được.
const diag = await (await fetch(BASE + '/api/diag', {headers: {cookie}})).json();
if (diag?.supabase) {
  console.log('\nTừ container ra Supabase:');
  console.log('  một vòng PostgREST (trung vị):', diag.supabase.postgrest_ms?.median, 'ms');
  console.log('  tải trung bình 1 phút:', diag.container?.load_avg_1m, '/', diag.container?.host_cpus, 'CPU');
  console.log('  CPU nhàn rỗi:', diag.container?.cpu_breakdown?.idle_pct, '%');
  const tcp = diag.network?.tcp;
  if (tcp) {
    const ti = ((tcp.retrans_segs / tcp.out_segs) * 100).toFixed(1);
    console.log(`  gói TCP phải gửi lại: ${tcp.retrans_segs}/${tcp.out_segs} = ${ti}%`);
  }
}
