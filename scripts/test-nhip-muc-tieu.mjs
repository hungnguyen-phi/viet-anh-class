// NHỊP CỦA MỤC TIÊU — kế hoạch có tự mâu thuẫn không (13/08/2026).
//
//   node --experimental-strip-types scripts/test-nhip-muc-tieu.mjs
//
// Chuyện thật: em đặt "từ 7 đến 9 tiết" — quãng phải đi là 2 — rồi giao cho mình "làm bài tập 4
// lần mỗi tuần", hạn bảy tuần sau. Nửa tuần là xong. App nhận nguyên, không nói một chữ. Đến lúc
// em tick hai cái thì vòng tròn nhảy 100% và nhìn như app hỏng, trong khi phép tính đúng: chính
// KẾ HOẠCH sai ngay từ lúc gõ vào.
//
// Bài này gọi ĐÚNG hàm đang chạy (`lib/wig-nhip.ts`), không chép lại phép tính — chép lại thì bài
// kiểm chỉ đang kiểm bản chép của chính nó. Node nạp thẳng .ts bằng --experimental-strip-types.
import {nhipCuaMucTieu} from '../lib/wig-nhip.ts';

const ketQua = [];
const dau = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});

// ── Chính con số đã sinh ra chuyện: quãng 2, làm 4 lần/tuần, hạn 7 tuần ──
{
  const n = nhipCuaMucTieu({quang: 2, moiTuan: 4, tuanCon: 7});
  dau('Ca thật (2 tiết · 4 lần/tuần · 7 tuần) → cảnh báo QUÁ DỄ', n.qua_de && !n.khong_kip,
    `cần ${n.tuanCan} tuần`);
  dau('… và nói đúng là 1 tuần', n.tuanCan === 1, String(n.tuanCan));
}

// ── Kế hoạch khớp: không cảnh báo gì ──
{
  const n = nhipCuaMucTieu({quang: 40, moiTuan: 5, tuanCon: 9});
  dau('Kế hoạch khớp → im lặng', !n.qua_de && !n.khong_kip, `cần ${n.tuanCan}/${9} tuần`);
}

// ── Không kịp ──
{
  const n = nhipCuaMucTieu({quang: 50, moiTuan: 2, tuanCon: 10});
  dau('Quãng quá dài so với hạn → cảnh báo KHÔNG KỊP', n.khong_kip && !n.qua_de,
    `cần ${n.tuanCan} tuần, còn 10`);
}

// ── Ranh giới: cần đúng nửa thời gian thì ĐÃ là quá dễ; hơn nửa thì thôi ──
{
  const a = nhipCuaMucTieu({quang: 5, moiTuan: 1, tuanCon: 10});
  const b = nhipCuaMucTieu({quang: 6, moiTuan: 1, tuanCon: 10});
  dau('Đúng nửa hạn → vẫn cảnh báo quá dễ', a.qua_de, `cần ${a.tuanCan}/10`);
  dau('Quá nửa hạn → thôi cảnh báo', !b.qua_de, `cần ${b.tuanCan}/10`);
}

// ── ĐANG GÕ DỞ THÌ KHÔNG PHÁN GÌ ──
// Em gõ từng ô một; bắn cảnh báo vào giữa lúc chưa đủ dữ kiện chỉ làm em tưởng mình gõ sai.
for (const [ten, o] of [
  ['chưa nhập đích', {quang: 0, moiTuan: 4, tuanCon: 7}],
  ['chưa chọn thứ nào', {quang: 2, moiTuan: 0, tuanCon: 7}],
  ['chưa chọn hạn', {quang: 2, moiTuan: 4, tuanCon: 0}],
  ['đích nhỏ hơn chỗ đang đứng', {quang: -3, moiTuan: 4, tuanCon: 7}],
]) {
  const n = nhipCuaMucTieu(o);
  dau(`Gõ dở (${ten}) → im lặng`, !n.qua_de && !n.khong_kip && n.tuanCan === 0);
}

for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
const dat = ketQua.filter((k) => k.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
