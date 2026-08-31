// Dựng bối cảnh buổi diễn thử: 3 lớp × 10 "học sinh" + 3 giáo viên chủ nhiệm.
//
// Vì sao đồng nghiệp đóng vai HỌC SINH chứ không phải giáo viên: buổi họp WIG là ngồi trước bảng
// số do học sinh tự tick trong tuần. Nếu ai cũng vào với vai giáo viên thì một lớp chỉ có một chỗ
// (mỗi lớp một chủ nhiệm), những người còn lại nhận màn hình "Chưa có lớp", và đến giờ họp thì
// bảng số rỗng — không có gì để họp.
//
// Cơ chế: ghi trước vai + lớp vào pending_user_grants. Người đó đăng nhập Google LẦN ĐẦU là
// trigger handle_new_user áp vai, đưa vào đúng lớp (học sinh) hoặc gán làm chủ nhiệm (giáo viên),
// rồi xoá dòng chờ. KHÔNG có email nào được gửi — xem phần cuối, script in sẵn lời nhắn.
//
//   node scripts/dung-buoi-thu.mjs            # chỉ IN KẾ HOẠCH, không đụng dữ liệu
//   node scripts/dung-buoi-thu.mjs --lam      # thực sự áp dụng
//
// Chạy lại được nhiều lần: nó dọn khai báo cũ của đúng những email này rồi ghi lại từ đầu.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const LAM = process.argv.includes('--lam');
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});

const NAM_HOC = '2026-2027';
const TEN_LOP = ['10A1', '10A2', '10A3'];

// ── Nguồn danh sách: các email đang chờ, hoặc file text truyền vào ───────────────────────
const fileArg = process.argv.find((a) => a.endsWith('.txt'));
let emails;
if (fileArg) {
  emails = readFileSync(fileArg, 'utf8')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
} else {
  const {data} = await svc.from('pending_user_grants').select('email').order('email');
  emails = (data ?? []).map((r) => r.email.toLowerCase());
}
emails = [...new Set(emails)];

if (emails.length < 6) {
  console.log('Cần ít nhất 6 email (3 chủ nhiệm + 3 học sinh). Đang có:', emails.length);
  process.exit(1);
}

// 3 người đầu làm chủ nhiệm, còn lại chia đều làm học sinh.
// Chia theo thứ tự bảng chữ cái chứ không ngẫu nhiên: chạy lại phải ra đúng kết quả cũ, nếu không
// thì mỗi lần chạy lại là một người bị đổi lớp mà không ai hiểu vì sao.
const gvcn = emails.slice(0, 3);
const hocSinh = emails.slice(3);
const nhom = TEN_LOP.map((_, i) => hocSinh.filter((_, j) => j % 3 === i));

console.log(`Tổng ${emails.length} email → 3 chủ nhiệm + ${hocSinh.length} học sinh\n`);
TEN_LOP.forEach((ten, i) => {
  console.log(`  ${ten}  · GVCN: ${gvcn[i]}`);
  console.log(`         · ${nhom[i].length} học sinh: ${nhom[i].slice(0, 3).join(', ')}${nhom[i].length > 3 ? ` … (+${nhom[i].length - 3})` : ''}`);
});

if (!LAM) {
  console.log('\n(Chỉ mới in kế hoạch. Thêm --lam để áp dụng.)');
  process.exit(0);
}

// ── Áp dụng ──────────────────────────────────────────────────────────────────────────────
const {data: cs} = await svc.from('campuses').select('id, name').eq('is_active', true).limit(1);
if (!cs?.length) {
  console.log('Không có cơ sở nào đang hoạt động.');
  process.exit(1);
}
const campus = cs[0].id;

const lopId = [];
for (const ten of TEN_LOP) {
  const {data: co} = await svc
    .from('classes')
    .select('id')
    .eq('name', ten)
    .eq('campus_id', campus)
    .maybeSingle();
  if (co) {
    lopId.push(co.id);
    continue;
  }
  const {data: moi, error} = await svc
    .from('classes')
    .insert({name: ten, school_year: NAM_HOC, campus_id: campus})
    .select('id')
    .single();
  if (error) throw new Error(`Tạo lớp ${ten}: ${error.message}`);
  lopId.push(moi.id);
}

// Dọn khai báo cũ của đúng những email này rồi ghi lại — chạy lại nhiều lần vẫn ra một kết quả.
await svc.from('pending_user_grants').delete().in('email', emails);

const rows = [
  ...gvcn.map((email, i) => ({email, role: 'teacher', class_id: lopId[i]})),
  ...TEN_LOP.flatMap((_, i) => nhom[i].map((email) => ({email, role: 'student', class_id: lopId[i]}))),
];
const {error: eIns} = await svc.from('pending_user_grants').insert(rows);
if (eIns) throw new Error('Ghi khai báo: ' + eIns.message);

// Người ĐÃ có tài khoản sẽ KHÔNG nhận được khai báo này — khai sẵn chỉ áp dụng cho lần đăng nhập
// đầu tiên. Phải nói ra, nếu không họ đăng nhập rồi ngồi đợi một chuyện không xảy ra.
const {data: users} = await svc.auth.admin.listUsers({perPage: 1000});
const daCo = emails.filter((e) => (users?.users ?? []).some((u) => u.email?.toLowerCase() === e));

console.log(`\n✓ Đã tạo/ dùng lại 3 lớp và ghi ${rows.length} khai báo.`);
if (daCo.length) {
  console.log(`\n⚠ ${daCo.length} người ĐÃ CÓ tài khoản nên sẽ KHÔNG tự nhận vai/lớp:`);
  daCo.forEach((e) => console.log('   ', e));
  console.log('   → Vào /admin gán tay cho họ, hoặc xoá tài khoản để họ đăng nhập lại từ đầu.');
}

console.log(`
────────────────────────────────────────────────────────────────────────
LỜI NHẮN GỬI CHO MỌI NGƯỜI (hệ thống KHÔNG tự gửi email — phải tự gửi)
────────────────────────────────────────────────────────────────────────
Chào thầy/cô,

Buổi thử app 4DX của trường: mời thầy/cô vào https://class.truongvietanh.com
và bấm "Đăng nhập với Google", dùng ĐÚNG email trường của mình.

Vào lần đầu, hệ thống sẽ tự đưa thầy/cô vào đúng lớp. Xin làm giúp 2 việc:
  1. Check-in cảm xúc buổi sáng (từ 6h30 đến 8h00) — đây cũng chính là điểm danh.
  2. Vào mục WIG, tick những việc mình đã làm trong tuần.

Xin tick rải ra vài ngày, đừng dồn hết vào sát giờ họp — để bảng số giống thật.

Lưu ý: phải dùng email trường, dùng gmail cá nhân sẽ không vào được đúng lớp.
────────────────────────────────────────────────────────────────────────`);
