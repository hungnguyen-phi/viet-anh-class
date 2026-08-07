// Ô MỤC TIÊU: CHỈ NHẬN SỐ NGUYÊN, VÀ KHÔNG TỰ ĐỔI KHI NGƯỜI TA CUỘN TRANG.
//
// Vì sao có file này: chủ dự án gõ mục tiêu là 5 trên form "Thêm việc" rồi thấy ô hiện lên 5.1 —
// "nó lag xong nó hiển thị lên 5.1 mà tôi chưa ấn". Tôi KHÔNG dựng lại được đúng cảnh ấy, nên
// không đoán bừa nguyên nhân; thay vào đó chặn cả lớp lỗi: một ô đếm bài/buổi/lần thì 5.1 không
// được phép tồn tại, tới bằng đường nào cũng vậy.
//
// ĐIỀU TRA RA GÌ: cú lăn chuột ĐỔI ĐƯỢC giá trị ô số trên một trang trần (đo được: 5 → 6), nhưng
// trên chính trang /wig thì không — cú lăn bị nuốt làm thao tác cuộn trang trước khi tới được ô.
// Nên chốt chặn KhoaLanChuotTrenSo là bảo hiểm cho thiết bị/trình duyệt khác, còn thứ thật sự
// chặn được "5.1" là luật SỐ NGUYÊN: ô nhập từ chối tại chỗ, và server từ chối lần nữa.
//
// Phép kiểm này mở trang thật rồi bắt TRÌNH DUYỆT tự phán bằng checkValidity(), không đọc thuộc
// tính step rồi suy — thuộc tính đúng mà luật sai vẫn là chuyện xảy ra được.
//
//   node scripts/test-o-so.mjs [http://localhost:6871]
import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const U = new URL(BASE);
const TEN_MIEN = U.hostname;
const LA_HTTPS = U.protocol === 'https:';

