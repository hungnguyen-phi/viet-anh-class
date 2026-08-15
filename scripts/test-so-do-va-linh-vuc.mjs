// SỐ ĐO NGOÀI APP + Ô LĨNH VỰC (0108) — dựng thật, gieo thật, dọn sạch.
//
//   npm run dev  rồi:  node scripts/test-so-do-va-linh-vuc.mjs [http://localhost:6880]
//
// Hai luật đang kiểm:
//
//   A. Mục tiêu đo NGOÀI app phải có ô nhập số, NẰM TRONG thẻ mục tiêu, và phải nói ra AI GHI con
//      số ấy. Đây là số tự khai chứ không phải phép đo của máy; bày ra mà giấu nguồn là đúng cái
//      tội §5.0 mà 0101/0107 vừa đi dọn ở chỗ khác.
//   B. MỌI mục tiêu của em phải chỉ ra nó góp vào mục tiêu nào của lớp, và lĩnh vực lấy từ đúng
//      mục tiêu ấy. Trước 13/08/2026 để trống là lặng lẽ xếp vào Kiến thức, nên "chạy bộ mỗi sáng"
//      nằm ở cột Kiến thức trên bảng họp mà chính em không có cách nào sửa. Chủ dự án chốt: không
//      hỏi em lĩnh vực nữa — cô đã khai đủ bốn lĩnh vực thì em luôn có chỗ để gắn vào.
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

