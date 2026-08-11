// CHIA NHỊP — kiểm bằng đơn vị, không chạm CSDL.
//
// Vì sao đáng một file riêng: hàm này quyết định "tuần này lẽ ra tới đâu" cho MỌI mục tiêu của
// MỌI lớp. Sai một chỗ làm tròn thì tổng các mốc không bằng đích năm, và cảnh báo lệch nhịp —
// thứ đắt giá nhất của cả đợt sửa — sẽ nói dối theo hướng nào không ai đoán được.
//
//   node --experimental-strip-types scripts/test-wig-nhip.mjs
import {chiaNhip} from '../lib/wig-nhip.ts';

const ketQua = [];
const kiem = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});

// ── 1. Tổng các mốc phải BẰNG ĐÚNG đích, không xê một đơn vị ────────────────────────────────
{
  const n = chiaNhip('2026-07-01', '2027-06-30', 1200);
  const tongTuan = n.tuan.reduce((s, t) => s + t.target, 0);
  const tongThang = n.thang.reduce((s, m) => s + m.target, 0);
  kiem('Tổng mốc TUẦN = đích năm', tongTuan === 1200, `được ${tongTuan}`);
  kiem('Tổng mốc THÁNG = đích năm', tongThang === 1200, `được ${tongThang}`);
  kiem('Có đủ 12 tháng', n.thang.length === 12, `được ${n.thang.length}`);
  kiem(
    'Số tuần hợp lý cho một năm học (52–54)',
    n.tuan.length >= 52 && n.tuan.length <= 54,
    `được ${n.tuan.length}`,
  );
}

// ── 2. Rải phần PHẢI ĐI THÊM, không rải cả phần đã có ───────────────────────────────────────
// Mốc tuần đo lượng làm được TRONG tuần ấy. Nếu rải cả baseline thì mọi mốc bị thổi lên và lớp
// nào cũng thấy mình tụt hậu ngay tuần đầu.
{
  const n = chiaNhip('2026-07-01', '2027-06-30', 1200 - 200);
  const tong = n.tuan.reduce((s, t) => s + t.target, 0);
  kiem('Đích 1200 với mốc xuất phát 200 → rải đúng 1000', tong === 1000, `được ${tong}`);
}

// ── 3. Không mốc nào bằng 0 — cột target_value có CHECK > 0 ─────────────────────────────────
{
  const n = chiaNhip('2026-07-01', '2027-06-30', 20); // 20 cuốn sách / ~52 tuần
  const co0 = n.tuan.some((t) => t.target <= 0);
  const tong = n.tuan.reduce((s, t) => s + t.target, 0);
  kiem('Đích nhỏ hơn số tuần: không sinh mốc 0', !co0, `${n.tuan.length} mốc`);
  kiem('Đích nhỏ hơn số tuần: vẫn rải đủ 20', tong === 20, `được ${tong}`);
  kiem(
    'Đích nhỏ hơn số tuần: chỉ chiếm 20 tuần đầu, không rải mỏng cả năm',
    n.tuan.length === 20,
    `được ${n.tuan.length}`,
  );
}

// ── 4. Mốc phải nằm GỌN trong kỳ của cha ────────────────────────────────────────────────────
// Tuần đầu và tuần cuối năm học thường hụt vài ngày. Không cắt thì mốc thò ra ngoài kỳ cha và
// mọi phép kiểm "con nằm trong cha" ở nơi khác sẽ báo lệch.
{
  const n = chiaNhip('2026-07-01', '2027-06-30', 1200);
  const thoRa = n.tuan.filter((t) => t.start < '2026-07-01' || t.end > '2027-06-30');
  kiem('Không mốc tuần nào thò ra ngoài năm học', thoRa.length === 0, `${thoRa.length} mốc thò ra`);
  kiem('Tuần đầu bắt đầu đúng ngày đầu năm học', n.tuan[0].start === '2026-07-01', n.tuan[0].start);
  kiem(
    'Tuần cuối kết thúc đúng ngày cuối năm học',
    n.tuan[n.tuan.length - 1].end === '2027-06-30',
    n.tuan[n.tuan.length - 1].end,
  );
}

// ── 5. Tháng = TỔNG các tuần của nó, và mỗi tuần chỉ thuộc đúng một tháng ───────────────────
{
  const n = chiaNhip('2026-07-01', '2027-06-30', 1200);
  const gom = new Map();
  for (const t of n.tuan) {
    const k = t.start.slice(0, 7);
    gom.set(k, (gom.get(k) ?? 0) + t.target);
  }
  const lech = n.thang.filter((m) => gom.get(m.label) !== m.target);
  kiem('Mốc tháng = tổng các tuần thuộc nó', lech.length === 0, `${lech.length} tháng lệch`);
  kiem('Không tuần nào bị đếm hai lần', gom.size === n.thang.length, `${gom.size} vs ${n.thang.length}`);
}

// ── 6. Đầu vào vô lý thì trả rỗng, không ném ────────────────────────────────────────────────
{
  kiem('Đích 0 → không sinh mốc nào', chiaNhip('2026-07-01', '2027-06-30', 0).tuan.length === 0);
  kiem('Ngày cuối trước ngày đầu → rỗng', chiaNhip('2027-06-30', '2026-07-01', 100).tuan.length === 0);
}

// ── 7. Kỳ ngắn (một tháng) vẫn chạy ─────────────────────────────────────────────────────────
{
  const n = chiaNhip('2026-09-01', '2026-09-30', 100);
  const tong = n.tuan.reduce((s, t) => s + t.target, 0);
  kiem('Kỳ một tháng: rải đủ 100', tong === 100, `được ${tong}`);
  kiem('Kỳ một tháng: đúng 1 mốc tháng', n.thang.length === 1, `được ${n.thang.length}`);
}

for (const r of ketQua) console.log(`${r.dat ? 'OK  ' : 'SAI '} ${r.ten}${r.dat ? '' : `  → ${r.chiTiet}`}`);
const dat = ketQua.filter((r) => r.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
