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
  // Nhãn LẤY TỪ GÓI DỊCH (student.buddyIsLion). Chữ "sư tử" đã bỏ khỏi câu (12/08/2026) và sau
  // đó "của em" đổi thành "của bạn" — viết cứng thì mỗi lần sửa cách xưng hô là một phép kiểm đỏ
  // oan. Điều canh ở đây là NHÃN CÓ MẶT VỚI CẢ HAI VAI, không phải nó gọi em bằng gì. Nghĩa ấy nay do ICON
  // đầu sư tử mang. Nên canh cả hai: câu đúng, và cái icon thật sự có mặt — canh mỗi chữ thì gỡ
  // mất icon bài kiểm vẫn xanh, mà lúc đó trang không còn nói Buddy là con gì nữa.
  const nhanBuddy = JSON.parse(readFileSync('messages/vi.json', 'utf8')).student?.buddyIsLion;
  dat(Boolean(nhanBuddy) && hienRa.includes(nhanBuddy), `[${vai}] có nhãn "${nhanBuddy}"`);
  dat(/stroke-dasharray="3 3\.2"/.test(html), `[${vai}] có icon đầu sư tử đi kèm`);
  dat(!hienRa.includes('Bạn đồng hành'), `[${vai}] KHÔNG còn nhãn "Bạn đồng hành"`);
  dat(!html.includes('name="buddy_id"'), `[${vai}] KHÔNG còn ô chọn bạn cùng lớp trong biên bản`);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
