// NĂM HỌC BẮT ĐẦU 01/07 — và NHÃN với KHOẢNG NGÀY phải nói cùng một chuyện.
//
// Vì sao có file này: trước 06/08/2026, nhãn năm học đổi ở THÁNG 6 còn khoảng ngày lại là
// 01/09 → 31/05. Hai mốc khác nhau nên có ba tháng (6, 7, 8) mang nhãn '2026-2027' mà lại NẰM
// NGOÀI khoảng ngày của chính năm học ấy. Chủ dự án tạo mục tiêu năm vào tháng 8, nó nhận
// start_date 2026-09-01, thế là mọi mục tiêu tháng và tuần treo dưới đều bị đẩy về sau tháng 9 —
// trong khi trường đã vào năm học từ tháng 7.
//
// Lỗi ấy không phải sai một con số, mà là HAI NƠI KHAI CÙNG MỘT MỐC rồi trôi khỏi nhau. Nên phép
// kiểm ở đây không hỏi "tháng mấy", nó hỏi: có ngày nào của lịch rơi ra ngoài năm học của chính
// nó không. Còn đúng bất biến ấy thì đổi mốc kiểu gì cũng không tái lập được lỗi cũ.
//
// Nơi khai thứ ba là DB (current_school_year, migration 0093). Có DATABASE_URL thì kiểm luôn cả
// nó — hàm DB và lib/dates.ts lệch nhau là màn hình và dữ liệu nói hai chuyện khác nhau.
//
//   node scripts/test-nam-hoc.mjs
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  schoolYearLabel,
  schoolYearRangeVN,
  schoolYearOptions,
  ngayCuaKy,
  NGAY_DAU_NAM_HOC,
  NGAY_CUOI_NAM_HOC,
} from '../lib/dates.ts';

let dat = 0, hong = 0;
const ok = (ten, c, ghi = '') => {
  c ? dat++ : hong++;
  console.log(`${c ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// Giữa trưa UTC = 19h giờ VN cùng ngày: mốc nào cũng cách biên ngày 12 tiếng, không trượt.
const trua = (ngay) => new Date(`${ngay}T12:00:00Z`);

// ── BẤT BIẾN: không ngày nào rơi ra ngoài năm học của chính nó ──────────────────────────────
// Quét đủ 24 tháng để bắt cả hai lần chuyển mốc, và cả ngày đầu lẫn ngày cuối mỗi tháng.
let lot = [];
for (let i = 0; i < 24; i++) {
  const t = new Date(Date.UTC(2026, i, 1));
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const cuoi = new Date(Date.UTC(y, t.getUTCMonth() + 1, 0)).getUTCDate();
  for (const ngay of [`${y}-${m}-01`, `${y}-${m}-${cuoi}`]) {
    const r = schoolYearRangeVN(trua(ngay));
    if (ngay < r.start || ngay > r.end) lot.push(`${ngay} ∉ ${r.label} (${r.start}→${r.end})`);
  }
}
ok('Mọi ngày đều nằm trong năm học mang nhãn của nó', lot.length === 0, lot.slice(0, 3).join('; '));

// ── MỐC CHUYỂN đúng ở 01/07, không phải 01/06 cũng không phải 01/09 ─────────────────────────
ok('30/06/2026 vẫn là năm học 2025-2026', schoolYearLabel(trua('2026-06-30')) === '2025-2026', schoolYearLabel(trua('2026-06-30')));
ok('01/07/2026 đã sang năm học 2026-2027', schoolYearLabel(trua('2026-07-01')) === '2026-2027', schoolYearLabel(trua('2026-07-01')));
ok('Tháng 8 — lúc chủ dự án báo lỗi — là 2026-2027', schoolYearLabel(trua('2026-08-06')) === '2026-2027', schoolYearLabel(trua('2026-08-06')));

// Chính cảnh đã hỏng: tạo mục tiêu năm ngày 06/08/2026 thì start_date phải là 01/07, không phải 01/09.
const r8 = schoolYearRangeVN(trua('2026-08-06'));
ok('Mục tiêu năm tạo ngày 06/08 nhận start_date 2026-07-01', r8.start === '2026-07-01', r8.start);
ok('… và end_date 2027-06-30', r8.end === '2027-06-30', r8.end);

// ── BA NƠI SINH KHOẢNG NGÀY phải cho cùng một kết quả ───────────────────────────────────────
// schoolYearRangeVN, schoolYearOptions và ngayCuaKy đều tự dựng chuỗi ngày. Trước đây mỗi nơi
// chép tay '-09-01' riêng, nên sửa mốc là phải nhớ đủ cả ba — kiểu sót chỉ lộ khi đã lên production.
const moc = trua('2026-08-06');
const opt = schoolYearOptions(2, moc);
ok('schoolYearOptions mở đầu bằng năm học hiện tại', opt[0].label === '2026-2027', opt[0].label);
ok('schoolYearOptions cho cùng khoảng với schoolYearRangeVN',
   opt[0].start === r8.start && opt[0].end === r8.end, `${opt[0].start}→${opt[0].end}`);
const qua = ngayCuaKy('year', '2026-2027', moc);
ok('ngayCuaKy cho cùng khoảng với schoolYearRangeVN',
   qua?.start === r8.start && qua?.end === r8.end, `${qua?.start}→${qua?.end}`);
ok('Hằng số mốc đúng 01/07 và 30/06', NGAY_DAU_NAM_HOC === '-07-01' && NGAY_CUOI_NAM_HOC === '-06-30',
   `${NGAY_DAU_NAM_HOC} / ${NGAY_CUOI_NAM_HOC}`);

// Năm học liền kề phải nối liền nhau, không chồng lấn cũng không hở ngày nào.
ok('Năm học sau bắt đầu ngay sau khi năm trước kết thúc',
   opt[1].start === '2027-07-01' && opt[0].end === '2027-06-30', `${opt[0].end} → ${opt[1].start}`);

// ── NƠI KHAI THỨ BA: hàm current_school_year() trong DB ─────────────────────────────────────
function docEnv() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const url = {...docEnv(), ...process.env}.DATABASE_URL;
if (!url) {
  console.log('BỎ  Không có DATABASE_URL nên không đối chiếu được current_school_year() của DB');
} else {
  const pg = (await import('pg')).default;
  const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});
  await client.connect();
  try {
    // Ép sang text NGAY TRONG SQL: kiểu `date` về tới node thành Date giờ máy, và mọi lần quy đổi
    // lại là một cơ hội trượt sang ngày khác — đúng loại lỗi lib/dates.ts sinh ra để tránh.
    const {rows} = await client.query("select current_school_year() as nhan, vn_today()::text as hom_nay");
    // So bằng ngày CỦA DB chứ không phải ngày của máy chạy test: hai máy có thể khác múi giờ,
    // và thứ cần kiểm là hai hàm có cùng luật không, không phải hai đồng hồ có cùng giờ không.
    const homNay = String(rows[0].hom_nay).slice(0, 10);
    const mongDoi = schoolYearLabel(trua(homNay));
    ok(`DB current_school_year() khớp schoolYearLabel (ngày DB ${homNay})`,
       rows[0].nhan === mongDoi, `DB=${rows[0].nhan} · lib=${mongDoi}`);
  } finally {
    await client.end();
  }
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
