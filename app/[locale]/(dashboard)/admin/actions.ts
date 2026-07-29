'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {SCHOOL_LEVELS, GRADE_NUMBERS, hasNumberedGrades, type SchoolLevel} from '@/lib/levels';
import type {Database} from '@/lib/database.types';

type Role = Database['public']['Enums']['user_role'];

// Hiện thông báo bằng cách redirect kèm ?flash=... (page đọc và hiển thị banner).
function flash(msg: string): never {
  redirect(`/admin?flash=${encodeURIComponent(msg)}`);
}

// Vì sao các action dưới đây KHÔNG gọi supabase.auth.getUser() nữa:
// requireRole() vừa trả về đúng hồ sơ của người đang thao tác (có sẵn .id), trong khi getUser()
// là một vòng mạng THẬT tới Supabase Auth. Gọi thêm nó chỉ để lấy lại chính cái id đó là bắt
// người dùng chờ thêm một lượt đi-về cho mỗi lần bấm — đây là một phần lý do màn Quản trị bị
// than "bấm xong không thấy gì, tưởng treo".

export async function setUserRole(formData: FormData) {
  const me = await requireRole(['admin']);
  const userId = String(formData.get('userId'));
  const role = String(formData.get('role')) as Role;
  // Chặn admin tự đổi vai trò của chính mình (tránh tự khoá quyền admin).
  if (me.id === userId) {
    flash('Không thể tự đổi vai trò của chính mình (tránh tự khoá quyền admin). Hãy nhờ một admin khác.');
  }
  const supabase = await createClient();
  const {error} = await supabase.from('profiles').update({role}).eq('id', userId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'set_user_role',
      p_detail: {target_user: userId, new_role: role},
    });
  }
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã đổi vai trò');
}

