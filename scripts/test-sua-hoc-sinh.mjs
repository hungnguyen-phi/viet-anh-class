// SỬA THÔNG TIN HỌC SINH NGAY TRÊN DANH SÁCH LỚP — đủ CRUD, không phải xoá đi ghi danh lại.
//
// Vì sao có file này: chủ dự án chỉ ra danh sách lớp mới có THÊM và XOÁ, "chưa có sửa thông tin
// học sinh… có xóa, có sửa,… đủ crud". Gõ nhầm một chữ trong tên hay phụ huynh đổi số điện thoại
// thì cách duy nhất trước đây là xoá em ra rồi ghi danh lại — mà xoá em đã có tài khoản là đụng
// tới điểm danh, WIG, biên bản họp của em. Nên thực tế không ai sửa, thông tin sai nằm lại.
//
// Phép kiểm này đi ĐÚNG đường người dùng đi: mở trang thật, bấm nút bút chì, gõ vào ô, bấm Lưu,
// rồi soi lại CẢ hai đầu — màn hình có hiện giá trị mới không, và hàng trong CSDL có đúng không.
// Soi mỗi màn hình thì không phân biệt được "đã lưu" với "chỉ vẽ ra cho đẹp".
//
// TRẢ NGUYÊN HIỆN TRẠNG: chạy được thẳng lên production nên nó ghi vào dữ liệu thật của một em
// thật. Cuối lượt, giá trị cũ được ghi lại y như trước — kể cả khi phép kiểm giữa chừng báo đỏ.
//
//   node scripts/test-sua-hoc-sinh.mjs [http://localhost:6871]
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

// Tìm một lớp có GVCN và có ít nhất một em — KHÔNG đóng cứng lớp hay email nào, dữ liệu đổi lúc
// nào không ai báo (bài học đã ghi trong test-admin-man.mjs).
const {data: lops} = await admin
  .from('classes')
  .select('id, name, homeroom_teacher_id')
  .not('homeroom_teacher_id', 'is', null);
let lop = null, emEmail = null;
for (const c of lops ?? []) {
  const {data: g} = await admin.from('pending_user_grants').select('email').eq('class_id', c.id).eq('role', 'student').limit(1);
  if ((g ?? []).length) { lop = c; emEmail = g[0].email.toLowerCase(); break; }
}
if (!lop) {
  console.log('BỎ QUA: không có lớp nào đang có học sinh được mời để thử sửa.');
  process.exit(0);
}
const {data: gv} = await admin.from('profiles').select('email').eq('id', lop.homeroom_teacher_id).single();

// Hiện trạng để trả lại sau khi thử.
const {data: truoc} = await admin
  .from('student_details')
  .select('email, full_name, student_code, date_of_birth, parent_phone, note')
  .eq('email', emEmail)
  .maybeSingle();

