// CHỮ THỪA TRÊN MÀN CỦA EM — dựng thật, soi bằng cookie đăng nhập.
//
// Vì sao phải có: chủ dự án chỉ tận mặt bốn dòng chữ chồng nhau chỉ để giới thiệu MỘT bảng tick,
// cộng ba câu giải thích dài mà em không làm gì được với chúng ("0/3 bạn đã đủ · em góp 2 lượt",
// "trong tuần tick / bỏ tick / tick bù thoải mái…", "Để trống cũng được — xem dòng chữ nghiêng
// bên dưới" + "Chọn việc CON TỰ LÀM ĐƯỢC…"). Xoá khoá trong messages/*.json thì `tsc` vẫn xanh và
// `next build` vẫn xanh — cả hai đều không biết màn hình in ra chữ gì. Chỉ có dựng thật mới biết.
//
// Bài này cũng canh chiều ngược lại: KHỐI TICK PHẢI CÒN TIÊU ĐỀ. Bỏ hết chữ mà quên chừa
// nhãn thì bảng tick thành một đống thẻ không tên.
//
// Cách dùng — mở `npm run dev` trước, rồi:
//   node scripts/test-chu-thua-tren-man-em.mjs [http://localhost:6880]
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

const HS = 'test1.hs@student.truongvietanh.com';

// Bỏ <script> trước khi soi: dữ liệu RSC nằm trong thẻ script mang nguyên văn mọi chuỗi i18n của
// client component, kể cả chuỗi KHÔNG được vẽ ra. Soi cả trang thì bài này đỏ vĩnh viễn.
const boScript = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '');

// Từng mẩu chữ phải BIẾN MẤT khỏi màn hình. Lấy đoạn đủ dài để không đụng nhầm chữ khác, và
// tránh dấu nháy cong / dấu chấm cuối câu vì chúng hay bị đổi khi soạn lại.
const PHAI_MAT = [
  ['câu phụ lặp lại nửa sau tiêu đề', 'Việc của em'],
  ['tiêu đề thứ hai của bảng tick', 'mỗi bạn phải tự làm đủ phần của mình'],
  ['bản tường thuật "bạn đã đủ"', 'bạn đã đủ'],
  ['bản tường thuật "em góp"', 'em góp'],
  ['luật khoá tick', 'tick bù các ngày đã qua thoải mái'],
];

const ketQua = [];
const dau = (ten, dat, chiTiet) => ketQua.push({ten, dat, chiTiet});

const cHS = await ck(HS);
const r = await fetch(BASE + '/student', {headers: {cookie: cHS}, redirect: 'manual'});
const body = boScript(await r.text());

dau('/student dựng được', r.status === 200, `HTTP ${r.status}, ${Math.round(body.length / 1024)} KB`);

for (const [ten, chuoi] of PHAI_MAT) {
  dau(`đã bỏ: ${ten}`, !body.includes(chuoi), body.includes(chuoi) ? `còn thấy "${chuoi}"` : 'sạch');
}

// Nhãn LẤY TỪ GÓI DỊCH, không viết cứng. Bản cũ chốt chết chuỗi 'Lead Measure', nên hôm chủ dự
// án cho cắt tiếng lóng tiếng Anh khỏi màn trẻ con (13/08, 'tám chỗ nói sai') bộ kiểm quay ra tố
// cáo chính quyết định ấy. Điều đáng canh là KHỐI TICK CÒN TIÊU ĐỀ — không phải nó tên gì.
// 16/08/2026 — khối tick KHÔNG CÒN đứng riêng: việc để tick nằm TRONG thẻ mục tiêu năm (cây mục
// tiêu → cam kết → việc). Nên phép canh nay đảo: KHÔNG được có tiêu đề "Việc làm đều" đứng lẻ, và
// tiêu đề "Mục tiêu năm của bạn" phải có (thẻ là chỗ duy nhất của việc).
const goiViDau = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
const nhanTick = goiViDau.student?.leads;
const nhanCay = goiViDau.student?.wigYear;
dau('việc để tick nằm trong thẻ mục tiêu — không còn khối "Việc làm đều" đứng riêng',
    Boolean(nhanCay) && body.includes(nhanCay) && !(nhanTick && body.includes(nhanTick)),
    nhanTick && body.includes(nhanTick) ? `CÒN KHỐI RIÊNG "${nhanTick}"` : `cây "${nhanCay}" có mặt`);

