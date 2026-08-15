// Mọi màn hình đọc cùng một dữ liệu phải ra CÙNG một con số cho cùng một tuần.
//
// VÌ SAO CẦN. Sự cố 03/08/2026 không phải lỗi tính toán mà là lỗi HAI LUẬT LỌC: trang GVCN lấy
// mọi WIG scope='class' không lọc ngày, còn màn hình học sinh chỉ lấy WIG giao với tuần lịch.
// Bản vá 4fb2e7e chữa trang /wig, nhưng rà soát sau đó tìm thấy cùng con bệnh còn sống ở bốn chỗ
// nữa — trong đó có TRANG CHỦ, tức màn hình GVCN mở đầu tiên. Không phép kiểm nào lúc ấy bắt được
// vì mọi trang đều trả 200 và mọi con số đều "đúng" theo luật của riêng nó.
//
// Phép kiểm này không soi từng trang riêng lẻ mà soi SỰ KHỚP NHAU giữa chúng: cùng một lớp, cùng
// một tuần, thì cái GVCN thấy phải bằng cái học sinh thấy, và bằng cái CSDL nói.
//
//   node scripts/test-mot-luat-mot-tuan.mjs [http://localhost:6871]
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

async function ck(email) {
  const {data: g, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(email + ': ' + error.message);
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: g.properties.hashed_token,
  });
  if (e2) throw new Error(email + ': ' + e2.message);
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
}

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};
// Bỏ <script> trước khi dò: payload RSC trong đó mang cả dữ liệu thô của truy vấn, kể cả phần
// giao diện đã lọc bỏ. Dò cả payload thì phép kiểm lúc đỏ lúc xanh tuỳ đợt stream — xem ghi chú
// dài hơn ở scripts/test-week-nav.mjs.
const get = async (path, cookie) => {
  const r = await fetch(BASE + path, {headers: {cookie}, redirect: 'manual'});
  const raw = await r.text();
  return {
    status: r.status,
    loc: r.headers.get('location'),
    html: raw.replace(/<script[\s\S]*?<\/script>/gi, ''),
    raw,
  };
};

const ckGv = await ck('test1.gvcn@truongvietanh.com');
const {data: gv} = await admin
  .from('profiles')
  .select('id')
  .eq('email', 'test1.gvcn@truongvietanh.com')
  .single();
// LỚP ĐỂ ĐO: ưu tiên lớp của tài khoản kiểm thử, nhưng KHÔNG bám cứng vào nó. test1.gvcn hiện
// không còn chủ nhiệm lớp nào, và bám cứng thì bộ kiểm nổ ngay ở khâu tra cứu ('lop' là null)
// chứ không kịp đo điều nó sinh ra để đo. Lớp thay người chủ nhiệm là chuyện thường ở trường.
const {data: dsLop} = await admin
  .from('classes')
  .select('id, name, homeroom_teacher_id')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .order('name');
let lop = null;
for (const c of dsLop ?? []) {
  const {count} = await admin
    .from('enrollments')
    .select('student_id', {count: 'exact', head: true})
    .eq('class_id', c.id)
    .eq('is_active', true);
  if (!count) continue;
  if (!lop || c.homeroom_teacher_id === gv?.id) lop = c;
  if (c.homeroom_teacher_id === gv?.id) break;
}
if (!lop) {
  console.log('BỎ QUA: không lớp nào vừa có GVCN vừa có học sinh đang học — CHƯA KIỂM ĐƯỢC.');
  process.exit(1);
}
const {data: mon} = await admin.rpc('vn_week_start');
const monday = String(mon).slice(0, 10);
const end = new Date(`${monday}T00:00:00Z`);
end.setUTCDate(end.getUTCDate() + 6);
const sunday = end.toISOString().slice(0, 10);
console.log(`Lớp ${lop.name} · tuần ${monday} → ${sunday}\n`);

// ── 1. Nguồn sự thật: RPC mà màn hình học sinh dùng ──
const {data: board} = await admin.rpc('class_lead_board', {p_class: lop.id, p_week_start: monday});
const viecTuanNay = (board ?? []).map((b) => b.title);
console.log(`class_lead_board (thứ học sinh thấy): ${viecTuanNay.length} việc chung tuần này`);

// Các lead measure của WIG lớp KHÔNG thuộc tuần này — chúng phải vắng mặt ở mọi màn hình "tuần này".
const {data: leadNgoai} = await admin
  .from('lead_measures')
  .select('title, wigs!inner(scope, period, start_date, end_date, class_id)')
  .eq('wigs.class_id', lop.id)
  .eq('wigs.scope', 'class')
  .eq('wigs.period', 'week');
const tenTrong = new Set(viecTuanNay);
const tenNgoai = [
  ...new Set(
    (leadNgoai ?? [])
      .filter((l) => !(l.wigs.start_date <= sunday && l.wigs.end_date >= monday))
      .map((l) => l.title),
  ),
].filter((t) => !tenTrong.has(t));
console.log(`Việc của WIG lớp thuộc tuần KHÁC: ${tenNgoai.length}\n`);

// ── 2. TRANG CHỦ — khối "Lead measure tuần này" ──
// Đây đúng chỗ đã hỏng: nó từng gom lead của MỌI WIG tuần từ đầu năm.
{
  const {html, status} = await get(`/?class=${lop.id}`, ckGv);
  check('Trang chủ mở được', status === 200, `HTTP ${status}`);
  const thieu = viecTuanNay.filter((t) => !html.includes(t));
  const lot = tenNgoai.filter((t) => html.includes(t));
  check('Trang chủ hiện đủ việc CỦA TUẦN NÀY', thieu.length === 0, thieu.join(', ') || `${viecTuanNay.length} việc`);
  check(
    'Trang chủ KHÔNG hiện việc của tuần khác',
    lot.length === 0,
    lot.length ? 'lọt: ' + lot.join(', ') : `${tenNgoai.length} việc tuần khác`,
  );
}

