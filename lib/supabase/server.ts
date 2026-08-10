import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import type {Database} from '@/lib/database.types';
import {giuKetNoiSupabase} from '@/lib/giu-ket-noi';
import {fetchKemDuPhong} from '@/lib/gui-kem-du-phong';

// Client cho Server Components / Route Handlers / Server Actions (đọc session từ cookie).
// Dùng getAll/setAll (KHÔNG dùng get/set/remove — sẽ làm hỏng session ở production).
export async function createClient() {
  // Bật bộ giữ kết nối tới Supabase — chạy thật đúng một lần cho mỗi tiến trình, những lần sau
  // chỉ là một phép so boolean. Đặt ở đây vì đây là cửa duy nhất mọi truy vấn phía máy chủ đi
  // qua; xem lib/giu-ket-noi.ts để biết vì sao không dùng instrumentation.ts.
  await giuKetNoiSupabase();

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Câu ĐỌC quá 150ms thì bắn kèm một bản sao, ai về trước dùng nấy — chữa cái đuôi do mất
      // gói trên đường tới Supabase (xem lib/gui-kem-du-phong.ts). Chỉ GET, không bao giờ ghi.
      global: {fetch: fetchKemDuPhong},
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
