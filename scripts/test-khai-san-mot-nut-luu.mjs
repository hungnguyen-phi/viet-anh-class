// LƯU CẢ MỘT ĐỢT SỬA KHAI BÁO BẰNG MỘT LẦN BẤM — CÓ THẬT SỰ LƯU KHÔNG.
//
// Vì sao có file này: test-admin-man.mjs chỉ đọc HTML của trang, mà nút Lưu chung nằm sau một cú
// bấm "Sửa danh sách" ở phía trình duyệt — nó KHÔNG có trong HTML lúc mới mở. Nghĩa là bài kiểm
// kia chứng minh được "danh sách đóng băng" nhưng không chứng minh được "bấm Lưu thì dữ liệu đổi".
// Đúng kiểu lỗ hổng đã đốt của dự án này một lần: tsc sạch, next build sạch, trang vẫn hỏng.
//
// Nên bài này gọi THẲNG server action như trình duyệt gọi: POST vào chính đường dẫn trang, kèm
// header Next-Action và một multipart form đúng hình dạng giao diện gửi lên (ba mảng song song
// email/role/class_id). Mã của action được dò ra từ chunk JavaScript mà trang thật sự nạp, nên
// chạy được cả với localhost lẫn production mà không bám cứng vào một chuỗi băm nào.
//
// Dữ liệu: bài kiểm TỰ TẠO hai dòng chờ mang email test-…@truongvietanh.com rồi tự xoá, KHÔNG đụng
// tới khai báo thật của trường.
//
//   node scripts/test-khai-san-mot-nut-luu.mjs [BASE]     mặc định http://localhost:6899
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6899';
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
const xong = (ma = 0) => {
  for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
  const so = kq.filter((k) => k.ok).length;
  console.log(`\n${so}/${kq.length} đạt.`);
  process.exit(ma || (so === kq.length ? 0 : 1));
};

// ── Phiên quản trị thật (không bám cứng vào một email — xem ghi chú ở test-admin-man.mjs) ──
const {data: quanTri} = await admin.from('profiles').select('email').eq('role', 'admin').order('email').limit(5);
if (!quanTri?.length) {
  console.log('SAI  Không còn tài khoản quản trị nào — không chạy kiểm được.');
  process.exit(1);
}
const taiKhoan = (quanTri.find((u) => u.email.startsWith('test')) ?? quanTri[0]).email;
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: taiKhoan});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

// ── Dò mã server action từ chunk mà trang thật sự nạp ──────────────────────────────────────
const trang = await fetch(BASE + '/admin', {headers: {cookie}, redirect: 'manual'});
if (trang.status !== 200) {
  dat(false, 'Trang /admin dựng được với phiên quản trị', `HTTP ${trang.status}`);
  xong(1);
}
const html = await trang.text();
// Bản dựng production gắn thêm ?dpl=<sha> vào từng tệp tĩnh và nạp chúng qua cả src lẫn
// <link rel=preload href>. Bắt cả hai, và cho phép phần truy vấn phía sau .js — regex chỉ nhận
// `src="....js"` khớp được ở dev nhưng KHÔNG khớp gì trên production.
const chunks = [
  ...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+?\.js(?:\?[^"]*)?)"/g)].map((m) => m[1])),
];
const maJs = [];
for (const c of chunks) maJs.push(await (await fetch(BASE + c)).text());

// Tên hàm còn nguyên trong chunk ở CẢ hai bản dựng, nhưng viết khác nhau:
//   · dev (turbopack): {"<băm>":"updateUserGrants"} — một bảng tra thẳng
//   · production (webpack, đã rút gọn): createServerReference("<băm>", x.callServer, void 0,
//     x.findSourceMapURL, "updateUserGrants") — tên là THAM SỐ THỨ NĂM
// Phải bắt cả hai. Và KHÔNG được tra mã từ thư mục .next cục bộ: mã action là băm của id module,
// mà id module đổi theo đường dẫn/hệ điều hành lúc dựng — bản dựng trên máy Windows này cho ra
// một bộ mã hoàn toàn khác bản dựng trong Docker. Đã thử: 0/12 mã trùng nhau.
const TIM = [
  /"([0-9a-f]{20,})":"updateUserGrants"/,
  /"([0-9a-f]{20,})",[$\w.]+\.callServer,void 0,[$\w.]+\.findSourceMapURL,"updateUserGrants"/,
];
const maAction =
  maJs.flatMap((js) => TIM.map((re) => js.match(re)?.[1]).filter(Boolean))[0] ?? null;
dat(!!maAction, 'Tìm được server action updateUserGrants trong mã trang', maAction ?? `đã dò ${chunks.length} chunk`);
if (!maAction) xong(1);