// ── 3. /wig — phải khớp trang chủ (cùng tuần hiện tại) ──
//
// CHỈ SOI DANH SÁCH WIG, bỏ hai cái BẢNG. Khối họp cố ý hiển thị tuần vừa xong (0081: buổi họp
// tổng kết tuần đã kết thúc) và bảng tick cũng theo tuần riêng, nên tên việc của tuần khác xuất
// hiện trong đó là đúng thiết kế. Dò cả trang thì phép kiểm báo lỗi cho hành vi cố ý.
//
// CẮT THEO CẤU TRÚC, KHÔNG THEO VỊ TRÍ. Đã thử cắt từ mốc chữ "Tạo WIG năm" và sai: Next.js
// stream các server component nên thứ tự trong HTML thô KHÔNG theo thứ tự khai báo trong JSX —
// khối họp nằm trên trong mã lại đến sau trong luồng. Danh sách WIG dùng <ul>/<li>, còn cả hai
// bảng kia đều là <table>, nên bỏ <table> đi là còn đúng phần cần soi, bất kể thứ tự stream.
{
  const {html: full} = await get(`/wig?class=${lop.id}`, ckGv);
  const html = full.replace(/<table[\s\S]*?<\/table>/gi, '');
  const thieu = viecTuanNay.filter((t) => !html.includes(t));
  const lot = tenNgoai.filter((t) => html.includes(t));
  check('/wig hiện đủ việc của tuần này', thieu.length === 0, thieu.join(', '));
  check(
    '/wig KHÔNG hiện việc của tuần khác trong danh sách WIG',
    lot.length === 0,
    lot.length ? 'lọt: ' + lot.join(', ') : `${tenNgoai.length} việc tuần khác`,
  );
}

// ── 4. Thanh tiến độ phải BẰNG số ô vàng — không được thắng bằng tick ngoài kỳ ──
//
// Lỗi đã có thật trên production: một WIG cá nhân hiện "5/5 ĐẠT" trong khi màn hình của em chỉ
// có 4 ô vàng — em thắng nhờ một lượt tick nằm ngoài tuần của WIG đó.
//
// Dữ liệu lệch VẪN ĐƯỢC PHÉP tồn tại (GVCN chữa lại ngày là xong, không ai muốn mất dòng tick).
// Điều phải luôn đúng là: cột `actual` của wig_progress_v — tức thanh tiến độ và điều kiện thắng —
// chỉ đếm phần NẰM TRONG kỳ, đúng bằng số ô mà màn hình vẽ ra.
{
  const {data: wigs} = await admin
    .from('wigs')
    .select('id, period_label, start_date, end_date, lead_measures(id, lead_progress(value, logged_date))')
    .eq('period', 'week');
  const {data: prog} = await admin.from('wig_progress_v').select('wig_id, actual').eq('period', 'week');
  const actualBy = new Map((prog ?? []).map((p) => [p.wig_id, Number(p.actual ?? 0)]));

  let soLech = 0;
  const sai = [];
  for (const w of wigs ?? []) {
    let trongKy = 0;
    let tatCa = 0;
    for (const lm of w.lead_measures ?? []) {
      for (const p of lm.lead_progress ?? []) {
        const v = Number(p.value ?? 0);
        tatCa += v;
        if (p.logged_date >= w.start_date && p.logged_date <= w.end_date) trongKy += v;
      }
    }
    if (tatCa !== trongKy) soLech += 1;
    const actual = actualBy.get(w.id);
    // Chỉ xét WIG mà view thật sự trả về (RLS/scope có thể lọc bớt).
    if (actual !== undefined && actual !== trongKy) {
      sai.push(`${w.period_label ?? w.id}: thanh=${actual} nhưng trong kỳ=${trongKy}`);
    }
  }
  check(
    'Thanh tiến độ chỉ đếm tick TRONG kỳ (không thắng bằng tick ngoài tuần)',
    sai.length === 0,
    sai.length ? sai.slice(0, 3).join(' · ') : `${(wigs ?? []).length} WIG tuần, ${soLech} có tick ngoài kỳ`,
  );
}

// ── 5. Vai HIỆU TRƯỞNG: mọi link trên bảng của họ phải mở được, không bị đá ngược ──
{
  const ckBgh = await ck('test2.bgh@truongvietanh.com');
  const {html, status} = await get('/campus', ckBgh);
  check('BGH mở được /campus', status === 200, `HTTP ${status}`);
  // Lấy mọi href nội bộ trong bảng rồi thử từng cái — link nào redirect ngược về /campus là ngõ cụt.
  const hrefs = [...new Set([...html.matchAll(/href=\\?"(\/(?:vi\/|en\/)?(?:wig|meeting)\?[^"\\]*)/g)].map((m) => m[1]))];
  let cut = 0;
  for (const h of hrefs.slice(0, 6)) {
    const r = await get(h.replace(/&amp;/g, '&'), ckBgh);
    if (r.status >= 300 && r.status < 400 && String(r.loc ?? '').includes('/campus')) cut += 1;
  }
  check(
    'Link trên bảng WIG của BGH không phải ngõ cụt',
    cut === 0,
    `${hrefs.length} link, ${cut} bị đá ngược`,
  );
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
