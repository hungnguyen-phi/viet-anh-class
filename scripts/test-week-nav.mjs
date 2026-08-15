// Trang /wig có thật sự đi theo TUẦN không.
//
// VÌ SAO CẦN: sự cố 03/08/2026 ở lớp 7B1 không phải lỗi tính toán — nó là lỗi HAI LUẬT LỌC khác
// nhau trên cùng một dữ liệu. Trang GVCN lấy mọi WIG scope='class' không lọc ngày; màn hình học
// sinh (RPC class_lead_board, 0073) chỉ lấy WIG giao với tuần lịch. Nên WIG 27/07→02/08 đã đóng
// vẫn hiện "0/30" cho giáo viên trong khi các em không có gì để tick. Không phép kiểm nào lúc đó
// bắt được, vì cả hai màn hình đều trả 200 và cả hai con số đều "đúng" theo luật của riêng nó.
//
// Phép kiểm này soi đúng chỗ đó: cùng một lớp, cùng một tuần, thì DANH SÁCH WIG TUẦN mà trang
// GVCN vẽ ra phải trùng khít tập WIG mà RPC của học sinh trả về. Và tham số ?week= phải sống —
// kể cả khi bị gõ bậy.
//
//   node scripts/test-week-nav.mjs [http://localhost:6871]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

// ── CHỐT CHẶN: BỘ KIỂM KHÔNG ĐƯỢC ĐẺ TÀI KHOẢN ────────────────────────────────────────────
// `generateLink({type:'magiclink'})` TỰ TẠO người dùng nếu email chưa có. Gõ nhầm một địa chỉ,
// hoặc dùng một tài khoản thử đã bị xoá, là production mọc thêm một tài khoản 'pending' nằm lại
// vĩnh viễn trong khối "Ai đang chờ bạn" của màn Quản trị.
//
// Đã xảy ra thật 15/08/2026: một bài đẻ ra test2.ph@truongvietanh.com, và test-admin-man lập tức
// đỏ tám dòng vì mọi con số trên tab lệch đúng một dòng — mất một vòng đi tìm "hồi quy" không có.
{
  const gocGenLink = admin.auth.admin.generateLink.bind(admin.auth.admin);
  admin.auth.admin.generateLink = async (opts) => {
    const {data: coHoSo} = await admin
      .from('profiles')
      .select('id')
      .eq('email', opts?.email ?? '')
      .maybeSingle();
    if (!coHoSo) throw new Error(`${opts?.email}: chưa có tài khoản này — bộ kiểm KHÔNG tạo mới`);
    return gocGenLink(opts);
  };
}

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

let dat = 0;
let hong = 0;
function check(ten, ok, ghiChu = '') {
  if (ok) {
    dat++;
    console.log(`OK   ${ten}${ghiChu ? ' — ' + ghiChu : ''}`);
  } else {
    hong++;
    console.log(`SAI  ${ten}${ghiChu ? ' — ' + ghiChu : ''}`);
  }
}