let dat = 0, hong = 0;
const ok = (ten, c, ghi = '') => {
  c ? dat++ : hong++;
  console.log(`${c ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// ── PHẦN 1: CHỐT CHẶN PHẢI ĐƯỢC CẮM Ở LỚP NGOÀI CÙNG ───────────────────────────────────────
// Cắm ở layout mới che được ô số nằm trong SERVER COMPONENT — chỗ không gắn onWheel được.
const layout = readFileSync('app/[locale]/layout.tsx', 'utf8');
ok('Chốt chặn được cắm trong layout gốc', /<KhoaLanChuotTrenSo \/>/.test(layout));
const chot = readFileSync('components/ui/KhoaLanChuotTrenSo.tsx', 'utf8');
// passive mặc định của sự kiện wheel là true, mà passive thì preventDefault bị bỏ qua LẶNG LẼ.
ok('Nghe sự kiện với passive:false, nếu không preventDefault vô tác dụng', /passive:\s*false/.test(chot));

// ── PHẦN 2: THỬ TRÊN TRANG THẬT ────────────────────────────────────────────────────────────
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

// Tra GVCN có mục tiêu tuần để mở được form "Thêm việc" — KHÔNG đóng cứng email, vai và dữ liệu
// đổi lúc nào không ai báo (bài học đã ghi trong test-admin-man.mjs).
const {data: wigTuan} = await admin
  .from('wigs')
  .select('class_id, classes(homeroom_teacher_id)')
  .eq('period', 'week')
  .eq('scope', 'class')
  .limit(1)
  .maybeSingle();
if (!wigTuan?.classes?.homeroom_teacher_id) {
  console.log('BỎ QUA phần trang thật: không có lớp nào đang có mục tiêu TUẦN để mở form thêm việc.');
  console.log(`\n${dat}/${dat + hong} đạt.`);
  process.exit(hong === 0 ? 0 : 1);
}
const {data: gv} = await admin.from('profiles').select('email').eq('id', wigTuan.classes.homeroom_teacher_id).single();
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const ve = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
if (!BIN) {
  console.log('BỎ QUA phần trang thật: không tìm thấy Edge/Chrome trên máy này.');
  console.log(`\n${dat}/${dat + hong} đạt.`);
  process.exit(hong === 0 ? 0 : 1);
}
// Cổng ngẫu nhiên: cổng cố định làm hai lượt chạy nối nhau tranh nhau.
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSo = mkdtempSync(path.join(tmpdir(), 'va-oso-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSo}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
  // Chromium đẻ ra cả CÂY tiến trình; giết mỗi gốc là để lại đám con mồ côi giữ hồ sơ và cổng.
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    else process.kill(-proc.pid, 'SIGKILL');
  } catch {}
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
  if (m.id && cho.has(m.id)) { const {ok: o, ng} = cho.get(m.id); cho.delete(m.id); m.error ? ng(new Error(m.error.message)) : o(m.result); }
});
// Mọi lệnh đều có hạn giờ: chờ vô hạn là cả lượt chạy đứng im mà nhìn từ ngoài không phân biệt
// được với "đang chạy chậm".
const goi = (method, params = {}, han = 30000) => new Promise((o, ng) => {
  const i = ++id;
  const dongHo = setTimeout(() => { cho.delete(i); ng(new Error(`${method} không trả lời sau ${han / 1000}s`)); }, han);
  cho.set(i, {ok: (r) => { clearTimeout(dongHo); o(r); }, ng: (e) => { clearTimeout(dongHo); ng(e); }});
  sock.send(JSON.stringify({id: i, method, params}));
});
await new Promise((o) => sock.addEventListener('open', o));
await goi('Page.enable'); await goi('Runtime.enable'); await goi('Network.enable');
const TEN = `sb-${REF}-auth-token`, CO = 3180;
const manh = ve.length <= CO ? [[TEN, ve]]
  : Array.from({length: Math.ceil(ve.length / CO)}, (_, k) => [`${TEN}.${k}`, ve.slice(k * CO, (k + 1) * CO)]);
for (const [n, val] of manh) await goi('Network.setCookie', {name: n, value: val, domain: TEN_MIEN, path: '/', secure: LA_HTTPS});
// Hạn giờ rộng cho riêng lệnh này: bản dev dựng trang lần đầu mất cả phút, và một phép kiểm
// chết vì trình dịch chậm là một phép kiểm nói dối.
await goi('Page.navigate', {url: `${BASE}/vi/wig?class=${wigTuan.class_id}`}, 180000);

const chay = async (bt) => (await goi('Runtime.evaluate', {expression: bt, returnByValue: true, awaitPromise: true})).result.value;
const doi = async (bt, han = 60) => {
  for (let i = 0; i < han; i++) { const r = await chay(bt); if (r) return r; await new Promise((r) => setTimeout(r, 1000)); }
  return null;
};

const moForm = await doi(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Thêm việc/i.test(x.textContent));
  if (!b) return ''; b.click(); return 'mo';
})()`, 40);
ok('Mở được form thêm việc', moForm === 'mo');

if (moForm === 'mo') {
  // 5.1 KHÔNG CÒN LÀ MỘT GIÁ TRỊ HỢP LỆ.
  //
  // Đây mới là thứ chặn được triệu chứng chủ dự án gặp, và chặn bất kể nó tới bằng đường nào —
  // lăn chuột, phím mũi tên, hay một phím gõ nhầm. Bắt trình duyệt tự phán bằng checkValidity()
  // chứ không đọc thuộc tính step rồi suy: thuộc tính đúng mà luật sai vẫn có thể xảy ra.
  const le = await doi(`(() => {
    const o = document.querySelector('#viec-target');
    if (!o) return '';
    o.scrollIntoView({block: 'center'});
    o.focus(); o.value = '5.1';
    return JSON.stringify({hopLe: o.checkValidity(), step: o.step, min: o.min});
  })()`, 20);
  const l = JSON.parse(le || '{}');
  ok('Ô mục tiêu từ chối 5.1 — chỉ nhận số nguyên', l.hopLe === false, `step=${l.step} min=${l.min}`);
  const nguyen = await chay(`(() => { const o=document.querySelector('#viec-target'); o.value='5'; return o.checkValidity(); })()`);
  ok('… nhưng vẫn nhận 5 bình thường', nguyen === true);

  // Còn cú lăn chuột: nó ĐỔI ĐƯỢC số trên một trang trần (đã đo: 5 → 6), nhưng trên trang này thì
  // không — cú lăn bị nuốt làm thao tác cuộn trang trước khi tới được ô số. Nên chốt chặn
  // KhoaLanChuotTrenSo ở đây là bảo hiểm cho trình duyệt/thiết bị khác, KHÔNG phải thứ đã sửa
  // triệu chứng 5.1. Không viết phép kiểm trình duyệt cho nó: phép kiểm ấy xanh cả khi gỡ chốt
  // ra (tôi đã thử đúng như vậy) — một phép kiểm không bao giờ đỏ được là một phép kiểm nói dối.

  // Lĩnh vực phải LẤY TỪ MỤC TIÊU, không bắt điền lại. Nhãn cũ đóng cứng chữ "Kỹ năng" ở mọi
  // lĩnh vực nên đọc thành "khai lại lĩnh vực đi, và lĩnh vực là Kỹ năng".
  const nhan = await chay(`(() => {
    const o = document.querySelector('#viec-sub');
    const f = o?.closest('div')?.parentElement;
    return f ? f.textContent.trim().slice(0, 220) : '';
  })()`);
  ok('Nhãn nhóm nhỏ không còn đóng cứng chữ "(Kỹ năng)"', !/Nhóm \(Kỹ năng\)/.test(nhan), nhan.slice(0, 80));
  ok('Nhãn nói rõ lĩnh vực đã lấy sẵn từ mục tiêu', /đã lấy sẵn từ mục tiêu/.test(nhan), nhan.slice(0, 120));
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
