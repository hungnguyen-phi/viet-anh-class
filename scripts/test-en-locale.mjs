// Bản TIẾNG ANH của 6 tính năng mới có thật sự ra tiếng Anh không.
//
// VÌ SAO CẦN: file dịch khớp 894/894 khoá hai chiều KHÔNG chứng minh được gì. Trước đợt này nó
// vẫn khớp 547/547 trong khi sáu tính năng mới hardcode tiếng Việt thẳng vào JSX, không đi qua
// next-intl lần nào. So khoá chỉ soi được chuỗi ĐÃ nằm trong file dịch; chuỗi chưa bao giờ vào
// đó thì vô hình với phép so ấy. Phải mở đúng trang /en và đọc chữ trên đó.
//
// CÁCH DÒ — dò CHUỖI TIẾNG VIỆT PHẢI VẮNG MẶT, không dò chuỗi tiếng Anh phải có mặt:
//
//   Layout gửi TOÀN BỘ danh mục chuỗi của ngôn ngữ đang dùng xuống trình duyệt
//   (NextIntlClientProvider messages={...}). Trên trang /en, gói đó là en.json — nên câu tiếng
//   Anh nào cũng "có mặt" trong HTML dù màn hình có vẽ nó ra hay không. Dò chiều đó là tự lừa
//   mình. Nhưng vi.json thì KHÔNG được gửi kèm trang /en, nên mọi câu tiếng Việt tìm thấy ở đây
//   đều chỉ có thể đến từ một chuỗi viết cứng trong JSX còn sót. Đó mới là tín hiệu thật.
//
// Cũng vì trang được stream (thẻ <main> lúc đầu chỉ chứa khung chờ, nội dung thật tới sau trong
// payload), phải dò TOÀN BỘ HTML chứ không cắt theo <main>.
//
//   node scripts/test-en-locale.mjs [https://class.vietanh.org]
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
  parent: 'test1.ph@truongvietanh.com',
};

// [vai, đường dẫn /en, những câu TIẾNG VIỆT không được phép còn sót]
//
// Chọn câu dài và đặc trưng cho từng màn hình. Tránh từ ngắn dễ trùng với dữ liệu thật (tên lớp,
// tên môn, tên học sinh trong CSDL vẫn là tiếng Việt — đó là DỮ LIỆU, không phải nhãn giao diện).
const CASES = [
  ['admin', '/en/subjects', ['Môn học và phân công', 'Thêm môn dùng chung', 'Lớp nào học', 'đang dùng']],
  ['admin', '/en/menu', ['Thực đơn bữa ăn', 'Tuần này', 'Bữa sáng', 'Bữa trưa']],
  ['teacher', '/en/homework', ['Báo bài ·', 'Nội dung', 'Hạn nộp', 'Bài tập (có việc']],
  ['teacher', '/en/gallery', ['Ảnh lớp ·', 'Tên album', 'Ngày sự kiện']],
  ['teacher', '/en/inbox', ['Liên lạc với phụ huynh', 'Mở cuộc trao đổi']],
  ['teacher', '/en/grades', ['Đợt đánh giá', 'Hạnh kiểm cả lớp', 'Nhận xét & hạnh kiểm']],
  ['parent', '/en/grades', ['Học bạ', 'Điểm các môn', 'Rèn luyện']],
];

let dat = 0;
let sai = 0;
function check(ten, ok, chiTiet = '') {
  if (ok) {
    dat++;
    console.log('OK   ' + ten + (chiTiet ? ' — ' + chiTiet : ''));
  } else {
    sai++;
    console.log('SAI  ' + ten + (chiTiet ? ' — ' + chiTiet : ''));
  }
}

const cookie = {};
for (const [vai, email] of Object.entries(TK)) cookie[vai] = await ck(email);

for (const [vai, href, khongDuocCo] of CASES) {
  const r = await fetch(BASE + href, {headers: {cookie: cookie[vai]}, redirect: 'manual'});
  const html = await r.text();
  if (r.status !== 200) {
    check(`${vai} ${href}`, false, `status ${r.status}`);
    continue;
  }
  const conVN = khongDuocCo.filter((s) => html.includes(s));
  check(
    `${vai} ${href}`,
    conVN.length === 0,
    conVN.length ? 'CÒN TIẾNG VIỆT: ' + conVN.join(' · ') : `sạch (${khongDuocCo.length} câu đã dò)`,
  );
}

console.log(`\n${dat}/${dat + sai} đạt.${sai ? ' ' + sai + ' SAI.' : ''}`);
process.exit(sai ? 1 : 0);
