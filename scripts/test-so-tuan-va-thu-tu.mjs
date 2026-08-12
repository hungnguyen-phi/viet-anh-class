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

const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: hs.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

const r = await fetch(BASE + '/student', {headers: {cookie}, redirect: 'manual'});
const html = await r.text();
dat(r.status === 200, 'trang dựng được', `HTTP ${r.status}`);

if (r.status === 200) {
  // Bỏ <script> trước khi soi CHỮ: gói chuỗi i18n của next-intl nằm trong đó, tìm vào HTML thô là
  // gặp chữ chưa hề hiện lên màn hình — cái bẫy đã báo xanh giả hôm 12/08.
  const hien = html.replace(/<script[\s\S]*?<\/script>/g, '');

  // ── THỨ TỰ. So VỊ TRÍ chứ không chỉ so có/không: cả ba khối đều tồn tại từ trước, cái đổi là
  // chúng đứng đâu. Mốc lấy tiêu đề khối tick ("Việc của con tuần này") và tiêu đề hai nửa thẻ.
  const viTri = (re) => hien.search(re);
  const oTick = viTri(/Việc của em — tick mỗi ngày/);
  const oMucTieu = viTri(/Mục tiêu của con/);
  const oSo = viTri(/Sổ của con/);
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
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
