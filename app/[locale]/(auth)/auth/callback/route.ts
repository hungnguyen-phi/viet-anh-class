import {NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {homeRouteForRole} from '@/lib/auth';

// Đổi code OAuth / verify magic-link OTP → đặt session → đẩy về trang theo vai trò.
export async function GET(request: Request) {
  const {searchParams, origin} = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const {error} = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash});
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  let dest = next ?? '/';
  if (!next) {
    const {
      data: {user},
    } = await supabase.auth.getUser();
    if (user) {
      const {data: profile} = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      dest =
        !profile || profile.role === 'pending'
          ? '/unauthorized'
          : homeRouteForRole(profile.role);
    }
  }

  return NextResponse.redirect(`${origin}${dest}`);
}
