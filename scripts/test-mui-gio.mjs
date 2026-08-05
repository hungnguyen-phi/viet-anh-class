// Ngày phải là NGÀY Ở VIỆT NAM, không phải ngày ở máy chủ.
//
// Máy chủ Postgres chạy UTC. Việt Nam là UTC+7. Nên từ 00h00 đến 07h00 giờ Việt Nam, `current_date`
// của máy chủ VẪN LÀ HÔM QUA:
//
//     6h45 ngày 06/08 giờ Việt Nam  =  23h45 ngày 05/08 giờ UTC
//
// Cửa sổ check-in buổi sáng (6h30–7h00) nằm TRỌN trong vùng ấy. student_checkin() từng dùng
// current_date nên mọi lượt điểm danh buổi sáng bị ghi sang hôm trước — sổ hôm nay trống, sổ hôm
// qua mọc thêm một loạt em có mặt. Sửa ở migration 0090.
//
// Bài kiểm có hai tầng, và tầng đầu mới là tầng đáng tin:
//   · CẤU TRÚC — hỏi CSDL xem còn hàm nào lấy ngày theo giờ máy chủ. Bắt được lỗi VÀO BẤT KỲ GIỜ
//     NÀO trong ngày.
//   · HÀNH VI  — so vn_today() của CSDL với ngày Việt Nam tính độc lập bằng JS. Chỉ chứng minh
//     được điều gì khi chạy trong khoảng 0h–7h giờ Việt Nam; ngoài khoảng đó hai ngày trùng nhau
//     nên nó luôn xanh. Bài kiểm sẽ NÓI RÕ điều này thay vì im lặng nhận công.
//
//   node scripts/test-mui-gio.mjs
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

const vn = (opts) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh', ...opts}).format(new Date());
const ngayVN = vn({year: 'numeric', month: '2-digit', day: '2-digit'});
const gioVN = Number(
  new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false}).format(new Date()),
);

// ── 1. CẤU TRÚC: không hàm nào được lấy "hôm nay" theo giờ máy chủ ───────────────────────
{
  const {data, error} = await svc.rpc('ham_lay_ngay_may_chu');
  if (error) {
    dat(false, 'Gọi được hàm soi ngày máy chủ', error.message);
  } else {
    const ten = (data ?? []).map((r) => r.ten ?? r);
    dat(ten.length === 0, 'Không hàm nào lấy "hôm nay" theo giờ máy chủ', ten.join(', ') || 'sạch');
  }
}

// ── 2. student_checkin phải dùng vn_today() ──────────────────────────────────────────────
// Kiểm riêng vì đây là hàm đã từng sai, và là hàm duy nhất chạy trong đúng cửa sổ nguy hiểm.
{
  const {data, error} = await svc.rpc('ham_lay_ngay_may_chu');
  const ten = error ? [] : (data ?? []).map((r) => r.ten ?? r);
  dat(!ten.includes('student_checkin'), 'student_checkin không còn dùng current_date');
}

// ── 3. HÀNH VI: vn_today() của CSDL khớp ngày Việt Nam tính bằng JS ──────────────────────
{
  const {data, error} = await svc.rpc('vn_today');
  dat(!error && data === ngayVN, 'vn_today() khớp ngày Việt Nam', `CSDL ${data} · JS ${ngayVN}`);
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
if (gioVN >= 7) {
  console.log(
    `\nGHI CHÚ  Bây giờ ${gioVN}h giờ Việt Nam. Bài số 3 chỉ phân biệt được đúng/sai trong khoảng`,
    '0h–7h; ngoài khoảng đó ngày máy chủ và ngày Việt Nam trùng nhau nên nó xanh mà không chứng',
    'minh gì. Bài 1 và 2 thì đúng ở mọi giờ.',
  );
}
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
