import {NextResponse} from 'next/server';

// Healthcheck cho container/platform (Coolify + Docker HEALTHCHECK).
// Đường dẫn /api/* nằm ngoài matcher middleware nên KHÔNG chạy i18n + refresh session Supabase
// → phản hồi nhẹ, không phụ thuộc DB, không bị redirect locale.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({status: 'ok'});
}
