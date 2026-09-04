'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
// Mọi action ở đây đều có thể đụng `profiles`/`classes` — hai bảng đang được nhớ trong RAM
// (lib/dem-ram.ts). Quên hết ngay trước khi revalidate, để người vừa được đổi vai/đổi lớp thấy
// ngay, không phải chờ 60 giây.
import {quen} from '@/lib/dem-ram';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {SCHOOL_LEVELS, gradeNumbersFor, hasNumberedGrades, type SchoolLevel} from '@/lib/levels';
import type {Database} from '@/lib/database.types';

type Role = Database['public']['Enums']['user_role'];

// Hiện thông báo bằng cách redirect kèm ?flash=... (page đọc và hiển thị banner).
function flash(msg: string): never {
  const g = tachLoi(msg);
  redirect(`/admin?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// MỌI CÂU BÁO ĐI QUA messages/loiAdmin.* (audit 04/09/2026: 74 chuỗi Việt cứng trong file này →
// màn tiếng Anh vẫn hiện tiếng Việt). getTranslations trong server action đọc đúng locale của
// request đang chạy.
const tl = () => getTranslations('loiAdmin');

// Vì sao các action dưới đây KHÔNG gọi supabase.auth.getUser() nữa:
// requireRole() vừa trả về đúng hồ sơ của người đang thao tác (có sẵn .id), trong khi getUser()
// là một vòng mạng THẬT tới Supabase Auth. Gọi thêm nó chỉ để lấy lại chính cái id đó là bắt
// người dùng chờ thêm một lượt đi-về cho mỗi lần bấm — đây là một phần lý do màn Quản trị bị
// than "bấm xong không thấy gì, tưởng treo".

// ĐỔI VAI THÌ LỚP CŨ THÔI GẮN.
//
// Chủ dự án 16/08/2026: cho một GVCN lên ban giám hiệu mà người ấy vẫn đứng tên chủ nhiệm lớp cũ.
// Chủ nhiệm là việc của vai giáo viên; sang vai khác mà vẫn giữ tên trên lớp thì lớp ấy hiện
// "đã có GVCN" trong khi không còn ai chủ nhiệm thật — và cô giáo mới không nhận lớp được (0097
// chỉ gán khi homeroom_teacher_id còn trống). Chỉ admin mới tới được đây nên trigger bảo vệ cột
// (0018/0097) cho qua.
async function thoiChuNhiemNeuKhongConLaGiaoVien(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
  role: Role,
) {
  if (role === 'teacher' || userIds.length === 0) return;
  await supabase.from('classes').update({homeroom_teacher_id: null}).in('homeroom_teacher_id', userIds);
}

export async function setUserRole(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const userId = String(formData.get('userId'));
  const role = String(formData.get('role')) as Role;
  // Chặn admin tự đổi vai trò của chính mình (tránh tự khoá quyền admin).
  if (me.id === userId) flash(loi(t('roleSelf')));
  const supabase = await createClient();
  const {error} = await supabase.from('profiles').update({role}).eq('id', userId);
  if (!error) {
    await thoiChuNhiemNeuKhongConLaGiaoVien(supabase, [userId], role);
    await supabase.rpc('log_audit', {
      p_action: 'set_user_role',
      p_detail: {target_user: userId, new_role: role},
    });
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('roleChanged'));
}

// ---------- DUYỆT / XOÁ NHIỀU NGƯỜI CÙNG LÚC ----------
//
// Một đợt tuyển đầu năm đẩy vài chục giáo viên vào vai "chờ cấp quyền" cùng một buổi. Trước đây
// mỗi người là một <form> riêng: chọn vai → bấm → cả trang tải lại → cuộn tìm lại chỗ cũ, nhân
// với ba mươi lần. Nay tick một loạt rồi bấm một cái.
//
// Bỏ qua chính mình trong danh sách (đổi vai/xoá bản thân là cách tự khoá quyền admin) thay vì
// chặn cả mẻ: người bấm "chọn tất cả" không nên bị cả thao tác hỏng chỉ vì dòng của họ lọt vào.
export async function bulkSetUserRole(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const role = String(formData.get('role') ?? '') as Role;
  const ids = formData.getAll('userId').map(String).filter(Boolean);
  const targets = ids.filter((id) => id !== me.id);
  const skippedSelf = ids.length - targets.length;
  if (!role) flash(loi(t('bulkNoRole')));
  if (targets.length === 0) flash(loi(skippedSelf > 0 ? t('bulkSelfOnly') : t('bulkNone')));

  const supabase = await createClient();
  const {error} = await supabase.from('profiles').update({role}).in('id', targets);
  if (!error) {
    await thoiChuNhiemNeuKhongConLaGiaoVien(supabase, targets, role);
    await supabase.rpc('log_audit', {
      p_action: 'bulk_set_user_role',
      p_detail: {targets, new_role: role},
    });
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(
    error
      ? loi(friendlyError(error, tLoi))
      : t('bulkGranted', {n: targets.length}) + (skippedSelf > 0 ? t('bulkSkippedSelf') : ''),
  );
}

export async function bulkDeleteUsers(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const ids = formData.getAll('userId').map(String).filter(Boolean);
  const targets = ids.filter((id) => id !== me.id);
  const skippedSelf = ids.length - targets.length;
  if (targets.length === 0) flash(loi(skippedSelf > 0 ? t('deleteSelfOnly') : t('bulkNone')));

  const supabase = await createClient();
  // admin_delete_user nhận MỘT người mỗi lần (nó dọn cả dữ liệu liên quan), nên phải gọi lần
  // lượt. Số lượng bị chặn bởi số dòng đang hiện trên trang nên không có vòng lặp vô hạn.
  let ok = 0;
  const failed: string[] = [];
  for (const id of targets) {
    const {error} = await supabase.rpc('admin_delete_user', {p_user: id});
    if (error) failed.push(friendlyError(error, tLoi));
    else ok++;
  }
  if (ok > 0) await supabase.rpc('log_audit', {p_action: 'bulk_delete_users', p_detail: {count: ok}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  // Báo CẢ hai con số: xoá 8/10 mà chỉ nói "đã xoá" thì hai người còn lại biến mất khỏi nhận thức
  // của người quản trị chứ không biến mất khỏi cơ sở dữ liệu.
  flash(
    failed.length > 0 ? loi(t('deletedSome', {ok, fail: failed.length, err: failed[0]})) : t('deletedN', {n: ok}),
  );
}

export async function disableUser(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const userId = String(formData.get('userId') ?? '');
  if (me.id === userId) flash(loi(t('disableSelf')));
  const supabase = await createClient();
  const {error} = await supabase.from('profiles').update({role: 'pending'}).eq('id', userId);
  if (!error) await supabase.rpc('log_audit', {p_action: 'disable_user', p_detail: {target_user: userId}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('disabled'));
}

export async function deleteUser(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const userId = String(formData.get('userId') ?? '');
  if (me.id === userId) flash(loi(t('deleteSelfOnly')));
  const supabase = await createClient();
  const {error} = await supabase.rpc('admin_delete_user', {p_user: userId});
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_user', p_detail: {target_user: userId}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('deleted'));
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
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  // Nhiều ô tick cùng name="level" → getAll. Trường liên cấp chọn được cả THCS lẫn THPT.
  const levels = [...new Set(formData.getAll('level').map(String))].filter((lv) =>
    SCHOOL_LEVELS.includes(lv as SchoolLevel),
  ) as SchoolLevel[];
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {name, code};

  if (!name) return {ok: false, fieldError: 'name', error: t('campusMissing'), values};
  if (!code) return {ok: false, fieldError: 'code', error: t('campusMissing'), values};
  // Bắt buộc chọn cấp học: thiếu nó thì cơ sở không sinh được khối nào, và người dùng lại rơi
  // vào cảnh gõ tay tên khối — đúng thứ đang đi sửa.
  if (levels.length === 0) return {ok: false, fieldError: 'level', error: t('campusLevel'), values};

  const supabase = await createClient();
  const {error} = await supabase.from('campuses').insert({name, code, levels});
  if (error) return {ok: false, error: friendlyError(error, tLoi), values};

  // Trigger campus_seed_grades đã sinh khối chuẩn theo cấp — báo luôn để khỏi đi tìm.
  const nums = gradeNumbersFor(levels);
  quen();
  revalidatePath('/[locale]/admin', 'page');
  return {
    ok: true,
    message: nums
      ? t('campusCreated', {name, n: nums.length, list: nums.map((n) => t('gradeLabel', {n})).join(', ')})
      : t('campusCreatedManual', {name}),
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
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']); // RLS class_principal_insert giới hạn campus
  const t = await tl();
  const name = String(formData.get('name') ?? '').trim();
  const grade_id = String(formData.get('grade_id') ?? '');
  const school_year = String(formData.get('school_year') ?? '').trim();
  const campus_id = String(formData.get('campus_id') ?? '');
  const teacher = String(formData.get('homeroom_teacher_id') ?? '');
  const values = {name, grade_id, school_year, campus_id, homeroom_teacher_id: teacher};

  if (!name) return {ok: false, fieldError: 'name', error: t('classMissing'), values};
  if (!school_year) return {ok: false, fieldError: 'school_year', error: t('classMissing'), values};
  if (!campus_id) return {ok: false, fieldError: 'campus_id', error: t('classMissing'), values};

  const supabase = await createClient();
  // Khối là thực thể (grade_id); vẫn ghi cột text 'grade' = tên khối để tương thích hiển thị cũ.
  // Audit #6: khối phải thuộc đúng cơ sở đã chọn (chống request giả/stale gán khối lệch cơ sở).
  let grade: string | null = null;
  if (grade_id) {
    const g = await gradeInfo(supabase, grade_id);
    if (!g || g.campus_id !== campus_id)
      return {ok: false, fieldError: 'grade_id', error: t('gradeNotInCampus'), values};
    grade = g.name;
    // PRD v3 Giai đoạn 1 = KHỐI 1–9 (changelog #9). Chỉ chặn TẠO MỚI: các lớp 10–12 đang chạy
    // (Marketing, 11A1…) giữ nguyên — khoá hồi tố là giết dữ liệu thật đang dùng (18/08/2026).
    const soKhoi = Number((grade.match(/\d+/) ?? [])[0]);
    if (Number.isFinite(soKhoi) && (soKhoi < 1 || soKhoi > 9))
      return {ok: false, fieldError: 'grade_id', error: t('gradeRange'), values};
  }
  const {error} = await supabase.from('classes').insert({
    name,
    grade,
    grade_id: grade_id || null,
    school_year,
    campus_id,
    homeroom_teacher_id: teacher || null,
  });
  if (error) return {ok: false, error: friendlyError(error, tLoi), values};

  // Giao chủ nhiệm cho người còn ở vai 'chờ cấp quyền' thì NÂNG VAI luôn.
  // Danh sách chọn GVCN nay có cả người vừa đăng nhập lần đầu (còn 'pending') — trước đây họ bị
  // lọc ra nên hiệu trưởng vừa mời giáo viên xong lại không chọn được, đúng như phản ánh "không
  // gõ được tên chủ nhiệm mới". Không nâng vai thì lớp có tên GVCN nhưng người đó vẫn không vào
  // được lớp — một trạng thái nửa vời còn khó hiểu hơn.
  if (teacher) await promoteToTeacher(supabase, teacher);

  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]/campus', 'page');
  return {ok: true, message: t('classCreated', {name})};
}

// Nâng 'pending' → 'teacher'. Chỉ đụng đúng người đang ở vai 'pending' (điều kiện .eq('role',...)),
// nên không bao giờ hạ vai một admin/hiệu trưởng xuống giáo viên do gán nhầm.
async function promoteToTeacher(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  await supabase.from('profiles').update({role: 'teacher'}).eq('id', userId).eq('role', 'pending');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mời NHIỀU người mới cùng lúc theo email (mỗi dòng/ngăn cách bởi dấu phẩy) + vai trò
// (+ lớp cho GVCN/HS). Áp dụng khi họ đăng nhập lần đầu.
export async function inviteUser(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
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
  if (all.length === 0 || !role) flash(loi(t('inviteMissing')));
  const valid = all.filter((e) => EMAIL_RE.test(e));
  const invalidCount = all.length - valid.length;
  if (valid.length === 0) flash(loi(t('inviteNoValid')));

  const supabase = await createClient();
  const class_id = role === 'teacher' || role === 'student' ? classId : null;
  // GHI LUÔN CƠ SỞ CỦA LỚP.
  //
  // Thiếu nó thì lời mời vô hình với hiệu trưởng: luật đọc của họ (0049) nhận diện bằng đúng cột
  // này. Đã thấy hậu quả thật — hiệu trưởng mở một lớp có 10 em đã mời mà chỉ thấy một dòng.
  // 0095 thêm đường đọc theo LỚP nên không còn phụ thuộc cột này nữa, nhưng vẫn ghi cho đúng:
  // một hàng dữ liệu khai đủ thì mọi chỗ đọc nó đều đúng, không phải nhớ chỗ nào đọc kiểu gì.
  let campus_id: string | null = null;
  if (class_id) {
    const {data: lop} = await supabase.from('classes').select('campus_id').eq('id', class_id).maybeSingle();
    campus_id = lop?.campus_id ?? null;
  }
  const rows = valid.map((email) => ({email, role, class_id, campus_id, invited_by: me.id}));
  const {error} = await supabase.from('pending_user_grants').upsert(rows, {onConflict: 'email'});
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'invite_users',
      p_detail: {count: valid.length, role, class_id},
    });
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  const okMsg = valid.length === 1 ? t('invitedOne', {email: valid[0]}) : t('invitedMany', {n: valid.length});
  const suffix = invalidCount > 0 ? t('inviteSkipped', {n: invalidCount}) : '';
  flash(error ? loi(friendlyError(error, tLoi)) : okMsg + suffix);
}

// XẾP LỚP CHO MỘT EM ĐÃ CÓ TÀI KHOẢN NHƯNG CHƯA THUỘC LỚP NÀO.
//
// Cảnh sinh ra hàm này: em tự đăng nhập từ ngoài, quản trị viên duyệt cho vai học sinh, rồi em
// nằm im — không lớp, không màn nào liệt kê, không ai biết để xếp.
//
// Đi qua ĐÚNG cái RPC mà màn Danh sách lớp vẫn dùng, không tự viết insert riêng: ở đó mới có luật
// "một em chỉ học một lớp" (vào lớp mới thì tắt lớp cũ) và mới kiểm quyền theo lớp. Hai đường ghi
// vào cùng một bảng là hai cơ hội trôi khỏi nhau.
export async function xepLopChoHocSinh(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const email = String(formData.get('email') ?? '').trim();
  const classId = String(formData.get('class_id') ?? '');
  if (!email || !classId) flash(loi(t('xepLopMissing')));

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('enroll_student_by_email', {p_class: classId, p_email: email});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]/roster', 'page');
  if (error) flash(loi(friendlyError(error, tLoi)));
  // 'not_found' ở đây KHÁC với ở màn ghi danh: bên đó email lạ thì tạo lời mời, còn ở đây danh
  // sách chỉ gồm em ĐÃ có tài khoản — trả về not_found nghĩa là hồ sơ vừa bị đổi vai hoặc bị xoá
  // giữa chừng, và nói thẳng ra vẫn hơn là báo "đã xếp lớp" cho một việc không xảy ra.
  flash(data === 'ok' ? t('xepLopDone', {email}) : loi(t('xepLopFail', {email})));
}

// Phân công GVCN: đặt 1 người làm giáo viên chủ nhiệm của lớp.
export async function assignGvcn(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin']);
  const t = await tl();
  const userId = String(formData.get('userId') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  if (!userId || !classId) flash(loi(t('assignMissing')));
  const supabase = await createClient();

  // KHÔNG HẠ VAI BỪA (audit 18/08/2026). Bản cũ `update({role:'teacher'})` KHÔNG lọc — chọn một
  // hiệu trưởng/admin (ô chọn đổ cả ba vai) là âm thầm giật mất vai của họ; chọn CHÍNH MÌNH là
  // admin tự đá mình khỏi /admin. GVCN phải là teacher/pending: admin/principal thì từ chối;
  // pending thì nâng lên teacher (promoteToTeacher đã lọc .eq('role','pending')); teacher thì
  // để nguyên.
  const {data: nguoi} = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (!nguoi) flash(loi(t('assignNotFound')));
  if (userId === me.id) flash(loi(t('assignSelf')));
  if (nguoi!.role === 'admin' || nguoi!.role === 'principal') flash(loi(t('assignNotTeacher')));
  if (nguoi!.role === 'pending') await promoteToTeacher(supabase, userId);

  const {error: e2} = await supabase
    .from('classes')
    .update({homeroom_teacher_id: userId})
    .eq('id', classId);
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(e2 ? loi(friendlyError(e2, tLoi)) : t('assignDone'));
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
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const student_id = String(formData.get('student_id') ?? '');
  const values = {email, student_id};

  if (!EMAIL_RE.test(email)) return {ok: false, fieldError: 'email', error: t('parentMissing'), values};
  if (!student_id) return {ok: false, error: t('parentMissing'), values};

  const supabase = await createClient();
  const {error} = await supabase
    .from('parent_invitations')
    .upsert({email, student_id, status: 'pending'}, {onConflict: 'email,student_id'});
  if (error) return {ok: false, error: friendlyError(error, tLoi), values};
  try {
    await supabase.functions.invoke('invite-parent', {body: {email, student_id}});
  } catch {
    // ignore — lời mời đã tạo.
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  return {ok: true, message: t('parentInvited', {email})};
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
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const levels = [...new Set(formData.getAll('level').map(String))].filter((lv) =>
    SCHOOL_LEVELS.includes(lv as SchoolLevel),
  ) as SchoolLevel[];
  if (!id) flash(loi(t('campusEditMissing')));
  if (!name || !code) flash(loi(t('campusMissing')));
  if (levels.length === 0) flash(loi(t('campusLevel')));
  const supabase = await createClient();
  // Thêm cấp → trigger campus_seed_grades sinh thêm khối chuẩn của cấp mới. BỎ một cấp thì KHÔNG
  // xoá khối cũ (lớp có thể đang trỏ vào) — dọn là việc có ý thức của người quản trị.
  const {error} = await supabase.from('campuses').update({name, code, levels}).eq('id', id);
  if (!error)
    await supabase.rpc('log_audit', {p_action: 'update_campus', p_detail: {campus: id, name, code, levels}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('campusUpdated', {name}));
}

export async function setCampusActive(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true'; // true = khôi phục
  if (!id) flash(loi(t('campusIdMissing')));
  const supabase = await createClient();
  const {error} = await supabase.from('campuses').update({is_active: active}).eq('id', id);
  if (!error)
    await supabase.rpc('log_audit', {p_action: active ? 'restore_campus' : 'archive_campus', p_detail: {campus: id}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : active ? t('campusRestored') : t('campusArchived'));
}

export async function deleteCampus(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  if (!id) flash(loi(t('campusIdMissing')));
  const supabase = await createClient();
  const {count} = await supabase
    .from('classes')
    .select('id', {count: 'exact', head: true})
    .eq('campus_id', id);
  if ((count ?? 0) > 0) flash(loi(t('campusHasClasses')));
  const {error} = await supabase.from('campuses').delete().eq('id', id); // grades cascade
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_campus', p_detail: {campus: id}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('campusDeleted'));
}

// ---------- KHỐI ----------
export async function createGrade(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']); // RLS grade_principal_manage giới hạn campus
  const t = await tl();
  const campus_id = String(formData.get('campus_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const sort_order = Number(formData.get('sort_order') ?? 0) || 0;
  if (!campus_id || !name) flash(loi(t('gradeMissing')));
  const supabase = await createClient();
  // Chặn ở SERVER chứ không chỉ giấu nút: cấp phổ thông có bộ khối cố định do DB sinh, thêm tay
  // là cách dữ liệu rác ("7", "k", "Khối"…) lọt vào lần trước.
  const {data: campus} = await supabase.from('campuses').select('levels').eq('id', campus_id).maybeSingle();
  // Chỉ khoá khi MỌI cấp của cơ sở đều đánh số khối. Cơ sở có mầm non thì phải gõ tay được
  // (Nhà trẻ, Mầm, Chồi, Lá…) — khoá cứng theo một cấp sẽ chặn luôn phần ấy.
  if (hasNumberedGrades(campus?.levels)) flash(loi(t('gradeManual')));
  const {error} = await supabase.from('grades').insert({campus_id, name, sort_order});
  if (!error) await supabase.rpc('log_audit', {p_action: 'create_grade', p_detail: {campus: campus_id, name}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('gradeCreated', {name}));
}

export async function updateGrade(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const sort_order = Number(formData.get('sort_order') ?? 0) || 0;
  if (!id || !name) flash(loi(t('gradeEditMissing')));
  const supabase = await createClient();
  // Đồng bộ cột text 'grade' của các lớp thuộc khối (giữ hiển thị cũ đúng).
  const {data: old} = await supabase.from('grades').select('name, campus_id').eq('id', id).maybeSingle();
  const {error} = await supabase.from('grades').update({name, sort_order}).eq('id', id);
  if (!error && old && old.name !== name) {
    await supabase.from('classes').update({grade: name}).eq('grade_id', id);
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('gradeUpdated'));
}

export async function setGradeActive(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) flash(loi(t('gradeIdMissing')));
  const supabase = await createClient();
  const {error} = await supabase.from('grades').update({is_active: active}).eq('id', id);
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : active ? t('gradeRestored') : t('gradeArchived'));
}

export async function deleteGrade(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  if (!id) flash(loi(t('gradeIdMissing')));
  const supabase = await createClient();
  const {count} = await supabase
    .from('classes')
    .select('id', {count: 'exact', head: true})
    .eq('grade_id', id);
  if ((count ?? 0) > 0) flash(loi(t('gradeHasClasses')));
  const {error} = await supabase.from('grades').delete().eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_grade', p_detail: {grade: id}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('gradeDeleted'));
}

// ---------- LỚP ----------
export async function updateClass(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const school_year = String(formData.get('school_year') ?? '').trim();
  const campus_id = String(formData.get('campus_id') ?? '');
  const grade_id = String(formData.get('grade_id') ?? '') || null;
  const teacher = String(formData.get('homeroom_teacher_id') ?? '') || null;
  if (!id) flash(loi(t('classEditMissing')));
  if (!name || !school_year || !campus_id) flash(loi(t('classMissing')));
  const supabase = await createClient();
  // Audit #6: khối phải thuộc đúng cơ sở đã chọn.
  let grade: string | null = null;
  if (grade_id) {
    const g = await gradeInfo(supabase, grade_id);
    if (!g || g.campus_id !== campus_id) flash(loi(t('gradeNotInCampus')));
    grade = g!.name;
  }
  const {error} = await supabase
    .from('classes')
    .update({name, school_year, campus_id, grade_id, grade, homeroom_teacher_id: teacher})
    .eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'update_class', p_detail: {class: id, name}});
  // Gán GVCN cho người còn 'chờ cấp quyền' thì nâng vai luôn — xem ghi chú ở createClass.
  if (!error && teacher) await promoteToTeacher(supabase, teacher);
  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('classUpdated', {name}));
}

export async function setClassActive(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) flash(loi(t('classIdMissing')));
  const supabase = await createClient();
  const {error} = await supabase.from('classes').update({is_active: active}).eq('id', id);
  if (!error)
    await supabase.rpc('log_audit', {p_action: active ? 'restore_class' : 'archive_class', p_detail: {class: id}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : active ? t('classRestored') : t('classArchived'));
}

export async function deleteClass(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tl();
  const id = String(formData.get('id') ?? '');
  if (!id) flash(loi(t('classIdMissing')));
  const supabase = await createClient();
  const [{count: enr}, {count: wig}] = await Promise.all([
    supabase.from('enrollments').select('id', {count: 'exact', head: true}).eq('class_id', id),
    supabase.from('muc_tieu').select('id', {count: 'exact', head: true}).eq('class_id', id),
  ]);
  if ((enr ?? 0) > 0 || (wig ?? 0) > 0) flash(loi(t('classHasData')));
  const {error} = await supabase.from('classes').delete().eq('id', id);
  if (!error) await supabase.rpc('log_audit', {p_action: 'delete_class', p_detail: {class: id}});
  quen();
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error, tLoi)) : t('classDeleted'));
}

// Huỷ một khai báo đang chờ (người đó chưa đăng nhập lần đầu).
//
// Xoá dòng trong pending_user_grants nghĩa là: người đó đăng nhập sẽ chỉ vào được vai "chờ cấp
// quyền" như người lạ, không tự nhận vai và lớp đã khai. Không đụng gì tới tài khoản đã tồn tại —
// dòng chờ chỉ có ý nghĩa cho lần đăng nhập ĐẦU TIÊN.
export async function cancelUserGrant(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const email = String(formData.get('email') ?? '').trim();
  if (!email) flash(loi(t('emailMissing')));
  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn / không còn dòng nào" với "đã xoá xong" — không báo thành
  // công giả.
  const {data, error} = await supabase
    .from('pending_user_grants')
    .delete()
    .ilike('email', email)
    .select('email');
  quen();
  revalidatePath('/[locale]/admin', 'page');
  if (error) flash(loi(friendlyError(error, tLoi)));
  flash((data ?? []).length > 0 ? t('grantCancelled', {email}) : loi(t('grantCancelFail')));
}

// Huỷ một lời mời phụ huynh đang chờ.
export async function cancelParentInvite(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const email = String(formData.get('email') ?? '').trim();
  if (!email) flash(loi(t('emailMissing')));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('parent_invitations')
    .delete()
    .ilike('email', email)
    .eq('status', 'pending')
    .select('email');
  quen();
  revalidatePath('/[locale]/admin', 'page');
  if (error) flash(loi(friendlyError(error, tLoi)));
  flash((data ?? []).length > 0 ? t('parentCancelled', {email}) : loi(t('parentCancelFail')));
}

// LƯU CẢ MỘT ĐỢT SỬA KHAI BÁO BẰNG MỘT LẦN BẤM.
//
// Bản trước mỗi dòng là một <form> với một nút "Lưu" riêng: sửa vai của ba mươi ba người là ba
// mươi ba lần bấm, ba mươi ba vòng đi-về (trung vị 251 ms mỗi vòng trên đường truyền này) và ba
// mươi ba lần tải lại trang, mỗi lần lại phải cuộn tìm về chỗ cũ. Đầu năm khai năm trăm học sinh
// thì cách ấy không dùng được.
//
// Nay giao diện gom mọi dòng ĐÃ ĐỔI vào một lần gửi, dưới dạng ba mảng song song (email/role/
// class_id). FormData.getAll giữ nguyên thứ tự khai trong tài liệu nên ba mảng khớp theo chỉ số —
// vẫn kiểm lại độ dài trước khi dùng, vì lệch một phần tử là gán nhầm vai cho người khác.
//
// Chỉ dòng có THAY ĐỔI mới được gửi lên (giao diện tự so với giá trị gốc), nên số dòng ở đây là số
// người thật sự bị sửa, không phải cả trang.
export async function updateUserGrants(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await tl();
  const emails = formData.getAll('email').map((v) => String(v).trim());
  const roles = formData.getAll('role').map(String);
  const classIds = formData.getAll('class_id').map(String);

  if (emails.length === 0) flash(loi(t('grantsNoChange')));
  if (roles.length !== emails.length || classIds.length !== emails.length) flash(loi(t('grantsMismatch')));
  if (emails.some((e) => !e)) flash(loi(t('grantsMissingEmail')));
  // Chỉ nhận đúng những vai khai sẵn được. Thiếu bước này thì một request nặn tay có thể đẩy người
  // ta thẳng lên 'admin' — hoặc về 'pending', tức là đăng nhập vào chỉ còn màn hình đỏ.
  const VAI_KHAI_DUOC: Role[] = ['teacher', 'principal', 'admin', 'student', 'parent'];
  if (roles.some((r) => !VAI_KHAI_DUOC.includes(r as Role))) flash(loi(t('grantsBadRole')));

  // Gom theo cặp (vai, lớp): năm trăm học sinh cùng vào 10A1 chỉ tốn MỘT câu UPDATE, không phải
  // năm trăm.
  const nhom = new Map<string, {role: Role; class_id: string | null; emails: string[]}>();
  emails.forEach((email, i) => {
    const role = roles[i] as Role;
    // BGH/admin không thuộc lớp nào — trigger 0139 cũng ép về null, đây chỉ để gom nhóm đúng.
    const class_id = role === 'principal' || role === 'admin' ? null : classIds[i] || null;
    const khoa = `${role}|${class_id ?? ''}`;
    const g = nhom.get(khoa) ?? {role, class_id, emails: []};
    g.emails.push(email);
    nhom.set(khoa, g);
  });

  const supabase = await createClient();
  let xong = 0;
  for (const g of nhom.values()) {
    // .select() để đếm dòng THẬT SỰ đổi — phân biệt "RLS chặn / khai báo không còn" với "đã lưu",
    // thay vì báo thành công giả.
    const {data, error} = await supabase
      .from('pending_user_grants')
      .update({role: g.role, class_id: g.class_id})
      .in('email', g.emails)
      .select('email');
    if (error) {
      quen();
      revalidatePath('/[locale]/admin', 'page');
      flash(loi(t('grantsPartialError', {err: friendlyError(error, tLoi), n: xong})));
    }
    xong += (data ?? []).length;
  }
  if (xong > 0) {
    await supabase.rpc('log_audit', {
      p_action: 'update_user_grants',
      p_detail: {count: xong, emails},
    });
  }
  quen();
  revalidatePath('/[locale]/admin', 'page');
  flash(
    xong === emails.length
      ? t('grantsSaved', {n: xong})
      : xong === 0
        ? loi(t('grantsNone'))
        : loi(t('grantsPartial', {ok: xong, n: emails.length})),
  );
}

// Ghi chú: updateUserGrant (sửa MỘT dòng) đã bị gỡ. Giao diện không còn nút Lưu trên từng dòng —
// mọi thay đổi đi qua updateUserGrants ở trên, kể cả khi chỉ sửa đúng một người.
