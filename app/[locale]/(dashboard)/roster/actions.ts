'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

// Bật/tắt cờ Attendance leader cho 1 học sinh trong lớp (RLS: chỉ GVCN lớp/admin).
export async function setAttendanceLeader(formData: FormData) {
  const classId = String(formData.get('classId'));
  const studentId = String(formData.get('studentId'));
  const value = formData.get('value') === 'true';
  const supabase = await createClient();
  await supabase
    .from('enrollments')
    .update({is_attendance_leader: value})
    .eq('class_id', classId)
    .eq('student_id', studentId);
  revalidatePath('/roster');
}
