// Màn Quản trị phải DỰNG ĐƯỢC với phiên đăng nhập thật, và dựng ra đúng thứ nó hứa.
//
// Vì sao có file này: bản dựng lại /admin từng lên production trong trạng thái hỏng hoàn toàn —
// mọi lần mở đều văng màn hình lỗi — mà `tsc` sạch và `next build` sạch. Lý do: /admin là trang
// render theo yêu cầu nên không được dựng thử lúc build, và cả hai bài kiểm kia chỉ đọc kiểu chứ
// không dựng trang. Nói cách khác "build xanh" chưa bao giờ là bằng chứng trang chạy được.
//
// Bài kiểm này dựng trang thật với cookie thật rồi đọc HTML trả về.
//
//   node scripts/test-admin-man.mjs [BASE]     mặc định http://localhost:6899
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6899';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

async function ck(email) {
  const {data: g, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(email + ': ' + error.message);
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: g.properties.hashed_token,
  });
  if (e2) throw new Error(email + ': ' + e2.message);
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// KHÔNG bám cứng vào một email. Tài khoản thử là dữ liệu THẬT trên production — quản trị viên
// đổi vai hoặc bấm "Vô hiệu" nó lúc nào cũng được, và đã xảy ra: bộ kiểm bỗng báo "trang không
// dựng được (307)" trong khi trang hoàn toàn bình thường, chỉ là tài khoản hết quyền. Một bài kiểm
// báo sai chỗ còn tệ hơn không có bài kiểm.
const {data: quanTri} = await admin
  .from('profiles')
  .select('email')
  .eq('role', 'admin')
  .order('email')
  .limit(5);
if (!quanTri || quanTri.length === 0) {
  console.log('SAI  Không còn tài khoản quản trị nào trên hệ thống — không chạy kiểm được.');
  process.exit(1);
}
const uuTien = quanTri.find((u) => u.email.startsWith('test'));
const taiKhoan = (uuTien ?? quanTri[0]).email;
if (!uuTien) console.log(`GHI CHÚ  Không thấy tài khoản thử nào còn vai quản trị — dùng ${taiKhoan}.`);
const cookie = await ck(taiKhoan);
const lay = async (duong) => {
  const r = await fetch(BASE + duong, {headers: {cookie}, redirect: 'manual'});
  return {status: r.status, html: r.status === 200 ? await r.text() : ''};
};

// ── 1. Trang dựng được ────────────────────────────────────────────────────────────────────
const goc = await lay('/admin');
dat(goc.status === 200, 'Trang /admin dựng được với phiên quản trị', `HTTP ${goc.status}`);
if (goc.status !== 200) {
  // Không có HTML thì mọi bài dưới đều vô nghĩa — dừng sớm, đừng đổ một loạt lỗi giả.
  for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
  console.log('\nDừng sớm: trang không dựng được.');
  process.exit(1);
}

// ── 2. Không còn dấu gạch ngang thay cho dữ liệu ──────────────────────────────────────────
// Một ô chỉ chứa "—" không nói được là dữ liệu thiếu hay hệ thống hỏng, và chủ dự án đã yêu cầu
// bỏ hẳn lối trình bày này.
const oGachNgang = (goc.html.match(/>\s*—\s*</g) ?? []).length;
dat(oGachNgang === 0, 'Không ô nào chỉ chứa một dấu gạch ngang', `tìm thấy ${oGachNgang}`);

// ── 3. Bảng người dùng có ngữ nghĩa cho trình đọc màn hình ────────────────────────────────
dat(goc.html.includes('role="table"'), 'Bảng người dùng khai role="table"');
// Kiểm ĐÚNG năm tiêu đề của bảng người dùng, thay vì đếm mọi role="columnheader" trên trang —
// trang còn bảng khác cũng có tiêu đề cột.
const COT = ['Tên', 'Email', 'Vai trò', 'Đổi vai trò', 'Thao tác'];
const thieuCot = COT.filter((c) => !new RegExp(`role="columnheader"[^>]*>${c}<`).test(goc.html));
dat(thieuCot.length === 0, 'Đủ năm tiêu đề cột của bảng người dùng', thieuCot.join(', ') || 'đủ');

