import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import type {Database} from '@/lib/database.types';
import {routing} from '@/i18n/routing';
import {publicOrigin} from '@/lib/public-origin';

// Đường dẫn công khai (không cần đăng nhập).
const PUBLIC_PATHS = ['/login', '/auth', '/unauthorized'];

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

  const {locale: earlyLocale, path: earlyPath} = stripLocale(request.nextUrl.pathname);
  const earlyPublic = PUBLIC_PATHS.some(
    (p) => earlyPath === p || earlyPath.startsWith(p + '/'),
  );

  // ĐƯỜNG TẮT KHÁCH VÃNG LAI: không có cookie phiên Supabase nào thì chắc chắn chưa đăng nhập —
  // khỏi dựng client và gọi getClaims(). Trang login (trang đông người lạ vào nhất) nhờ vậy
  // không tốn chút việc Supabase nào. An toàn tuyệt đối: không cookie thì cũng không có phiên
  // để làm mới, và nhánh này chỉ dẫn tới đúng kết quả mà nhánh đầy đủ trả về cho userId = null.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!hasAuthCookie) {
    if (earlyPublic) return response;
    const prefix = earlyLocale === routing.defaultLocale ? '' : `/${earlyLocale}`;
    return NextResponse.redirect(new URL(`${prefix}/login`, publicOrigin(request)));
  }

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

  // getClaims() thay cho getUser(): verify JWT cục bộ (không gọi mạng) khi bật
  // asymmetric JWT keys. Vẫn refresh token qua getSession() nội bộ nên cookie
  // phiên được làm mới bình thường; key đối xứng cũ thì tự fallback sang getUser().
  const {data: claimsData} = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  const {locale, path} = stripLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + '/'),
  );
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  // publicOrigin(request), KHÔNG request.url: sau Coolify/Cloudflare, request.url là địa chỉ
  // nội bộ container (http://0.0.0.0:8080) — xem lib/public-origin.ts.
  const redirectTo = (p: string) =>
    NextResponse.redirect(new URL(`${prefix}${p}`, publicOrigin(request)));

  if (!userId) {
    return isPublic ? response : redirectTo('/login');
  }

  // KHÔNG query `profiles` ở đây nữa cho các trang thường.
  //
  // Vì sao bỏ được mà không hở quyền: MỌI trang sau đăng nhập đều nằm dưới layout
  // app/[locale]/(dashboard)/layout.tsx, và layout đó gọi requireProfile() — nơi đã đá người
  // chưa đăng nhập về /login và người 'pending' sang /unauthorized. Middleware kiểm lại lần nữa
  // chỉ là làm đúng việc đó HAI LẦN, mà lần ở đây tốn nguyên một vòng mạng tới Supabase trên
  // MỌI lượt chuyển trang — chính là thứ khiến người dùng thấy "bấm tab nào cũng chờ".
  //
  // Chỗ DUY NHẤT còn cần biết vai trò là /login: người đã đăng nhập mà mở lại /login thì phải
  // đẩy thẳng về trang chủ theo vai. Trang này hiếm khi mở nên trả một vòng mạng ở đây là đáng.
  if (path !== '/login') {
    return response;
  }

  const {data: profile} = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  const role = profile?.role ?? 'pending';

  if (role === 'pending') {
    return redirectTo('/unauthorized');
  }

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
