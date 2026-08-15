// HỌC SINH ĐĂNG NHẬP TỪ NGOÀI, CHƯA AI XẾP LỚP — phải thấy được và xếp được ngay.
//
// Vì sao có file này: một em tự đăng nhập, chủ dự án duyệt cho vai học sinh, rồi em nằm im.
// Không lớp, không màn nào liệt kê, không ai biết để xếp. Chủ dự án hỏi đúng câu ấy: "tôi duyệt
// xong ko biết rơi vào đâu, ko biết quản lí hay gán lớp ở đâu".
//
// Phép kiểm đi đúng đường người dùng đi: mở trang Quản trị bằng tài khoản quản trị thật, tìm em
// trong khối mới, chọn lớp, bấm Xếp lớp, rồi soi CẢ hai đầu — em có biến khỏi danh sách "chưa có
// lớp" không, và trong CSDL em có thật sự vào lớp không.
//
// TRẢ NGUYÊN HIỆN TRẠNG: chạy được thẳng lên production nên nó tạo một em thử rồi xoá sạch, và
// không đụng vào em thật nào.
//
//   node scripts/test-xep-lop-hoc-sinh-lo-lung.mjs [http://localhost:6871]
import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const U = new URL(BASE);

let dat = 0, hong = 0;
const ok = (ten, c, ghi = '') => {
  c ? dat++ : hong++;
  console.log(`${c ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

// ── CHỐT CHẶN: BỘ KIỂM KHÔNG ĐƯỢC ĐẺ TÀI KHOẢN ────────────────────────────────────────────
// `generateLink({type:'magiclink'})` TỰ TẠO người dùng nếu email chưa có. Gõ nhầm một địa chỉ,
// hoặc dùng một tài khoản thử đã bị xoá, là production mọc thêm một tài khoản 'pending' nằm lại
// vĩnh viễn trong khối "Ai đang chờ bạn" của màn Quản trị.
//
// Đã xảy ra thật 15/08/2026: một bài đẻ ra test2.ph@truongvietanh.com, và test-admin-man lập tức
// đỏ tám dòng vì mọi con số trên tab lệch đúng một dòng — mất một vòng đi tìm "hồi quy" không có.
{
  const gocGenLink = admin.auth.admin.generateLink.bind(admin.auth.admin);
  admin.auth.admin.generateLink = async (opts) => {
    const {data: coHoSo} = await admin
      .from('profiles')
      .select('id')
      .eq('email', opts?.email ?? '')
      .maybeSingle();
    if (!coHoSo) throw new Error(`${opts?.email}: chưa có tài khoản này — bộ kiểm KHÔNG tạo mới`);
    return gocGenLink(opts);
  };
}

const {data: qtv} = await admin.from('profiles').select('email').eq('role', 'admin').order('email').limit(1).single();
const {data: lop} = await admin.from('classes').select('id, name').eq('is_active', true).order('name').limit(1).single();

// Em thử: dựng đúng trạng thái "đã có tài khoản, vai học sinh, KHÔNG lớp nào".
//
// Dựng bằng LỜI MỜI KHÔNG KÈM LỚP rồi mới tạo tài khoản, chứ không tạo tài khoản xong sửa vai:
// cột role có chốt chặn riêng, sửa thẳng bằng khoá dịch vụ vẫn bị trigger ném lỗi, và lỗi ấy im
// nên em thử ở lại vai 'pending' — phép kiểm đi tìm em trong danh sách học sinh rồi báo đỏ vì lý
// do sai. Đã dính đúng vậy. Đường này cũng chính là đường thật: quản trị viên duyệt cho ai đó vai
// học sinh mà chưa xếp lớp.
const emailThu = `kiem.lolung.${Date.now()}@truongvietanh.com`;
await admin.from('pending_user_grants').insert({email: emailThu, role: 'student'});
const {data: taoMoi, error: loiTao} = await admin.auth.admin.createUser({
  email: emailThu,
  email_confirm: true,
  user_metadata: {full_name: 'Em Lơ Lửng Kiểm Thử'},
});
if (loiTao) {
  console.log('BỎ QUA: không tạo được tài khoản thử —', loiTao.message);
  process.exit(0);
}
const idThu = taoMoi.user.id;

const donDepDuLieu = async () => {
  await admin.from('pending_user_grants').delete().eq('email', emailThu);
  await admin.from('enrollments').delete().eq('student_id', idThu);
  await admin.from('profiles').delete().eq('id', idThu);
  await admin.auth.admin.deleteUser(idThu).catch(() => {});
};

const UNG_VIEN = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
];
const BIN = UNG_VIEN.find((p) => p && existsSync(p));
if (!BIN) {
  console.log('BỎ QUA: không tìm thấy Edge/Chrome.');
  await donDepDuLieu();
  process.exit(0);
}
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSo = mkdtempSync(path.join(tmpdir(), 'va-lolung-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSo}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1500,1000', 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    else process.kill(-proc.pid, 'SIGKILL');
  } catch {}
  try { rmSync(hoSo, {recursive: true, force: true}); } catch {}
});

try {
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
  const goi = (method, params = {}, han = 180000) => new Promise((o, ng) => {
    const i = ++id;
    const dh = setTimeout(() => { cho.delete(i); ng(new Error(`${method} không trả lời sau ${han / 1000}s`)); }, han);
    cho.set(i, {ok: (r) => { clearTimeout(dh); o(r); }, ng: (e) => { clearTimeout(dh); ng(e); }});
    sock.send(JSON.stringify({id: i, method, params}));
  });
  await new Promise((o) => sock.addEventListener('open', o));
  await goi('Page.enable'); await goi('Runtime.enable'); await goi('Network.enable');

  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: qtv.email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  const ve = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
  const TEN = `sb-${REF}-auth-token`, CO = 3180;
  const manh = ve.length <= CO ? [[TEN, ve]]
    : Array.from({length: Math.ceil(ve.length / CO)}, (_, k) => [`${TEN}.${k}`, ve.slice(k * CO, (k + 1) * CO)]);
  for (const [n, val] of manh) await goi('Network.setCookie', {name: n, value: val, domain: U.hostname, path: '/', secure: U.protocol === 'https:'});

  const chay = async (bt) => (await goi('Runtime.evaluate', {expression: bt, returnByValue: true})).result.value;
  await goi('Page.navigate', {url: `${BASE}/vi/admin`});
  // CHỜ ĐÚNG KHỐI MÌNH CẦN, không chờ email hiện ra.
  // Trang Quản trị chảy làm nhiều mảnh: bảng người dùng về trước, phần còn lại (trong đó có khối
  // này) về sau. Email của em thử có mặt trong BẢNG NGƯỜI DÙNG nên nó hiện rất sớm — lấy nó làm
  // mốc là đo lúc khối kia còn chưa dựng, rồi báo đỏ vì lý do sai. Đã dính đúng vậy.
  for (let i = 0; i < 90; i++) {
    if (await chay(`document.body.innerText.includes('Học sinh chưa vào lớp nào')`)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  ok('Có khối "Học sinh chưa vào lớp nào"', await chay(`document.body.innerText.includes('Học sinh chưa vào lớp nào')`));
  ok('Em lơ lửng hiện ra trong khối ấy',
    await chay(`!!document.querySelector('form input[name="email"][value="${emailThu}"]')`), emailThu);

  // Bấm lại tới khi form phản hồi: trang dựng nhanh nhưng React chưa gắn xong tay nghe.
  const bam = `(() => {
    const o = document.querySelector('form input[name="${emailThu}"'.replace('${emailThu}', 'email') + '][value="${emailThu}"]');
    const f = o && o.closest('form');
    if (!f) return 'không thấy form';
    const s = f.querySelector('select[name=class_id]');
    if (!s) return 'không thấy ô chọn lớp';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(s, ${JSON.stringify(lop.id)});
    s.dispatchEvent(new Event('change', {bubbles: true}));
    if (s.value !== ${JSON.stringify(lop.id)}) return 'lớp không có trong ô chọn';
    f.requestSubmit();
    return 'đã bấm';
  })()`;
  let ketBam = '';
  for (let i = 0; i < 30; i++) {
    ketBam = await chay(bam);
    if (ketBam === 'đã bấm') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  ok('Chọn được lớp và bấm Xếp lớp', ketBam === 'đã bấm', ketBam);

  // Soi CSDL: đây mới là bằng chứng, màn hình chỉ là chỗ bấm.
  let vaoLop = null;
  for (let i = 0; i < 30 && !vaoLop; i++) {
    const {data} = await admin.from('enrollments').select('class_id, is_active').eq('student_id', idThu).eq('is_active', true).maybeSingle();
    if (data) vaoLop = data;
    else await new Promise((r) => setTimeout(r, 1000));
  }
  ok('CSDL ghi nhận em đã vào đúng lớp', vaoLop?.class_id === lop.id, `${lop.name}`);

  // Hỏi ĐÚNG cái form trong khối ấy, không hỏi cả trang: email của em vẫn còn trong BẢNG NGƯỜI
  // DÙNG ở trên — đó là chuyện đúng, em vẫn tồn tại, chỉ là không còn lơ lửng nữa. Hỏi cả trang
  // thì phép kiểm báo đỏ cho một hành vi hoàn toàn đúng.
  let conLoLung = true;
  for (let i = 0; i < 20 && conLoLung; i++) {
    conLoLung = await chay(`!!document.querySelector('form input[name="email"][value="${emailThu}"]')`);
    if (conLoLung) await new Promise((r) => setTimeout(r, 1000));
  }
  ok('Xếp xong em biến khỏi khối "chưa vào lớp nào"', conLoLung === false);
} finally {
  await donDepDuLieu();
  const {data: con} = await admin.from('profiles').select('id').eq('id', idThu).maybeSingle();
  ok('Đã dọn sạch tài khoản thử', !con);
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
