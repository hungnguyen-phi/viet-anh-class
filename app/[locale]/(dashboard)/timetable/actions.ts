'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';

function flash(classId: string, msg: string): never {
  redirect(`/timetable?class=${encodeURIComponent(classId)}&flash=${encodeURIComponent(msg)}`);
}

// Lưu (tạo/sửa) 1 ô thời khoá biểu. RLS tt_manage: chỉ GVCN lớp/admin.
export async function saveSlot(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const day_of_week = Number(formData.get('day_of_week') ?? 0);
  const period_no = Number(formData.get('period_no') ?? 0);
  const subject = String(formData.get('subject') ?? '').trim();
  const room = String(formData.get('room') ?? '').trim() || null;
  if (!class_id || !day_of_week || !period_no || !subject) flash(class_id, 'Thiếu thông tin ô thời khoá biểu');
  const supabase = await createClient();
  const {error} = await supabase
    .from('timetable_slots')
    .upsert({class_id, day_of_week, period_no, subject, room}, {onConflict: 'class_id,day_of_week,period_no'});
  revalidatePath('/timetable');
  flash(class_id, error ? friendlyError(error) : 'Đã lưu ô thời khoá biểu');
}

export async function deleteSlot(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_slots').delete().eq('id', id);
  revalidatePath('/timetable');
  flash(class_id, error ? friendlyError(error) : 'Đã xoá ô');
}
