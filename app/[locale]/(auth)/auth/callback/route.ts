import {NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {homeRouteForRole} from '@/lib/auth';
import {SITE_URL} from '@/lib/site';

// Đổi code OAuth / verify magic-link OTP → đặt session → đẩy về trang theo vai trò.
//
// Dùng SITE_URL (cố định, KHÔNG dùng `new URL(request.url).origin`): sau Coolify/Cloudflare,
// request.url là địa chỉ NỘI BỘ container (vd http://0.0.0.0:8080) — dùng nhầm nó thì mọi
// redirect sau đăng nhập Google đều rơi về localhost/0.0.0.0, trình duyệt người dùng không
// bao giờ vào được (lỗi chỉ lộ ra khi chạy sau proxy thật, máy dev không bao giờ thấy).
export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const origin = SITE_URL;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Chỉ nhận đường dẫn nội bộ bắt đầu bằng đúng MỘT dấu "/" (chặn open-redirect:
  // "//evil.com", "/\evil.com", "https://evil.com", "@evil.com"... đều bị loại).
  const nextParam = searchParams.get('next');
  const next = nextParam && /^\/(?![/\\])/.test(nextParam) ? nextParam : null;

  const supabase = await createClient();
  // exchangeCodeForSession / verifyOtp ĐÃ trả về user trong data — lấy id ngay từ đó thay vì
  // gọi thêm supabase.auth.getUser(), vốn là một vòng mạng nữa tới Supabase Auth. Đây là chặng
  // người dùng đang chờ trắng màn hình sau khi bấm "Đăng nhập với Google", nên mỗi vòng mạng
  // cắt được ở đây đều thấy rõ.
  let userId: string | null = null;

  if (code) {
    const {data, error} = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  } else if (tokenHash && type) {
    const {data, error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash});
    if (!error) userId = data.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  let dest = next ?? '/';
  if (!next) {
    const {data: profile} = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    dest =
      !profile || profile.role === 'pending' ? '/unauthorized' : homeRouteForRole(profile.role);
  }

  return NextResponse.redirect(`${origin}${dest}`);
}
