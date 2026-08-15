// TICK LÊN ĐẦU, SỔ PHẢI NÓI RÕ TUẦN NÀO — dựng thật trang của một em rồi soi HTML.
//
// Vì sao có file này: chủ dự án chốt 12/08/2026 ba việc trên màn của em — (1) ô tick phải đứng
// TRƯỚC "mục tiêu của con"/"sổ của con" để vào phát là tick được ngay; (2) sổ phải nói rõ nó là
// sổ của TUẦN NÀO, bao giờ sang trang, và đọc lại tuần trước ở đâu; (3) mục tiêu phải lộ ra là
// mục tiêu CẢ NĂM HỌC. Cả ba đều là chuyện THỨ TỰ và CHỮ TRÊN MÀN — tsc và next build không nói
// được gì về chúng, nên phải dựng trang thật bằng cookie đăng nhập rồi so vị trí trong HTML.
//
//   node scripts/test-so-tuan-va-thu-tu.mjs [BASE]     mặc định http://localhost:3000
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:3000';
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

// Lấy một em ĐANG HỌC bất kỳ — bám cứng một id là bài kiểm chết theo dữ liệu.
const {data: em} = await admin
  .from('enrollments')
  .select('student_id, class_id')
  .eq('is_active', true)
  .limit(1)
  .single();
const {data: hs} = await admin.from('profiles').select('email').eq('id', em.student_id).single();
const {data: lop} = await admin
  .from('classes')
  .select('homeroom_teacher_id')
  .eq('id', em.class_id)
  .single();
const {data: gv} = await admin
  .from('profiles')
  .select('email')
  .eq('id', lop.homeroom_teacher_id)
  .single();

const cookieCua = async (email) => {
  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
};
const dung = async (email, duong) => {
  const r = await fetch(BASE + duong, {headers: {cookie: await cookieCua(email)}, redirect: 'manual'});
  return {st: r.status, html: await r.text()};
};

// ── GIEO BA TUẦN SỔ ──────────────────────────────────────────────────────────────────────────
// Lịch sử chỉ chứng minh được khi CÓ lịch sử. Em thật trong CSDL có thể chưa viết dòng nào, lúc
// ấy phần "các tuần trước" rỗng và bài kiểm xanh mà chẳng chứng minh gì. Nên tự gieo tuần này +
// hai tuần trước, mang dấu ZZTEST để nhận ra, và dọn sạch ở cuối dù đạt hay không.
const homNay = new Date();
const dow = (homNay.getUTCDay() + 6) % 7;
const thuHai = new Date(
  Date.UTC(homNay.getUTCFullYear(), homNay.getUTCMonth(), homNay.getUTCDate() - dow),
);
const isoNgay = (d) => d.toISOString().slice(0, 10);
const tuanGieo = [0, 1, 2].map((k) => isoNgay(new Date(thuHai.getTime() - k * 7 * 86400000)));
const dauVet = tuanGieo.map((w, i) => `ZZTEST-so-tuan-${i}-${w}`);
for (const [i, w] of tuanGieo.entries())
  await admin
    .from('student_reflections')
    .upsert(
      {student_id: em.student_id, class_id: em.class_id, week_start: w, body: dauVet[i]},
      {onConflict: 'student_id,week_start'},
    );
const don = async () => {
  for (const w of tuanGieo)
    await admin
      .from('student_reflections')
      .delete()
      .eq('student_id', em.student_id)
      .eq('week_start', w);
};

const {st, html} = await dung(hs.email, '/student');
const r = {status: st};
dat(r.status === 200, 'trang dựng được', `HTTP ${r.status}`);

