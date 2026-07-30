// Luồng thật của tính năng báo bài, chạy qua HTTP bằng phiên đăng nhập thật:
//   GVCN đăng bài → thông báo sinh ra → học sinh thấy và tick → phụ huynh thấy con đã tick →
//   phụ huynh KHÔNG tick thay được → GVCN thấy đếm 1/N → GVCN xoá bài.
//
// Vì sao không dò ACTION_ID trong HTML: form dùng useActionState nên id nằm trong ô ẩn
// $ACTION_<n>:0. Hàm goiAction() dưới đây bóc đúng ô đó — cùng cách đã dùng khi kiểm ghi danh.
//
//   node scripts/test-homework-e2e.mjs [https://class.vietanh.org]
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

const get = async (path, cookie) => {
  const r = await fetch(BASE + path, {headers: {cookie}, redirect: 'manual'});
  return {status: r.status, html: await r.text()};
};

// Gửi một server action của form useActionState. `moc` là chuỗi nhận dạng form cần gửi.
async function goiAction(path, cookie, moc, fields) {
  const {html} = await get(path, cookie);
  const khoi = html.split('<form').find((f) => f.includes(moc));
  if (!khoi) throw new Error(`không thấy form chứa "${moc}" ở ${path}`);
  const fd = new FormData();

  // Hai kiểu form trong dự án, mã action nằm ở hai chỗ khác nhau:
  //  • useActionState  → ô ẩn $ACTION_REF_n + $ACTION_n:0 (đăng/sửa bài)
  //  • action thường   → ô ẩn $ACTION_ID_<hash>            (tick, xoá)
  const n = khoi.match(/ACTION_REF_(\d+)/)?.[1];
  if (n) {
    const id = khoi.match(/ACTION_\d+:0" value="\{&quot;id&quot;:&quot;([a-f0-9]{40,})&quot;/)?.[1];
    if (!id) throw new Error(`không bóc được mã action (useActionState) của form "${moc}"`);
    const key = khoi.match(/ACTION_KEY"[^>]*value="(k[a-f0-9]{32})"/)?.[1];
    fd.set(`$ACTION_REF_${n}`, '');
    fd.set(`$ACTION_${n}:0`, JSON.stringify({id, bound: '$@1'}));
    fd.set(`$ACTION_${n}:1`, JSON.stringify([{ok: false}]));
    if (key) fd.set('$ACTION_KEY', key);
  } else {
    const idPlain = khoi.match(/\$ACTION_ID_([a-f0-9]{40,})/)?.[1];
    if (!idPlain) throw new Error(`không bóc được mã action của form "${moc}"`);
    fd.set(`$ACTION_ID_${idPlain}`, '');
  }

  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: {cookie, Origin: BASE},
    body: fd,
    redirect: 'manual',
  });
  return {status: r.status, body: await r.text()};
}

const kq = [];
const check = (nhan, dat, ct = '') => kq.push(`${dat ? 'OK  ' : 'SAI '} ${nhan}${ct ? ' — ' + ct : ''}`);

const MON = 'E2E-Toán';
const NOIDUNG = 'E2E-BTVN-trang-42-' + MON;
const CLASS = (await admin.from('classes').select('id').eq('name', '7B1').single()).data.id;

// Dọn dấu vết lần chạy trước
await admin.from('homework_posts').delete().eq('subject', MON);
await admin.from('notifications').delete().like('title', '%' + MON + '%');

const ckGv = await ck('test1.gvcn@truongvietanh.com');
const ckHs = await ck('test1.hs@student.truongvietanh.com');
const ckPh = await ck('test1.ph@truongvietanh.com');
const ckGv3 = await ck('test3.gvcn@truongvietanh.com');

