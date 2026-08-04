// BẢN TRÊN ĐIỆN THOẠI — đo ở viewport THẬT, không suy từ tên class.
//
// VÌ SAO CÓ FILE NÀY. Đợt audit 2026-08-04 tôi báo cáo phần "điện thoại" mà KHÔNG mở nổi một
// viewport điện thoại nào: tiện ích trình duyệt không đổi được cỡ cửa sổ, iframe bị chính header
// bảo mật của app chặn (X-Frame-Options: DENY), popup bị chặn vì không có cử chỉ người dùng. Tôi
// lùi về phân tích tĩnh trên chuỗi class và nói là "đã kiểm".
//
// Phân tích tĩnh bắt được tràn ngang. Nó KHÔNG bắt được thứ chỉ lộ ra ở 360px thật — và khi mở
// được viewport thật thì lòi ra ngay: dòng "N1 · Học sinh 7B1 (tổ trưởng)" đẩy con số ra ngoài
// thẻ, `truncate` không ăn trên inline-flex nên chữ cắt cụt mà không có dấu ba chấm, huy hiệu
// "★ Tổ trưởng" bóp tên em xuống còn 22px.
//
// Đường đi được: lái thẳng Edge/Chrome headless qua CDP. Không cần cài gì thêm — Node ≥22 đã có
// sẵn WebSocket, và máy nào chạy được app này thì cũng đã có sẵn một trình duyệt Chromium.
//
//   node scripts/test-mobile.mjs [http://localhost:6871] [360]
import {readFileSync, existsSync, rmSync, mkdtempSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const RONG = Number(process.argv[3] ?? 360);
const CAO = 800;
// Cổng NGẪU NHIÊN: cổng cố định làm hai lượt chạy nối nhau tranh nhau, lượt sau không mở
// được trình duyệt rồi báo SAI vì lý do sai — một phép kiểm nói dối còn tệ hơn không có.
const CONG = 9300 + Math.floor(Math.random() * 600);

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// ── Tìm trình duyệt ───────────────────────────────────────────────────────────────────────
const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
if (!BIN) {
  console.log('BỎ QUA: không tìm thấy Edge/Chrome trên máy này.');
  process.exit(0);
}

// ── Vé đăng nhập cho từng vai ─────────────────────────────────────────────────────────────
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});
const TK = {
  gvcn: 'test1.gvcn@truongvietanh.com',
  ph: 'test1.ph@truongvietanh.com',
  bgh: 'test2.bgh@truongvietanh.com',
  admin: 'test3.admin@truongvietanh.com',
};
const ve = {};
for (const [vai, email] of Object.entries(TK)) {
  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  ve[vai] = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

// ── Mở trình duyệt ────────────────────────────────────────────────────────────────────────
const hoSo = mkdtempSync(path.join(tmpdir(), 'va-mobile-'));
const proc = spawn(
  BIN,
  [
    '--headless=new',
    `--remote-debugging-port=${CONG}`,
    `--user-data-dir=${hoSo}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ],
  {stdio: 'ignore', detached: process.platform !== 'win32'},
);
// Chromium đẻ ra một CÂY tiến trình (renderer, gpu, utility...). `proc.kill()` chỉ giết cái gốc,
// đám con sống tiếp và giữ nguyên hồ sơ + cổng — chạy vài lượt là máy có bốn chục tiến trình mồ
// côi và lượt sau không mở nổi trình duyệt. Phải giết cả cây.
const donDep = () => {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    } else {
      process.kill(-proc.pid, 'SIGKILL');
    }
  } catch {}
  try { proc.kill(); } catch {}
  try { rmSync(hoSo, {recursive: true, force: true}); } catch {}
};
process.on('exit', donDep);
process.on('SIGINT', () => { donDep(); process.exit(130); });

// Chờ CDP sẵn sàng
let san = false;
for (let i = 0; i < 40 && !san; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${CONG}/json/version`);
    san = r.ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!san) {
  console.log('SAI  Không mở được trình duyệt để đo.');
  donDep();
  process.exit(1);
}

const t = await (await fetch(`http://127.0.0.1:${CONG}/json/new?about:blank`, {method: 'PUT'})).json();
const sock = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const cho = new Map();
const sk = {};
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cho.has(m.id)) {
    const {ok, ng} = cho.get(m.id);
    cho.delete(m.id);
    m.error ? ng(new Error(m.error.message)) : ok(m.result);
  } else if (m.method && sk[m.method]) sk[m.method].forEach((f) => f(m.params));
});
const goi = (method, params = {}) =>
  new Promise((ok, ng) => { const i = ++id; cho.set(i, {ok, ng}); sock.send(JSON.stringify({id: i, method, params})); });
