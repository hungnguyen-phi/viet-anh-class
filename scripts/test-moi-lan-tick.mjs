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
  const {data: wigs} = await admin
    .from('wigs')
    .select(
      'id, unit, scope, class_id, start_date, end_date, lead_measures(id, target_value, unit, active_weekdays, unit_per_tick)',
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

  let lech = [];
  let soCanhBao = 0;
  for (const w of wigs ?? []) {
    if (!(w.lead_measures ?? []).length) continue;
    const {data: sql} = await admin.rpc('lead_measure_canh_bao', {p_wig: w.id});
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
      // WIG lớp: cả lớp cùng tick → trần = ngày × sĩ số. WIG cá nhân: chỉ một em.
      js.so_nguoi = w.scope === 'class' ? Math.max(siSo.get(w.class_id) ?? 0, 1) : 1;
      js.tran = js.so_ngay * js.so_nguoi;
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
  const chung = readFileSync('lib/wig-tao.ts', 'utf8');
  const src = readFileSync('app/[locale]/(dashboard)/wig/actions.ts', 'utf8');
  const co = /raw\.trim\(\) === ''\)\s*return null/.test(chung);
  const boQua = /upt === null \? \{\} : \{unit_per_tick: upt\}/.test(src);
  check(
    'Ô rỗng không ghi đè hệ số (server)',
    co && boQua,
    co ? (boQua ? '' : 'thiếu chỗ bỏ cột') : 'chuanHoaHeSo vẫn nuốt rỗng',
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

// ── 4c. "em góp N lượt" phải đếm LẦN BẤM, không phải đơn vị đã quy đổi ──
// Với hệ số 30, em tick 3 tối sẽ thấy 3 ô vàng — mà câu bên dưới từng in "em góp 90 lượt".
{
  const src = readFileSync('components/student/LeadTicker.tsx', 'utf8');
  const sai = /myContrib', \{n: mine\}/.test(src);
  check('Câu “em góp N lượt” đếm theo lần bấm', !sai, sai ? 'vẫn dùng `mine` (đã nhân hệ số)' : '');
}

// ── 5. Trang /wig có VẼ RA cảnh báo không ──
{
  const {data: g} = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'test1.gvcn@truongvietanh.com',
  });
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  const ck = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

  // Tìm một WIG tuần đang có cảnh báo, mở đúng tuần của nó.
  const {data: gv} = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'test1.gvcn@truongvietanh.com')
    .single();
  const {data: lops} = await admin.from('classes').select('id').eq('homeroom_teacher_id', gv.id);
  const lopIds = (lops ?? []).map((c) => c.id);
  const {data: wigs} = await admin
    .from('wigs')
    .select('id, class_id, start_date')
    .in('class_id', lopIds)
    .eq('scope', 'class')
    .eq('period', 'week');

  let mo = null;
  for (const w of wigs ?? []) {
    const {data: cb} = await admin.rpc('lead_measure_canh_bao', {p_wig: w.id});
    if ((cb ?? []).some((r) => r.qua_nhieu || r.lech_don_vi)) {
      mo = w;
      break;
    }
  }
  if (!mo) {
    check('Trang /wig vẽ ra cảnh báo', false, 'không tìm được WIG nào đang cảnh báo để mở');
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
    check(
      'Trang /wig vẽ ra cảnh báo',
      /lần tick|tickable days/i.test(html) || /đo bằng|Measured in/i.test(html),
      `WIG ${mo.id.slice(0, 8)} · tuần ${monday}`,
    );
  }
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
