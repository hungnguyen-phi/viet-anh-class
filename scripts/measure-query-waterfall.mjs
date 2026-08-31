// ĐẾM SỐ TRUY VẤN SUPABASE MỖI TRANG + TÌM WATERFALL (truy vấn xếp hàng chờ nhau).
//
// Vì sao cần: database không chậm (query nặng nhất ~50ms), nhưng MỖI truy vấn là một vòng đi-về
// qua mạng tới Supabase. Tám truy vấn xếp hàng = tám lần cộng dồn độ trễ. Đây là thứ ăn thời gian
// nặng nhất của app này, và là thứ người thử gọi là "bấm load rất chậm".
//
// CÁCH CHẠY:
//   node scripts/measure-query-waterfall.mjs                 # đo tất cả trang, tất cả vai
//   node scripts/measure-query-waterfall.mjs --port 6969     # đổi cổng dev server
//   node scripts/measure-query-waterfall.mjs --only /grades,/inbox
//   node scripts/measure-query-waterfall.mjs --json out.json  # xuất thêm dữ liệu thô
//
// CÁCH ĐO:
//   1. Copy scripts/measure-instrumentation.template.ts -> instrumentation.ts (gốc dự án).
//      File đó bọc global.fetch, ghi mỗi lời gọi Supabase kèm mốc bắt đầu/kết thúc vào
//      .measure/queries.ndjson. CHỈ bật khi MEASURE_SUPABASE=1.
//   2. Dựng dev server riêng một cổng với MEASURE_SUPABASE=1.
//   3. Tạo phiên đăng nhập cho từng vai bằng ADMIN API (magic link -> verifyOtp), đóng thành
//      cookie đúng định dạng @supabase/ssr.
//   4. Với mỗi trang: gọi vài lần cho ấm (dev server phải biên dịch lần đầu), rồi gọi lần ĐO.
//      Vì gọi TUẦN TỰ nên mọi dòng log rơi vào khoảng thời gian của lần gọi đó chính là truy vấn
//      của trang đó — không cần cấy id vào từng request.
//   5. Kết thúc: XOÁ instrumentation.ts khỏi gốc dự án (kể cả khi lỗi giữa chừng).
//
// ⚠ instrumentation.ts KHÔNG được commit — nó bọc global.fetch, và đã từng có lần một bản bọc
//   fetch làm hỏng đăng nhập trên production. Script này tự dọn; nếu bị Ctrl-C thì xoá tay.

import {createClient} from '@supabase/supabase-js';
import {spawn} from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs';

// ---------- tham số ----------
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const PORT = Number(arg('--port', '6969'));
const BASE = `http://127.0.0.1:${PORT}`;
const ONLY = arg('--only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const JSON_OUT = arg('--json', '');
const KEEP = argv.includes('--keep-server'); // để server sống sau khi đo (gỡ lỗi)

// TIỀN TỐ NGÔN NGỮ khi gọi trang.
//
// Vì sao mặc định là '/en': ở DEV (turbopack), đường dẫn KHÔNG có tiền tố (tiếng Việt — locale
// mặc định, localePrefix 'as-needed') bị next-intl trả 307 về chính nó → vòng lặp, không render
// nổi trang nào. Đây là lỗi CHỈ có ở dev: bản chạy thật https://class.truongvietanh.com/login trả 200.
// Đường dẫn có tiền tố '/en' thì dev render bình thường, và SỐ TRUY VẤN không phụ thuộc ngôn ngữ
// (locale chỉ đổi chuỗi hiển thị), nên đo bằng '/en' cho ra đúng con số cần biết.
// Đặt --prefix '' để đo đường dẫn tiếng Việt (dùng khi đo trên bản build thật).
const PREFIX = argv.includes('--prefix') ? arg('--prefix', '') : '/en';

const ROOT = process.cwd();
// Hai file phải nằm ở GỐC dự án lúc đo, và phải bị xoá sau khi đo.
const COPIES = [
  ['scripts/measure-instrumentation.template.ts', 'instrumentation.ts'],
  ['scripts/measure-instrumentation-node.template.ts', 'instrumentation-node.ts'],
];
const LOG = '.measure/queries.ndjson';

// ---------- env ----------
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SERVICE || !ANON) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANON trong .env.local');
  process.exit(1);
}
const REF = new URL(SUPA_URL).hostname.split('.')[0];

// ---------- vai đo ----------
const ACCOUNTS = {
  teacher: 'test1.gvcn@truongvietanh.com',
  student: 'test1.hs@student.truongvietanh.com',
  parent: 'test1.ph@truongvietanh.com',
  principal: 'bgh@truongvietanh.com',
  admin: 'admin@truongvietanh.com',
};