// PHẢI BỎ <script> TRƯỚC KHI DÒ CHỮ.
//
// Trang được stream, và trong HTML có payload RSC (self.__next_f.push) chứa cả DỮ LIỆU THÔ của
// truy vấn — kể cả những WIG mà giao diện đã lọc bỏ. Dò thẳng trên HTML thì "Đọc sách 3 buổi/1
// tuần" tìm thấy được ngay cả khi màn hình không hề vẽ nó ra, và vì payload tới theo từng đợt
// nên phép kiểm lúc đỏ lúc xanh — đúng kiểu hỏng tệ nhất: một phép kiểm không tin được.
//
// Cùng bài học đã ghi ở scripts/test-homework-e2e.mjs: soi thứ được VẼ RA, không soi thứ trôi nổi
// trong payload.
function thanTrang(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

async function get(path, cookie) {
  const r = await fetch(BASE + path, {headers: {cookie}, redirect: 'manual'});
  const raw = await r.text();
  return {status: r.status, html: thanTrang(raw), raw};
}

// Thứ Hai của tuần chứa `day` — bản chép của mondayOf() trong lib/dates.ts. Chép có chủ ý: nếu
// import thẳng từ mã nguồn thì một lỗi ở đó sẽ tự khớp với chính nó và phép kiểm hoá vô nghĩa.
function monday(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}
function shift(mon, n) {
  const d = new Date(`${mon}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

const ckGv = await ck('test1.gvcn@truongvietanh.com');

// Lớp mà tài khoản GVCN thật sự chủ nhiệm — không gán cứng id vào phép kiểm.
const {data: gv} = await admin
  .from('profiles')
  .select('id')
  .eq('email', 'test1.gvcn@truongvietanh.com')
  .single();
// LỚP ĐỂ ĐO: ưu tiên lớp của tài khoản kiểm thử, nhưng KHÔNG bám cứng vào nó. test1.gvcn hiện
// không còn chủ nhiệm lớp nào, và bám cứng thì bộ kiểm nổ ngay ở khâu tra cứu ('lop' là null)
// chứ không kịp đo điều nó sinh ra để đo. Lớp thay người chủ nhiệm là chuyện thường ở trường.
const {data: dsLop} = await admin
  .from('classes')
  .select('id, name, homeroom_teacher_id')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .order('name');
let lop = null;
for (const c of dsLop ?? []) {
  const {count} = await admin
    .from('enrollments')
    .select('student_id', {count: 'exact', head: true})
    .eq('class_id', c.id)
    .eq('is_active', true);
  if (!count) continue;
  if (!lop || c.homeroom_teacher_id === gv?.id) lop = c;
  if (c.homeroom_teacher_id === gv?.id) break;
}
if (!lop) {
  console.log('BỎ QUA: không lớp nào vừa có GVCN vừa có học sinh đang học — CHƯA KIỂM ĐƯỢC.');
  process.exit(1);
}

const {data: hnRow} = await admin.rpc('vn_week_start');
const tuanNay = String(hnRow).slice(0, 10);
console.log(`Lớp ${lop.name} · tuần này bắt đầu ${tuanNay}\n`);

// ── 1. Ba tuần đều mở được, không 500, không đá về /login ──
for (const [ten, mon] of [
  ['tuần này', tuanNay],
  ['tuần trước', shift(tuanNay, -1)],
  ['tuần sau', shift(tuanNay, 1)],
]) {
  const q = mon === tuanNay ? '' : `&week=${mon}`;
  const r = await get(`/wig?class=${lop.id}${q}`, ckGv);
  check(`Mở được /wig ${ten}`, r.status === 200, `HTTP ${r.status}`);
}

// ── 2. ?week= gõ bậy KHÔNG được làm trắng trang ──
// Ngày không tồn tại và chuỗi rác đều đi thẳng vào phép dựng Date; Date hỏng thì toISOString()
// ném RangeError. Phải rơi về tuần hiện tại chứ không phải 500.
for (const bay of ['2026-02-31', '9999-99-99', 'hôm-qua', '2026-8-3', '']) {
  const r = await get(`/wig?class=${lop.id}&week=${encodeURIComponent(bay)}`, ckGv);
  check(`?week=${JSON.stringify(bay)} không làm sập trang`, r.status === 200, `HTTP ${r.status}`);
}

// ── 3. Điều cốt lõi: GVCN thấy ĐÚNG tập WIG mà học sinh thấy ──
// So bằng TÊN WIG tuần: lấy tập tên từ CSDL theo đúng luật của class_lead_board, rồi soi trong
// HTML của trang. Tên nào thuộc tuần thì phải có mặt; tên nào KHÔNG thuộc tuần thì phải vắng.
//
// Dò chiều VẮNG MẶT mới là chiều có giá trị: chiều "có mặt" luôn dễ đạt, còn chính chiều vắng
// mặt mới là thứ hỏng lần trước (WIG hết hạn vẫn nằm trên trang).
for (const mon of [tuanNay, shift(tuanNay, -1), shift(tuanNay, 1)]) {
  const cuoi = shift(mon, 1);
  const chuNhat = new Date(`${cuoi}T00:00:00Z`);
  chuNhat.setUTCDate(chuNhat.getUTCDate() - 1);
  const end = chuNhat.toISOString().slice(0, 10);

  const {data: het} = await admin
    .from('wigs')
    .select('id, title, start_date, end_date')
    .eq('class_id', lop.id)
    .eq('scope', 'class')
    .eq('period', 'week');

  const trong = (het ?? []).filter((w) => w.start_date <= end && w.end_date >= mon);
  const ngoai = (het ?? []).filter((w) => !(w.start_date <= end && w.end_date >= mon));

  const q = mon === tuanNay ? '' : `&week=${mon}`;
  const {html} = await get(`/wig?class=${lop.id}${q}`, ckGv);

  // Chỉ xét những tên CHỈ thuộc một phía — tên trùng nhau giữa hai tập thì không kết luận được gì.
  const tenTrong = new Set(trong.map((w) => w.title).filter(Boolean));
  const tenNgoai = [...new Set(ngoai.map((w) => w.title).filter(Boolean))].filter(
    (t) => !tenTrong.has(t),
  );

  const thieu = [...tenTrong].filter((t) => !html.includes(t));
  const thua = tenNgoai.filter((t) => html.includes(t));

  check(
    `Tuần ${mon}: hiện đủ WIG thuộc tuần`,
    thieu.length === 0,
    `${tenTrong.size} WIG${thieu.length ? ' · thiếu: ' + thieu.join(', ') : ''}`,
  );
  check(
    `Tuần ${mon}: KHÔNG hiện WIG của tuần khác`,
    thua.length === 0,
    `${tenNgoai.length} WIG tuần khác${thua.length ? ' · lọt: ' + thua.join(', ') : ''}`,
  );
}

// ── 4. Thanh chọn tuần có mặt và ghi đúng dải ngày đang xem ──
{
  const mon = shift(tuanNay, -1);
  const {html} = await get(`/wig?class=${lop.id}&week=${mon}`, ckGv);
  const d = new Date(`${mon}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  const cn = d.toISOString().slice(0, 10);
  const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  // KHÔNG dò chuỗi liền `"27/07 → 02/08"`. Trang được stream, và nội dung thật nằm trong RSC
  // payload dưới dạng MẢNG các đoạn — `["27/07"," → ","02/08"]` — vì trong JSX đó là ba biểu thức
  // cạnh nhau. Dò liền mạch thì báo SAI trong khi màn hình vẫn hiện đúng (đã soi payload thật để
  // xác nhận). Nên dò hai đầu mốc đứng gần nhau, kèm trần khoảng cách để không khớp bừa vào hai
  // con số rời rạc ở hai chỗ khác nhau của trang.
  const re = new RegExp(`${dm(mon)}[\\s\\S]{0,60}?${dm(cn)}`);
  check('Thanh tuần ghi đúng dải ngày đang xem', re.test(html), `${dm(mon)} → ${dm(cn)}`);
  // Có đường quay về khi đang đứng ở tuần khác. Dò MARKUP (liên kết trỏ về /wig không kèm ?week)
  // chứ không dò chữ: chuỗi dịch nằm sẵn trong gói gửi xuống trình duyệt nên dò chữ là tự lừa mình.
  check(
    'Có liên kết quay về tuần này',
    /href="\/(?:vi\/)?wig\?class=[^"]*"(?![^>]*week=)/.test(html),
    'liên kết /wig không kèm ?week',
  );
}

// ── 5. ?week= sống sót qua các form (ô ẩn name="week") ──
{
  const mon = shift(tuanNay, -1);
  const {html} = await get(`/wig?class=${lop.id}&week=${mon}`, ckGv);
  const so = (html.match(/name="week"\s+value="[^"]+"/g) ?? []).length;
  check('Các form mang theo tuần đang xem', so > 0, `${so} ô ẩn name="week"`);
  // Ở tuần HIỆN TẠI thì ô ẩn phải rỗng — không đóng cứng tuần vào mọi thao tác sau đó.
  const {html: h2} = await get(`/wig?class=${lop.id}`, ckGv);
  check(
    'Ở tuần này thì không đóng cứng ?week',
    !/name="week"\s+value="\d{4}-\d{2}-\d{2}"/.test(h2),
    'ô ẩn week rỗng',
  );
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
