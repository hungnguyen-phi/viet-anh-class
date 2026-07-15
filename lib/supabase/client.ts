import {createBrowserClient} from '@supabase/ssr';
import type {Database} from '@/lib/database.types';

// Client phía trình duyệt (dùng cho Realtime + mutation từ client component).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
