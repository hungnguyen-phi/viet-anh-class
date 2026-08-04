// Bảng họp WIG — phần TẦNG ỨNG DỤNG (0079).
//
// Phần CSDL và ranh giới quyền nằm ở scripts/test-bang-hop-wig.sql (chạy trong transaction
// rollback, đổi vai qua request.jwt.claims). File này giữ ba chốt chặn cho những lỗi mà rà soát
// đối kháng vừa bắt được — chúng thuộc tầng ứng dụng nên không soi từ SQL được (Supabase chặn
// pg_read_file), và cả ba đều là loại lỗi im lặng: màn hình vẫn đẹp, không ai biết có gì sai.
//
//   node scripts/test-bang-hop-wig.mjs [http://localhost:6871]
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

const table = readFileSync('components/wig/MeetingTable.tsx', 'utf8');
const act = readFileSync('app/[locale]/(dashboard)/meeting/actions.ts', 'utf8');

// ── 1. Bảng chỉ hiện số của TUẦN ĐANG TỔNG KẾT ──
//
// Bản đầu có thêm cột "Tuần trước" để đối chiếu; chủ dự án chốt bỏ (2026-08-04): buổi họp bàn về
// một tuần, trộn số tuần khác vào chỉ làm rối. Cột ấy cũng từng hỏng vì ghép theo lead_measure_id
// — mỗi tuần một bộ id mới nên không dòng nào khớp, cột hiện "—" ở mọi dòng.
check(
  'Bảng chỉ hiện số của tuần đang tổng kết',
  /colResult/.test(table) && !/colLastWeek/.test(table) && !/truocByTen|truocById/.test(table),
  /truocByTen|truocById/.test(table) ? 'vẫn còn map tuần trước' : '',
);

// ── 2. Chỉ xoá ghi nhận mà người bấm Lưu ĐÃ NHÌN THẤY ──
// Nút "chưa chấm" tích sẵn cho mọi dòng chưa có ghi nhận, nên mỗi lần lưu là form gửi lên một
// danh sách rỗng dài bằng cả bảng. Không lọc theo ảnh chụp thì thầy A bấm Lưu sẽ xoá mất ghi chú
// cô B vừa ghi, không một lời báo.
check(
  'Chỉ xoá ghi nhận mà người bấm Lưu đã nhìn thấy',
  /v\.daCo/.test(act) && /name=\{`co_\$\{r\.lead_measure_id\}`\}/.test(table),
  '',
);

// ── 3. Bảng trắng bấm Lưu thì KHÔNG báo "đã xoá" ──
check('Lưu bảng trắng nói đúng việc, không báo "đã xoá"', /không có gì để lưu/.test(act), '');

// ── 4. Lưu xong quay về ĐÚNG TRANG vừa đứng ──
// Bảng nhúng ở cả /wig lẫn /meeting (BGH chỉ vào được trang sau). Đoán mò là ném người ta sang
// trang khác — đúng lỗi deleteMeeting vừa phải sửa vì cùng lý do.
check(
  'Lưu xong quay về đúng trang vừa đứng',
  /name="from"/.test(table) && /=== 'meeting' \? '\/meeting' : '\/wig'/.test(act),
  '',
);

// ── 5. Ba nút: thắng · thua · CHƯA CHẤM ──
// Radio đã chọn thì HTML không có cách bỏ chọn. Thiếu nút thứ ba, giáo viên bấm nhầm là kẹt luôn.
check('Có nút "chưa chấm" để gỡ khi bấm nhầm', /verdictNone/.test(table), '');

// ── 6. Trang thật có vẽ ra bảng không ──
{
  const {data: g} = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'test1.gvcn@truongvietanh.com',
  });
  const {data: v} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
  const ck = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;

  // Mở đúng tuần có việc chung, nếu không thì bảng tự ẩn (rows rỗng → return null).
  const {data: gv} = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'test1.gvcn@truongvietanh.com')
    .single();
  const {data: lops} = await admin.from('classes').select('id').eq('homeroom_teacher_id', gv.id);
  const {data: w} = await admin
    .from('wigs')
    .select('class_id, start_date, lead_measures(id)')
    .in('class_id', (lops ?? []).map((c) => c.id))
    .eq('scope', 'class')
    .eq('period', 'week')
    .limit(20);
  const coViec = (w ?? []).find((x) => (x.lead_measures ?? []).length > 0);

  if (!coViec) {
    check('Trang /wig vẽ ra bảng họp', false, 'không có WIG tuần nào kèm việc để mở');
  } else {
    const d = new Date(`${coViec.start_date}T00:00:00Z`);
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow - 1));
    const monday = d.toISOString().slice(0, 10);
    const r = await fetch(`${BASE}/wig?class=${coViec.class_id}&week=${monday}`, {headers: {cookie: ck}});
    // Bỏ <script>: payload RSC mang cả chuỗi dịch, dò trên đó là dò trúng thứ không được vẽ ra.
    const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, '');
    check(
      'Trang /wig vẽ ra bảng họp',
      /Cầm bảng này mà họp/.test(html) && /name="verdict_/.test(html) && /name="note_/.test(html),
      `tuần ${monday}`,
    );
    check(
      'Bảng nói rõ đang tổng kết tuần nào, và có ô Rút ra',
      /Đang tổng kết tuần W\d{2}-\d{4}/.test(html) && /Rút ra điều gì/.test(html),
      '',
    );
  }
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
