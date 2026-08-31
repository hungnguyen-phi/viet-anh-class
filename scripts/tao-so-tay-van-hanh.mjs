// SINH SỔ TAY VẬN HÀNH (.xlsx) cho 30+ người chạy thử.
//
//   npm i --no-save exceljs && node scripts/tao-so-tay-van-hanh.mjs
//
// HAI NGUYÊN TẮC BÀY BIỆN, vì người mở file là thầy cô chứ không phải người làm phần mềm:
//
//   1. THỨ TỰ TAB = THỨ TỰ LÀM. Đọc từ trái sang phải là làm đúng thứ tự. Bản trước để mấy trang
//      CẦN ĐIỀN ở tận cuối, sau bảy trang chỉ để đọc — mở ra là lạc, không biết bắt đầu từ đâu.
//   2. MÀU NÓI THAY LỜI. Vàng = chỗ bạn điền. Xám/trắng = đọc thôi. Tab xanh lá = trang có việc
//      phải làm, tab xám = trang tra cứu. Không cần đọc hướng dẫn mới biết được gõ vào đâu.
//
// Không kể hiện trạng dữ liệu (hôm nay mấy lớp, ai đã mời) — thứ đó đổi mỗi tuần, ghi vào là sổ
// tay sai ngay tuần sau. Riêng danh sách người thử thì đọc thẳng từ hệ thống lúc sinh file.
import ExcelJS from 'exceljs';

const NAVY = 'FF0B1F3B';
const GOLD = 'FFF9DD0E';
const VANG_DIEN = 'FFFFF7CC'; // ô người dùng điền
const XAM_DOC = 'FFF2F4F7'; // ô chỉ đọc
const TRANG = 'FFFFFFFF';
const TAB_DIEN = 'FF34A853'; // tab xanh lá = có việc phải làm
const TAB_DOC = 'FF8A97A8'; // tab xám = tra cứu

const wb = new ExcelJS.Workbook();
wb.creator = 'Trường Việt Anh';
wb.created = new Date();

