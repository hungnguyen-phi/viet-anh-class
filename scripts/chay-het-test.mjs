#!/usr/bin/env node
/**
 * CHẠY MỘT VÒNG mọi test-*.sql lên Postgres thật rồi tổng hợp ĐẠT/HỎNG.
 *
 *   node scripts/chay-het-test.mjs                    ← chạy hết
 *   node scripts/chay-het-test.mjs cam-ket cong-don   ← chỉ file khớp từ khoá
 *
 * AN TOÀN production: MỖI file chạy trên MỘT KẾT NỐI RIÊNG, chạy NGUYÊN VĂN (giữ begin/rollback
 * của chính nó). Đóng kết nối sau mỗi file → mọi transaction còn mở TỰ ROLLBACK, không để lại gì.
 * File có COMMIT (ghi thật) hoặc lệnh psql `\` (node-pg không hiểu) bị BỎ QUA + cảnh báo — chạy tay.
 *
 * Test tự raise exception khi HỎNG (không exception = ĐẠT); NOTICE "✔ …" in kèm cho dễ đọc.
 */
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import pg from 'pg';

function docEnv() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = {...docEnv(), ...process.env};
const url = env.DATABASE_URL;
if (!url) {
  console.error('Thiếu DATABASE_URL trong .env.local.');
  process.exit(1);
}

const loc = process.argv.slice(2);
const dir = resolve(process.cwd(), 'scripts');
const files = readdirSync(dir)
  .filter((f) => /^test-.*\.sql$/.test(f))
  .filter((f) => loc.length === 0 || loc.some((k) => f.includes(k)))
  .sort();

let dat = 0;
const hong = [];
const boQua = [];
console.log(`Chạy ${files.length} test-*.sql (mỗi file một kết nối, đóng = tự rollback)\n`);

for (const f of files) {
  const sql = readFileSync(resolve(dir, f), 'utf8');
  if (/\bcommit\s*;/i.test(sql)) { boQua.push([f, 'có COMMIT']); console.log(`  ⚠ BỎ QUA ${f} (có COMMIT)`); continue; }
  if (/^\s*\\/m.test(sql))       { boQua.push([f, 'lệnh psql \\']); console.log(`  ⚠ BỎ QUA ${f} (lệnh psql \\)`); continue; }

  const client = new pg.Client({connectionString: url});
  let vet = '';
  client.on('notice', (n) => { const m = String(n.message ?? ''); if (/✔|HỎNG/.test(m)) vet = m; });
  try {
    await client.connect();
    await client.query(sql);              // nguyên văn: file tự begin…rollback
    console.log(`  ✔ ĐẠT  ${f}${vet ? '  — ' + vet : ''}`);
    dat++;
  } catch (e) {
    const msg = String(e.message).split('\n')[0];
    console.log(`  ✘ HỎNG ${f} — ${msg}`);
    hong.push([f, msg]);
  } finally {
    try { await client.end(); } catch {}  // đóng = rollback mọi txn còn mở
  }
}

console.log(`\n── TỔNG KẾT ──`);
console.log(`  ĐẠT : ${dat}/${files.length - boQua.length} (chạy được)`);
if (boQua.length) { console.log(`  BỎ QUA ${boQua.length} (chạy tay):`); for (const [f, r] of boQua) console.log(`    · ${f} — ${r}`); }
if (hong.length)  { console.log(`  HỎNG ${hong.length}:`); for (const [f, m] of hong) console.log(`    · ${f}: ${m}`); process.exit(1); }
console.log(`  ✔ KHÔNG CÓ TEST HỎNG`);
