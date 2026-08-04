// MỌI t('…') TRÊN MÀN HÌNH CÓ CÂU CHỮ THẬT KHÔNG.
//
// VÌ SAO PHẢI CÓ: next-intl không ném lỗi lúc dựng khi thiếu khoá — nó IN RA CHÍNH TÊN KHOÁ.
// Nên một trang thiếu dịch vẫn chạy, vẫn xanh mọi phép kiểm khác, chỉ có điều giáo viên mở ra
// đọc được "wig.goalThisWeek" thay vì "Mục tiêu tuần này". Rà bằng mắt thì lần nào cũng sót:
// đợt dựng lại /wig vừa rồi thiếu 38 khoá một lúc mà tsc, eslint và build đều im lặng.
//
// Kiểm BỐN chiều, vì mỗi chiều bắt một loại lỗi khác nhau:
//   1. Khoá được gọi trong mã  →  phải có trong vi.json   (thiếu = hiện tên khoá ra màn hình)
//   2. Khoá được gọi trong mã  →  phải có trong en.json   (thiếu = trang /en hiện tên khoá)
//   3. vi.json và en.json      →  phải khớp nhau hai chiều (lệch = một bên rơi về tiếng kia)
//   4. Khoá nằm trong file dịch mà KHÔNG mã nào gọi        (rác — và là lời hứa sai rằng còn
//      màn hình nào đó dùng nó, khiến lần sau người ta đi tìm một màn hình không tồn tại)
//
// Chạy được offline, không cần server:  node scripts/test-khoa-dich.mjs
import {readdirSync, statSync, readFileSync} from 'node:fs';
import {relative} from 'node:path';

const ROOT = process.cwd();

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'scripts') continue;
    const p = d + '/' + f;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const files = walk(ROOT).map((f) => relative(ROOT, f).replace(/\\/g, '/'));
const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// ── Gom mọi lời gọi khoá ──────────────────────────────────────────────────────────────────
//
// Một file có thể mở nhiều namespace: `const t = useTranslations('wig')` và
// `const tc = useTranslations('class')`. Nên phải theo TÊN BIẾN, không thể gộp chung — gộp thì
// t('year') của namespace này lại được đối chiếu với namespace kia và báo oan.
//
// Bỏ qua lời gọi ĐỘNG (`t(bien)`, `t(\`x.${y}\`)`): không tĩnh hoá được, và đoán bừa thì phép
// kiểm này tự sinh ra báo động giả — thứ làm người ta thôi đọc kết quả.
const goi = []; // {file, ns, key}
const dungTrongMa = new Set(); // 'ns.key'
const nsCoDung = new Set();

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const bien = new Map(); // tên biến → namespace
  for (const m of src.matchAll(
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([^']+)'\s*\)/g,
  )) {
    bien.set(m[1], m[2]);
    nsCoDung.add(m[2]);
  }
  if (bien.size === 0) continue;
  const ten = [...bien.keys()].join('|');
  // t('key') và t.raw('key') — cả hai đều đọc từ file dịch.
  for (const m of src.matchAll(new RegExp(`\\b(${ten})(?:\\.raw)?\\(\\s*'([^']+)'`, 'g'))) {
    const ns = bien.get(m[1]);
    goi.push({file: f, ns, key: m[2]});
    dungTrongMa.add(`${ns}.${m[2]}`);
  }
}

const co = (obj, ns, key) => {
  const bang = obj[ns];
  if (!bang) return false;
  // Khoá lồng ('a.b') hiếm nhưng có — đi theo dấu chấm.
  let cur = bang;
  for (const p of key.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
};

// ── 1 & 2. Khoá được gọi phải có ở CẢ HAI file ───────────────────────────────────────────
for (const [ten, obj] of [
  ['vi.json', vi],
  ['en.json', en],
]) {
  const thieu = goi.filter((g) => !co(obj, g.ns, g.key));
  check(
    `Mọi khoá được gọi đều có trong ${ten}`,
    thieu.length === 0,
    thieu.length === 0
      ? `${goi.length} lời gọi`
      : thieu
          .slice(0, 12)
          .map((g) => `${g.ns}.${g.key} (${g.file})`)
          .join(', ') + (thieu.length > 12 ? ` … +${thieu.length - 12}` : ''),
  );
}

// ── 3. Hai file dịch khớp nhau hai chiều ─────────────────────────────────────────────────
const phang = (o, tien = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? phang(v, `${tien}${k}.`) : [`${tien}${k}`],
  );
const kVi = new Set(phang(vi));
const kEn = new Set(phang(en));
const thieuEn = [...kVi].filter((k) => !kEn.has(k));
const thieuVi = [...kEn].filter((k) => !kVi.has(k));
check(
  'vi.json và en.json khớp nhau hai chiều',
  thieuEn.length === 0 && thieuVi.length === 0,
  thieuEn.length + thieuVi.length === 0
    ? `${kVi.size} khoá`
    : `en thiếu [${thieuEn.slice(0, 8).join(', ')}] · vi thiếu [${thieuVi.slice(0, 8).join(', ')}]`,
);

// ── 4. Khoá nằm im trong file dịch mà không màn hình nào gọi ─────────────────────────────
//
// CHỈ soi những namespace mà mã nguồn có mở tới: một namespace chưa ai dùng thì mọi khoá của nó
// đều "thừa", báo ra chỉ tổ ồn.
//
// Đây là phép kiểm CẢNH BÁO chứ không đánh hỏng: chuỗi động (`t(\`level.${n}\`)`) là hợp lệ mà
// cách quét ở trên không thấy, nên đánh hỏng là báo động giả. In ra để người sửa tự nhìn.
const thua = [];
for (const ns of nsCoDung) {
  for (const k of Object.keys(vi[ns] ?? {})) {
    if (!dungTrongMa.has(`${ns}.${k}`)) thua.push(`${ns}.${k}`);
  }
}
if (thua.length > 0) {
  console.log(
    `\nGHI CHÚ  ${thua.length} khoá không thấy lời gọi TĨNH nào (có thể do gọi động — kiểm bằng mắt):`,
  );
  console.log('  ' + thua.join(', '));
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
