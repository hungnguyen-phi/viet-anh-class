// SINH ĐƯỜNG ĐĂNG NHẬP THẬT cho một tài khoản — để lái trình duyệt vào app như người dùng.
//
//   node scripts/dang-nhap-that.mjs <email> [https://class.vietanh.org]
//
// Vì sao KHÔNG dùng `action_link` mà generateLink trả về: đường ấy đi qua endpoint /auth/v1/verify
// của Supabase, và Supabase trả session ở FRAGMENT (#access_token=…). Fragment không bao giờ được
// gửi lên máy chủ, nên route callback của app đọc không thấy gì và đẩy về /login?error=auth — mà
// trình duyệt thì vẫn giữ phiên CŨ, nên nhìn qua tưởng là "đăng nhập thành công". Đã vấp đúng thế:
// tưởng đã vào bằng tài khoản GVCN, hoá ra vẫn là phiên học sinh có sẵn từ trước.
//
// Đường đúng: gọi thẳng route callback của app với `token_hash` + `type`. Route ấy chạy verifyOtp
// ở MÁY CHỦ rồi đặt cookie — đúng cơ chế mà đường dẫn trong email thật cũng dùng.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const email = process.argv[2];
const base = process.argv[3] ?? 'https://class.vietanh.org';
if (!email) {
  console.error('Thiếu email. Ví dụ: node scripts/dang-nhap-that.mjs tunhien01@truongvietanh.com');
  process.exit(1);
}
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});
const {data, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
if (error) {
  console.error('Không sinh được đường đăng nhập:', error.message);
  process.exit(1);
}
console.log(`${base}/vi/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
