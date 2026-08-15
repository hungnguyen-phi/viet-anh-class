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
// HỌP Ở MỘT TUẦN TƯƠNG LAI, không họp vào tuần đang chạy.
//
// Hai lý do, cái nào cũng đủ: (1) chốt buổi họp là KHOÁ TICK của tuần ấy — chốt nhầm tuần hiện
// tại là cả lớp mất quyền tick mà không hiểu vì sao; (2) trần của CSDL là 2 cam kết mỗi tuần, mà
// tuần đang chạy của lớp thật đã dùng hết — bài sẽ ghi hụt và báo "0/2 cam kết" như thể app hỏng.
// TUẦN CHỌN BẰNG `?hop=`, KHÔNG PHẢI `?week=`.
//
// Trang phòng họp nhận HAI tham số khác nhau: `hop` chọn tuần đang tổng kết, còn `week` chỉ được
// mang theo cho các đường quay về /wig. Gửi nhầm `week` thì trang lặng lẽ dùng tuần mặc định
// (tuần vừa xong) — và bài kiểm tưởng mình đang diễn tập ở một tuần trống, trong khi thật ra nó
// đang ghi vào tuần đang chạy của lớp thật, nơi đã đủ 2 cam kết nên máy chủ từ chối.
const tuanDienTap = (() => {
  const d = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh'}));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 63);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const hop = await fetch(`${BASE}/wig/hop?class=${lop.id}&hop=${tuanDienTap}`, {
  headers: {cookie},
  redirect: 'manual',
});
const html = await hop.text();
dat(hop.status === 200, 'Phòng họp dựng được', `HTTP ${hop.status}`);
if (hop.status !== 200) xong(1);

// 0121: BƯỚC 3 KHÔNG CÒN LÀ "CHỈNH MỐC TUẦN". Mốc tuần đã bỏ; bước 3 nay là đặt CAM KẾT cho
// tuần tới — tối đa hai ô, mỗi ô có một bộ chọn mục tiêu năm để cô gắn cam kết vào đúng trận.
//
// Bản cũ dò `name="moc_target_<uuid>"` và đòi ≥2 mốc, tức đòi một giao diện không còn tồn tại.
// Điều nó sinh ra để canh — "buổi họp không bó cô vào MỘT lĩnh vực" — nay hỏi bằng: có đủ hai ô
// cam kết, và ô chọn mục tiêu liệt kê được nhiều hơn một mục tiêu năm để chọn giữa các lĩnh vực.
const oCamKet = [...new Set([...html.matchAll(/name="ck_(\d+)_title"/g)].map((m) => m[1]))];
const oChonWig = [...new Set([...html.matchAll(/name="ck_(\d+)_wig"/g)].map((m) => m[1]))];
const hopStart = html.match(/name="hop_start" value="(\d{4}-\d{2}-\d{2})"/)?.[1];
dat(
  oCamKet.length >= 2 && oChonWig.length === oCamKet.length,
  'Bước 3 có đủ hai ô cam kết, mỗi ô tự chọn mục tiêu năm (không bó vào một lĩnh vực)',
  `${oCamKet.length} ô cam kết · ${oChonWig.length} ô chọn mục tiêu`,
);
if (oCamKet.length < 2 || !hopStart) xong(1);

// Hai mục tiêu năm KHÁC NHAU để gắn hai cam kết vào — đó chính là "không bó vào một lĩnh vực".
// MỤC TIÊU CUỘN KHÔNG NHẬN CAM KẾT (0121: cam_ket_hop_le). Số của nó đếm ngược từ mục tiêu của
// từng em, nên treo một lời hứa vào đó là hứa với một cái không đếm lời hứa. Lớp thật có cả loại
// này lẫn loại thường — chọn bừa là máy chủ trả "Giá trị nhập không hợp lệ" và bài đọc thành
// "buổi họp không đặt được cam kết nào".
const {data: namLop} = await admin
  .from('wigs')
  .select('id, area, title, measure_by')
  .eq('class_id', lop.id)
  .eq('scope', 'class')
  .eq('period', 'year')
  .neq('measure_by', 'cuon')
  .order('area');
const hai = (namLop ?? []).slice(0, 2);
dat(hai.length >= 1, 'Lớp có mục tiêu năm để gắn cam kết vào', `${(namLop ?? []).length} mục tiêu`);
if (hai.length < 1) xong(1);

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