export async function disableUser(formData: FormData) {
  const me = await requireRole(['admin']);
  const userId = String(formData.get('userId') ?? '');
  if (me.id === userId) flash('Không thể tự vô hiệu chính mình.');
  const supabase = await createClient();
  const {error} = await supabase.from('profiles').update({role: 'pending'}).eq('id', userId);
  if (!error) await supabase.rpc('log_audit', {p_action: 'disable_user', p_detail: {target_user: userId}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã vô hiệu (chuyển về "chờ cấp quyền")');
}

export async function deleteUser(formData: FormData) {
  const me = await requireRole(['admin']);
  const userId = String(formData.get('userId') ?? '');
  if (me.id === userId) flash('Không thể xoá chính mình.');
  const supabase = await createClient();
  const {error} = await supabase.rpc('admin_delete_user', {p_user: userId});
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_user', p_detail: {target_user: userId}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã xoá người dùng');
}

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ input).
export type CampusState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
  values?: {name: string; code: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

export async function createCampus(_prev: CampusState, formData: FormData): Promise<CampusState> {
  await requireRole(['admin']);
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const level = (String(formData.get('level') ?? '') || null) as SchoolLevel | null;
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {name, code};

  if (!name) return {ok: false, fieldError: 'name', error: 'Thiếu tên hoặc mã cơ sở', values};
  if (!code) return {ok: false, fieldError: 'code', error: 'Thiếu tên hoặc mã cơ sở', values};
  // Bắt buộc chọn cấp học: thiếu nó thì cơ sở không sinh được khối nào, và người dùng lại rơi
  // vào cảnh gõ tay tên khối — đúng thứ đang đi sửa.
  if (!level || !SCHOOL_LEVELS.includes(level))
    return {ok: false, fieldError: 'level', error: 'Hãy chọn cấp học của cơ sở', values};

  const supabase = await createClient();
  const {error} = await supabase.from('campuses').insert({name, code, level});
  if (error) return {ok: false, error: friendlyError(error), values};

  // Trigger campus_seed_grades đã sinh khối chuẩn theo cấp — báo luôn để khỏi đi tìm.
  const nums = GRADE_NUMBERS[level];
  revalidatePath('/admin');
  return {
    ok: true,
    message: nums
      ? `Đã tạo cơ sở "${name}" và ${nums.length} khối (${nums.map((n) => `Khối ${n}`).join(', ')})`
      : `Đã tạo cơ sở "${name}". Cấp mầm non: hãy thêm khối bằng tay.`,
  };
}

export type ClassState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
  values?: {name: string; grade_id: string; school_year: string; campus_id: string; homeroom_teacher_id: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

export async function createClass(_prev: ClassState, formData: FormData): Promise<ClassState> {
  await requireRole(['admin', 'principal']); // RLS class_principal_insert giới hạn campus
  const name = String(formData.get('name') ?? '').trim();
  const grade_id = String(formData.get('grade_id') ?? '');
  const school_year = String(formData.get('school_year') ?? '').trim();
  const campus_id = String(formData.get('campus_id') ?? '');
  const teacher = String(formData.get('homeroom_teacher_id') ?? '');
  const values = {name, grade_id, school_year, campus_id, homeroom_teacher_id: teacher};

  if (!name) return {ok: false, fieldError: 'name', error: 'Thiếu thông tin lớp (tên / năm học / cơ sở)', values};
  if (!school_year)
    return {ok: false, fieldError: 'school_year', error: 'Thiếu thông tin lớp (tên / năm học / cơ sở)', values};
  if (!campus_id)
    return {ok: false, fieldError: 'campus_id', error: 'Thiếu thông tin lớp (tên / năm học / cơ sở)', values};

  const supabase = await createClient();
  // Khối là thực thể (grade_id); vẫn ghi cột text 'grade' = tên khối để tương thích hiển thị cũ.
  // Audit #6: khối phải thuộc đúng cơ sở đã chọn (chống request giả/stale gán khối lệch cơ sở).
  let grade: string | null = null;
  if (grade_id) {
    const g = await gradeInfo(supabase, grade_id);
    if (!g || g.campus_id !== campus_id)
      return {ok: false, fieldError: 'grade_id', error: 'Khối không thuộc cơ sở đã chọn.', values};
    grade = g.name;
  }
  const {error} = await supabase.from('classes').insert({
    name,
    grade,
    grade_id: grade_id || null,
    school_year,
    campus_id,
    homeroom_teacher_id: teacher || null,
  });
  if (error) return {ok: false, error: friendlyError(error), values};

  revalidatePath('/admin');
  return {ok: true, message: `Đã tạo lớp "${name}"`};
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mời NHIỀU người mới cùng lúc theo email (mỗi dòng/ngăn cách bởi dấu phẩy) + vai trò
// (+ lớp cho GVCN/HS). Áp dụng khi họ đăng nhập lần đầu.
export async function inviteUser(formData: FormData) {
  const me = await requireRole(['admin']);
  const raw = String(formData.get('email') ?? '');
  const role = String(formData.get('role') ?? '') as Role;
  const classId = String(formData.get('class_id') ?? '') || null;
  // Tách nhiều email (xuống dòng / phẩy / chấm phẩy / khoảng trắng), khử trùng lặp.
  const all = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (all.length === 0 || !role) flash('Thiếu email hoặc vai trò');
  const valid = all.filter((e) => EMAIL_RE.test(e));
  const invalidCount = all.length - valid.length;
  if (valid.length === 0) flash('Không có email hợp lệ (định dạng: ten@example.com).');

  const supabase = await createClient();
  const class_id = role === 'teacher' || role === 'student' ? classId : null;
  const rows = valid.map((email) => ({email, role, class_id, invited_by: me.id}));
  const {error} = await supabase.from('pending_user_grants').upsert(rows, {onConflict: 'email'});
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'invite_users',
      p_detail: {count: valid.length, role, class_id},
    });
  }
  revalidatePath('/admin');
  const okMsg =
    valid.length === 1
      ? `Đã mời ${valid[0]}. Vai trò sẽ được gán khi họ đăng nhập lần đầu.`
      : `Đã mời ${valid.length} người. Vai trò sẽ được gán khi họ đăng nhập lần đầu.`;
  const suffix = invalidCount > 0 ? ` (bỏ qua ${invalidCount} email không hợp lệ)` : '';
  flash(error ? friendlyError(error) : okMsg + suffix);
}

