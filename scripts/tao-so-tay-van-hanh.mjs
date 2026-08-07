// SINH SỔ TAY VẬN HÀNH (.xlsx) — ai làm gì, theo thứ tự nào, và kiểm bằng test case nào.
//
//   npm i --no-save exceljs && node scripts/tao-so-tay-van-hanh.mjs
//
// Vì sao là Excel chứ không phải trang trong app: người dùng nó là hiệu trưởng, giáo viên chủ
// nhiệm và quản trị viên — họ tick từng dòng trong lúc chạy thử, ghi chú tay, gửi qua lại. Một
// trang web chỉ đọc không làm được việc ấy.
//
// Nội dung LẤY TỪ MÃ ĐANG CHẠY, không chép từ tài liệu cũ: guard requireRole của từng trang,
// LINKS trong AppNav, RLS trong migrations, và chuỗi hiển thị trong messages/vi.json.
import ExcelJS from 'exceljs';

const NAVY = 'FF0B1F3B';
const GOLD = 'FFF9DD0E';
const NHAT = 'FFF3F6FA';

const wb = new ExcelJS.Workbook();
wb.creator = 'Viet Anh Class';
wb.created = new Date();

// ── Khung chung cho mọi trang tính ────────────────────────────────────────────────────────
function trang(ten, cot, dong, {tieuDe, dan} = {}) {
  const ws = wb.addWorksheet(ten, {views: [{state: 'frozen', ySplit: tieuDe ? 3 : 1}]});
  let hang = 1;
  if (tieuDe) {
    ws.mergeCells(1, 1, 1, cot.length);
    const o = ws.getCell(1, 1);
    o.value = tieuDe;
    o.font = {bold: true, size: 14, color: {argb: NAVY}};
    o.alignment = {vertical: 'middle'};
    ws.getRow(1).height = 24;
    ws.mergeCells(2, 1, 2, cot.length);
    const d = ws.getCell(2, 1);
    d.value = dan ?? '';
    d.font = {italic: true, size: 10, color: {argb: 'FF5A6B80'}};
    d.alignment = {vertical: 'top', wrapText: true};
    ws.getRow(2).height = dan && dan.length > 150 ? 44 : 30;
    hang = 3;
  }
  const hRow = ws.getRow(hang);
  cot.forEach((c, i) => {
    const o = hRow.getCell(i + 1);
    o.value = c.ten;
    o.font = {bold: true, size: 10.5, color: {argb: 'FFFFFFFF'}};
    o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY}};
    o.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
    ws.getColumn(i + 1).width = c.rong;
  });
  hRow.height = 22;

  dong.forEach((r, idx) => {
    const row = ws.addRow(r);
    row.alignment = {vertical: 'top', wrapText: true};
    row.font = {size: 10.5};
    if (idx % 2 === 1) {
      row.eachCell({includeEmpty: true}, (c) => {
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NHAT}};
      });
    }
    // Dòng bắt đầu bằng "▸" là tiêu đề nhóm — tô vàng cho dễ tìm khi cuộn.
    if (typeof r[0] === 'string' && r[0].startsWith('▸')) {
      row.eachCell({includeEmpty: true}, (c) => {
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: GOLD}};
        c.font = {bold: true, size: 10.5, color: {argb: NAVY}};
      });
    }
  });
  ws.autoFilter = {
    from: {row: hang, column: 1},
    to: {row: hang + dong.length, column: cot.length},
  };
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1 · ĐỌC TRƯỚC
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '1 · Đọc trước',
  [
    {ten: 'Mục', rong: 26},
    {ten: 'Nội dung', rong: 108},
  ],
  [
    ['▸ File này là gì', 'Bản mô tả app Việt Anh Class đúng như nó ĐANG CHẠY ngày 07/08/2026, kèm bộ test case để chạy thử một vòng vận hành thật: dựng cơ sở → dựng lớp → giáo viên đặt WIG → học sinh tick → cuối tuần họp WIG.'],
    ['Lấy từ đâu', 'Đọc thẳng từ mã nguồn đang chạy trên production: guard requireRole của từng trang, danh sách tab theo vai trong AppNav, luật RLS trong migrations, và chuỗi chữ trong messages/vi.json. Không chép lại từ tài liệu cũ — tài liệu cũ có chỗ đã lệch với mã.'],
    ['Cách dùng', 'Trang "2 · Nhịp triển khai" đọc trước, nó nói AI LÀM TRƯỚC AI. Các trang bắt đầu bằng "TC" là test case: làm theo cột "Các bước", so với cột "Kết quả mong đợi", rồi điền Đạt/Không và ghi chú. Cột "Ưu tiên" = P1 phải chạy được mới vận hành thật được; P2 nên có; P3 làm sau cũng được.'],
    ['Ưu tiên của đợt này', 'WIG và Họp WIG (trang 6 và 7). Đó là phần chủ dự án muốn chạy thật trước, và cũng là phần nhiều bước nhất — sai một mắt xích là cả tuần không tick được.'],
    ['', ''],
    ['▸ Hiện trạng 07/08/2026', ''],
    ['Cơ sở', '1 cơ sở: Việt Anh Gò Vấp.'],
    ['Lớp', '3 lớp năm học 2026-2027: 10A1, 11A1, 12A1. Cả ba đang TRỐNG chủ nhiệm, chờ giáo viên thật đăng nhập lần đầu để tự nhận lớp.'],
    ['Đã mời, chưa ai đăng nhập', '33 người: 3 giáo viên chủ nhiệm · 27 học sinh (10A1: 10 · 11A1: 9 · 12A1: 8) · 2 ban giám hiệu · 1 quản trị viên.'],
    ['Quản trị viên đang chạy', 'hung.nguyen@truongvietanh.com (đã đăng nhập, vai admin). Người được mời thêm: vui.nguyenvan@truongvietanh.com.'],
    ['Phụ huynh', 'CHƯA mời ai — cố ý. Lời mời phụ huynh phải gắn vào một học sinh ĐÃ đăng nhập, nên việc này thuộc Nhịp 4. Xem thêm bẫy PH-1 ở trang 10.'],
    ['Còn vết dữ liệu thử', 'Lớp 10A1 còn 4 mục tiêu WIG và 1 học sinh (alex@truongvietanh.com) từ đợt dò lỗi. Muốn dọn thì bỏ chú thích khối cuối trong scripts/phan-vai-van-hanh-thu.sql.'],
    ['', ''],
    ['▸ Quy ước đọc', ''],
    ['Vai trong app', 'admin = Quản trị viên · principal = Ban giám hiệu · teacher = Giáo viên chủ nhiệm (GVCN) · student = Học sinh · parent = Phụ huynh · pending = đã đăng nhập nhưng chưa được cấp vai.'],
    ['WIG', 'Mục tiêu tối quan trọng (4DX). Có 3 cấp: NĂM → THÁNG → TUẦN. Cấp dưới bắt buộc treo dưới một cấp trên.'],
    ['Lead measure', 'Trong app gọi là "Việc để các em tick" — việc lặp lại hằng tuần, chính nó cộng lên thành tiến độ tháng rồi tiến độ năm.'],
    ['Nhãn kỳ', 'Năm học: "2026-2027" (01/07/2026 → 30/06/2027). Tháng: "2026-08". Tuần: "W32-2026" theo chuẩn ISO, Thứ Hai → Chủ Nhật.'],
  ],
  {
    tieuDe: 'SỔ TAY VẬN HÀNH — VIỆT ANH CLASS',
    dan: 'Bản chụp app ngày 07/08/2026 · dùng cho đợt vận hành thật 3 lớp 10A1 · 11A1 · 12A1 · ưu tiên WIG và Họp WIG',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2 · NHỊP TRIỂN KHAI
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '2 · Nhịp triển khai',
  [
    {ten: 'Nhịp', rong: 9},
    {ten: 'Ai làm', rong: 16},
    {ten: 'Làm gì', rong: 40},
    {ten: 'Ở đâu', rong: 20},
    {ten: 'Vì sao phải theo thứ tự này', rong: 56},
    {ten: 'Xong chưa', rong: 11},
  ],
  [
    ['▸ NHỊP 1', 'Quản trị viên', 'DỰNG NỀN — trước tất cả', '', '', ''],
    ['1.1', 'Quản trị viên', 'Khai cơ sở (campus): tên, cấp học.', '/admin → Cơ sở', 'Mọi thứ khác treo dưới cơ sở. Khối lớp được sinh TỰ ĐỘNG theo cấp học khi tạo cơ sở (hàm seed_grades_for_campus) — không phải gõ tay.', ''],
    ['1.2', 'Quản trị viên', 'Kiểm khối lớp đã sinh đủ chưa, thiếu thì thêm tay.', '/admin → Cơ sở', 'Khối không đánh số (mầm non…) thì hàm sinh trả rỗng, phải nhập tay.', ''],
    ['1.3', 'Quản trị viên', 'Tạo lớp: tên, khối, năm học.', '/admin → Lớp', 'NĂM HỌC phải là "2026-2027". Lớp là thứ mà giáo viên, học sinh, WIG, điểm danh đều bám vào.', ''],
    ['1.4', 'Quản trị viên', 'Khai môn học cho từng khối.', '/subjects', 'Học bạ và thời khoá biểu đều đọc danh sách môn từ đây. Bỏ qua bước này thì tới lúc nhập điểm mới phát hiện thiếu.', ''],
    ['1.5', 'Quản trị viên', 'Xếp thời khoá biểu cho từng lớp.', '/timetable', 'Làm được ngay sau khi có lớp + môn, KHÔNG cần chờ giáo viên hay học sinh. Học sinh và phụ huynh xem được ngay khi họ vào.', ''],
    ['1.6', 'Quản trị viên', 'Mời người dùng theo vai + lớp (mời hàng loạt, mỗi dòng một email).', '/admin → Mời người dùng', 'Miền truongvietanh.com có vai mặc định là "pending" — KHÔNG có lời mời thì người đó đăng nhập vào sẽ thấy màn "Tài khoản chưa được cấp quyền". Lời mời là thứ quyết định vai.', ''],
    ['1.7', 'Quản trị viên', 'Kiểm lại: mỗi lớp phải TRỐNG chủ nhiệm trước khi giáo viên thật đăng nhập.', '/admin → Lớp', 'BẪY LỚN NHẤT — xem bẫy GV-1 ở trang 10. Lớp đã có ai đó đứng tên thì giáo viên được mời sẽ KHÔNG nhận được lớp, và lời mời bị xoá ngay sau lần đăng nhập đầu.', ''],
    ['', '', '', '', '', ''],
    ['▸ NHỊP 2', 'Ban giám hiệu', 'VÀO SỚM ĐỂ SOI, KHÔNG CHẶN AI', '', '', ''],
    ['2.1', 'Ban giám hiệu', 'Đăng nhập Google lần đầu.', 'class.vietanh.org', 'Lời mời phải có CƠ SỞ, không thì vai đúng mà màn nào cũng trống — quyền của BGH là "mọi lớp trong cơ sở mình".', ''],
    ['2.2', 'Ban giám hiệu', 'Mở /campus xem toàn cảnh cơ sở.', '/campus', 'Vào lúc nào cũng được, không chặn ai. BGH chỉ XEM: không sửa điểm danh, không đặt WIG.', ''],
    ['', '', '', '', '', ''],
    ['▸ NHỊP 3', 'GVCN', 'DỰNG LỚP CỦA MÌNH VÀ ĐẶT MỤC TIÊU', '', '', ''],
    ['3.1', 'GVCN', 'Đăng nhập Google lần đầu → tự nhận lớp được phân.', 'class.vietanh.org', 'Trigger gán lớp NGAY lần đăng nhập đầu, và chỉ khi lớp còn trống chủ nhiệm.', ''],
    ['3.2', 'GVCN', 'Ghi danh học sinh theo email (điền thêm họ tên, mã HS, ngày sinh, SĐT phụ huynh, ghi chú).', '/roster', 'Ghi danh được cả em CHƯA có tài khoản — em hiện ngay với nhãn "chưa đăng nhập" và tự vào lớp khi đăng nhập lần đầu. Đây CHÍNH LÀ đường mời học sinh bên quản trị, cùng một hàng dữ liệu.', ''],
    ['3.3', 'GVCN', 'Sửa lại thông tin em nào gõ nhầm.', '/roster → nút bút chì', 'Sửa tại chỗ, không phải xoá đi ghi danh lại. Email KHÔNG sửa được (là danh tính) — gõ sai email thì huỷ lời mời rồi ghi danh lại.', ''],
    ['3.4', 'GVCN', 'TẠO MỤC TIÊU NĂM cho lớp (2026-2027).', '/wig → Tạo mục tiêu → Năm', 'Không có mục tiêu năm thì tab Tháng bị khoá. Đây là gốc của cả chuỗi.', ''],
    ['3.5', 'GVCN', 'TẠO MỤC TIÊU THÁNG (2026-08) treo dưới mục tiêu năm.', '/wig → Tạo mục tiêu → Tháng', 'Không có mục tiêu tháng thì tab Tuần bị khoá.', ''],
    ['3.6', 'GVCN', 'TẠO MỤC TIÊU TUẦN (tuần đang xem) treo dưới mục tiêu tháng.', '/wig → Tạo mục tiêu → Tuần', 'Ô lịch tự chặn theo khoảng của mục tiêu tháng, và mục tiêu cha chọn sẵn là cái PHỦ tuần đang đứng.', ''],
    ['3.7', 'GVCN', 'Thêm "Việc để các em tick" (lead measure) vào mục tiêu tuần.', '/wig → Thêm việc', 'KHÔNG có việc nào thì màn hình học sinh không có gì để tick, và cả tuần không có số liệu. Đây là mắt xích hay bị quên nhất.', ''],
    ['3.8', 'GVCN', 'Chọn trưởng điểm danh (1 em/lớp) — làm sau khi em đó đã đăng nhập.', '/roster', 'Em này được điểm danh thay GVCN, nhưng CHỈ ngày hôm nay.', ''],
    ['', '', '', '', '', ''],
    ['▸ NHỊP 4', 'Học sinh', 'VÀO VÀ TICK HẰNG NGÀY', '', '', ''],
    ['4.1', 'Học sinh', 'Đăng nhập Google lần đầu → tự vào đúng lớp.', 'class.vietanh.org', 'Ghi danh ở nhịp 3.2 quyết định lớp. Em nào chưa được ghi danh sẽ rơi vào vai "pending".', ''],
    ['4.2', 'Học sinh', 'Mở bảng của mình, tick việc đã làm trong ngày.', '/student', 'Tick chỉ ghi được cho NGÀY HÔM NAY — qua ngày là khoá. Đó là thiết kế: số liệu 4DX phải là số ghi nóng, không phải nhớ lại cuối tuần.', ''],
    ['4.3', 'Học sinh', 'Cần sửa gì (tick nhầm, đổi mục tiêu) thì gửi yêu cầu cho GVCN.', '/student', 'Học sinh KHÔNG tự đổi mục tiêu — cam kết 4DX chốt trong buổi họp, không sửa lén giữa tuần.', ''],
    ['4.4', 'GVCN', 'Duyệt hoặc từ chối yêu cầu sửa của các em.', '/student/[id] hoặc thông báo', 'Mỗi lượt duyệt là một lần thầy cô nhìn lại số liệu của em đó.', ''],
    ['', '', '', '', '', ''],
    ['▸ NHỊP 5', 'Quản trị viên', 'MỜI PHỤ HUYNH — SAU KHI CÁC EM ĐÃ VÀO', '', '', ''],
    ['5.1', 'Quản trị viên', 'Mời phụ huynh, gắn với đúng một học sinh.', '/admin → Mời phụ huynh', 'Lời mời gắn vào ID của con, mà ID chỉ có sau khi em đăng nhập lần đầu. Nên bước này KHÔNG làm sớm hơn được.', ''],
    ['5.2', 'Phụ huynh', 'Nhận link, đăng nhập, mở báo cáo về con.', '/report', 'Phụ huynh chỉ ĐỌC, và chỉ thấy dữ liệu con mình. Dùng email ngoài miền trường (gmail…) — xem bẫy PH-1.', ''],
    ['', '', '', '', '', ''],
    ['▸ NHỊP 6', 'GVCN + cả lớp', 'CUỐI TUẦN — HỌP WIG', '', '', ''],
    ['6.1', 'GVCN', 'Mở phòng họp, nó tự mở ĐÚNG TUẦN VỪA XONG.', '/wig/hop', 'Họp là để tổng kết tuần đã đi qua, không phải tuần đang chạy.', ''],
    ['6.2', 'GVCN + cả lớp', 'Bước 1 — nhìn con số tuần qua, chấm Thắng/Chưa đạt, ghi "rút ra điều gì".', '/wig/hop', 'Con số do máy đếm từ lượt tick của các em, thầy cô KHÔNG sửa được ở đây. Đó là điểm tựa của cả buổi họp.', ''],
    ['6.3', 'GVCN + cả lớp', 'Bước 2 — chiêm nghiệm tuần qua + một câu cam kết cho tuần tới.', '/wig/hop', 'Câu cam kết sẽ hiện lên đầu phòng họp tuần sau.', ''],
    ['6.4', 'GVCN + cả lớp', 'Bước 3 — đặt luôn mục tiêu tuần TỚI ngay tại đây.', '/wig/hop', 'Không phải quay lại trang WIG làm lần nữa. Thiếu mục tiêu tháng thì đặt luôn tại chỗ; thiếu mục tiêu năm thì mới phải sang /wig.', ''],
    ['6.5', 'GVCN', 'Bấm "Kết thúc buổi họp & lưu".', '/wig/hop', 'Một lần lưu xong cả ba bước: chốt tick tuần cũ, tạo mục tiêu tuần mới, các em tick tiếp được.', ''],
    ['6.6', 'GVCN', 'Họp nhầm tuần thì "Gỡ biên bản tuần đó".', '/wig/hop', 'Gỡ xong tick tuần ấy mở lại cho các em. Không hoàn tác được nên hỏi kỹ trước khi gỡ.', ''],
    ['6.7', 'Ban giám hiệu', 'Xem lại lớp đã tổng kết ra sao (bản chỉ đọc).', '/meeting', 'BGH không chấm, không đặt mục tiêu — việc ấy của GVCN cùng lớp.', ''],
  ],
  {
    tieuDe: 'AI LÀM TRƯỚC, AI LÀM SAU',
    dan: 'Sáu nhịp, chạy theo đúng thứ tự. Nhịp sau phụ thuộc dữ liệu của nhịp trước — làm ngược là kẹt, và chỗ kẹt thường không nói ra lý do.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3 · VAI TRÒ & QUYỀN
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '3 · Vai trò & quyền',
  [
    {ten: 'Việc', rong: 40},
    {ten: 'Quản trị viên', rong: 15},
    {ten: 'Ban giám hiệu', rong: 15},
    {ten: 'GVCN', rong: 15},
    {ten: 'Học sinh', rong: 15},
    {ten: 'Phụ huynh', rong: 15},
    {ten: 'Ghi chú', rong: 52},
  ],
  [
    ['▸ TÀI KHOẢN & CƠ CẤU', '', '', '', '', '', ''],
    ['Tạo cơ sở, khối lớp', '✔', '—', '—', '—', '—', 'Khối tự sinh theo cấp học khi tạo cơ sở.'],
    ['Tạo / sửa lớp', '✔', '—', '—', '—', '—', ''],
    ['Đổi giáo viên chủ nhiệm của lớp', '✔', '—', '—', '—', '—', 'Có chốt chặn ở CSDL: ai không phải admin thì không đổi được cột này.'],
    ['Mời người dùng (hàng loạt, theo vai)', '✔', '—', '—', '—', '—', 'Mời lại cùng email với vai khác = ghi đè lời mời cũ.'],
    ['Mời phụ huynh gắn với 1 học sinh', '✔', '—', '—', '—', '—', 'Chỉ mời được khi em đó đã đăng nhập lần đầu.'],
    ['Khai môn học', '✔', '✔', '—', '—', '—', ''],
    ['Xếp thời khoá biểu', '✔', '✔', '—', '—', '—', 'Học sinh và phụ huynh chỉ xem.'],
    ['', '', '', '', '', '', ''],
    ['▸ DANH SÁCH LỚP', '', '', '', '', '', ''],
    ['Xem danh sách lớp', '✔ mọi lớp', '✔ trong cơ sở', '✔ lớp mình', '—', '—', ''],
    ['Ghi danh học sinh vào lớp', '✔', '—', '✔ lớp mình', '—', '—', 'Ghi danh được cả em chưa có tài khoản.'],
    ['Sửa thông tin học sinh (tên, mã, ngày sinh, SĐT PH, ghi chú)', '✔', '—', '✔ lớp mình', '—', '—', 'Email là danh tính, không sửa được.'],
    ['Cho học sinh rời lớp / huỷ lời mời', '✔', '—', '✔ lớp mình', '—', '—', 'Rời lớp = tắt cờ, không xoá dữ liệu.'],
    ['Dời học sinh sang lớp khác', '✔ chuyển thẳng', '—', '✔ phải chờ duyệt', '—', '—', 'GVCN lớp đích duyệt thì em mới sang; trong lúc chờ em vẫn ở lớp cũ.'],
    ['Chọn trưởng điểm danh', '✔', '—', '✔ lớp mình', '—', '—', 'Mỗi lớp đúng 1 em; chọn em khác thì em cũ tự được gỡ.'],
    ['Xem ngày sinh / SĐT phụ huynh', '✔', '✖', '✔ lớp mình', '—', '—', 'BGH KHÔNG đọc được — đây là dữ liệu liên lạc của người thật, giới hạn có chủ đích.'],
    ['', '', '', '', '', '', ''],
    ['▸ WIG (ưu tiên đợt này)', '', '', '', '', '', ''],
    ['Tạo mục tiêu năm / tháng / tuần của lớp', '✔', '—', '✔ lớp mình', '✖', '—', 'Học sinh không tự đặt mục tiêu — chốt trong buổi họp.'],
    ['Thêm / sửa / xoá "việc để các em tick"', '✔', '—', '✔ lớp mình', '✖', '—', ''],
    ['Đặt WIG cá nhân cho từng em', '✔', '—', '✔ lớp mình', '✖', '—', 'GVCN đặt cùng em trong buổi họp Coach × Buddy.'],
    ['Tick tiến độ hằng ngày', '—', '—', '—', '✔ của mình', '—', 'Chỉ ghi được cho NGÀY HÔM NAY; qua ngày là khoá.'],
    ['Gỡ lượt tick sai', '✔', '—', '✔ lớp mình', '✖', '—', 'Em gửi yêu cầu, GVCN gỡ.'],
    ['Gửi yêu cầu sửa (tick nhầm, đổi mục tiêu…)', '—', '—', '—', '✔', '✔', 'Người gửi rút lại được khi còn chờ duyệt; không tự duyệt được.'],
    ['Duyệt yêu cầu sửa', '✔', '—', '✔ lớp mình', '✖', '✖', ''],
    ['Xem tiến độ WIG của con', '✔', '✔ trong cơ sở', '✔ lớp mình', '✔ của mình', '✔ con mình', ''],
    ['', '', '', '', '', '', ''],
    ['▸ HỌP WIG', '', '', '', '', '', ''],
    ['Mở phòng họp và chấm Thắng/Chưa đạt', '✔', '✖', '✔ lớp mình', '✖', '✖', 'BGH xem bản chỉ đọc ở /meeting.'],
    ['Ghi chiêm nghiệm & cam kết tuần', '✔', '✖', '✔ lớp mình', '✖', '✖', ''],
    ['Đặt mục tiêu tuần tới ngay trong phòng họp', '✔', '✖', '✔ lớp mình', '✖', '✖', ''],
    ['Kết thúc buổi họp (chốt tick tuần đó)', '✔', '✖', '✔ lớp mình', '✖', '✖', ''],
    ['Gỡ biên bản (mở lại tick tuần đó)', '✔', '✖', '✔ lớp mình', '✖', '✖', 'Không hoàn tác được.'],
    ['Đọc biên bản buổi họp', '✔', '✔ trong cơ sở', '✔ lớp mình', '✔ lớp mình', '✔ phần của con', 'Phụ huynh thấy chiêm nghiệm + việc tuần sau trong báo cáo.'],
    ['', '', '', '', '', '', ''],
    ['▸ VẬN HÀNH HẰNG NGÀY', '', '', '', '', '', ''],
    ['Điểm danh hôm nay', '✔', '✖', '✔ lớp mình', '✔ nếu là trưởng ĐD', '—', 'Trưởng điểm danh CHỈ ghi được hôm nay, không sửa ngày cũ.'],
    ['Sửa điểm danh ngày cũ', '✔', '✖', '✔ trong 7 ngày', '✖', '—', 'Quá 7 ngày thì chỉ quản trị viên sửa được.'],
    ['Báo bài (bài tập về nhà)', '✔', '✔ xem', '✔ lớp mình', '✔ xem', '✔ xem', ''],
    ['Học bạ: điểm số, nhận xét, rèn luyện', '✔', '✔ xem', '✔ lớp mình', '✔ của mình', '✔ con mình', ''],
    ['Nhắn tin phụ huynh ↔ giáo viên', '—', '—', '✔', '—', '✔', 'Vào bằng icon ở cụm phải, không phải tab.'],
    ['Báo cáo về con', '—', '—', '—', '—', '✔ chỉ đọc', 'Không thấy dữ liệu em khác, không thấy ghi chú nội bộ lớp.'],
  ],
  {
    tieuDe: 'AI ĐƯỢC LÀM GÌ',
    dan: '✔ = làm được · ✖ = bị chặn có chủ đích · — = không thuộc việc của vai này. Chặn nằm ở CẢ giao diện, server action và luật RLS dưới CSDL, nên gọi thẳng API cũng không đi vòng được.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4 · MÀN HÌNH THEO VAI
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '4 · Màn hình theo vai',
  [
    {ten: 'Đường dẫn', rong: 20},
    {ten: 'Tên trên màn hình', rong: 22},
    {ten: 'Ai mở được', rong: 34},
    {ten: 'Để làm gì', rong: 54},
    {ten: 'Vào bằng cách nào', rong: 26},
  ],
  [
    ['/', 'Bảng lớp', 'Mọi vai đã có tài khoản', 'Trang chủ sau khi đăng nhập; GVCN thấy lớp mình.', 'Tab đầu tiên'],
    ['/admin', 'Quản trị', 'Chỉ Quản trị viên', 'Cơ sở, khối, lớp, mời người dùng, phân công GVCN, mời phụ huynh.', 'Tab'],
    ['/campus', 'Cơ sở', 'Quản trị viên · Ban giám hiệu', 'Toàn cảnh cơ sở: các lớp, tình hình WIG.', 'Tab'],
    ['/roster', 'Danh sách lớp', 'GVCN · Quản trị viên · Ban giám hiệu', 'Ghi danh, sửa thông tin, cho rời lớp, dời lớp, chọn trưởng điểm danh.', 'Tab'],
    ['/wig', 'WIG & Lead measure', 'GVCN · Quản trị viên', 'Mục tiêu tuần này, lớp đang đi tới đâu, nút tạo mục tiêu, nút vào phòng họp.', 'Tab'],
    ['/wig/chi-tiet', 'Chi tiết tuần', 'GVCN · Quản trị viên', 'Từng em trong tuần: ai đã tick, ai chưa.', 'Nút trong /wig'],
    ['/wig/hop', 'Phòng họp WIG', 'GVCN · Quản trị viên', 'Ba bước tổng kết tuần và đặt mục tiêu tuần tới.', 'Nút trong /wig'],
    ['/meeting', 'Biên bản họp', 'GVCN · Quản trị viên · Ban giám hiệu', 'GVCN bị đưa thẳng sang /wig/hop. BGH đọc bản chỉ đọc.', 'Đường dẫn trực tiếp'],
    ['/attendance', 'Điểm danh', 'GVCN · Quản trị viên · trưởng điểm danh', 'Điểm danh hôm nay; GVCN sửa được 7 ngày gần nhất.', 'Tab (trưởng ĐD cũng có)'],
    ['/homework', 'Báo bài', 'Mọi vai', 'Giáo viên đăng bài mỗi ngày; học sinh và phụ huynh mở mỗi tối.', 'Tab'],
    ['/grades', 'Học bạ', 'Mọi vai', 'Điểm số, nhận xét, rèn luyện theo đợt đánh giá.', 'Tab'],
    ['/scoreboard', 'Bảng thi đua', 'GVCN · Quản trị viên · Ban giám hiệu', 'Điểm 4 lĩnh vực của lớp, cộng từ lượt tick.', 'Tab'],
    ['/timetable', 'Thời khoá biểu', 'Mọi vai', 'Quản trị/BGH xếp; các vai khác xem.', 'Tab'],
    ['/subjects', 'Môn học', 'Quản trị viên · Ban giám hiệu', 'Khai môn cho từng khối.', 'Trong /admin'],
    ['/student', 'Bảng của em', 'Học sinh', 'Nơi em tick việc mỗi ngày và xem mình đang tới đâu.', 'Tab đầu của học sinh'],
    ['/student/[id]', 'Trang một em', 'GVCN · Quản trị viên · BGH · chính em · phụ huynh của em', 'Chi tiết WIG cá nhân, duyệt yêu cầu sửa.', 'Bấm tên em trong danh sách'],
    ['/report', 'Báo cáo phụ huynh', 'Chỉ Phụ huynh', 'Điểm danh cộng dồn, tiến độ tuần của con, chiêm nghiệm và việc tuần sau.', 'Tab đầu của phụ huynh'],
    ['/inbox', 'Liên lạc', 'Phụ huynh · GVCN', 'Nhắn tin hai chiều, có chấm đỏ khi chưa đọc.', 'Icon ở cụm phải'],
    ['/notifications', 'Thông báo', 'Mọi vai', 'Chuông thông báo.', 'Icon chuông'],
    ['/gallery', 'Hình ảnh', 'Mọi vai', 'Ảnh của lớp.', 'Nút trong Danh sách lớp / Báo cáo'],
    ['/menu', 'Thực đơn', 'Mọi vai', 'Quản trị/BGH soạn; học sinh và phụ huynh xem qua thẻ nhúng.', 'Thẻ trong trang của họ'],
  ],
  {
    tieuDe: 'MÀN HÌNH NÀO CHO AI',
    dan: 'Cột "Ai mở được" lấy từ guard requireRole thật trong mã. Mở nhầm màn không thuộc vai mình thì bị đá về trang chủ, không phải màn trắng.',
  },
);

// ── Khung cột dùng chung cho các trang test case ──────────────────────────────────────────
const COT_TC = [
  {ten: 'Mã', rong: 9},
  {ten: 'Ưu tiên', rong: 8},
  {ten: 'Vai', rong: 14},
  {ten: 'Màn hình', rong: 16},
  {ten: 'Tiền đề', rong: 30},
  {ten: 'Các bước', rong: 52},
  {ten: 'Kết quả mong đợi', rong: 52},
  {ten: 'Đạt / Không', rong: 11},
  {ten: 'Ghi chú khi chạy', rong: 30},
];

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5 · TC — DỰNG NỀN
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '5 · TC Dựng nền',
  COT_TC,
  [
    ['NEN-01', 'P1', 'Quản trị viên', '/admin', 'Đã đăng nhập bằng tài khoản quản trị', '1. Mở /admin\n2. Tạo cơ sở mới: tên + cấp học', 'Cơ sở hiện trong danh sách. Khối lớp của cấp học ấy được sinh sẵn, không phải gõ tay.', '', ''],
    ['NEN-02', 'P1', 'Quản trị viên', '/admin', 'Đã có cơ sở', '1. Tạo lớp: tên "10A1", chọn khối, năm học 2026-2027', 'Lớp hiện trong danh sách, cột năm học ghi 2026-2027, chưa có chủ nhiệm.', '', ''],
    ['NEN-03', 'P1', 'Quản trị viên', '/subjects', 'Đã có khối', '1. Mở /subjects\n2. Khai vài môn cho khối 10', 'Môn hiện ra và chọn được ở học bạ / thời khoá biểu.', '', ''],
    ['NEN-04', 'P2', 'Quản trị viên', '/timetable', 'Đã có lớp + môn', '1. Xếp vài tiết cho 10A1', 'Thời khoá biểu lưu được; mở lại thấy đúng.', '', ''],
    ['NEN-05', 'P1', 'Quản trị viên', '/admin', 'Đã có lớp', '1. Mời người dùng: dán 3 email, vai Giáo viên chủ nhiệm, chọn lớp\n2. Mời tiếp danh sách học sinh, vai Học sinh, chọn lớp', 'Báo "Đã mời N người". Lời mời hiện trong danh sách chờ.', '', ''],
    ['NEN-06', 'P1', 'Quản trị viên', '/admin', 'Vừa mời ở NEN-05', '1. Mời lại một email trong số đó với vai KHÁC', 'Vai của lời mời được ghi đè, không sinh dòng thứ hai.', '', ''],
    ['NEN-07', 'P1', 'Quản trị viên', '/admin', 'Lớp sắp giao cho giáo viên thật', '1. Mở danh sách lớp\n2. Soi cột chủ nhiệm của lớp sắp giao', 'Cột chủ nhiệm phải TRỐNG. Còn tên ai đó (kể cả tài khoản thử) thì giáo viên được mời sẽ không nhận được lớp — xem bẫy GV-1.', '', ''],
    ['NEN-08', 'P2', 'Người lạ', 'class.vietanh.org', 'Email @truongvietanh.com KHÔNG có lời mời', '1. Đăng nhập Google', 'Thấy màn "Tài khoản chưa được cấp quyền", không vào được màn nào khác.', '', ''],
    ['NEN-09', 'P2', 'Quản trị viên', '/admin', 'Có người đang ở vai pending', '1. Cấp vai cho họ trong danh sách chờ', 'Họ tải lại trang là vào được đúng màn của vai mới.', '', ''],
    ['NEN-10', 'P1', 'Ban giám hiệu', '/campus', 'Lời mời BGH có kèm CƠ SỞ', '1. Đăng nhập lần đầu\n2. Mở /campus', 'Thấy các lớp trong cơ sở mình. Nếu trống trơn → lời mời thiếu cơ sở, xem bẫy BGH-1.', '', ''],
    ['NEN-11', 'P2', 'Ban giám hiệu', '/roster', 'Đã đăng nhập', '1. Mở danh sách một lớp trong cơ sở', 'Xem được tên và email học sinh, KHÔNG thấy ngày sinh / SĐT phụ huynh (các cột ấy ẩn hẳn).', '', ''],
    ['NEN-12', 'P2', 'Ban giám hiệu', '/wig', 'Đã đăng nhập', '1. Gõ thẳng /wig lên thanh địa chỉ', 'Bị đá về trang chủ — đặt WIG không phải việc của BGH.', '', ''],
  ],
  {
    tieuDe: 'TEST CASE — DỰNG NỀN (NHỊP 1 & 2)',
    dan: 'Chạy hết nhóm này trước khi cho giáo viên thật đăng nhập. NEN-07 là bước dễ bỏ qua nhất và cũng đắt nhất nếu bỏ qua.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6 · TC — WIG
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '6 · TC WIG',
  COT_TC,
  [
    ['WIG-01', 'P1', 'GVCN', 'class.vietanh.org', 'Đã được mời làm GVCN, lớp còn TRỐNG chủ nhiệm', '1. Đăng nhập Google lần đầu', 'Vào thẳng lớp của mình, tên lớp hiện trên đầu trang. Nếu thấy "Chưa có lớp" → xem bẫy GV-1.', '', ''],
    ['WIG-02', 'P1', 'GVCN', '/roster', 'Đã nhận lớp', '1. Ghi danh 1 em bằng email, điền họ tên + ngày sinh\n2. Nhìn lại danh sách', 'Em hiện ngay với nhãn "chưa đăng nhập", đủ họ tên và ngày sinh vừa điền.', '', ''],
    ['WIG-03', 'P1', 'GVCN', '/roster', 'Vừa ghi danh ở WIG-02', '1. Bấm nút bút chì trên dòng em đó\n2. Sửa họ tên, bấm Lưu', 'Dòng hiện tên mới ngay, không phải tải lại trang. Bảng sửa KHÔNG có ô email.', '', ''],
    ['WIG-04', 'P2', 'GVCN', '/roster', 'Em đã có ghi chú', '1. Mở bảng sửa, xoá trắng ô Ghi chú, Lưu', 'Ghi chú biến mất thật (cột hiện "—"), không phải vẫn còn giá trị cũ.', '', ''],
    ['WIG-05', 'P1', 'GVCN', '/wig', 'Lớp chưa có mục tiêu nào', '1. Bấm "Tạo mục tiêu"', 'Menu mở ở tab NĂM. Tab Tháng và Tuần bị khoá, và bên cạnh nói rõ vì sao khoá.', '', ''],
    ['WIG-06', 'P1', 'GVCN', '/wig', 'Đang ở WIG-05', '1. Chọn năm học 2026-2027\n2. Điền lĩnh vực, tên mục tiêu, từ 0 đến N, đơn vị\n3. Lưu', 'Tạo xong. Khoảng ngày của năm học phải là 01/07/2026 → 30/06/2027 (KHÔNG phải 01/09 → 31/05).', '', ''],
    ['WIG-07', 'P1', 'GVCN', '/wig', 'Đã có mục tiêu năm', '1. Mở lại "Tạo mục tiêu"', 'Lần này menu mở sẵn ở tab THÁNG (loại xa nhất mà lớp đủ điều kiện tạo).', '', ''],
    ['WIG-08', 'P1', 'GVCN', '/wig', 'Đang ở WIG-07', '1. Chọn tháng hiện tại\n2. Chọn mục tiêu năm làm cha\n3. Điền và Lưu', 'Tạo xong, mục tiêu tháng treo dưới mục tiêu năm.', '', ''],
    ['WIG-09', 'P1', 'GVCN', '/wig', 'Đã có mục tiêu tháng', '1. Mở "Tạo mục tiêu" → tab TUẦN\n2. Soi ô "Thuộc mục tiêu tháng" và ô lịch', 'Mục tiêu cha chọn sẵn là tháng PHỦ tuần đang xem. Ô lịch mở đúng vào tuần đang đứng, không nhảy sang tháng khác.', '', ''],
    ['WIG-10', 'P1', 'GVCN', '/wig', 'Lớp có mục tiêu của HAI tháng khác nhau', '1. Mở tab Tuần\n2. Đổi qua lại ô "Thuộc mục tiêu tháng"', 'Đổi cha thì ô lịch tự kéo vào khoảng của cha mới, không để lại một ngày mà chính nó đang cấm.', '', ''],
    ['WIG-11', 'P2', 'GVCN', '/wig', 'Đang tạo mục tiêu tuần', '1. Thử chọn một ngày ngoài khoảng của mục tiêu cha', 'Ô lịch không cho chọn — chặn ngay tại chỗ, không phải điền xong cả form mới bị mắng.', '', ''],
    ['WIG-12', 'P1', 'GVCN', '/wig', 'Đang điền mục tiêu', '1. Gõ 5.1 vào ô "Mục tiêu (số)"\n2. Bấm Lưu', 'Trình duyệt từ chối ngay: mục tiêu chỉ nhận số nguyên. Gõ 5 thì lưu bình thường.', '', ''],
    ['WIG-13', 'P1', 'GVCN', '/wig', 'Đã có mục tiêu tuần', '1. Bấm "Thêm việc"\n2. Điền tên việc, mục tiêu số, đơn vị, mỗi lần tick đáng bao nhiêu\n3. Chọn ngày trong tuần (bỏ trống = T2–T6)\n4. Lưu', 'Việc hiện thành một thẻ dưới mục tiêu tuần, ghi rõ mục tiêu và những thứ được tick.', '', ''],
    ['WIG-14', 'P2', 'GVCN', '/wig', 'Đang ở form Thêm việc', '1. Soi ô "Nhóm nhỏ trong …"', 'Nhãn ghi ĐÚNG lĩnh vực của mục tiêu (vd "Nhóm nhỏ trong Kiến thức") và nói rõ lĩnh vực đã lấy sẵn, không phải điền lại.', '', ''],
    ['WIG-15', 'P2', 'GVCN', '/wig', 'Đã có ít nhất 1 việc', '1. Nhìn hai nút Sửa và Xoá trên thẻ việc', 'Hai nút cao bằng nhau, chữ Xoá không bị vắt xuống dòng dưới icon thùng rác.', '', ''],
    ['WIG-16', 'P2', 'GVCN', '/wig', 'Đặt mục tiêu tuần quá cao', '1. Đặt mục tiêu việc lớn hơn số lượt tick tối đa cả lớp có thể làm', 'Có cảnh báo "quá nhiều", nhưng VẪN lưu được — là cảnh báo, không phải rào chắn.', '', ''],
    ['WIG-17', 'P1', 'Học sinh', 'class.vietanh.org', 'Đã được ghi danh vào lớp', '1. Đăng nhập Google lần đầu', 'Vào thẳng bảng của mình, đúng lớp, không phải chờ ai duyệt.', '', ''],
    ['WIG-18', 'P1', 'Học sinh', '/student', 'Lớp đã có việc để tick trong tuần', '1. Tick một việc của hôm nay', 'Số tăng ngay. Tiến độ mục tiêu tuần / tháng / năm cộng theo.', '', ''],
    ['WIG-19', 'P1', 'GVCN', '/wig/chi-tiet', 'Vài em đã tick', '1. Mở màn Chi tiết tuần', 'Thấy từng em: ai đã góp, ai chưa. Số khớp với số em vừa tick.', '', ''],
    ['WIG-20', 'P2', 'Học sinh', '/student', 'Đã tick hôm qua', '1. Thử gỡ lượt tick của hôm qua', 'Không tự gỡ được — chỉ ghi được cho ngày hôm nay. Em phải gửi yêu cầu cho GVCN.', '', ''],
    ['WIG-21', 'P2', 'Học sinh', '/student', 'Đang xem mục tiêu của mình', '1. Thử đổi mục tiêu / target của chính mình', 'Không có đường nào để tự đổi. Chỉ gửi được yêu cầu.', '', ''],
    ['WIG-22', 'P2', 'GVCN', '/student/[id]', 'Có yêu cầu sửa đang chờ', '1. Mở yêu cầu, duyệt hoặc từ chối', 'Trạng thái yêu cầu đổi, và nếu duyệt thì thay đổi có hiệu lực ngay.', '', ''],
    ['WIG-23', 'P3', 'GVCN', '/scoreboard', 'Các em đã tick vài ngày', '1. Mở bảng thi đua', 'Điểm 4 lĩnh vực khớp với số lượt tick; lĩnh vực lấy từ chính mục tiêu, không phải khai lại.', '', ''],
  ],
  {
    tieuDe: 'TEST CASE — WIG (ƯU TIÊN)',
    dan: 'Chạy theo đúng thứ tự WIG-01 → WIG-23: mỗi ca dựng tiền đề cho ca sau. Nhóm WIG-05 đến WIG-13 là chuỗi năm → tháng → tuần → việc, mắt xích nào đứt thì các em không có gì để tick.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 7 · TC — HỌP WIG
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '7 · TC Họp WIG',
  COT_TC,
  [
    ['HOP-01', 'P1', 'GVCN', '/wig → /wig/hop', 'Tuần vừa rồi lớp có mục tiêu và có lượt tick', '1. Từ /wig bấm nút vào phòng họp', 'Phòng họp mở ĐÚNG TUẦN VỪA XONG (không phải tuần đang chạy). Tên tuần hiện trên đầu.', '', ''],
    ['HOP-02', 'P1', 'GVCN', '/wig/hop', 'Đang ở HOP-01', '1. Đọc bước 1', 'Bảng liệt kê từng việc chung của tuần đó, kèm con số đã đạt và "N/tổng em đã góp". Con số này máy đếm, không có ô nào sửa tay được.', '', ''],
    ['HOP-03', 'P1', 'GVCN', '/wig/hop', 'Đang ở bước 1', '1. Chấm Thắng / Chưa đạt cho từng việc\n2. Ghi "Rút ra điều gì"', 'Lựa chọn được ghi nhận; chưa chấm thì hiện "Buổi họp chưa chấm việc này".', '', ''],
    ['HOP-04', 'P2', 'GVCN', '/wig/hop', 'Tuần trước có cam kết', '1. Nhìn đầu bước 1', 'Hiện lại câu "Tuần … lớp đã hứa" — cam kết của buổi họp trước.', '', ''],
    ['HOP-05', 'P1', 'GVCN', '/wig/hop', 'Đang ở bước 2', '1. Điền "Chiêm nghiệm tuần qua"\n2. Điền một câu cam kết cho tuần tới', 'Cả hai ô nhận nội dung dài, không bị mất khi cuộn qua bước khác.', '', ''],
    ['HOP-06', 'P1', 'GVCN', '/wig/hop', 'Lớp đã có mục tiêu năm và tháng', '1. Sang bước 3\n2. Điền mục tiêu tuần TỚI (tên, số, đơn vị)', 'Điền được ngay tại đây, không phải quay lại trang WIG.', '', ''],
    ['HOP-07', 'P1', 'GVCN', '/wig/hop', 'Lớp CHƯA có mục tiêu tháng của tháng tới', '1. Sang bước 3', 'Nói rõ "Chưa có mục tiêu tháng …" và cho đặt LUÔN tại chỗ, không đá người dùng đi nơi khác.', '', ''],
    ['HOP-08', 'P2', 'GVCN', '/wig/hop', 'Lớp CHƯA có mục tiêu năm nào', '1. Sang bước 3', 'Nói rõ "Lớp chưa có mục tiêu năm nào" kèm nút sang trang WIG để tạo. Đây là trường hợp duy nhất phải rời phòng họp.', '', ''],
    ['HOP-09', 'P2', 'GVCN', '/wig/hop', 'Tuần trước đã có việc để tick', '1. Sang bước 3, soi danh sách việc', 'Việc của tuần trước được mang sang sẵn, có ghi chú "Mang từ tuần trước sang" — sửa hay xoá đều được.', '', ''],
    ['HOP-10', 'P1', 'GVCN', '/wig/hop', 'Đã làm xong ba bước', '1. Bấm "Kết thúc buổi họp & lưu"', 'Một lần lưu xong cả ba bước: biên bản được ghi, mục tiêu tuần mới được tạo, tick tuần cũ bị chốt.', '', ''],
    ['HOP-11', 'P1', 'Học sinh', '/student', 'GVCN vừa kết thúc buổi họp ở HOP-10', '1. Đăng nhập, mở bảng của mình', 'Thấy mục tiêu và việc của TUẦN MỚI, tick được ngay.', '', ''],
    ['HOP-12', 'P2', 'GVCN', '/wig/hop', 'Đã kết thúc buổi họp', '1. Mở lại phòng họp của tuần đó', 'Hiện lại biên bản đã lưu, không cho chấm lại lung tung; có nút "Gỡ biên bản tuần …".', '', ''],
    ['HOP-13', 'P2', 'GVCN', '/wig/hop', 'Đã kết thúc nhầm tuần', '1. Bấm "Gỡ biên bản tuần …"\n2. Xác nhận', 'Biên bản bị gỡ, tick tuần ấy MỞ LẠI cho các em. Hộp xác nhận nói rõ không hoàn tác được.', '', ''],
    ['HOP-14', 'P2', 'GVCN', '/wig/hop', 'Muốn xem tuần khác', '1. Bấm "Tuần trước" / "Tuần sau" / "Về tuần vừa xong"', 'Chuyển đúng tuần, và nút "Về tuần vừa xong" luôn đưa về tuần mặc định.', '', ''],
    ['HOP-15', 'P2', 'Ban giám hiệu', '/meeting', 'Lớp đã có biên bản', '1. Mở /meeting', 'Thấy bản CHỈ ĐỌC kèm câu giải thích rằng việc chấm và đặt mục tiêu thuộc về GVCN. Không có nút lưu.', '', ''],
    ['HOP-16', 'P2', 'GVCN', '/meeting', 'Đã đăng nhập', '1. Gõ /meeting lên thanh địa chỉ', 'Bị đưa thẳng sang /wig/hop — chỉ có MỘT màn sửa được buổi họp, không dựng bản sao thứ hai.', '', ''],
    ['HOP-17', 'P1', 'Phụ huynh', '/report', 'Buổi họp đã kết thúc và con có mục tiêu tuần', '1. Mở báo cáo, chọn đúng tuần', 'Thấy kết quả tuần của con, "Chiêm nghiệm tuần" và "Việc tuần sau". Không thấy dữ liệu em khác.', '', ''],
    ['HOP-18', 'P3', 'GVCN', '/wig/hop', 'Tuần đó lớp không có việc chung nào', '1. Mở phòng họp tuần ấy', 'Nói rõ "Tuần … lớp không có việc chung nào để tổng kết" thay vì bảng trống không giải thích.', '', ''],
  ],
  {
    tieuDe: 'TEST CASE — HỌP WIG (ƯU TIÊN)',
    dan: 'Nhịp cuối tuần. Chạy được từ HOP-01 tới HOP-11 là coi như vòng vận hành khép kín: tuần cũ được chốt, tuần mới có mục tiêu, các em tick tiếp được.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 8 · TC — VẬN HÀNH KHÁC
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '8 · TC Vận hành khác',
  COT_TC,
  [
    ['DD-01', 'P1', 'GVCN', '/attendance', 'Lớp đã có học sinh đăng nhập', '1. Điểm danh hôm nay cho cả lớp', 'Lưu được, mở lại thấy đúng.', '', ''],
    ['DD-02', 'P1', 'GVCN', '/attendance', 'Đã điểm danh hôm nay', '1. Lùi về một ngày trong 7 ngày gần nhất, sửa', 'Sửa được.', '', ''],
    ['DD-03', 'P2', 'GVCN', '/attendance', 'Muốn sửa ngày cũ hơn 7 ngày', '1. Lùi quá 7 ngày, thử sửa', 'Không sửa được — quá hạn thì chỉ quản trị viên làm được.', '', ''],
    ['DD-04', 'P2', 'GVCN', '/roster', 'Một em đã đăng nhập', '1. Chọn em đó làm trưởng điểm danh', 'Em cũ (nếu có) tự được gỡ; mỗi lớp đúng một trưởng.', '', ''],
    ['DD-05', 'P2', 'Trưởng điểm danh', '/attendance', 'Vừa được chọn ở DD-04', '1. Đăng nhập, mở tab Điểm danh\n2. Điểm danh hôm nay', 'Ghi được HÔM NAY. Thử sửa ngày cũ thì không được.', '', ''],
    ['DD-06', 'P2', 'Học sinh thường', '/attendance', 'KHÔNG phải trưởng điểm danh', '1. Gõ thẳng /attendance', 'Không có tab, và vào thẳng cũng không ghi được.', '', ''],
    ['BB-01', 'P2', 'GVCN', '/homework', 'Đã có lớp', '1. Đăng một bài tập về nhà cho hôm nay', 'Bài hiện trong danh sách của lớp.', '', ''],
    ['BB-02', 'P2', 'Học sinh', '/homework', 'GVCN vừa đăng ở BB-01', '1. Mở tab Báo bài', 'Thấy đúng bài của lớp mình.', '', ''],
    ['BB-03', 'P2', 'Phụ huynh', '/homework', 'Con thuộc lớp ấy', '1. Mở tab Báo bài', 'Thấy bài của lớp con.', '', ''],
    ['HB-01', 'P2', 'Quản trị viên', '/grades', 'Đã có môn và lớp', '1. Khai một đợt đánh giá cho năm học', 'Đợt hiện ra và chọn được khi nhập điểm.', '', ''],
    ['HB-02', 'P2', 'GVCN', '/grades', 'Đã có đợt đánh giá', '1. Nhập điểm một môn cho vài em\n2. Ghi nhận xét', 'Lưu được; mở lại đúng.', '', ''],
    ['HB-03', 'P2', 'Phụ huynh', '/grades', 'GVCN đã nhập ở HB-02', '1. Mở tab Học bạ', 'Thấy điểm và nhận xét CỦA CON MÌNH, không thấy em khác.', '', ''],
    ['LL-01', 'P2', 'Phụ huynh', '/inbox', 'Đã đăng nhập', '1. Bấm icon Liên lạc, gửi một tin cho GVCN', 'Tin gửi đi; GVCN thấy chấm đỏ.', '', ''],
    ['LL-02', 'P2', 'GVCN', '/inbox', 'Có tin ở LL-01', '1. Mở Liên lạc, trả lời', 'Phụ huynh nhận được; chấm đỏ tắt sau khi đọc.', '', ''],
    ['PH-01', 'P1', 'Quản trị viên', '/admin', 'Học sinh đã đăng nhập lần đầu', '1. Mời phụ huynh: email + chọn đúng con', 'Báo "Đã mời". Nếu chưa em nào đăng nhập thì danh sách chọn con TRỐNG — đó là lý do việc này ở nhịp 5.', '', ''],
    ['PH-02', 'P1', 'Phụ huynh', '/report', 'Đã được mời ở PH-01, dùng email NGOÀI miền trường', '1. Đăng nhập lần đầu\n2. Mở /report', 'Vào đúng vai phụ huynh, thấy báo cáo con mình. Nếu thấy "Tài khoản chưa được cấp quyền" → xem bẫy PH-1.', '', ''],
    ['PH-03', 'P1', 'Phụ huynh', '/report', 'Đã vào được', '1. Soi kỹ trang', 'Chỉ thấy dữ liệu con mình: điểm danh cộng dồn, tiến độ WIG tuần, chiêm nghiệm, việc tuần sau. KHÔNG có tên em khác, không có ghi chú nội bộ lớp.', '', ''],
    ['PH-04', 'P2', 'Phụ huynh', '/roster', 'Đã đăng nhập', '1. Gõ thẳng /roster', 'Bị đá về — phụ huynh không xem danh sách lớp.', '', ''],
    ['DL-01', 'P3', 'GVCN', '/roster', 'Em cần chuyển sang lớp khác', '1. Bấm "Dời lớp", chọn lớp đích, gửi đề nghị', 'Báo đã gửi đề nghị; em VẪN ở lớp cũ cho tới khi lớp bên kia duyệt.', '', ''],
    ['DL-02', 'P3', 'GVCN lớp đích', '/roster', 'Có đề nghị ở DL-01', '1. Duyệt đề nghị', 'Em sang lớp mới; danh sách hai lớp cùng cập nhật.', '', ''],
    ['DL-03', 'P3', 'Quản trị viên', '/roster', 'Có em cần chuyển', '1. Dời lớp bằng tài khoản quản trị', 'Chuyển THẲNG, không qua duyệt.', '', ''],
  ],
  {
    tieuDe: 'TEST CASE — VẬN HÀNH KHÁC',
    dan: 'Điểm danh, báo bài, học bạ, liên lạc, phụ huynh, dời lớp. Nhóm PH là P1 vì phụ huynh là vai duy nhất người ngoài trường nhìn thấy — hỏng ở đây là hỏng trước mặt khách.',
  },
);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 9 · CẠM BẪY ĐÃ BIẾT
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '9 · Cạm bẫy đã biết',
  [
    {ten: 'Mã', rong: 9},
    {ten: 'Bẫy', rong: 34},
    {ten: 'Triệu chứng người dùng thấy', rong: 44},
    {ten: 'Vì sao', rong: 52},
    {ten: 'Cách tránh / chữa', rong: 46},
  ],
  [
    ['GV-1', 'Lớp đã có người đứng tên chủ nhiệm thì giáo viên được mời KHÔNG nhận được lớp', 'Cô giáo đăng nhập, đúng vai giáo viên, nhưng mở app ra thấy "Chưa có lớp". Không có thông báo lỗi nào.', 'Trigger lúc đăng nhập chỉ gán lớp khi lớp CHƯA ai chủ nhiệm (chốt này sinh ra để giáo viên không cướp lớp của nhau). Lời mời bị xoá ngay sau lần đăng nhập đầu, nên không có lần thứ hai.', 'TRƯỚC khi cho giáo viên đăng nhập: kiểm cột chủ nhiệm của lớp phải TRỐNG (test NEN-07). Lỡ rồi thì quản trị viên vào /admin phân công lại GVCN — vẫn chữa được, chỉ mất một bước.'],
    ['PH-1', 'Email @truongvietanh.com không dùng làm phụ huynh được', 'Người được mời làm phụ huynh đăng nhập xong thấy màn "Tài khoản chưa được cấp quyền".', 'Lúc đăng nhập, hệ thống tra MIỀN email trước. Miền truongvietanh.com đã có vai mặc định là "pending", nên nhánh kiểm lời mời phụ huynh bị bỏ qua hoàn toàn.', 'Dùng email thật của phụ huynh, hoặc một gmail bất kỳ để thử — miền ngoài trường thì đúng luồng.'],
    ['BGH-1', 'Lời mời ban giám hiệu thiếu cơ sở', 'BGH đăng nhập, vai đúng là hiệu trưởng, nhưng mở màn nào cũng trống trơn.', 'Quyền của BGH là "mọi lớp TRONG CƠ SỞ MÌNH". Không có cơ sở thì tập hợp lớp họ nhìn thấy là tập rỗng.', 'Khi mời BGH phải chọn cơ sở. Lỡ rồi thì quản trị viên sửa hồ sơ của họ, gán cơ sở.'],
    ['HS-1', 'Học sinh đăng nhập trước khi được ghi danh', 'Em thấy màn "Tài khoản chưa được cấp quyền", hoặc vào được nhưng không thuộc lớp nào.', 'Lớp của em do lời mời / ghi danh quyết định. Không có dòng nào thì không có lớp nào.', 'Ghi danh xong mới bảo các em đăng nhập. Lỡ rồi thì GVCN ghi danh lại bằng đúng email đó — em vào lớp ở lần đăng nhập sau.'],
    ['WIG-1', 'Có mục tiêu tuần nhưng không có việc để tick', 'Màn hình học sinh trống trơn, các em không có gì để bấm; cuối tuần họp thì không có số nào.', 'Mục tiêu tuần chỉ là cái đích. Thứ các em chạm vào hằng ngày là "việc để các em tick" (lead measure) — hai thứ khác nhau.', 'Sau khi tạo mục tiêu tuần, LUÔN thêm ít nhất một việc (test WIG-13). Trang /wig có nói ra khi tuần chưa có việc nào.'],
    ['WIG-2', 'Tick không ghi được cho ngày hôm qua', 'Em quên tick, hôm sau vào tick bù thì không được.', 'Cố ý: số liệu 4DX phải là số ghi nóng trong ngày, không phải nhớ lại cuối tuần. Nhớ lại thì con số đẹp mà vô nghĩa.', 'Em gửi yêu cầu, GVCN thêm giúp. Nhắc các em tick cuối mỗi buổi học.'],
    ['WIG-3', 'Mục tiêu tuần rơi vào tháng khác', 'Vừa tạo mục tiêu tuần xong thì thấy nó nằm ở tuần cách hôm nay cả tháng.', 'Đã sửa 06/08/2026: trước đó mục tiêu cha chọn sẵn là cái ĐẦU DANH SÁCH, nên lớp nào tạo mục tiêu tháng 9 trước tháng 8 thì bị kéo theo tháng 9.', 'Bản đang chạy đã chọn cha theo tuần đang đứng. Vẫn nên soi lại ô "Thuộc mục tiêu tháng" trước khi Lưu (test WIG-09).'],
    ['NH-1', 'Năm học bắt đầu 01/07, không phải 01/09', 'Mục tiêu năm tạo trong tháng 7 hoặc 8 mà nhận ngày bắt đầu 01/09 thì mọi mục tiêu tháng/tuần bị đẩy về sau tháng 9.', 'Đã sửa 06/08/2026. Trước đó nhãn năm học đổi ở tháng 6 còn khoảng ngày lại là 01/09 → 31/05 — hai mốc nói hai chuyện khác nhau.', 'Bản đang chạy: 2026-2027 = 01/07/2026 → 30/06/2027. Kiểm bằng test WIG-06.'],
    ['HOP-1', 'Họp nhầm tuần', 'Chốt xong mới nhận ra đang tổng kết tuần khác.', 'Phòng họp mặc định mở tuần vừa xong, nhưng vẫn đi qua lại tuần khác được.', 'Bấm "Gỡ biên bản tuần …" — tick tuần ấy mở lại. Không hoàn tác được nên đọc kỹ hộp xác nhận (test HOP-13).'],
    ['DL-1', 'Dời lớp không thấy có hiệu lực', 'GVCN gửi đề nghị dời lớp rồi mà em vẫn nằm ở lớp cũ.', 'Đúng thiết kế: lớp ĐÍCH phải duyệt thì em mới sang. Trong lúc chờ em vẫn thuộc lớp cũ để không mất điểm danh, WIG.', 'Nhắc GVCN lớp đích vào duyệt. Quản trị viên thì chuyển thẳng không cần duyệt.'],
    ['DATA-1', 'Lớp 10A1 còn dữ liệu thử', 'Lớp thật mở ra đã có sẵn mục tiêu và một học sinh không ai biết là ai.', 'Vết của đợt dò lỗi đầu tháng 8: 4 mục tiêu WIG và alex@truongvietanh.com.', 'Bỏ chú thích khối cuối trong scripts/phan-vai-van-hanh-thu.sql rồi chạy — nhớ là xoá WIG là xoá cả lượt tick bên trong.'],
  ],
  {
    tieuDe: 'CẠM BẪY ĐÃ BIẾT — ĐỌC TRƯỚC KHI CHẠY THẬT',
    dan: 'Mỗi dòng ở đây là một chuyện ĐÃ xảy ra thật hoặc chắc chắn sẽ xảy ra với cấu hình hiện tại. GV-1 và PH-1 là hai cái chặn cả đợt vận hành nếu không biết trước.',
  },
);

const duong = process.argv[2] ?? 'So_tay_van_hanh_Viet_Anh_Class.xlsx';
await wb.xlsx.writeFile(duong);
console.log('Đã ghi:', duong);