// dien = danh sách chỉ số cột (1-based) mà người dùng ĐƯỢC điền. Rỗng = cả trang chỉ đọc.
function trang(ten, cot, dong, tieuDe, {dien = [], caoDong} = {}) {
  const ws = wb.addWorksheet(ten, {
    views: [{state: 'frozen', ySplit: 3}],
    properties: {tabColor: {argb: dien.length ? TAB_DIEN : TAB_DOC}},
  });
  const nDien = new Set(dien);

  ws.mergeCells(1, 1, 1, cot.length);
  const t = ws.getCell(1, 1);
  t.value = tieuDe;
  t.font = {bold: true, size: 14, color: {argb: NAVY}};
  t.alignment = {vertical: 'middle'};
  ws.getRow(1).height = 26;

  // Chú thích màu nhắc NGAY TẠI CHỖ, không bắt lật về trang đầu mới hiểu.
  ws.mergeCells(2, 1, 2, cot.length);
  const c = ws.getCell(2, 1);
  c.value = dien.length
    ? '🟡 Ô MÀU VÀNG là chỗ bạn điền          ⬜ Ô xám / trắng: chỉ đọc, đừng sửa'
    : '⬜ Trang này chỉ để đọc — không cần điền gì';
  c.font = {size: 10.5, italic: true, color: {argb: 'FF5A6B80'}};
  c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: dien.length ? VANG_DIEN : XAM_DOC}};
  c.alignment = {vertical: 'middle'};
  ws.getRow(2).height = 20;

  const h = ws.getRow(3);
  cot.forEach((x, i) => {
    const o = h.getCell(i + 1);
    o.value = nDien.has(i + 1) ? `✍ ${x.ten}` : x.ten;
    o.font = {bold: true, size: 10.5, color: {argb: 'FFFFFFFF'}};
    o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY}};
    o.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
    ws.getColumn(i + 1).width = x.rong;
  });
  h.height = 24;

  const vien = {
    top: {style: 'thin', color: {argb: 'FFD8DEE8'}},
    left: {style: 'thin', color: {argb: 'FFD8DEE8'}},
    bottom: {style: 'thin', color: {argb: 'FFD8DEE8'}},
    right: {style: 'thin', color: {argb: 'FFD8DEE8'}},
  };

  dong.forEach((r, i) => {
    const row = ws.addRow(r);
    row.alignment = {vertical: 'top', wrapText: true};
    row.font = {size: 10.5};
    if (caoDong) row.height = caoDong;
    const laNhom = typeof r[0] === 'string' && r[0].startsWith('▸');
    row.eachCell({includeEmpty: true}, (o, j) => {
      o.border = vien;
      if (laNhom) {
        o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: GOLD}};
        o.font = {bold: true, size: 10.5, color: {argb: NAVY}};
      } else if (nDien.has(j)) {
        o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: VANG_DIEN}};
      } else {
        o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: i % 2 ? XAM_DOC : TRANG}};
      }
    });
  });
  ws.autoFilter = {from: {row: 3, column: 1}, to: {row: 3 + dong.length, column: cot.length}};
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1 · BẮT ĐẦU Ở ĐÂY — mở file ra là thấy ngay phải làm gì, không phải đi tìm.
// ══════════════════════════════════════════════════════════════════════════════════════════
const wsBD = wb.addWorksheet('1 · BẮT ĐẦU Ở ĐÂY', {properties: {tabColor: {argb: 'FFEA4335'}}});
wsBD.getColumn(1).width = 8;
wsBD.getColumn(2).width = 104;
const bd = [
  ['', 'CHẠY THỬ APP VIỆT ANH CLASS', 'to'],
  ['', 'Làm theo 4 bước dưới đây. Khoảng 15–20 phút.', 'phu'],
  ['', '', ''],
  ['①', 'ĐĂNG NHẬP   →   class.truongvietanh.com', 'buoc'],
  ['', 'Bấm "Đăng nhập bằng Google", chọn đúng email trường của mình. Không cần mật khẩu riêng.', 'thuong'],
  ['', 'Hiện "Tài khoản chưa được cấp quyền"? Chưa hỏng gì đâu — nhắn người phụ trách là mở được ngay.', 'thuong'],
  ['', '', ''],
  ['②', 'TÌM TÊN MÌNH   →   tab "2 · Tìm tên mình"', 'buoc'],
  ['', 'Tìm email của mình, điền HỌ VÀ TÊN, rồi chọn "Rồi" ở cột cuối khi đã đăng nhập được.', 'thuong'],
  ['', 'Ngay dòng đó có ghi: bạn được làm gì, và phải thử những mục nào.', 'thuong'],
  ['', '', ''],
  ['③', 'THỬ THEO DANH SÁCH   →   các tab "3 · Thử …" đến "6 · Thử …"', 'buoc'],
  ['', 'Làm theo cột "Làm gì", rồi so với cột "Phải thấy gì". Mục có dấu ★ là quan trọng nhất.', 'thuong'],
  ['', 'Chỉ cần thử những mục ghi trong dòng của mình ở tab 2.', 'thuong'],
  ['', '', ''],
  ['④', 'GẶP GÌ LẠ THÌ GHI LẠI   →   tab "7 · Ghi kết quả"', 'buoc'],
  ['', 'Mỗi lần thử một dòng. Quan trọng nhất là cột "CHUYỆN GÌ ĐÃ XẢY RA" — cứ tả bằng lời của mình.', 'thuong'],
  ['', 'Góp ý ngoài danh sách thì viết ở tab "8 · Góp ý tự do". Không có gì là quá nhỏ để ghi.', 'thuong'],
  ['', '', ''],
  ['', 'MÀU TRONG FILE', 'buoc'],
  ['🟡', 'Ô màu VÀNG — chỗ bạn điền', 'thuong'],
  ['⬜', 'Ô màu XÁM hoặc trắng — chỉ đọc, đừng sửa', 'thuong'],
  ['🟩', 'Tab màu XANH LÁ — trang có việc phải làm', 'thuong'],
  ['⬛', 'Tab màu XÁM — trang tra cứu, mở khi cần', 'thuong'],
  ['', '', ''],
  ['', 'TRỌNG TÂM ĐỢT NÀY', 'buoc'],
  ['', 'Phần MỤC TIÊU (WIG) và HỌP WIG CUỐI TUẦN — tab 3 và tab 4. Để ý kỹ hai phần đó giúp.', 'thuong'],
  ['', '', ''],
  ['', 'File có email của học sinh — giữ trong nhóm, đừng chuyển ra ngoài.', 'nhac'],
];
bd.forEach((r) => {
  const row = wsBD.addRow([r[0], r[1]]);
  const o = row.getCell(2);
  const k = r[2];
  if (k === 'to') {
    o.font = {bold: true, size: 20, color: {argb: NAVY}};
    row.height = 34;
  } else if (k === 'phu') {
    o.font = {size: 12, italic: true, color: {argb: 'FF5A6B80'}};
    row.height = 22;
  } else if (k === 'buoc') {
    o.font = {bold: true, size: 13, color: {argb: NAVY}};
    o.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: GOLD}};
    o.alignment = {vertical: 'middle'};
    const s = row.getCell(1);
    s.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: GOLD}};
    s.font = {bold: true, size: 15, color: {argb: NAVY}};
    s.alignment = {horizontal: 'center', vertical: 'middle'};
    row.height = 28;
  } else if (k === 'nhac') {
    o.font = {bold: true, size: 11.5, color: {argb: 'FFC0392B'}};
    row.height = 22;
  } else if (k === 'thuong') {
    o.font = {size: 11.5};
    o.alignment = {wrapText: true, vertical: 'middle'};
    row.getCell(1).alignment = {horizontal: 'center', vertical: 'middle'};
    row.getCell(1).font = {size: 13};
    row.height = 20;
  }
});

