// Kiểm parseDob() — hàm đổi ba ô "ngày / tháng / năm" thành yyyy-mm-dd để lưu vào DB.
// Chạy: node scripts/test-dob.mjs
//
// Vì sao phải có test: đây là NGÀY SINH CỦA TRẺ. Sai thì không ai phát hiện — không có màn hình
// nào báo động, chỉ là một con số lệch nằm im trong hồ sơ. Ba nhóm dễ sai nhất mà bấm tay trên
// máy dev khó gặp: ngày không tồn tại (31/02), năm nhuận (29/02), và điền dở nửa vời.
//
// Import THẲNG file .ts (Node ≥22.6 tự bỏ phần kiểu) — không chép lại logic sang đây, vì bản
// chép rất dễ lệch với bản thật rồi test thành vô nghĩa.
import {parseDob} from '../lib/dob.ts';

const NAM_NAY = 2026; // cố định để test không đổi kết quả theo thời gian

const cases = [
  // [tên, {day, month, year}, kỳ vọng iso, có lỗi hay không]
  ['bỏ trống hoàn toàn → hợp lệ, không có ngày sinh', {}, null, false],
  ['bỏ trống bằng chuỗi rỗng', {day: '', month: '', year: ''}, null, false],
  ['9/3/2014 → mùng 9 tháng 3 (KHÔNG phải mùng 3 tháng 9)', {day: '9', month: '3', year: '2014'}, '2014-03-09', false],
  ['09/03/2014 có số 0 đứng đầu', {day: '09', month: '03', year: '2014'}, '2014-03-09', false],
  ['25/11/2013', {day: '25', month: '11', year: '2013'}, '2013-11-25', false],
  ['31/12/2013 — ngày cuối năm', {day: '31', month: '12', year: '2013'}, '2013-12-31', false],
  ['1/1/1900 — biên dưới', {day: '1', month: '1', year: '1900'}, '1900-01-01', false],

  // năm nhuận
  ['29/02/2016 — năm nhuận, hợp lệ', {day: '29', month: '2', year: '2016'}, '2016-02-29', false],
  ['29/02/2015 — KHÔNG nhuận, phải loại', {day: '29', month: '2', year: '2015'}, null, true],
  ['29/02/1900 — chia hết 100 nên KHÔNG nhuận', {day: '29', month: '2', year: '1900'}, null, true],
  ['29/02/2000 — chia hết 400 nên CÓ nhuận', {day: '29', month: '2', year: '2000'}, '2000-02-29', false],

  // ngày không tồn tại
  ['31/02/2014 — tháng 2 không có ngày 31', {day: '31', month: '2', year: '2014'}, null, true],
  ['31/04/2014 — tháng 4 chỉ có 30 ngày', {day: '31', month: '4', year: '2014'}, null, true],
  ['32/01/2014 — quá 31', {day: '32', month: '1', year: '2014'}, null, true],
  ['0/1/2014 — ngày 0', {day: '0', month: '1', year: '2014'}, null, true],

  // tháng / năm ngoài khoảng
  ['13/13/2014 — tháng 13', {day: '13', month: '13', year: '2014'}, null, true],
  ['1/0/2014 — tháng 0', {day: '1', month: '0', year: '2014'}, null, true],
  ['1/1/1899 — trước 1900', {day: '1', month: '1', year: '1899'}, null, true],
  ['1/1/2027 — năm tương lai', {day: '1', month: '1', year: '2027'}, null, true],

  // điền dở
  ['thiếu năm', {day: '9', month: '3'}, null, true],
  ['thiếu tháng', {day: '9', year: '2014'}, null, true],
  ['chỉ có năm', {year: '2014'}, null, true],

  // ký tự lạ
  ['năm 2 số (14) — không nhận, dễ hiểu thành 0014', {day: '9', month: '3', year: '14'}, null, true],
  ['chữ trong ô ngày', {day: 'ba', month: '3', year: '2014'}, null, true],
  ['dấu âm', {day: '-9', month: '3', year: '2014'}, null, true],
  ['khoảng trắng hai đầu vẫn nhận', {day: ' 9 ', month: ' 3 ', year: ' 2014 '}, '2014-03-09', false],
];

let sai = 0;
for (const [ten, input, isoKyVong, coLoi] of cases) {
  const kq = parseDob(input, NAM_NAY);
  const dat = kq.iso === isoKyVong && !!kq.error === coLoi;
  if (!dat) sai++;
  console.log(
    `${dat ? 'OK  ' : 'SAI '} ${ten}`,
    dat ? '' : `→ nhận iso=${JSON.stringify(kq.iso)} lỗi=${JSON.stringify(kq.error ?? null)}`,
  );
}

console.log(`\n${cases.length - sai}/${cases.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
// exitCode chứ không process.exit(): thoát ngay giữa lúc Node đang tháo phần đọc file .ts làm
// libuv báo assertion trên Windows.
process.exitCode = sai ? 1 : 0;
