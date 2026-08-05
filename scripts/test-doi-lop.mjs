// Dời học sinh sang lớp khác — kiểm ĐÚNG LUẬT bằng ba tài khoản thật.
//
// Luật (chủ dự án ra):
//   · GVCN lớp hiện tại đề nghị dời.
//   · GVCN lớp ĐÍCH duyệt hoặc từ chối.
//   · Trong lúc chờ, em VẪN Ở LỚP CŨ.
//   · Quản trị chuyển thẳng, không cần duyệt.
//
// Vì sao phải kiểm bằng tài khoản thật chứ không gọi hàm bằng service role: toàn bộ giá trị của
// tính năng này nằm ở CHỖ CHẶN — lớp gửi không được tự duyệt cho mình. Service role bỏ qua RLS và
// auth.uid() rỗng, nên chạy kiểu ấy là kiểm một thứ khác hẳn với thứ người dùng gặp.
//
// Bộ kiểm tự dựng dữ liệu riêng (tiền tố `zz-test-doi-lop`) rồi tự dọn, kể cả khi giữa chừng lỗi.
//
//   node scripts/test-doi-lop.mjs [BASE]
//
// Có BASE (ví dụ http://localhost:6899) thì kiểm luôn GIAO DIỆN: lớp nhận có thấy việc phải quyết
// không, lớp gửi có thấy "đang chờ" không. Không có BASE thì chỉ kiểm luật ở tầng dữ liệu.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, ANON, {auth: {persistSession: false}});

const BASE = process.argv[2] ?? null;
const TIEN_TO = 'zz-test-doi-lop';
const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// Mint MỘT phiên cho mỗi người, dùng cho cả gọi RPC lẫn gọi trang web.
//
// Trước đây hàm lấy cookie tự mint phiên thứ hai và KHÔNG kiểm lỗi — token hỏng thì cookie thành
// rác, trang trả 307 về /login, và bộ kiểm báo "giao diện hỏng" trong khi giao diện không sao.
// Một bài kiểm dựng ra lỗi giả còn tệ hơn không có bài kiểm.
const REF = new URL(URL_).host.split('.')[0];
const phien = new Map();
async function nhuLa(email) {
  if (phien.has(email)) return phien.get(email);
  const {data: g, error} = await svc.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error('generateLink ' + email + ': ' + error.message);
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: g.properties.hashed_token,
  });
  if (e2) throw new Error('verifyOtp ' + email + ': ' + e2.message);
  if (!v?.session?.access_token) throw new Error('Không lấy được phiên cho ' + email);
  const p = {
    db: createClient(URL_, ANON, {
      auth: {persistSession: false},
      global: {headers: {Authorization: `Bearer ${v.session.access_token}`}},
    }),
    cookie: `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`,
  };
  phien.set(email, p);
  return p;
}
const trang = async (email, duong) => {
  const {cookie} = await nhuLa(email);
  const r = await fetch(BASE + duong, {headers: {cookie}, redirect: 'manual'});
  return {status: r.status, html: r.status === 200 ? await r.text() : '', den: r.headers.get('location') ?? ''};
};

const rac = {users: [], classes: []};

// Đặt vai PHẢI đi qua một phiên quản trị thật.
// Bảng profiles có guard chặn đổi role/campus/email nếu người gọi không phải admin — và service
// role thì auth_role() rỗng nên cũng bị chặn. Guard ấy đúng; bộ kiểm phải đi đúng cửa như người
// dùng, không được đòi một lối tắt.
let cQuanTri = null;

async function taoNguoi(ten, role) {
  const email = `${TIEN_TO}-${ten}@truongvietanh.com`;
  const {data, error} = await svc.auth.admin.createUser({email, email_confirm: true});
  if (error) throw new Error(email + ': ' + error.message);
  rac.users.push(data.user.id);
  // Trigger handle_new_user tạo hồ sơ với vai mặc định của tên miền (@truongvietanh.com →
  // 'pending'). Phải đổi sang vai thật, và phải KIỂM LỖI: bỏ qua thì mọi bài kiểm giao diện đều
  // trả 307 → /unauthorized và trông như tính năng hỏng, trong khi chỉ là người thử chưa có vai.
  const {error: eUp} = await cQuanTri
    .from('profiles')
    .update({role, full_name: `Test ${ten}`})
    .eq('id', data.user.id);
  if (eUp) throw new Error(`Đặt vai ${role} cho ${email}: ${eUp.message}`);
  const {data: kiem} = await svc.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (kiem?.role !== role) throw new Error(`${email} vẫn đang là vai "${kiem?.role}", không phải "${role}"`);
  return {id: data.user.id, email};
}

