import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import type {Database} from '@/lib/database.types';
import {supabaseFetch} from '@/lib/supabase/fetch';

// Client cho Server Components / Route Handlers / Server Actions (đọc session từ cookie).
// Dùng getAll/setAll (KHÔNG dùng get/set/remove — sẽ làm hỏng session ở production).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // fetch riêng: giữ kết nối tới Supabase sống 10 phút thay vì 4 giây mặc định, và nhớ DNS.
      // Đường truyền VPS đang mất ~5% gói TCP, mà mất gói đau nhất đúng lúc bắt tay — xem
      // lib/supabase/fetch.ts.
      global: {fetch: supabaseFetch},
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({name, value, options}) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Gọi từ Server Component — bỏ qua; middleware sẽ tự refresh session.
          }
        },
      },
    },
  );
}