// Phân công GVCN: đặt 1 người làm giáo viên chủ nhiệm của lớp (đồng thời set role=teacher).
export async function assignGvcn(formData: FormData) {
  await requireRole(['admin']);
  const userId = String(formData.get('userId') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  if (!userId || !classId) flash('Thiếu giáo viên hoặc lớp');
  const supabase = await createClient();
  const {error: e1} = await supabase.from('profiles').update({role: 'teacher'}).eq('id', userId);
  const {error: e2} = await supabase
    .from('classes')
    .update({homeroom_teacher_id: userId})
    .eq('id', classId);
  revalidatePath('/admin');
  flash(e1 || e2 ? friendlyError(e1 || e2) : 'Đã phân công GVCN');
}

export type ParentState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
  values?: {email: string; student_id: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

export async function inviteParent(_prev: ParentState, formData: FormData): Promise<ParentState> {
  await requireRole(['admin']);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const student_id = String(formData.get('student_id') ?? '');
  const values = {email, student_id};

  if (!EMAIL_RE.test(email)) return {ok: false, fieldError: 'email', error: 'Thiếu email hoặc học sinh', values};
  if (!student_id) return {ok: false, error: 'Thiếu email hoặc học sinh', values};

  const supabase = await createClient();
  const {error} = await supabase
    .from('parent_invitations')
    .upsert({email, student_id, status: 'pending'}, {onConflict: 'email,student_id'});
  if (error) return {ok: false, error: friendlyError(error), values};
  try {
    await supabase.functions.invoke('invite-parent', {body: {email, student_id}});
  } catch {
    // ignore — lời mời đã tạo.
  }
  revalidatePath('/admin');
  return {ok: true, message: `Đã mời phụ huynh ${email}`};
}

// ============================================================
// PHASE 1 — Quản trị Cơ sở / Khối / Lớp: sửa · lưu-trữ · khôi phục · xoá (khi rỗng)
// Tất cả dùng flash/redirect (giữ nhất quán với setUserRole/assignGvcn).
// ============================================================

// Thông tin khối (tên + cơ sở) — để đồng bộ cột text 'grade' và kiểm khối thuộc đúng cơ sở.
async function gradeInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gradeId: string | null,
): Promise<{name: string; campus_id: string} | null> {
  if (!gradeId) return null;
  const {data} = await supabase.from('grades').select('name, campus_id').eq('id', gradeId).maybeSingle();
  return data ?? null;
}

// ---------- CƠ SỞ ----------
export async function updateCampus(formData: FormData) {
  await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const rawLevel = String(formData.get('level') ?? '');
  const level = (rawLevel || null) as SchoolLevel | null;
  if (!id) flash('Thiếu cơ sở cần sửa');
  if (!name || !code) flash('Thiếu tên hoặc mã cơ sở');
  if (level && !SCHOOL_LEVELS.includes(level)) flash('Cấp học không hợp lệ');
  const supabase = await createClient();
  // Đổi cấp học → trigger campus_seed_grades sinh thêm khối chuẩn của cấp mới. KHÔNG xoá khối
  // cũ (lớp có thể đang trỏ vào) — dọn là việc có ý thức của người quản trị.
  const {error} = await supabase.from('campuses').update({name, code, level}).eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'update_campus', p_detail: {campus: id, name, code, level}});
  revalidatePath('/admin');
  revalidatePath('/campus');
  flash(error ? friendlyError(error) : `Đã cập nhật cơ sở "${name}"`);
}

export async function setCampusActive(formData: FormData) {
  await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true'; // true = khôi phục
  if (!id) flash('Thiếu cơ sở');
  const supabase = await createClient();
  const {error} = await supabase.from('campuses').update({is_active: active}).eq('id', id);
  if (!error)
    await supabase.rpc('log_audit', {p_action: active ? 'restore_campus' : 'archive_campus', p_detail: {campus: id}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : active ? 'Đã khôi phục cơ sở' : 'Đã lưu trữ cơ sở');
}

export async function deleteCampus(formData: FormData) {
  await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  if (!id) flash('Thiếu cơ sở');
  const supabase = await createClient();
  const {count} = await supabase
    .from('classes')
    .select('id', {count: 'exact', head: true})
    .eq('campus_id', id);
  if ((count ?? 0) > 0) flash('Không thể xoá: cơ sở còn lớp. Hãy chuyển/lưu-trữ lớp trước, hoặc dùng Lưu trữ.');
  const {error} = await supabase.from('campuses').delete().eq('id', id); // grades cascade
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_campus', p_detail: {campus: id}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã xoá cơ sở (rỗng)');
}

