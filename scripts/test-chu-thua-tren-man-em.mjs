// CHỮ THỪA TRÊN MÀN CỦA EM — dựng thật, soi bằng cookie đăng nhập.
//
// Vì sao phải có: chủ dự án chỉ tận mặt bốn dòng chữ chồng nhau chỉ để giới thiệu MỘT bảng tick,
// cộng ba câu giải thích dài mà em không làm gì được với chúng ("0/3 bạn đã đủ · em góp 2 lượt",
// "trong tuần tick / bỏ tick / tick bù thoải mái…", "Để trống cũng được — xem dòng chữ nghiêng
// bên dưới" + "Chọn việc CON TỰ LÀM ĐƯỢC…"). Xoá khoá trong messages/*.json thì `tsc` vẫn xanh và
// `next build` vẫn xanh — cả hai đều không biết màn hình in ra chữ gì. Chỉ có dựng thật mới biết.
//
// Bài này cũng canh chiều ngược lại: nhãn "Lead Measure" PHẢI có mặt. Bỏ hết chữ mà quên chừa
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

dau('còn nhãn "Lead Measure"', body.includes('Lead Measure'), body.includes('Lead Measure') ? 'có' : 'MẤT NHÃN');

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
  const coTieuDe = body.includes('Mục tiêu riêng của con');
  const coNut = body.includes('Con muốn thêm một mục tiêu của riêng con');
  if ((count ?? 0) === 0) {
    dau(
      'chưa có mục tiêu riêng → chỉ một nút, KHÔNG dựng khối rỗng',
      !coTieuDe && coNut,
      coTieuDe ? 'vẫn còn tiêu đề "Mục tiêu riêng của con" cho một khối rỗng' : coNut ? 'đúng: chỉ có nút' : 'MẤT LUÔN nút mời đặt',
    );
  } else {
    dau('đã có mục tiêu riêng → có tiêu đề của nó', coTieuDe, coTieuDe ? 'có' : 'thiếu tiêu đề');
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
  dau(`messages/${ten}.json: student.leads = Lead Measure`, bo.student?.leads === 'Lead Measure', String(bo.student?.leads));
}

for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}  → ${k.chiTiet}`);
const dat = ketQua.filter((k) => k.dat).length;
console.log(`\n${dat}/${ketQua.length} đạt.`);
process.exit(dat === ketQua.length ? 0 : 1);
