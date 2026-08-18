// MỘT CHỮ BUDDY, MỘT NGHĨA — nay là BẠN HỌC PDR; con AI mang tên "Sư Tử".
//
// Lịch sử đổi nghĩa hai lần: app từng mang HAI khái niệm cùng tên "Buddy" và người dùng nhầm
// (12/08/2026 chốt bỏ nghĩa bạn-cùng-lớp). Rồi PRD v3 (17/08) đưa buddy-bạn-học trở lại làm
// trung tâm họp PDR, nên 18/08 chốt ngược: chữ Buddy thuộc về BẠN HỌC, con sư tử AI đổi tên
// "Sư Tử". Bài này canh cho hai tên đừng lẫn lại: nhãn cũ của con AI ("Buddy nhắn", "Nói với
// Buddy", "Bạn đồng hành") không được xuất hiện nữa. DỰNG THẬT trang của một em, bằng cookie
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
  // Ghi chú của con AI nay mang tên "Sư Tử nhắn", kèm icon đầu sư tử ở tiêu đề khung
  // (khi trang có ít nhất một ghi chú thì icon phải có mặt).
  const coGhiChu = hienRa.includes('Sư Tử nhắn');
  if (coGhiChu) dat(/stroke-dasharray="3 3\.2"/.test(html), `[${vai}] khung ghi chú Sư Tử có icon đầu sư tử`);
  dat(!hienRa.includes('Bạn đồng hành'), `[${vai}] KHÔNG còn nhãn "Bạn đồng hành"`);
  dat(!hienRa.includes('Buddy nhắn') && !hienRa.includes('Nói với Buddy'), `[${vai}] con AI không còn mang tên Buddy (nay là Sư Tử)`);
  dat(!html.includes('name="buddy_id"'), `[${vai}] KHÔNG còn ô chọn bạn cùng lớp trong biên bản`);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
