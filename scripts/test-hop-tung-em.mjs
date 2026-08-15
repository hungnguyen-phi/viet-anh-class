// HỌP WIG: TỪNG EM — việc tuần này, và biên bản riêng (0108, lát 4+5).
//
//   npm run dev  rồi:  node scripts/test-hop-tung-em.mjs [http://localhost:6880]
//
// Hai luật đang kiểm, cả hai đều do chủ dự án chốt 13/08/2026:
//   A. "mỗi tuần con làm gì" thành "TUẦN NÀY con làm gì", tuần sau buổi họp HỎI LẠI. Ô điền sẵn
//      câu cũ; không đổi thì không ghi lại, đổi thì ghi đè.
//   B. Họp LỚP ghi được biên bản CÁ NHÂN cho từng em, để GVCN vắng hoặc bận thì buổi họp không tắc.
//
// ── GỌI ĐƯỢC ACTION THẬT, và đây là cách ──────────────────────────────────────────────────────
//
// `ketThucBuoiHop` là action của useActionState nên chữ ký là (prevState, formData) — không gọi
// thẳng bằng `$ACTION_ID_<id>` được (xem đầu scripts/test-moc-thang-cua-em.mjs, đã mất một vòng vì
// chuyện này). Nhưng React DỰNG SẴN các trường ẩn của lối "chưa có JavaScript" ngay trong HTML máy
// chủ trả về: `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`. Bài này BÓC nguyên xi
// mấy trường ấy từ trang rồi gửi lại kèm dữ liệu của mình — đúng như một trình duyệt tắt JavaScript
// sẽ làm. Không đoán định dạng nào cả, chỉ chép lại.
//
// ── AN TOÀN: KHÔNG HỌP VÀO TUẦN ĐANG CHẠY ────────────────────────────────────────────────────
//
// Chốt buổi họp là KHOÁ TICK của tuần ấy. Bài này chạy thẳng lên CSDL thật, nên nó cố ý họp vào một
// tuần đã trôi qua từ lâu — chốt nhầm tuần hiện tại là cả lớp mất quyền tick mà không hiểu vì sao.
// Cuối bài xoá sạch mọi dòng đã tạo, kể cả dấu chốt.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6880';
// TUẦN ĐỂ DIỄN TẬP: thứ Hai của tám tuần NỮA, tính từ hôm nay.
//
// Bản cũ đóng cứng một tuần đã qua từ lâu ('2026-03-02') để khỏi đụng dữ liệu thật. Nhưng nhãn
// tuần chỉ tra ra ngày trong cửa sổ ±12 tuần quanh hôm nay (CUA_SO_KY), nên một ngày cố định sẽ
// trôi ra ngoài cửa sổ theo thời gian — và khi ấy máy chủ trả "Không rõ tuần tới là tuần nào",
// đọc thành app hỏng. Tám tuần TỚI thì vừa nằm trong cửa sổ, vừa là vùng chưa lớp nào có dữ liệu,
// nên phần dọn cuối bài không thể xoá nhầm buổi họp thật của ai.
const nayVN = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh'}));
const t2NayVN = new Date(nayVN);
t2NayVN.setDate(nayVN.getDate() - ((nayVN.getDay() + 6) % 7) + 56);
const TUAN = `${t2NayVN.getFullYear()}-${String(t2NayVN.getMonth() + 1).padStart(2, '0')}-${String(t2NayVN.getDate()).padStart(2, '0')}`;

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

const ketQua = [];
const dau = (ten, dat, chiTiet = '') => ketQua.push({ten, dat, chiTiet});
function xong(ma) {
  for (const k of ketQua) console.log(`${k.dat ? 'OK  ' : 'SAI '} ${k.ten}${k.chiTiet ? '  → ' + k.chiTiet : ''}`);
  const d = ketQua.filter((k) => k.dat).length;
  console.log(`\n${d}/${ketQua.length} đạt.`);
  process.exit(ma ?? (d === ketQua.length ? 0 : 1));
}

