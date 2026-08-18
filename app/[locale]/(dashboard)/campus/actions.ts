'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {SCHOOL_LEVELS, gradeNumbersFor, type SchoolLevel} from '@/lib/levels';
import {taoMotWig} from '@/lib/wig-tao';
import type {Database} from '@/lib/database.types';

type Area = Database['public']['Enums']['wig_domain'];

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
  const g = tachLoi(msg);
  redirect(`/campus?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
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
  flash(error ? loi(friendlyError(error)) : msg + (skipped > 0 ? ` (bỏ qua ${skipped} email sai định dạng)` : ''));
}

export async function cancelInvite(formData: FormData) {
  await myCampus();
  const email = String(formData.get('email') ?? '');
  if (!email) flash('Thiếu email');
  const supabase = await createClient();
  // RLS giới hạn đúng cơ sở HT → không cần (và không nên) tự lọc campus ở đây.
  const {error} = await supabase.from('pending_user_grants').delete().eq('email', email);
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? loi(friendlyError(error)) : `Đã huỷ lời mời ${email}`);
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
      ? loi(friendlyError(error))
      : active
        ? 'Đã khôi phục quyền giáo viên'
        : 'Đã vô hiệu (chuyển về "chờ cấp quyền")',
  );
}

// Khai cấp học cho cơ sở mình → DB sinh luôn bộ khối chuẩn của các cấp đó.
// Đi qua RPC set_my_campus_levels (SECURITY DEFINER) chứ không UPDATE thẳng bảng campuses: HT chỉ
// được đổi đúng cột `levels` của đúng cơ sở mình, không đụng tên/mã/trạng thái lưu-trữ.
export async function setCampusLevel(formData: FormData) {
  await myCampus();
  // Nhiều ô tick cùng name="level" → getAll. Trường liên cấp khai được cả THCS lẫn THPT.
  const levels = [...new Set(formData.getAll('level').map(String))].filter((lv) =>
    SCHOOL_LEVELS.includes(lv as SchoolLevel),
  ) as SchoolLevel[];
  if (levels.length === 0) flash('Hãy chọn ít nhất một cấp học');
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('set_my_campus_levels', {p_levels: levels});
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(loi(friendlyError(error)));
  const nums = gradeNumbersFor(levels);
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
  flash(error ? loi(friendlyError(error)) : userId ? 'Đã phân công GVCN' : 'Đã bỏ phân công GVCN');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA CƠ SỞ — tầng trên cùng của ba tầng WIG.
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// "80% lớp của cơ sở đạt ít nhất 2 mục tiêu năm của lớp." Số của nó KHÔNG ai gõ vào: app đếm
// ngược từ mục tiêu năm của từng lớp, y như mục tiêu lớp đếm ngược từ mục tiêu của từng em.
//
// Vì thế mục tiêu trường luôn là mục tiêu cuộn — xem CHECK wig_school_cuon_ck ở 0116. Một mục
// tiêu trường đo bằng lượt tick sẽ đứng ở 0% suốt năm, vì trường không có ô tick nào của riêng nó.
//
// Đường ghi dùng chung taoMotWig() với mục tiêu lớp: hai chỗ tạo WIG mà hai bộ luật là đúng cái
// bệnh "hai nguồn sự thật" mà repo này đã dọn vài lần.
// BGH duyệt WIG cấp lớp (0148 — quyết định 18/08 cho câu hỏi mở #6 của PRD v3):
// GVCN tạo thì vào 'sent'; chỉ BGH/Admin đưa sang 'approved' — trigger wig_lop_qua_tay_bgh
// chặn đường tự duyệt của GVCN ở CSDL, đây chỉ là cái nút bấm.
export async function duyetWigLop(formData: FormData) {
  const me = await requireRole(['principal', 'admin']);
  const wig_id = String(formData.get('wig_id') ?? '');
  if (!wig_id) redirect(`/campus?flash_err=${encodeURIComponent('Thiếu mục tiêu cần duyệt.')}`);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({status: 'approved', approved_by: me.id, approved_at: new Date().toISOString()})
    .eq('id', wig_id)
    .eq('scope', 'class')
    .eq('status', 'sent')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]/wig', 'page');
  const msg = error
    ? `flash_err=${encodeURIComponent(friendlyError(error))}`
    : data
      ? `flash=${encodeURIComponent('Đã duyệt WIG của lớp')}`
      : `flash_err=${encodeURIComponent('Mục tiêu này không còn chờ duyệt.')}`;
  redirect(`/campus?${msg}`);
}

export async function taoWigTruong(formData: FormData) {
  const profile = await myCampus();
  const soNguyen = (ten: string): number | null => {
    const raw = String(formData.get(ten) ?? '').trim();
    return raw === '' ? null : Math.trunc(Number(raw));
  };
  const supabase = await createClient();
  const kq = await taoMotWig(supabase, {
    class_id: '',
    scope: 'school',
    campus_id: profile.campus_id ?? undefined,
    measure_by: 'cuon',
    title: String(formData.get('title') ?? '').trim(),
    area: (String(formData.get('area') ?? '') as Area) || undefined,
    period_label: String(formData.get('period_label') ?? '').trim(),
    baseline: null,
    target_value: 0,
    unit: '%',
    cuon: {
      ty_le_can: Number(String(formData.get('ty_le_can') ?? '').trim()),
      so_dich_can: soNguyen('so_dich_can') ?? 0,
      tong_dich: soNguyen('tong_dich'),
    },
  });
  revalidatePath('/[locale]/campus', 'page');
  flash(kq.ok ? 'Đã tạo mục tiêu của cơ sở' : loi(kq.loi));
}

// Xoá một mục tiêu của cơ sở. RLS (rls_school_wig_manage) mới là thứ chặn thật: chỉ hiệu trưởng
// của ĐÚNG cơ sở ấy mới xoá được, kể cả khi ai đó bắn thẳng id của cơ sở khác vào đây.
export async function xoaWigTruong(formData: FormData) {
  await myCampus();
  const id = String(formData.get('wig_id') ?? '').trim();
  if (!id) flash('Thiếu mục tiêu cần xoá');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .delete()
    .eq('id', id)
    .eq('scope', 'school')
    .select('id');
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(loi(friendlyError(error)));
  flash(data && data.length > 0 ? 'Đã xoá mục tiêu' : loi('Không xoá được mục tiêu này'));
}
