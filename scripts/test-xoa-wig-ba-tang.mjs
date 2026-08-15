// XOÁ MỘT MỤC TIÊU THÌ CẢ CHUỖI DƯỚI NÓ PHẢI ĐI THEO — không để lại thứ gì mồ côi.
//
//   node scripts/test-xoa-wig-ba-tang.mjs
//
// ── VÌ SAO BÀI NÀY ĐỔI HẲN NỘI DUNG (0121) ────────────────────────────────────────────────
//
// Bản cũ dựng cây năm → tháng → tuần rồi xoá từ gốc. Cây ấy không còn dựng được: `wig_chi_con_nam_ck`
// chỉ nhận period='year' và cấm parent_wig_id, nên bài cũ vỡ ngay ở câu chèn đầu tiên và đọc ra
// như thể app hỏng.
//
// Nhưng NỖI LO thì không đổi, chỉ đổi hình: nay chuỗi là mục tiêu năm → cam kết tuần → việc dẫn
// dắt → lượt tick. Xoá mục tiêu mà bỏ sót một tầng thì còn lại những dòng trỏ vào hư không — và
// tệ hơn cả sót là VƯỚNG: một khoá ngoại chặn giữa chừng để lại nửa cây đã xoá, nửa còn nguyên.
//
// Bài này KHÔNG đọc khai báo khoá ngoại rồi suy ra. Nó dựng thật bốn tầng rồi xoá thật, vì thứ
// cần biết là hành vi lúc chạy, không phải ý định lúc khai báo.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// Mượn một lớp thật để qua ràng buộc class_id, nhưng mọi thứ dựng ra là của riêng bài kiểm.
const {data: lop} = await admin
  .from('classes')
  .select('id')
  .eq('is_active', true)
  .limit(1)
  .single();
const nhan = 'KIEMTUDONG-XOA-' + Date.now().toString(36);

// Thứ Hai của một tuần xa trong tương lai: không đụng vào tuần nào lớp đang dùng thật, và
// `cam_ket_hop_le` đòi week_start đúng là thứ Hai.
const T2 = '2031-09-01'; // thứ Hai

let namId = null;
try {
  const {data: nam, error: eNam} = await admin
    .from('wigs')
    .insert({
      class_id: lop.id, scope: 'class', area: 'knowledge', period: 'year', period_label: nhan,
      start_date: '2031-07-01', end_date: '2032-06-30', title: nhan,
      target_value: 10, unit: 'buổi',
    })
    .select('id')
    .single();
  if (eNam) throw new Error('mục tiêu năm: ' + eNam.message);
  namId = nam.id;

  const {data: ck, error: eCk} = await admin
    .from('commitments')
    .insert({wig_id: namId, class_id: lop.id, week_start: T2, title: nhan, area: 'knowledge'})
    .select('id')
    .single();
  if (eCk) throw new Error('cam kết: ' + eCk.message);

  const {data: lm, error: eLm} = await admin
    .from('lead_measures')
    .insert({commitment_id: ck.id, title: nhan, target_value: 3, unit: 'buổi'})
    .select('id')
    .single();
  if (eLm) throw new Error('việc dẫn dắt: ' + eLm.message);

  const {error: eLp} = await admin
    .from('lead_progress')
    .insert({lead_measure_id: lm.id, value: 1, logged_date: T2});
  if (eLp) throw new Error('lượt tick: ' + eLp.message);

  dat(true, 'Dựng đủ bốn tầng: mục tiêu → cam kết → việc → lượt tick');

  // ── XOÁ TỪ GỐC, MỘT LỆNH ────────────────────────────────────────────────────────────────
  const {error: eXoa} = await admin.from('wigs').delete().eq('id', namId);
  dat(!eXoa, 'Xoá mục tiêu năm không vướng khoá ngoại nào', eXoa?.message ?? '');

  // ── KHÔNG TẦNG NÀO SÓT LẠI ──────────────────────────────────────────────────────────────
  // Đếm bằng CHÍNH ID đã dựng, không đếm theo nhãn: nhãn là chữ người đặt, id mới là thứ mà một
  // dòng mồ côi còn trỏ vào.
  const con = async (bang, cot, gt) =>
    (await admin.from(bang).select('id', {count: 'exact', head: true}).eq(cot, gt)).count ?? 0;

  const soCk = await con('commitments', 'wig_id', namId);
  const soLm = await con('lead_measures', 'commitment_id', ck.id);
  const soLp = await con('lead_progress', 'lead_measure_id', lm.id);
  const {count: soNam} = await admin
    .from('wigs')
    .select('id', {count: 'exact', head: true})
    .eq('id', namId);

  dat(soNam === 0, 'Mục tiêu năm đã đi', `còn ${soNam}`);
  dat(soCk === 0, 'Cam kết tuần đi theo', `còn ${soCk}`);
  dat(soLm === 0, 'Việc dẫn dắt đi theo', `còn ${soLm}`);
  dat(soLp === 0, 'Lượt tick đi theo — không còn dòng nào trỏ vào hư không', `còn ${soLp}`);
} finally {
  // Chạy trên CSDL thật thì không được để lại rác, kể cả khi vỡ giữa chừng.
  if (namId) await admin.from('wigs').delete().eq('id', namId);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
