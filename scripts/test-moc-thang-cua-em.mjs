// MỐC THÁNG CỦA EM (0108, lát 3).
//
//   npm run dev  rồi:  node scripts/test-moc-thang-cua-em.mjs [http://localhost:6880]
//
// ── CHỖ BÀI NÀY KHÔNG PHỦ, NÓI TRƯỚC ────────────────────────────────────────────────────────
//
// Bài này KHÔNG gọi được `luuMucTieuCuaEm` từ ngoài, nên ĐƯỜNG SINH mốc (em bấm Gửi → app tự chia
// mục tiêu năm ra các mốc tháng) chưa có phép kiểm tự động. Đã thử và thất bại, ghi lại để người
// sau khỏi đi lại:
//
//   · Lối "chưa có JavaScript" ($ACTION_ID_… đặt trong thân form) chỉ truyền được MỘT tham số.
//     `luuMucTieuCuaEm` là action của useActionState nên chữ ký là (prevState, formData) — formData
//     rơi vào chỗ prevState và hàm nổ ngay dòng đầu (HTTP 500, "Cannot read properties of
//     undefined"). Cách này chỉ dùng được cho action một tham số, như test-khai-san-mot-nut-luu.
//   · Lối "có JavaScript" (header Next-Action + trường `0` là mảng tham số, FormData trỏ bằng
//     "$K1") thì GỌI ĐƯỢC hàm — kết quả trả về đúng dạng `1:{"ok":false,…}` — nhưng FormData dựng
//     ra LUÔN RỖNG. Đã dò sáu tiền tố cho tên trường (`1_`, `0_`, không tiền tố, `2_`, `$1_`,
//     `$ACTION_1_`) và cả hai thứ tự (mảng tham số trước / sau nội dung form): không cái nào tới
//     nơi. Biểu hiện chung là action nhận một form trắng.
//
// Nên phần dưới kiểm ba thứ KIỂM ĐƯỢC THẬT, và người sửa mã vẫn phải mở trình duyệt bấm một lần
// khi đụng vào đường sinh. Đừng đọc "9/9 đạt" ở đây thành "đường sinh đã chạy".
//
// Ba luật đang kiểm:
//   1. Có mốc tháng của tháng này → thẻ mục tiêu của em phải hiện "Tháng này: N <đơn vị>"
//   2. Mốc của THÁNG KHÁC không được rò sang tháng này
//   3. Đích ghi-nhận-ngoài (manual) không có mốc thì cũng không có dòng ấy — và mã sinh mốc phải
//      còn nguyên hàng rào `measure_by === 'tick'` cùng bước dọn mốc cũ trước khi rải lại
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

// Bó dịch next-intl nằm nguyên văn trong payload RSC — soi chữ phải soi trên bản đã bỏ <script>,
// nếu không thì `includes` trả true cho cả những chuỗi không hề được vẽ ra.
const boScript = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '');

const ketQua = [];
const dau = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});
function xong(ma) {
  for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
  const d = ketQua.filter((k) => k.dat).length;
  console.log(`\n${d}/${ketQua.length} đạt.  (đường SINH mốc chưa phủ — xem đầu tệp)`);
  process.exit(ma ?? (d === ketQua.length ? 0 : 1));
}

// ── Chọn một em CHƯA có mục tiêu nào ───────────────────────────────────────────────────────
// `wigs_em_uidx` khoá theo (em, loại, nhãn năm): gieo cho em đã có mục tiêu thật là ghi đè lên nó,
// rồi phần dọn cuối bài xoá mất luôn. Chọn em còn trống thì không có gì để phá.
const {data: hsRows} = await admin
  .from('profiles').select('id, email').eq('role', 'student').like('email', 'test%').order('email');
const {data: daCoRows} = await admin
  .from('wigs').select('student_id').eq('scope', 'student').eq('period', 'year');
const banRoi = new Set((daCoRows ?? []).map((r) => r.student_id));

