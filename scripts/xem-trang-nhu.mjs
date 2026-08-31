// XEM MỘT TRANG BẰNG PHIÊN THẬT của một tài khoản, in ra CHỮ (đã bóc thẻ) — để đối chiếu nhanh
// "cô/em đang thấy gì" mà không phải lái trình duyệt.
//
//   node scripts/xem-trang-nhu.mjs <email> </duong/dan?query> [https://class.truongvietanh.com]
//
// Chỉ đọc; không tạo tài khoản (chặn generateLink với email chưa có hồ sơ).
import {readFileSync, writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const [email, duong, base = 'https://class.truongvietanh.com'] = process.argv.slice(2);
if (!email || !duong) {
  console.error('Dùng: node scripts/xem-trang-nhu.mjs <email> </vi/wig/hop?hop=2026-08-03> [base]');
  process.exit(1);
}
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

const {data: hoSo} = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
if (!hoSo) {
  console.error(`${email}: chưa có tài khoản — không tạo mới.`);
  process.exit(1);
}
const {data: g} = await admin.auth.admin.generateLink({type: 'magiclink', email});
const {data: v, error} = await anon.auth.verifyOtp({type: 'email', token_hash: g.properties.hashed_token});
if (error) {
  console.error('verifyOtp:', error.message);
  process.exit(1);
}
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
const res = await fetch(`${base}${duong}`, {headers: {cookie}, redirect: 'manual'});
console.log('HTTP', res.status, res.headers.get('location') ?? '');
const html = await res.text();
// Chỉ lưu HTML khi được bảo (LUU_HTML=đường/dẫn) — đừng đẻ tệp vào thư mục dự án.
if (process.env.LUU_HTML) writeFileSync(process.env.LUU_HTML, html);
const chu = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\/(p|div|li|tr|h\d|section|label|button|summary|details|span)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .split('\n').map((s) => s.trim()).filter(Boolean).join('\n');
console.log(chu);
