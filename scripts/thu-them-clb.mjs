// TÁI HIỆN THÊM CLB bằng phiên thật — điền form, bấm nút, đọc câu flash + kiểm dòng DB.
//   node scripts/thu-them-clb.mjs <email> [base]
import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const [email, baseArg] = process.argv.slice(2);
const BASE = baseArg ?? 'https://class.vietanh.org';
const LOP = 'ddefb0a7-eeaa-40e6-9e16-0fd4c65fc8bf';
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
const hoSoTam = mkdtempSync(path.join(tmpdir(), 'va-clb-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSoTam}`,
  '--no-first-run', '--disable-gpu', '--window-size=1366,1400', 'about:blank'], {stdio: 'ignore'});
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
sock.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cho.has(m.id)) { cho.get(m.id)(m); cho.delete(m.id); }
};
await new Promise((r) => (sock.onopen = r));
const goi = (method, params = {}) =>
  new Promise((res) => { const i = ++id; cho.set(i, res); sock.send(JSON.stringify({id: i, method, params})); });
const js = async (expr) => (await goi('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true})).result?.result?.value;

await goi('Network.enable');
const TEN = `sb-${REF}-auth-token`, CO = 3180;
const manh = ve.length <= CO ? [[TEN, ve]] : Array.from({length: Math.ceil(ve.length / CO)}, (_, k) => [`${TEN}.${k}`, ve.slice(k * CO, (k + 1) * CO)]);
for (const [n, val] of manh) await goi('Network.setCookie', {name: n, value: val, domain: U.hostname, path: '/', secure: U.protocol === 'https:'});
await goi('Page.enable');
await goi('Page.navigate', {url: `${BASE}/vi/timetable?class=${LOP}`});
await new Promise((r) => setTimeout(r, 20000));

console.log('Đang ở:', await js('location.href'));
console.log('Trang có chữ Câu lạc bộ:', await js(`document.body.innerText.includes('Câu lạc bộ')`));
const coForm = await js(`!!document.querySelector('input[name="name"]')`);
console.log('Form CLB có mặt:', coForm);
if (coForm) {
  await js(`(() => {
    const f = document.querySelector('input[name="name"]').closest('form');
    f.querySelector('select[name="day_of_week"]').value = '7';
    const dat = (sel, val) => { const el = f.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val); el.dispatchEvent(new Event('input', {bubbles: true})); };
    dat('input[name="name"]', 'KIỂM yoga');
    dat('input[name="start_time"]', '06:20');
    dat('input[name="end_time"]', '09:20');
    f.requestSubmit();
    return 'đã bấm';
  })()`);
  await new Promise((r) => setTimeout(r, 9000));
  const flash = await js(`(document.body.innerText.match(/[^\\n]*(Đã thêm CLB|lỗi|Lỗi|không có quyền|quyền)[^\\n]*/) ?? ['(không thấy câu flash)'])[0]`);
  console.log('URL sau bấm:', await js('location.href'));
  console.log('Câu flash  :', flash);
  console.log('Chip yoga  :', await js(`document.body.innerText.includes('KIỂM yoga')`));
}
const {data: dong} = await admin.from('timetable_slots').select('id, subject, kind').eq('class_id', LOP).eq('kind', 'club');
console.log('Dòng club trong DB:', JSON.stringify(dong));
process.exit(0);
