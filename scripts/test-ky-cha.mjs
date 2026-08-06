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
import {gioiHanChonKy, CUA_SO_KY, tuanTronTrongCha, thangTronTrongCha, chaPhuKy} from '../lib/dates.ts';

let dat = 0, hong = 0;
const ok = (ten, c, ghi = '') => {
  c ? dat++ : hong++;
  console.log(`${c ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// Chép ĐÚNG phép tính trong TaoWigMenu: giao của hai khoảng.
const lonHon = (a, b) => (a > b ? a : b);
const nhoHon = (a, b) => (a < b ? a : b);
const chan = (g, cha) => {
  const tc = tuanTronTrongCha(cha.start_date, cha.end_date);
  const mc = thangTronTrongCha(cha.start_date, cha.end_date);
  return {
    minTuan: tc ? lonHon(g.week.min, tc.min) : null,
    maxTuan: tc ? nhoHon(g.week.max, tc.max) : null,
    minThang: mc ? lonHon(g.month.min, mc.min) : null,
    maxThang: mc ? nhoHon(g.month.max, mc.max) : null,
  };
};

// Mốc cố định để phép kiểm không đổi kết quả theo ngày chạy.
const MOC = new Date('2026-08-06T05:00:00Z');
const g = gioiHanChonKy(MOC);

// Đúng tình huống của chủ dự án: cha là mục tiêu THÁNG 9.
const chaThang9 = {start_date: '2026-09-01', end_date: '2026-09-30'};
const c1 = chan(g, chaThang9);
// TUẦN TRỌN VẸN, không phải "ngày nằm trong cha". Tuần chứa 01/09 là 31/08→06/09, thò sang
// tháng 8 — server đòi CẢ KỲ nằm trong cha nên vẫn từ chối. Đây là lỗi tôi đã đưa lên production
// một lần, ảnh chụp bắt được: ô lịch nhận 01/09 rồi dòng dưới ghi "Tuần W36-2026 · 31/08 → 06/09".
ok('Cha là tháng 9 → lùi vào thứ Hai của tuần trọn đầu tiên (07/09)', c1.minTuan === '2026-09-07', c1.minTuan);
ok('Cha là tháng 9 → lùi vào Chủ nhật của tuần trọn cuối (27/09)', c1.maxTuan === '2026-09-27', c1.maxTuan);
ok('Không cho chọn 01/09 nữa vì tuần của nó bắt đầu từ 31/08', '2026-09-01' < c1.minTuan, `min=${c1.minTuan}`);
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
  ['đúng một tuần lịch', {start_date: '2026-09-07', end_date: '2026-09-13'}],
]) {
  const c = chan(g, cha);
  ok(`Khoảng cho phép không rỗng khi cha là ${ten}`, c.minTuan && c.minTuan <= c.maxTuan, `${c.minTuan} → ${c.maxTuan}`);
}

// Cha ngắn hơn một tuần: KHÔNG có tuần nào nằm gọn. Phải trả null để giao diện nói ra lý do, thay
// vì đưa một ô lịch khoá sạch không giải thích gì — người dùng lại bí đúng như trước.
ok(
  'Cha ngắn hơn một tuần → trả null để giao diện còn nói được lý do',
  tuanTronTrongCha('2026-09-08', '2026-09-10') === null,
);
// Cha bắt đầu giữa tháng: tháng ấy không nằm trọn, phải lùi sang tháng sau.
const mc = thangTronTrongCha('2026-09-15', '2026-12-31');
ok('Cha bắt đầu 15/09 → tháng chọn được bắt đầu từ 2026-10', mc?.min === '2026-10', String(mc?.min));
ok('Cha kết thúc 31/12 → tháng chọn được tới 2026-12', mc?.max === '2026-12', String(mc?.max));

// ── CHA CHỌN SẴN PHẢI LÀ CHA PHỦ KỲ ĐANG ĐỨNG ──────────────────────────────────────────────
//
// Đúng cảnh chủ dự án gặp ngày 06/08/2026: lớp có mục tiêu tháng 9 (tạo trước) rồi mục tiêu
// tháng 8 (tạo sau). Form lấy cha = phần tử đầu danh sách nên chọn tháng 9, ô lịch bị kéo sang
// tháng 9, và mục tiêu tuần vừa tạo rơi vào 07/09 → 13/09. Anh ấy đọc ra "chỗ tuần vẫn cứ ép
// tháng 9". Thứ tự trong danh sách KHÔNG được quyết định chuyện này.
const thang9 = {id: 't9', start_date: '2026-09-01', end_date: '2026-09-30'};
const thang8 = {id: 't8', start_date: '2026-08-01', end_date: '2026-08-31'};
ok('Đang ở tuần đầu tháng 8 → cha chọn sẵn là mục tiêu THÁNG 8', chaPhuKy([thang9, thang8], '2026-08-03')?.id === 't8',
   chaPhuKy([thang9, thang8], '2026-08-03')?.id);
ok('… kể cả khi tháng 9 đứng trước trong danh sách', chaPhuKy([thang9, thang8], '2026-08-31')?.id === 't8',
   chaPhuKy([thang9, thang8], '2026-08-31')?.id);
ok('Đang ở tuần trong tháng 9 → cha chọn sẵn là mục tiêu THÁNG 9', chaPhuKy([thang9, thang8], '2026-09-07')?.id === 't9',
   chaPhuKy([thang9, thang8], '2026-09-07')?.id);
// Không cha nào phủ: kéo TỚI TRƯỚC, không kéo ngược về một tháng đã đóng.
ok('Không cha nào phủ → lấy cha sớm nhất còn chưa kết thúc', chaPhuKy([thang9, thang8], '2026-07-06')?.id === 't8',
   chaPhuKy([thang9, thang8], '2026-07-06')?.id);
ok('Mọi cha đều đã qua → vẫn trả về một cha, không để trống', chaPhuKy([thang9, thang8], '2026-12-01') != null);
ok('Không có cha nào thì trả undefined chứ không nổ', chaPhuKy([], '2026-08-03') === undefined);

// Cha chọn sẵn ấy phải cho ra một ô lịch CHỨA tuần đang đứng — đây mới là điều người dùng thấy.
const chaTuDong = chaPhuKy([thang9, thang8], '2026-08-03');
const c3 = chan(g, chaTuDong);
ok('Ô lịch mở đúng vào tuần đang đứng (03/08), không nhảy sang tháng 9',
   c3.minTuan <= '2026-08-03' && '2026-08-03' <= c3.maxTuan, `${c3.minTuan} → ${c3.maxTuan}`);

// Cửa sổ server và cửa sổ lịch phải cùng một khai báo.
ok('Cửa sổ tuần khai đúng một chỗ', CUA_SO_KY.week.lui === 12 && CUA_SO_KY.week.toi === 12, JSON.stringify(CUA_SO_KY.week));

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