// ── Gửi HAI CAM KẾT trong MỘT lần bấm ──────────────────────────────────────────────────────
//
// NHÃN TUẦN CHÉP TỪ CHÍNH TRANG, không tự tính. Máy chủ tra ngày từ nhãn (ngayCuaKy) và chỉ nhận
// nhãn nằm trong một cửa sổ quanh hôm nay; tự dựng lại phép đánh số tuần ISO trong bài kiểm là
// thêm một nguồn sự thật thứ hai để lệch. Trang đã in sẵn hai ô ẩn hop_label và dich_label —
// nguyên tắc ở file này từ đầu vẫn là "chép đúng cái React in ra thay vì đoán".
const hopLabel = html.match(/name="hop_label" value="([^"]*)"/)?.[1] ?? '';
const dichLabel = html.match(/name="dich_label" value="([^"]*)"/)?.[1] ?? '';
dat(!!hopLabel && !!dichLabel, 'Chép được nhãn tuần từ chính trang', `${hopLabel} → ${dichLabel}`);
if (!hopLabel || !dichLabel) xong(1);

const dichT2 = (() => {
  const d = new Date(`${hopStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
})();
const tenCk = ['ZZTEST cam kết A', 'ZZTEST cam kết B'];
const bien = '----vacTest' + Math.random().toString(36).slice(2);
const phan = (ten, gt) => `--${bien}\r\nContent-Disposition: form-data; name="${ten}"\r\n\r\n${gt}\r\n`;
let than = truongAction.map(([n, val]) => phan(n, val)).join('') +
  phan('class_id', lop.id) +
  phan('hop_start', hopStart) +
  phan('hop_label', hopLabel) +
  phan('dich_label', dichLabel) +
  phan('chiem_nghiem', '') +
  phan('cam_ket', '');
for (const [i, ten] of tenCk.entries()) {
  than += phan(`ck_${i}_wig`, (hai[i] ?? hai[0]).id);
  than += phan(`ck_${i}_title`, ten);
}
than += `--${bien}--\r\n`;

const dap = await fetch(`${BASE}/wig/hop?class=${lop.id}&hop=${tuanDienTap}`, {
  method: 'POST',
  redirect: 'manual',
  headers: {cookie, origin: BASE, 'Content-Type': `multipart/form-data; boundary=${bien}`},
  body: than,
});
dat(dap.status === 200 || dap.status === 303, 'Máy chủ nhận lệnh kết thúc buổi họp', `HTTP ${dap.status}`);
// Câu máy chủ trả về là thứ duy nhất nói VÌ SAO khi không có gì được ghi.
{
  const than = await dap.text();
  const cau = (than.match(/"error":"[^"]{0,200}"/) ?? than.match(/Xong:[^"<]{0,160}/) ?? [
    '(không đọc được câu báo)',
  ])[0];
  console.log('   máy chủ nói:', cau);
}

const {data: sau} = await admin
  .from('commitments')
  .select('id, title, wig_id')
  .eq('class_id', lop.id)
  .is('student_id', null)
  .eq('week_start', dichT2)
  .in('title', tenCk);
dat(
  (sau ?? []).length === tenCk.length,
  'CẢ HAI cam kết được đặt trong CÙNG một lần bấm',
  `${(sau ?? []).length}/${tenCk.length} cam kết`,
);
dat(
  new Set((sau ?? []).map((c) => c.wig_id)).size === new Set(hai.map((w) => w.id)).size,
  '… và mỗi cam kết gắn vào đúng mục tiêu năm đã chọn',
  `${new Set((sau ?? []).map((c) => c.wig_id)).size} mục tiêu khác nhau`,
);

// Dọn — bài kiểm chạy trên dữ liệu thật, không được để lại dấu vết. Xoá cam kết là việc dẫn dắt
// treo dưới nó đi theo bằng CASCADE (xem scripts/test-xoa-wig-ba-tang.mjs).
for (const c of sau ?? []) await admin.from('commitments').delete().eq('id', c.id);
await admin
  .from('wig_meetings')
  .delete()
  .eq('class_id', lop.id)
  .eq('week_start', hopStart)
  .is('student_id', null);

// Phép xoá cây 3 tầng nằm ở scripts/test-xoa-wig-ba-tang.mjs — nó dựng cây giả rồi xoá thật,
// đo được đúng cái deleteWig làm, thay vì chỉ đoán qua hình dạng dữ liệu đang có.
xong();
