'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import type {Database} from '@/lib/database.types';

type Role = Database['public']['Enums']['user_role'];

// Hiện thông báo bằng cách redirect kèm ?flash=... (page đọc và hiển thị banner).
function flash(msg: string): never {
  redirect(`/admin?flash=${encodeURIComponent(msg)}`);
}

export async function setUserRole(formData: FormData) {
  const userId = String(formData.get('userId'));
  const role = String(formData.get('role')) as Role;
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  // Chặn admin tự đổi vai trò của chính mình (tránh tự khoá quyền admin).
  if (user && user.id === userId) {
    flash('Không thể tự đổi vai trò của chính mình (tránh tự khoá quyền admin). Hãy nhờ một admin khác.');
  }
  const {error} = await supabase.from('profiles').update({role}).eq('id', userId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'set_user_role',
      p_detail: {target_user: userId, new_role: role},
    });
  }
  revalidatePath('/admin');
  flash(error ? `Lỗi đổi vai trò: ${error.message}` : 'Đã đổi vai trò');
}

export async function disableUser(formData: FormData) {
  const userId = String(formData.get('userId') ?? '');
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (user && user.id === userId) flash('Không thể tự vô hiệu chính mình.');
  const {error} = await supabase.from('profiles').update({role: 'pending'}).eq('id', userId);
  if (!error) await supabase.rpc('log_audit', {p_action: 'disable_user', p_detail: {target_user: userId}});
  revalidatePath('/admin');
  flash(error ? `Lỗi vô hiệu: ${error.message}` : 'Đã vô hiệu (chuyển về "chờ cấp quyền")');
}

export async function deleteUser(formData: FormData) {
  const userId = String(formData.get('userId') ?? '');
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (user && user.id === userId) flash('Không thể xoá chính mình.');
  const {error} = await supabase.functions.invoke('admin-delete-user', {body: {user_id: userId}});
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_user', p_detail: {target_user: userId}});
  revalidatePath('/admin');
  flash(error ? `Lỗi xoá: ${error.message}` : 'Đã xoá người dùng');
}

export async function createCampus(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!name || !code) flash('Thiếu tên hoặc mã cơ sở');
  const supabase = await createClient();
  const {error} = await supabase.from('campuses').insert({name, code});
  revalidatePath('/admin');
  flash(error ? `Lỗi tạo cơ sở: ${error.message}` : `Đã tạo cơ sở "${name}"`);
}

export async function createClass(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const grade = String(formData.get('grade') ?? '').trim() || null;
  const school_year = String(formData.get('school_year') ?? '').trim();
  const campus_id = String(formData.get('campus_id') ?? '');
  const teacher = String(formData.get('homeroom_teacher_id') ?? '');
  if (!name || !school_year || !campus_id) flash('Thiếu thông tin lớp (tên / năm học / cơ sở)');
  const supabase = await createClient();
  const {error} = await supabase.from('classes').insert({
    name,
    grade,
    school_year,
    campus_id,
    homeroom_teacher_id: teacher || null,
  });
  revalidatePath('/admin');
  flash(error ? `Lỗi tạo lớp: ${error.message}` : `Đã tạo lớp "${name}"`);
}

// Mời người dùng mới theo email + vai trò (+ lớp cho GVCN/HS). Áp dụng khi họ đăng nhập lần đầu.
export async function inviteUser(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '') as Role;
  const classId = String(formData.get('class_id') ?? '') || null;
  if (!email || !role) flash('Thiếu email hoặc vai trò');
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const {error} = await supabase.from('pending_user_grants').upsert(
    {
      email,
      role,
      class_id: role === 'teacher' || role === 'student' ? classId : null,
      invited_by: user?.id ?? null,
    },
    {onConflict: 'email'},
  );
  revalidatePath('/admin');
  flash(
    error
      ? `Lỗi mời: ${error.message}`
      : `Đã mời ${email}. Vai trò sẽ được gán khi họ đăng nhập lần đầu.`,
  );
}

// Phân công GVCN: đặt 1 người làm giáo viên chủ nhiệm của lớp (đồng thời set role=teacher).
export async function assignGvcn(formData: FormData) {
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
  flash(e1 || e2 ? `Lỗi phân công: ${(e1 || e2)?.message}` : 'Đã phân công GVCN');
}

export async function inviteParent(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const student_id = String(formData.get('student_id') ?? '');
  if (!email || !student_id) flash('Thiếu email hoặc học sinh');
  const supabase = await createClient();
  const {error} = await supabase
    .from('parent_invitations')
    .upsert({email, student_id, status: 'pending'}, {onConflict: 'email,student_id'});
  try {
    await supabase.functions.invoke('invite-parent', {body: {email, student_id}});
  } catch {
    // ignore — lời mời đã tạo.
  }
  revalidatePath('/admin');
  flash(error ? `Lỗi mời phụ huynh: ${error.message}` : `Đã mời phụ huynh ${email}`);
}
