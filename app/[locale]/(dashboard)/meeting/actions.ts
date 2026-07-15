'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

function flash(msg: string): never {
  redirect(`/meeting?flash=${encodeURIComponent(msg)}`);
}

export async function saveMeeting(formData: FormData) {
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const results = String(formData.get('results') ?? '').trim() || null;
  const commitments = String(formData.get('commitments') ?? '').trim() || null;
  const next_actions = String(formData.get('next_actions') ?? '').trim() || null;
  if (!class_id || !week_label) flash('Thiếu lớp hoặc nhãn tuần');
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const {error} = await supabase.from('wig_meetings').insert({
    class_id,
    week_label,
    results,
    commitments,
    next_actions,
    coach_id: user?.id ?? null,
  });
  revalidatePath('/meeting');
  flash(error ? `Lỗi lưu: ${error.message}` : 'Đã lưu biên bản');
}
