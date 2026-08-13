// Ô ĐIỀN SỐ THAY CHO MỘT CHẠM (0110) — dựng thật, gieo thật, dọn sạch.
//
//   npm run dev  rồi:  node scripts/test-o-dien-so.mjs [http://localhost:6880]
//
// Chủ dự án chốt 13/08/2026: đơn vị đếm được bằng một lượt (ngày, buổi, tiết) thì giữ MỘT CHẠM;
// đơn vị không đếm được bằng một lượt (giờ, bài, lead) thì ô ngày thành Ô ĐIỀN SỐ, và điền số là
// coi như đã tick. Và vòng tròn "Mục tiêu năm" phải cộng dồn cả năm: 5000 lead, điền 10 là nhích
// đúng 10/5000.
//
// Luật đang kiểm trên MÀN HÌNH THẬT:
//   1. Việc đếm-theo-lượng → ô ngày là <input type=number>, mở lại đúng số đã ghi
//   2. Việc một-chạm → vẫn là nút bấm, KHÔNG có ô số
//   3. Điền vượt chỉ tiêu tuần vẫn cộng đủ vào vòng tròn năm (không kẹp)
//   4. Vòng tròn năm nhích đúng tỷ lệ trên quãng của cả năm
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

const boScript = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '');

// Mọi thẻ của MỘT việc, nhận ra qua aria-label mà LeadTicker gắn ("<tên việc> — T2 08-10").
// Phải lọc theo việc: trang còn việc CHUNG của lớp (một chạm) nên `aria-pressed` tồn tại hợp lệ ở
// đó — bản đầu của bài này soi cả trang nên báo đỏ oan.
const theCua = (dom, ten) =>
  [...dom.matchAll(/<(?:input|button)\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(`aria-label="${ten} `));
const ketQua = [];
const dau = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});
function xong(ma) {
  for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
  const d = ketQua.filter((k) => k.dat).length;
  console.log(`\n${d}/${ketQua.length} đạt.`);
  process.exit(ma ?? (d === ketQua.length ? 0 : 1));
}

// Em CHƯA có mục tiêu — gieo cho em đã có là ghi đè mất của em (wigs_em_uidx).
const {data: hs} = await admin
  .from('profiles').select('id, email').eq('role', 'student').like('email', 'test%').order('email');
const {data: daCo} = await admin.from('wigs').select('student_id').eq('scope', 'student').eq('period', 'year');
const banRoi = new Set((daCo ?? []).map((r) => r.student_id));
let em = null, enr = null, HS = null;
for (const h of hs ?? []) {
  if (banRoi.has(h.id)) continue;
  const {data: e} = await admin
    .from('enrollments').select('class_id').eq('student_id', h.id).eq('is_active', true).maybeSingle();
  if (e) { em = h.id; enr = e.class_id; HS = h.email; break; }
}
if (!em) { dau('Có em chưa đặt mục tiêu để thử', false, 'mọi tài khoản test đều đã có mục tiêu'); xong(1); }
dau('Có em chưa đặt mục tiêu để thử', true, HS);

const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: HS});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
const doc = async () => {
  const r = await fetch(BASE + '/student', {headers: {cookie}});
  if (r.status !== 200) throw new Error(`/student trả HTTP ${r.status} — máy chủ đang hỏng`);
  return boScript(await r.text());
};

// Thứ Hai tuần này theo giờ VN.
const nay = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh'}));
const t2 = new Date(nay); t2.setDate(nay.getDate() - ((nay.getDay() + 6) % 7));
const THU2 = t2.toISOString().slice(0, 10);