const nghe = (ev, f) => ((sk[ev] ??= []).push(f));
await new Promise((ok) => sock.addEventListener('open', ok));

await goi('Page.enable');
await goi('Network.enable');
await goi('Runtime.enable');
// mobile: true — media query, touch và `hover: none` đều theo đúng điện thoại, không phải
// một cửa sổ desktop bị bóp hẹp. Đây là điểm khác biệt với mọi cách giả lập trước.
await goi('Emulation.setDeviceMetricsOverride', {width: RONG, height: CAO, deviceScaleFactor: 2, mobile: true});
await goi('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
// TIẾNG VIỆT, không phải tiếng Anh.
//
// Trình duyệt headless gửi `Accept-Language: en-US`, và next-intl (localePrefix 'as-needed')
// nghe theo — nên lượt đo đầu tiên chạy sạch trên bản TIẾNG ANH rồi tôi tưởng bản Việt cũng vậy.
// Nhãn tiếng Việt dài hơn tiếng Anh 20–30% và có dấu (nguyên tắc số 3 trong PRODUCT.md): đo bản
// Anh rồi kết luận cho bản Việt là đo cái dễ rồi báo cáo cho cái khó.
await goi('Network.setExtraHTTPHeaders', {headers: {'Accept-Language': 'vi,vi-VN;q=0.9'}});

const DO = readFileSync('scripts/do-mobile.js', 'utf8');

const TRANG = [
  ['gvcn', '/'], ['gvcn', '/wig'], ['gvcn', '/wig/chi-tiet'], ['gvcn', '/wig/hop'],
  ['gvcn', '/attendance'], ['gvcn', '/roster'], ['gvcn', '/homework'], ['gvcn', '/grades'],
  ['gvcn', '/timetable'], ['gvcn', '/scoreboard'], ['gvcn', '/inbox'],
  ['ph', '/report'], ['ph', '/timetable'], ['ph', '/homework'],
  ['bgh', '/campus'], ['bgh', '/meeting'],
  ['admin', '/admin'],
];

let vaiCu = null;
const loi = {tran: [], thoat: [], contrast: [], cham: []};
for (const [vai, duong] of TRANG) {
  if (vai !== vaiCu) {
    const [n, v] = ve[vai].split('=');
    await goi('Network.clearBrowserCookies');
    await goi('Network.setCookie', {name: n, value: v, domain: 'localhost', path: '/'});
    vaiCu = vai;
  }
  const xong = new Promise((ok) => nghe('Page.loadEventFired', ok));
  await goi('Page.navigate', {url: BASE + duong});
  await xong;
  await new Promise((r) => setTimeout(r, 2200)); // chờ RSC stream xong
  const {result} = await goi('Runtime.evaluate', {expression: DO, returnByValue: true});
  const k = result.value;
  const nhan = `${duong} [${vai}]`;
  for (const x of k.tranPhai) loi.tran.push(`${nhan} ${x.tag}.${x.cls.slice(0, 24)} → ${x.phai}px`);
  for (const x of k.thoatThe) loi.thoat.push(`${nhan} ${x.tag} thò ra ${x.thoaRa}px "${x.chu}"`);
  for (const x of k.contrast) loi.contrast.push(`${nhan} "${x.chu}" ${x.tl}:1 (cần ${x.can})`);
  for (const x of k.chamNho) loi.cham.push(`${nhan} ${x.tag} ${x.w}×${x.h} "${x.ten}"`);
}

sock.close();
donDep();

console.log(`\nĐo ở ${RONG}×${CAO}, mobile thật (touch + hover:none), ${TRANG.length} trang × 4 vai:\n`);
check('Không trang nào bị kéo ngang', loi.tran.length === 0, loi.tran.slice(0, 6).join(' · '));
check('Không nội dung nào thò ra ngoài thẻ chứa nó', loi.thoat.length === 0, loi.thoat.slice(0, 6).join(' · '));
check('Không chữ nào dưới ngưỡng tương phản', loi.contrast.length === 0, loi.contrast.slice(0, 6).join(' · '));
check('Không vùng chạm nào dưới 24×24', loi.cham.length === 0, loi.cham.slice(0, 6).join(' · '));

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