const goHtml = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Bóc mọi trường ẩn $ACTION… mà React dựng sẵn — không diễn giải, chỉ chép.
function truongAction(html) {
  const ra = [];
  for (const m of html.matchAll(/<input[^>]*?type="hidden"[^>]*?>/g)) {
    const ten = m[0].match(/name="([^"]*)"/)?.[1];
    if (!ten || !ten.startsWith('$ACTION')) continue;
    ra.push([ten, goHtml(m[0].match(/value="([^"]*)"/)?.[1] ?? '')]);
  }
  return ra;
}

// ── Lớp có GVCN, và một em CHƯA có mục tiêu năm (gieo cho em đã có là ghi đè mất của em) ──
const {data: lop} = await admin
  .from('classes').select('id, name, homeroom_teacher_id').not('homeroom_teacher_id', 'is', null)
  .eq('is_active', true).limit(1).maybeSingle();
const {data: gv} = await admin.from('profiles').select('email').eq('id', lop?.homeroom_teacher_id ?? '').maybeSingle();
const {data: dsEm} = await admin
  .from('enrollments').select('student_id, profiles!enrollments_student_id_fkey(full_name)')
  .eq('class_id', lop?.id ?? '').eq('is_active', true);
const {data: daCo} = await admin
  .from('wigs').select('student_id').eq('scope', 'student').eq('period', 'year');
const banRoi = new Set((daCo ?? []).map((r) => r.student_id));
const emThu = (dsEm ?? []).find((e) => !banRoi.has(e.student_id));
if (!lop || !gv || !emThu) {
  dau('Có lớp, GVCN và một em chưa đặt mục tiêu', false, 'thiếu dữ liệu để thử mà không phá của ai');
  xong(1);
}
dau('Có lớp, GVCN và một em chưa đặt mục tiêu', true, `${lop.name} · ${gv.email}`);

const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

let wigId = null;
let camKetCuId = null;
try {
  const {data: w} = await admin.from('wigs').insert({
    class_id: lop.id, student_id: emThu.student_id, scope: 'student', kind: 'academic',
    period: 'year', period_label: 'ZZTEST-HOP', area: 'knowledge', title: 'ZZ_TEST mục tiêu',
    baseline: 0, target_value: 50, unit: 'bài', start_date: '2026-08-01', end_date: '2027-05-31',
    status: 'approved', set_by: 'student', measure_by: 'tick',
  }).select('id').maybeSingle();
  wigId = w.id;
  // 0121: việc treo dưới CAM KẾT của một tuần, không treo thẳng vào mục tiêu năm.
  const {data: ckCu, error: eCk} = await admin.from('commitments').insert({
    wig_id: wigId, class_id: lop.id, student_id: emThu.student_id, week_start: TUAN,
    title: 'ZZ_TEST việc cũ', area: 'knowledge',
  }).select('id').single();
  if (eCk) throw new Error('cam kết tuần cũ: ' + eCk.message);
  camKetCuId = ckCu.id;
  await admin.from('lead_measures').insert({
    commitment_id: camKetCuId, title: 'ZZ_TEST việc cũ', target_value: 2, unit: 'bài',
    active_weekdays: [1, 3], unit_per_tick: 1,
  });

  // ── Mở phòng họp của tuần đã qua ──
  const r = await fetch(`${BASE}/wig/hop?hop=${TUAN}`, {headers: {cookie}});
  dau('Phòng họp dựng được', r.status === 200, `HTTP ${r.status}`);
  if (r.status !== 200) xong(1);
  const html = await r.text();
  const dom = html.replace(/<script[\s\S]*?<\/script>/g, '');

  dau('Em có dòng riêng trong khối "Từng em"', dom.includes(`name="em_${emThu.student_id}_ten"`));
  // Ô "tuần này con làm gì" và hàng nút chọn thứ đã GỠ khỏi phòng họp — nay canh chiều ngược lại.
  dau(
    'Phòng họp KHÔNG còn ô gõ việc thay em',
    !dom.includes(`name="em_${emThu.student_id}_viec"`),
    dom.includes(`name="em_${emThu.student_id}_viec"`) ? 'CÒN Ô GÕ' : 'đã gỡ',
  );
  dau(
    'Phòng họp KHÔNG còn nút chọn thứ cho em',
    !dom.includes(`name="em_${emThu.student_id}_days"`),
    dom.includes(`name="em_${emThu.student_id}_days"`) ? 'CÒN NÚT THỨ' : 'đã gỡ',
  );

  const an = truongAction(html);
  dau('Bóc được trường ẩn của action', an.length >= 3, an.map(([k]) => k).join(', '));
  if (an.length < 3) xong(1);

  // ── Gửi như trình duyệt tắt JavaScript: chép trường ẩn + dữ liệu của mình ──
  const bien = '----vacHop' + Math.random().toString(36).slice(2);
  const phan = (n, val) => `--${bien}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${val}\r\n`;
  async function gui(o) {
    let than = an.map(([k, val]) => phan(k, val)).join('');
    for (const [k, val] of Object.entries(o)) {
      if (Array.isArray(val)) for (const x of val) than += phan(k, x);
      else than += phan(k, val);
    }
    than += `--${bien}--\r\n`;
    const dap = await fetch(`${BASE}/wig/hop?hop=${TUAN}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {cookie, origin: BASE, 'Content-Type': `multipart/form-data; boundary=${bien}`},
      body: than,
    });
    return {status: dap.status, body: await dap.text()};
  }

  // NHÃN TUẦN PHẢI LÀ NHÃN THẬT. Bản cũ gửi 'ZZTEST-W11' và máy chủ nuốt được, vì hồi ấy nhãn
  // tuần đích chỉ dùng ở nhánh tạo mới. Nay mọi việc của buổi họp đều treo vào tuần đích, nên nhãn
  // không đọc được là buổi họp dừng lại — đúng như nó nên làm. Giao diện thật luôn gửi nhãn do máy
  // chủ tính (weekFromMonday), nên đây là chỗ bộ kiểm phải theo app, không phải ngược lại.
  const nhanTuan = (thu2) => {
    const dt = new Date(`${thu2}T00:00:00Z`);
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const dauNam = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const so = Math.ceil(((dt.getTime() - dauNam.getTime()) / 86400000 + 1) / 7);
    return `W${String(so).padStart(2, '0')}-${dt.getUTCFullYear()}`;
  };
  const sang = new Date(`${TUAN}T00:00:00Z`);
  sang.setUTCDate(sang.getUTCDate() + 7);
  const TUAN_SAU = sang.toISOString().slice(0, 10);

  const chung = {
    class_id: lop.id,
    hop_start: TUAN,
    hop_label: nhanTuan(TUAN),
    dich_label: nhanTuan(TUAN_SAU),
    [`em_${emThu.student_id}_ten`]: 'Em thử',
    [`em_${emThu.student_id}_wig`]: wigId,
  };
  const {data: leadTruoc} = await admin
    .from('lead_measures').select('id').eq('commitment_id', camKetCuId).maybeSingle();

  // ① ĐỔI việc + ghi biên bản riêng
  const d1 = await gui({
    ...chung,
    [`em_${emThu.student_id}_lead`]: leadTruoc.id,
    [`em_${emThu.student_id}_viec`]: 'ZZ_TEST việc mới',
    [`em_${emThu.student_id}_days`]: ['2', '4', '6'],
    [`em_${emThu.student_id}_ketqua`]: 'tuần rồi làm được 2 hôm',
    [`em_${emThu.student_id}_camket`]: 'tuần tới đủ 3 hôm',
  });
  dau('Máy chủ nhận lệnh chốt buổi họp', d1.status === 200 || d1.status === 303, `HTTP ${d1.status}`);
  // `SOI=1 node scripts/test-hop-tung-em.mjs …` in ra câu máy chủ trả về. Khi buổi họp không lưu,
  // mọi phép dưới đây đỏ cùng lúc mà không cái nào nói VÌ SAO — câu lỗi thật nằm trong thân trả
  // về, và đây là đường ngắn nhất để đọc nó.
  if (process.env.SOI)
    console.log('SOI:', (d1.body.match(/"error":"[^"]{0,200}"|Xong:[^"\\]{0,160}/g) ?? ['(không thấy câu báo)'])[0]);

  // ── BUỔI HỌP KHÔNG ĐẶT VIỆC THAY EM (15/08/2026) ────────────────────────────────────────
  //
  // Chủ dự án: "sao giáo viên lại được sửa cho từng em? phải là em đặt chứ". Ô "việc tuần này" và
  // hàng nút chọn thứ đã gỡ khỏi phòng họp, và máy chủ thôi đọc hai trường ấy. Nên phép đo đảo
  // chiều: gửi chúng lên vẫn phải KHÔNG sinh ra cam kết nào cho em — gỡ ở giao diện mà máy chủ
  // còn nhận thì chỉ là giấu cái nút, không phải khoá cửa.
  // ── (cũ) BUỔI HỌP ĐẶT VIỆC CHO TUẦN TỚI, KHÔNG VIẾT LẠI TUẦN VỪA CHỐT ───────────────────
  //
  // Bản trước đòi ngược lại: ô "việc tuần này" phải ĐỔI TÊN chính việc của tuần cũ. Hai lẽ khiến
  // nó sai: 0129 khoá quyền sửa việc dẫn dắt (câu UPDATE của cô khớp 0 dòng và im lặng trôi qua),
  // và tuần cũ đã chốt — sửa nó là viết lại quá khứ mà lượt tick đã treo dưới.
  const TUAN_TOI = TUAN_SAU;

  const {data: ckMoi} = await admin
    .from('commitments')
    .select('id, title')
    .eq('class_id', lop.id)
    .eq('student_id', emThu.student_id)
    .eq('week_start', TUAN_TOI)
    .maybeSingle();
  dau('Buổi họp đặt CAM KẾT cho tuần tới', ckMoi?.title === 'ZZ_TEST việc mới', String(ckMoi?.title));


  const {data: viecCu} = await admin
    .from('lead_measures').select('title, active_weekdays').eq('id', leadTruoc.id).maybeSingle();
  dau(
    'Việc của tuần ĐÃ CHỐT không bị sửa',
    viecCu?.title === 'ZZ_TEST việc cũ' && (viecCu?.active_weekdays ?? []).join(',') === '1,3',
    `${viecCu?.title} · ${(viecCu?.active_weekdays ?? []).join(',')}`,
  );

  const {data: bb} = await admin
    .from('wig_meetings').select('results, commitments')
    .eq('class_id', lop.id).eq('student_id', emThu.student_id).eq('week_start', TUAN).maybeSingle();
  dau('Họp LỚP ghi được biên bản CÁ NHÂN', bb?.results === 'tuần rồi làm được 2 hôm' && bb?.commitments === 'tuần tới đủ 3 hôm',
    bb ? `${bb.results} | ${bb.commitments}` : 'không có dòng nào');

  const {data: bbLop} = await admin
    .from('wig_meetings').select('chot_at').eq('class_id', lop.id).is('student_id', null).eq('week_start', TUAN).maybeSingle();
  dau('Một nút: lưu cũng là CHỐT', !!bbLop?.chot_at, bbLop?.chot_at ?? 'chưa chốt');

  // ② GỬI LẠI Y HỆT — không đổi thì không ghi lại
  const d2 = await gui({
    ...chung,
    [`em_${emThu.student_id}_lead`]: leadTruoc.id,
    [`em_${emThu.student_id}_viec`]: 'ZZ_TEST việc mới',
    [`em_${emThu.student_id}_days`]: ['2', '4', '6'],
    [`em_${emThu.student_id}_ketqua`]: 'tuần rồi làm được 2 hôm',
    [`em_${emThu.student_id}_camket`]: 'tuần tới đủ 3 hôm',
  });
  // Không decodeURIComponent cả thân trả về: luồng RSC có dấu % trong chuỗi thường và ném URIError.
  const noiBao = d2.body;
  dau(
    'Gửi lại y hệt → KHÔNG báo đã giao việc/ghi biên bản',
    !/giao việc tuần cho/.test(noiBao) && !/ghi biên bản riêng cho/.test(noiBao),
    (noiBao.match(/Xong: [^"\\]{0,90}/) ?? ['(không đọc được câu báo)'])[0],
  );
} finally {
  // Dọn theo đúng thứ tự phụ thuộc, và dọn CẢ DẤU CHỐT — bỏ sót là khoá tick một tuần của lớp thật.
  await admin.from('wig_meetings').delete().eq('class_id', lop.id).eq('week_start', TUAN);
  await admin.from('wig_meeting_notes').delete().eq('class_id', lop.id).eq('week_start', TUAN);
  if (wigId) {
    // Xoá mục tiêu là cam kết + việc + lượt tick đi theo bằng khoá ngoại CASCADE
    // (xem scripts/test-xoa-wig-ba-tang.mjs), nên một lệnh là đủ và không sót gì.
    await admin.from('wigs').delete().eq('id', wigId);
  }
  // Mốc tuần/tháng mà buổi họp có thể đã bù cho tuần thử.
  await admin.from('wigs').delete().eq('class_id', lop.id).in('period_label', ['ZZTEST-W10', 'ZZTEST-W11']);
}

xong();
