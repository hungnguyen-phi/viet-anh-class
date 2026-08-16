// Thêm/sửa khoá dịch ở CẢ HAI tệp messages — đối xứng với xoa-khoa-i18n.mjs.
// Dùng: node scripts/them-khoa-i18n.mjs '{"admin.mucNguoi":["Người dùng","People"]}'
import fs from 'node:fs';

const bo = JSON.parse(process.argv[2] ?? '{}');
const tep = ['messages/vi.json', 'messages/en.json'];
tep.forEach((f, idx) => {
  const goc = fs.readFileSync(f, 'utf8');
  const crlf = goc.includes('\r\n');
  const o = JSON.parse(goc);
  for (const [k, cap] of Object.entries(bo)) {
    const phan = k.split('.');
    let cha = o;
    for (const p of phan.slice(0, -1)) {
      if (typeof cha[p] !== 'object' || cha[p] == null) cha[p] = {};
      cha = cha[p];
    }
    cha[phan[phan.length - 1]] = cap[idx];
  }
  let ra = JSON.stringify(o, null, 2) + '\n';
  if (crlf) ra = ra.replace(/\n/g, '\r\n');
  fs.writeFileSync(f, ra);
  console.log(`${f}: ghi ${Object.keys(bo).length} khoá`);
});
