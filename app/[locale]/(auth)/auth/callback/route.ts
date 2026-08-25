import {NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {homeRouteForRole} from '@/lib/auth';
import {publicOrigin} from '@/lib/public-origin';
import {safeNextPath} from '@/lib/hub/safe-next';

// Đổi code OAuth / verify magic-link OTP → đặt session → đẩy về trang theo vai trò.
//
// origin lấy từ publicOrigin(request), KHÔNG phải `new URL(request.url).origin`: sau
// Coolify/Cloudflare, request.url là địa chỉ NỘI BỘ container (http://0.0.0.0:8080) — dùng nhầm
// nó thì người dùng vừa đăng nhập Google xong bị đẩy tới một địa chỉ không tồn tại.
export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Chỉ nhận đường dẫn nội bộ bắt đầu bằng đúng MỘT dấu "/" (chặn open-redirect:
  // "//evil.com", "/\evil.com", "https://evil.com", "@evil.com"... đều bị loại). Luật này dùng
  // chung với app/api/hub/doi-ma/route.ts — xem lib/hub/safe-next.ts.
  const next = safeNextPath(searchParams.get('next'));

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