async function don() {
  for (const id of rac.classes) await svc.from('classes').delete().eq('id', id);
  for (const id of rac.users) await svc.auth.admin.deleteUser(id).catch(() => {});
  await svc.from('pending_user_grants').delete().ilike('email', `${TIEN_TO}%`);
}

try {
  // ── Dựng bối cảnh ───────────────────────────────────────────────────────────────────────
  const {data: cs} = await svc.from('campuses').select('id').eq('is_active', true).limit(1);
  if (!cs?.length) throw new Error('Không có cơ sở nào đang hoạt động để dựng lớp thử');
  const campus = cs[0].id;
  const {data: adm} = await svc.from('profiles').select('id, email').eq('role', 'admin').limit(1);
  if (!adm?.length) throw new Error('Không còn tài khoản quản trị nào');

  cQuanTri = (await nhuLa(adm[0].email)).db;

  const gvA = await taoNguoi('gv-a', 'teacher');
  const gvB = await taoNguoi('gv-b', 'teacher');
  const hs = await taoNguoi('hs', 'student');

  const {data: lop, error: eLop} = await svc
    .from('classes')
    .insert([
      {name: `${TIEN_TO} A`, school_year: '2026-2027', campus_id: campus, homeroom_teacher_id: gvA.id},
      {name: `${TIEN_TO} B`, school_year: '2026-2027', campus_id: campus, homeroom_teacher_id: gvB.id},
    ])
    .select('id, name');
  if (eLop) throw new Error('Tạo lớp thử: ' + eLop.message);
  const lopA = lop.find((c) => c.name.endsWith(' A')).id;
  const lopB = lop.find((c) => c.name.endsWith(' B')).id;
  rac.classes.push(lopA, lopB);

  await svc.from('enrollments').insert({class_id: lopA, student_id: hs.id, is_active: true});

  const dangOLop = async () => {
    const {data} = await svc
      .from('enrollments')
      .select('class_id')
      .eq('student_id', hs.id)
      .eq('is_active', true);
    return (data ?? []).map((e) => e.class_id);
  };

  const cA = (await nhuLa(gvA.email)).db;
  const cB = (await nhuLa(gvB.email)).db;
  const cAdmin = cQuanTri;

  // ── 1. GVCN lớp ĐÍCH không được tự ý kéo em về ──────────────────────────────────────────
  {
    const {error} = await cB.rpc('request_class_transfer', {p_student: hs.id, p_to_class: lopA});
    dat(!!error, 'GVCN lớp khác không tự đề nghị dời em của lớp mình được', error ? '' : 'KHÔNG bị chặn');
  }

  // ── 2. GVCN lớp hiện tại đề nghị được ──────────────────────────────────────────────────
  let idDeNghi = null;
  {
    const {data, error} = await cA.rpc('request_class_transfer', {
      p_student: hs.id,
      p_to_class: lopB,
      p_note: 'kiểm tự động',
    });
    dat(!error && data === 'requested', 'GVCN lớp hiện tại đề nghị dời được', error?.message ?? `trả về ${data}`);
    const {data: req} = await svc
      .from('class_transfer_requests')
      .select('id')
      .eq('student_id', hs.id)
      .eq('status', 'pending')
      .maybeSingle();
    idDeNghi = req?.id ?? null;
  }

  // ── 3. ĐANG CHỜ THÌ EM VẪN Ở LỚP CŨ ────────────────────────────────────────────────────
  // Đây là điều kiện quan trọng nhất chủ dự án nêu: một em lơ lửng giữa hai lớp là một em
  // không ai điểm danh.
  {
    const lops = await dangOLop();
    dat(
      lops.length === 1 && lops[0] === lopA,
      'Đang chờ duyệt thì em VẪN ở lớp cũ',
      `đang ở ${lops.length} lớp`,
    );
  }

  // ── 4. Lớp GỬI không tự duyệt cho mình ─────────────────────────────────────────────────
  {
    const {error} = await cA.rpc('decide_class_transfer', {p_request: idDeNghi, p_approve: true});
    dat(!!error, 'Lớp gửi KHÔNG tự duyệt được đề nghị của mình', error ? '' : 'KHÔNG bị chặn');
  }

  // ── 5. Không đẻ thêm đề nghị trùng ─────────────────────────────────────────────────────
  {
    const {data} = await cA.rpc('request_class_transfer', {p_student: hs.id, p_to_class: lopB});
    dat(data === 'exists', 'Đề nghị thứ hai cho cùng một em bị chặn', `trả về ${data}`);
  }

  // ── 5b. GIAO DIỆN, lúc đề nghị còn đang chờ ────────────────────────────────────────────
  if (BASE) {
    const denB = await trang(gvB.email, `/roster?class=${lopB}`);
    dat(
      denB.status === 200 && /đề nghị chuyển đến lớp này/i.test(denB.html),
      'Lớp NHẬN thấy việc phải quyết ngay trên trang danh sách lớp',
      `HTTP ${denB.status}${denB.den ? ' → ' + denB.den : ''}`,
    );
    dat(
      denB.status === 200 && /Duyệt</.test(denB.html) && /Từ chối</.test(denB.html),
      'Có đủ nút Duyệt và Từ chối',
    );
    const diA = await trang(gvA.email, `/roster?class=${lopA}`);
    dat(
      diA.status === 200 && /Chờ .* duyệt/.test(diA.html),
      'Lớp GỬI thấy "đang chờ ... duyệt" trên dòng em ấy',
      `HTTP ${diA.status}${diA.den ? ' → ' + diA.den : ''}`,
    );
    dat(
      diA.status === 200 && /Test hs/.test(diA.html),
      'Đang chờ thì em VẪN CÓ TÊN trong danh sách lớp cũ',
    );
    dat(
      denB.status === 200 && !/Test hs<\/a>|Test hs<\/span>/.test(denB.html.split('đề nghị chuyển đến lớp này')[1] ?? ''),
      'Đang chờ thì em CHƯA có tên trong danh sách lớp mới',
    );
  } else {
    console.log('GHI CHÚ  Bỏ qua phần kiểm giao diện: không truyền BASE.');
  }

  // ── 6. Lớp NHẬN duyệt → em sang lớp mới, và chỉ ở đúng một lớp ─────────────────────────
  {
    const {data, error} = await cB.rpc('decide_class_transfer', {p_request: idDeNghi, p_approve: true});
    dat(!error && data === 'approved', 'Lớp nhận duyệt được', error?.message ?? `trả về ${data}`);
    const lops = await dangOLop();
    dat(lops.length === 1 && lops[0] === lopB, 'Duyệt xong em sang lớp mới, không ở hai lớp', `${lops.length} lớp`);
  }

  // ── 7. Quản trị chuyển thẳng, không cần ai duyệt ───────────────────────────────────────
  {
    const {data, error} = await cAdmin.rpc('request_class_transfer', {p_student: hs.id, p_to_class: lopA});
    dat(!error && data === 'moved', 'Quản trị chuyển thẳng, không qua duyệt', error?.message ?? `trả về ${data}`);
    const lops = await dangOLop();
    dat(lops.length === 1 && lops[0] === lopA, 'Quản trị chuyển xong em ở đúng lớp đích', `${lops.length} lớp`);
  }

  // ── 8. Học sinh không đọc được đề nghị về chính mình ────────────────────────────────────
  // Một đề nghị bị từ chối mà em đọc được là một tổn thương không cần thiết.
  {
    const cHs = (await nhuLa(hs.email)).db;
    const {data} = await cHs.from('class_transfer_requests').select('id');
    dat((data ?? []).length === 0, 'Học sinh không đọc được đề nghị dời lớp', `đọc được ${(data ?? []).length} dòng`);
  }
} catch (e) {
  dat(false, 'Bộ kiểm chạy tới cuối', String(e.message ?? e));
} finally {
  await don();
}

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
