// PHÒNG HỌP LƯU ĐỦ MỌI LĨNH VỰC — VÀ XOÁ MỤC TIÊU NĂM CÓ ĐỨT KHÔNG.
//
// Vì sao có file này: bước 3 của phòng họp trước đây chỉ chỉnh được MỘT lĩnh vực (một <select>),
// nay hiện đủ 4. Nhìn HTML thấy đủ 4 khối KHÔNG chứng minh bấm Lưu thì cả 4 cùng ghi — đúng cái
// bẫy "tsc sạch, build sạch, trang vẫn hỏng" đã ghi trong bài học của dự án.
//
// Bài này gọi THẲNG server action ketThucBuoiHop như trình duyệt gọi, gửi moc_target_<id> cho
// MỌI mốc đang có, rồi đọc lại CSDL xem cả bốn có đổi không.
//
// Kèm luôn một phép kiểm cho deleteWig: cây WIG nay sâu 3 tầng (năm→tháng→tuần) nhưng hàm xoá chỉ
// gỡ một tầng con, nên xoá mục tiêu năm là đứt giữa chừng.
//
//   node scripts/test-hop-du-linh-vuc.mjs [BASE]     mặc định http://localhost:3000
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
const xong = (ma = 0) => {
  for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
  const so = kq.filter((k) => k.ok).length;
  console.log(`\n${so}/${kq.length} đạt.`);
  process.exit(ma || (so === kq.length ? 0 : 1));
};

// 0121: KHÔNG CÒN MỐC TUẦN. Mục tiêu chỉ còn cấp NĂM, việc theo tuần nằm ở CAM KẾT. Bản cũ tìm
// `period='week'` nên không thấy gì và vỡ ở dòng dưới — đọc thành app hỏng, thật ra là mô hình đã
// đổi. Lấy lớp CÓ mục tiêu năm, rồi mượn phiên của chính GVCN lớp ấy.
// Không bám cứng vào một email: lớp nào có dữ liệu là chạy lớp đó, và bám cứng thì bài kiểm xanh
// giả ở một lớp trống — đúng cái bẫy đã ghi trong test-man-wig-that.mjs.
const {data: nam0} = await admin
  .from('wigs')
  .select('class_id')
  .eq('scope', 'class')
  .eq('period', 'year')
  .limit(1)
  .single();
const {data: lop} = await admin
  .from('classes')
  .select('id, name, homeroom_teacher_id')
  .eq('id', nam0.class_id)
  .single();
const {data: gv} = await admin
  .from('profiles')
  .select('email, id')
  .eq('id', lop.homeroom_teacher_id)
  .single();
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

// ── Tuần phòng họp đang tổng kết = tuần vừa xong; mốc cần chỉnh là tuần TỚI ────────────────
const hop = await fetch(`${BASE}/wig/hop?class=${lop.id}`, {headers: {cookie}, redirect: 'manual'});
const html = await hop.text();
dat(hop.status === 200, 'Phòng họp dựng được', `HTTP ${hop.status}`);
if (hop.status !== 200) xong(1);

const mocIds = [...new Set([...html.matchAll(/name="moc_target_([0-9a-f-]{36})"/g)].map((m) => m[1]))];
const hopStart = html.match(/name="hop_start" value="(\d{4}-\d{2}-\d{2})"/)?.[1];
dat(mocIds.length >= 2, 'Bước 3 hiện mốc của NHIỀU lĩnh vực, không phải một', `${mocIds.length} mốc`);
if (mocIds.length < 2 || !hopStart) xong(1);

const {data: truoc} = await admin.from('wigs').select('id, area, target_value').in('id', mocIds);
const cu = new Map(truoc.map((w) => [w.id, Number(w.target_value)]));

// ── Mã action + cách mã hoá lấy THẲNG từ HTML mà React đã in ra ───────────────────────────
//
// ketThucBuoiHop chạy qua useActionState nên tham số đầu là prevState, formData là tham số THỨ
// HAI. Lối mã hoá "$ACTION_ID_<mã>" (dùng được cho action một tham số) đẩy formData vào đúng chỗ
// prevState và server ném TypeError ngay dòng đầu. React biết chuyện đó nên in sẵn ra HTML một bộ
// trường $ACTION_REF_1 / $ACTION_1:0 / $ACTION_1:1 mang prevState đã buộc — chép đúng bộ ấy thay
// vì tự đoán định dạng nội bộ của React.
const truongAction = [...html.matchAll(/<input type="hidden" name="(\$[^"]+)"(?: value="([^"]*)")?\/>/g)].map(
  (m) => [m[1], (m[2] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')],
);
const maAction = truongAction.find(([n]) => n.endsWith(':0'))?.[1]?.match(/"id":"([0-9a-f]+)"/)?.[1] ?? null;
dat(
  !!maAction && truongAction.some(([n]) => n.startsWith('$ACTION_REF')),
  'Đọc được mã + prevState của ketThucBuoiHop từ chính HTML',
  maAction ?? `chỉ thấy ${truongAction.length} trường`,
);
if (!maAction) xong(1);

// ── Gửi chỉ tiêu MỚI cho TẤT CẢ các mốc trong một lần bấm ──────────────────────────────────
const moi = new Map(mocIds.map((id, i) => [id, 111 + i]));
const bien = '----vacTest' + Math.random().toString(36).slice(2);
const phan = (ten, gt) => `--${bien}\r\nContent-Disposition: form-data; name="${ten}"\r\n\r\n${gt}\r\n`;
let than = truongAction.map(([n, val]) => phan(n, val)).join('') +
  phan('class_id', lop.id) +
  phan('hop_start', hopStart) +
  phan('hop_label', 'kiem-tu-dong') +
  phan('dich_label', 'kiem-tu-dong') +
  phan('chiem_nghiem', '') +
  phan('cam_ket', '');
for (const [id, t] of moi) than += phan(`moc_target_${id}`, String(t));
than += `--${bien}--\r\n`;

const dap = await fetch(`${BASE}/wig/hop?class=${lop.id}`, {
  method: 'POST',
  redirect: 'manual',
  headers: {cookie, origin: BASE, 'Content-Type': `multipart/form-data; boundary=${bien}`},
  body: than,
});
dat(dap.status === 200 || dap.status === 303, 'Máy chủ nhận lệnh kết thúc buổi họp', `HTTP ${dap.status}`);

const {data: sau} = await admin.from('wigs').select('id, area, target_value').in('id', mocIds);
const doiDung = sau.filter((w) => Number(w.target_value) === moi.get(w.id));
dat(
  doiDung.length === mocIds.length,
  'MỌI lĩnh vực đều được ghi chỉ tiêu mới trong CÙNG một lần bấm',
  `${doiDung.length}/${mocIds.length} mốc đổi đúng`,
);

// Trả lại như cũ — bài kiểm chạy trên dữ liệu thật, không được để lại dấu vết.
for (const [id, t] of cu) await admin.from('wigs').update({target_value: t}).eq('id', id);

// Phép xoá cây 3 tầng nằm ở scripts/test-xoa-wig-ba-tang.mjs — nó dựng cây giả rồi xoá thật,
// đo được đúng cái deleteWig làm, thay vì chỉ đoán qua hình dạng dữ liệu đang có.
xong();