const traLai = async () => {
  if (truoc) {
    await admin.from('student_details').upsert({...truoc, updated_at: new Date().toISOString()}, {onConflict: 'email'});
  } else {
    await admin.from('student_details').delete().eq('email', emEmail);
  }
};

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
  console.log('BỎ QUA: không tìm thấy Edge/Chrome trên máy này.');
  process.exit(0);
}
const CONG = 9300 + Math.floor(Math.random() * 600);
const hoSo = mkdtempSync(path.join(tmpdir(), 'va-sua-'));
const proc = spawn(BIN, ['--headless=new', `--remote-debugging-port=${CONG}`, `--user-data-dir=${hoSo}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1400,900', 'about:blank'], {stdio: 'ignore'});
process.on('exit', () => {
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

const chay = async (bt) => (await goi('Runtime.evaluate', {expression: bt, returnByValue: true, awaitPromise: true})).result.value;
const doi = async (bt, han = 60) => {
  for (let i = 0; i < han; i++) { const r = await chay(bt); if (r) return r; await new Promise((r) => setTimeout(r, 1000)); }
  return null;
};

// Giá trị thử: có dấu tiếng Việt (bắt lỗi mã hoá) và một con số duy nhất để không nhầm với dữ
// liệu sẵn có. Không dùng Date.now() ở nơi khác được nên gói luôn vào đây.
const DAU = `Kiểm tự động ${Date.now()}`;
const MA_THU = `TEST-${String(Date.now()).slice(-6)}`;

try {
  await goi('Page.navigate', {url: `${BASE}/vi/roster?class=${lop.id}`}, 180000);
  ok('Mở được danh sách lớp', !!(await doi(`document.querySelector('h1') ? 'co' : ''`, 90)), lop.name);

  // Bấm lại cho tới khi panel thật sự mở: trang dựng xong rất nhanh nhưng React chưa gắn xong tay
  // nghe, cú bấm đầu rơi vào một cái nút chưa biết nghe (đúng bẫy đã dính ở test-o-so.mjs).
  const idO = `#sua-${emEmail.replace(/[^a-z0-9]/gi, '')}-note`;
  let moPanel = false;
  for (let i = 0; i < 30 && !moPanel; i++) {
    // Bấm nút Sửa CỦA ĐÚNG EM ẤY, không phải nút đầu tiên trên bảng: mỗi dòng một nút, và bấm
    // nhầm dòng thì panel mở ra của em khác — phép kiểm đi tìm ô của em mình rồi báo đỏ vì lý do
    // sai. Đã dính đúng vậy ở lượt chạy đầu.
    await chay(`(() => {
      const o = [...document.querySelectorAll('div')].find(d =>
        d.className.includes('border-t') && d.textContent.includes(${JSON.stringify(emEmail)}));
      const b = o && [...o.querySelectorAll('button')].find(x => (x.title || '').startsWith('Sửa thông tin'));
      if (b) b.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));
    moPanel = !!(await chay(`!!document.querySelector('${idO}')`));
  }
  ok('Có nút Sửa trên dòng học sinh và mở được bảng sửa', moPanel, emEmail);

  if (moPanel) {
    // Hỏi TRONG form của bảng sửa, không hỏi cả trang: form ghi danh ở đầu trang có một ô email
    // thật và hỏi cả trang thì luôn thấy nó — phép kiểm đỏ vì lý do sai.
    ok('Bảng sửa KHÔNG có ô email sửa được — email là danh tính',
      !(await chay(`(() => {
        const f = document.querySelector('${idO}').closest('form');
        return !!f.querySelector('input[name=email]:not([type=hidden])');
      })()`)));

    // Gõ như người dùng gõ: đặt value rồi bắn 'input' để React nhận (setter gốc, không thì React
    // bỏ qua vì value được gán thẳng).
    const go = (sel, gt) => chay(`(() => {
      const o = document.querySelector(${JSON.stringify(sel)});
      if (!o) return '';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(o, ${JSON.stringify(gt)});
      o.dispatchEvent(new Event('input', {bubbles: true}));
      return 'ok';
    })()`);
    await go(idO, DAU);
    await go(idO.replace('-note', '-code'), MA_THU);
    await chay(`(() => {
      const f = document.querySelector('${idO}').closest('form');
      const b = [...f.querySelectorAll('button')].find(x => x.textContent.trim() === 'Lưu');
      b.click();
    })()`);

    // Chờ trang vẽ lại xong rồi mới soi — revalidatePath là một chặng mạng nữa.
    const hien = await doi(`document.body.innerText.includes(${JSON.stringify(DAU)}) ? 'co' : ''`, 30);
    ok('Ghi chú mới hiện ngay trên danh sách, không phải tải lại trang', hien === 'co', DAU);
    ok('Mã học sinh mới cũng hiện', !!(await doi(`document.body.innerText.includes(${JSON.stringify(MA_THU)}) ? 'co' : ''`, 15)), MA_THU);

    const {data: sau} = await admin
      .from('student_details')
      .select('note, student_code')
      .eq('email', emEmail)
      .maybeSingle();
    ok('CSDL đã ghi đúng ghi chú mới', sau?.note === DAU, String(sau?.note));
    ok('CSDL đã ghi đúng mã học sinh mới', sau?.student_code === MA_THU, String(sau?.student_code));

    // XOÁ TRẮNG MỘT Ô LÀ XOÁ THẬT.
    //
    // Hàm lưu lúc GHI DANH cố tình bỏ qua khi mọi ô đều trống (không tạo dòng rỗng vô nghĩa).
    // Bê nguyên luật ấy sang chỗ sửa thì gỡ một ghi chú cũ là chuyện không làm được: bấm Lưu,
    // màn hình báo đã lưu, mà chữ cũ vẫn còn — kiểu hỏng người dùng không cách nào tự hiểu.
    let moLai = false;
    for (let i = 0; i < 30 && !moLai; i++) {
      await chay(`(() => {
        const o = [...document.querySelectorAll('div')].find(d =>
          d.className.includes('border-t') && d.textContent.includes(${JSON.stringify(emEmail)}));
        const b = o && [...o.querySelectorAll('button')].find(x => (x.title || '').startsWith('Sửa thông tin'));
        if (b) b.click();
      })()`);
      await new Promise((r) => setTimeout(r, 800));
      moLai = !!(await chay(`!!document.querySelector('${idO}')`));
    }
    await go(idO, '');
    await chay(`(() => {
      const f = document.querySelector('${idO}').closest('form');
      [...f.querySelectorAll('button')].find(x => x.textContent.trim() === 'Lưu').click();
    })()`);
    await doi(`document.body.innerText.includes(${JSON.stringify(DAU)}) ? '' : 'het'`, 30);
    const {data: sauXoa} = await admin.from('student_details').select('note').eq('email', emEmail).maybeSingle();
    ok('Xoá trắng ô ghi chú thì CSDL cũng trống theo', (sauXoa?.note ?? null) === null, String(sauXoa?.note));
  }
  // ── GHI DANH VẪN CHẠY SAU KHI TÁCH NĂM Ô RA DÙNG CHUNG ───────────────────────────────────
  //
  // Năm ô thông tin nay nằm trong OThongTinHocSinh, dùng chung cho cả ghi danh lẫn sửa. Tách một
  // form đang chạy được là lúc dễ làm hỏng nó nhất, và hỏng kiểu này im: form vẫn vẽ ra đủ ô,
  // chỉ là ô không còn gửi gì lên.
  const emailThu = `kiem.tu.dong.${Date.now()}@student.truongvietanh.com`;
  const tenThu = `Kiểm Tự Động ${String(Date.now()).slice(-5)}`;
  try {
    // Form ghi danh MẶC ĐỊNH GẤP (16/08/2026) — bấm "Ghi danh học sinh" cho nó bung ra trước.
    await chay(`(() => {
      const nut = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ghi danh học sinh');
      if (nut) nut.click();
    })()`);
    await doi(`document.querySelector('#enroll-email') ? 'co' : ''`, 10);
    await chay(`(() => {
      const set = (sel, gt) => {
        const o = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(o, gt);
        o.dispatchEvent(new Event('input', {bubbles: true}));
      };
      set('#enroll-email', ${JSON.stringify(emailThu)});
      set('#enroll-name', ${JSON.stringify(tenThu)});
      set('#enroll-dob-day', '05');
      set('#enroll-dob-month', '03');
      set('#enroll-dob-year', '2013');
      document.querySelector('#enroll-email').closest('form').requestSubmit();
    })()`);
    const hienTen = await doi(`document.body.innerText.includes(${JSON.stringify(tenThu)}) ? 'co' : ''`, 30);
    ok('Ghi danh vẫn chạy: em mới hiện ngay trong danh sách', hienTen === 'co', tenThu);
    const {data: moi} = await admin
      .from('student_details')
      .select('full_name, date_of_birth')
      .eq('email', emailThu)
      .maybeSingle();
    ok('Ghi danh lưu đúng họ tên đã gõ', moi?.full_name === tenThu, String(moi?.full_name));
    // Ba ô ngày sinh phải ghép đúng thứ tự VN, không phải mm/dd.
    ok('Ghi danh lưu đúng ngày sinh 05/03/2013', moi?.date_of_birth === '2013-03-05', String(moi?.date_of_birth));
  } finally {
    await admin.from('pending_user_grants').delete().eq('email', emailThu);
    await admin.from('student_details').delete().eq('email', emailThu);
  }
} finally {
  await traLai();
  const {data: lai} = await admin.from('student_details').select('note, student_code').eq('email', emEmail).maybeSingle();
  ok('Đã trả nguyên hiện trạng cho em này',
    (lai?.note ?? null) === (truoc?.note ?? null) && (lai?.student_code ?? null) === (truoc?.student_code ?? null),
    `ghi chú=${lai?.note ?? '(trống)'}`);
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