// Trang nào đo với vai nào. Vai đầu tiên là vai "chính chủ" của trang.
const PAGES = [
  ['/', ['teacher', 'admin']],
  ['/roster', ['teacher']],
  ['/attendance', ['teacher', 'student']],
  ['/wig', ['teacher']],
  ['/scoreboard', ['teacher']],
  ['/timetable', ['teacher', 'parent', 'student']],
  ['/homework', ['teacher', 'student', 'parent']],
  ['/grades', ['teacher', 'parent']],
  ['/inbox', ['teacher', 'parent']],
  ['/menu', ['teacher', 'parent']],
  ['/gallery', ['teacher', 'parent']],
  ['/report', ['parent', 'teacher']],
  ['/student', ['student']],
  ['/campus', ['principal']],
  ['/admin', ['admin']],
  ['/subjects', ['admin']],
];

// ---------- phiên đăng nhập ----------
const admin = createClient(SUPA_URL, SERVICE, {
  auth: {autoRefreshToken: false, persistSession: false},
});

async function sessionFor(email) {
  const {data, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const anon = createClient(SUPA_URL, ANON, {
    auth: {autoRefreshToken: false, persistSession: false},
  });
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: data.properties.hashed_token,
  });
  if (e2) throw new Error(`verifyOtp(${email}): ${e2.message}`);
  return v.session;
}

// @supabase/ssr lưu phiên thành cookie base64, cắt khúc khi dài (>3180 ký tự).
function cookieHeader(session) {
  const raw = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const name = `sb-${REF}-auth-token`;
  if (raw.length <= 3180) return `${name}=${raw}`;
  const parts = [];
  for (let i = 0; i * 3180 < raw.length; i++) {
    parts.push(`${name}.${i}=${raw.slice(i * 3180, (i + 1) * 3180)}`);
  }
  return parts.join('; ');
}

