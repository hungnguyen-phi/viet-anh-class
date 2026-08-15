// MỞ THÔNG BÁO LÀ TẮT SỐ TRÊN CHUÔNG — lái trình duyệt thật, đọc số bằng mắt máy.
//
// Vì sao có file này: trước 12/08/2026 số vàng trên chuông chỉ tắt khi bấm đúng nút "Đánh dấu đã
// đọc hết". Người dùng vào đọc hết rồi đi ra, con số vẫn còn — nó thôi mang nghĩa "có cái mới",
// thành vết bẩn dính vĩnh viễn, và lúc có thông báo mới thật thì không ai để ý nữa.
//
// VÌ SAO PHẢI LÀ TRÌNH DUYỆT THẬT, KHÔNG PHẢI fetch.
// Số nằm ở LAYOUT, việc đánh dấu chạy ở PAGE, mà hai thứ ấy dựng SONG SONG. Cách làm sai — ghi
// CSDL ngay trong lúc page render — vẫn khiến CSDL sạch, nên bài kiểm nào chỉ soi CSDL cũng báo
// xanh, trong khi trên màn số vẫn còn nguyên tới lần chuyển trang sau. Và phần tắt số là một
// useEffect: `fetch` không chạy JavaScript nên không có cách nào thấy nó. Chỉ có mở trang bằng
// trình duyệt thật, để nó tự chạy, rồi ĐỌC LẠI CON SỐ TRÊN MÀN mới trả lời được câu hỏi thật.
//
// Đường lái Edge/Chrome qua CDP mượn của scripts/test-mobile.mjs — xem ghi chú ở đó.
//
//   node scripts/test-chuong-tat-so.mjs [BASE]     mặc định http://localhost:3000
import {readFileSync, existsSync, rmSync, mkdtempSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const U = new URL(BASE);
const TEN_MIEN = U.hostname;
const LA_HTTPS = U.protocol === 'https:';
const CONG = 9300 + Math.floor(Math.random() * 600);

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

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

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});
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

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {persistSession: false},
});

// Tra theo VAI, không đóng cứng email — bài học đã ghi trong test-mobile.mjs: generateLink lặng
// lẽ TẠO MỚI người dùng khi email chưa có, để lại tài khoản ma trên production của trường.
const {data: ds} = await admin.from('profiles').select('id, email').eq('role', 'teacher').order('email');
const gv = (ds ?? []).find((u) => u.email.startsWith('test')) ?? (ds ?? [])[0];
if (!gv) {
  console.log('BỎ QUA: không có tài khoản giáo viên nào để đo.');
  process.exit(0);
}
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const VE = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

// ── GIEO ─────────────────────────────────────────────────────────────────────────────────────
// Người thật có thể đang có 0 thông báo chưa đọc, lúc ấy "chuông sạch" là xanh giả. Tự gieo 3 cái
// mang dấu ZZTEST, dọn ở cuối dù đạt hay hỏng. Bảng không cấp quyền insert cho authenticated
// (0029) — chỉ trigger SECURITY DEFINER ghi vào — nên ở đây đi bằng service_role.
const daGieo = [];
for (const i of [0, 1, 2]) {
  const {data} = await admin
    .from('notifications')
    .insert({user_id: gv.id, title: `ZZTEST-chuong-${i}`, body: 'bài kiểm tự động', link: '/wig'})
    .select('id')
    .single();
  daGieo.push(data.id);
}

const hoSo = mkdtempSync(path.join(tmpdir(), 'va-chuong-'));
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
// Chromium đẻ ra một CÂY tiến trình; proc.kill() chỉ giết cái gốc, đám con giữ nguyên cổng và hồ
// sơ nên lượt sau không mở nổi trình duyệt. Phải giết cả cây.
const donDep = () => {
  try {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    else process.kill(-proc.pid, 'SIGKILL');
  } catch {}
  try {
    proc.kill();
  } catch {}
  try {
    rmSync(hoSo, {recursive: true, force: true});
  } catch {}
};
process.on('exit', donDep);
process.on('SIGINT', () => {
  donDep();
  process.exit(130);
});