// ── Dựng hai dòng chờ của riêng bài kiểm ───────────────────────────────────────────────────
const dau = `test-luugom-${Date.now()}`;
const A = `${dau}-a@truongvietanh.com`;
const B = `${dau}-b@truongvietanh.com`;
const {data: lop} = await admin.from('classes').select('id, name').eq('is_active', true).limit(1).single();
const donDep = async () => {
  await admin.from('pending_user_grants').delete().in('email', [A, B]);
};
await donDep();
const {error: loiSeed} = await admin
  .from('pending_user_grants')
  .insert([
    {email: A, role: 'student', class_id: null},
    {email: B, role: 'student', class_id: null},
  ]);
if (loiSeed) {
  dat(false, 'Tạo được hai dòng chờ để thử', loiSeed.message);
  xong(1);
}

// ── Gọi action đúng như giao diện gọi: BA mảng song song, MỘT lần gửi ──────────────────────
const bien = '----vacTest' + Math.random().toString(36).slice(2);
const phan = (ten, gt) => `--${bien}\r\nContent-Disposition: form-data; name="${ten}"\r\n\r\n${gt}\r\n`;
// Gửi theo lối "chưa có JavaScript" của Next: mã action nằm trong THÂN dưới tên $ACTION_ID_… chứ
// không nằm ở header. Cùng một hàm chạy ở đầu kia, nhưng cách mã hoá này ổn định và mô tả được
// bằng vài dòng — bản mã hoá qua header là định dạng nội bộ của React, gõ tay là gãy.
const than =
  phan(`$ACTION_ID_${maAction}`, '') +
  phan('email', A) +
  phan('role', 'teacher') +
  phan('class_id', '') +
  phan('email', B) +
  phan('role', 'student') +
  phan('class_id', lop.id) +
  `--${bien}--\r\n`;

const dap = await fetch(BASE + '/admin', {
  method: 'POST',
  redirect: 'manual',
  headers: {
    cookie,
    // Thiếu Origin là Next từ chối thẳng ("Invalid Server Actions request") — đã vấp một lần.
    origin: BASE,
    'Content-Type': `multipart/form-data; boundary=${bien}`,
  },
  body: than,
});
const traLoi = await dap.text();
dat(dap.status === 200 || dap.status === 303, 'Máy chủ nhận lệnh lưu cả mẻ', `HTTP ${dap.status}`);

// ── Dữ liệu có ĐỔI THẬT không ──────────────────────────────────────────────────────────────
const {data: sau} = await admin
  .from('pending_user_grants')
  .select('email, role, class_id')
  .in('email', [A, B]);
const ra = new Map((sau ?? []).map((r) => [r.email, r]));
dat(ra.get(A)?.role === 'teacher', 'Dòng 1: vai đổi student → teacher trong cùng một lần bấm', `nay là ${ra.get(A)?.role}`);
dat(ra.get(B)?.class_id === lop.id, 'Dòng 2: gán được lớp trong cùng một lần bấm', `nay là ${ra.get(B)?.class_id ?? 'trống'}`);
dat(ra.get(B)?.role === 'student', 'Dòng 2: vai KHÔNG bị sửa lây theo dòng 1', `nay là ${ra.get(B)?.role}`);
// Hai dòng khác cặp (vai, lớp) nhau nên phải đi bằng hai câu UPDATE — đây là chỗ dễ gộp nhầm nhất.
// Câu báo đi kèm cú chuyển hướng sau khi lưu (?flash=…) — nằm ở header Location với 303, hoặc
// trong thân trả về khi Next gói chuyển hướng vào luồng RSC.
const noiBao = decodeURIComponent(
  (dap.headers.get('location') ?? '') + (dap.headers.get('x-action-redirect') ?? '') + traLoi,
);
dat(/Đã lưu 2 khai báo/.test(noiBao), 'Báo lại đúng số dòng đã lưu', (noiBao.match(/Đã lưu [^"&]*/) ?? ['không đọc được'])[0]);

// ── Gửi mảng lệch nhau thì phải TỪ CHỐI, không được gán bừa ────────────────────────────────
const than2 =
  phan(`$ACTION_ID_${maAction}`, '') +
  phan('email', A) +
  phan('email', B) +
  phan('role', 'admin') +
  phan('class_id', '') +
  `--${bien}--\r\n`;
const dap2 = await fetch(BASE + '/admin', {
  method: 'POST',
  redirect: 'manual',
  headers: {cookie, origin: BASE, 'Next-Action': maAction, 'Content-Type': `multipart/form-data; boundary=${bien}`},
  body: than2,
});
await dap2.text();
const {data: sau2} = await admin.from('pending_user_grants').select('email, role').in('email', [A, B]);
dat(
  (sau2 ?? []).every((r) => r.role !== 'admin'),
  'Dữ liệu gửi lên lệch mảng thì bị từ chối, không ai bị nâng lên admin',
  (sau2 ?? []).map((r) => r.role).join(', '),
);

await donDep();
xong();
