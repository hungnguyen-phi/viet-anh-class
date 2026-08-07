// SINH SỔ TAY VẬN HÀNH (.xlsx) cho giáo viên, ban giám hiệu và quản trị viên.
//
//   npm i --no-save exceljs && node scripts/tao-so-tay-van-hanh.mjs
//
// NGUYÊN TẮC VIẾT: người đọc là thầy cô, không phải người làm phần mềm. Không có chữ kỹ thuật,
// không kể hiện trạng dữ liệu (hôm nay có mấy lớp, ai đã mời) — thứ đó đổi mỗi tuần, ghi vào là
// sổ tay sai ngay tuần sau. Chỉ giữ những gì cần để VẬN HÀNH, và giữ càng ngắn càng tốt.
//
// Nội dung lấy từ app đang chạy: quyền của từng vai, thứ tự các bước, câu chữ trên màn hình.
import ExcelJS from 'exceljs';

const NAVY = 'FF0B1F3B';
const GOLD = 'FFF9DD0E';
const NHAT = 'FFF3F6FA';

const wb = new ExcelJS.Workbook();
wb.creator = 'Trường Việt Anh';
wb.created = new Date();

function trang(ten, cot, dong, tieuDe) {
  const ws = wb.addWorksheet(ten, {views: [{state: 'frozen', ySplit: 2}]});
  ws.mergeCells(1, 1, 1, cot.length);
  const t = ws.getCell(1, 1);
  t.value = tieuDe;
  t.font = {bold: true, size: 13, color: {argb: NAVY}};
  t.alignment = {vertical: 'middle'};
  ws.getRow(1).height = 22;

  const h = ws.getRow(2);
  cot.forEach((c, i) => {
    const o = h.getCell(i + 1);
    o.value = c.ten;
    o.font = {bold: true, size: 10.5, color: {argb: 'FFFFFFFF'}};
    o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY}};
    o.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
    ws.getColumn(i + 1).width = c.rong;
  });
  h.height = 20;

  dong.forEach((r, i) => {
    const row = ws.addRow(r);
    row.alignment = {vertical: 'top', wrapText: true};
    row.font = {size: 10.5};
    if (typeof r[0] === 'string' && r[0].startsWith('▸')) {
      row.eachCell({includeEmpty: true}, (c) => {
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: GOLD}};
        c.font = {bold: true, size: 10.5, color: {argb: NAVY}};
      });
    } else if (i % 2 === 1) {
      row.eachCell({includeEmpty: true}, (c) => {
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NHAT}};
      });
    }
  });
  ws.autoFilter = {from: {row: 2, column: 1}, to: {row: 2 + dong.length, column: cot.length}};
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1 · THỨ TỰ LÀM
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '1 · Thứ tự làm',
  [
    {ten: 'Bước', rong: 7},
    {ten: 'Ai', rong: 16},
    {ten: 'Làm gì', rong: 46},
    {ten: 'Ở đâu', rong: 20},
    {ten: 'Lưu ý', rong: 46},
    {ten: 'Xong', rong: 7},
  ],
  [
    ['▸ 1', 'QUẢN TRỊ VIÊN', 'Mở trường', '', '', ''],
    ['1.1', 'Quản trị viên', 'Khai cơ sở', 'Quản trị', 'Khối lớp tự có sẵn sau khi khai cơ sở.', ''],
    ['1.2', 'Quản trị viên', 'Mời ban giám hiệu — nhớ chọn cơ sở', 'Quản trị › Mời người dùng', 'Quên chọn cơ sở là họ vào thấy màn nào cũng trống.', ''],
    ['', '', '', '', '', ''],
    ['▸ 2', 'BAN GIÁM HIỆU', 'Dựng cơ sở của mình', '', '', ''],
    ['2.1', 'Ban giám hiệu', 'Đăng nhập bằng Google', 'class.vietanh.org', '', ''],
    ['2.2', 'Ban giám hiệu', 'Xem lại khối lớp, thiếu thì thêm', 'Cơ sở', '', ''],
    ['2.3', 'Ban giám hiệu', 'Tạo lớp: tên lớp, khối, năm học', 'Cơ sở', 'Năm học ghi dạng 2026-2027.', ''],
    ['2.4', 'Ban giám hiệu', 'Khai môn học cho từng khối', 'Môn học', 'Chưa khai môn thì sau này không nhập điểm được.', ''],
    ['2.5', 'Ban giám hiệu', 'Xếp thời khoá biểu cho từng lớp', 'Thời khoá biểu', 'Làm được ngay, không cần chờ ai.', ''],
    ['', '', '', '', '', ''],
    ['▸ 3', 'QUẢN TRỊ VIÊN', 'Giao lớp cho giáo viên', '', '', ''],
    ['3.1', 'Quản trị viên', 'Mời giáo viên chủ nhiệm — mỗi người một lớp', 'Quản trị › Mời người dùng', 'Lớp phải đang TRỐNG chủ nhiệm. Còn tên ai đó thì thầy cô mới sẽ không nhận được lớp.', ''],
    ['', '', '', '', '', ''],
    ['▸ 4', 'BGH hoặc GIÁO VIÊN', 'Lập danh sách học sinh', '', '', ''],
    ['4.1', 'BGH / Giáo viên', 'Ghi danh học sinh bằng email; điền thêm tên, mã, ngày sinh, số điện thoại phụ huynh', 'Danh sách lớp', 'Ghi danh được cả em chưa có tài khoản — em hiện ngay với chữ "chưa đăng nhập".', ''],
    ['4.2', 'BGH / Giáo viên', 'Sửa lại thông tin em nào gõ nhầm', 'Danh sách lớp › nút bút chì', 'Email không sửa được. Gõ sai email thì huỷ rồi ghi danh lại.', ''],
    ['', '', '', '', '', ''],
    ['▸ 5', 'GIÁO VIÊN CHỦ NHIỆM', 'Đặt mục tiêu cho lớp', '', '', ''],
    ['5.1', 'Giáo viên', 'Đăng nhập lần đầu → tự vào lớp mình', 'class.vietanh.org', 'Thấy "Chưa có lớp" thì báo quản trị viên, họ phân lại một phút là xong.', ''],
    ['5.2', 'Giáo viên', 'Bổ sung nốt danh sách lớp nếu còn thiếu em nào', 'Danh sách lớp', '', ''],
    ['5.3', 'Giáo viên', 'Đặt MỤC TIÊU NĂM cho lớp', 'WIG › Tạo mục tiêu › Năm', 'Chưa có mục tiêu năm thì không đặt được mục tiêu tháng.', ''],
    ['5.4', 'Giáo viên', 'Đặt MỤC TIÊU THÁNG', 'WIG › Tạo mục tiêu › Tháng', 'Chưa có mục tiêu tháng thì không đặt được mục tiêu tuần.', ''],
    ['5.5', 'Giáo viên', 'Đặt MỤC TIÊU TUẦN', 'WIG › Tạo mục tiêu › Tuần', 'Xem kỹ ô "Thuộc mục tiêu tháng" trước khi lưu.', ''],
    ['5.6', 'Giáo viên', 'Thêm VIỆC ĐỂ CÁC EM TICK vào mục tiêu tuần', 'WIG › Thêm việc', 'Đây là bước hay quên nhất. Không có việc thì các em mở app ra không có gì để bấm.', ''],
    ['', '', '', '', '', ''],
    ['▸ 6', 'HỌC SINH', 'Vào và tick mỗi ngày', '', '', ''],
    ['6.1', 'Học sinh', 'Đăng nhập lần đầu → tự vào đúng lớp', 'class.vietanh.org', 'Phải được ghi danh trước.', ''],
    ['6.2', 'Học sinh', 'Tick việc đã làm trong ngày', 'Bảng của em', 'Chỉ tick được cho HÔM NAY. Qua ngày là khoá.', ''],
    ['6.3', 'Học sinh', 'Tick nhầm hoặc muốn đổi mục tiêu thì gửi yêu cầu', 'Bảng của em', 'Các em không tự đổi mục tiêu — chốt trong buổi họp.', ''],
    ['6.4', 'Giáo viên', 'Duyệt hoặc từ chối yêu cầu của các em', 'Trang của em / Thông báo', '', ''],
    ['6.5', 'Giáo viên', 'Chọn 1 em làm trưởng điểm danh', 'Danh sách lớp', 'Việc của giáo viên chủ nhiệm, ban giám hiệu không làm thay.', ''],
    ['', '', '', '', '', ''],
    ['▸ 7', 'QUẢN TRỊ VIÊN', 'Mời phụ huynh — sau khi các em đã vào', '', '', ''],
    ['7.1', 'Quản trị viên', 'Mời phụ huynh, gắn với đúng một em', 'Quản trị › Mời phụ huynh', 'Email nào cũng được — email trường hay email riêng đều vào đúng vai phụ huynh.', ''],
    ['7.2', 'Phụ huynh', 'Đăng nhập, xem báo cáo về con', 'Báo cáo', 'Chỉ xem, và chỉ thấy con mình.', ''],
    ['', '', '', '', '', ''],
    ['▸ 8', 'GIÁO VIÊN + CẢ LỚP', 'Cuối tuần — họp WIG', '', '', ''],
    ['8.1', 'Giáo viên', 'Mở phòng họp — tự mở đúng tuần vừa xong', 'WIG › Phòng họp', '', ''],
    ['8.2', 'Cả lớp', 'Bước 1: nhìn con số tuần qua, chấm Thắng / Chưa đạt, ghi rút ra điều gì', 'Phòng họp', 'Con số do máy đếm từ lượt tick của các em.', ''],
    ['8.3', 'Cả lớp', 'Bước 2: chiêm nghiệm tuần qua + một câu cam kết cho tuần tới', 'Phòng họp', 'Câu cam kết sẽ hiện lại ở buổi họp tuần sau.', ''],
    ['8.4', 'Cả lớp', 'Bước 3: đặt mục tiêu tuần tới ngay tại đây', 'Phòng họp', 'Không phải quay lại trang WIG.', ''],
    ['8.5', 'Giáo viên', 'Bấm "Kết thúc buổi họp & lưu"', 'Phòng họp', 'Một lần lưu là xong cả ba bước.', ''],
    ['8.6', 'Giáo viên', 'Họp nhầm tuần thì gỡ biên bản tuần đó', 'Phòng họp', 'Gỡ xong các em tick lại được. Không lấy lại được nên hỏi kỹ.', ''],
    ['8.7', 'Ban giám hiệu', 'Xem lại lớp đã tổng kết ra sao', 'Biên bản họp', 'Chỉ xem.', ''],
  ],
  'THỨ TỰ LÀM — LÀM ĐÚNG THỨ TỰ NÀY',
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2 · AI ĐƯỢC LÀM GÌ
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '2 · Ai được làm gì',
  [
    {ten: 'Việc', rong: 42},
    {ten: 'Quản trị viên', rong: 14},
    {ten: 'Ban giám hiệu', rong: 14},
    {ten: 'Giáo viên', rong: 14},
    {ten: 'Học sinh', rong: 13},
    {ten: 'Phụ huynh', rong: 13},
    {ten: 'Ghi chú', rong: 44},
  ],
  [
    ['▸ LỚP & TÀI KHOẢN', '', '', '', '', '', ''],
    ['Khai cơ sở', '✔', '', '', '', '', 'Chỉ quản trị viên.'],
    ['Khai khối, tạo lớp', '✔', '✔ cơ sở mình', '', '', '', ''],
    ['Đổi giáo viên chủ nhiệm của lớp', '✔', '', '', '', '', ''],
    ['Mời giáo viên, ban giám hiệu', '✔', '', '', '', '', 'Mời lại cùng email với vai khác là đổi vai.'],
    ['Mời phụ huynh', '✔', '', '', '', '', 'Chỉ mời được khi con đã đăng nhập.'],
    ['Khai môn học, xếp thời khoá biểu', '✔', '✔ cơ sở mình', '', 'xem', 'xem', ''],
    ['', '', '', '', '', '', ''],
    ['▸ DANH SÁCH LỚP', '', '', '', '', '', ''],
    ['Xem danh sách lớp', '✔ mọi lớp', '✔ cơ sở mình', '✔ lớp mình', '', '', ''],
    ['Ghi danh học sinh', '✔', '✔ cơ sở mình', '✔ lớp mình', '', '', 'Ghi danh được cả em chưa có tài khoản.'],
    ['Sửa thông tin học sinh', '✔', '✔ cơ sở mình', '✔ lớp mình', '', '', 'Email không sửa được.'],
    ['Cho rời lớp / huỷ lời mời', '✔', '✔ cơ sở mình', '✔ lớp mình', '', '', 'Rời lớp không mất dữ liệu cũ.'],
    ['Dời em sang lớp khác', '✔ ngay', '', '✔ chờ duyệt', '', '', 'Lớp bên kia duyệt thì em mới sang.'],
    ['Chọn trưởng điểm danh', '✔', 'không', '✔ lớp mình', '', '', 'Vai trong lớp, do người dạy lớp ấy chọn.'],
    ['Xem ngày sinh, số điện thoại phụ huynh', '✔', '✔ cơ sở mình', '✔ lớp mình', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['▸ MỤC TIÊU (WIG)', '', '', '', '', '', ''],
    ['Đặt mục tiêu năm / tháng / tuần của lớp', '✔', '', '✔ lớp mình', 'không', '', ''],
    ['Thêm, sửa, xoá việc để các em tick', '✔', '', '✔ lớp mình', 'không', '', ''],
    ['Đặt mục tiêu riêng cho từng em', '✔', '', '✔ lớp mình', 'không', '', 'Đặt cùng em trong buổi trao đổi.'],
    ['Tick việc mỗi ngày', '', '', '', '✔ của mình', '', 'Chỉ tick được cho hôm nay.'],
    ['Gỡ lượt tick sai', '✔', '', '✔ lớp mình', 'không', '', 'Em gửi yêu cầu, thầy cô gỡ.'],
    ['Gửi yêu cầu sửa', '', '', '', '✔', '✔', 'Rút lại được khi còn chờ duyệt.'],
    ['Duyệt yêu cầu sửa', '✔', '', '✔ lớp mình', 'không', 'không', ''],
    ['Xem tiến độ', '✔', '✔ cơ sở mình', '✔ lớp mình', '✔ của mình', '✔ con mình', ''],
    ['', '', '', '', '', '', ''],
    ['▸ HỌP WIG', '', '', '', '', '', ''],
    ['Chấm Thắng / Chưa đạt', '✔', 'không', '✔ lớp mình', 'không', 'không', ''],
    ['Ghi chiêm nghiệm & cam kết', '✔', 'không', '✔ lớp mình', 'không', 'không', ''],
    ['Đặt mục tiêu tuần tới trong phòng họp', '✔', 'không', '✔ lớp mình', 'không', 'không', ''],
    ['Kết thúc buổi họp', '✔', 'không', '✔ lớp mình', 'không', 'không', 'Chốt lượt tick của tuần đó.'],
    ['Gỡ biên bản', '✔', 'không', '✔ lớp mình', 'không', 'không', 'Không lấy lại được.'],
    ['Đọc biên bản', '✔', '✔ cơ sở mình', '✔ lớp mình', '✔ lớp mình', '✔ phần của con', ''],
    ['', '', '', '', '', '', ''],
    ['▸ HẰNG NGÀY', '', '', '', '', '', ''],
    ['Điểm danh hôm nay', '✔', 'không', '✔ lớp mình', '✔ nếu là trưởng điểm danh', '', ''],
    ['Sửa điểm danh ngày cũ', '✔', 'không', '✔ trong 7 ngày', 'không', '', 'Quá 7 ngày thì nhờ quản trị viên.'],
    ['Báo bài', '✔', 'xem', '✔ lớp mình', 'xem', 'xem', ''],
    ['Điểm số, nhận xét, rèn luyện', '✔', 'xem', '✔ lớp mình', '✔ của mình', '✔ con mình', ''],
    ['Nhắn tin phụ huynh ↔ giáo viên', '', '', '✔', '', '✔', ''],
    ['Xem báo cáo về con', '', '', '', '', '✔ chỉ xem', 'Không thấy dữ liệu em khác.'],
  ],
  'AI ĐƯỢC LÀM GÌ',
);

