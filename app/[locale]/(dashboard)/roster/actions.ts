'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';

// Đặt tổ trưởng điểm danh cho lớp. ĐỘC QUYỀN: mỗi lớp đúng 1 em.
//
// Bản cũ (setAttendanceLeader) chỉ bật/tắt cờ của MỘT em và không gỡ người cũ → lớp có thể có
// nhiều tổ trưởng cùng lúc, mà cờ này mở RLS att_leader_insert/update cho em đó ghi điểm danh
// cả lớp. Nay đặt em mới thì tự gỡ em cũ.
//
// studentId = null → gỡ hẳn, lớp không có tổ trưởng.
// Trả về state thay vì redirect: client cần biết pending/lỗi để hiện spinner (trước đây bấm xong
// im 5 giây, người dùng tưởng nút không ăn).
export async function assignAttendanceLeader(
  classId: string,
  studentId: string | null,
): Promise<{ok: boolean; error?: string}> {
  await requireRole(['teacher', 'admin']);
  if (!classId) return {ok: false, error: 'Thiếu lớp'};
  const supabase = await createClient();

  // Gỡ mọi người đang giữ cờ trong lớp trước. Không atomic với bước sau, nhưng cờ này chỉ ảnh
  // hưởng link "Điểm danh" và RLS att_leader_* của HÔM NAY → khoảng trống vài trăm ms vô hại.
  const clear = await supabase
    .from('enrollments')
    .update({is_attendance_leader: false})
    .eq('class_id', classId)
    .eq('is_active', true)
    .eq('is_attendance_leader', true);
  if (clear.error) return {ok: false, error: friendlyError(clear.error)};

  if (studentId) {
    // .select() để phân biệt "RLS chặn / em đã rời lớp" với "đã đổi xong" — không báo thành công giả.
    const {data, error} = await supabase
      .from('enrollments')
      .update({is_attendance_leader: true})
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .select('student_id');
    if (error) return {ok: false, error: friendlyError(error)};
    if (!data || data.length === 0)
      return {ok: false, error: 'Không đặt được — em này không còn trong lớp, hoặc bạn không có quyền.'};
  }

  revalidatePath('/[locale]/roster', 'page');
  revalidatePath('/[locale]/attendance', 'page');
  return {ok: true};
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

  // Chưa có tài khoản → KHÔNG còn là ngõ cụt.
  //
  // Trước đây chỗ này chỉ báo "không tìm thấy… yêu cầu em đăng nhập trước" rồi dừng, khiến giáo
  // viên phải chờ từng em tự đăng nhập mới lập được danh sách lớp — luồng ngược hẳn với thực tế
  // đầu năm học. Nay ghi một lời mời: em đó đăng nhập lần đầu là trigger handle_new_user tự gán
  // vai học sinh và ĐƯA THẲNG vào đúng lớp này, giáo viên không phải quay lại làm gì thêm.
  if (data === 'not_found') {
    const {data: inv, error: invErr} = await supabase.rpc('invite_student_to_class', {
      p_class: classId,
      p_email: email,
    });
    if (invErr) return {ok: false, error: friendlyError(invErr), values};
    if (inv === 'invited') {
      revalidatePath('/[locale]/roster', 'page');
      return {
        ok: true,
        message: `${email} chưa có tài khoản — đã lưu lời mời vào lớp này. Em chỉ cần đăng nhập lần đầu là tự động có tên trong danh sách.`,
      };
    }
    if (inv === 'other_role')
      return {
        ok: false,
        fieldError: 'email',
        error: `${email} đang được mời với một vai khác (giáo viên/phụ huynh…). Nhờ quản trị viên xử lý trước để tránh gán nhầm vai.`,
        values,
      };
    if (inv === 'forbidden')
      return {
        ok: false,
        error: 'Bạn không phải giáo viên chủ nhiệm của lớp này nên không mời được học sinh vào đây.',
        values,
      };
    return {
      ok: false,
      fieldError: 'email',
      error: `Email ${email} không hợp lệ.`,
      values,
    };
  }

  revalidatePath('/[locale]/roster', 'page');
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
  revalidatePath('/[locale]/roster', 'page');
  rosterFlash(classId, error ? friendlyError(error) : 'Đã cho học sinh rời lớp');
}