let wigId = null, viecId = null;
try {
  // Mục tiêu năm 5000 lead, việc tuần 30 lead, ô ĐIỀN SỐ.
  const {data: w} = await admin.from('wigs').insert({
    class_id: enr, student_id: em, scope: 'student', kind: 'academic', period: 'year',
    period_label: 'ZZTEST-LUONG', area: 'knowledge', title: 'ZZ_TEST đếm lượng',
    baseline: 0, target_value: 5000, unit: 'lead', start_date: '2026-08-01', end_date: '2027-05-31',
    status: 'approved', set_by: 'student', measure_by: 'tick',
  }).select('id').maybeSingle();
  wigId = w.id;
  const {data: lm} = await admin.from('lead_measures').insert({
    wig_id: wigId, title: 'ZZ_TEST điền lead', target_value: 30, unit: 'lead',
    active_weekdays: [1, 2, 3, 4, 5], unit_per_tick: 1, nhap_luong: true,
  }).select('id').maybeSingle();
  viecId = lm.id;

  // ① Ô ngày là ô SỐ
  let dom = await doc();
  let the = theCua(dom, 'ZZ_TEST điền lead');
  dau('Dựng đủ 5 ô ngày cho việc đếm-theo-lượng', the.length === 5, `${the.length} ô`);
  dau('Mọi ô ngày đều là ô NHẬP SỐ', the.length > 0 && the.every((x) => x.includes('type="number"')));
  dau('KHÔNG ô nào còn là nút bấm', the.every((x) => !x.includes('aria-pressed')));

  // ② Ghi 10 → mở lại đúng 10, và vòng tròn nhích đúng 10/5000
  await admin.from('lead_progress').insert({
    lead_measure_id: viecId, student_id: em, logged_by: em, logged_date: THU2, value: 10,
  });
  dom = await doc();
  dau('Mở lại đúng số đã ghi (10)', /value="10"/.test(dom));
  const {data: v1} = await admin.from('wig_progress_v').select('pct, actual').eq('wig_id', wigId).maybeSingle();
  dau('Vòng tròn năm = 10/5000', Number(v1.pct) === 0.002, `${v1.actual}/5000 → ${v1.pct}`);

  // ③ Vượt chỉ tiêu tuần (10 + 25 = 35 > 30) vẫn cộng đủ
  await admin.from('lead_progress').insert({
    lead_measure_id: viecId, student_id: em, logged_by: em, logged_date: THU2, value: 25,
  }).then(() => {}).catch(() => {});
  await admin.from('lead_progress').update({value: 25})
    .eq('lead_measure_id', viecId).eq('logged_date', THU2);
  await admin.from('lead_progress').insert({
    lead_measure_id: viecId, student_id: em, logged_by: em,
    logged_date: new Date(Date.parse(THU2) + 86400000).toISOString().slice(0, 10), value: 10,
  });
  const {data: v2} = await admin.from('wig_progress_v').select('actual').eq('wig_id', wigId).maybeSingle();
  dau('Vượt chỉ tiêu tuần vẫn cộng đủ (25+10=35)', Number(v2.actual) === 35, String(v2.actual));

  // ④ Việc MỘT CHẠM thì vẫn là nút
  await admin.from('lead_measures').update({nhap_luong: false, title: 'ZZ_TEST một chạm'}).eq('id', viecId);
  await admin.from('lead_progress').delete().eq('lead_measure_id', viecId);
  dom = await doc();
  the = theCua(dom, 'ZZ_TEST một chạm');
  dau('Việc một-chạm → dựng đủ 5 ô ngày', the.length === 5, `${the.length} ô`);
  dau('Việc một-chạm → mọi ô là NÚT BẤM', the.length > 0 && the.every((x) => x.includes('aria-pressed')));
  dau('Việc một-chạm → KHÔNG ô nào là ô số', the.every((x) => !x.includes('type="number"')));
} finally {
  if (viecId) await admin.from('lead_progress').delete().eq('lead_measure_id', viecId);
  if (wigId) {
    await admin.from('lead_measures').delete().eq('wig_id', wigId);
    await admin.from('wigs').delete().eq('parent_wig_id', wigId);
    await admin.from('wigs').delete().eq('id', wigId);
  }
}

xong();
