// HỌP WIG: TỪNG EM — cam kết của em (việc, tick, V/X) và năm câu em tự viết đổ về màn của cô.
//
//   npm run dev  rồi:  node scripts/test-hop-tung-em.mjs [http://localhost:6880]
//
// Luật đang kiểm (chủ dự án chốt 15–16/08/2026):
//   A. Lời hứa và lời kể là CỦA EM: em viết ở /student/hop, cô đọc trong phòng họp — không có ô
//      nào để cô gõ hộ hay ghi đè, và máy chủ thôi đọc các trường cũ dù ai gửi tay lên.
//   B. Cô CHẤM V/X cam kết của em ngay trong buổi họp ("đánh thắng thua giống học sinh").
//   C. Bước 2 chỉ còn chiêm nghiệm; câu "cam kết" tự do đã gỡ (bước 3 mới là cam kết thật).
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
let emThu = (dsEm ?? []).find((e) => !banRoi.has(e.student_id));

// KHÔNG CÒN EM NÀO TRỐNG THÌ DỰNG LẤY MỘT EM, ĐỪNG BỎ QUA.
//
// Bài này cần một em CHƯA có mục tiêu năm — gieo cho em đã có là ghi đè mất của em. Nhưng từ đợt
// gieo lại dữ liệu lớp Test thì mọi em đều đã có, nên bài dừng ngay ở câu tiền đề và không bao
// giờ chạy. Tạo một tài khoản học sinh tạm, xếp vào lớp, đo xong XOÁ SẠCH.
let emTam = null;
if (!emTam && !emThu && lop) {
  const id = crypto.randomUUID();
  const email = `kiem.tam.${id.slice(0, 8)}@student.truongvietanh.com`;
  const {error} = await admin.auth.admin.createUser({
    id, email, email_confirm: true, user_metadata: {full_name: 'Em Kiểm Tạm'},
  });
  if (!error) {
    const {error: e2} = await admin
      .from('enrollments')
      .insert({student_id: id, class_id: lop.id, is_active: true});
    if (e2) await admin.auth.admin.deleteUser(id);
    else {
      emTam = {id, email};
      emThu = {student_id: id, profiles: {full_name: 'Em Kiểm Tạm'}};
    }
  }
}

if (!lop || !gv || !emThu) {
  dau('Có lớp, GVCN và một em chưa đặt mục tiêu', false, 'không dựng nổi một em tạm để thử');
  xong(1);
}
dau('Có lớp, GVCN và một em chưa đặt mục tiêu', true, `${lop.name} · ${gv.email}`);

const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email: gv.email});
const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

