// ĐO CẢM GIÁC CHUYỂN TAB — bằng trình duyệt thật, phiên GVCN thật.
//
//   node scripts/do-chuyen-tab.mjs [https://class.truongvietanh.com] [giây chờ trước khi bấm=8]
//
// Mở /wig, đợi N giây (để lớp nạp trước — NapTruoc — kịp chạy hoặc không), rồi bấm lần lượt các
// tab trên thanh menu và đo từ lúc bấm tới lúc <h1> của trang mới hiện ra. Đây là con số người
// dùng cảm thấy, không phải TTFB của máy chủ. Chạy với 0 giây chờ để thấy cảnh "chưa nạp trước".
import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'https://class.truongvietanh.com';
const CHO = Number(process.argv[3] ?? 8);
const U = new URL(BASE);
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

const {data: lop} = await admin.from('classes').select('id, homeroom_teacher_id').eq('name', 'Test').maybeSingle();
const {data: gv} = await admin.from('profiles').select('email').eq('id', lop.homeroom_teacher_id).maybeSingle();
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const ve = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSo = mkdtempSync(path.join(tmpdir(), 'va-tab-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSo}`,
  '--no-first-run', '--disable-gpu', '--window-size=1400,900', 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
  try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'}); else process.kill(proc.pid); } catch {}
  try { rmSync(hoSo, {recursive: true, force: true}); } catch {}
});
let san = false;
for (let i = 0; i < 40 && !san; i++) {
  try { san = (await fetch(`http://127.0.0.1:${CONG}/json/version`)).ok; } catch { await new Promise((r) => setTimeout(r, 500)); }
}
const tab = await (await fetch(`http://127.0.0.1:${CONG}/json/new?about:blank`, {method: 'PUT'})).json();
const sock = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const cho = new Map();
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cho.has(m.id)) { const {ok, ng} = cho.get(m.id); cho.delete(m.id); m.error ? ng(new Error(m.error.message)) : ok(m.result); }
});
const goi = (method, params = {}) => new Promise((ok, ng) => {
  const i = ++id; cho.set(i, {ok, ng}); sock.send(JSON.stringify({id: i, method, params}));
});
await new Promise((o) => sock.addEventListener('open', o));
await goi('Page.enable'); await goi('Runtime.enable'); await goi('Network.enable');
await goi('Network.setExtraHTTPHeaders', {headers: {'Accept-Language': 'vi'}});
const TEN = `sb-${REF}-auth-token`, CO = 3180;
const manh = ve.length <= CO ? [[TEN, ve]] : Array.from({length: Math.ceil(ve.length / CO)}, (_, k) => [`${TEN}.${k}`, ve.slice(k * CO, (k + 1) * CO)]);
for (const [n, val] of manh) await goi('Network.setCookie', {name: n, value: val, domain: U.hostname, path: '/', secure: U.protocol === 'https:'});
const chay = async (bt) => (await goi('Runtime.evaluate', {expression: bt, returnByValue: true, awaitPromise: true})).result.value;

await goi('Page.navigate', {url: `${BASE}/vi/wig?class=${lop.id}`});
for (let i = 0; i < 60; i++) { if (await chay(`!!document.querySelector('h1')`)) break; await new Promise((r) => setTimeout(r, 500)); }
console.log(`Đã mở /wig · chờ ${CHO}s rồi bấm từng tab (nạp trước có nhịp 700ms/tab)`);
await new Promise((r) => setTimeout(r, CHO * 1000));

const TABS = ['/roster', '/attendance', '/homework', '/', '/timetable', '/wig'];
const kq = [];
for (const t of TABS) {
  const ms = await chay(`(async () => {
    const a = [...document.querySelectorAll('nav a')].find((x) => new URL(x.href).pathname.replace(/^\\/vi/, '') === ${JSON.stringify(t === '/' ? '/' : t)} || (${JSON.stringify(t)} !== '/' && new URL(x.href).pathname.replace(/^\\/vi/, '').startsWith(${JSON.stringify(t)})));
    if (!a) return -1;
    const cu = document.querySelector('h1')?.textContent ?? '';
    const t0 = performance.now();
    a.click();
    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const h = document.querySelector('h1')?.textContent ?? '';
      if (h && h !== cu && !document.querySelector('[aria-busy="true"], .animate-pulse')) return Math.round(performance.now() - t0);
    }
    return 99999;
  })()`);
  kq.push([t, ms]);
  console.log(`  ${t.padEnd(12)} ${ms} ms`);
  await new Promise((r) => setTimeout(r, 1500));
}
const so = kq.map(([, m]) => m).filter((m) => m > 0 && m < 99999).sort((a, b) => a - b);
console.log(`Trung vị: ${so[Math.floor(so.length / 2)]} ms`);
process.exit(0);
