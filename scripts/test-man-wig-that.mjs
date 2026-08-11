// DỰNG THẬT NĂM MÀN WIG — với cookie đăng nhập, trên máy chủ đang chạy.
//
// Vì sao phải có: `tsc` sạch và `next build` xanh KHÔNG chứng minh một trang động chạy được. Bài
// học đã ghi của dự án này — mọi lỗi nặng nhất đều lọt qua cả hai rồi mới nổ ở trang thật. Đợt
// 0100/0101 đụng vào đúng những màn dựng lúc chạy: bỏ WIG cá nhân, đổi phòng họp sang chỉnh mốc,
// gộp bảng tick, đổi phép đo trong view.
//
// Cách dùng — mở `npm run dev` trước, rồi:
//   node scripts/test-man-wig-that.mjs [http://localhost:6880]
//
// Đạt = trang trả 200 VÀ trong thân có dấu vết của nội dung thật, KHÔNG có vết lỗi dựng trang.
// Chỉ kiểm mã 200 là chưa đủ: Next trả 200 kèm trang lỗi khi một Server Component ném ra lỗi.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6880';

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
  const {data: v, error: e2} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  if (e2) throw new Error(email + ': ' + e2.message);
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

// Dấu vết LỖI DỰNG TRANG. Next trả 200 kèm trang lỗi, nên không bắt mấy chuỗi này thì mọi phép
// kiểm đều xanh trong khi màn hình thật trắng bốc.
const VET_LOI = [
  'Application error',
  'Internal Server Error',
  'digest:',
  'Unhandled Runtime Error',
  'This page could not be found',
];

// GVCN có lớp thật (10A1). KHÔNG dùng test1.gvcn — tài khoản ấy không chủ nhiệm lớp nào, nên mọi
// trang WIG rơi vào nhánh "chưa có lớp" và phép kiểm xanh mà chẳng kiểm được gì.
const GVCN = 'tham.nguyen@truongvietanh.com';
const HS = 'test1.hs@student.truongvietanh.com';

const ketQua = [];

async function xem(ten, duong, cookie, phaiCo) {
  let r;
  try {
    r = await fetch(BASE + duong, {headers: {cookie}, redirect: 'manual'});
  } catch (e) {
    ketQua.push({ten, dat: false, chiTiet: `không gọi được: ${e.message}`});
    return;
  }
  const body = await r.text();
  const loi = VET_LOI.find((v) => body.includes(v));
  const thieu = phaiCo.filter((s) => !body.includes(s));
  ketQua.push({
    ten,
    dat: r.status === 200 && !loi && thieu.length === 0,
    chiTiet:
      r.status !== 200
        ? `HTTP ${r.status}`
        : loi
          ? `trang lỗi: "${loi}"`
          : thieu.length
            ? `thiếu dấu vết: ${thieu.join(' | ')}`
            : `200, ${Math.round(body.length / 1024)} KB`,
  });
}

const cGV = await ck(GVCN);
const cHS = await ck(HS);

// Lấy đúng một em của lớp GVCN để mở trang chi tiết — id cứng thì hôm nào đổi dữ liệu là đỏ oan.
const {data: lop} = await admin.from('classes').select('id, name').eq('name', '10A1').maybeSingle();
const {data: em} = await admin
  .from('enrollments')
  .select('student_id')
  .eq('class_id', lop?.id ?? '')
  .eq('is_active', true)
  .limit(1)
  .maybeSingle();

await xem('/wig — trang WIG của lớp', '/wig', cGV, ['WIG', '10A1']);
await xem('/wig/chi-tiet — em nào làm tới đâu', '/wig/chi-tiet', cGV, ['10A1']);
await xem('/wig/hop — phòng họp (bước 3 nay CHỈNH mốc)', '/wig/hop', cGV, ['10A1']);
await xem('/student/[id] — GVCN xem màn của một em', `/student/${em?.student_id ?? ''}`, cGV, []);
await xem('/student — chính em xem màn của mình', '/student', cHS, []);
await xem('/report — báo cáo phụ huynh vẫn sống', '/report', cGV, []);

for (const r of ketQua) console.log(`${r.dat ? 'OK  ' : 'SAI '} ${r.ten}  → ${r.chiTiet}`);
const dat = ketQua.filter((r) => r.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
