#!/usr/bin/env node
/**
 * Chạy một file .sql thẳng lên Postgres của Supabase.
 *
 *   npm run sql -- docs/test-accounts.sql
 *
 * VÌ SAO KHÔNG DÙNG REST API: script kiểu này có `alter table ... disable trigger` và ghi vào
 * schema `auth` — cả anon key lẫn service-role key qua PostgREST đều không làm được. Bắt buộc
 * phải là kết nối Postgres trực tiếp.
 *
 * CẦN: biến DATABASE_URL trong .env.local (xem hướng dẫn khi chạy thiếu). File .env.local đã
 * nằm trong .gitignore nên chuỗi kết nối không bị đẩy lên git.
 */
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Thiếu tên file. Ví dụ:  npm run sql -- docs/test-accounts.sql');
  process.exit(1);
}
const path = resolve(process.cwd(), file);
if (!existsSync(path)) {
  console.error('Không thấy file:', path);
  process.exit(1);
}

// Đọc .env.local bằng tay — không kéo thêm thư viện chỉ để lấy một biến.
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
  console.error(`
Thiếu DATABASE_URL.

Lấy ở đâu:
  Supabase Dashboard → Project Settings → Database → Connection string → chọn tab "URI"
  → bấm "Display password" để thấy đầy đủ, rồi copy.

  Chuỗi trông như:
    postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<vùng>.pooler.supabase.com:5432/postgres

  ⚠ Dùng cổng 5432 (session mode), KHÔNG dùng 6543 (transaction mode) — cổng 6543 không
    chạy được lệnh đổi cấu trúc bảng như alter table.

Dán vào cuối file .env.local:
    DATABASE_URL=postgresql://...

  (.env.local đã nằm trong .gitignore nên mật khẩu không bị đẩy lên git.)
`);
  process.exit(1);
}

const sql = readFileSync(path, 'utf8');
const client = new pg.Client({
  connectionString: url,
  // Supabase bắt buộc TLS; chứng chỉ do họ cấp nên không cần tự kiểm chuỗi CA.
  ssl: {rejectUnauthorized: false},
});

// In một mảng bản ghi thành bảng dễ đọc trong terminal.
function inBang(rows) {
  if (!rows || rows.length === 0) return console.log('   (không có dòng nào)');
  const cols = Object.keys(rows[0]);
  const w = cols.map((c) =>
    Math.min(46, Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length))),
  );
  const cut = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? ''));
  console.log('   ' + cols.map((c, i) => cut(c, w[i]).padEnd(w[i])).join(' │ '));
  console.log('   ' + w.map((n) => '─'.repeat(n)).join('─┼─'));
  for (const r of rows) {
    console.log('   ' + cols.map((c, i) => cut(r[c], w[i]).padEnd(w[i])).join(' │ '));
  }
}

try {
  await client.connect();
  const {rows: who} = await client.query(
    'select current_database() as db, current_user as nguoi_dung, version() as phien_ban',
  );
  console.log(`Đã kết nối: ${who[0].db} · quyền ${who[0].nguoi_dung}`);
  console.log(`Chạy file : ${file}\n`);

  // pg trả về MẢNG kết quả khi chuỗi có nhiều câu lệnh.
  const kq = await client.query(sql);
  const ds = Array.isArray(kq) ? kq : [kq];

  let soLenh = 0;
  let soBang = 0;
  for (const r of ds) {
    soLenh++;
    if (r.command === 'SELECT' && r.rows?.length) {
      soBang++;
      console.log(`── Kết quả #${soBang} (${r.rows.length} dòng) ──`);
      inBang(r.rows);
      console.log();
    }
  }
  console.log(`Xong. ${soLenh} câu lệnh đã chạy.`);
  if (soBang === 0) console.log('(File này không trả về bảng nào.)');
} catch (e) {
  console.error('\n✘ LỖI — KHÔNG có gì bị ghi lại nửa vời nếu file dùng transaction.');
  console.error('  ', e.message);
  if (e.position) {
    const truoc = sql.slice(0, Number(e.position));
    console.error('   Tại dòng', truoc.split('\n').length, 'của file.');
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
