'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {SCHOOL_LEVELS, GRADE_NUMBERS, type SchoolLevel} from '@/lib/levels';

// Quản lý giáo viên ở cấp CƠ SỞ, dành cho Hiệu trưởng (Admin làm việc này ở /admin).
//
// Ba lớp chặn xếp chồng, cố ý KHÔNG dựa vào lớp nào một mình:
//   1. requireRole ở đây — chặn người không phải BGH/Admin gọi action.
//   2. RLS rls_all_pending_user_grants / rls_update_profiles — giới hạn đúng cơ sở của HT
//      và cấm vai trò admin/principal.
//   3. Trigger protect_profile_privileged_cols — cấm đổi email/cơ sở, cấm nâng vai trò.
// Lớp 1 chỉ để báo lỗi tử tế; hai lớp dưới mới là thứ giữ an toàn thật, vì chúng nằm trong DB
// nên đường nào đi tới cũng bị chặn.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function flash(msg: string): never {
  redirect(`/campus?flash=${encodeURIComponent(msg)}`);
}

// Cơ sở của chính người đang đăng nhập — HT không được tự chọn cơ sở khác.
//
// Trả về CẢ hồ sơ chứ không riêng campus_id: các action bên dưới cần biết mình là ai (để ghi
// invited_by, để chặn tự vô hiệu chính mình). Trước đây chúng gọi thêm supabase.auth.getUser()
// cho việc đó — mà getUser() là một vòng mạng THẬT tới Supabase Auth mỗi lần gọi, trong khi
// requireRole() vừa lấy xong đúng thông tin ấy. Lấy sẵn ở đây là bớt hẳn một vòng chờ cho mỗi
// lần mời giáo viên / vô hiệu giáo viên.
async function myCampus() {
  const profile = await requireRole(['principal', 'admin']);
  if (!profile.campus_id) flash('Tài khoản của bạn chưa được gán cơ sở. Nhờ quản trị viên gán trước.');
  return profile;
}

// Mời giáo viên: tạo lời mời theo email; vai trò + cơ sở được áp khi họ đăng nhập lần đầu
// (handle_new_user). Nhận nhiều email một lượt cho đỡ nhọc đầu năm học.
export async function inviteTeachers(formData: FormData) {
  const me = await myCampus();
  const campus_id = me.campus_id;
  const raw = String(formData.get('email') ?? '');
  const all = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (all.length === 0) flash('Chưa nhập email nào');
  const valid = all.filter((e) => EMAIL_RE.test(e));
  const skipped = all.length - valid.length;
  if (valid.length === 0) flash('Không có email hợp lệ (định dạng: ten@example.com).');

  const supabase = await createClient();
  const rows = valid.map((email) => ({
    email,
    role: 'teacher' as const,
    campus_id,
    invited_by: me.id,
  }));
  const {error} = await supabase.from('pending_user_grants').upsert(rows, {onConflict: 'email'});
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'principal_invite_teachers',
      p_detail: {count: valid.length, campus: campus_id},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  const msg =
    valid.length === 1
      ? `Đã mời ${valid[0]}. Vai trò giáo viên được gán khi họ đăng nhập lần đầu.`
      : `Đã mời ${valid.length} giáo viên. Vai trò được gán khi họ đăng nhập lần đầu.`;
  flash(error ? friendlyError(error) : msg + (skipped > 0 ? ` (bỏ qua ${skipped} email sai định dạng)` : ''));
}

export async function cancelInvite(formData: FormData) {
  await myCampus();
  const email = String(formData.get('email') ?? '');
  if (!email) flash('Thiếu email');
  const supabase = await createClient();
  // RLS giới hạn đúng cơ sở HT → không cần (và không nên) tự lọc campus ở đây.
  const {error} = await supabase.from('pending_user_grants').delete().eq('email', email);
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? friendlyError(error) : `Đã huỷ lời mời ${email}`);
}

// Vô hiệu / khôi phục giáo viên. 'pending' = còn tài khoản nhưng không vào được gì —
// giữ nguyên lịch sử điểm danh, WIG… nên KHÔNG dùng xoá.
export async function setTeacherActive(formData: FormData) {
  const me = await myCampus();
  const userId = String(formData.get('userId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!userId) flash('Thiếu giáo viên');
  if (me.id === userId) flash('Không thể tự vô hiệu chính mình.');

  const supabase = await createClient();
  const {error} = await supabase
    .from('profiles')
    .update({role: active ? 'teacher' : 'pending'})
    .eq('id', userId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: active ? 'principal_enable_teacher' : 'principal_disable_teacher',
      p_detail: {target_user: userId},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  flash(
    error
      ? friendlyError(error)
      : active
        ? 'Đã khôi phục quyền giáo viên'
        : 'Đã vô hiệu (chuyển về "chờ cấp quyền")',
  );
}

// Khai cấp học cho cơ sở mình → DB sinh luôn bộ khối chuẩn của cấp đó.
// Đi qua RPC set_my_campus_level (SECURITY DEFINER) chứ không UPDATE thẳng bảng campuses: HT
// chỉ được đổi đúng cột `level` của đúng cơ sở mình, không đụng tên/mã/trạng thái lưu-trữ.
export async function setCampusLevel(formData: FormData) {
  await myCampus();
  const level = String(formData.get('level') ?? '');
  if (!SCHOOL_LEVELS.includes(level as SchoolLevel)) flash('Cấp học không hợp lệ');
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('set_my_campus_level', {p_level: level as SchoolLevel});
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(friendlyError(error));
  const nums = GRADE_NUMBERS[level as SchoolLevel];
  flash(
    nums
      ? `Đã đặt cấp học và tạo ${data ?? nums.length} khối: ${nums.map((n) => `Khối ${n}`).join(', ')}`
      : 'Đã đặt cấp học mầm non — hãy thêm khối bằng tay.',
  );
}

// Phân công GVCN cho lớp trong cơ sở mình.
export async function assignHomeroom(formData: FormData) {
  await myCampus();
  const classId = String(formData.get('class_id') ?? '');
  const userId = String(formData.get('userId') ?? '') || null;
  if (!classId) flash('Thiếu lớp');
  const supabase = await createClient();
  const {error} = await supabase
    .from('classes')
    .update({homeroom_teacher_id: userId})
    .eq('id', classId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'principal_assign_homeroom',
      p_detail: {class: classId, teacher: userId},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? friendlyError(error) : userId ? 'Đã phân công GVCN' : 'Đã bỏ phân công GVCN');
}