const COT = [
  {ten: 'Mã', rong: 8},
  {ten: '★', rong: 4},
  {ten: 'Ai', rong: 14},
  {ten: 'Ở đâu', rong: 18},
  {ten: 'Làm gì', rong: 48},
  {ten: 'Phải thấy gì', rong: 50},
  {ten: 'Đạt?', rong: 7},
  {ten: 'Ghi chú', rong: 26},
];

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3 · KIỂM THỬ — MỤC TIÊU (WIG)
// ══════════════════════════════════════════════════════════════════════════════════════════
const TC_WIG = [
    ['W-01', '★', 'Giáo viên', 'class.vietanh.org', 'Đăng nhập lần đầu', 'Vào thẳng lớp mình, tên lớp hiện trên đầu trang', '', ''],
    ['W-02', '★', 'Giáo viên', 'Danh sách lớp', 'Ghi danh 1 em: email + họ tên + ngày sinh', 'Em hiện ngay, kèm chữ "chưa đăng nhập"', '', ''],
    ['W-03', '★', 'Giáo viên', 'Danh sách lớp', 'Bấm nút bút chì, sửa họ tên, lưu', 'Tên mới hiện ngay. Không có ô email trong bảng sửa', '', ''],
    ['W-04', '', 'Giáo viên', 'Danh sách lớp', 'Xoá trắng ô Ghi chú rồi lưu', 'Ghi chú mất thật, cột hiện dấu —', '', ''],
    ['W-05', '★', 'Giáo viên', 'WIG', 'Bấm "Tạo mục tiêu" khi lớp chưa có mục tiêu nào', 'Mở ở tab Năm. Tab Tháng và Tuần khoá, có nói rõ vì sao', '', ''],
    ['W-06', '★', 'Giáo viên', 'WIG', 'Đặt mục tiêu NĂM: chọn năm học, điền tên, từ 0 đến bao nhiêu, đơn vị', 'Lưu được. Năm học chạy từ 01/07 tới 30/06 năm sau', '', ''],
    ['W-07', '★', 'Giáo viên', 'WIG', 'Mở lại "Tạo mục tiêu"', 'Lần này mở sẵn ở tab Tháng', '', ''],
    ['W-08', '★', 'Giáo viên', 'WIG', 'Đặt mục tiêu THÁNG, chọn mục tiêu năm ở trên làm cha', 'Lưu được, nằm dưới mục tiêu năm', '', ''],
    ['W-09', '★', 'Giáo viên', 'WIG', 'Mở tab Tuần, xem ô "Thuộc mục tiêu tháng" và ô lịch', 'Chọn sẵn đúng tháng của tuần đang xem. Lịch mở đúng tuần này', '', ''],
    ['W-10', '', 'Giáo viên', 'WIG', 'Lớp có mục tiêu hai tháng khác nhau — đổi qua lại ô "Thuộc mục tiêu tháng"', 'Lịch tự nhảy theo tháng vừa chọn', '', ''],
    ['W-11', '', 'Giáo viên', 'WIG', 'Thử chọn một ngày nằm ngoài tháng của mục tiêu cha', 'Lịch không cho chọn', '', ''],
    ['W-12', '★', 'Giáo viên', 'WIG', 'Gõ 5.1 vào ô Mục tiêu rồi lưu', 'Không cho lưu — mục tiêu chỉ nhận số nguyên. Gõ 5 thì lưu bình thường', '', ''],
    ['W-13', '★', 'Giáo viên', 'WIG', 'Bấm "Thêm việc": tên việc, mục tiêu, đơn vị, mỗi lần tick đáng bao nhiêu, ngày trong tuần', 'Việc hiện thành một thẻ dưới mục tiêu tuần', '', ''],
    ['W-14', '', 'Giáo viên', 'WIG', 'Xem ô "Nhóm nhỏ trong …" trong form thêm việc', 'Ghi đúng lĩnh vực của mục tiêu, và nói rõ là không bắt buộc điền', '', ''],
    ['W-15', '', 'Giáo viên', 'WIG', 'Nhìn hai nút Sửa và Xoá trên thẻ việc', 'Hai nút cao bằng nhau, chữ không bị xuống dòng', '', ''],
    ['W-16', '', 'Giáo viên', 'WIG', 'Đặt mục tiêu cao hơn sức cả lớp', 'Có câu nhắc, nhưng vẫn lưu được', '', ''],
    ['W-17', '★', 'Học sinh', 'class.vietanh.org', 'Đăng nhập lần đầu', 'Vào thẳng bảng của mình, đúng lớp', '', ''],
    ['W-18', '★', 'Học sinh', 'Bảng của em', 'Tick một việc của hôm nay', 'Số tăng ngay, tiến độ tuần / tháng / năm cộng theo', '', ''],
    ['W-19', '★', 'Giáo viên', 'WIG › Chi tiết tuần', 'Mở màn chi tiết sau khi vài em đã tick', 'Thấy từng em: ai đã làm, ai chưa', '', ''],
    ['W-20', '', 'Học sinh', 'Bảng của em', 'Thử gỡ lượt tick của hôm qua', 'Không gỡ được, chỉ gửi được yêu cầu', '', ''],
    ['W-21', '', 'Học sinh', 'Bảng của em', 'Thử tự đổi mục tiêu của mình', 'Không có chỗ nào để đổi', '', ''],
    ['W-22', '', 'Giáo viên', 'Trang của em', 'Duyệt một yêu cầu của học sinh', 'Yêu cầu đổi trạng thái, thay đổi có hiệu lực ngay', '', ''],
    ['W-23', '', 'Giáo viên', 'Bảng thi đua', 'Mở bảng thi đua sau vài ngày tick', 'Điểm 4 lĩnh vực khớp với số lượt tick', '', ''],
];
trang('3 · Thử · Mục tiêu', COT, TC_WIG, 'THỬ — ĐẶT MỤC TIÊU VÀ TICK  ·  ★ = phải chạy được mới vận hành thật');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4 · KIỂM THỬ — HỌP WIG
// ══════════════════════════════════════════════════════════════════════════════════════════
const TC_HOP = [
    ['H-01', '★', 'Giáo viên', 'WIG › Phòng họp', 'Mở phòng họp', 'Mở đúng TUẦN VỪA XONG, không phải tuần đang chạy', '', ''],
    ['H-02', '★', 'Giáo viên', 'Phòng họp', 'Đọc bước 1', 'Liệt kê từng việc kèm con số đạt được và bao nhiêu em đã góp. Không có ô nào sửa số tay', '', ''],
    ['H-03', '★', 'Cả lớp', 'Phòng họp', 'Chấm Thắng / Chưa đạt cho từng việc, ghi rút ra điều gì', 'Ghi nhận được. Việc chưa chấm thì nói rõ là chưa chấm', '', ''],
    ['H-04', '', 'Giáo viên', 'Phòng họp', 'Nhìn đầu bước 1', 'Hiện lại câu cam kết của buổi họp tuần trước', '', ''],
    ['H-05', '★', 'Cả lớp', 'Phòng họp', 'Bước 2: điền chiêm nghiệm + một câu cam kết', 'Cả hai ô giữ nguyên nội dung khi cuộn qua bước khác', '', ''],
    ['H-06', '★', 'Cả lớp', 'Phòng họp', 'Bước 3: đặt mục tiêu tuần tới', 'Điền ngay tại đây được, không phải sang trang khác', '', ''],
    ['H-07', '★', 'Giáo viên', 'Phòng họp', 'Sang bước 3 khi chưa có mục tiêu của tháng tới', 'Nói rõ đang thiếu, và cho đặt luôn tại chỗ', '', ''],
    ['H-08', '', 'Giáo viên', 'Phòng họp', 'Sang bước 3 khi lớp chưa có mục tiêu năm', 'Nói rõ và chỉ đường sang trang WIG để tạo', '', ''],
    ['H-09', '', 'Giáo viên', 'Phòng họp', 'Xem danh sách việc ở bước 3', 'Việc tuần trước được mang sang sẵn, sửa hay xoá đều được', '', ''],
    ['H-10', '★', 'Giáo viên', 'Phòng họp', 'Bấm "Kết thúc buổi họp & lưu"', 'Lưu xong cả ba bước: có biên bản, có mục tiêu tuần mới, tick tuần cũ được chốt', '', ''],
    ['H-11', '★', 'Học sinh', 'Bảng của em', 'Vào lại sau khi thầy cô kết thúc buổi họp', 'Thấy mục tiêu và việc của TUẦN MỚI, tick được ngay', '', ''],
    ['H-12', '', 'Giáo viên', 'Phòng họp', 'Mở lại tuần đã kết thúc', 'Hiện biên bản đã lưu, có nút gỡ biên bản', '', ''],
    ['H-13', '', 'Giáo viên', 'Phòng họp', 'Gỡ biên bản một tuần', 'Biên bản mất, các em tick lại được. Có hỏi xác nhận trước', '', ''],
    ['H-14', '', 'Giáo viên', 'Phòng họp', 'Bấm Tuần trước / Tuần sau / Về tuần vừa xong', 'Chuyển đúng tuần', '', ''],
    ['H-15', '', 'Ban giám hiệu', 'Biên bản họp', 'Mở biên bản của một lớp', 'Xem được, không có nút lưu — việc chấm là của giáo viên lớp', '', ''],
    ['H-16', '★', 'Phụ huynh', 'Báo cáo', 'Chọn đúng tuần vừa họp', 'Thấy kết quả tuần của con, chiêm nghiệm và việc tuần sau', '', ''],
    ['H-17', '', 'Giáo viên', 'Phòng họp', 'Mở một tuần lớp không có việc chung nào', 'Nói rõ tuần đó không có gì để tổng kết', '', ''],
];
trang('4 · Thử · Họp WIG', COT, TC_HOP, 'THỬ — HỌP WIG CUỐI TUẦN  ·  chạy được H-01 → H-11 là khép kín một vòng');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5 · KIỂM THỬ — LỚP & TÀI KHOẢN
// ══════════════════════════════════════════════════════════════════════════════════════════
const TC_LOP = [
    ['L-01', '★', 'Quản trị viên', 'Quản trị', 'Khai một cơ sở', 'Cơ sở hiện ra, khối lớp có sẵn không phải gõ tay', '', ''],
    ['L-02', '★', 'Quản trị viên', 'Quản trị', 'Tạo lớp: tên, khối, năm học 2026-2027', 'Lớp hiện ra, chưa có chủ nhiệm', '', ''],
    ['L-03', '★', 'Quản trị viên', 'Môn học', 'Khai vài môn cho một khối', 'Môn chọn được khi nhập điểm và xếp thời khoá biểu', '', ''],
    ['L-04', '', 'Quản trị viên', 'Thời khoá biểu', 'Xếp vài tiết cho một lớp', 'Lưu được, mở lại đúng', '', ''],
    ['L-05', '★', 'Quản trị viên', 'Quản trị', 'Mời giáo viên chủ nhiệm và học sinh theo lớp', 'Báo đã mời, tên hiện trong danh sách chờ', '', ''],
    ['L-06', '', 'Quản trị viên', 'Quản trị', 'Mời lại một email với vai khác', 'Vai được đổi, không sinh dòng thứ hai', '', ''],
    ['L-07', '★', 'Quản trị viên', 'Quản trị', 'Xem cột chủ nhiệm của lớp sắp giao cho giáo viên mới', 'Phải TRỐNG. Còn tên ai đó thì phân lại trước', '', ''],
    ['L-08', '', 'Người chưa được mời', 'class.vietanh.org', 'Đăng nhập bằng email trường nhưng chưa được mời', 'Thấy màn "Tài khoản chưa được cấp quyền"', '', ''],
    ['L-09', '', 'Quản trị viên', 'Quản trị', 'Cấp vai cho người đang chờ', 'Họ tải lại trang là vào được', '', ''],
    ['L-10', '★', 'Ban giám hiệu', 'Cơ sở', 'Đăng nhập lần đầu rồi mở trang Cơ sở', 'Thấy các lớp trong cơ sở mình. Trống trơn nghĩa là lời mời thiếu cơ sở', '', ''],
    ['L-11', '', 'Ban giám hiệu', 'Danh sách lớp', 'Mở danh sách một lớp', 'Thấy tên và email, KHÔNG thấy ngày sinh và số điện thoại phụ huynh', '', ''],
    ['L-12', '', 'Ban giám hiệu', 'WIG', 'Thử mở trang WIG', 'Bị đưa về trang chủ — đặt mục tiêu không phải việc của ban giám hiệu', '', ''],
    ['L-13', '★', 'Quản trị viên', 'Quản trị', 'Mời phụ huynh, chọn con', 'Báo đã mời. Chưa em nào đăng nhập thì danh sách chọn con trống', '', ''],
    ['L-14', '★', 'Phụ huynh', 'Báo cáo', 'Đăng nhập lần đầu rồi mở Báo cáo', 'Vào đúng vai phụ huynh, thấy báo cáo con mình', '', ''],
    ['L-15', '★', 'Phụ huynh', 'Báo cáo', 'Xem kỹ cả trang', 'Chỉ có dữ liệu con mình. Không có tên em khác, không có ghi chú nội bộ lớp', '', ''],
    ['L-16', '', 'Phụ huynh', 'Danh sách lớp', 'Thử mở danh sách lớp', 'Bị đưa về — phụ huynh không xem danh sách lớp', '', ''],
    ['L-17', '', 'Giáo viên', 'Danh sách lớp', 'Đề nghị dời một em sang lớp khác', 'Báo đã gửi. Em VẪN ở lớp cũ cho tới khi lớp bên kia duyệt', '', ''],
    ['L-18', '', 'Giáo viên lớp đích', 'Danh sách lớp', 'Duyệt đề nghị dời lớp', 'Em sang lớp mới, hai danh sách cùng đổi', '', ''],
    ['L-19', '', 'Quản trị viên', 'Danh sách lớp', 'Dời một em bằng tài khoản quản trị', 'Chuyển thẳng, không cần duyệt', '', ''],
];
trang('5 · Thử · Lớp & tài khoản', COT, TC_LOP, 'THỬ — DỰNG LỚP VÀ TÀI KHOẢN');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6 · KIỂM THỬ — HẰNG NGÀY
// ══════════════════════════════════════════════════════════════════════════════════════════
const TC_NGAY = [
    ['N-01', '★', 'Giáo viên', 'Điểm danh', 'Điểm danh hôm nay cho cả lớp', 'Lưu được, mở lại đúng', '', ''],
    ['N-02', '★', 'Giáo viên', 'Điểm danh', 'Lùi về một ngày trong 7 ngày gần nhất rồi sửa', 'Sửa được', '', ''],
    ['N-03', '', 'Giáo viên', 'Điểm danh', 'Lùi quá 7 ngày rồi thử sửa', 'Không sửa được — nhờ quản trị viên', '', ''],
    ['N-04', '', 'Giáo viên', 'Danh sách lớp', 'Chọn một em làm trưởng điểm danh', 'Em cũ tự được gỡ, mỗi lớp một em', '', ''],
    ['N-05', '', 'Trưởng điểm danh', 'Điểm danh', 'Điểm danh hôm nay', 'Ghi được hôm nay. Ngày cũ thì không', '', ''],
    ['N-06', '', 'Học sinh thường', 'Điểm danh', 'Thử vào trang điểm danh', 'Không có tab, vào thẳng cũng không ghi được', '', ''],
    ['N-07', '', 'Giáo viên', 'Báo bài', 'Đăng một bài tập về nhà', 'Bài hiện trong danh sách của lớp', '', ''],
    ['N-08', '', 'Học sinh', 'Báo bài', 'Mở tab Báo bài', 'Thấy đúng bài của lớp mình', '', ''],
    ['N-09', '', 'Phụ huynh', 'Báo bài', 'Mở tab Báo bài', 'Thấy bài của lớp con', '', ''],
    ['N-10', '', 'Quản trị viên', 'Học bạ', 'Khai một đợt đánh giá', 'Đợt chọn được khi nhập điểm', '', ''],
    ['N-11', '', 'Giáo viên', 'Học bạ', 'Nhập điểm một môn và ghi nhận xét', 'Lưu được, mở lại đúng', '', ''],
    ['N-12', '', 'Phụ huynh', 'Học bạ', 'Mở tab Học bạ', 'Thấy điểm và nhận xét của con mình, không thấy em khác', '', ''],
    ['N-13', '', 'Phụ huynh', 'Liên lạc', 'Gửi một tin cho giáo viên', 'Tin gửi đi, giáo viên thấy chấm đỏ', '', ''],
    ['N-14', '', 'Giáo viên', 'Liên lạc', 'Trả lời tin nhắn', 'Phụ huynh nhận được, chấm đỏ tắt sau khi đọc', '', ''],
];
trang('6 · Thử · Hằng ngày', COT, TC_NGAY, 'THỬ — ĐIỂM DANH, BÁO BÀI, HỌC BẠ, LIÊN LẠC');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 7 · HAY VƯỚNG
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '7 · Hay vướng',
  [
    {ten: 'Người dùng thấy gì', rong: 46},
    {ten: 'Vì sao', rong: 46},
    {ten: 'Làm sao', rong: 50},
  ],
  [
    ['Giáo viên đăng nhập xong thấy "Chưa có lớp"', 'Lớp đó đã có người khác đứng tên chủ nhiệm', 'Quản trị viên vào Quản trị › Lớp, phân lại chủ nhiệm. Lần sau nhớ để lớp trống trước khi mời'],
    ['Ban giám hiệu vào, màn nào cũng trống', 'Lời mời quên chọn cơ sở', 'Quản trị viên gán cơ sở cho họ'],
    ['Phụ huynh vào thấy "Tài khoản chưa được cấp quyền"', 'Chưa được mời, hoặc mời rồi mà chưa chọn con', 'Vào Quản trị › Mời phụ huynh, chọn đúng con rồi mời lại'],
    ['Chưa mời được phụ huynh, danh sách chọn con trống', 'Con chưa đăng nhập lần nào', 'Đợi em đăng nhập rồi mời'],
    ['Học sinh vào không thuộc lớp nào', 'Chưa được ghi danh', 'Giáo viên ghi danh bằng đúng email đó, em vào lớp ở lần đăng nhập sau'],
    ['Các em mở app ra không có gì để tick', 'Có mục tiêu tuần nhưng chưa thêm việc nào', 'Vào WIG › Thêm việc. Mục tiêu là cái đích, việc mới là thứ các em bấm mỗi ngày'],
    ['Em quên tick hôm qua, hôm nay tick bù không được', 'Cố ý — chỉ ghi được cho hôm nay', 'Em gửi yêu cầu, thầy cô thêm giúp. Nhắc các em tick cuối mỗi buổi'],
    ['Mục tiêu tuần vừa tạo lại rơi vào tuần cách cả tháng', 'Chọn nhầm mục tiêu tháng ở ô "Thuộc mục tiêu tháng"', 'Xoá rồi tạo lại, xem kỹ ô đó trước khi lưu'],
    ['Họp nhầm tuần, đã bấm kết thúc', '', 'Bấm gỡ biên bản tuần đó — các em tick lại được. Không lấy lại được nên hỏi kỹ trước khi gỡ'],
    ['Đề nghị dời lớp mãi không thấy có hiệu lực', 'Lớp bên kia chưa duyệt', 'Nhắc giáo viên lớp đích vào duyệt, hoặc nhờ quản trị viên chuyển thẳng'],
    ['Không nhập được điểm, không thấy môn nào', 'Chưa khai môn cho khối đó', 'Quản trị viên vào Môn học khai trước'],
  ],
  'HAY VƯỚNG — VÀ CÁCH GỠ',
);


