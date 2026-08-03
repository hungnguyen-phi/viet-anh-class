// Những thứ ba người thử XIN có thật sự tới nơi được không.
//
// VÌ SAO CẦN. Trong phiếu trải nghiệm (Phieu_trai_nghiem_Viet_Anh_Class), cả giáo viên chủ nhiệm
// lẫn ban giám hiệu đều viết gần như cùng một câu ở chặng "đọc báo cáo như một phụ huynh thật":
//
//   "Mình muốn thấy thêm về thời khóa biểu, thực đơn, BTVN hoặc dặn dò kiểm tra, điểm số môn học,
//    hình ảnh học tập/sự kiện của con và nhận xét của GV về quá trình học của con"
//
// Sáu thứ ấy nay đều đã có. Nhưng chúng nằm ở SÁU chỗ khác nhau — hai tab trên thanh nav, một thẻ
// nhúng giữa trang, một liên kết cuối trang, một mục dựng từ biên bản họp. Không có gì buộc chúng
// phải cùng tồn tại: xoá một dòng href là mất một lối vào, mà trang vẫn trả 200 và mọi phép kiểm
// khác vẫn xanh. Đúng kiểu hỏng mà /gallery và /menu đã từng mắc — tính năng xây xong, quyền mở
// sẵn, chỉ thiếu đường dẫn tới, nên người dùng báo "thiếu tính năng" trong khi nó nằm ngay đó.
//
// Phép kiểm này đi ĐÚNG đường một phụ huynh đi: đăng nhập, mở /report, và từ đó phải với tới được
// cả sáu thứ.
//
//   node scripts/test-loi-vao-nguoi-thu-xin.mjs [http://localhost:6871]
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

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// Bỏ <script>: payload RSC mang cả chuỗi dịch và dữ liệu thô, nên dò trên HTML nguyên bản là dò
// trúng thứ không được vẽ ra. Xem ghi chú dài hơn ở scripts/test-week-nav.mjs.
const than = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '');
async function get(path, cookie) {
  const r = await fetch(BASE + path, {headers: {cookie}, redirect: 'manual'});
  const raw = await r.text();
  return {status: r.status, loc: r.headers.get('location'), html: than(raw)};
}

// Một lối vào coi là ĐẾN NƠI khi: có liên kết trỏ tới nó trên trang xuất phát, VÀ mở liên kết ấy
// bằng chính phiên đăng nhập đó thì ra trang 200 (không bị đá về nơi khác).
async function loiVao({ten, tuTrang, mau, cookie}) {
  const trang = await get(tuTrang, cookie);
  const co = mau.test(trang.html);
  if (!co) {
    check(ten, false, `không thấy lối vào trên ${tuTrang}`);
    return;
  }
  const m = trang.html.match(mau);
  const href = (m[1] ?? m[0]).replace(/&amp;/g, '&');
  const dich = await get(href.startsWith('/') ? href : `/${href}`, cookie);
  const toiNoi = dich.status === 200;
  check(ten, toiNoi, `${href} → HTTP ${dich.status}${dich.loc ? ' → ' + dich.loc : ''}`);
}

const ckPh = await ck('test1.ph@truongvietanh.com');
const ckHs = await ck('test1.hs@student.truongvietanh.com');

console.log('── PHỤ HUYNH: sáu thứ được xin trong phiếu ──');
// Bốn thứ nằm trên thanh nav (nav render ở layout nên có mặt trên mọi trang của vai này).
for (const [ten, re] of [
  ['Bài tập về nhà / dặn dò', /href="(\/(?:vi\/|en\/)?homework[^"]*)"/],
  ['Điểm số môn học', /href="(\/(?:vi\/|en\/)?grades[^"]*)"/],
  ['Thời khoá biểu', /href="(\/(?:vi\/|en\/)?timetable[^"]*)"/],
]) {
  await loiVao({ten, tuTrang: '/report', mau: re, cookie: ckPh});
}
// Hai thứ nhúng trong chính trang báo cáo.
await loiVao({
  ten: 'Thực đơn',
  tuTrang: '/report',
  mau: /href="(\/(?:vi\/|en\/)?menu[^"]*)"/,
  cookie: ckPh,
});
await loiVao({
  ten: 'Hình ảnh học tập / sự kiện',
  tuTrang: '/report',
  mau: /href="(\/(?:vi\/|en\/)?gallery[^"]*)"/,
  cookie: ckPh,
});
// Thứ sáu không phải một trang mà là một MỤC trong báo cáo — dựng từ biên bản họp WIG.
{
  const {html} = await get('/report', ckPh);
  // Dò nhãn mục, không dò nội dung: lớp có thể chưa họp buổi nào, nhưng mục phải có mặt để
  // phụ huynh biết chỗ mà tìm.
  check(
    'Nhận xét / chiêm nghiệm của giáo viên',
    /Chiêm nghiệm|Reflection/i.test(html),
    'mục có mặt trong /report',
  );
}

console.log('\n── HỌC SINH: thực đơn (các em cũng xin) ──');
await loiVao({
  ten: 'Thực đơn từ bảng điểm của em',
  tuTrang: '/student',
  mau: /href="(\/(?:vi\/|en\/)?menu[^"]*)"/,
  cookie: ckHs,
});

console.log('\n── Điểm danh lùi ngày (GVCN và quản trị đều xin) ──');
{
  const ckGv = await ck('test1.gvcn@truongvietanh.com');
  const homQua = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const r = await get(`/attendance?date=${homQua}`, ckGv);
  check('GVCN mở được điểm danh của hôm qua', r.status === 200, `?date=${homQua} → HTTP ${r.status}`);
  // Ngày quá xa phải bị từ chối TỬ TẾ: về hôm nay kèm lời giải thích, không phải trang trắng.
  const xa = '2020-01-06';
  const r2 = await get(`/attendance?date=${xa}`, ckGv);
  check(
    'Ngày quá cũ bị từ chối kèm lời giải thích',
    r2.status === 200 && /7 ngày gần nhất|quản trị viên/i.test(r2.html),
    `?date=${xa} → HTTP ${r2.status}`,
  );
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
