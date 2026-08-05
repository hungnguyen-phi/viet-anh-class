// Màn Quản trị phải DỰNG ĐƯỢC với phiên đăng nhập thật, và dựng ra đúng thứ nó hứa.
//
// Vì sao có file này: bản dựng lại /admin từng lên production trong trạng thái hỏng hoàn toàn —
// mọi lần mở đều văng màn hình lỗi — mà `tsc` sạch và `next build` sạch. Lý do: /admin là trang
// render theo yêu cầu nên không được dựng thử lúc build, và cả hai bài kiểm kia chỉ đọc kiểu chứ
// không dựng trang. Nói cách khác "build xanh" chưa bao giờ là bằng chứng trang chạy được.
//
// Bài kiểm này dựng trang thật với cookie thật rồi đọc HTML trả về.
//
//   node scripts/test-admin-man.mjs [BASE]     mặc định http://localhost:6899
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6899';
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

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

const cookie = await ck('test3.admin@truongvietanh.com');
const lay = async (duong) => {
  const r = await fetch(BASE + duong, {headers: {cookie}, redirect: 'manual'});
  return {status: r.status, html: r.status === 200 ? await r.text() : ''};
};

// ── 1. Trang dựng được ────────────────────────────────────────────────────────────────────
const goc = await lay('/admin');
dat(goc.status === 200, 'Trang /admin dựng được với phiên quản trị', `HTTP ${goc.status}`);
if (goc.status !== 200) {
  // Không có HTML thì mọi bài dưới đều vô nghĩa — dừng sớm, đừng đổ một loạt lỗi giả.
  for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
  console.log('\nDừng sớm: trang không dựng được.');
  process.exit(1);
}

// ── 2. Không còn dấu gạch ngang thay cho dữ liệu ──────────────────────────────────────────
// Một ô chỉ chứa "—" không nói được là dữ liệu thiếu hay hệ thống hỏng, và chủ dự án đã yêu cầu
// bỏ hẳn lối trình bày này.
const oGachNgang = (goc.html.match(/>\s*—\s*</g) ?? []).length;
dat(oGachNgang === 0, 'Không ô nào chỉ chứa một dấu gạch ngang', `tìm thấy ${oGachNgang}`);

// ── 3. Bảng người dùng có ngữ nghĩa cho trình đọc màn hình ────────────────────────────────
dat(goc.html.includes('role="table"'), 'Bảng người dùng khai role="table"');
const soCot = (goc.html.match(/role="columnheader"/g) ?? []).length;
dat(soCot === 5, 'Đủ năm tiêu đề cột', `${soCot}/5`);

// ── 4. Mỗi dòng có tên đọc được RIÊNG, không dùng chung một nhãn ──────────────────────────
// Đây là bảng có nút xoá vĩnh viễn. Năm mươi nút cùng tên "Xoá" nghĩa là người dùng trình đọc
// màn hình phải đoán mình đang xoá ai.
const nhan = [...goc.html.matchAll(/aria-label="(Xoá|Đổi vai trò cho|Vai trò của)[^"]*"/g)].map((m) => m[0]);
const nhanRieng = new Set(nhan);
dat(
  nhan.length === 0 || nhanRieng.size === nhan.length,
  'Nhãn thao tác của mỗi dòng là riêng biệt',
  `${nhanRieng.size} nhãn khác nhau / ${nhan.length} nút`,
);

// ── 5. Cỡ trang bị chặn trong danh sách cho phép ──────────────────────────────────────────
// ?size=100000 là một cách kéo toàn bộ PII của trường về trong một payload.
const demDong = (html) => (html.match(/role="row"/g) ?? []).length - 1; // trừ dòng tiêu đề
const tham = await lay('/admin?size=100000');
dat(tham.status === 200 && demDong(tham.html) <= 10, 'size ngoài danh sách bị ép về mặc định 10 dòng', `${demDong(tham.html)} dòng`);

const size25 = await lay('/admin?size=25');
dat(size25.status === 200 && demDong(size25.html) > 10, 'size=25 thật sự trả nhiều dòng hơn', `${demDong(size25.html)} dòng`);

// ── 6. Số trên tab bằng đúng số dòng bấm vào sẽ thấy ──────────────────────────────────────
// Hàm admin_user_counts (migration 0085) và truy vấn bảng là hai câu SQL khác nhau. Chúng phải
// dùng cùng một phép so khớp, nếu không người dùng thấy "Giáo viên (3)" rồi bấm vào ra bảng rỗng
// — kiểu lỗi không ai báo được thành lời, họ chỉ thôi tin cả màn hình.
const doSoTab = (html, vai) => {
  // Đọc số ngay sau đường dẫn của tab đó, thay vì dò theo nhãn tiếng Việt — nhãn đổi được (và đã
  // đổi: "Giáo viên" thành "Giáo viên chủ nhiệm"), đường dẫn thì không.
  // String.raw: trong template literal thường, `\d` bị nuốt thành `d` — regex thành (d+) và không
  // khớp gì cả, nhưng bài kiểm vẫn "chạy", chỉ là luôn báo không đọc được.
  const m = html.match(new RegExp(String.raw`vai=${vai}[^"]*"[^>]*>[^<]*<span[^>]*>(\d+)<`));
  return m ? Number(m[1]) : null;
};
for (const vai of ['teacher', 'principal', 'student', 'parent']) {
  const bang = await lay(`/admin?vai=${vai}&size=100`);
  const tren = doSoTab(goc.html, vai);
  dat(
    tren !== null && bang.status === 200 && tren === demDong(bang.html),
    `Số trên tab ${vai} khớp số dòng thật`,
    tren === null ? 'KHÔNG đọc được số trên tab' : `tab ghi ${tren}, bảng có ${demDong(bang.html)}`,
  );
}

// ── 7. Tìm không ra thì nói bằng câu, không bỏ trống ──────────────────────────────────────
const khong = await lay('/admin?q=zzzzkhongtontai');
dat(
  khong.status === 200 && /Không tìm thấy ai khớp/.test(khong.html),
  'Tìm không ra có câu giải thích tử tế',
);

// ── 8. Lọc theo vai thật sự lọc ───────────────────────────────────────────────────────────
const hs = await lay('/admin?vai=student&size=100');
const coGiaoVien = /Giáo viên<\/span>/.test(hs.html.split('role="table"')[1] ?? '');
dat(hs.status === 200 && !coGiaoVien, 'Tab Học sinh không lẫn vai khác');

// ── 9. Các mục nặng gấp lại được, không bày hết ra ────────────────────────────────────────
const soDetails = (goc.html.match(/<details/g) ?? []).length;
dat(soDetails >= 3, 'Các mục dùng-mỗi-năm-một-lần đều gấp lại được', `${soDetails} mục`);

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
