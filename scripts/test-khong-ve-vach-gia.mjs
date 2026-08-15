// APP KHÔNG ĐƯỢC NÓI DỐI — đích `manual` thì KHÔNG có vạch tiến độ.
//
// Vì sao có file này: §5.0 docs/MO_HINH_WIG.md chia đích làm hai loại. `tick` là con số app tự
// đếm từ lượt tick của các em — vẽ vạch được, vạch ấy có thật. `manual` là con số sống NGOÀI app
// (điểm trung bình môn, kết quả kỳ thi); app không đếm được nó, nên actual luôn là 0 và mọi vạch
// nó vẽ ra đều là bịa. Trước 0106 màn /wig vẽ vạch cho cả hai: một mục tiêu "Điểm TB Toán 6,5 →
// 8,0" hiện ra là một thanh xám 0% — giáo viên đọc thành "cả lớp chưa làm được gì", trong khi
// thật ra app chỉ đang không biết.
//
// Đây là chuyện HTML thật của một trang dynamic; tsc và next build không nói được gì về nó.
//
//   node scripts/test-khong-ve-vach-gia.mjs [BASE]     mặc định http://localhost:3000
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

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// Lớp CÓ GVCN — trang /wig dựng theo lớp của cô, không có cô thì không có ai để đăng nhập.
const {data: lop} = await admin
  .from('classes')
  .select('id, name, school_year, homeroom_teacher_id')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .limit(1)
  .single();
const {data: gv} = await admin
  .from('profiles')
  .select('email')
  .eq('id', lop.homeroom_teacher_id)
  .single();

// ── GIEO HAI MỤC TIÊU NĂM CẠNH NHAU ─────────────────────────────────────────────────────────
// Hai lĩnh vực khác nhau (wigs_lop_ky_uidx chặn trùng lĩnh vực trong cùng kỳ), một manual một
// tick, cùng nhãn kỳ. Cạnh nhau mới chứng minh được: chỉ khẳng định "không có vạch nào" thì một
// trang hỏng toàn tập cũng xanh.
const homNay = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const dau = iso(homNay);
const cuoi = iso(new Date(homNay.getTime() + 200 * 86400000));
const KY = 'ZZTEST-vach';
const tenManual = 'ZZTEST diem TB Toan (ngoai app)';
const tenTick = 'ZZTEST so bai doc (may dem)';

// Dọn trước, phòng lần chạy trước chết giữa chừng.
const don = async () => {
  await admin.from('wigs').delete().eq('class_id', lop.id).eq('period_label', KY);
};
await don();

const gieo = async (area, title, measure_by) => {
  const {data, error} = await admin
    .from('wigs')
    .insert({
      class_id: lop.id,
      scope: 'class',
      status: 'approved',
      measure_by,
      area,
      period: 'year',
      period_label: KY,
      title,
      baseline: 0,
      target_value: 100,
      unit: 'diem',
      start_date: dau,
      end_date: cuoi,
    })
    .select('id')
    .single();
  if (error) throw new Error(`gieo ${measure_by}: ${error.message}`);
  return data.id;
};
let idManual, idTick;
try {
  idManual = await gieo('knowledge', tenManual, 'manual');
  idTick = await gieo('skills', tenTick, 'tick');
} catch (e) {
  console.log('SAI  không gieo được dữ liệu thử —', e.message);
  await don();
  process.exit(1);
}
dat(Boolean(idManual && idTick), 'gieo được một mục tiêu manual và một mục tiêu tick');

const cookieCua = async (email) => {
  const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
};

const r = await fetch(`${BASE}/wig?class=${lop.id}`, {
  headers: {cookie: await cookieCua(gv.email)},
  redirect: 'manual',
});
const html = await r.text();
dat(r.status === 200, 'trang /wig dựng được', `HTTP ${r.status}`);

if (r.status === 200) {
  // Bỏ <script>: gói chuỗi i18n của next-intl nằm trong đó, tìm vào HTML thô là gặp chữ chưa hề
  // hiện lên màn hình.
  const hien = html.replace(/<script[\s\S]*?<\/script>/g, '');

  // Khối HTML của MỘT dòng tiến độ. Mốc cắt là chỗ tên mục tiêu ĐƯỢC IN RA, tức `>Tên<` — không
  // phải lần xuất hiện đầu tiên trong HTML: tên còn nằm trong aria-label của nút Sửa và nút Xoá
  // phía trên, và cắt từ đó thì cửa sổ 500 ký tự chỉ toàn <svg> của hai cái nút.
  const khoi = (ten) => {
    const i = hien.indexOf(`>${ten}<`);
    return i < 0 ? null : hien.slice(i, i + 500);
  };
  const kManual = khoi(tenManual);
  const kTick = khoi(tenTick);
  dat(Boolean(kManual), 'mục tiêu manual có mặt trên trang');
  dat(Boolean(kTick), 'mục tiêu tick có mặt trên trang');

  // Vạch tiến độ nhận ra bằng chính cái làm nên nó: một div đặt width theo phần trăm.
  const coVach = (s) => /width:\s*\d+(\.\d+)?%/.test(s);

  if (kManual) {
    dat(!coVach(kManual), 'manual: KHÔNG vẽ vạch tiến độ');
    dat(
      /Theo dõi ở ngoài app/.test(kManual),
      'manual: nói rõ con số này ghi nhận ngoài app',
    );
    dat(/Chưa đạt|Đã đạt/.test(kManual), 'manual: chỉ nói Đạt / Chưa đạt');
    // "0 / 100" là đúng cái lời nói dối cũ: app khoe một con số nó không hề đo.
    dat(!/0\s*\/\s*100/.test(kManual), 'manual: KHÔNG khoe "0 / 100"');
  }
  if (kTick) {
    dat(coVach(kTick), 'tick: VẪN có vạch tiến độ (không vạ lây)');
    dat(/\d+\s*\/\s*100/.test(kTick), 'tick: vẫn hiện "đã được / mục tiêu"');
  }
}

await don();

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