if (r.status === 200) {
  // Bỏ <script> trước khi soi CHỮ: gói chuỗi i18n của next-intl nằm trong đó, tìm vào HTML thô là
  // gặp chữ chưa hề hiện lên màn hình — cái bẫy đã báo xanh giả hôm 12/08.
  const hien = html.replace(/<script[\s\S]*?<\/script>/g, '');

  // ── THỨ TỰ. So VỊ TRÍ chứ không chỉ so có/không: cả ba khối đều tồn tại từ trước, cái đổi là
  // chúng đứng đâu. Mốc lấy tiêu đề khối tick và tiêu đề hai nửa thẻ.
  // Tiêu đề khối tick ĐỌC TỪ GÓI DỊCH. 13/08/2026 chủ dự án cắt bốn dòng chữ giới thiệu còn một,
  // rồi sau đó đổi luôn nhãn tiếng Anh sang tiếng Việt — viết cứng chuỗi ở đây thì mỗi lần sửa
  // chữ là một phép kiểm đỏ oan, mà thứ cần canh là THỨ TỰ ba khối, không phải tên chúng.
  const viTri = (re) => hien.search(re);
  const thoat = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const goi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
  const moc = (chuoi) => (chuoi ? viTri(new RegExp(thoat(chuoi))) : -1);
  const nhanTick = goi.student?.leads;
  // Hai nhãn này từng viết cứng là "Mục tiêu của con" / "Sổ của con". Màn hình nay gọi em bằng
  // "bạn", nên bản cũ báo mất cả hai khối trong khi chúng vẫn ở đó — bộ kiểm tố cáo một thay đổi
  // chữ có chủ ý. Thứ bài này canh là THỨ TỰ ba khối, nên nhãn phải lấy từ đúng nơi màn hình lấy.
  const oTick = moc(nhanTick);
  const oMucTieu = moc(goi.goal?.title);
  const oSo = moc(goi.goal?.journal);
  dat(oTick >= 0, 'có khối việc để tick');
  dat(oMucTieu >= 0, 'có khối "Mục tiêu của con"');
  dat(oSo >= 0, 'có khối "Sổ của con"');
  if (oTick >= 0 && oMucTieu >= 0)
    dat(oTick < oMucTieu, 'ô tick đứng TRƯỚC "Mục tiêu của con"', `${oTick} < ${oMucTieu}`);
  if (oTick >= 0 && oSo >= 0)
    dat(oTick < oSo, 'ô tick đứng TRƯỚC "Sổ của con"', `${oTick} < ${oSo}`);

  // Hai nửa nằm trong CÙNG một thẻ: giữa chúng không được có tiêu đề khối nào khác chen vào.
  if (oMucTieu >= 0 && oSo >= 0) {
    const giua = hien.slice(oMucTieu, oSo);
    dat(!/<h2[\s>]/.test(giua), '"Mục tiêu" và "Sổ" nằm chung một thẻ (không có <h2> chen giữa)');
  }

  // ── SỔ NÓI RÕ TUẦN NÀO. Nhãn "Tuần này: dd/mm–dd/mm" là thứ trước đây hoàn toàn không có.
  dat(/Tuần này: \d\d\/\d\d–\d\d\/\d\d/.test(hien), 'sổ có nhãn tuần kèm ngày đầu–cuối');
  // Đường đọc lại tuần trước phải CÓ MẶT. Nội dung lịch sử nằm trong hộp thoại (chỉ dựng khi bấm),
  // nên canh cái nút mở sổ — không có nó thì không có đường nào tới lịch sử.
  dat(
    /Viết vào sổ|Viết tiếp \/ sửa|Mở sổ đọc/.test(hien),
    'sổ có nút mở (đường duy nhất tới lịch sử các tuần)',
  );

  // ── MỤC TIÊU LỘ RA LÀ MỤC TIÊU CẢ NĂM. luuMucTieuCuaEm ghi period='year' từ 0100, nhưng màn
  // hình cũ không nói, nên nhìn vào tưởng mục tiêu ngắn hạn.
  dat(/cả năm học \d{4}/.test(hien), 'mục tiêu ghi rõ phạm vi cả năm học');

  // Không còn hai thẻ lớn riêng ở đầu trang: nếu "Mục tiêu của con" vẫn là <h2> thì nó chưa được
  // hạ thành nửa thẻ nhỏ.
  dat(
    !/<h2[^>]*>\s*(?:<[^>]+>\s*)*Mục tiêu của con/.test(hien),
    '"Mục tiêu của con" không còn là tiêu đề khối lớn (<h2>)',
  );

  // ── NHÃN TUẦN PHẢI TRỎ ĐÚNG TUẦN SERVER GHI VÀO ────────────────────────────────────────────
  // Nhãn tính từ weekDaysVN(todayInVN()), còn luuSoCuaCon ghi theo weekRangeVN() — HAI đường
  // tính khác nhau cho cùng một khái niệm "tuần này". Hôm nay chúng khớp, nhưng không có gì
  // buộc chúng khớp mãi, và lệch một ngày thì em viết vào tuần A mà màn hình dán nhãn tuần B.
  // So thẳng nhãn với thứ Hai của tuần chứa dòng em vừa ghi.
  const nhan = hien.match(/Tuần này: (\d\d)\/(\d\d)–/);
  dat(Boolean(nhan), 'đọc được nhãn tuần trên thẻ');
  if (nhan)
    dat(
      `${nhan[2]}` === tuanGieo[0].slice(5, 7) && `${nhan[1]}` === tuanGieo[0].slice(8, 10),
      'nhãn tuần trỏ ĐÚNG tuần mà server ghi vào',
      `nhãn ${nhan[1]}/${nhan[2]} vs week_start ${tuanGieo[0]}`,
    );

  // ── LỊCH SỬ THẬT SỰ TỚI ĐƯỢC MÀN HÌNH ──────────────────────────────────────────────────────
  // Có nút mở sổ chưa chứng minh chữ tuần trước đi tới nơi: hộp thoại dựng ở client, dữ liệu
  // phải nằm sẵn trong trang. Cả ba tuần vừa gieo phải có mặt trong HTML.
  for (const [i, d] of dauVet.entries())
    dat(html.includes(d), `chữ của tuần ${i === 0 ? 'này' : `trước ${i}`} có trong trang của em`);
}

