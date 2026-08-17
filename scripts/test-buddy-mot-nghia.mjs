// MỘT CHỮ BUDDY, MỘT NGHĨA — con sư tử AI, không phải bạn cùng lớp.
//
// Vì sao có file này: app từng mang HAI khái niệm cùng tên "Buddy" trên cùng một trang, và người
// dùng đọc "Bạn đồng hành: Mạnh Hùng Lê Quý" rồi hỏi lại vì sao Buddy không phải con sư tử. Chủ
// dự án chốt bỏ nghĩa bạn-cùng-lớp (12/08/2026). Bài này canh cho nó đừng lặng lẽ quay lại:
// grep mã nguồn thì chỉ chứng minh mã sạch, nên bài này DỰNG THẬT trang của một em, bằng cookie
// của cả GVCN lẫn chính em, rồi soi HTML đã render.
//
//   node scripts/test-buddy-mot-nghia.mjs [BASE]     mặc định http://localhost:3000
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:3000';
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

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// Lấy một em ĐANG HỌC bất kỳ — bám cứng một id là bài kiểm chết theo dữ liệu.
const {data: em} = await admin
  .from('enrollments')
  .select('student_id, class_id')
  .eq('is_active', true)
  .limit(1)
  .single();
const {data: hs} = await admin.from('profiles').select('email').eq('id', em.student_id).single();
const {data: lop} = await admin.from('classes').select('homeroom_teacher_id').eq('id', em.class_id).single();
const {data: gv} = await admin.from('profiles').select('email').eq('id', lop.homeroom_teacher_id).single();

const cookieCua = async (email) => {
  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
};

for (const [vai, email, duong] of [
  ['GVCN', gv.email, `/student/${em.student_id}`],
  ['học sinh', hs.email, '/student'],
]) {
  const r = await fetch(BASE + duong, {headers: {cookie: await cookieCua(email)}, redirect: 'manual'});
  const html = await r.text();
  dat(r.status === 200, `[${vai}] trang dựng được`, `HTTP ${r.status}`);
  if (r.status !== 200) continue;

  // Bỏ <script> trước khi soi CHỮ: gói chuỗi i18n của next-intl nằm trong đó, nên tìm thẳng vào
  // HTML thô là gặp chữ chưa hề hiện lên màn hình — đúng cái bẫy đã báo xanh giả hôm 12/08.
  const hienRa = html.replace(/<script[\s\S]*?<\/script>/g, '');
  // Huy hiệu "Buddy của em" (một pill đứng riêng, không bấm được) ĐÃ GỠ 18/08/2026 khi làm lại
  // giao diện. Nghĩa "Buddy = con sư tử" nay do ICON đầu sư tử mang, đặt ngay ở tiêu đề khung ghi
  // chú Buddy dưới biên bản — nên chỉ còn canh cái icon có mặt (khi trang có ít nhất một ghi chú).
  const coGhiChu = hienRa.includes('Buddy nhắn');
  if (coGhiChu) dat(/stroke-dasharray="3 3\.2"/.test(html), `[${vai}] khung ghi chú Buddy có icon đầu sư tử`);
  dat(!hienRa.includes('Bạn đồng hành'), `[${vai}] KHÔNG còn nhãn "Bạn đồng hành"`);
  dat(!html.includes('name="buddy_id"'), `[${vai}] KHÔNG còn ô chọn bạn cùng lớp trong biên bản`);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