// Nhãn tuần đúng dạng máy chủ dùng (weekFromMonday → isoWeekLabel).
const nhanTuanCua = (thu2) => {
  const dt = new Date(`${thu2}T00:00:00Z`);
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const dauNam = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const so = Math.ceil(((dt.getTime() - dauNam.getTime()) / 86400000 + 1) / 7);
  return `W${String(so).padStart(2, '0')}-${dt.getUTCFullYear()}`;
};

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

  // ── EM TỰ VIẾT NĂM CÂU trong phòng họp của em — cô chỉ đọc (0111/0130) ──
  // Ghi thẳng bằng service_role đúng vào bảng mà hs_ghi_bien_ban ghi (chỉ đo phần cô nhìn).
  await admin.from('wig_meetings').insert({
    class_id: lop.id, student_id: emThu.student_id, week_label: nhanTuanCua(TUAN), week_start: TUAN,
    results: 'ZZ_TEST tuần rồi làm được 2 hôm', commitments: 'ZZ_TEST tuần tới đủ 3 hôm',
    kho_khan: 'ZZ_TEST con hay quên', vuot_qua: 'ZZ_TEST nhờ mẹ nhắc', cach_tot_hon: 'ZZ_TEST đặt báo thức',
    hs_go_luc: new Date().toISOString(),
  });

  // ── Mở phòng họp của tuần đã qua ──
  const r = await fetch(`${BASE}/wig/hop?hop=${TUAN}`, {headers: {cookie}});
  dau('Phòng họp dựng được', r.status === 200, `HTTP ${r.status}`);
  if (r.status !== 200) xong(1);
  const html = await r.text();
  const dom = html.replace(/<script[\s\S]*?<\/script>/g, '');

  // TRỤC CAM KẾT (16/08/2026): cam kết của em hiện trong khối của em, kèm việc và V/X.
  dau('Cam kết của em hiện trong khối "Từng em"', dom.includes('ZZ_TEST việc cũ'));
  dau('Có nút V/X cho cam kết của em', dom.includes(`name="vxgoi_${camKetCuId}"`));
  // NĂM CÂU EM VIẾT ĐỔ VỀ màn của cô — chủ dự án: "ko chỗ nào hiện các câu trả lời của các em".
  for (const cau of ['ZZ_TEST con hay quên', 'ZZ_TEST nhờ mẹ nhắc', 'ZZ_TEST đặt báo thức', 'ZZ_TEST tuần rồi làm được 2 hôm', 'ZZ_TEST tuần tới đủ 3 hôm'])
    dau(`Cô đọc được câu em viết: "${cau.slice(8)}"`, dom.includes(cau));
  // KHÔNG còn ô nào để cô ghi đè lời của em.
  dau(
    'Phòng họp KHÔNG còn ô cô gõ hộ "Tuần rồi / Tuần tới hứa" cho em',
    !dom.includes(`name="em_${emThu.student_id}_ketqua"`) && !dom.includes(`name="em_${emThu.student_id}_camket"`),
  );
  dau('Phòng họp KHÔNG còn ô gõ việc thay em', !dom.includes(`name="em_${emThu.student_id}_viec"`));
  // Hai khối cũ đã gỡ: bảng "Việc chung" chấm từng việc, và ô "Cam kết" chữ tự do ở bước 2.
  dau('Không còn ô "Cam kết" chữ tự do ở bước 2', !dom.includes('name="cam_ket"'));
  dau('Không còn bảng chấm từng việc (note_/verdict_)', !/name="note_[0-9a-f-]{36}"/.test(dom));

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

  const sang = new Date(`${TUAN}T00:00:00Z`);
  sang.setUTCDate(sang.getUTCDate() + 7);
  const TUAN_SAU = sang.toISOString().slice(0, 10);

  // ① CÔ CHẤM V cho cam kết của em + ghi chiêm nghiệm; gửi kèm cả các trường CŨ (gõ hộ, đặt việc)
  //    để chứng minh máy chủ thôi đọc chúng.
  const d1 = await gui({
    class_id: lop.id,
    hop_start: TUAN,
    hop_label: nhanTuanCua(TUAN),
    dich_label: nhanTuanCua(TUAN_SAU),
    chiem_nghiem: 'ZZ_TEST chiêm nghiệm của lớp',
    [`vx_${camKetCuId}`]: 'win',
    [`vxgoi_${camKetCuId}`]: 'lose',
    [`em_${emThu.student_id}_ten`]: 'Em thử',
    [`em_${emThu.student_id}_ketqua`]: 'CÔ GÕ HỘ — không được ghi',
    [`em_${emThu.student_id}_camket`]: 'CÔ GÕ HỘ — không được ghi',
    [`em_${emThu.student_id}_viec`]: 'ZZ_TEST việc mới',
    [`em_${emThu.student_id}_days`]: ['2', '4', '6'],
    cam_ket: 'CÂU CAM KẾT TỰ DO — không được ghi',
  });
  dau('Máy chủ nhận lệnh chốt buổi họp', d1.status === 200 || d1.status === 303, `HTTP ${d1.status}`);
  if (process.env.SOI)
    console.log('SOI:', (d1.body.match(/"error":"[^"]{0,200}"|Xong:[^"\\]{0,160}/g) ?? ['(không thấy câu báo)'])[0]);

  const {data: ckSau} = await admin
    .from('commitments').select('verdict, verdict_goi_y, verdict_by').eq('id', camKetCuId).maybeSingle();
  dau('Cô chấm được V/X cho cam kết của em', ckSau?.verdict === 'win' && ckSau?.verdict_goi_y === 'lose',
    `${ckSau?.verdict} (máy gợi ${ckSau?.verdict_goi_y})`);

  const {data: ckMoi} = await admin
    .from('commitments').select('id, title').eq('class_id', lop.id)
    .eq('student_id', emThu.student_id).eq('week_start', TUAN_SAU).maybeSingle();
  dau('Buổi họp KHÔNG đặt cam kết thay em', !ckMoi, ckMoi ? `LỌT: ${ckMoi.title}` : 'không có');

  const {data: bb} = await admin
    .from('wig_meetings').select('results, commitments, kho_khan')
    .eq('class_id', lop.id).eq('student_id', emThu.student_id).eq('week_start', TUAN).maybeSingle();
  dau('Lời của em KHÔNG bị cô ghi đè',
    bb?.results === 'ZZ_TEST tuần rồi làm được 2 hôm' && bb?.commitments === 'ZZ_TEST tuần tới đủ 3 hôm' && bb?.kho_khan === 'ZZ_TEST con hay quên',
    bb ? `${bb.results} | ${bb.commitments}` : 'không có dòng nào');

  const {data: bbLop} = await admin
    .from('wig_meetings').select('chot_at, results, commitments')
    .eq('class_id', lop.id).is('student_id', null).eq('week_start', TUAN).maybeSingle();
  dau('Một nút: lưu cũng là CHỐT', !!bbLop?.chot_at, bbLop?.chot_at ?? 'chưa chốt');
  dau('Chiêm nghiệm của lớp được ghi', bbLop?.results === 'ZZ_TEST chiêm nghiệm của lớp', bbLop?.results ?? '');
  dau('Câu "cam kết" tự do KHÔNG còn được ghi', !bbLop?.commitments, bbLop?.commitments ?? 'trống');
} finally {
  // Dọn theo đúng thứ tự phụ thuộc, và dọn CẢ DẤU CHỐT — bỏ sót là khoá tick một tuần của lớp thật.
  await admin.from('wig_meetings').delete().eq('class_id', lop.id).eq('week_start', TUAN);
  await admin.from('wig_meeting_notes').delete().eq('class_id', lop.id).eq('week_start', TUAN);
  // Em tạm phải biến mất hoàn toàn — kể cả khi bài chạy hỏng giữa chừng.
  if (emTam) {
    await admin.from('wigs').delete().eq('student_id', emTam.id);
    await admin.from('enrollments').delete().eq('student_id', emTam.id);
    await admin.auth.admin.deleteUser(emTam.id);
  }
  if (wigId) {
    // Xoá mục tiêu là cam kết + việc + lượt tick đi theo bằng khoá ngoại CASCADE
    // (xem scripts/test-xoa-wig-ba-tang.mjs), nên một lệnh là đủ và không sót gì.
    await admin.from('wigs').delete().eq('id', wigId);
  }
  // Mốc tuần/tháng mà buổi họp có thể đã bù cho tuần thử.
  await admin.from('wigs').delete().eq('class_id', lop.id).in('period_label', ['ZZTEST-W10', 'ZZTEST-W11']);
}

xong();
