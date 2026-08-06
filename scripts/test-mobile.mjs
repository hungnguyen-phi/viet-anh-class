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
// BỔ SUNG 2026-08-06 — CHỤP LUÔN ẢNH, KHÔNG CHỈ ĐO SỐ.
//
// Bốn luật dưới đây bắt được thứ đo được thành số: tràn ngang bao nhiêu px, tương phản mấy phần,
// vùng chạm mấy pixel. Chúng KHÔNG bắt được "nhìn vào thấy sai": năm cột bóp còn 40px mỗi cột thì
// vẫn hợp lệ theo cả bốn luật, mà mở ra là không đọc nổi. Chính ghi chú ở luật 1b phía trên đã
// nói: lỗi nặng nhất của đợt trước chỉ tìm ra vì NHÌN vào ảnh.
//
// Nên mỗi trang giờ được chụp lại thành PNG (chụp hết chiều dài trang, không chỉ khung nhìn). Số
// đo dùng để KHOANH VÙNG — mở ảnh nào trước; ảnh dùng để kết luận.
//
//   node scripts/test-mobile.mjs [https://class.vietanh.org] [360,390,430] [thư-mục-ảnh]
import {readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync, mkdirSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
// Tên miền của vé đăng nhập phải LẤY TỪ BASE, không đóng cứng.
//
// Bản đầu ghi thẳng `domain: 'localhost'`. Chạy lên production thì cookie gắn nhầm tên miền,
// KHÔNG có phiên, và mọi trang lặng lẽ rơi về /login — bộ kiểm vẫn chạy, vẫn ra số, chỉ là nó
// đang đo trang đăng nhập mười bảy lần. Lần này nó báo đỏ nên lộ ra; nếu trang đăng nhập tình cờ
// sạch thì nó đã báo XANH cho một phép đo chưa từng chạm tới trang nào.
const URL_BASE = new URL(BASE);
const TEN_MIEN = URL_BASE.hostname;
const LA_HTTPS = URL_BASE.protocol === 'https:';
// Nhiều bề ngang trong MỘT lượt: mở trình duyệt và lấy vé đăng nhập là phần chậm nhất, chạy ba
// lần cho ba cỡ là trả giá đó ba lần vô ích. Vẫn nhận một số lẻ như cũ (`360`) để lệnh cũ không gãy.
const CAC_RONG = String(process.argv[3] ?? '360,390,430')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const CAO = 800;
// Ảnh chụp HẾT chiều dài trang, nhưng có trần: một trang dài 9000px thu về vừa màn hình thì chữ
// nhỏ như hạt bụi, đọc bằng mắt không ra gì. Quá trần thì cắt, và nói rõ là đã cắt.
const CAO_ANH_TOI_DA = 2000;
const THU_MUC_ANH = process.argv[4] ?? path.join(tmpdir(), 'va-anh-mobile');
// Lọc theo vai: chạy được phần đo được, thay vì chờ đủ bốn tài khoản mới đo được gì.
// `node scripts/test-mobile.mjs <base> 360,390 <thư-mục> admin`
const CHI_VAI = (process.argv[5] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
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
// MỌI LỆNH ĐỀU CÓ HẠN GIỜ.
//
// Bản trước chờ vô hạn: một lệnh không bao giờ được trả lời là cả lượt chạy đứng im, không báo
// lỗi, không thoát — đúng như lượt 2026-08-06 dừng ở ảnh thứ 16 rồi treo, nhìn từ ngoài không
// phân biệt được với "đang chạy chậm". Thà hỏng một trang và nói ra còn hơn treo cả bộ đo.
const goi = (method, params = {}, han = 30000) =>
  new Promise((ok, ng) => {
    const i = ++id;
    const dongHo = setTimeout(() => {
      cho.delete(i);
      ng(new Error(`${method} không trả lời sau ${han / 1000}s`));
    }, han);
    cho.set(i, {
      ok: (r) => { clearTimeout(dongHo); ok(r); },
      ng: (e) => { clearTimeout(dongHo); ng(e); },
    });
    sock.send(JSON.stringify({id: i, method, params}));
  });
const nghe = (ev, f) => ((sk[ev] ??= []).push(f));
await new Promise((ok) => sock.addEventListener('open', ok));

await goi('Page.enable');
await goi('Network.enable');
await goi('Runtime.enable');

// ĐẾM YÊU CẦU MẠNG ĐANG BAY, để biết lúc nào trang thật sự dựng xong.
//
// Hai cách chờ trước đó đều sai, và sai theo kiểu im lặng:
//   · chờ cứng 2,2 giây — đủ cho trang nhẹ, KHÔNG đủ cho /admin, nên cùng một trang cho ra hai
//     kết quả đo khác nhau giữa hai lượt chạy.
//   · chờ tới khi chiều cao trang không đổi — trang này dùng Suspense với fallback={null}, nghĩa
//     là trong lúc chờ máy chủ đẩy dữ liệu về thì KHÔNG có gì được vẽ ra cả. Trang đứng yên ở
//     800px, "ổn định" ngay lập tức, và bộ đo chụp lại một trang gần như trống rồi báo 0 lỗi.
//     Lượt chạy 2026-08-06 báo "390px và 430px sạch tuyệt đối" đúng vì lý do đó.
// Luồng RSC giữ kết nối mở cho tới khi đẩy xong mảnh cuối, nên "không còn yêu cầu nào đang bay"
// là mốc trung thực nhất mà không cần biết gì về bên trong ứng dụng.
let dangBay = 0;
nghe('Network.requestWillBeSent', () => dangBay++);
nghe('Network.loadingFinished', () => dangBay--);
nghe('Network.loadingFailed', () => dangBay--);
const choMangLang = async ({sanNha = 1200, tran = 20000, lang = 800} = {}) => {
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
// mobile: true — media query, touch và `hover: none` đều theo đúng điện thoại, không phải
// một cửa sổ desktop bị bóp hẹp. Đây là điểm khác biệt với mọi cách giả lập trước.
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
].filter(([vai]) => CHI_VAI.length === 0 || CHI_VAI.includes(vai));
if (TRANG.length === 0) {
  console.log(`SAI  Không còn trang nào sau khi lọc vai "${CHI_VAI.join(',')}".`);
  donDep();
  process.exit(1);
}

mkdirSync(THU_MUC_ANH, {recursive: true});
const tenAnh = (rong, vai, duong) =>
  `${rong}-${vai}-${duong === '/' ? 'trang-chu' : duong.slice(1).replace(/\//g, '_')}.png`;

// Chụp HẾT chiều dài trang.
//
// Page.captureScreenshot mặc định chỉ lấy đúng khung nhìn 800px — tức là cắt mất phần dưới của
// mọi trang, mà lỗi bố cục thì hay nằm ở cuối. Cách chắc ăn: hỏi chiều cao thật của nội dung rồi
// tạm nới khung nhìn ra bằng đúng chừng ấy, chụp, rồi trả về như cũ.
//
// deviceScaleFactor 1 lúc chụp (đo thì vẫn 2): ảnh 2× của một trang dài 2000px là 780×4000 pixel,
// thu nhỏ lại cho vừa khung đọc thì chữ nát. Ảnh 1× đọc rõ hơn hẳn — mà việc của ảnh này là để
// ĐỌC, không phải để in.
const chupAnh = async (rong, ten) => {
  // Chiều cao lấy từ scrollHeight của chính trang, KHÔNG lấy từ Page.getLayoutMetrics.
  //
  // cssContentSize trả về 800 (đúng bằng khung nhìn) cho phần lớn trang trong lượt chạy dài —
  // và 800 là con số trông rất hợp lý, nên ảnh cắt cụt mà không ai nghi ngờ gì: 44/51 ảnh của
  // lượt trước là ảnh cắt ngang bụng, trong đó có TOÀN BỘ cỡ 430. scrollHeight thì không nói dối.
  // Đo tới ĐÁY THẬT của nội dung, không tin scrollHeight.
  //
  // scrollHeight trả về đúng 800 — bằng chằn chặn khung nhìn — cho /admin ở 430px, trong khi ảnh
  // chụp cho thấy trang còn dài tiếp phía dưới. Xảy ra khi html/body bị đặt chiều cao 100%: phần
  // nội dung tràn ra không làm scrollHeight lớn lên. Và 800 là con số trông hợp lý tới mức ảnh
  // cắt cụt vẫn lọt qua mắt.
  // Lấy mép dưới xa nhất trong số mọi thẻ con thì không có cách nào nói dối.
  //
  // GIỚI HẠN ĐÃ BIẾT: cách này ĐO THỪA. Có một thẻ cao 2178px trên mọi trang mà ba lớp lọc dưới
  // đây chưa bắt được, nên nhiều ảnh dư khoảng trắng ở cuối. Chấp nhận: thừa thì chỉ tốn chỗ,
  // còn thiếu thì cắt mất nội dung — mà cắt mới là kiểu hỏng đã lừa được cả một lượt audit.
  const {result: rCao} = await goi('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      let day = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const y = window.scrollY;
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        // Bỏ qua fixed VÀ absolute: thanh nav, ngăn kéo, lớp phủ đóng sẵn đều nằm ngoài dòng
        // chảy của trang. Tính chúng vào thì MỌI trang đều ra đúng một chiều cao (2178px) — con
        // số của thứ cao nhất trên màn, không phải của nội dung.
        // Bỏ qua fixed/absolute (thanh nav, lớp phủ) VÀ những gì bị đẩy ra ngoài mép ngang —
        // ngăn kéo menu off-canvas nằm ở translate-x-full vẫn có hộp cao 2178px, nên tính nó vào
        // là MỌI trang đều ra đúng một chiều cao 2178px: con số của cái ngăn kéo, không phải của
        // trang.
        const vt = getComputedStyle(el).position;
        const trongTam = r.left < window.innerWidth && r.right > 0;
        if (r.height > 0 && r.width > 0 && trongTam && vt !== 'fixed' && vt !== 'absolute')
          day = Math.max(day, r.bottom + y);
      }
      return day;
    })()`,
  });
  const caoThat = Math.ceil(rCao.value);
  const cao = Math.min(caoThat, CAO_ANH_TOI_DA);
  await goi('Emulation.setDeviceMetricsOverride', {width: rong, height: cao, deviceScaleFactor: 1, mobile: true});
  const {data} = await goi('Page.captureScreenshot', {format: 'png'});
  await goi('Emulation.setDeviceMetricsOverride', {width: rong, height: CAO, deviceScaleFactor: 2, mobile: true});
  writeFileSync(path.join(THU_MUC_ANH, ten), Buffer.from(data, 'base64'));
  return {caoThat, biCat: caoThat > CAO_ANH_TOI_DA};
};

const loi = {tran: [], thoat: [], contrast: [], cham: []};
const theoRong = new Map(); // rộng → {tran, thoat, contrast, cham}
let soLanGoIntro = 0;
const trangHong = [];
const anhDaChup = [];
const biCat = [];

for (const RONG of CAC_RONG) {
  await goi('Emulation.setDeviceMetricsOverride', {width: RONG, height: CAO, deviceScaleFactor: 2, mobile: true});
  const dem = {tran: 0, thoat: 0, contrast: 0, cham: 0};
  let vaiCu = null;
  for (const [vai, duong] of TRANG) {
    if (vai !== vaiCu) {
      const [n, v] = ve[vai].split('=');
      await goi('Network.clearBrowserCookies');
      await goi('Network.setCookie', {name: n, value: v, domain: TEN_MIEN, path: '/', secure: LA_HTTPS});
      vaiCu = vai;
    }
    try {
    // Page.loadEventFired cũng phải có hạn: trang không bắn sự kiện load (ảnh treo, font chờ mãi)
    // là đứng đây vĩnh viễn.
    const xong = Promise.race([
      new Promise((ok) => nghe('Page.loadEventFired', ok)),
      new Promise((ok) => setTimeout(() => ok('quá-hạn'), 25000)),
    ]);
    await goi('Page.navigate', {url: BASE + duong});
    if ((await xong) === 'quá-hạn') console.log(`   ! ${duong} [${vai}] không bắn sự kiện load sau 25 giây.`);
    // CHỜ TRANG YÊN, không chờ một con số giây cố định.
    //
    // 2,2 giây là đủ cho trang nhẹ và KHÔNG đủ cho /admin (nhiều mảnh Suspense, mỗi mảnh một
    // truy vấn qua đường truyền trung vị 251 ms). Hậu quả không phải là "đo thiếu" mà là "đo ra
    // số khác nhau mỗi lượt": cùng /admin ở 390px, lượt này 3 lỗi thoát thẻ và 12 vùng chạm nhỏ,
    // lượt sau 0 và 0 — vì lượt sau đo lúc bảng người dùng còn là khung xương. Một bộ đo cho hai
    // kết quả khác nhau trên cùng một trang thì không dùng để kết luận được gì.
    //
    // Yên = mạng lặng (xem choMangLang) rồi mới đến lượt kiểm khung xương còn sót.
    const kipGio = await choMangLang();
    if (!kipGio) console.log(`   ! ${duong} [${vai}] còn yêu cầu mạng sau 20 giây — đo trong trạng thái dở dang.`);
    await goi('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        for (let i = 0; i < 20 && document.querySelectorAll('[aria-busy="true"]').length; i++)
          await new Promise((r) => setTimeout(r, 200));
        return document.querySelectorAll('[aria-busy="true"]').length;
      })()`,
    });
    const {result: rUrl} = await goi('Runtime.evaluate', {expression: 'location.pathname', returnByValue: true});
    // Rơi về /login = vé đăng nhập không ăn. Dừng ngay, đừng đo tiếp mười sáu trang đăng nhập.
    if (/\/login$/.test(rUrl.value) && !/\/login$/.test(duong)) {
      console.log(`SAI  Vé đăng nhập không ăn: ${duong} [${vai}] bị đẩy về ${rUrl.value}.`);
      console.log('     Kiểm lại tên miền cookie / đồng hồ máy / vé đã hết hạn chưa.');
      sock.close();
      donDep();
      process.exit(1);
    }
    // ĐĂNG NHẬP ĐƯỢC NHƯNG KHÔNG CÓ QUYỀN — cũng phải dừng, vì lý do y hệt.
    //
    // Vé vẫn ăn, trang vẫn trả 200, chỉ có điều mọi đường dẫn đều bị đẩy sang /unauthorized và
    // mười sáu lượt đo đều đo đúng MỘT màn "Tài khoản chưa được cấp quyền". Lượt chạy 2026-08-06
    // đã đi trọn như vậy rồi in ra bốn dòng OK — sạch sẽ, và vô nghĩa. Bản trước chỉ canh /login
    // nên không thấy; ba tài khoản thử lúc ấy đã bị hạ về vai 'pending' từ lúc nào không rõ.
    if (/\/unauthorized$/.test(rUrl.value)) {
      console.log(`SAI  Tài khoản [${vai}] đang ở vai "chờ cấp quyền": ${duong} bị đẩy sang /unauthorized.`);
      console.log(`     Không đo được gì cho vai này. Cấp lại vai cho ${TK[vai]} rồi chạy lại.`);
      sock.close();
      donDep();
      process.exit(1);
    }
    // Gỡ lớp phủ onboarding TRƯỚC KHI đo và chụp.
    //
    // Hồ sơ trình duyệt mới tinh mỗi lượt chạy, mà cờ "đã xem" nằm ở DB (profiles.intro_seen) —
    // nên mọi trang đều mở kèm hộp "Chào mừng đến Việt Anh Class!" phủ kín và làm MỜ cả trang
    // phía sau. Ảnh chụp ra là ảnh cái hộp ấy, còn số đo tương phản là đo chữ đã bị làm mờ.
    // Gỡ thẳng nút DOM chứ không bấm "Bỏ qua": bấm là ghi intro_seen=true vào hồ sơ người ta,
    // một bài kiểm không được phép để lại dấu vết trên tài khoản nó mượn.
    const {result: rGo} = await goi('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        let n = 0;
        for (const el of document.querySelectorAll('[role="dialog"]')) {
          const c = (el.className || '').toString();
          if (c.includes('fixed') && c.includes('inset-0')) { el.remove(); n++; }
        }
        // MỞ HẾT MỤC GẤP LẠI.
        //
        // Màn Quản trị gấp sẵn bốn mục (<details>), trong đó có đúng bảng "Đã khai sẵn" vừa dựng
        // lại. Nội dung mục đóng thì trình duyệt không dựng hộp cho nó — mắt không thấy, mà bốn
        // luật đo cũng không thấy. Đo một trang gấp kín rồi kết luận "sạch" là đo cái vỏ.
        for (const d of document.querySelectorAll('details')) d.open = true;
        return n;
      })()`,
    });
    if (rGo.value > 0) soLanGoIntro++;
    const {result} = await goi('Runtime.evaluate', {expression: DO, returnByValue: true});
    const k = result.value;
    const nhan = `${RONG}px ${duong} [${vai}]`;
    for (const x of k.tranPhai) loi.tran.push(`${nhan} ${x.tag}.${x.cls.slice(0, 24)} → ${x.phai}px`);
    for (const x of k.thoatThe) loi.thoat.push(`${nhan} ${x.tag} thò ra ${x.thoaRa}px "${x.chu}"`);
    for (const x of k.contrast) loi.contrast.push(`${nhan} "${x.chu}" ${x.tl}:1 (cần ${x.can})`);
    for (const x of k.chamNho) loi.cham.push(`${nhan} ${x.tag} ${x.w}×${x.h} "${x.ten}"`);
    // Số ĐẦY ĐỦ (soTranPhai...) chứ không phải độ dài mảng: do-mobile.js chỉ trả về sáu ví dụ đầu
    // mỗi loại. Lấy nhầm là báo "6 lỗi" cho một trang có sáu mươi.
    dem.tran += k.soTranPhai;
    dem.thoat += k.soThoatThe;
    dem.contrast += k.soContrast;
    dem.cham += k.soChamNho;

    const ten = tenAnh(RONG, vai, duong);
    const {caoThat, biCat: cat} = await chupAnh(RONG, ten);
    if (cat) biCat.push(`${ten} (${caoThat}px)`);
    anhDaChup.push(ten);
    console.log(`   ${ten}  ·  cao ${caoThat}px  ·  tràn ${k.soTranPhai} · thoát ${k.soThoatThe} · tương phản ${k.soContrast} · chạm nhỏ ${k.soChamNho}`);
    } catch (e) {
      // Một trang hỏng thì bỏ trang ấy và NÓI RA, đừng kéo cả lượt chạy xuống theo. Danh sách
      // trang hỏng được in lại ở cuối để không lẫn vào giữa năm mươi dòng tiến độ.
      trangHong.push(`${RONG}px ${duong} [${vai}] — ${e.message}`);
      console.log(`   ! ${RONG}px ${duong} [${vai}] BỎ QUA: ${e.message}`);
    }
  }
  theoRong.set(RONG, dem);
}

sock.close();
donDep();

console.log(`\nĐo mobile thật (touch + hover:none), ${TRANG.length} trang × 4 vai × ${CAC_RONG.length} cỡ:\n`);
for (const [rong, d] of theoRong)
  console.log(
    `   ${rong}px — tràn ngang ${d.tran} · thoát thẻ ${d.thoat} · tương phản ${d.contrast} · chạm nhỏ ${d.cham}`,
  );
console.log(`\n${anhDaChup.length} ảnh trong: ${THU_MUC_ANH}`);
if (soLanGoIntro > 0)
  console.log(`   (đã gỡ lớp phủ onboarding ở ${soLanGoIntro} lượt tải — không ghi gì vào hồ sơ)`);
if (trangHong.length) {
  console.log(`\n${trangHong.length} lượt KHÔNG đo được — kết quả dưới đây thiếu chừng ấy:`);
  for (const x of trangHong) console.log('   ·', x);
}
if (biCat.length) console.log(`   (cắt ở ${CAO_ANH_TOI_DA}px: ${biCat.join(', ')})`);
console.log('');

check('Không trang nào bị kéo ngang', loi.tran.length === 0, loi.tran.slice(0, 6).join(' · '));
check('Không nội dung nào thò ra ngoài thẻ chứa nó', loi.thoat.length === 0, loi.thoat.slice(0, 6).join(' · '));
check('Không chữ nào dưới ngưỡng tương phản', loi.contrast.length === 0, loi.contrast.slice(0, 6).join(' · '));
check('Không vùng chạm nào dưới 24×24', loi.cham.length === 0, loi.cham.slice(0, 6).join(' · '));

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
