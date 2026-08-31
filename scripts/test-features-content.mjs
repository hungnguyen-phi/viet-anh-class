// Các trang mới có HIỆN ĐÚNG THỨ cho từng vai không — không chỉ trả 200.
//
// Vì sao cần thêm test này khi đã có test-nav.mjs: 200 chỉ nói "trang không sập". Một trang trả
// 200 mà rỗng, hoặc hiện màn của vai khác, thì vẫn 200. Ở đây kiểm nội dung: vai này PHẢI thấy
// gì, và TUYỆT ĐỐI không được thấy gì.
//
//   node scripts/test-features-content.mjs [https://class.truongvietanh.com]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6874';
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

const TK = {
  teacher: 'test1.gvcn@truongvietanh.com',
  admin: 'test3.admin@truongvietanh.com',
  principal: 'test2.bgh@truongvietanh.com',
  parent: 'test1.ph@truongvietanh.com',
  student: 'test1.hs@student.truongvietanh.com',
};

// Chỉ dò trong phần THÂN trang, bỏ gói bản dịch next-intl mà Next nhúng sẵn vào mọi trang —
// nếu dò cả trang thì chuỗi nào cũng "có mặt" và test thành vô nghĩa (đã bị một lần).
function than(html) {
  const i = html.indexOf('<main');
  return i < 0 ? html : html.slice(i);
}

// [vai, đường dẫn, phải-có[], không-được-có[]]
const CASES = [
  // Báo bài đã GỠ 18/08/2026 (PRD v3) — mọi vai vào /homework phải KHÔNG còn thấy trang bài,
  // route trả 404/redirect. Canh cho nó đừng lặng lẽ quay lại.
  ['teacher', '/homework', [], ['Báo bài', 'Đăng bài', 'Hạn nộp']],
  ['student', '/homework', [], ['Báo bài', 'Hạn nộp cho cả lớp']],

  ['teacher', '/grades', ['Học bạ'], []],
  ['principal', '/grades', ['Học bạ'], []],
  ['parent', '/grades', ['Học bạ'], []],
  ['student', '/grades', ['Học bạ'], []],

  ['teacher', '/inbox', ['Liên lạc'], []],
  ['parent', '/inbox', ['Liên lạc'], []],

  ['admin', '/menu', ['Thực đơn'], []],
  ['parent', '/menu', ['Thực đơn'], []],

  ['teacher', '/gallery', ['nh'], []],
  ['parent', '/gallery', ['nh'], []],

  // Chỗ đã nhúng thêm: thẻ thực đơn + link ảnh trong trang phụ huynh, thẻ số liệu cho BGH.
  ['parent', '/report', ['Thực đơn', 'Hình ảnh lớp'], []],
  ['student', '/student', ['Thực đơn'], []],
  ['principal', '/campus', ['Liên lạc'], []],
  ['admin', '/admin', ['Thực đơn bữa ăn'], []],
  ['teacher', '/roster', ['Hình ảnh'], []],

  // Danh mục môn — 14 môn của trường, và 4 môn chưa khai lớp PHẢI nổi bật để chủ trường bổ sung.
  ['admin', '/subjects', ['Oxford English', 'Khoa học tự nhiên', 'chưa khai lớp'], []],
  ['principal', '/subjects', ['Oxford English'], []],
  ['admin', '/admin', ['Mở danh mục môn'], []],
  ['principal', '/campus', ['Mở danh mục môn'], []],
];

const kq = [];
const cookies = {};
for (const vai of Object.keys(TK)) cookies[vai] = await ck(TK[vai]);

for (const [vai, href, phaiCo, khongDuoc] of CASES) {
  const r = await fetch(BASE + href, {headers: {cookie: cookies[vai]}, redirect: 'manual'});
  const b = than(await r.text());
  const thieu = phaiCo.filter((s) => !b.includes(s));
  const ro = khongDuoc.filter((s) => b.includes(s));
  const dat = r.status === 200 && thieu.length === 0 && ro.length === 0;
  kq.push(
    `${dat ? 'OK  ' : 'SAI '} ${vai.padEnd(10)} ${href.padEnd(11)}` +
      (dat ? '' : ` → ${r.status}${thieu.length ? ' thiếu:' + thieu.join('|') : ''}${ro.length ? ' RÒ:' + ro.join('|') : ''}`),
  );
}

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
