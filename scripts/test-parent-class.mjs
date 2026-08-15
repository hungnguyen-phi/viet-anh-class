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

const kq = [];
const check = (nhan, dat, ct = '') => kq.push(`${dat ? 'OK  ' : 'SAI '} ${nhan}${ct ? ' — ' + ct : ''}`);

// DUYỆT MỌI PHỤ HUYNH ĐANG CÓ, không đọc từ một danh sách viết cứng.
//
// Bản cũ đóng cứng hai địa chỉ. Một trong hai (test2.ph) đã không còn — và vì `generateLink` tự
// tạo người dùng, chính bài này đẻ lại nó dưới dạng tài khoản 'pending' trên production. Danh
// sách viết cứng vừa đo nhầm, vừa để lại rác.
//
// Phép "nhà này không đọc được của nhà kia" cần HAI phụ huynh; trường hiện chỉ có một. Phép ấy
// đã được scripts/test-rls-parent-active.sql giữ — bài đó tự dựng hai nhà trong transaction rồi
// rollback, nên không phụ thuộc nhân sự thật. Ở đây nói rõ ra thay vì giả vờ đã kiểm.
const {data: dsPh} = await admin.from('profiles').select('email').eq('role', 'parent').order('email');
const emails = (dsPh ?? []).map((p) => p.email);
check('Có ít nhất một phụ huynh để thử', emails.length > 0, `${emails.length} tài khoản`);
if (emails.length < 2)
  console.log(
    '(Chỉ có 1 phụ huynh trong CSDL — phép "nhà này không đọc được của nhà kia" nằm ở ' +
      'scripts/test-rls-parent-active.sql, bài đó tự dựng hai nhà rồi rollback.)',
  );

for (const email of emails) {
  const cookie = await ck(email);
  const r = await fetch(`${BASE}/timetable`, {headers: {cookie}, redirect: 'manual'});
  const html = await r.text();

  // TÊN LỚP TRA TỪ CSDL, KHÔNG VIẾT CỨNG. Bản cũ dò `html.includes('7B1')`; lớp ấy không còn nên
  // phép đo báo "phụ huynh không thấy tên lớp của con" trong khi màn hình vẫn ghi đúng tên lớp
  // thật. Và test2.ph nay KHÔNG còn người con nào đang học — với tài khoản ấy, /timetable đá đi
  // chỗ khác (307) là câu trả lời ĐÚNG, không phải lỗi. Bản cũ đòi 200 cho cả hai.
  const {data: sessTmp} = {data: JSON.parse(Buffer.from(cookie.split('base64-')[1], 'base64url').toString('utf8'))};
  const {data: conTmp} = await admin
    .from('parent_links')
    .select('student_id')
    .eq('parent_id', sessTmp.user.id);
  const {data: lopConTmp} = await admin
    .from('enrollments')
    .select('classes(name)')
    .in('student_id', (conTmp ?? []).map((c) => c.student_id))
    .eq('is_active', true);
  const tenLop = [...new Set((lopConTmp ?? []).map((e) => e.classes?.name).filter(Boolean))];
  const coCon = tenLop.length > 0;

  if (!coCon) {
    check(`${email} KHÔNG con nào đang học → không vào được TKB`, r.status !== 200, `status ${r.status}`);
    check(`${email} và không lộ lưới lớp nào`, !html.includes('>Tiết<'), 'không lưới');
  } else {
    // KHÔNG dò chuỗi "Chưa có lớp" trong toàn bộ HTML: next-intl nhúng cả gói bản dịch vào trang,
    // nên chuỗi đó LUÔN có mặt dù màn hình không hề hiện nó. Phải dò dấu hiệu của nội dung thật.
    const coLuoi = html.includes('TIẾT') || html.includes('>Tiết<');
    const coTieuDe = tenLop.some((n) => html.includes(n));
    check(`${email} mở /timetable`, r.status === 200, `status ${r.status}`);
    check(
      `${email} thấy lưới TKB lớp của con`,
      coLuoi && coTieuDe,
      `lưới=${coLuoi} tên-lớp=${coTieuDe} (${tenLop.join(', ')})`,
    );
  }

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