// ── 4. Mỗi dòng có tên đọc được RIÊNG, không dùng chung một nhãn ──────────────────────────
// Đây là bảng có nút xoá vĩnh viễn. Năm mươi nút cùng tên "Xoá" nghĩa là người dùng trình đọc
// màn hình phải đoán mình đang xoá ai.
const nhan = [...goc.html.matchAll(/aria-label="(Xoá|Đổi vai trò cho|Vai trò của)[^"]*"/g)].map((m) => m[0]);
const nhanRieng = new Set(nhan);
dat(
  nhan.length === 0 || nhanRieng.size === nhan.length,
  'Nhãn thao tác của mỗi dòng là riêng biệt',
  `${nhanRieng.size} nhãn khác nhau / ${nhan.length} nút`,
);

// ── 5. Cỡ trang bị chặn trong danh sách cho phép ──────────────────────────────────────────
// ?size=100000 là một cách kéo toàn bộ PII của trường về trong một payload.
// Đếm dòng bảng người dùng bằng MỐC RIÊNG của dòng, không bằng vị trí trong chuỗi HTML.
//
// Cách cũ cắt chuỗi từ aria-label="Bảng người dùng" rồi đếm role="row" phía sau. Nó hỏng khi trang
// được truyền dần (Suspense): React đẩy phần nội dung đã xong xuống cuối tài liệu rồi mới dời vào
// chỗ bằng script, nên THỨ TỰ TRONG HTML không còn là thứ tự trên màn hình. Mục "Đã khai sẵn" cũng
// là một bảng, và các dòng của nó lọt vào vùng đếm.
//
// Ô tick của mỗi dòng người dùng mang aria-label="Chọn <tên>" — mốc ấy chỉ dòng người dùng mới có.
const demDong = (html) => (html.match(/aria-label="Chọn [^"]+"/g) ?? []).length;

const tham = await lay('/admin?size=100000');
dat(tham.status === 200 && demDong(tham.html) <= 10, 'size ngoài danh sách bị ép về mặc định 10 dòng', `${demDong(tham.html)} dòng`);

// Chỉ so được khi hệ thống có QUÁ 10 người; ít hơn thì cả hai cỡ trang đều trả cùng số dòng và
// phép so không chứng minh được gì. Nói rõ là bỏ qua, đừng báo OK giả.
const size25 = await lay('/admin?size=25');
const tongNguoi = demDong(size25.html);
if (tongNguoi > 10) {
  dat(demDong(tham.html) === 10 && tongNguoi > 10, 'size=25 thật sự trả nhiều dòng hơn', `${tongNguoi} dòng`);
} else {
  console.log('GHI CHÚ  Bỏ qua bài "size=25 trả nhiều dòng hơn": hệ thống chỉ có', tongNguoi, 'người.');
}

// ── 6. Số trên tab bằng đúng số dòng bấm vào sẽ thấy ──────────────────────────────────────
// Hàm admin_user_counts (migration 0085) và truy vấn bảng là hai câu SQL khác nhau. Chúng phải
// dùng cùng một phép so khớp, nếu không người dùng thấy "Giáo viên (3)" rồi bấm vào ra bảng rỗng
// — kiểu lỗi không ai báo được thành lời, họ chỉ thôi tin cả màn hình.
const doSoTab = (html, vai) => {
  // Đọc số ngay sau đường dẫn của tab đó, thay vì dò theo nhãn tiếng Việt — nhãn đổi được (và đã
  // đổi: "Giáo viên" thành "Giáo viên chủ nhiệm"), đường dẫn thì không.
  // String.raw: trong template literal thường, `\d` bị nuốt thành `d` — regex thành (d+) và không
  // khớp gì cả, nhưng bài kiểm vẫn "chạy", chỉ là luôn báo không đọc được.
  const m = html.match(new RegExp(String.raw`vai=${vai}[^"]*"[^>]*>[^<]*<span[^>]*>(\d+)<`));
  return m ? Number(m[1]) : null;
};
for (const vai of ['teacher', 'principal', 'student', 'parent']) {
  const bang = await lay(`/admin?vai=${vai}&size=100`);
  const tren = doSoTab(goc.html, vai);
  dat(
    tren !== null && bang.status === 200 && tren === demDong(bang.html),
    `Số trên tab ${vai} khớp số dòng thật`,
    tren === null ? 'KHÔNG đọc được số trên tab' : `tab ghi ${tren}, bảng có ${demDong(bang.html)}`,
  );
}

// ── 7. Tìm không ra thì nói bằng câu, không bỏ trống ──────────────────────────────────────
const khong = await lay('/admin?q=zzzzkhongtontai');
dat(
  khong.status === 200 && /Không tìm thấy ai khớp/.test(khong.html),
  'Tìm không ra có câu giải thích tử tế',
);

// ── 8. Lọc theo vai thật sự lọc ───────────────────────────────────────────────────────────
const hs = await lay('/admin?vai=student&size=100');
const coGiaoVien = /Giáo viên<\/span>/.test(hs.html.split('role="table"')[1] ?? '');
dat(hs.status === 200 && !coGiaoVien, 'Tab Học sinh không lẫn vai khác');

// ── 9. Các mục nặng gấp lại được, không bày hết ra ────────────────────────────────────────
const soDetails = (goc.html.match(/<details/g) ?? []).length;
dat(soDetails >= 3, 'Các mục dùng-mỗi-năm-một-lần đều gấp lại được', `${soDetails} mục`);

// ── 10. Bảng người dùng có chọn hàng loạt ────────────────────────────────────────────────
// Trước đây chọn-nhiều chỉ có trong khối "Ai đang chờ bạn", mà khối đó ẩn khi không ai chờ — nên
// gần như lúc nào màn Quản trị cũng trông như không hề có tính năng ấy.
// Mỗi dòng phải có ĐỦ cả ô tick lẫn ô chọn vai — hai mốc độc lập, nên so chúng với nhau là một
// phép kiểm thật chứ không phải so một con số với chính nó.
const soTick = (goc.html.match(/aria-label="Chọn [^"]+"/g) ?? []).length;
const soOVai = (goc.html.match(/aria-label="Vai trò của [^"]+"/g) ?? []).length;
dat(soTick > 0 && soTick === soOVai, 'Mỗi dòng người dùng có đủ ô tick và ô chọn vai', `${soTick} ô tick / ${soOVai} ô vai`);
dat(/aria-label="Chọn tất cả"|Chọn tất cả/.test(goc.html), 'Có ô "Chọn tất cả"');

// ── 11. Nút phân trang căn giữa được chữ ──────────────────────────────────────────────────
// h-8 dựng hộp 32px, nhưng chỉ <button> mới tự căn giữa nội dung. Trên <a>/<span> thiếu
// items-center thì chữ bám mép trên, lệch 6px so với nhãn "Trang 1/5" bên cạnh (đã đo).
const nutTrang = goc.html.match(/class="[^"]*h-8[^"]*"[^>]*>← /);
dat(
  nutTrang === null || /items-center/.test(nutTrang[0]),
  'Nút phân trang có items-center để chữ nằm giữa hộp',
  nutTrang === null ? 'trang này chỉ có 1 trang, bỏ qua' : '',
);

// ── 12. Nút xoá lớp phải nói trước là nó không xoá được ──────────────────────────────────
// deleteClass từ chối xoá lớp còn WIG hoặc còn học sinh — đúng, vì xoá lớp kéo theo toàn bộ WIG
// và lịch sử tick. Nhưng nếu giao diện không báo trước thì người dùng bấm Xoá, xác nhận, rồi tin
// là xong: chủ dự án đã tưởng mình xoá hết lớp trong khi còn nguyên bốn lớp.
const coNutXoaMo = /cursor-not-allowed[^"]*opacity-40/.test(goc.html);
const coLyDo = /Không xoá được: lớp còn/.test(goc.html);
const coLopConDuLieu = /(\d+) WIG</.test(goc.html);
dat(
  !coLopConDuLieu || (coNutXoaMo && coLyDo),
  'Lớp còn dữ liệu thì nút Xoá mờ đi và nói rõ lý do',
  coLopConDuLieu ? `nút mờ: ${coNutXoaMo}, có lý do: ${coLyDo}` : 'không dòng lớp nào ĐANG HIỆN có dữ liệu (cơ sở đang gấp lại), bỏ qua',
);

// ── 13. Không lớp mồ côi nào lọt vào ô chọn lớp ──────────────────────────────────────────
// Lưu trữ cơ sở không đổi cờ is_active của lớp bên trong. Nếu ô chọn lớp chỉ lọc theo cờ của
// riêng lớp thì lớp thuộc cơ sở đã lưu trữ vẫn hiện ra để gán người vào — trong khi cây Cơ sở
// không vẽ chúng nên không có nút nào gỡ. Đối chiếu thẳng với CSDL.
{
  const {data: lopMoCoi} = await admin
    .from('classes')
    .select('name, campuses!inner(is_active)')
    .eq('is_active', true)
    .eq('campuses.is_active', false);
  const loLot = (lopMoCoi ?? []).filter((l) =>
    new RegExp(`<option[^>]*>${l.name.replace(/[.*+?^$\{}()|[\]]/g, '\$&')}\s*·`).test(goc.html),
  );
  dat(
    loLot.length === 0,
    'Lớp thuộc cơ sở đã lưu trữ không lọt vào ô chọn lớp',
    `${(lopMoCoi ?? []).length} lớp mồ côi trong CSDL, lọt ra ${loLot.length}`,
  );
}

// ── 14. Cơ sở liên cấp phải hiện ĐỦ các cấp ──────────────────────────────────────────────
// Mô hình cũ chỉ chứa một cấp mỗi cơ sở, nên Việt Anh Gò Vấp dạy cả THCS lẫn THPT mà nhãn chỉ ghi
// "THPT" — nói sai về chính dữ liệu ngay bên dưới nó. Đối chiếu thẳng với CSDL.
{
  const NHAN = {mam_non: 'Mầm non', tieu_hoc: 'Tiểu học', thcs: 'THCS', thpt: 'THPT'};
  const {data: cs} = await admin
    .from('campuses')
    .select('name, levels')
    .eq('is_active', true);
  const lienCap = (cs ?? []).filter((c) => (c.levels ?? []).length > 1);
  const thieu = lienCap.filter((c) => !(c.levels ?? []).every((lv) => goc.html.includes(NHAN[lv])));
  dat(
    thieu.length === 0,
    'Cơ sở liên cấp hiện đủ các cấp trên nhãn',
    lienCap.length === 0
      ? 'chưa có cơ sở liên cấp nào, bỏ qua'
      : `${lienCap.length} cơ sở liên cấp, thiếu nhãn ở ${thieu.length}`,
  );
  // Không còn ô chọn một-cấp kiểu cũ.
  dat(!/<select[^>]*name="level"/.test(goc.html), 'Không còn ô chọn cấp học một-giá-trị');
}

// ── 15. Đã khai sẵn phải hiện ra, và nói rõ là hệ thống không gửi mail ───────────────────
// Khai trước vai trò + lớp cho một email rồi KHÔNG có chỗ nào xem lại là mất dấu: chủ dự án đã
// khai ba mươi ba email và không biết tra ở đâu. Và mục này từng mang tên "Lời mời đang chờ" —
// chữ "lời mời" hứa một email mà hệ thống chưa bao giờ gửi.
{
  const {count} = await admin
    .from('pending_user_grants')
    .select('email', {count: 'exact', head: true});
  if ((count ?? 0) > 0) {
    dat(/Đã khai sẵn/.test(goc.html), 'Mục "đã khai sẵn" hiện ra khi có khai báo chờ', `${count} khai báo`);
    dat(/KHÔNG gửi email/.test(goc.html), 'Nói rõ hệ thống không gửi email cho họ');
  } else {
    console.log('GHI CHÚ  Bỏ qua bài "đã khai sẵn": không có khai báo nào đang chờ.');
  }
}

// ── 16. Đã khai sẵn: ĐÓNG BĂNG mặc định, MỘT nút lưu, và chia nhóm được ──────────────────
// Bản cũ bày mọi dòng ở trạng thái đang-sửa với một nút "Lưu" trên TỪNG dòng: ba mươi ba dòng là
// ba mươi ba nút lưu, mỗi cú bấm một vòng đi-về; khai năm trăm học sinh thì cách ấy không dùng
// được, và một danh sách mọi ô đều mở sẵn thì không phân biệt được dòng nào vừa đổi.
{
  const {count} = await admin
    .from('pending_user_grants')
    .select('email', {count: 'exact', head: true});
  if ((count ?? 0) > 0) {
    // Đóng băng = không ô chọn vai/lớp nào của mục này nằm sẵn trong HTML.
    const oSuaKhai = (goc.html.match(/aria-label="(Cấp vai trò cho|Lớp cho) [^"]+"/g) ?? []).length;
    dat(oSuaKhai === 0, 'Danh sách khai sẵn đóng băng khi mới mở', `${oSuaKhai} ô chọn còn mở`);
    // Và không còn nút lưu nào trên từng dòng.
    const nutLuuDong = (goc.html.match(/aria-label="Lưu khai báo cho [^"]+"/g) ?? []).length;
    dat(nutLuuDong === 0, 'Không còn nút Lưu trên từng dòng khai sẵn', `${nutLuuDong} nút`);
    dat(/Sửa danh sách/.test(goc.html), 'Có nút "Sửa danh sách" để mở khoá');
    // Chia nhóm: tab theo vai + số đếm. Không có nó thì năm trăm dòng là một cột dài vô tận.
    dat(/aria-pressed="true"/.test(goc.html), 'Danh sách khai sẵn có tab chia theo vai trò');
    dat(/aria-label="Tìm email"/.test(goc.html), 'Có ô tìm theo email trong danh sách khai sẵn');
    // Phân trang chỉ bắt buộc khi danh sách dài hơn một trang (25 dòng).
    if ((count ?? 0) > 25) {
      dat(/Trang 1\//.test(goc.html), 'Danh sách khai sẵn dài thì có phân trang', `${count} khai báo`);
    } else {
      console.log(`GHI CHÚ  Bỏ qua bài phân trang khai sẵn: chỉ có ${count} dòng (dưới một trang).`);
    }
  }
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