// ══════════════════════════════════════════════════════════════════════════════════════════
// 8 · NGƯỜI THỬ  ·  9 · PHIẾU GHI  ·  10 · GÓP Ý TỰ DO
//
// Ba trang này là chỗ 30 người THẬT SỰ ĐIỀN VÀO, khác hẳn bảy trang trên (chỉ đọc).
//
// Vì sao không mỗi người một trang tính: 30 trang thì không ai gộp lại được, và muốn biết "lỗi
// nào nhiều người gặp" phải mở lần lượt 30 lần. Một bảng dài, mỗi dòng một lần thử, lọc theo cột
// là ra ngay — đó cũng là lý do mọi cột đều có ô xổ xuống thay vì gõ tay: gõ tay thì "Không đạt",
// "ko đạt", "KHÔNG ĐẠT" thành ba nhóm khác nhau khi lọc.
// ══════════════════════════════════════════════════════════════════════════════════════════

// Mã ca lấy thẳng từ bốn bảng ở trên — thêm ca mới là ô xổ xuống tự có, không phải nhớ cập nhật.
const MA_CA = [...TC_WIG, ...TC_HOP, ...TC_LOP, ...TC_NGAY]
  .map((r) => r[0])
  .filter((m) => /^[A-Z]+-\d+$/.test(m));

