// Xoá khoá dịch khỏi CẢ HAI tệp messages/vi.json và en.json — một lệnh, không sửa tay.
//
// Sửa tay từng khoá là cách đã sinh ra lỗi "dấu phẩy thừa khi xoá khoá cuối nhóm" (08/2026).
// Dùng: node scripts/xoa-khoa-i18n.mjs attendance.tickAllHint admin.grantsHint ...
// Giữ nguyên CRLF và thụt lề 2 khoảng của tệp gốc.
import fs from 'node:fs';

const khoa = process.argv.slice(2);
if (khoa.length === 0) {
  console.error('Cần ít nhất một khoá dạng nhom.ten');
  process.exit(1);
}
for (const f of ['messages/vi.json', 'messages/en.json']) {
  const goc = fs.readFileSync(f, 'utf8');
  const crlf = goc.includes('\r\n');
  const o = JSON.parse(goc);
  const daXoa = [];
  for (const k of khoa) {
    const phan = k.split('.');
    let cha = o;
    for (const p of phan.slice(0, -1)) cha = cha?.[p];
    const cuoi = phan[phan.length - 1];
    if (cha && Object.prototype.hasOwnProperty.call(cha, cuoi)) {
      delete cha[cuoi];
      daXoa.push(k);
    }
  }
  let ra = JSON.stringify(o, null, 2) + '\n';
  if (crlf) ra = ra.replace(/\n/g, '\r\n');
  fs.writeFileSync(f, ra);
  console.log(`${f}: xoá ${daXoa.length}/${khoa.length}`, daXoa.join(', '));
}