// ── Danh sách người thử: đọc thẳng từ hệ thống nếu có kết nối ──────────────────────────────
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
  const tenLop = new Map((lop ?? []).map((x) => [x.id, x.name]));
  const VAI = {admin: 'Quản trị viên', principal: 'Ban giám hiệu', teacher: 'Giáo viên chủ nhiệm', student: 'Học sinh', parent: 'Phụ huynh'};
  const THU_TU = ['Quản trị viên', 'Ban giám hiệu', 'Giáo viên chủ nhiệm', 'Học sinh', 'Phụ huynh'];
  NGUOI = (moi ?? [])
    .map((g) => ({email: g.email, vai: VAI[g.role] ?? g.role, lop: tenLop.get(g.class_id) ?? ''}))
    .sort(
      (a, b) =>
        THU_TU.indexOf(a.vai) - THU_TU.indexOf(b.vai) ||
        a.lop.localeCompare(b.lop, 'vi') ||
        a.email.localeCompare(b.email),
    );
} catch {
  console.log('GHI CHÚ  Không đọc được danh sách người thử — tab "Tìm tên mình" để trống cho điền tay.');
}

const DUOC_LAM = {
  'Quản trị viên': 'Toàn quyền: cơ sở, mời người, giao lớp cho giáo viên, mời phụ huynh',
  'Ban giám hiệu': 'Trong cơ sở mình: khối, lớp, môn, thời khoá biểu, danh sách học sinh. Xem WIG, không đặt WIG',
  'Giáo viên chủ nhiệm': 'Lớp mình: danh sách, mục tiêu WIG, việc để tick, họp WIG, điểm danh, báo bài, học bạ',
  'Học sinh': 'Tick việc của mình mỗi ngày, gửi yêu cầu sửa. Không tự đổi mục tiêu',
  'Phụ huynh': 'Chỉ xem báo cáo về con, nhắn tin cho giáo viên',
};
const VIEC_THEO_VAI = {
  'Quản trị viên': 'L-01, L-05 → L-09, L-13',
  'Ban giám hiệu': 'L-02, L-03, L-04, L-10, L-11, L-12',
  'Giáo viên chủ nhiệm': 'W-01 → W-16, W-19, W-22 · H-01 → H-14 · N-01 → N-04, N-07, N-11',
  'Học sinh': 'W-17, W-18, W-20, W-21 · H-11 · N-05, N-06, N-08',
  'Phụ huynh': 'L-14, L-15, L-16 · H-16 · N-09, N-12, N-13',
};

