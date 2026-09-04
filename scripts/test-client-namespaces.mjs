// Danh sách NAMESPACE_CHO_CLIENT trong app/[locale]/layout.tsx có còn đúng không.
//
// VÌ SAO PHẢI CÓ: layout chỉ gửi xuống trình duyệt những namespace có tên trong danh sách đó.
// Thiếu một cái là lỗi LÚC CHẠY, và chỉ nổ ở đúng màn hình dùng nó — không tsc nào bắt được,
// không lint nào thấy. Ai đó thêm useTranslations('timetable') vào một client component mới là
// đủ để trang ấy hỏng trên production trong khi máy mình chạy vẫn ổn (dev bundle khác).
//
// CÁCH LÀM: dựng lại tập cần thiết từ ĐỒ THỊ IMPORT — bắt đầu ở mọi file có 'use client', đi
// theo import nội bộ tới hết (bất cứ file nào client component import vào cũng nằm trong bundle
// client), rồi gom mọi useTranslations('X') gặp trên đường. So với danh sách trong layout.
//
// getTranslations() KHÔNG tính: nó đọc context phía máy chủ, không đụng NextIntlClientProvider.
//
// Chạy được offline, không cần server:  node scripts/test-client-namespaces.mjs
import {readdirSync, statSync, readFileSync, existsSync} from 'node:fs';
import {dirname, resolve, relative} from 'node:path';

const ROOT = process.cwd();
const LAYOUT = 'app/[locale]/layout.tsx';

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'scripts' || f === '.claude') continue;
    const p = d + '/' + f;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const files = walk(ROOT).map((f) => relative(ROOT, f).replace(/\\/g, '/'));
const src = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

/** '@/lib/x' hoặc './y' → đường dẫn thật trong repo; null nếu là gói ngoài. */
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = relative(ROOT, resolve(dirname(from), spec)).replace(/\\/g, '/');
  else return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(resolve(ROOT, base + ext))) return base + ext;
  }
  return existsSync(resolve(ROOT, base)) ? base : null;
}

const IMPORT_RE =
  /(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

function importsOf(f) {
  const out = [];
  for (const m of (src.get(f) ?? '').matchAll(IMPORT_RE)) {
    const r = resolveImport(f, m[1] ?? m[2]);
    if (r && src.has(r)) out.push(r);
  }
  return out;
}

const seeds = files.filter((f) => /^\s*['"]use client['"]/.test(src.get(f) ?? ''));
const clientGraph = new Set();
const stack = [...seeds];
while (stack.length) {
  const f = stack.pop();
  if (clientGraph.has(f)) continue;
  clientGraph.add(f);
  for (const d of importsOf(f)) stack.push(d);
}

const need = new Map();
for (const f of clientGraph) {
  for (const m of (src.get(f) ?? '').matchAll(/useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!need.has(m[1])) need.set(m[1], []);
    need.get(m[1]).push(f);
  }
}

// useTranslations() KHÔNG kèm namespace = truy cập từ gốc danh mục → danh sách hẹp không đủ nữa.
const gocTron = [...clientGraph].filter((f) => /useTranslations\(\s*\)/.test(src.get(f) ?? ''));

const layout = src.get(LAYOUT) ?? '';
const khoi = layout.match(/const NAMESPACE_CHO_CLIENT = \[([\s\S]*?)\] as const;/);
const khaiBao = khoi ? [...khoi[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : null;

let dat = 0;
let sai = 0;
function check(ten, ok, chiTiet = '') {
  if (ok) {
    dat++;
    console.log('OK   ' + ten + (chiTiet ? ' — ' + chiTiet : ''));
  } else {
    sai++;
    console.log('SAI  ' + ten + (chiTiet ? ' — ' + chiTiet : ''));
  }
}

check('Đọc được NAMESPACE_CHO_CLIENT trong layout', khaiBao !== null, khaiBao ? `${khaiBao.length} mục` : 'không tìm thấy khai báo');

if (khaiBao) {
  const canCo = [...need.keys()].sort();
  const thieu = canCo.filter((n) => !khaiBao.includes(n));
  const thua = khaiBao.filter((n) => !canCo.includes(n));

  check(
    'Không thiếu namespace nào (thiếu = lỗi lúc chạy)',
    thieu.length === 0,
    thieu.length ? thieu.map((n) => `${n} ← ${need.get(n)[0]}`).join(' · ') : `${canCo.length} namespace, đủ cả`,
  );
  check(
    'Không thừa namespace nào (thừa = gửi rác xuống trình duyệt)',
    thua.length === 0,
    thua.length ? thua.join(', ') : 'không có',
  );
  check(
    'Không có useTranslations() thiếu namespace',
    gocTron.length === 0,
    gocTron.length ? gocTron.join(', ') + ' → danh sách hẹp không đủ, phải gửi cả danh mục' : 'không có',
  );

  const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
  const tong = Buffer.byteLength(JSON.stringify(vi));
  const hep = Buffer.byteLength(
    JSON.stringify(Object.fromEntries(khaiBao.filter((n) => n in vi).map((n) => [n, vi[n]]))),
  );
  console.log(
    `\nGói gửi xuống trình duyệt: ${(hep / 1024).toFixed(1)} KB / ${(tong / 1024).toFixed(1)} KB ` +
      `(bớt ${(((tong - hep) / tong) * 100).toFixed(0)}%) · đồ thị client ${clientGraph.size} file`,
  );
}

console.log(`\n${dat}/${dat + sai} đạt.${sai ? ' ' + sai + ' SAI.' : ''}`);
process.exit(sai ? 1 : 0);
