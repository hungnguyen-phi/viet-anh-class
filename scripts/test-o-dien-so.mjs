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
// Lấy đúng dòng "x/30 lead" trên thẻ việc, để khi SAI thì báo con số thật chứ không báo suông.
//
// PHẢI BÓC THẺ VÀ CHÚ THÍCH TRƯỚC. React in ba mảnh số/gạch/số thành ba nút văn bản rời, nên
// trong HTML nó là `10<!-- -->/<!-- -->30<!-- --> <!-- -->lead` — dò thẳng chuỗi "10/30" trên HTML
// thô thì không bao giờ khớp, và phép kiểm sẽ đỏ vì lý do sai.
const chuThuan = (dom) => dom.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const timSo = (dom) =>
  (chuThuan(dom).match(/\d+(?:[.,]\d+)?\s*\/\s*30 lead/) ?? [])[0] ?? 'không thấy dòng x/30 lead';
function xong(ma) {
  for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
  const d = ketQua.filter((k) => k.dat).length;
  console.log(`\n${d}/${ketQua.length} đạt.`);
  process.exit(ma ?? (d === ketQua.length ? 0 : 1));
}


// KHÔNG CÒN EM NÀO TRỐNG THÌ DỰNG LẤY MỘT EM, ĐỪNG BỎ QUA.
//
// Từ đợt gieo lại dữ liệu lớp Test, MỌI tài khoản test đều đã có mục tiêu năm, nên bài này dừng
// ngay ở câu "không thử mà không phá dữ liệu được" — đúng mực, nhưng kết quả là một phép kiểm
// vĩnh viễn không chạy. Nay tự tạo một tài khoản học sinh tạm, xếp vào lớp, đo xong XOÁ SẠCH.
// Đi qua auth.users để trigger handle_new_user cấp vai y như người thật đăng nhập lần đầu.
let emTam = null; // {id, email, classId} — có giá trị thì phải dọn ở finally
async function dungEmTam() {
  const {data: lop} = await admin
    .from('enrollments')
    .select('class_id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!lop) return null;
  const id = crypto.randomUUID();
  const email = `kiem.tam.${id.slice(0, 8)}@student.truongvietanh.com`;
  const {error} = await admin.auth.admin.createUser({
    id,
    email,
    email_confirm: true,
    user_metadata: {full_name: 'Em Kiểm Tạm'},
  });
  if (error) return null;
  const {error: e2} = await admin
    .from('enrollments')
    .insert({student_id: id, class_id: lop.class_id, is_active: true});
  if (e2) {
    await admin.auth.admin.deleteUser(id);
    return null;
  }
  return {id, email, classId: lop.class_id};
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
if (!em) {
  emTam = await dungEmTam();
  if (!emTam) { dau('Có em chưa đặt mục tiêu để thử', false, 'không dựng nổi em tạm'); xong(1); }
  em = emTam.id; enr = emTam.classId; HS = emTam.email;
}
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
// IN NGÀY THEO ĐÚNG LỊCH VN, KHÔNG QUA toISOString().
//
// `new Date(...toLocaleString('Asia/Ho_Chi_Minh'))` cho một Date mang giờ VN nhưng được máy đọc
// như giờ ĐỊA PHƯƠNG. Gọi toISOString() lên nó là quy về UTC — và trong khung 00:00–07:00 giờ VN
// thì ngày lùi lại một hôm. Đúng 00:39 sáng 16/08/2026, bài này ghi số đo vào tuần 09/08 (còn
// chẳng phải thứ Hai) trong khi màn hình đọc tuần 10/08, rồi báo "không thấy 143.5" như thể app
// đánh mất con số. lib/dates.ts đã cảnh báo đúng cái bẫy này từ lâu; mấy bài kiểm chép tay phép
// tính thì chưa.
const inNgay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const THU2 = inNgay(t2);

let wigId = null, viecId = null, camKetId = null;
try {
  // Mục tiêu năm 5000 lead, việc tuần 30 lead, ô ĐIỀN SỐ.
  const {data: w} = await admin.from('wigs').insert({
    class_id: enr, student_id: em, scope: 'student', kind: 'academic', period: 'year',
    period_label: 'ZZTEST-LUONG', area: 'knowledge', title: 'ZZ_TEST đếm lượng',
    baseline: 0, target_value: 5000, unit: 'lead', start_date: '2026-08-01', end_date: '2027-05-31',
    status: 'approved', set_by: 'student', measure_by: 'tick',
  }).select('id').maybeSingle();
  wigId = w.id;
  // 0121: VIỆC TREO DƯỚI CAM KẾT CỦA MỘT TUẦN, không treo thẳng vào mục tiêu nữa —
  // `lead_measures.commitment_id` là NOT NULL và `wig_id` do trigger tự suy ra. Bản cũ chèn thẳng
  // wig_id nên vỡ ngay ở đây, và cả bài đọc thành "app hỏng" trong khi nó chỉ nói mô hình cũ.
  const {data: ck0, error: eCk} = await admin
    .from('commitments')
    .insert({wig_id: wigId, class_id: enr, student_id: em, week_start: THU2,
             title: 'ZZ_TEST cam kết điền số', area: 'knowledge'})
    .select('id')
    .maybeSingle();
  if (eCk) throw new Error('không tạo được cam kết: ' + eCk.message);
  camKetId = ck0.id;
  const {data: lm, error: eLm} = await admin.from('lead_measures').insert({
    commitment_id: camKetId, title: 'ZZ_TEST điền lead', target_value: 30, unit: 'lead',
    active_weekdays: [1, 2, 3, 4, 5], unit_per_tick: 1, nhap_luong: true,
  }).select('id').maybeSingle();
  if (eLm) throw new Error('không tạo được việc: ' + eLm.message);
  viecId = lm.id;

  // ① MỖI NGÀY LÀ MỘT NÚT TICK, KÈM MỘT Ô SỐ TUỲ CHỌN BÊN DƯỚI.
  //
  // SỬA 14/08/2026. Bản trước của phép kiểm này đòi "mọi ô ngày đều là ô nhập số, KHÔNG ô nào còn
  // là nút bấm" — đúng với thiết kế hôm ấy, nhưng chủ dự án đã chốt lại ngay sau đó:
  //
  //   "có thể ngày đó ko nhập cũng được, nhưng phải tick có làm"
  //
  // Tức là con số là tuỳ chọn, còn lượt tick thì không. Bỏ nút đi là mất luôn cách nói "hôm nay
  // con CÓ làm" của một em chưa kịp đo được bao nhiêu. Nên mỗi ngày nay có hai phần tử: nút tick,
  // và ô số nằm dưới (khoá cho tới khi đã tick).
  let dom = await doc();
  let the = theCua(dom, 'ZZ_TEST điền lead');
  dau('Dựng đủ 5 ngày cho việc đếm-theo-lượng', the.length === 10, `${the.length} phần tử / 5 ngày`);
  dau('Mỗi ngày có một ô NHẬP SỐ', the.filter((x) => x.includes('type="number"')).length === 5);
  dau('Mỗi ngày VẪN có nút tick', the.filter((x) => x.includes('aria-pressed')).length === 5);

  // ② Ghi 10 → mở lại đúng 10, và vòng tròn nhích đúng 10/5000
  await admin.from('lead_progress').insert({
    lead_measure_id: viecId, student_id: em, logged_by: em, logged_date: THU2, value: 10,
  });
  dom = await doc();
  dau('Mở lại đúng số đã ghi (10)', /value="10"/.test(dom));
  // THANH CỦA VIỆC PHẢI ĐỌC RA CON SỐ, KHÔNG PHẢI SỐ Ô VÀNG.
  //
  // Chủ dự án bắt được 14/08/2026: gõ 15 lead vào ô thứ Sáu, dòng ghi xuống CSDL đàng hoàng
  // (kiểm lại: value = 15) mà thanh vẫn đứng ở "1/1600 lead" — "nhập 15 vẫn ko lên số, ko ăn".
  // Nguyên do: việc RIÊNG không được truyền `myTotal`, nên LeadTicker rơi về đường dự phòng
  // `số ngày đã tick × hệ số`. Việc một-chạm thì hai cách ra cùng một số nên lỗi ẩn kỹ; việc điền
  // số thì sai hẳn. Mọi phép kiểm cũ ở đây đều nhìn CSDL và vòng tròn NĂM, không cái nào nhìn
  // đúng dòng chữ em đọc.
  dau('Thanh của việc đọc ra 10/30, không phải 1/30', /(^|\s)10 ?\/ ?30 lead/.test(chuThuan(dom)), timSo(dom));
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
  if (camKetId) await admin.from('commitments').delete().eq('id', camKetId);
  // Em tạm phải biến mất hoàn toàn — kể cả khi bài chạy hỏng giữa chừng.
  if (emTam) {
    await admin.from('wigs').delete().eq('student_id', emTam.id);
    await admin.from('enrollments').delete().eq('student_id', emTam.id);
    await admin.auth.admin.deleteUser(emTam.id);
  }

  if (wigId) {
    await admin.from('lead_measures').delete().eq('wig_id', wigId);
    await admin.from('wigs').delete().eq('parent_wig_id', wigId);
    await admin.from('wigs').delete().eq('id', wigId);
  }
}

xong();
