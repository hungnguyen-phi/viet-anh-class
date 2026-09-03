// VÒNG TEST SỐNG mô hình WIG cá nhân GVCN → lớp → trường (0181) — chạy trên PRODUCTION, lớp Test.
// Điều khiển headless CDP như chup-trang.mjs; mỗi bước chụp PNG để NHÌN. Xoá file sau khi xong.
import {readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = 'https://class.truongvietanh.com';
const OUTDIR = process.argv[2];
const CHI_BUOC = (process.argv[3] ?? '').split(',').filter(Boolean); // vd "1,2" — rỗng = tất cả
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSoTam = mkdtempSync(path.join(tmpdir(), 'va-vong-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSoTam}`,
  '--no-first-run', '--disable-gpu', '--window-size=900,1000', 'about:blank'], {stdio: 'ignore'});
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
await goi('Emulation.setDeviceMetricsOverride', {width: 900, height: 1000, deviceScaleFactor: 1, mobile: false});

const chay = async (bt) => {
  const r = await goi('Runtime.evaluate', {expression: bt, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
};
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email) {
  await goi('Network.clearBrowserCookies');
  const {data: g, error: ge} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (ge) throw new Error('generateLink ' + email + ': ' + ge.message);
  const {data: v, error: ve} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  if (ve) throw new Error('verifyOtp ' + email + ': ' + ve.message);
  const veStr = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
  const TEN = `sb-${REF}-auth-token`, CO = 3180;
  const manh = veStr.length <= CO ? [[TEN, veStr]] : Array.from({length: Math.ceil(veStr.length / CO)}, (_, k) => [`${TEN}.${k}`, veStr.slice(k * CO, (k + 1) * CO)]);
  for (const [n, val] of manh) await goi('Network.setCookie', {name: n, value: val, domain: 'class.truongvietanh.com', path: '/', secure: true});
  console.log(`· đăng nhập ${email}`);
}

async function nav(duong) {
  await goi('Page.navigate', {url: `${BASE}${duong}`});
  for (let i = 0; i < 60; i++) {
    try { if (await chay(`document.readyState === 'complete' && !document.querySelector('.animate-pulse')`)) break; } catch {}
    await ngu(500);
  }
  await ngu(1200);
}

async function choDoi(bt, moTa, lanMax = 30) {
  for (let i = 0; i < lanMax; i++) {
    try { if (await chay(bt)) return; } catch {}
    await ngu(500);
  }
  throw new Error('Chờ mãi không thấy: ' + moTa);
}

async function shot(ten) {
  const cao = Math.min(await chay(`document.documentElement.scrollHeight`), 4000);
  await goi('Emulation.setDeviceMetricsOverride', {width: 900, height: cao, deviceScaleFactor: 1, mobile: false});
  await ngu(300);
  const anh = await goi('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
  writeFileSync(path.join(OUTDIR, ten + '.png'), Buffer.from(anh.data, 'base64'));
  await goi('Emulation.setDeviceMetricsOverride', {width: 900, height: 1000, deviceScaleFactor: 1, mobile: false});
  console.log('  ↳ ảnh ' + ten + '.png (cao ' + cao + ')');
}

// Gõ vào input/textarea của React: native setter + event 'input'.
const datGia = (sel, val) => chay(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'KHONG_THAY';
  const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', {bubbles: true}));
  return 'OK';
})()`);
const datSelect = (sel, val) => chay(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'KHONG_THAY';
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return 'OK';
})()`);
const bam = (sel) => chay(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'KHONG_THAY'; el.click(); return 'OK'; })()`);
// Bấm nút theo CHỮ hiện trên nút (khớp chứa, lấy nút đầu khớp).
const bamChu = (chu, goc = 'body') => chay(`(() => {
  const els = [...document.querySelector(${JSON.stringify(goc)}).querySelectorAll('button')];
  const el = els.find((b) => b.textContent.trim().includes(${JSON.stringify(chu)}));
  if (!el) return 'KHONG_THAY';
  el.click(); return 'OK';
})()`);
const phaiOK = (r, moTa) => { if (r !== 'OK') throw new Error(moTa + ' → ' + r); };

// Chọn trong ChonCuon: bấm trigger rồi bấm option theo chữ.
async function chonCuon(idTrigger, chuOption) {
  phaiOK(await bam('#' + idTrigger), 'trigger ' + idTrigger);
  await ngu(300);
  const r = await chay(`(() => {
    const ops = [...document.querySelectorAll('[role="listbox"] [role="option"]')];
    const el = ops.find((b) => b.textContent.trim() === ${JSON.stringify(chuOption)}) ||
               ops.find((b) => b.textContent.trim().includes(${JSON.stringify(chuOption)}));
    if (!el) return 'KHONG_THAY: ' + ops.map((o) => o.textContent.trim()).join('|');
    el.click(); return 'OK';
  })()`);
  phaiOK(r, 'option ' + chuOption);
  await ngu(200);
}

// Chọn ngày trong LichVN: mở lịch trong khu data-kiem="mt-han", đặt tháng/năm, bấm ngày.
async function chonNgay(y, m, d) {
  phaiOK(await bam('[data-kiem="mt-han"] button'), 'mở lịch');
  await ngu(300);
  phaiOK(await datSelect('select[aria-label="Năm"]', String(y)), 'chọn năm');
  await ngu(200);
  phaiOK(await datSelect('select[aria-label="Tháng"]', String(m)), 'chọn tháng');
  await ngu(200);
  const r = await chay(`(() => {
    const dd = String(${d}).padStart(2, '0'), mm = String(${m}).padStart(2, '0');
    const el = [...document.querySelectorAll('button[aria-label]')].find((b) => (b.getAttribute('aria-label') || '').includes(dd + '/' + mm + '/' + ${y}) && !b.disabled);
    if (!el) return 'KHONG_THAY';
    el.click(); return 'OK';
  })()`);
  phaiOK(r, `ngày ${d}/${m}/${y}`);
  await ngu(200);
}

const GV = 'tunhien01@truongvietanh.com';
const AD = 'test3.admin@truongvietanh.com';
const HS = 'test1.hs@student.truongvietanh.com';
const CAMPUS_GV = '61453ebe-dd27-434c-8787-c78dd21da742'; // Việt Anh Gò Vấp (lớp Test)
const lam = (n) => CHI_BUOC.length === 0 || CHI_BUOC.includes(String(n));

try {
  // ══ BƯỚC 1 · ADMIN đặt mục tiêu trường ═══════════════════════════════════════════
  if (lam(1)) {
    console.log('B1 · admin đặt mục tiêu trường');
    await login(AD);
    await nav(`/vi/truong?campus=${CAMPUS_GV}`);
    await shot('b1a-truong-trong');
    phaiOK(await bamChu('Đặt mục tiêu cho trường'), 'nút tạo');
    await choDoi(`!!document.querySelector('#mt-ten')`, 'form mục tiêu');
    phaiOK(await datGia('#mt-ten', 'Toàn trường đọc 5000 quyển sách'), 'tên');
    await chonCuon('mt-don-vi', 'lần');
    phaiOK(await datGia('#mt-x', '0'), 'x');
    phaiOK(await datGia('#mt-y', '5000'), 'y');
    await chonNgay(2027, 6, 30);
    await shot('b1b-form-dien-xong');
    phaiOK(await bam('button[name="action"][value="gui"]'), 'gửi');
    await ngu(2500); await nav(`/vi/truong?campus=${CAMPUS_GV}`);
    await shot('b1c-truong-co-muc-tieu');
  }

  // ══ BƯỚC 2 · GVCN nối WIG lớp → trường ═══════════════════════════════════════════
  if (lam(2)) {
    console.log('B2 · GVCN nối lớp → trường');
    await login(GV);
    await nav('/vi/wig');
    await shot('b2a-wig-truoc-noi');
    const co = await chay(`!!document.querySelector('select[name="truong_id"]')`);
    if (!co) { console.log('  !! không thấy select truong_id'); }
    else {
      await chay(`(() => { const s = document.querySelector('select[name="truong_id"]'); const op = [...s.options].find((o) => o.value); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, op.value); s.dispatchEvent(new Event('change', {bubbles: true})); })()`);
      await ngu(300);
      const r = await chay(`(() => { const f = document.querySelector('select[name="truong_id"]').closest('form'); const b = f.querySelector('button'); if (!b) return 'KHONG_THAY'; b.click(); return 'OK'; })()`);
      phaiOK(r, 'nút nối trường');
      await ngu(2500); await nav('/vi/wig');
    }
    await shot('b2b-wig-sau-noi');
  }

  // ══ BƯỚC 3 · GVCN đặt mục tiêu của tôi ═══════════════════════════════════════════
  if (lam(3)) {
    console.log('B3 · GVCN đặt mục tiêu của tôi');
    await login(GV);
    await nav('/vi/wig');
    phaiOK(await bamChu('Đặt mục tiêu của tôi'), 'nút tạo');
    await choDoi(`!!document.querySelector('#mt-ten')`, 'form mục tiêu');
    phaiOK(await datGia('#mt-ten', 'Tôi đọc 40 quyển cùng lớp'), 'tên');
    const coHoTro = await chay(`!!document.querySelector('#mt-ho-tro')`);
    if (coHoTro) await chonCuon('mt-ho-tro', 'Lớp đọc 300 quyển sách');
    else console.log('  !! không thấy ô Hỗ trợ cho');
    await chonCuon('mt-don-vi', 'lần');
    phaiOK(await datGia('#mt-x', '0'), 'x');
    phaiOK(await datGia('#mt-y', '40'), 'y');
    await chonNgay(2027, 6, 30);
    await shot('b3a-form-toi');
    phaiOK(await bam('button[name="action"][value="gui"]'), 'gửi');
    await ngu(2500); await nav('/vi/wig');
    await shot('b3b-wig-co-muc-tieu-toi');
  }

  // ══ BƯỚC 4 · cam kết tuần của tôi ════════════════════════════════════════════════
  if (lam(4)) {
    console.log('B4 · GVCN thêm cam kết tuần của tôi');
    await login(GV);
    await nav('/vi/wig');
    phaiOK(await bam('button[aria-label="Thêm cam kết tuần của tôi"]'), 'nút (+)');
    await choDoi(`!!document.querySelector('#ckt-noi')`, 'form cam kết');
    phaiOK(await datGia('#ckt-noi', 'Tuần này tôi đọc 10 quyển cùng lớp'), 'lời hứa');
    phaiOK(await datGia('#ckt-so', '10'), 'số hứa');
    await shot('b4a-form-cam-ket');
    phaiOK(await bamChu('Lưu cam kết'), 'lưu');
    await ngu(2500); await nav('/vi/wig');
    await shot('b4b-wig-co-cam-ket');
  }

  // ══ BƯỚC 5 · thước đo dẫn dắt + tick ═════════════════════════════════════════════
  if (lam(5)) {
    console.log('B5 · thước đo dẫn dắt + tick');
    await login(GV);
    await nav('/vi/wig');
    phaiOK(await bamChu('Thêm thước đo dẫn dắt'), 'nút thêm thước');
    await choDoi(`!!document.querySelector('#tt-ten')`, 'form thước');
    phaiOK(await datGia('#tt-ten', 'Đọc cùng lớp mỗi tối'), 'tên thước');
    await shot('b5a-form-thuoc');
    phaiOK(await bamChu('Lưu', 'form:has(#tt-ten), body'), 'lưu thước');
    await ngu(2500); await nav('/vi/wig');
    await shot('b5b-wig-co-thuoc');
    // Tick hôm nay (03/09) — nút aria-label "T. 03/09".
    const r = await chay(`(() => {
      const el = [...document.querySelectorAll('button[aria-label]')].find((b) => (b.getAttribute('aria-label') || '').endsWith('03/09') && !b.disabled);
      if (!el) return 'KHONG_THAY: ' + [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((a) => /\\d\\d\\/\\d\\d/.test(a)).join('|');
      el.click(); return 'OK';
    })()`);
    console.log('  tick hôm nay: ' + r);
    await ngu(2500); await nav('/vi/wig');
    await shot('b5c-wig-sau-tick');
  }

  // ══ BƯỚC 6 · chấm cuối tuần + số chảy ════════════════════════════════════════════
  if (lam(6)) {
    console.log('B6 · điền số đạt + chấm Thắng');
    await login(GV);
    await nav('/vi/wig');
    const r1 = await datGia('input[name="so_dat"]', '4');
    console.log('  điền so_dat=4: ' + r1);
    const r2 = await chay(`(() => { const i = document.querySelector('input[name="so_dat"]'); if (!i) return 'KHONG_THAY'; const b = i.closest('form').querySelector('button[value="thang"]'); if (!b) return 'KHONG_NUT'; b.click(); return 'OK'; })()`);
    console.log('  bấm Thắng: ' + r2);
    await ngu(2500); await nav('/vi/wig');
    await shot('b6a-wig-sau-cham');
    await login(AD);
    await nav(`/vi/truong?campus=${CAMPUS_GV}`);
    await shot('b6b-truong-sau-cham');
  }

  // ══ BƯỚC 7 · màn học sinh nguyên vẹn ═════════════════════════════════════════════
  if (lam(7)) {
    console.log('B7 · màn học sinh');
    await login(HS);
    await nav('/vi/student');
    // Đóng modal check-in nếu che màn (chọn mặt vàng bình thường? KHÔNG — check-in là điểm danh, đừng đụng; chỉ đóng nếu có nút đóng).
    await chay(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '×' || x.getAttribute('aria-label') === 'Đóng'); if (b) b.click(); })()`);
    await ngu(500);
    await shot('b7a-student');
    const loRi = await chay(`document.body.innerText.includes('Tôi đọc 40 quyển cùng lớp')`);
    console.log('  mục tiêu của thầy cô lộ ở màn em: ' + (loRi ? 'CÓ (LỖI)' : 'không'));
  }

  console.log('XONG VÒNG.');
} finally {
  try { sock.close(); } catch {}
  process.exit(0);
}