// ---------- đọc log theo cửa sổ ----------
function logSize() {
  try {
    return statSync(LOG).size;
  } catch {
    return 0;
  }
}
function readLogFrom(offset) {
  const size = logSize();
  if (size <= offset) return [];
  const fd = openSync(LOG, 'r');
  const buf = Buffer.alloc(size - offset);
  readSync(fd, buf, 0, buf.length, offset);
  closeSync(fd);
  return buf
    .toString('utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------- phân tích waterfall ----------
// ĐỢT (wave) = một lượt đi-về mạng mà các truy vấn trong đó chạy CHỒNG lên nhau.
// Một truy vấn mở đợt MỚI nếu nó bắt đầu SAU khi mọi truy vấn của đợt trước đã xong.
// Số đợt chính là số lần người dùng phải chờ nối tiếp — càng nhiều đợt càng chậm.
const EPS = 3; // ms — sai số cho phép khi coi hai truy vấn là "cùng phóng đi một lượt"

function analyse(rows) {
  const qs = rows.slice().sort((a, b) => a.t0 - b.t0);
  if (qs.length === 0) {
    return {n: 0, waves: [], nWaves: 0, span: 0, slowest: null, dbTime: 0, sumDur: 0};
  }
  const waves = [];
  let cur = {items: [], start: qs[0].t0, end: qs[0].t1};
  for (const q of qs) {
    if (cur.items.length > 0 && q.t0 >= cur.end - EPS) {
      waves.push(cur);
      cur = {items: [q], start: q.t0, end: q.t1};
    } else {
      cur.items.push(q);
      cur.start = Math.min(cur.start, q.t0);
      cur.end = Math.max(cur.end, q.t1);
    }
  }
  waves.push(cur);

  const span = qs[qs.length - 1].t1 - qs[0].t0; // từ truy vấn đầu tới truy vấn cuối
  const sumDur = qs.reduce((s, q) => s + q.dur, 0);
  const dbTime = waves.reduce((s, w) => s + (w.end - w.start), 0); // thời gian THẬT phải chờ DB
  const slowest = qs.reduce((a, b) => (b.dur > a.dur ? b : a));

  // CHUỖI XẾP HÀNG DÀI NHẤT (chainDepth).
  //
  // Đếm "đợt" ở trên có một điểm mù: một truy vấn CHẬM chạy song song sẽ kéo dài đợt, nuốt luôn
  // cả một chuỗi ngắn xếp hàng bên trong nó — nhìn ra 1 đợt trong khi thật ra là 3 lượt nối
  // nhau. Chỉ số này không bị đánh lừa: với mỗi truy vấn, độ sâu = 1 + độ sâu lớn nhất của
  // những truy vấn đã KẾT THÚC TRƯỚC KHI nó bắt đầu. Số lớn nhất chính là số vòng mạng mà người
  // dùng buộc phải chờ nối tiếp nhau — con số cần kéo xuống.
  const depth = qs.map(() => 1);
  const prev = qs.map(() => -1);
  for (let i = 0; i < qs.length; i++) {
    for (let j = 0; j < i; j++) {
      if (qs[j].t1 <= qs[i].t0 + EPS && depth[j] + 1 > depth[i]) {
        depth[i] = depth[j] + 1;
        prev[i] = j;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < qs.length; i++) if (depth[i] > depth[best]) best = i;
  const chain = [];
  for (let i = best; i >= 0; i = prev[i]) chain.unshift(qs[i]);
  const chainDepth = depth[best];
  const chainTime = chain.reduce((s, q) => s + q.dur, 0);

  return {
    n: qs.length,
    waves,
    nWaves: waves.length,
    span,
    sumDur,
    dbTime,
    slowest,
    chainDepth,
    chainTime,
    chain,
    qs,
  };
}

// Tìm N+1: cùng một bảng bị hỏi nhiều lần trong MỘT lần mở trang.
function findRepeats(qs) {
  const byOp = new Map();
  for (const q of qs) {
    const k = q.op;
    byOp.set(k, (byOp.get(k) ?? 0) + 1);
  }
  return [...byOp.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
}

// ---------- vòng đời dev server ----------
let child = null;
function cleanup() {
  for (const [, dest] of COPIES) {
    try {
      if (existsSync(dest)) rmSync(dest);
    } catch {
      /* ignore */
    }
  }
  if (child && !KEEP) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {stdio: 'ignore'});
      } else {
        process.kill(-child.pid, 'SIGKILL');
      }
    } catch {
      /* ignore */
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function waitReady(timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE + (PREFIX || '') + '/login', {redirect: 'manual'});
      if (r.status > 0) {
        await r.arrayBuffer();
        return true;
      }
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------- chạy ----------
console.log('Chuẩn bị: copy instrumentation đo đạc vào gốc dự án (sẽ xoá khi xong)…');
for (const [src, dest] of COPIES) copyFileSync(src, dest);
mkdirSync('.measure', {recursive: true});
writeFileSync(LOG, '');

console.log(`Dựng dev server ở cổng ${PORT} (MEASURE_SUPABASE=1)…`);
// Windows: Node 20+ không cho spawn thẳng file .cmd (EINVAL) → phải qua shell.
// Gọi trực tiếp file JS của Next để không phụ thuộc npx/cmd.
const NEXT_BIN = 'node_modules/next/dist/bin/next';
child = spawn(
  process.execPath,
  [NEXT_BIN, 'dev', '--turbopack', '-p', String(PORT), '--hostname', '127.0.0.1'],
  {
    cwd: ROOT,
    env: {...process.env, MEASURE_SUPABASE: '1', NODE_ENV: 'development'},
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  },
);
child.stdout.on('data', (b) => {
  const s = b.toString();
  if (/error|Error/.test(s)) process.stdout.write('[dev] ' + s);
});
child.stderr.on('data', (b) => process.stdout.write('[dev!] ' + b.toString()));

if (!(await waitReady())) {
  console.error('Dev server không lên được.');
  process.exit(1);
}
console.log('Dev server sẵn sàng.\n');

// Phiên cho từng vai
const cookies = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  try {
    cookies[role] = cookieHeader(await sessionFor(email));
  } catch (e) {
    console.error(`  ! không tạo được phiên cho ${role} (${email}): ${e.message}`);
  }
}
console.log('Đã có phiên cho: ' + Object.keys(cookies).join(', ') + '\n');

// '/'        + '/en' -> '/en'
// '/roster'  + '/en' -> '/en/roster'
const withPrefix = (p) => (PREFIX ? (p === '/' ? PREFIX : PREFIX + p) : p);

async function hit(path, role) {
  const res = await fetch(BASE + withPrefix(path), {
    headers: {cookie: cookies[role], 'accept-language': 'vi'},
    redirect: 'manual',
  });
  const body = await res.arrayBuffer();
  return {status: res.status, location: res.headers.get('location'), bytes: body.byteLength};
}

const results = [];
const targets = PAGES.filter(([p]) => ONLY.length === 0 || ONLY.includes(p));

for (const [path, roles] of targets) {
  for (const role of roles) {
    if (!cookies[role]) continue;
    // Ấm máy: dev server biên dịch route lần đầu (mất vài giây, không tính).
    let warm;
    try {
      warm = await hit(path, role);
      await hit(path, role);
    } catch (e) {
      console.log(`${path} [${role}] LỖI: ${e.message}`);
      continue;
    }

    // Lần ĐO — chạy 3 lượt rồi lấy lượt có dbTime TRUNG VỊ. Số truy vấn thì lượt nào cũng như
    // nhau (đó là con số cần), nhưng thời gian mạng dao động nên một lượt đơn lẻ dễ đánh lừa.
    const runs = [];
    for (let k = 0; k < 3; k++) {
      const off = logSize();
      const t0 = Date.now();
      const r = await hit(path, role);
      const wall = Date.now() - t0;
      await new Promise((res) => setTimeout(res, 120)); // chờ log ghi hết
      const rows = readLogFrom(off);
      runs.push({r, wall, ...analyse(rows)});
    }
    runs.sort((x, y) => x.dbTime - y.dbTime);
    const med = runs[1];
    const {r, wall} = med;

    results.push({
      path,
      role,
      status: r.status,
      location: r.location,
      wall,
      wallAll: runs.map((x) => x.wall),
      nAll: runs.map((x) => x.n),
      bytes: r.bytes,
      ...med,
      repeats: findRepeats(med.qs ?? []),
    });
    const a = med;
    const spread = a.nAll && new Set(med.nAll ?? []).size > 1 ? ` (số truy vấn dao động: ${med.nAll})` : '';
    const note =
      (r.status >= 300 && r.status < 400 ? ` → ${r.status} ${r.location}` : warm.status !== r.status ? ` (!${r.status})` : '') +
      spread;
    console.log(
      `${path.padEnd(12)} ${role.padEnd(10)} ${String(a.n).padStart(3)} truy vấn · ` +
        `${String(a.nWaves).padStart(2)} đợt · chuỗi ${String(a.chainDepth).padStart(2)} · ` +
        `DB ${String(Math.round(a.dbTime)).padStart(5)}ms · tổng ${String(wall).padStart(5)}ms${note}`,
    );
  }
}

// ---------- báo cáo ----------
console.log('\n\n================ BẢNG TỔNG HỢP ================');
console.log(
  'trang'.padEnd(12),
  'vai'.padEnd(10),
  'truy vấn'.padStart(9),
  'đợt'.padStart(5),
  'chuỗi'.padStart(6),
  'DB(ms)'.padStart(8),
  'tổng(ms)'.padStart(9),
  ' truy vấn lâu nhất',
);
for (const r of results) {
  const sl = r.slowest ? `${r.slowest.op} (${Math.round(r.slowest.dur)}ms)` : '—';
  console.log(
    r.path.padEnd(12),
    r.role.padEnd(10),
    String(r.n).padStart(9),
    String(r.nWaves).padStart(5),
    String(r.chainDepth).padStart(6),
    String(Math.round(r.dbTime)).padStart(8),
    String(r.wall).padStart(9),
    ' ' + sl,
  );
}

console.log('\n\n================ CHI TIẾT TỪNG TRANG ================');
for (const r of results) {
  console.log(`\n### ${r.path}  [${r.role}]  — ${r.n} truy vấn, ${r.nWaves} đợt, DB ${Math.round(r.dbTime)}ms / tổng ${r.wall}ms`);
  if (r.status >= 300 && r.status < 400) console.log(`   (chuyển hướng ${r.status} → ${r.location})`);
  r.waves.forEach((w, i) => {
    console.log(`  đợt ${i + 1}  (${Math.round(w.end - w.start)}ms, ${w.items.length} truy vấn)`);
    for (const q of w.items.sort((a, b) => a.t0 - b.t0)) {
      const from = q.frames?.[0] ? `   ← ${q.frames[0]}` : '';
      console.log(
        `      ${String(Math.round(q.dur)).padStart(5)}ms  ${q.method.padEnd(4)} ${q.op}` +
          `  ${(q.detail ?? '').slice(0, 90)}${from}`,
      );
    }
  });
  if (r.repeats.length) {
    console.log('  ⚠ bảng bị hỏi nhiều lần: ' + r.repeats.map(([k, n]) => `${k}×${n}`).join(', '));
  }
  console.log(
    `  ↳ chuỗi xếp hàng dài nhất: ${r.chainDepth} lượt nối tiếp (${Math.round(r.chainTime)}ms) — ` +
      r.chain.map((q) => q.op).join(' → '),
  );
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  console.log(`\nĐã ghi dữ liệu thô vào ${JSON_OUT}`);
}

cleanup();
process.exit(0);
