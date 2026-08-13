// SỐ ĐO NGOÀI APP + Ô LĨNH VỰC (0108) — dựng thật, gieo thật, dọn sạch.
//
//   npm run dev  rồi:  node scripts/test-so-do-va-linh-vuc.mjs [http://localhost:6880]
//
// Hai luật đang kiểm:
//
//   A. Mục tiêu đo NGOÀI app phải có ô nhập số, NẰM TRONG thẻ mục tiêu, và phải nói ra AI GHI con
//      số ấy. Đây là số tự khai chứ không phải phép đo của máy; bày ra mà giấu nguồn là đúng cái
//      tội §5.0 mà 0101/0107 vừa đi dọn ở chỗ khác.
//   B. Mục tiêu KHÔNG nối vào mục tiêu lớp thì phải tự khai lĩnh vực. Trước 13/08/2026 máy chủ
//      lặng lẽ xếp hết vào Kiến thức, nên "chạy bộ mỗi sáng" nằm ở cột Kiến thức trên bảng họp và
//      chính em không có cách nào sửa.
//
// HAI CÁI BẪY ĐÃ SẬP VÀO CHÍNH BÀI KIỂM NÀY, ghi lại để đừng ai đạp lại:
//
//   · Bó dịch next-intl nằm NGUYÊN VĂN trong payload RSC. `raw.includes('con tự ghi')` trả true kể
//     cả khi chữ ấy không hề được vẽ ra — bản đầu của bài này xanh sai đúng vì thế. Mọi phép soi
//     chữ phải chạy trên `dom()`, tức là bản đã bỏ hết <script>.
//   · Thứ tự trong HTML thô KHÔNG phải thứ tự trên màn hình. Next stream một số khối ra cuối tài
//     liệu trong <div hidden> rồi vá về chỗ cũ bằng script — ô số đo là một trong số đó. Nên bài
//     này KHÔNG so vị trí; nó kiểm phần tử thật có đúng thuộc tính, đúng mục tiêu, đúng nhánh.
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

const HS = 'test1.hs@student.truongvietanh.com';

// Bỏ <script>: payload RSC mang nguyên văn mọi chuỗi i18n, kể cả những chuỗi KHÔNG được vẽ ra.
const boScript = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '');

const ketQua = [];
const dau = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});

