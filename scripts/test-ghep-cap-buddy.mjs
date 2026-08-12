// Kiểm thuật toán ghép cặp thuần — chạy: node test-ghep-cap.mjs
import {ghepCapBuddy} from '../lib/buddy-pair.ts';

const kq = [];
const ck = (ten, dat, chiTiet) => kq.push({ten, dat, chiTiet});

// 1. Số chẵn: mọi em có đúng một bạn, đối xứng.
{
  const em = ['a', 'b', 'c', 'd', 'e', 'f'];
  const cap = ghepCapBuddy(em, new Map());
  const doiXung = em.every((x) => cap.get(cap.get(x)) === x);
  ck('Số chẵn (6 em) — mọi cặp đối xứng', doiXung, doiXung ? 'đúng' : 'sai');
  ck('Số chẵn — mọi em có bạn', em.every((x) => cap.has(x) && cap.get(x) !== x), 'ok');
}

// 2. Số lẻ: bộ ba xếp vòng, vẫn mỗi em đúng một bạn.
{
  const em = ['a', 'b', 'c', 'd', 'e'];
  const cap = ghepCapBuddy(em, new Map());
  const duMoiEm = em.every((x) => cap.has(x) && cap.get(x) !== x);
  ck('Số lẻ (5 em) — mọi em vẫn có đúng 1 bạn', duMoiEm, duMoiEm ? 'đúng' : 'sai');
}

// 3. Tránh lặp bạn tuần trước khi còn cách khác (lớp đủ lớn).
{
  const em = Array.from({length: 10}, (_, i) => `s${i}`);
  const tuanTruoc = new Map();
  for (let i = 0; i < 10; i += 2) {
    tuanTruoc.set(em[i], em[i + 1]);
    tuanTruoc.set(em[i + 1], em[i]);
  }
  let trung = 0;
  for (let lan = 0; lan < 30; lan++) {
    const cap = ghepCapBuddy(em, tuanTruoc, Math.random);
    for (const x of em) if (cap.get(x) === tuanTruoc.get(x)) trung++;
  }
  ck(
    'Lớp 10 em — tránh lặp bạn tuần trước phần lớn thời gian',
    trung < 30, // rất ít lần trùng qua 30 lượt thử (mong đợi gần 0)
    `${trung} lượt trùng / 300 khả năng`,
  );
}

// 4. Lớp < 2 em: không ghép được, trả rỗng chứ không throw.
{
  const cap = ghepCapBuddy(['a'], new Map());
  ck('1 em — trả Map rỗng, không lỗi', cap.size === 0, `size=${cap.size}`);
}

for (const r of kq) console.log(`${r.dat ? 'OK  ' : 'HỎNG'} ${r.ten} — ${r.chiTiet}`);
console.log(`\n${kq.filter((r) => r.dat).length}/${kq.length} đạt.`);
