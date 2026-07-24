'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';

// Bật/tắt cờ Attendance leader cho 1 học sinh trong lớp (RLS: chỉ GVCN lớp/admin).
export async function setAttendanceLeader(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('classId'));
  const studentId = String(formData.get('studentId'));
  const value = formData.get('value') === 'true';
  const supabase = await createClient();
  const {error} = await supabase
    .from('enrollments')
    .update({is_attendance_leader: value})
    .eq('class_id', classId)
    .eq('student_id', studentId);
  revalidatePath('/roster');
  if (error) {
    redirect(`/roster?class=${encodeURIComponent(classId)}&flash=${encodeURIComponent(friendlyError(error))}`);
  }
}

function rosterFlash(classId: string, msg: string): never {
  redirect(`/roster?class=${encodeURIComponent(classId)}&flash=${encodeURIComponent(msg)}`);
}

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên email đã gõ).
export type EnrollState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {email: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ghi danh học sinh (theo email) vào lớp — cũng dùng để CHUYỂN LỚP (tắt lớp cũ).
// INLINE validation (useActionState): lỗi hiện cạnh field, giữ nguyên email, báo thành công ngay.
export async function enrollStudent(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  // Giữ lại email để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {email};

  if (!classId) return {ok: false, error: friendlyError(null), values};
  if (!email) return {ok: false, fieldError: 'email', error: 'Hãy nhập email học sinh.', values};
  if (!EMAIL_RE.test(email))
    return {ok: false, fieldError: 'email', error: 'Email không hợp lệ (vd hs01@student.truongvietanh.com).', values};

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('enroll_student_by_email', {p_class: classId, p_email: email});
  if (error) return {ok: false, error: friendlyError(error), values};
  if (data === 'not_found')
    return {
      ok: false,
      fieldError: 'email',
      error: `Không tìm thấy học sinh với email ${email}. Kiểm tra lại email, hoặc yêu cầu em đăng nhập tạo tài khoản học sinh trước.`,
      values,
    };

  revalidatePath('/roster');
  return {ok: true, message: `Đã ghi danh ${email} vào lớp`};
}

// Cho học sinh rời lớp (is_active=false) — không xoá dữ liệu.
export async function removeStudent(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('classId') ?? '');
  const studentId = String(formData.get('studentId') ?? '');
  if (!classId || !studentId) rosterFlash(classId, 'Thiếu thông tin');
  const supabase = await createClient();
  const {error} = await supabase.rpc('unenroll_student', {p_class: classId, p_student: studentId});
  revalidatePath('/roster');
  rosterFlash(classId, error ? friendlyError(error) : 'Đã cho học sinh rời lớp');
}