async function cookieCua(email) {
  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

const {data: em} = await admin.from('profiles').select('id').eq('email', HS).maybeSingle();
const {data: enr} = await admin
  .from('enrollments')
  .select('class_id')
  .eq('student_id', em.id)
  .eq('is_active', true)
  .maybeSingle();

// Thứ Hai của tuần này theo giờ VN — cùng khoá mà `ghiSoDo` ghi vào.
const nayVN = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh'}));
const thu2 = new Date(nayVN);
thu2.setDate(nayVN.getDate() - ((nayVN.getDay() + 6) % 7));
const THU2 = thu2.toISOString().slice(0, 10);

let wigId = null;
try {
  const {data: ins, error} = await admin
    .from('wigs')
    .insert({
      scope: 'student', kind: 'academic', period: 'year', period_label: 'TEST-0108',
      student_id: em.id, class_id: enr.class_id, area: 'physical',
      title: 'ZZ_TEST chiều cao', baseline: 140, target_value: 150, unit: 'cm',
      start_date: '2026-08-01', end_date: '2027-05-31', status: 'approved',
      set_by: 'student', measure_by: 'manual', source_wig_id: null,
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error('không gieo được mục tiêu: ' + error.message);
  wigId = ins.id;

  const ck = await cookieCua(HS);
  const doc = async () => (await fetch(BASE + '/student', {headers: {cookie: ck}})).text();

  // ── A1. Ô nhập có thật, và thuộc ĐÚNG mục tiêu vừa gieo ──
  let dom = boScript(await doc());
  dau('mục tiêu đo-ngoài có ô nhập số', dom.includes('name="gia_tri"'));
  dau(
    'ô gắn đúng mục tiêu vừa gieo',
    dom.includes(`value="${wigId}"`) && dom.includes(`for="sd-${wigId}"`),
  );

  // ── A2. Chưa ai ghi thì KHÔNG bịa ra dòng "ai ghi" ──
  dau('chưa ai ghi → không có dòng nguồn', !dom.includes('con tự ghi') && !dom.includes('cô ghi'));

  // ── A3. Ghi một số → màn hình phải nói AI ghi ──
  const {error: e2} = await admin
    .from('wig_so_do')
    .insert({wig_id: wigId, week_start: THU2, gia_tri: 143.5, nguoi_nhap: em.id, vai_tro: 'student'});
  if (e2) throw new Error('không ghi được số đo: ' + e2.message);
  dom = boScript(await doc());
  dau('số đã ghi hiện ra', dom.includes('143.5'), dom.includes('143.5') ? 'có' : 'không thấy 143.5');
  dau('nói rõ CON TỰ GHI', dom.includes('con tự ghi') && !dom.includes('cô ghi'));

  // ── A4. Đổi sang cô ghi → đổi nhãn nguồn ──
  await admin.from('wig_so_do').update({vai_tro: 'teacher'}).eq('wig_id', wigId);
  dom = boScript(await doc());
  dau('đổi nguồn → nói CÔ GHI', dom.includes('cô ghi') && !dom.includes('con tự ghi'));

  // ── A5. Mục tiêu đếm bằng TICK không có ô nhập số ──
  await admin.from('wig_so_do').delete().eq('wig_id', wigId);
  await admin.from('wigs').update({measure_by: 'tick'}).eq('id', wigId);
  dom = boScript(await doc());
  dau('mục tiêu đếm bằng tick KHÔNG có ô nhập số', !dom.includes('name="gia_tri"'));
  await admin.from('wigs').update({measure_by: 'manual'}).eq('id', wigId);

  // ── B. Lĩnh vực: máy chủ phải TỪ CHỐI mục tiêu tự chọn mà không khai lĩnh vực ──
  // Kiểm ở tầng máy chủ chứ không ở màn hình: ô chọn là client component, chỉ dựng sau một cú bấm.
  const {error: eThieu} = await admin.from('wigs').insert({
    scope: 'student', kind: 'personal', period: 'year', period_label: 'TEST-0108b',
    student_id: em.id, class_id: enr.class_id, area: 'knowledge',
    title: 'ZZ_TEST lĩnh vực', target_value: 5, unit: 'lần',
    start_date: '2026-08-01', end_date: '2027-05-31', status: 'approved',
    set_by: 'student', measure_by: 'manual', source_wig_id: null,
  });
  // Dòng trên chỉ để chắc CSDL vẫn nhận `area` bất kỳ — luật "phải khai" nằm ở luuMucTieuCuaEm,
  // nên kiểm bằng chính mã nguồn của hàm ấy thay vì gọi server action từ ngoài (nó cần Origin và
  // cả một vòng xác thực form).
  if (!eThieu) await admin.from('wigs').delete().eq('period_label', 'TEST-0108b').eq('student_id', em.id);
  const src = readFileSync('app/[locale]/(dashboard)/student/actions.ts', 'utf8');
  dau(
    'máy chủ chặn mục tiêu tự chọn mà thiếu lĩnh vực',
    /if \(!soi && !area_raw\)[\s\S]{0,140}fieldError: 'area'/.test(src),
  );
  dau(
    'lĩnh vực nhận từ form được lọc theo danh sách trắng',
    /LINH_VUC[\s\S]{0,200}includes\(area_raw\)/.test(src),
  );
} finally {
  if (wigId) {
    await admin.from('wig_so_do').delete().eq('wig_id', wigId);
    await admin.from('wigs').delete().eq('id', wigId);
  }
  await admin.from('wigs').delete().eq('student_id', em.id).eq('period_label', 'TEST-0108b');
}

for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
const dat = ketQua.filter((k) => k.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