// ---------- KHỐI ----------
export async function createGrade(formData: FormData) {
  await requireRole(['admin', 'principal']); // RLS grade_principal_manage giới hạn campus
  const campus_id = String(formData.get('campus_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const sort_order = Number(formData.get('sort_order') ?? 0) || 0;
  if (!campus_id || !name) flash('Thiếu cơ sở hoặc tên khối');
  const supabase = await createClient();
  // Chặn ở SERVER chứ không chỉ giấu nút: cấp phổ thông có bộ khối cố định do DB sinh, thêm tay
  // là cách dữ liệu rác ("7", "k", "Khối"…) lọt vào lần trước.
  const {data: campus} = await supabase.from('campuses').select('level').eq('id', campus_id).maybeSingle();
  if (hasNumberedGrades(campus?.level))
    flash('Cấp học này đã có bộ khối chuẩn do hệ thống sinh — không thêm khối bằng tay.');
  const {error} = await supabase.from('grades').insert({campus_id, name, sort_order});
  if (!error) await supabase.rpc('log_audit', {p_action: 'create_grade', p_detail: {campus: campus_id, name}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : `Đã tạo khối "${name}"`);
}

export async function updateGrade(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const sort_order = Number(formData.get('sort_order') ?? 0) || 0;
  if (!id || !name) flash('Thiếu khối hoặc tên khối');
  const supabase = await createClient();
  // Đồng bộ cột text 'grade' của các lớp thuộc khối (giữ hiển thị cũ đúng).
  const {data: old} = await supabase.from('grades').select('name, campus_id').eq('id', id).maybeSingle();
  const {error} = await supabase.from('grades').update({name, sort_order}).eq('id', id);
  if (!error && old && old.name !== name) {
    await supabase.from('classes').update({grade: name}).eq('grade_id', id);
  }
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã cập nhật khối');
}

export async function setGradeActive(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) flash('Thiếu khối');
  const supabase = await createClient();
  const {error} = await supabase.from('grades').update({is_active: active}).eq('id', id);
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : active ? 'Đã khôi phục khối' : 'Đã lưu trữ khối');
}

export async function deleteGrade(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  if (!id) flash('Thiếu khối');
  const supabase = await createClient();
  const {count} = await supabase
    .from('classes')
    .select('id', {count: 'exact', head: true})
    .eq('grade_id', id);
  if ((count ?? 0) > 0) flash('Không thể xoá: còn lớp thuộc khối. Hãy đổi khối cho các lớp trước, hoặc dùng Lưu trữ.');
  const {error} = await supabase.from('grades').delete().eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_grade', p_detail: {grade: id}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã xoá khối (rỗng)');
}

// ---------- LỚP ----------
export async function updateClass(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const school_year = String(formData.get('school_year') ?? '').trim();
  const campus_id = String(formData.get('campus_id') ?? '');
  const grade_id = String(formData.get('grade_id') ?? '') || null;
  const teacher = String(formData.get('homeroom_teacher_id') ?? '') || null;
  if (!id) flash('Thiếu lớp cần sửa');
  if (!name || !school_year || !campus_id) flash('Thiếu thông tin lớp (tên / năm học / cơ sở)');
  const supabase = await createClient();
  // Audit #6: khối phải thuộc đúng cơ sở đã chọn.
  let grade: string | null = null;
  if (grade_id) {
    const g = await gradeInfo(supabase, grade_id);
    if (!g || g.campus_id !== campus_id) flash('Khối không thuộc cơ sở đã chọn.');
    grade = g!.name;
  }
  const {error} = await supabase
    .from('classes')
    .update({name, school_year, campus_id, grade_id, grade, homeroom_teacher_id: teacher})
    .eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'update_class', p_detail: {class: id, name}});
  revalidatePath('/admin');
  revalidatePath('/');
  flash(error ? friendlyError(error) : `Đã cập nhật lớp "${name}"`);
}

export async function setClassActive(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) flash('Thiếu lớp');
  const supabase = await createClient();
  const {error} = await supabase.from('classes').update({is_active: active}).eq('id', id);
  if (!error)
    await supabase.rpc('log_audit', {p_action: active ? 'restore_class' : 'archive_class', p_detail: {class: id}});
  revalidatePath('/admin');
  revalidatePath('/');
  flash(error ? friendlyError(error) : active ? 'Đã khôi phục lớp' : 'Đã lưu trữ lớp');
}

export async function deleteClass(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const id = String(formData.get('id') ?? '');
  if (!id) flash('Thiếu lớp');
  const supabase = await createClient();
  const [{count: enr}, {count: wig}] = await Promise.all([
    supabase.from('enrollments').select('id', {count: 'exact', head: true}).eq('class_id', id),
    supabase.from('wigs').select('id', {count: 'exact', head: true}).eq('class_id', id),
  ]);
  if ((enr ?? 0) > 0 || (wig ?? 0) > 0)
    flash('Không thể xoá: lớp còn học sinh hoặc WIG. Hãy dùng Lưu trữ để giữ dữ liệu.');
  const {error} = await supabase.from('classes').delete().eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_class', p_detail: {class: id}});
  revalidatePath('/admin');
  revalidatePath('/');
  flash(error ? friendlyError(error) : 'Đã xoá lớp (rỗng)');
}