// Danh sách người thử: đọc từ hệ thống nếu có kết nối, không thì để trống cho điền tay.
let NGUOI = [];
try {
  const {readFileSync} = await import('node:fs');
  const {createClient} = await import('@supabase/supabase-js');
  const env = {};
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
  const [{data: moi}, {data: lop}] = await Promise.all([
    db.from('pending_user_grants').select('email, role, class_id'),
    db.from('classes').select('id, name'),
  ]);
  const tenLop = new Map((lop ?? []).map((c) => [c.id, c.name]));
  const VAI = {admin: 'Quản trị viên', principal: 'Ban giám hiệu', teacher: 'Giáo viên chủ nhiệm', student: 'Học sinh', parent: 'Phụ huynh'};
  NGUOI = (moi ?? [])
    .map((g) => ({email: g.email, vai: VAI[g.role] ?? g.role, lop: tenLop.get(g.class_id) ?? ''}))
    .sort((a, b) => a.vai.localeCompare(b.vai, 'vi') || a.lop.localeCompare(b.lop, 'vi') || a.email.localeCompare(b.email));
} catch {
  console.log('GHI CHÚ  Không đọc được danh sách người thử — trang "Người thử" để trống cho điền tay.');
}

// Việc từng vai phải thử, viết bằng mã ca để đối chiếu được với bốn bảng trên.
const VIEC_THEO_VAI = {
  'Quản trị viên': 'L-01 → L-09, L-13',
  'Ban giám hiệu': 'L-10, L-11, L-12, và L-01 → L-04 phần khối/lớp/môn/thời khoá biểu',
  'Giáo viên chủ nhiệm': 'W-01 → W-16, W-19, W-22, H-01 → H-14, N-01 → N-04, N-07, N-11',
  'Học sinh': 'W-17, W-18, W-20, W-21, H-11, N-05, N-06, N-08',
  'Phụ huynh': 'L-14, L-15, L-16, H-16, N-09, N-12, N-13',
};