// ── KHỐI MỤC TIÊU RIÊNG: CHƯA ĐẶT THÌ CHỈ LÀ MỘT NÚT ──────────────────────────────────────────
// Bản trước dựng đủ bộ khung cho cái chưa tồn tại — cũng biểu tượng đích, cũng tiêu đề mở đầu bằng
// "Mục tiêu … của con", cũng nút vàng — nên em chưa đặt gì thì màn hình có hai khối trông như nhau
// nằm chồng, khối dưới rỗng. Hỏi thẳng CSDL rồi mới xét, đừng đóng đinh vào việc em này đang có
// hay không có mục tiêu riêng: hôm nào dữ liệu đổi là bài kiểm đỏ oan.
{
  const {data: em} = await admin
    .from('profiles')
    .select('id')
    .eq('email', HS)
    .maybeSingle();
  const {count} = await admin
    .from('wigs')
    .select('id', {count: 'exact', head: true})
    .eq('student_id', em?.id ?? '')
    .eq('scope', 'student')
    .eq('kind', 'personal');
  // NHÃN ĐỌC TỪ GÓI DỊCH. Hai chuỗi này từng viết cứng theo cách xưng "của con"; màn hình nay gọi
  // em bằng "bạn", nên bản cũ báo MẤT NÚT trong khi nút vẫn ở đó. Điều canh ở đây là có/không có
  // khối và nút, không phải app gọi em bằng gì.
  const goiVi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
  // 18/08/2026 (PRD v3 4.2): BỐN Ô CỐ ĐỊNH theo 4 domain — thay cho một nút "Thêm mục tiêu"
  // chung. Ô có WIG là thẻ; ô trống là chỗ đặt (với chính em) hoặc "Chưa đặt" (người xem khác).
  // Nên điều canh nay là: cả BỐN nhãn domain phải có mặt trên màn, và tiêu đề "Mục tiêu riêng"
  // của thời hai-khối không quay lại.
  const nhanTieuDeRieng = 'Mục tiêu riêng'; // khoá goal.titlePersonal đã xoá — canh chữ cũ không quay lại
  const coTieuDe = body.includes(nhanTieuDeRieng);
  dau('không còn tiêu đề "Mục tiêu riêng" của thời hai khối', !coTieuDe);
  {
    const {data: nhanRows} = await admin.from('area_config').select('label_vi');
    const thieu = (nhanRows ?? []).map((r) => r.label_vi).filter((nhan) => !body.includes(nhan));
    dau('đủ 4 ô domain trên màn của em (kể cả ô chưa đặt)', thieu.length === 0, thieu.join(', ') || 'đủ');
  }
}

// Form đặt mục tiêu là client component, chỉ dựng khi em bấm nút — không soi được bằng HTML đầu
// tiên. Soi thẳng bó dịch: hai câu ấy phải không còn tồn tại để không đường nào in ra được.
const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));
for (const [ten, bo] of [
  ['vi', vi],
  ['en', en],
]) {
  const con = ['workOptional', 'leadRule', 'tickWeekOpen', 'classDone', 'myContrib', 'leadsHint']
    .filter((k) => JSON.stringify(bo).includes(`"${k}"`));
  dau(`messages/${ten}.json không còn khoá chữ thừa`, con.length === 0, con.join(', ') || 'sạch');
  // Chỉ đòi khoá CÓ MẶT và không rỗng. Đòi nó bằng đúng một chuỗi là biến bộ kiểm thành cái khoá
  // tay chủ dự án mỗi lần muốn sửa chữ.
  // student.leads đã xoá 16/08/2026 (khối tick không còn đứng riêng); nhãn cây là student.wigYear.
  dau(`messages/${ten}.json: student.wigYear có nhãn`,
      Boolean(bo.student?.wigYear?.trim()), String(bo.student?.wigYear));
}

for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}  → ${k.chiTiet}`);
const dat = ketQua.filter((k) => k.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