let em = null, enr = null, HS = null;
for (const h of hsRows ?? []) {
  if (banRoi.has(h.id)) continue;
  const {data: e} = await admin
    .from('enrollments').select('class_id').eq('student_id', h.id).eq('is_active', true).maybeSingle();
  if (e) {
    em = {id: h.id}; enr = e; HS = h.email; break;
  }
}
if (!em) {
  dau('Có em CHƯA đặt mục tiêu để thử', false, 'mọi tài khoản test đều đã có mục tiêu — không thử mà không phá dữ liệu được');
  xong(1);
}
dau('Có em chưa đặt mục tiêu để thử', true, HS);

const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: HS});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
const doc = async () => boScript(await (await fetch(BASE + '/student', {headers: {cookie}})).text());

// Tháng này và tháng sau, theo giờ VN.
const nayVN = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh'}));
const hai = (n) => String(n).padStart(2, '0');
const thangNay = `${nayVN.getFullYear()}-${hai(nayVN.getMonth() + 1)}`;
const dauThang = `${thangNay}-01`;
const cuoiThang = new Date(nayVN.getFullYear(), nayVN.getMonth() + 1, 0);
const cuoi = `${thangNay}-${hai(cuoiThang.getDate())}`;
const sau = new Date(nayVN.getFullYear(), nayVN.getMonth() + 1, 1);
const thangSau = `${sau.getFullYear()}-${hai(sau.getMonth() + 1)}`;

const nen = {
  student_id: em.id, class_id: enr.class_id, scope: 'student', kind: 'academic',
  area: 'knowledge', status: 'approved', set_by: 'student', measure_by: 'tick', unit: 'bài',
};

let ids = [];
try {
  const {data: nam} = await admin.from('wigs').insert({
    ...nen, period: 'year', period_label: 'ZZTEST-NAM', title: 'ZZ_TEST đọc sách',
    baseline: 10, target_value: 100, start_date: '2026-08-01', end_date: '2027-05-31',
  }).select('id').maybeSingle();
  ids.push(nam.id);

  // ① Mốc của THÁNG NÀY
  const {data: m1} = await admin.from('wigs').insert({
    ...nen, period: 'month', period_label: thangNay, title: 'ZZ_TEST đọc sách',
    baseline: null, target_value: 12, start_date: dauThang, end_date: cuoi, parent_wig_id: nam.id,
  }).select('id').maybeSingle();
  ids.push(m1.id);

  let dom = await doc();
  dau('Có mốc tháng này → thẻ hiện "Tháng này: 12 bài"', dom.includes('Tháng này: 12 bài'));

  // ② Mốc của THÁNG SAU không được rò sang
  await admin.from('wigs').update({period_label: thangSau, start_date: `${thangSau}-01`, end_date: `${thangSau}-28`}).eq('id', m1.id);
  dom = await doc();
  dau('Mốc tháng SAU không rò sang tháng này', !dom.includes('Tháng này: 12 bài'));

  // ③ Hàng rào trong mã sinh mốc
  const src = readFileSync('app/[locale]/(dashboard)/student/actions.ts', 'utf8');
  dau(
    'Chỉ đích đếm được mới bị rải mốc',
    /if \(measure_by === 'tick'\)[\s\S]{0,400}chiaNhip\(/.test(src),
  );
  dau(
    'Rải lại thì DỌN mốc cũ trước, không chồng hai lứa',
    /\.eq\('period', 'month'\)[\s\S]{0,80}\.eq\('parent_wig_id', wigId\)/.test(src),
  );
  dau(
    'Mốc KHÔNG mang liên kết tới mục tiêu lớp',
    /period: 'month' as const[\s\S]{0,600}source_wig_id: null/.test(src),
  );
} finally {
  if (ids.length) {
    await admin.from('wigs').delete().in('parent_wig_id', ids);
    await admin.from('wigs').delete().in('id', ids);
  }
}

xong();
