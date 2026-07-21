'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

// Lưu biên bản họp WIG cá nhân (Coach × Buddy) cho 1 học sinh (PRD §6.2 màn 6).
// RLS wm_teacher_all / wm_admin_all quyết định ai được ghi; coach = người đang đăng nhập.
export async function saveStudentMeeting(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const buddy_id = String(formData.get('buddy_id') ?? '').trim() || null;
  const results = String(formData.get('results') ?? '').trim() || null;
  const commitments = String(formData.get('commitments') ?? '').trim() || null;
  const next_actions = String(formData.get('next_actions') ?? '').trim() || null;

  if (!student_id || !class_id || !week_label) {
    redirect(`/student/${student_id}?flash=${encodeURIComponent('Thiếu thông tin bắt buộc')}`);
  }

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  const {error} = await supabase.from('wig_meetings').insert({
    class_id,
    student_id,
    week_label,
    buddy_id,
    results,
    commitments,
    next_actions,
    coach_id: user?.id ?? null,
  });

  revalidatePath(`/student/${student_id}`);
  const msg = error ? `Lỗi lưu: ${error.message}` : 'Đã lưu biên bản họp cá nhân.';
  redirect(`/student/${student_id}?flash=${encodeURIComponent(msg)}`);
}
