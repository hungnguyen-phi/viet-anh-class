// CHỤP MỘT TRANG bằng phiên thật — để NHÌN giao diện như người dùng nhìn, trước và sau khi sửa.
//
//   node scripts/chup-trang.mjs <email> </duong/dan> <tep.png> [rong=1366] [cao=900] [base]
//
// Chụp CẢ TRANG (full page). Chỉ đọc; chặn generateLink với email chưa có hồ sơ.
import {readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const [email, duong, tep, rongArg, caoArg, baseArg] = process.argv.slice(2);
if (!email || !duong || !tep) {
  console.error('Dùng: node scripts/chup-trang.mjs <email> </vi/student> <ra.png> [rong] [cao] [base]');
  process.exit(1);
}
const RONG = Number(rongArg ?? 1366);
const CAO = Number(caoArg ?? 900);
const BASE = baseArg ?? 'https://class.vietanh.org';
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
const {data: hoSo} = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
if (!hoSo) {
  console.error(`${email}: chưa có tài khoản — không tạo mới.`);
  process.exit(1);
}
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
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
const hoSoTam = mkdtempSync(path.join(tmpdir(), 'va-chup-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSoTam}`,
  '--no-first-run', '--disable-gpu', `--window-size=${RONG},${CAO}`, 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
  try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'}); else process.kill(proc.pid); } catch {}
  try { rmSync(hoSoTam, {recursive: true, force: true}); } catch {}
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

await goi('Emulation.setDeviceMetricsOverride', {width: RONG, height: CAO, deviceScaleFactor: 1, mobile: RONG < 700});
await goi('Page.navigate', {url: `${BASE}${duong.startsWith('/vi') || duong.startsWith('/en') ? duong : '/vi' + duong}`});
for (let i = 0; i < 60; i++) {
  if (await chay(`document.readyState === 'complete' && !document.querySelector('.animate-pulse')`)) break;
  await new Promise((r) => setTimeout(r, 500));
}
await new Promise((r) => setTimeout(r, 1200));
// Cả trang: đo chiều cao thật rồi nới khung.
const caoThat = Math.min(await chay(`document.documentElement.scrollHeight`), 6000);
await goi('Emulation.setDeviceMetricsOverride', {width: RONG, height: caoThat, deviceScaleFactor: 1, mobile: RONG < 700});
await new Promise((r) => setTimeout(r, 400));
const anh = await goi('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
writeFileSync(tep, Buffer.from(anh.data, 'base64'));
console.log(`Đã chụp ${duong} (${RONG}px, cao ${caoThat}px) → ${tep}`);
process.exit(0);
