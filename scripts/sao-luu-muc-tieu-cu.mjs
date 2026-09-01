// SAO LƯU MÔ HÌNH MỤC TIÊU CŨ ra một tệp JSON — chạy TRƯỚC khi PA2 drop các bảng này.
//
//   node scripts/sao-luu-muc-tieu-cu.mjs [thư-mục-đích]
//
// Mặc định ghi ra ../Viet-Anh-class-sao-luu/ (NGOÀI repo — tệp chứa dữ liệu của trẻ em, không
// được commit, không được đẩy lên đâu). Chỉ SELECT; không đụng gì trong CSDL.
//
// Vì sao có tệp này: chủ dự án quyết 01/09/2026 xây lại mô hình mục tiêu và "sao lưu rồi bỏ" dữ
// liệu cũ. Bỏ thì phải có bản sao đọc lại được — không phải để di trú, mà để trả lời được câu
// "hồi tháng 8 lớp Test đặt gì" nếu có ai hỏi.
import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import pg from 'pg';

const env = {};
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!env.DATABASE_URL) {
  console.error('Thiếu DATABASE_URL trong .env.local');
  process.exit(1);
}
const dich = resolve(process.cwd(), process.argv[2] ?? '../Viet-Anh-class-sao-luu');
if (!existsSync(dich)) mkdirSync(dich, {recursive: true});

// Đúng các bảng của mô hình cũ. Thứ tự không quan trọng (chỉ đọc), nhưng liệt kê để người đọc
// biết bản sao gồm gì.
const BANG = ['wigs', 'commitments', 'lead_measures', 'lead_progress', 'wig_so_do', 'wig_meetings', 'wig_meeting_notes', 'scoreboard_entries'];

const client = new pg.Client({connectionString: env.DATABASE_URL, ssl: {rejectUnauthorized: false}});
await client.connect();
const ra = {sao_luu_luc: new Date().toISOString(), ghi_chu: 'Mô hình mục tiêu cũ (trước PA2). Chỉ để tra cứu, không di trú.', bang: {}};
for (const b of BANG) {
  const {rows: co} = await client.query(`select 1 from information_schema.tables where table_schema='public' and table_name=$1`, [b]);
  if (co.length === 0) { ra.bang[b] = {khong_ton_tai: true}; continue; }
  const {rows} = await client.query(`select * from ${b}`);
  ra.bang[b] = rows;
  console.log(`${b.padEnd(22)} ${rows.length} dòng`);
}
await client.end();

const ten = `${new Date().toISOString().slice(0, 10)}-muc-tieu-cu.json`;
const tep = resolve(dich, ten);
writeFileSync(tep, JSON.stringify(ra, null, 1), 'utf8');
console.log(`\nĐã ghi ${tep}`);
