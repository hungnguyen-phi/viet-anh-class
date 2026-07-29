'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireProfile} from '@/lib/auth';

// Đánh dấu tất cả thông báo của mình là đã đọc.
//
// requireProfile() thay cho supabase.auth.getUser(): getUser() là một vòng mạng tới Supabase
// Auth, còn requireProfile() đọc JWT cục bộ rồi lấy hồ sơ (và đã được cache theo request).
export async function markAllRead() {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase.from('notifications').update({read: true}).eq('user_id', me.id).eq('read', false);
  revalidatePath('/[locale]/notifications', 'page');
  redirect('/notifications');
}