// ── 1. GVCN đăng bài ──
// Ngày phải lấy theo giờ VN, không phải new Date() của máy chạy test — máy chủ chạy UTC nên
// trong khung 00:00–07:00 giờ VN thì ngày lệch một hôm, và ràng buộc due_date >= date sẽ chặn.
const homNay = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date());
const dang = await goiAction(`/homework?class=${CLASS}`, ckGv, 'name="content"', {
  class_id: CLASS,
  date: homNay,
  subject: MON,
  kind: 'assignment',
  due_date: '',
  content: NOIDUNG,
});
check(
  'GVCN đăng bài',
  dang.status === 200 && !/"error"/.test(dang.body),
  `status ${dang.status}` + (dang.body.match(/"error":"((?:[^"\\]|\\.){0,90})/)?.[1] ?? ''),
);

const {data: post} = await admin
  .from('homework_posts')
  .select('id, class_id, subject, content')
  .eq('subject', MON)
  .maybeSingle();
check('Bài được ghi vào CSDL', !!post && post.class_id === CLASS);

// ── 2. Thông báo sinh ra cho học sinh + phụ huynh (trigger 0068) ──
const {count: soTb} = await admin
  .from('notifications')
  .select('id', {count: 'exact', head: true})
  .like('title', '%' + MON + '%');
const {count: soHs} = await admin
  .from('enrollments')
  .select('student_id', {count: 'exact', head: true})
  .eq('class_id', CLASS)
  .eq('is_active', true);
check('Có thông báo cho cả lớp + phụ huynh', (soTb ?? 0) >= (soHs ?? 0), `${soTb} thông báo · ${soHs} học sinh`);

// ── 3. Học sinh thấy bài ──
const hs = await get('/homework', ckHs);
check('Học sinh thấy bài', hs.html.includes(NOIDUNG), `status ${hs.status}`);

// ── 4. GVCN lớp khác KHÔNG thấy ──
const gv3 = await get('/homework', ckGv3);
check('GVCN lớp khác KHÔNG thấy bài', !gv3.html.includes(NOIDUNG));

// ── 5. Học sinh tick đã làm ──
if (post) {
  const tick = await goiAction('/homework', ckHs, `value="${post.id}"`, {
    class_id: CLASS,
    post_id: post.id,
    done: '0', // trạng thái HIỆN TẠI là chưa đánh dấu → bấm nghĩa là đánh dấu
  }).catch((e) => ({status: 0, body: String(e.message)}));
  const {data: done} = await admin
    .from('homework_done')
    .select('student_id')
    .eq('post_id', post.id);
  check('Học sinh tick được', (done ?? []).length === 1, `${(done ?? []).length} dòng · ${tick.status}`);

  // ── 6. Phụ huynh thấy con đã tick, và KHÔNG có nút tick ──
  const ph = await get('/homework', ckPh);
  check('Phụ huynh thấy bài', ph.html.includes(NOIDUNG));
  const than = ph.html.slice(ph.html.indexOf('<main'));
  check(
    'Phụ huynh KHÔNG có nút tick',
    !/Em đã làm rồi|bấm để bỏ/.test(than),
    'không thấy nút đánh dấu',
  );

  // ── 7. GVCN thấy đếm ──
  // Bỏ thẻ HTML trước khi dò: con số và "/3" nằm trong hai thẻ khác nhau
  // ("<b>1<span>/3</span></b>"), nên dò trên HTML thô sẽ không khớp.
  const gv = await get(`/homework?class=${CLASS}`, ckGv);
  const chu = gv.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  check(
    'GVCN thấy số em đã đánh dấu',
    /Đã tự đánh dấu là đã làm:\s*1\s*\/\s*\d+/.test(chu),
    chu.match(/Đã tự đánh dấu là đã làm:[^e]{0,14}/)?.[0] ?? 'không thấy dòng đếm',
  );
}

// ── 8. Dọn ──
await admin.from('homework_posts').delete().eq('subject', MON);
await admin.from('notifications').delete().like('title', '%' + MON + '%');
const {data: con} = await admin.from('homework_posts').select('id').eq('subject', MON);
check('Đã dọn dữ liệu thử', (con ?? []).length === 0);

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
