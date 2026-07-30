// Phụ huynh mở /timetable phải thấy TKB lớp của con — trước đây getMyClass() trả null cho vai
// parent nên họ thấy "Chưa có lớp", dù RLS đã cho phép đọc.
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
const check = (nhan, dat, ct = '') => kq.push(`${dat ? 'OK  ' : 'SAI '} ${nhan}${ct ? ' — ' + ct : ''}`);

for (const email of ['test1.ph@truongvietanh.com', 'test2.ph@truongvietanh.com']) {
  const cookie = await ck(email);
  const r = await fetch(`${BASE}/timetable`, {headers: {cookie}, redirect: 'manual'});
  const html = await r.text();
  // KHÔNG dò chuỗi "Chưa có lớp" trong toàn bộ HTML: next-intl nhúng cả gói bản dịch vào trang,
  // nên chuỗi đó LUÔN có mặt dù màn hình không hề hiện nó. Phải dò dấu hiệu của nội dung thật.
  const coLuoi = html.includes('TIẾT') || html.includes('>Tiết<');
  const coTieuDe = /Thời khoá biểu\\?"?\s*[,·]/.test(html) && html.includes('7B1');
  check(`${email} mở /timetable`, r.status === 200, `status ${r.status}`);
  check(`${email} thấy lưới TKB lớp của con`, coLuoi && coTieuDe, `lưới=${coLuoi} tiêu-đề-lớp=${coTieuDe}`);

  // Không được thấy lớp KHÁC: đọc mọi lớp phụ huynh này truy cập được qua RLS.
  const sess = JSON.parse(
    Buffer.from(cookie.split('base64-')[1], 'base64url').toString('utf8'),
  );
  const asParent = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {persistSession: false},
    global: {headers: {Authorization: `Bearer ${sess.access_token}`}},
  });
  const {data: lop} = await asParent.from('classes').select('name');
  const {data: con} = await admin
    .from('parent_links')
    .select('student_id')
    .eq('parent_id', sess.user.id);
  const {data: lopCon} = await admin
    .from('enrollments')
    .select('classes(name)')
    .in(
      'student_id',
      (con ?? []).map((c) => c.student_id),
    )
    .eq('is_active', true);
  const tenLopCon = new Set((lopCon ?? []).map((e) => e.classes?.name).filter(Boolean));
  const thay = (lop ?? []).map((c) => c.name);
  check(
    `${email} chỉ đọc được lớp của con`,
    thay.every((n) => tenLopCon.has(n)),
    `thấy [${thay.join(', ')}] · con học [${[...tenLopCon].join(', ')}]`,
  );
}

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
