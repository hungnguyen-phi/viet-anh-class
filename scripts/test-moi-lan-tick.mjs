// "Mỗi lần tick đáng bao nhiêu" có làm đúng việc của nó không (0076).
//
// VÌ SAO CẦN. Trước bản này, một lượt tick LUÔN được tính là 1 đơn vị của WIG — con số ấy nằm
// ngầm trong mã, không ai khai được. Nên khi lead measure và WIG cha nói bằng hai đơn vị khác
// nhau thì app cộng thẳng cái nọ vào cái kia, và không màn hình nào hé một lời.
//
// Lớp 7B1 trên production: WIG tuần "Đọc sách 3 buổi" (đơn vị BUỔI) có việc dẫn dắt "Dành 30 phút
// mỗi tối để đọc sách" (đơn vị PHÚT, mục tiêu 30). Học sinh tick 3 lần là WIG đã thắng, trong khi
// việc kia mới đi được 3/30 — và 30 lượt tick thì một tuần 7 ngày không bao giờ chứa nổi.
//
// Phép kiểm này soi ba chuyện, trong đó chuyện thứ ba là chuyện đáng giá nhất:
//   1. Hệ số có thật sự nhân vào tiến độ không.
//   2. Mặc định 1 có giữ nguyên mọi con số cũ không.
//   3. Cảnh báo tính TRONG TRANG (JavaScript) có khớp với cảnh báo tính TRONG CSDL (SQL) không.
//      Hai bên cố ý viết bằng hai thứ tiếng khác nhau; chúng lệch nhau là có một bên sai.
//
//   node scripts/test-moi-lan-tick.mjs [http://localhost:6871]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
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

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// ── 1. Cột có mặt và không dòng nào rỗng ──
// Hỏi bằng chính dữ liệu chứ không qua information_schema: PostgREST không phải lúc nào cũng mở
// schema đó, mà thứ cần biết ở đây là "đọc ra có giá trị không", không phải định nghĩa cột.
{
  const {data: rows, error} = await admin.from('lead_measures').select('unit_per_tick').limit(500);
  const co = !error && (rows ?? []).length > 0;
  const deuCoGiaTri = (rows ?? []).every((r) => r.unit_per_tick != null);
  check(
    'Cột unit_per_tick có mặt và không dòng nào rỗng',
    co && deuCoGiaTri,
    error ? error.message : `${(rows ?? []).length} dòng`,
  );
}

// ── 2. Mặc định 1 → KHÔNG con số nào đổi (điều kiện để migration là an toàn) ──
{
  const {data: rows} = await admin.from('lead_measures').select('unit_per_tick');
  const khac1 = (rows ?? []).filter((r) => Number(r.unit_per_tick) !== 1).length;
  check(
    'Dữ liệu cũ giữ hệ số 1 → tiến độ không đổi',
    khac1 === 0,
    khac1 === 0 ? `${(rows ?? []).length} việc đều để 1` : `${khac1} việc đã đổi hệ số (có chủ ý?)`,
  );
}

// ── 3. Hệ số CÓ nhân vào tiến độ thật không ──
// Dò bằng cách so tiến độ hiện tại với tổng tick thô của cùng WIG. Với hệ số 1 hai số bằng nhau;
// phép kiểm này chốt rằng công thức đọc cột đó chứ không bỏ qua.
{
  const {data: wigs} = await admin
    .from('wigs')
    .select('id, period, start_date, end_date, lead_measures(id, unit_per_tick)')
    .eq('period', 'week')
    .limit(60);
  const {data: prog} = await admin.from('wig_progress_v').select('wig_id, actual').eq('period', 'week');
  const actualBy = new Map((prog ?? []).map((p) => [p.wig_id, Number(p.actual ?? 0)]));

  let sai = [];
  for (const w of wigs ?? []) {
    let mong = 0;
    for (const lm of w.lead_measures ?? []) {
      const {data: ticks} = await admin
        .from('lead_progress')
        .select('value, logged_date')
        .eq('lead_measure_id', lm.id);
      for (const t of ticks ?? []) {
        if (t.logged_date >= w.start_date && t.logged_date <= w.end_date) {
          mong += Number(t.value) * Number(lm.unit_per_tick ?? 1);
        }
      }
    }
    const thuc = actualBy.get(w.id);
    if (thuc !== undefined && Math.abs(thuc - mong) > 1e-9) sai.push(`${w.id.slice(0, 8)}: ${thuc} ≠ ${mong}`);
  }
  check(
    'Tiến độ WIG = tổng (tick × hệ số)',
    sai.length === 0,
    sai.length ? sai.slice(0, 3).join(' · ') : `${(wigs ?? []).length} WIG tuần khớp`,
  );
}

