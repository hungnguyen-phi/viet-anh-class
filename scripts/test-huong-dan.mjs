// KIỂM TOUR HƯỚNG DẪN bằng phiên thật: mở tour bằng sự kiện, bấm Tiếp tới hết, chụp từng bước;
// chế độ form mở ba form (mục tiêu · cam kết · thước đo) và chụp khối "Đây là gì?" mở/thu gọn.
//   node scripts/test-huong-dan.mjs <email> </vi/student> <thư-mục-ra> [rong=1366] [base|-] [tour|form]
// Mặc định base = http://localhost:3100 (dev). Chỉ đọc; không tạo dữ liệu.
import {readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const [email, duong, raDir, rongArg, baseArg, cheDo = 'tour'] = process.argv.slice(2);
const RONG = Number(rongArg ?? 1366);
const CAO = RONG < 700 ? 740 : 900;
const BASE = baseArg && baseArg !== '-' ? baseArg : 'http://localhost:3100';
const U = new URL(BASE);
mkdirSync(raDir, {recursive: true});
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
if (!hoSo) { console.error(`${email}: chưa có tài khoản`); process.exit(1); }
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const ve = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSoTam = mkdtempSync(path.join(tmpdir(), 'va-tour-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSoTam}`,
  '--no-first-run', '--disable-gpu', `--window-size=${RONG},${CAO}`, 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
  try { spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'}); } catch {}
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
const logs = [];
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cho.has(m.id)) { const {ok, ng} = cho.get(m.id); cho.delete(m.id); m.error ? ng(new Error(m.error.message)) : ok(m.result); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
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
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const chup = async (ten) => {
  const anh = await goi('Page.captureScreenshot', {format: 'png'});
  writeFileSync(path.join(raDir, ten), Buffer.from(anh.data, 'base64'));
};

await goi('Emulation.setDeviceMetricsOverride', {width: RONG, height: CAO, deviceScaleFactor: 1, mobile: RONG < 700});
await goi('Page.navigate', {url: `${BASE}${duong}`});
for (let i = 0; i < 120; i++) {
  if (await chay(`document.readyState === 'complete' && !document.querySelector('.animate-pulse')`)) break;
  await ngu(500);
}
await ngu(1500);

if (cheDo === 'form') {
  const nut = {mucTieu: '[data-hd="em-dat-muc-tieu"],[data-hd="gv-dat-muc-tieu-toi"]', camKet: '[data-hd="em-them-cam-ket"],[data-hd="gv-them-cam-ket"]', thuoc: '[data-hd="em-them-thuoc"],[data-hd="gv-them-thuoc"]'};
  for (const [k, sel] of Object.entries(nut)) {
    await chay(`localStorage.removeItem('va:hd:daylagi:${k}')`);
    const co = await chay(`(() => { const el = Array.from(document.querySelectorAll('${sel}')).find(e => e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`);
    if (!co) { console.log(`form ${k}: không có nút`); continue; }
    await ngu(900);
    await chup(`form-${k}-mo.png`);
    const cao = await chay(`(() => { const s = document.querySelector('section[class*="border-gold"] button[aria-expanded]'); return s ? s.getAttribute('aria-expanded') : 'none'; })()`);
    console.log(`form ${k}: DayLaGi aria-expanded=${cao}`);
    await chay(`(() => { const s = document.querySelector('section[class*="border-gold"] button[aria-expanded]'); if (s) s.click(); })()`);
    await ngu(400);
    await chup(`form-${k}-gon.png`);
    await goi('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await goi('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await ngu(1100);
  }
  console.log(logs.join('\n') || 'console sạch');
  process.exit(0);
}

await chay(`Object.keys(localStorage).filter(k => k.startsWith('va:hd:')).forEach(k => localStorage.removeItem(k))`);
await chay(`window.dispatchEvent(new Event('va:open-intro'))`);
await ngu(900);
const tong = [];
for (let b = 1; b <= 30; b++) {
  const tt = await chay(`(() => {
    const the = document.querySelector('[data-tour-the]');
    const buoc = the ? the.querySelector('[data-tour-buoc]')?.textContent : null;
    const tieu = the ? the.querySelector('h2')?.textContent : null;
    const hop = document.querySelector('[data-tour-hop]');
    const r = hop ? hop.getBoundingClientRect() : null;
    return {co: !!the, buoc, tieu, hop: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null};
  })()`);
  if (!tt.co) { console.log(`bước ${b}: không thấy thẻ tour`); break; }
  tong.push(`${tt.buoc ?? '?'} · ${tt.tieu ?? '?'} · hộp=${tt.hop ? tt.hop.join(',') : 'đọc'}`);
  await chup(`${String(b).padStart(2, '0')}.png`);
  const con = await chay(`(() => { const n = document.querySelector('[data-tour-tiep]'); if (!n) return false; n.click(); return true; })()`);
  if (!con) break;
  await ngu(1100);
}
console.log(tong.join('\n'));
console.log('--- console:'); console.log(logs.join('\n') || 'sạch');
process.exit(0);
