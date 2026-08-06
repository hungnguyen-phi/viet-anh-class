// KỲ CON PHẢI NẰM TRONG KỲ CHA — kiểm phép tính chặn lịch, không cần trình duyệt.
//
// Vì sao có file này: chủ dự án tạo mục tiêu tháng cho THÁNG 9 rồi mở form tạo mục tiêu tuần
// trong lúc đang đứng ở đầu tháng 8. Ô lịch mặc định là tuần hiện tại, nằm ngoài khoảng của cha,
// nên bấm Lưu ra "Kỳ này nằm ngoài mục tiêu cha (2026-09-01 → 2026-09-30)". Câu ấy đúng nhưng
// tới quá muộn — người ta điền xong cả form rồi mới biết ô ĐẦU TIÊN đã sai.
//
// Bản sửa chặn ô lịch bằng GIAO của hai khoảng: cửa sổ server chấp nhận, và khoảng của cha. Đây
// là phép tính thuần, kiểm được bằng số — không phải dựng trình duyệt rồi đoán qua ảnh.
//
//   node scripts/test-ky-cha.mjs
import {gioiHanChonKy, CUA_SO_KY} from '../lib/dates.ts';

let dat = 0, hong = 0;
const ok = (ten, c, ghi = '') => {
  c ? dat++ : hong++;
  console.log(`${c ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// Chép ĐÚNG phép tính trong TaoWigMenu: giao của hai khoảng.
const lonHon = (a, b) => (a > b ? a : b);
const nhoHon = (a, b) => (a < b ? a : b);
const chan = (g, cha) => ({
  minTuan: lonHon(g.week.min, cha.start_date),
  maxTuan: nhoHon(g.week.max, cha.end_date),
  minThang: lonHon(g.month.min, cha.start_date.slice(0, 7)),
  maxThang: nhoHon(g.month.max, cha.end_date.slice(0, 7)),
});

// Mốc cố định để phép kiểm không đổi kết quả theo ngày chạy.
const MOC = new Date('2026-08-06T05:00:00Z');
const g = gioiHanChonKy(MOC);

// Đúng tình huống của chủ dự án: cha là mục tiêu THÁNG 9.
const chaThang9 = {start_date: '2026-09-01', end_date: '2026-09-30'};
const c1 = chan(g, chaThang9);
ok('Cha là tháng 9 → lịch tuần không cho chọn trước 01/09', c1.minTuan === '2026-09-01', c1.minTuan);
ok('Cha là tháng 9 → lịch tuần không cho chọn sau 30/09', c1.maxTuan === '2026-09-30', c1.maxTuan);
ok('Tuần hiện tại (03/08) nằm NGOÀI khoảng cho phép', '2026-08-03' < c1.minTuan, `min=${c1.minTuan}`);

// Cha là mục tiêu NĂM HỌC: khoảng rộng, nên cửa sổ server mới là thứ chặn.
const chaNam = {start_date: '2026-09-01', end_date: '2027-05-31'};
const c2 = chan(g, chaNam);
ok('Cha là năm học → chặn tháng lấy mốc muộn hơn trong hai mốc', c2.minThang === '2026-09', c2.minThang);
ok('Cha là năm học → chặn tháng lấy mốc sớm hơn trong hai mốc', c2.maxThang <= '2027-05', `${c2.maxThang} (cha hết 2027-05)`);

// Không bao giờ được sinh ra một khoảng RỖNG (min > max): trình duyệt sẽ khoá sạch ô lịch mà
// không nói gì, và người dùng lại bí đúng như trước.
for (const [ten, cha] of [
  ['tháng 9', chaThang9],
  ['năm học', chaNam],
  ['một tuần lẻ', {start_date: '2026-09-07', end_date: '2026-09-13'}],
]) {
  const c = chan(g, cha);
  ok(`Khoảng cho phép không rỗng khi cha là ${ten}`, c.minTuan <= c.maxTuan, `${c.minTuan} → ${c.maxTuan}`);
}

// Cửa sổ server và cửa sổ lịch phải cùng một khai báo.
ok('Cửa sổ tuần khai đúng một chỗ', CUA_SO_KY.week.lui === 12 && CUA_SO_KY.week.toi === 12, JSON.stringify(CUA_SO_KY.week));

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