// ── 4. HAI NGUỒN CẢNH BÁO PHẢI TRÙNG NHAU ──
// SQL: lead_measure_canh_bao() trong 0076.
// JS : chép lại đúng công thức, viết độc lập ở đây (KHÔNG import từ trang) — nếu import thì lỗi
//      ở trang sẽ tự khớp với chính nó và phép kiểm hoá vô nghĩa.
{
  // 0121/0122: KHÔNG CÒN WIG TUẦN. Việc dẫn dắt treo dưới CAM KẾT, và lead_measure_canh_bao nay
  // nhận `p_commitment` chứ không phải `p_wig`. Bản cũ gọi tên tham số cũ nên PostgREST trả lỗi,
  // `sql` là null, và bài báo "SQL không trả về" — nghe như CSDL hỏng, thật ra là bộ kiểm gọi sai.
  const {data: wigs} = await admin
    .from('commitments')
    .select(
      'id, class_id, student_id, week_start, wigs(unit), lead_measures(id, target_value, unit, active_weekdays, unit_per_tick)',
    );
  // Sĩ số từng lớp — trần của WIG LỚP là "số ngày × sĩ số" vì cả lớp cùng tick vào một việc.
  const {data: enr} = await admin.from('enrollments').select('class_id').eq('is_active', true);
  const siSo = new Map();
  for (const e of enr ?? []) siSo.set(e.class_id, (siSo.get(e.class_id) ?? 0) + 1);

  // Bỏ dấu tiếng Việt — phải khớp private.bo_dau() trong 0078.
  const boDau = (s) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .toLowerCase();

  const soNgayTickDuoc = (start, end, thu) => {
    const on = new Set(thu ?? [1, 2, 3, 4, 5, 6, 7]);
    let n = 0;
    for (const d = new Date(`${start}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > end) break;
      if (on.has(d.getUTCDay() === 0 ? 7 : d.getUTCDay())) n += 1;
    }
    return n;
  };

  // Cam kết sống đúng bảy ngày kể từ thứ Hai của nó — WIG tuần ngày trước mang sẵn start/end,
  // cam kết thì chỉ có week_start.
  const bayNgay = (t2) => {
    const d = new Date(`${t2}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return {start_date: t2, end_date: d.toISOString().slice(0, 10)};
  };

  let lech = [];
  let soCanhBao = 0;
  for (const ck of wigs ?? []) {
    // scope của cam kết đọc từ chính nó: cam kết có student_id là của một em, không có là của lớp.
    const w = {
      ...ck,
      ...bayNgay(ck.week_start),
      unit: ck.wigs?.unit,
      scope: ck.student_id ? 'student' : 'class',
    };
    if (!(w.lead_measures ?? []).length) continue;
    const {data: sql} = await admin.rpc('lead_measure_canh_bao', {p_commitment: w.id});
    const sqlBy = new Map((sql ?? []).map((r) => [r.lead_measure_id, r]));
    for (const lm of w.lead_measures) {
      const moiTick = Number(lm.unit_per_tick ?? 1) || 1;
      const js = {
        // Làm tròn 9 chữ số trước khi ceil — phải khớp canhBaoLead() trong wig/page.tsx. CSDL
        // tính bằng numeric chính xác còn JS bằng nhị phân: 21/0.7 = 30.000000000000004 → ceil
        // ra 31 trong khi Postgres ra 30.
        so_tick_can: Math.ceil(Number((Number(lm.target_value) / moiTick).toFixed(9))),
        so_ngay: soNgayTickDuoc(w.start_date, w.end_date, lm.active_weekdays),
      };
      // TRẦN LÀ TRẦN CỦA MỘT EM (0098) — sĩ số KHÔNG dự phần.
      //
      // Bản cũ của bài này nhân sĩ số vào trần, theo lối trước 0098, nên nó báo CSDL sai
      // (SQL 5 ≠ JS 35) trong khi CSDL đúng. Suýt nữa thì vá nhầm bên: nhân sĩ số vào trần sẽ
      // làm câm cảnh báo đúng lúc cần nhất — lớp 30 em, việc bật 5 ngày, chỉ tiêu 10 lượt cho
      // MỖI EM là bất khả với từng đứa, nhưng trần giả 150 nói là ổn. Xem 0132.
      //
      // Sĩ số vẫn được CSDL trả về như một con số để đọc, nên vẫn đối chiếu nó — chỉ là nó không
      // đi vào phép so.
      js.so_nguoi = w.scope === 'class' ? Math.max(siSo.get(w.class_id) ?? 0, 1) : 1;
      js.tran = js.so_ngay;
      js.qua_nhieu = js.so_tick_can > js.tran;
      js.lech_don_vi =
        Boolean(lm.unit) && Boolean(w.unit) && boDau(lm.unit) !== boDau(w.unit) && moiTick === 1;

      const s = sqlBy.get(lm.id);
      if (!s) {
        lech.push(`${lm.id.slice(0, 8)}: SQL không trả về`);
        continue;
      }
      if (js.qua_nhieu) soCanhBao += 1;
      if (js.lech_don_vi) soCanhBao += 1;
      if (
        Number(s.so_tick_can) !== js.so_tick_can ||
        Number(s.so_ngay_tick_duoc) !== js.so_ngay ||
        Number(s.so_nguoi_tick) !== js.so_nguoi ||
        Number(s.tran_luot_tick) !== js.tran ||
        s.qua_nhieu !== js.qua_nhieu ||
        s.lech_don_vi !== js.lech_don_vi
      ) {
        lech.push(
          `${lm.id.slice(0, 8)}: SQL(${s.so_tick_can}/${s.tran_luot_tick},${s.qua_nhieu},${s.lech_don_vi}) ≠ JS(${js.so_tick_can}/${js.tran},${js.qua_nhieu},${js.lech_don_vi})`,
        );
      }
    }
  }
  check(
    'Cảnh báo tính trong trang khớp cảnh báo tính trong CSDL',
    lech.length === 0,
    lech.length ? lech.slice(0, 2).join(' · ') : `đối chiếu xong, ${soCanhBao} cảnh báo đang bật`,
  );
  // Phép kiểm trên chỉ có nghĩa nếu THẬT SỰ có cảnh báo để đối chiếu. Không có cái nào bật thì
  // hai bên "khớp" một cách rỗng tuếch — nói thẳng ra thay vì báo xanh.
  check('Có ít nhất một cảnh báo thật để đối chiếu', soCanhBao > 0, `${soCanhBao} cảnh báo`);
}

// ── 4b. Ô rỗng KHÔNG được xoá lặng lẽ hệ số đã khai ──
//
// Rà soát đối kháng bắt được: ô number không `required` thì trình duyệt gửi lên chuỗi rỗng mà
// không kêu gì; bản đầu biến nó thành 1 rồi báo "Đã cập nhật". Mà hệ số không đóng băng vào từng
// lượt tick — wig_actual nhân lúc đọc — nên 30 → 1 là chia TOÀN BỘ lịch sử cho 30. Một WIG đang
// "30/30 đã đạt" tụt về "1/30" chỉ vì ai đó mở panel sửa để đổi cái tên rồi bấm Lưu.
//
// Soi chính hàm parseUnitPerTick trong mã nguồn: nó phải trả null (→ nơi gọi bỏ cột khỏi lệnh
// cập nhật), không được trả 1.
{
  // Luật "ô rỗng thì ĐỪNG đụng tới cột" nay nằm ở lib/wig-tao.ts (chuanHoaHeSo) — dùng chung cho
  // cả trang /wig lẫn phòng họp. Trước đây nó là parseUnitPerTick riêng của wig/actions.ts.
  // ĐƯỜNG SỬA VIỆC ĐÃ BỎ (0129) — việc dẫn dắt nay chỉ thêm, không sửa. Nên câu hỏi cũ ("ô rỗng
  // có ghi đè cột đang có không") không còn chỗ xảy ra; câu thay nó là: THÊM việc mà để trống ô
  // hệ số thì phải ra 1, tuyệt đối không phải null — cột là NOT NULL, một giá trị null ở đây là
  // cả lệnh thêm việc vỡ ngay giữa buổi họp.
  const chung = readFileSync('lib/wig-tao.ts', 'utf8');
  const src = readFileSync('app/[locale]/(dashboard)/wig/actions.ts', 'utf8');
  const co = /raw\.trim\(\) === ''\)\s*return null/.test(chung);
  const boQua = /const heSo = nhap_luong \? 1 : \(upt \?\? 1\)/.test(src);
  check(
    'Ô rỗng lúc THÊM việc rơi về hệ số 1, không phải null',
    co && boQua,
    co ? (boQua ? '' : 'không thấy chỗ rơi về 1') : 'chuanHoaHeSo vẫn nuốt rỗng',
  );

  // Form sửa việc nay là components/wig/ViecTuan.tsx (mở tại chỗ, không còn panel ở đầu trang).
  const form = readFileSync('components/wig/ViecTuan.tsx', 'utf8');
  const oSua = form.slice(form.indexOf('name="unit_per_tick"'));
  check(
    'Ô hệ số ở form sửa việc có required (chặn ngay trên trình duyệt)',
    /required/.test(oSua.slice(0, 400)),
    '',
  );
}

// ── 4c. ĐÃ BỎ: phép kiểm câu "em góp N lượt" ──
// Câu ấy từng in sai đơn vị (hệ số 30, em tick 3 tối, câu in "em góp 90 lượt") và phép kiểm này
// canh nó. Ngày 13/08/2026 chủ dự án cho bỏ hẳn cả câu: con số "em góp" chính là con số đã in to
// ngay trên thanh tiến độ ("Em: 2/5"), nói lại lần nữa chỉ thêm rối mắt.
//
// Không giữ lại phép kiểm cho một thứ không còn tồn tại. Nó sẽ XANH VĨNH VIỄN — regex không khớp
// vì dòng đã bị xoá, chứ không phải vì có gì được canh — mà một phép kiểm xanh vô căn cứ đúng là
// kiểu nói dối bộ kiểm này sinh ra để chặn. Câu ấy có quay lại thì viết phép kiểm mới cho nó.

// ── 5. Trang /wig có VẼ RA cảnh báo không ──
{
  // Tìm một WIG tuần đang có cảnh báo, mở đúng tuần của nó.
  // Lớp để mở trang: lớp của tài khoản GVCN kiểm thử nếu còn, không thì lớp bất kỳ đang hoạt động
  // có chủ nhiệm. Bám cứng một tài khoản là bài kiểm chết theo nhân sự của trường.
  const {data: gv} = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'test1.gvcn@truongvietanh.com')
    .maybeSingle();
  const {data: moiLop} = await admin
    .from('classes')
    .select('id, homeroom_teacher_id')
    .eq('is_active', true)
    .not('homeroom_teacher_id', 'is', null);
  // LỚP PHẢI CÓ MỤC TIÊU NĂM CỦA LỚP để treo cam kết thử vào — và mục tiêu ấy không được là
  // mục tiêu CUỘN (cam_ket_hop_le từ chối). Lớp đầu danh sách có thể chưa khai mục tiêu nào, và
  // khi ấy bài báo "không dựng nổi một cảnh báo" — đo sự trống rỗng của dữ liệu, không đo app.
  const {data: namLop} = await admin
    .from('wigs')
    .select('class_id')
    .eq('scope', 'class')
    .eq('period', 'year')
    .neq('measure_by', 'cuon');
  const coMucTieu = new Set((namLop ?? []).map((w) => w.class_id));
  const cuaGv = (moiLop ?? []).filter(
    (c) => c.homeroom_teacher_id === gv?.id && coMucTieu.has(c.id),
  );
  const lopChon = cuaGv.length
    ? cuaGv
    : (moiLop ?? []).filter((c) => coMucTieu.has(c.id)).slice(0, 1);
  const lopIds = lopChon.map((c) => c.id);

  // ĐĂNG NHẬP BẰNG GVCN CỦA CHÍNH LỚP VỪA CHỌN — phải chọn lớp trước rồi mới đăng nhập.
  // Bản cũ đăng nhập cứng bằng test1.gvcn; tài khoản ấy nay không chủ nhiệm lớp nào, nên trang
  // trả 307 và phép kiểm đọc thành "trang không vẽ cảnh báo".
  let ck = '';
  if (lopChon.length) {
    const {data: chuNhiem} = await admin
      .from('profiles')
      .select('email')
      .eq('id', lopChon[0].homeroom_teacher_id)
      .maybeSingle();
    const {data: g} = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: chuNhiem.email,
    });
    const {data: v} = await anon.auth.verifyOtp({
      type: 'email',
      token_hash: g.properties.hashed_token,
    });
    ck = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
  }
  const {data: wigs} = await admin
    .from('commitments')
    .select('id, class_id, week_start')
    .in('class_id', lopIds)
    .is('student_id', null);

  let mo = null;
  for (const ck of wigs ?? []) {
    const w = {...ck, start_date: ck.week_start};
    const {data: cb} = await admin.rpc('lead_measure_canh_bao', {p_commitment: w.id});
    // CHỈ `qua_nhieu`. Cảnh báo lệch đơn vị đã bỏ khỏi giao diện (15/08) — CSDL vẫn trả cờ ấy cho
    // ai muốn dựng lại sau, nhưng trang không vẽ nó nữa. Chọn theo cờ ấy là đi tìm trên màn hình
    // một thứ cố ý không còn ở đó, rồi báo "trang không vẽ cảnh báo".
    if ((cb ?? []).some((r) => r.qua_nhieu)) {
      mo = w;
      break;
    }
  }
  // KHÔNG CÓ CẢNH BÁO THẬT THÌ DỰNG LẤY MỘT CÁI, đừng bỏ qua.
  //
  // Bài này soi xem TRANG có vẽ cảnh báo ra không. Chờ dữ liệu thật rơi vào trạng thái cảnh báo
  // là chờ một chuyện không nên xảy ra — và càng sửa app cho đúng thì phép kiểm này càng không
  // bao giờ chạy. Nay tự đặt một việc có chỉ tiêu vượt trần rồi mở trang, xong xoá.
  //
  // Dựng ở một tuần TƯƠNG LAI để không đụng cam kết thật của lớp (và không đâm vào trần 2 cam
  // kết mỗi tuần của CSDL).
  let ckTam = null;
  if (!mo && lopIds.length) {
    const {data: wNam} = await admin
      .from('wigs')
      .select('id, class_id')
      .eq('class_id', lopIds[0])
      .eq('scope', 'class')
      .eq('period', 'year')
      .neq('measure_by', 'cuon')
      .limit(1)
      .maybeSingle();
    if (wNam) {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 70);
      // IN NGÀY THEO LỊCH ĐỊA PHƯƠNG, KHÔNG QUA toISOString(). Quy về UTC là lùi một hôm trong
      // khung 00:00–07:00 giờ VN — và một "thứ Hai" lùi thành Chủ nhật thì `cam_ket_hop_le` từ
      // chối thẳng, rồi bài này báo "không dựng nổi một cảnh báo" như thể app hỏng.
      const t2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const {data: c0} = await admin
        .from('commitments')
        .insert({wig_id: wNam.id, class_id: wNam.class_id, week_start: t2,
                 title: 'ZZTEST cảnh báo', area: 'knowledge'})
        .select('id')
        .maybeSingle();
      if (c0) {
        ckTam = c0.id;
        // Chỉ tiêu 9999 lượt trong một tuần: vượt trần dù lớp đông tới đâu.
        await admin.from('lead_measures').insert({
          commitment_id: ckTam, title: 'ZZTEST việc vượt trần', target_value: 9999,
          unit: 'bài', active_weekdays: [1], unit_per_tick: 1,
        });
        mo = {id: ckTam, class_id: wNam.class_id, start_date: t2};
      }
    }
  }

  if (!mo) {
    check('Trang /wig vẽ ra cảnh báo', false, 'không dựng nổi một cảnh báo để thử');
  } else {
    const monday = (() => {
      const d = new Date(`${mo.start_date}T00:00:00Z`);
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - (dow - 1));
      return d.toISOString().slice(0, 10);
    })();
    const r = await fetch(`${BASE}/wig?class=${mo.class_id}&week=${monday}`, {headers: {cookie: ck}});
    // Bỏ <script>: payload RSC mang cả chuỗi dịch, dò trên đó là dò trúng thứ không được vẽ ra.
    const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, '');
    // CHỮ CẢNH BÁO LẤY TỪ GÓI DỊCH. Bản cũ dò 'lần tick'; câu thật nay là "Mỗi em cần N LƯỢT
    // tick…" — một chữ đổi là phép kiểm báo trang không vẽ cảnh báo, trong khi nó vẽ đủ.
    const goiW = JSON.parse(readFileSync('messages/vi.json', 'utf8')).wig ?? {};
    const dauCau = (mau) => String(mau ?? '').split('{')[0].trim();
    const manh = [dauCau(goiW.warnTooMany), dauCau(goiW.warnUnitMismatch)].filter(Boolean);
    check(
      'Trang /wig vẽ ra cảnh báo',
      manh.some((m) => html.includes(m)),
      `cam kết ${mo.id.slice(0, 8)} · tuần ${monday}`,
    );
    if (ckTam) await admin.from('commitments').delete().eq('id', ckTam);
  }
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