const KET_QUA = ['Đạt', 'Không đạt', 'Chưa thử được'];
const MUC_DO = ['Chặn hẳn — không làm tiếp được', 'Khó chịu — vẫn làm được nhưng vướng', 'Nhỏ — chữ nghĩa, giao diện', 'Góp ý thêm'];
const TRANG_THAI = ['Mới ghi', 'Đang xử lý', 'Đã sửa', 'Không sửa (giải thích)'];

const vung = (cot, n) => `'DM (danh mục)'!$${cot}$2:$${cot}$${n + 1}`;
const xo = (ws, cot, dauDong, soDong, congThuc) => {
  for (let r = dauDong; r < dauDong + soDong; r++) {
    ws.getCell(`${cot}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [congThuc],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Không có trong danh sách',
      error: 'Chọn một giá trị trong ô xổ xuống, hoặc báo người phụ trách thêm vào.',
    };
  }
};

// ── 8 · NGƯỜI THỬ ─────────────────────────────────────────────────────────────────────────
const wsN = trang(
  '8 · Người thử',
  [
    {ten: 'STT', rong: 6},
    {ten: 'Họ và tên', rong: 26},
    {ten: 'Email đăng nhập', rong: 40},
    {ten: 'Vai', rong: 20},
    {ten: 'Lớp', rong: 9},
    {ten: 'Được làm gì (xem chi tiết ở trang 2)', rong: 46},
    {ten: 'Phải thử những ca nào', rong: 40},
    {ten: 'Đã đăng nhập lần đầu chưa', rong: 15},
  ],
  [
    ...NGUOI.map((n, i) => [
      i + 1,
      '',
      n.email,
      n.vai,
      n.lop,
      {
        'Quản trị viên': 'Toàn quyền: cơ sở, mời người, phân công chủ nhiệm, mời phụ huynh',
        'Ban giám hiệu': 'Trong cơ sở mình: khối, lớp, môn, thời khoá biểu, danh sách học sinh. Xem WIG, không đặt WIG',
        'Giáo viên chủ nhiệm': 'Lớp mình: danh sách, mục tiêu WIG, việc để tick, họp WIG, điểm danh, báo bài, học bạ',
        'Học sinh': 'Tick việc của mình mỗi ngày, gửi yêu cầu sửa. Không tự đổi mục tiêu',
        'Phụ huynh': 'Chỉ xem báo cáo về con, nhắn tin cho giáo viên',
      }[n.vai] ?? '',
      VIEC_THEO_VAI[n.vai] ?? '',
      '',
    ]),
    // Chỗ trống để thêm người phát sinh (phụ huynh mời sau, giáo viên bộ môn…).
    ...Array.from({length: 12}, () => ['', '', '', '', '', '', '', '']),
  ],
  'AI THỬ CÁI GÌ — điền họ tên vào cột B, và tick cột cuối khi đã đăng nhập được',
);
xo(wsN, 'H', 3, NGUOI.length + 12, '"Rồi,Chưa"');

// ── 9 · PHIẾU GHI ─────────────────────────────────────────────────────────────────────────
const SO_DONG_GHI = 400;
const wsG = trang(
  '9 · Phiếu ghi',
  [
    {ten: 'Ngày thử', rong: 12},
    {ten: 'Email người thử', rong: 38},
    {ten: 'Mã ca', rong: 9},
    {ten: 'Kết quả', rong: 14},
    {ten: 'CHUYỆN GÌ ĐÃ XẢY RA (tả bằng lời của mình)', rong: 60},
    {ten: 'Mình mong nó phải như thế nào', rong: 44},
    {ten: 'Bấm những gì trước đó', rong: 40},
    {ten: 'Mức độ', rong: 26},
    {ten: 'Người xử lý', rong: 18},
    {ten: 'Trạng thái', rong: 18},
    {ten: 'Ghi chú của người xử lý', rong: 40},
  ],
  Array.from({length: SO_DONG_GHI}, () => ['', '', '', '', '', '', '', '', '', '', '']),
  'PHIẾU GHI KẾT QUẢ — mỗi lần thử một dòng. Cột E, F, G cứ viết dài thoải mái',
);
xo(wsG, 'B', 3, SO_DONG_GHI, `=${vung('A', Math.max(NGUOI.length, 1))}`);
xo(wsG, 'C', 3, SO_DONG_GHI, `=${vung('B', MA_CA.length)}`);
xo(wsG, 'D', 3, SO_DONG_GHI, `=${vung('C', KET_QUA.length)}`);
xo(wsG, 'H', 3, SO_DONG_GHI, `=${vung('D', MUC_DO.length)}`);
xo(wsG, 'J', 3, SO_DONG_GHI, `=${vung('E', TRANG_THAI.length)}`);
for (let r = 3; r < 3 + SO_DONG_GHI; r++) {
  wsG.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';
  wsG.getRow(r).height = 30;
}

// ── 10 · GÓP Ý TỰ DO ──────────────────────────────────────────────────────────────────────
const SO_DONG_GY = 150;
const wsY = trang(
  '10 · Góp ý tự do',
  [
    {ten: 'Ngày', rong: 12},
    {ten: 'Email người góp ý', rong: 38},
    {ten: 'Góp ý — muốn viết gì cũng được', rong: 86},
    {ten: 'Mức độ', rong: 26},
    {ten: 'Đã đọc / đã trả lời', rong: 22},
  ],
  Array.from({length: SO_DONG_GY}, () => ['', '', '', '', '']),
  'GÓP Ý TỰ DO — chỗ cho những gì không nằm trong ca kiểm thử nào',
);
xo(wsY, 'B', 3, SO_DONG_GY, `=${vung('A', Math.max(NGUOI.length, 1))}`);
xo(wsY, 'D', 3, SO_DONG_GY, `=${vung('D', MUC_DO.length)}`);
xo(wsY, 'E', 3, SO_DONG_GY, '"Chưa đọc,Đã đọc,Đã trả lời"');
for (let r = 3; r < 3 + SO_DONG_GY; r++) {
  wsY.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';
  wsY.getRow(r).height = 34;
}

// ── Trang danh mục: nguồn của mọi ô xổ xuống. Ẩn đi cho gọn, nhưng KHÔNG khoá — cần thêm người
//    thử giữa chừng thì mở ra thêm một dòng là xong.
const dm = wb.addWorksheet('DM (danh mục)');
dm.state = 'hidden';
dm.getColumn(1).width = 44;
dm.getColumn(2).width = 16;
dm.getColumn(3).width = 30;
dm.getColumn(4).width = 44;
dm.getColumn(5).width = 24;
dm.getRow(1).values = ['Email người thử', 'Mã ca', 'Kết quả', 'Mức độ', 'Trạng thái xử lý'];
const donMax = Math.max(NGUOI.length, MA_CA.length, 60);
for (let i = 0; i < donMax; i++) {
  dm.getRow(i + 2).values = [
    NGUOI[i]?.email ?? null,
    MA_CA[i] ?? null,
    KET_QUA[i] ?? null,
    MUC_DO[i] ?? null,
    TRANG_THAI[i] ?? null,
  ];
}

const duong = process.argv[2] ?? 'So_tay_van_hanh_Viet_Anh_Class.xlsx';
await wb.xlsx.writeFile(duong);
console.log('Đã ghi:', duong);
