import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import type {Database} from '@/lib/database.types';
import {routing} from '@/i18n/routing';

// Đường dẫn công khai (không cần đăng nhập).
const PUBLIC_PATHS = ['/login', '/auth', '/unauthorized', '/guide'];

function stripLocale(pathname: string): {locale: string; path: string} {
  const seg = pathname.split('/').filter(Boolean);
  const first = seg[0] as (typeof routing.locales)[number];
  if (routing.locales.includes(first)) {
    return {locale: first, path: '/' + seg.slice(1).join('/')};
  }
  return {locale: routing.defaultLocale, path: '/' + seg.join('/')};
}

// Refresh session Supabase + guard: chưa đăng nhập → /login; role 'pending' → /unauthorized;
// đã đăng nhập mà vào /login → đẩy về trang theo vai trò.
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({name, value, options}) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );

  const {
    data: {user},
  } = await supabase.auth.getUser();

  const {locale, path} = stripLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + '/'),
  );
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const redirectTo = (p: string) =>
    NextResponse.redirect(new URL(`${prefix}${p}`, request.url));

  if (!user) {
    return isPublic ? response : redirectTo('/login');
  }

  const {data: profile} = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? 'pending';

  if (role === 'pending') {
    return path === '/unauthorized' ? response : redirectTo('/unauthorized');
  }

  // Đã đăng nhập + có quyền: nếu đang ở trang login → đẩy về trang theo vai trò.
  if (path === '/login') {
    const home =
      role === 'admin'
        ? '/admin'
        : role === 'principal'
          ? '/campus'
          : role === 'parent'
            ? '/report'
            : '/';
    return redirectTo(home);
  }

  return response;
}