let san = false;
for (let i = 0; i < 40 && !san; i++) {
  try {
    san = (await fetch(`http://127.0.0.1:${CONG}/json/version`)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!san) {
  console.log('SAI  Không mở được trình duyệt để đo.');
  await admin.from('notifications').delete().in('id', daGieo);
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
// Mọi lệnh đều có hạn giờ: chờ vô hạn thì một lệnh không được trả lời làm cả lượt đứng im, nhìn
// từ ngoài không phân biệt được với "đang chạy chậm".
const goi = (method, params = {}, han = 30000) =>
  new Promise((ok, ng) => {
    const i = ++id;
    const dongHo = setTimeout(() => {
      cho.delete(i);
      ng(new Error(`${method} không trả lời sau ${han / 1000}s`));
    }, han);
    cho.set(i, {
      ok: (r) => {
        clearTimeout(dongHo);
        ok(r);
      },
      ng: (e) => {
        clearTimeout(dongHo);
        ng(e);
      },
    });
    sock.send(JSON.stringify({id: i, method, params}));
  });
const nghe = (ev, f) => ((sk[ev] ??= []).push(f));
await new Promise((ok) => sock.addEventListener('open', ok));
await goi('Page.enable');
await goi('Network.enable');
await goi('Runtime.enable');
await goi('Network.setExtraHTTPHeaders', {headers: {'Accept-Language': 'vi,vi-VN;q=0.9'}});

let dangBay = 0;
nghe('Network.requestWillBeSent', () => dangBay++);
nghe('Network.loadingFinished', () => dangBay--);
nghe('Network.loadingFailed', () => dangBay--);
// "Không còn yêu cầu nào đang bay" là mốc trung thực nhất: luồng RSC giữ kết nối mở tới khi đẩy
// xong mảnh cuối, còn chờ cứng vài giây thì cùng một trang cho hai kết quả giữa hai lượt chạy.
const choLang = async ({sanNha = 900, tran = 20000, lang = 900} = {}) => {
  const batDau = Date.now();
  await new Promise((r) => setTimeout(r, sanNha));
  let langTu = Date.now();
  while (Date.now() - batDau < tran) {
    if (dangBay > 0) langTu = Date.now();
    else if (Date.now() - langTu >= lang) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

for (const [n, val] of Object.entries({[`sb-${REF}-auth-token`]: VE}))
  await goi('Network.setCookie', {
    name: n,
    value: val,
    domain: TEN_MIEN,
    path: '/',
    secure: LA_HTTPS,
  });

const den = async (duong) => {
  await goi('Page.navigate', {url: BASE + duong});
  await choLang();
};
const chay = async (bieuThuc) => {
  const r = await goi('Runtime.evaluate', {expression: bieuThuc, returnByValue: true, awaitPromise: true});
  return r.result?.value;
};

// SỐ TRÊN CHUÔNG ĐỌC TỪ CÂY DOM ĐANG SỐNG, không từ chuỗi HTML lần đầu.
//
// Đây là điểm mấu chốt: sau khi useEffect chạy và router.refresh() xong, HTML gốc không đổi —
// chỉ cây DOM đổi. Đọc HTML gốc thì con số cũ còn nguyên và bài kiểm báo đỏ oan (hoặc tệ hơn:
// nếu làm sai mà đọc HTML gốc thì báo xanh oan). Lấy đúng cái nhãn trợ năng AppNav dựng ra:
// `${label} (${count})`.
const doSoChuong = () =>
  chay(`(() => {
    const a = [...document.querySelectorAll('[aria-label]')]
      .map(e => e.getAttribute('aria-label'))
      .filter(s => /[Tt]hông báo|[Nn]otification/.test(s));
    if (a.length === 0) return -1;               // không tìm thấy chuông → nói ra, đừng coi là 0
    const co = a.map(s => (s.match(/\\((\\d+)\\)/) ?? [])[1]).filter(Boolean);
    return co.length ? Math.max(...co.map(Number)) : 0;
  })()`);

try {
  // ① Có thông báo chưa đọc thì chuông PHẢI hiện số. Không xanh ở bước này thì mọi bước sau vô nghĩa.
  await den('/wig');
  const n0 = await doSoChuong();
  dat(n0 !== -1, 'tìm thấy chuông trên thanh điều hướng');
  dat(n0 >= 3, 'chuông hiện số khi có thông báo chưa đọc', `${n0} chưa đọc`);

  // ② Mở trang thông báo. KHÔNG bấm gì cả — chỉ mở, đúng như người dùng vào xem rồi đi ra.
  await den('/notifications');
  const coDu = await chay(
    `${JSON.stringify(daGieo)}.every(id => document.body.innerHTML.includes(id))`,
  );
  dat(coDu === true, 'ba thông báo vừa gieo có mặt trong danh sách');
  // ③ CÁI ĐÍCH THẬT. Chỉ mở trang xong, chưa bấm nút nào — chuông phải sạch NGAY, ngay trên chính
  // trang này, không phải đợi tới lần chuyển trang sau.
  await choLang({sanNha: 1500});
  const n1 = await doSoChuong();
  dat(n1 === 0, 'mở thông báo xong là chuông hết số NGAY (không cần bấm nút)', `còn ${n1}`);

  // ③b DẤU "MỚI" PHẢI SỐNG SÓT QUA LẦN LÀM TƯƠI. Đo SAU khi DaXem đã chạy và router.refresh()
  // đã dựng lại trang — lúc ấy trong CSDL mọi dòng đều đã đọc. Nếu nền vàng bám theo cột `read`
  // thì nó biến mất ngay trước mắt người đang đọc: vào xem thì mất luôn thứ cho biết cái nào cần
  // xem. Đo trước lúc refresh là xanh giả — chính chỗ này bắt được lỗi thật hôm 12/08.
  const damConLai = await chay(
    `document.querySelectorAll('.bg-gold\\\\/\\\\[0\\\\.06\\\\]').length`,
  );
  dat(
    Number(damConLai) >= 3,
    'dấu "mới" vẫn còn sau khi chuông đã tắt số',
    `${damConLai} dòng còn tô đậm`,
  );

  // ④ Đi sang trang khác vẫn sạch — chứng minh nó tắt vì CSDL đã đổi, không phải vì một mẹo trên
  // màn hình.
  await den('/wig');
  const n2 = await doSoChuong();
  dat(n2 === 0, 'sang trang khác chuông vẫn sạch', `còn ${n2}`);

  // ⑤ CSDL cũng phải sạch — không thì lần đăng nhập sau số quay lại.
  const {count} = await admin
    .from('notifications')
    .select('id', {count: 'exact', head: true})
    .eq('user_id', gv.id)
    .eq('read', false);
  dat(count === 0, 'CSDL không còn dòng chưa đọc nào của người này', `còn ${count}`);

  // ⑥ BẤM MỘT THÔNG BÁO thì đi đúng nơi nó trỏ. Đường này nay là <form> gọi server action rồi
  // redirect, không còn là <Link> — dễ gãy chỗ chuyển hướng mà không ai thấy.
  const {data: moi} = await admin
    .from('notifications')
    .insert({user_id: gv.id, title: 'ZZTEST-chuong-bam', body: 'bấm thử', link: '/wig/chi-tiet'})
    .select('id')
    .single();
  daGieo.push(moi.id);
  await den('/notifications');
  await chay(`(() => {
    const f = [...document.querySelectorAll('form')]
      .find(f => f.querySelector('input[name="id"]')?.value === ${JSON.stringify(moi.id)});
    f?.querySelector('button[type="submit"]')?.click();
    return Boolean(f);
  })()`);
  await choLang({sanNha: 1500});
  const noiToi = await chay('location.pathname');
  dat(
    String(noiToi).includes('/wig/chi-tiet'),
    'bấm một thông báo thì đi đúng nơi nó trỏ',
    String(noiToi),
  );
  const {data: sauBam} = await admin.from('notifications').select('read').eq('id', moi.id).single();
  dat(sauBam.read === true, 'thông báo vừa bấm được đánh dấu đã đọc');
} catch (e) {
  dat(false, 'chạy trọn bài kiểm', String(e.message ?? e));
} finally {
  await admin.from('notifications').delete().in('id', daGieo);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
donDep();
process.exit(so === kq.length ? 0 : 1);
