import 'server-only';
import {createClient as createSbClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/database.types';

// Client service_role — BỎ QUA RLS. CHỈ dùng trong server action đã kiểm quyền + IP.
// 'server-only' đảm bảo file này không bao giờ bị bundle vào client (rò khoá).
// Không persist session (stateless, mỗi lần gọi tự cấp quyền bằng service_role key).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY trong môi trường server.');
  return createSbClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {autoRefreshToken: false, persistSession: false},
  });
}
