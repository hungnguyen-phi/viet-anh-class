'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

// Đánh dấu tất cả thông báo của mình là đã đọc.
export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('notifications').update({read: true}).eq('user_id', user.id).eq('read', false);
  }
  revalidatePath('/notifications');
  redirect('/notifications');
}
