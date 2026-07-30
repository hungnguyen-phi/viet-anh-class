// Mọi mục trên thanh menu của MỌI vai phải mở được — không 404, không 500, không đá về /login.
//
// Vì sao cần: nav là bảng tra cứng trong AppNav.tsx, không có gì buộc nó khớp với các trang thật
// tồn tại. Thêm một tab trỏ sai đường là cả một vai người dùng bấm vào ra trang trắng, mà build
// vẫn xanh.
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

// Đọc thẳng bảng LINKS trong AppNav.tsx thay vì chép tay — chép tay thì test và code lệch nhau
// lúc nào không biết, và test lệch còn tệ hơn không có test.
const nav = readFileSync('components/shell/AppNav.tsx', 'utf8');
const khoi = nav.slice(nav.indexOf('const LINKS'), nav.indexOf('const CO_LIEN_LAC'));
const duongDan = {};
for (const m of khoi.matchAll(/^\s*(\w+):\s*\[([\s\S]*?)^\s*\],/gm)) {
  duongDan[m[1]] = [...m[2].matchAll(/href:\s*'([^']+)'/g)].map((x) => x[1]);
}
// Icon "Liên lạc" ở cụm phải, không nằm trong LINKS.
duongDan.teacher.push('/inbox');
duongDan.parent.push('/inbox');
// Trang tổ trưởng điểm danh (thêm động cho học sinh).
duongDan.student.push('/attendance');
// Danh mục môn: vào từ trang Quản trị và trang Cơ sở, không phải tab (docs/NAV_IA.md).
duongDan.admin.push('/subjects');
duongDan.principal.push('/subjects');
// Thực đơn: quản trị soạn ở trang riêng, mở từ trang Quản trị.
duongDan.admin.push('/menu');
// /messages là trang CHUYỂN HƯỚNG sang /inbox (chuông thông báo của migration 0065 trỏ vào đó).
// Ở đây 307 mới là đúng, nên tách ra kiểm riêng bên dưới.
const CHUYEN_HUONG = [['/messages?t=abc', '/inbox']];

const TK = {
  teacher: 'test1.gvcn@truongvietanh.com',
  admin: 'test3.admin@truongvietanh.com',
  principal: 'test2.bgh@truongvietanh.com',
  parent: 'test1.ph@truongvietanh.com',
  student: 'test1.hs@student.truongvietanh.com',
};

const kq = [];
for (const [vai, email] of Object.entries(TK)) {
  const cookie = await ck(email);
  for (const href of duongDan[vai] ?? []) {
    const r = await fetch(BASE + href, {headers: {cookie}, redirect: 'manual'});
    const loc = r.headers.get('location') ?? '';
    const daDangNhapLai = loc.includes('/login') || loc.includes('/unauthorized');
    const dat = r.status === 200 && !daDangNhapLai;
    kq.push(
      `${dat ? 'OK  ' : 'SAI '} ${vai.padEnd(10)} ${href.padEnd(12)} → ${r.status}${loc ? ' → ' + loc.replace(BASE, '') : ''}`,
    );
  }
}

// Chuông thông báo tin nhắn: trigger 0065 ghi link '/messages?t=<id>' nhưng màn ở /inbox.
// Phải chuyển hướng đúng, và phải GIỮ ?t= để bấm thông báo mở đúng cuộc trao đổi.
{
  const cookie = await ck(TK.teacher);
  for (const [tu, den] of CHUYEN_HUONG) {
    const r = await fetch(BASE + tu, {headers: {cookie}, redirect: 'manual'});
    const loc = r.headers.get('location') ?? '';
    const dat = r.status >= 300 && r.status < 400 && loc.includes(den) && loc.includes('t=abc');
    kq.push(`${dat ? 'OK  ' : 'SAI '} chuyển hướng ${tu} → ${loc.replace(BASE, '') || r.status}`);
  }
}

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