// ── NGƯỜI LỚN: ĐỌC ĐƯỢC, KHÔNG VIẾT ĐƯỢC ─────────────────────────────────────────────────────
// Sổ là chỗ DUY NHẤT trong cả mô hình mà người lớn không có quyền ghi (rls_write_student_
// reflections, 0100). Thẻ mới đổi ô nhập thành nút mở hộp thoại — dễ lỡ tay cho cả GVCN thấy
// nút viết, mà lúc ấy cô bấm vào sẽ bị CSDL từ chối, còn khó hiểu hơn là không có nút.
const cg = await dung(gv.email, `/student/${em.student_id}`);
const hienGV = cg.html.replace(/<script[\s\S]*?<\/script>/g, '');
dat(cg.st === 200, '[GVCN] trang của em dựng được', `HTTP ${cg.st}`);
dat(dauVet.every((d) => cg.html.includes(d)), '[GVCN] đọc được cả sổ tuần này lẫn các tuần trước');
dat(!/Viết vào sổ|Viết tiếp \/ sửa/.test(hienGV), '[GVCN] KHÔNG có nút viết vào sổ');
dat(/Mở sổ đọc/.test(hienGV), '[GVCN] có nút mở sổ để đọc');

// ── KHÔNG RÒ SANG EM KHÁC ────────────────────────────────────────────────────────────────────
// Cuốn sổ là chữ riêng của một đứa trẻ. Lấy 20 tuần thay vì 1 dòng nghĩa là mỗi lần mở trang nay
// mang nhiều dữ liệu hơn hẳn — càng phải chứng minh nó không sang được màn của người ngoài.
const {data: khac} = await admin
  .from('enrollments')
  .select('student_id')
  .eq('is_active', true)
  .neq('class_id', em.class_id)
  .limit(1)
  .maybeSingle();
if (khac) {
  const {data: hs2} = await admin.from('profiles').select('email').eq('id', khac.student_id).single();
  const ck = await dung(hs2.email, `/student/${em.student_id}`);
  dat(
    !dauVet.some((d) => ck.html.includes(d)),
    'em lớp khác KHÔNG đọc được sổ của em này',
    `HTTP ${ck.st}`,
  );
}

await don();

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