const vung = (cot, n) => `DanhMuc!$${cot}$2:$${cot}$${n + 1}`;
const xo = (ws, cot, dauDong, soDong, congThuc) => {
  ws.dataValidations.add(`${cot}${dauDong}:${cot}${dauDong + soDong - 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: [congThuc],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Không có trong danh sách',
    error: 'Chọn một giá trị trong ô xổ xuống, hoặc báo người phụ trách thêm vào.',
  });
};

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2 · TÌM TÊN MÌNH
// ══════════════════════════════════════════════════════════════════════════════════════════
const wsTim = trang(
  '2 · Tìm tên mình',
  [
    {ten: 'STT', rong: 6},
    {ten: 'Họ và tên', rong: 26},
    {ten: 'Email đăng nhập', rong: 40},
    {ten: 'Vai của bạn', rong: 20},
    {ten: 'Lớp', rong: 9},
    {ten: 'Bạn được làm gì', rong: 48},
    {ten: 'Bạn phải thử những mục nào', rong: 44},
    {ten: 'Đã đăng nhập được chưa', rong: 15},
  ],
  [
    ...NGUOI.map((n, i) => [i + 1, '', n.email, n.vai, n.lop, DUOC_LAM[n.vai] ?? '', VIEC_THEO_VAI[n.vai] ?? '', '']),
    ...Array.from({length: 12}, () => ['', '', '', '', '', '', '', '']),
  ],
  'TÌM EMAIL CỦA BẠN — điền họ tên, và chọn "Rồi" khi đã đăng nhập được',
  {dien: [2, 8], caoDong: 30},
);

xo(wsTim, 'H', 4, NGUOI.length + 12, '"Rồi,Chưa"');

const COT = [
  {ten: 'Mã', rong: 8},
  {ten: '★', rong: 4},
  {ten: 'Ai làm', rong: 14},
  {ten: 'Ở đâu', rong: 18},
  {ten: 'Làm gì', rong: 48},
  {ten: 'Phải thấy gì', rong: 50},
  {ten: 'Đạt?', rong: 8},
  {ten: 'Ghi chú', rong: 26},
];
const DIEN_TC = {dien: [7, 8]};

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3 → 6 · CÁC BẢNG VIỆC CẦN THỬ
// ══════════════════════════════════════════════════════════════════════════════════════════
const TC_WIG = [
  ['W-01', '★', 'Giáo viên', 'class.truongvietanh.com', 'Đăng nhập lần đầu', 'Vào thẳng lớp mình, tên lớp hiện trên đầu trang', '', ''],
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
  ['W-17', '★', 'Học sinh', 'class.truongvietanh.com', 'Đăng nhập lần đầu', 'Vào thẳng bảng của mình, đúng lớp', '', ''],
  ['W-18', '★', 'Học sinh', 'Bảng của em', 'Tick một việc của hôm nay', 'Số tăng ngay, tiến độ tuần / tháng / năm cộng theo', '', ''],
  ['W-19', '★', 'Giáo viên', 'WIG › Chi tiết tuần', 'Mở màn chi tiết sau khi vài em đã tick', 'Thấy từng em: ai đã làm, ai chưa', '', ''],
  ['W-20', '', 'Học sinh', 'Bảng của em', 'Thử gỡ lượt tick của hôm qua', 'Không gỡ được, chỉ gửi được yêu cầu', '', ''],
  ['W-21', '', 'Học sinh', 'Bảng của em', 'Thử tự đổi mục tiêu của mình', 'Không có chỗ nào để đổi', '', ''],
  ['W-22', '', 'Giáo viên', 'Trang của em', 'Duyệt một yêu cầu của học sinh', 'Yêu cầu đổi trạng thái, thay đổi có hiệu lực ngay', '', ''],
  ['W-23', '', 'Giáo viên', 'Bảng thi đua', 'Mở bảng thi đua sau vài ngày tick', 'Điểm 4 lĩnh vực khớp với số lượt tick', '', ''],
];
trang('3 · Thử · Mục tiêu', COT, TC_WIG, 'VIỆC CẦN THỬ — ĐẶT MỤC TIÊU VÀ TICK     ★ = quan trọng nhất', DIEN_TC);

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
trang('4 · Thử · Họp WIG', COT, TC_HOP, 'VIỆC CẦN THỬ — HỌP WIG CUỐI TUẦN     ★ = quan trọng nhất', DIEN_TC);

const TC_LOP = [
  ['L-01', '★', 'Quản trị viên', 'Quản trị', 'Khai một cơ sở', 'Cơ sở hiện ra, khối lớp có sẵn không phải gõ tay', '', ''],
  ['L-02', '★', 'Ban giám hiệu', 'Cơ sở', 'Tạo lớp: tên, khối, năm học 2026-2027', 'Lớp hiện ra, chưa có chủ nhiệm', '', ''],
  ['L-03', '★', 'Ban giám hiệu', 'Môn học', 'Khai vài môn cho một khối', 'Môn chọn được khi nhập điểm và xếp thời khoá biểu', '', ''],
  ['L-04', '', 'Ban giám hiệu', 'Thời khoá biểu', 'Xếp vài tiết cho một lớp', 'Lưu được, mở lại đúng', '', ''],
  ['L-05', '★', 'Quản trị viên', 'Quản trị', 'Mời giáo viên chủ nhiệm và học sinh theo lớp', 'Báo đã mời, tên hiện trong danh sách chờ', '', ''],
  ['L-06', '', 'Quản trị viên', 'Quản trị', 'Mời lại một email với vai khác', 'Vai được đổi, không sinh dòng thứ hai', '', ''],
  ['L-07', '★', 'Quản trị viên', 'Quản trị', 'Xem cột chủ nhiệm của lớp sắp giao cho giáo viên mới', 'Phải TRỐNG. Còn tên ai đó thì phân lại trước', '', ''],
  ['L-08', '', 'Người chưa được mời', 'class.truongvietanh.com', 'Đăng nhập bằng email trường nhưng chưa được mời', 'Thấy màn "Tài khoản chưa được cấp quyền"', '', ''],
  ['L-09', '', 'Quản trị viên', 'Quản trị', 'Cấp vai cho người đang chờ', 'Họ tải lại trang là vào được', '', ''],
  ['L-10', '★', 'Ban giám hiệu', 'Cơ sở', 'Đăng nhập lần đầu rồi mở trang Cơ sở', 'Thấy các lớp trong cơ sở mình. Trống trơn nghĩa là lời mời thiếu cơ sở', '', ''],
  ['L-11', '★', 'Ban giám hiệu', 'Danh sách lớp', 'Ghi danh một em vào lớp trong cơ sở mình', 'Ghi danh được, điền được cả ngày sinh và số điện thoại phụ huynh', '', ''],
  ['L-12', '', 'Ban giám hiệu', 'WIG', 'Thử mở trang WIG', 'Bị đưa về trang chủ — đặt mục tiêu không phải việc của ban giám hiệu', '', ''],
  ['L-13', '★', 'Quản trị viên', 'Quản trị', 'Mời phụ huynh, chọn con', 'Báo đã mời. Chưa em nào đăng nhập thì danh sách chọn con trống', '', ''],
  ['L-14', '★', 'Phụ huynh', 'Báo cáo', 'Đăng nhập lần đầu rồi mở Báo cáo', 'Vào đúng vai phụ huynh, thấy báo cáo con mình', '', ''],
  ['L-15', '★', 'Phụ huynh', 'Báo cáo', 'Xem kỹ cả trang', 'Chỉ có dữ liệu con mình. Không có tên em khác, không có ghi chú nội bộ lớp', '', ''],
  ['L-16', '', 'Phụ huynh', 'Danh sách lớp', 'Thử mở danh sách lớp', 'Bị đưa về — phụ huynh không xem danh sách lớp', '', ''],
  ['L-17', '', 'Giáo viên', 'Danh sách lớp', 'Đề nghị dời một em sang lớp khác', 'Báo đã gửi. Em VẪN ở lớp cũ cho tới khi lớp bên kia duyệt', '', ''],
  ['L-18', '', 'Giáo viên lớp đích', 'Danh sách lớp', 'Duyệt đề nghị dời lớp', 'Em sang lớp mới, hai danh sách cùng đổi', '', ''],
  ['L-19', '', 'Quản trị viên', 'Danh sách lớp', 'Dời một em bằng tài khoản quản trị', 'Chuyển thẳng, không cần duyệt', '', ''],
];
trang('5 · Thử · Lớp & tài khoản', COT, TC_LOP, 'VIỆC CẦN THỬ — DỰNG LỚP VÀ TÀI KHOẢN', DIEN_TC);

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
trang('6 · Thử · Hằng ngày', COT, TC_NGAY, 'VIỆC CẦN THỬ — ĐIỂM DANH, BÁO BÀI, HỌC BẠ, LIÊN LẠC', DIEN_TC);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 7 · GHI KẾT QUẢ  ·  8 · GÓP Ý TỰ DO
// ══════════════════════════════════════════════════════════════════════════════════════════
const MA_CA = [...TC_WIG, ...TC_HOP, ...TC_LOP, ...TC_NGAY].map((r) => r[0]);
const KET_QUA = ['Đạt', 'Không đạt', 'Chưa thử được'];
const MUC_DO = ['Chặn hẳn — không làm tiếp được', 'Khó chịu — vẫn làm được nhưng vướng', 'Nhỏ — chữ nghĩa hoặc giao diện', 'Góp ý thêm'];
const TRANG_THAI = ['Mới ghi', 'Đang xử lý', 'Đã sửa', 'Không sửa (giải thích)'];

const SO_DONG_GHI = 400;
const wsG = trang(
  '7 · Ghi kết quả',
  [
    {ten: 'Ngày thử', rong: 12},
    {ten: 'Email của bạn', rong: 38},
    {ten: 'Mã mục đã thử', rong: 12},
    {ten: 'Kết quả', rong: 14},
    {ten: 'CHUYỆN GÌ ĐÃ XẢY RA (tả bằng lời của mình)', rong: 58},
    {ten: 'Mình mong nó phải như thế nào', rong: 42},
    {ten: 'Trước đó bấm những gì', rong: 38},
    {ten: 'Mức độ', rong: 26},
    {ten: 'Người xử lý', rong: 16},
    {ten: 'Trạng thái', rong: 18},
    {ten: 'Ghi chú của người xử lý', rong: 36},
  ],
  Array.from({length: SO_DONG_GHI}, () => ['', '', '', '', '', '', '', '', '', '', '']),
  'GẶP GÌ LẠ THÌ GHI Ở ĐÂY — mỗi lần thử một dòng. Ba cột giữa cứ viết dài thoải mái',
  {dien: [1, 2, 3, 4, 5, 6, 7, 8], caoDong: 30},
);
xo(wsG, 'B', 4, SO_DONG_GHI, `${vung('A', Math.max(NGUOI.length, 1))}`);
xo(wsG, 'C', 4, SO_DONG_GHI, `${vung('B', MA_CA.length)}`);
xo(wsG, 'D', 4, SO_DONG_GHI, `"${KET_QUA.join(',')}"`);
xo(wsG, 'H', 4, SO_DONG_GHI, `"${MUC_DO.join(',')}"`);
xo(wsG, 'J', 4, SO_DONG_GHI, `"${TRANG_THAI.join(',')}"`);
for (let r = 4; r < 4 + SO_DONG_GHI; r++) wsG.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';

const SO_DONG_GY = 150;
const wsY = trang(
  '8 · Góp ý tự do',
  [
    {ten: 'Ngày', rong: 12},
    {ten: 'Email của bạn', rong: 38},
    {ten: 'Góp ý — muốn viết gì cũng được', rong: 88},
    {ten: 'Mức độ', rong: 26},
    {ten: 'Đã đọc / đã trả lời', rong: 20},
  ],
  Array.from({length: SO_DONG_GY}, () => ['', '', '', '', '']),
  'GÓP Ý TỰ DO — chỗ cho những gì không nằm trong mục thử nào',
  {dien: [1, 2, 3, 4], caoDong: 34},
);
xo(wsY, 'B', 4, SO_DONG_GY, `${vung('A', Math.max(NGUOI.length, 1))}`);
xo(wsY, 'D', 4, SO_DONG_GY, `"${MUC_DO.join(',')}"`);
xo(wsY, 'E', 4, SO_DONG_GY, '"Chưa đọc,Đã đọc,Đã trả lời"');
for (let r = 4; r < 4 + SO_DONG_GY; r++) wsY.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';

// ══════════════════════════════════════════════════════════════════════════════════════════
// 9 → 11 · TRA CỨU
// ══════════════════════════════════════════════════════════════════════════════════════════
trang(
  '9 · Ai được làm gì',
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
  'TRA CỨU — AI ĐƯỢC LÀM GÌ',
);

trang(
  '10 · Thứ tự vận hành',
  [
    {ten: 'Bước', rong: 7},
    {ten: 'Ai', rong: 16},
    {ten: 'Làm gì', rong: 46},
    {ten: 'Ở đâu', rong: 20},
    {ten: 'Lưu ý', rong: 46},
  ],
  [
    ['▸ 1', 'QUẢN TRỊ VIÊN', 'Mở trường', '', ''],
    ['1.1', 'Quản trị viên', 'Khai cơ sở', 'Quản trị', 'Khối lớp tự có sẵn sau khi khai cơ sở.'],
    ['1.2', 'Quản trị viên', 'Mời ban giám hiệu — nhớ chọn cơ sở', 'Quản trị › Mời người dùng', 'Quên chọn cơ sở là họ vào thấy màn nào cũng trống.'],
    ['', '', '', '', ''],
    ['▸ 2', 'BAN GIÁM HIỆU', 'Dựng cơ sở của mình', '', ''],
    ['2.1', 'Ban giám hiệu', 'Xem lại khối lớp, thiếu thì thêm', 'Cơ sở', ''],
    ['2.2', 'Ban giám hiệu', 'Tạo lớp: tên lớp, khối, năm học', 'Cơ sở', 'Năm học ghi dạng 2026-2027.'],
    ['2.3', 'Ban giám hiệu', 'Khai môn học cho từng khối', 'Môn học', 'Chưa khai môn thì sau này không nhập điểm được.'],
    ['2.4', 'Ban giám hiệu', 'Xếp thời khoá biểu cho từng lớp', 'Thời khoá biểu', 'Làm được ngay, không cần chờ ai.'],
    ['', '', '', '', ''],
    ['▸ 3', 'QUẢN TRỊ VIÊN', 'Giao lớp cho giáo viên', '', ''],
    ['3.1', 'Quản trị viên', 'Mời giáo viên chủ nhiệm — mỗi người một lớp', 'Quản trị › Mời người dùng', 'Lớp phải đang TRỐNG chủ nhiệm, không thì thầy cô mới sẽ không nhận được lớp.'],
    ['', '', '', '', ''],
    ['▸ 4', 'BGH hoặc GIÁO VIÊN', 'Lập danh sách học sinh', '', ''],
    ['4.1', 'BGH / Giáo viên', 'Ghi danh học sinh bằng email; điền thêm tên, mã, ngày sinh, SĐT phụ huynh', 'Danh sách lớp', 'Ghi danh được cả em chưa có tài khoản.'],
    ['4.2', 'BGH / Giáo viên', 'Sửa lại thông tin em nào gõ nhầm', 'Danh sách lớp › nút bút chì', 'Email không sửa được. Gõ sai thì huỷ rồi ghi danh lại.'],
    ['', '', '', '', ''],
    ['▸ 5', 'GIÁO VIÊN CHỦ NHIỆM', 'Đặt mục tiêu cho lớp', '', ''],
    ['5.1', 'Giáo viên', 'Đăng nhập lần đầu → tự vào lớp mình', 'class.truongvietanh.com', 'Thấy "Chưa có lớp" thì báo quản trị viên.'],
    ['5.2', 'Giáo viên', 'Đặt MỤC TIÊU NĂM cho lớp', 'WIG › Tạo mục tiêu › Năm', 'Chưa có mục tiêu năm thì không đặt được mục tiêu tháng.'],
    ['5.3', 'Giáo viên', 'Đặt MỤC TIÊU THÁNG', 'WIG › Tạo mục tiêu › Tháng', 'Chưa có mục tiêu tháng thì không đặt được mục tiêu tuần.'],
    ['5.4', 'Giáo viên', 'Đặt MỤC TIÊU TUẦN', 'WIG › Tạo mục tiêu › Tuần', 'Xem kỹ ô "Thuộc mục tiêu tháng" trước khi lưu.'],
    ['5.5', 'Giáo viên', 'Thêm VIỆC ĐỂ CÁC EM TICK', 'WIG › Thêm việc', 'Bước hay quên nhất. Không có việc thì các em không có gì để bấm.'],
    ['', '', '', '', ''],
    ['▸ 6', 'HỌC SINH', 'Vào và tick mỗi ngày', '', ''],
    ['6.1', 'Học sinh', 'Đăng nhập lần đầu → tự vào đúng lớp', 'class.truongvietanh.com', 'Phải được ghi danh trước.'],
    ['6.2', 'Học sinh', 'Tick việc đã làm trong ngày', 'Bảng của em', 'Chỉ tick được cho HÔM NAY.'],
    ['6.3', 'Học sinh', 'Tick nhầm thì gửi yêu cầu', 'Bảng của em', 'Các em không tự đổi mục tiêu.'],
    ['6.4', 'Giáo viên', 'Duyệt yêu cầu của các em', 'Trang của em', ''],
    ['6.5', 'Giáo viên', 'Chọn 1 em làm trưởng điểm danh', 'Danh sách lớp', 'Việc của giáo viên chủ nhiệm.'],
    ['', '', '', '', ''],
    ['▸ 7', 'QUẢN TRỊ VIÊN', 'Mời phụ huynh — sau khi các em đã vào', '', ''],
    ['7.1', 'Quản trị viên', 'Mời phụ huynh, gắn với đúng một em', 'Quản trị › Mời phụ huynh', 'Email nào cũng được, kể cả email trường.'],
    ['7.2', 'Phụ huynh', 'Đăng nhập, xem báo cáo về con', 'Báo cáo', 'Chỉ xem, và chỉ thấy con mình.'],
    ['', '', '', '', ''],
    ['▸ 8', 'GIÁO VIÊN + CẢ LỚP', 'Cuối tuần — họp WIG', '', ''],
    ['8.1', 'Giáo viên', 'Mở phòng họp — tự mở đúng tuần vừa xong', 'WIG › Phòng họp', ''],
    ['8.2', 'Cả lớp', 'Bước 1: nhìn con số tuần qua, chấm Thắng / Chưa đạt', 'Phòng họp', 'Con số do máy đếm từ lượt tick của các em.'],
    ['8.3', 'Cả lớp', 'Bước 2: chiêm nghiệm + một câu cam kết cho tuần tới', 'Phòng họp', 'Câu cam kết hiện lại ở buổi họp tuần sau.'],
    ['8.4', 'Cả lớp', 'Bước 3: đặt mục tiêu tuần tới ngay tại đây', 'Phòng họp', 'Không phải quay lại trang WIG.'],
    ['8.5', 'Giáo viên', 'Bấm "Kết thúc buổi họp & lưu"', 'Phòng họp', 'Một lần lưu là xong cả ba bước.'],
    ['8.6', 'Giáo viên', 'Họp nhầm tuần thì gỡ biên bản tuần đó', 'Phòng họp', 'Gỡ xong các em tick lại được.'],
    ['8.7', 'Ban giám hiệu', 'Xem lại lớp đã tổng kết ra sao', 'Biên bản họp', 'Chỉ xem.'],
  ],
  'TRA CỨU — THỨ TỰ VẬN HÀNH ĐẦU NĂM',
);

trang(
  '11 · Hay vướng',
  [
    {ten: 'Bạn thấy gì', rong: 46},
    {ten: 'Vì sao', rong: 44},
    {ten: 'Làm sao', rong: 50},
  ],
  [
    ['Giáo viên đăng nhập xong thấy "Chưa có lớp"', 'Lớp đó đã có người khác đứng tên chủ nhiệm', 'Quản trị viên vào Quản trị › Lớp, phân lại chủ nhiệm'],
    ['Ban giám hiệu vào, màn nào cũng trống', 'Lời mời quên chọn cơ sở', 'Quản trị viên gán cơ sở cho họ'],
    ['Thấy "Tài khoản chưa được cấp quyền"', 'Chưa được mời, hoặc chưa tới lượt mình', 'Nhắn người phụ trách, mở được ngay'],
    ['Chưa mời được phụ huynh, danh sách chọn con trống', 'Con chưa đăng nhập lần nào', 'Đợi em đăng nhập rồi mời'],
    ['Học sinh vào không thuộc lớp nào', 'Chưa được ghi danh', 'Giáo viên ghi danh bằng đúng email đó'],
    ['Các em mở app ra không có gì để tick', 'Có mục tiêu tuần nhưng chưa thêm việc nào', 'Vào WIG › Thêm việc. Mục tiêu là cái đích, việc mới là thứ các em bấm mỗi ngày'],
    ['Em quên tick hôm qua, hôm nay tick bù không được', 'Cố ý — chỉ ghi được cho hôm nay', 'Em gửi yêu cầu, thầy cô thêm giúp'],
    ['Mục tiêu tuần vừa tạo lại rơi vào tuần cách cả tháng', 'Chọn nhầm ở ô "Thuộc mục tiêu tháng"', 'Xoá rồi tạo lại, xem kỹ ô đó trước khi lưu'],
    ['Họp nhầm tuần, đã bấm kết thúc', '', 'Bấm gỡ biên bản tuần đó — các em tick lại được'],
    ['Đề nghị dời lớp mãi không thấy có hiệu lực', 'Lớp bên kia chưa duyệt', 'Nhắc giáo viên lớp đích duyệt, hoặc nhờ quản trị viên chuyển thẳng'],
    ['Không nhập được điểm, không thấy môn nào', 'Chưa khai môn cho khối đó', 'Ban giám hiệu vào Môn học khai trước'],
  ],
  'TRA CỨU — HAY VƯỚNG VÀ CÁCH GỠ',
);

// ── Bảng danh mục nuôi các ô xổ xuống. Ẩn, và đặt cuối cùng. ───────────────────────────────
const dm = wb.addWorksheet('DanhMuc');
dm.state = 'hidden';
[44, 16, 30, 44, 24].forEach((w, i) => (dm.getColumn(i + 1).width = w));
dm.getRow(1).values = ['Email người thử', 'Mã mục', 'Kết quả', 'Mức độ', 'Trạng thái xử lý'];
const soDongDM = Math.max(NGUOI.length, MA_CA.length, 60);
for (let i = 0; i < soDongDM; i++) {
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
console.log('Đã ghi:', duong, '·', wb.worksheets.length, 'trang ·', NGUOI.length, 'người thử ·', MA_CA.length, 'mục thử');
