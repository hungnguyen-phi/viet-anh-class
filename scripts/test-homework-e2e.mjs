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

// Môn lấy từ DANH MỤC (migration 0069), không còn gõ tay. Dùng Toán — môn chắc chắn có.
const NOIDUNG = 'E2E-BTVN-trang-42-khong-trung-gi';
// LỚP, GVCN, HỌC SINH, PHỤ HUYNH — LẤY TỪ MỘT CHÙM ĂN KHỚP NHAU.
//
// Bản cũ neo vào lớp '7B1' và ba email viết cứng. Lớp ấy không còn, và ba tài khoản kia thì đã
// không còn dính vào nhau: test1.gvcn không chủ nhiệm lớp nào, con của test1.ph học lớp khác.
// Bài này đi trọn một luồng (cô đăng bài → em thấy → phụ huynh thấy → em đánh dấu → cô thấy
// đếm), nên bốn nhân vật PHẢI cùng một lớp — thiếu khớp một mắt là cả luồng đứt ở giữa và mọi
// phép đo phía sau đỏ vì lý do không liên quan.
//
// Nên chọn lớp theo điều kiện: có GVCN, có em đang học, và có phụ huynh nối với chính em đó.
const {data: chum} = await admin
  .from('enrollments')
  .select('class_id, student_id, classes!inner(homeroom_teacher_id, is_active)')
  .eq('is_active', true)
  .eq('classes.is_active', true)
  .not('classes.homeroom_teacher_id', 'is', null);
let boBa = null;
for (const e of chum ?? []) {
  const {data: ph} = await admin
    .from('parent_links')
    .select('parent_id')
    .eq('student_id', e.student_id)
    .limit(1)
    .maybeSingle();
  if (ph) {
    boBa = {classId: e.class_id, studentId: e.student_id, parentId: ph.parent_id,
            teacherId: e.classes.homeroom_teacher_id};
    break;
  }
}
if (!boBa) {
  console.log('BỎ QUA: không lớp nào có đủ GVCN + học sinh + phụ huynh của chính em ấy. CHƯA KIỂM.');
  process.exit(1);
}
const CLASS = boBa.classId;
const mail = async (id) =>
  (await admin.from('profiles').select('email').eq('id', id).single()).data.email;
const MON_ID = (
  await admin.from('subjects').select('id').eq('code', 'TOAN').is('campus_id', null).single()
).data.id;
const MON = (await admin.from('subjects').select('name').eq('id', MON_ID).single()).data.name;

// Lớp phải HỌC môn đó thì ô chọn mới hiện nó (bảng class_subjects).
await admin.from('class_subjects').upsert(
  {class_id: CLASS, subject_id: MON_ID},
  {onConflict: 'class_id,subject_id'},
);

// Dọn dấu vết lần chạy trước
await admin.from('homework_posts').delete().eq('content', NOIDUNG);
await admin.from('notifications').delete().like('title', '%' + MON + '%');

const ckGv = await ck(await mail(boBa.teacherId));
const ckHs = await ck(await mail(boBa.studentId));
const ckPh = await ck(await mail(boBa.parentId));
// GIÁO VIÊN "LỚP KHÁC" — tìm người thật, không viết cứng.
//
// Bản cũ dùng test3.gvcn@truongvietanh.com; tài khoản ấy không còn tồn tại, và vì `generateLink`
// tự tạo người dùng nên chạy bài này sẽ ĐẺ nó ra dưới dạng tài khoản chờ duyệt trên production.
// Chốt chặn ở đầu tệp nay ném lỗi thay vì tạo — nên phải tìm một giáo viên có thật, chủ nhiệm
// MỘT LỚP KHÁC. Đó mới đúng vai mà phép kiểm cần: người ngoài lớp thì không được đọc/ghi.
const {data: gvKhacRow} = await admin
  .from('classes')
  .select('homeroom_teacher_id, profiles!classes_homeroom_teacher_id_fkey(email)')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .neq('id', CLASS)
  .limit(1)
  .maybeSingle();
const emailGvKhac = gvKhacRow?.profiles?.email ?? null;
if (!emailGvKhac) {
  console.log('BỎ QUA: trường chỉ có một lớp có GVCN — không có "người lạ" nào để thử. CHƯA KIỂM.');
  process.exit(1);
}
const ckGv3 = await ck(emailGvKhac);

// ── 1. GVCN đăng bài ──
// Ngày phải lấy theo giờ VN, không phải new Date() của máy chạy test — máy chủ chạy UTC nên
// trong khung 00:00–07:00 giờ VN thì ngày lệch một hôm, và ràng buộc due_date >= date sẽ chặn.
const homNay = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date());
const dang = await goiAction(`/homework?class=${CLASS}`, ckGv, 'name="content"', {
  class_id: CLASS,
  date: homNay,
  subject_id: MON_ID,
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
  .select('id, class_id, subject_id, content')
  .eq('content', NOIDUNG)
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
  // SOI MARKUP, KHÔNG SOI CHỮ.
  //
  // Trước đây phép kiểm này tìm chuỗi 'Em đã làm rồi' trong HTML. Nó đúng chừng nào chuỗi ấy còn
  // được viết cứng trong mã và chỉ vẽ ra cho học sinh. Từ khi nhãn chuyển vào file dịch thì
  // layout gửi TOÀN BỘ danh mục chuỗi xuống trình duyệt (NextIntlClientProvider messages={...}),
  // nên câu đó nằm trong HTML của MỌI trang, kể cả trang phụ huynh không có nút nào — phép kiểm
  // báo sai trong khi giao diện vẫn đúng.
  //
  // `name="done"` là ô ẩn CHỈ có trong form tick (xem homework/page.tsx, nhánh laHocSinh). Có nó
  // nghĩa là form thật sự được vẽ ra, không phải chỉ có chữ trôi nổi đâu đó trong payload.
  check(
    'Phụ huynh KHÔNG có nút tick',
    !/name="done"/.test(than),
    'không thấy form đánh dấu',
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
await admin.from('homework_posts').delete().eq('content', NOIDUNG);
await admin.from('notifications').delete().like('title', '%' + MON + '%');
const {data: con} = await admin.from('homework_posts').select('id').eq('content', NOIDUNG);
check('Đã dọn dữ liệu thử', (con ?? []).length === 0);

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
