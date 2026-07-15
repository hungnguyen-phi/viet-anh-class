import createMiddleware from 'next-intl/middleware';
import {type NextRequest} from 'next/server';
import {routing} from './i18n/routing';
import {updateSession} from './lib/supabase/middleware';

const handleI18n = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1) i18n: phát hiện locale + rewrite/redirect, trả về response.
  const response = handleI18n(request);
  // 2) refresh session Supabase + guard quyền (gắn cookie lên chính response của i18n).
  return updateSession(request, response);
}

export const config = {
  // Bỏ qua API, file tĩnh Next, và mọi file có đuôi (vd .png, .ico).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