// MƯỢN MỤC TIÊU ĐANG CÓ, KHÔNG GIEO THÊM CÁI THỨ HAI.
//
// Bản cũ chèn một mục tiêu học tập mới rồi soi màn /student tìm ô nhập số. Nhưng màn ấy chỉ vẽ
// MỘT mục tiêu học tập, nên khi em đã có sẵn một cái (đếm bằng tick) thì cái vừa gieo không bao
// giờ lên hình — và cả khối A đỏ với lý do "không thấy ô nhập số", nghe hệt như app hỏng. Từ đợt
// gieo lại dữ liệu lớp Test, MỌI em đều đã có sẵn một mục tiêu, nên bẫy này là chắc chắn.
//
// Nay mượn chính mục tiêu ấy: đổi cách đo sang 'manual', đo xong TRẢ LẠI NGUYÊN TRẠNG trong
// `finally`. Vẫn còn đường gieo mới cho trường hợp em chưa có gì.
let wigId = null;
let wigMuon = null; // {id, measure_by, unit, baseline, target_value} — để trả lại y như cũ
try {
  const {data: dangCo} = await admin
    .from('wigs')
    .select('id, measure_by, unit, baseline, target_value')
    .eq('scope', 'student')
    .eq('student_id', em.id)
    .eq('kind', 'academic')
    .limit(1)
    .maybeSingle();

  if (dangCo) {
    wigMuon = dangCo;
    const {error} = await admin
      .from('wigs')
      .update({measure_by: 'manual', unit: 'cm', baseline: 140, target_value: 150})
      .eq('id', dangCo.id);
    if (error) throw new Error('không mượn được mục tiêu: ' + error.message);
    wigId = dangCo.id;
  } else {
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
  }

  const ck = await cookieCua(HS);
  // KIỂM MÃ HTTP MỖI LẦN LẤY TRANG. Không có nó thì trang 500 chỉ hiện ra dưới dạng "không tìm
  // thấy ô nhập" và cả bài đỏ theo kiểu vô nghĩa — đã mất một vòng đi dò vì đúng chuyện này khi
  // máy chủ dev sập worker. Trang hỏng thì nói trang hỏng.
  const doc = async () => {
    const r = await fetch(BASE + '/student', {headers: {cookie: ck}});
    if (r.status !== 200) throw new Error(`/student trả HTTP ${r.status} — máy chủ đang hỏng, không kiểm được`);
    return r.text();
  };

  // ── A1. Ô nhập có thật, và thuộc ĐÚNG mục tiêu vừa gieo ──
  let dom = boScript(await doc());
  dau('mục tiêu đo-ngoài có ô nhập số', dom.includes('name="gia_tri"'));
  dau(
    'ô gắn đúng mục tiêu vừa gieo',
    dom.includes(`value="${wigId}"`) && dom.includes(`for="sd-${wigId}"`),
  );

  // ── A2. Chưa ai ghi thì KHÔNG bịa ra dòng "ai ghi" ──
  // NHÃN NGUỒN LẤY TỪ GÓI DỊCH. Viết cứng 'con tự ghi' là bám vào một chữ đã đổi ('bạn tự ghi'),
  // và khi ấy phép kiểm tố cáo chính thay đổi có chủ ý thay vì canh cái nó sinh ra để canh: màn
  // hình có nói RÕ AI ghi con số ấy hay không.
  const goiVi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
  const nhanEmGhi = goiVi.goal?.readingByStudent;
  const nhanCoGhi = goiVi.goal?.readingByTeacher;
  if (!nhanEmGhi || !nhanCoGhi) throw new Error('thiếu khoá goal.readingByStudent/readingByTeacher');
  dau('chưa ai ghi → không có dòng nguồn', !dom.includes(nhanEmGhi) && !dom.includes(nhanCoGhi));

  // ── A3. Ghi một số → màn hình phải nói AI ghi ──
  const {error: e2} = await admin
    .from('wig_so_do')
    .insert({wig_id: wigId, week_start: THU2, gia_tri: 143.5, nguoi_nhap: em.id, vai_tro: 'student'});
  if (e2) throw new Error('không ghi được số đo: ' + e2.message);
  dom = boScript(await doc());
  dau('số đã ghi hiện ra', dom.includes('143.5'), dom.includes('143.5') ? 'có' : 'không thấy 143.5');
  dau('nói rõ EM TỰ GHI', dom.includes(nhanEmGhi) && !dom.includes(nhanCoGhi));

  // ── A4. Đổi sang cô ghi → đổi nhãn nguồn ──
  await admin.from('wig_so_do').update({vai_tro: 'teacher'}).eq('wig_id', wigId);
  dom = boScript(await doc());
  dau('đổi nguồn → nói CÔ GHI', dom.includes(nhanCoGhi) && !dom.includes(nhanEmGhi));

  // ── A5. Mục tiêu đếm bằng TICK không có ô nhập số ──
  await admin.from('wig_so_do').delete().eq('wig_id', wigId);
  await admin.from('wigs').update({measure_by: 'tick'}).eq('id', wigId);
  dom = boScript(await doc());
  dau('mục tiêu đếm bằng tick KHÔNG có ô nhập số', !dom.includes('name="gia_tri"'));
  await admin.from('wigs').update({measure_by: 'manual'}).eq('id', wigId);

  // ── B. Lĩnh vực: không còn đường nào để em tự khai ──
  // Kiểm bằng chính mã nguồn của `luuMucTieuCuaEm`: gọi được server action ấy từ script thì phải
  // dựng lại cả lối mã hoá hai-tham-số của useActionState, mà lối ấy đã thử và không truyền được
  // FormData (xem đầu scripts/test-moc-thang-cua-em.mjs). Ở đây kiểm cái kiểm được: ba mệnh đề
  // của luật phải còn nguyên trong mã, và ô chọn trên form không còn lựa chọn "để trống".
  const src = readFileSync('app/[locale]/(dashboard)/student/actions.ts', 'utf8');
  dau(
    'máy chủ BẮT BUỘC chọn mục tiêu lớp',
    /if \(!source_wig_id\)[\s\S]{0,200}fieldError: 'source_wig_id'/.test(src),
  );
  // HỎI HAI MỆNH ĐỀ RIÊNG, đừng ép chúng đứng gần nhau. Bản cũ đòi 'select(area)' và 'const area
  // = chaLop.area' cách nhau tối đa 320 ký tự; giữa hai dòng ấy nay có thêm một nhánh kiểm lỗi,
  // thế là đỏ — trong khi luật vẫn còn nguyên. Khoảng cách giữa hai dòng mã không phải là luật.
  dau(
    'lĩnh vực lấy từ mục tiêu lớp trong CSDL, không tin ô trên form',
    /\.select\('area'\)/.test(src) &&
      /const area[^=]*= chaLop\.area/.test(src) &&
      !/formData\.get\('area'\)/.test(src),
  );
  dau(
    'mục tiêu riêng chỉ MƯỢN lĩnh vực, không mang liên kết',
    /const soi = kind === 'academic' \? source_wig_id : null/.test(src),
  );
  const form = readFileSync('components/student/FormMucTieu.tsx', 'utf8');
  dau(
    'form không còn ô chọn lĩnh vực, và không còn lựa chọn để trống',
    !/name="area"/.test(form) && !/noBattle/.test(form) && /pickBattle/.test(form),
  );
} finally {
  if (wigId) {
    await admin.from('wig_so_do').delete().eq('wig_id', wigId);
    // Mượn thì TRẢ, gieo thì XOÁ. Nhầm hai đường này là xoá mất mục tiêu thật của một đứa trẻ.
    if (wigMuon) {
      await admin
        .from('wigs')
        .update({
          measure_by: wigMuon.measure_by,
          unit: wigMuon.unit,
          baseline: wigMuon.baseline,
          target_value: wigMuon.target_value,
        })
        .eq('id', wigMuon.id);
    } else {
      await admin.from('wigs').delete().eq('id', wigId);
    }
  }
  await admin.from('wigs').delete().eq('student_id', em.id).eq('period_label', 'TEST-0108b');
}

for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
const dat = ketQua.filter((k) => k.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
