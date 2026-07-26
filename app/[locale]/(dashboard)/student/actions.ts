'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentProfile, requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {clientIp} from '@/lib/ip';
import {buddyNote, buddyChat, type BuddyContext, type BuddyLead} from '@/lib/buddy';
import {weekRangeVN, schoolYearRangeVN, todayInVN} from '@/lib/dates';
import type {Database} from '@/lib/database.types';

type Mood = Database['public']['Enums']['mood_level'];

// Check-in cảm xúc = điểm danh, có CỔNG IP (chỉ khi ở mạng trường).
// Đường ghi duy nhất: server đọc IP thật từ header → gọi hàm student_checkin bằng service_role.
// Học sinh KHÔNG thể tự gọi hàm này (đã revoke) nên không lách được cổng IP.
export type CheckinResult = {ok: boolean; blocked?: boolean; noClass?: boolean; error?: string};

export async function checkinMood(mood: Mood): Promise<CheckinResult> {
  // Xác thực phía server: phải là học sinh đang đăng nhập.
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'student') return {ok: false, error: 'forbidden'};

  const ip = clientIp(await headers());

  // service_role: bỏ qua RLS + được phép gọi student_checkin (đã kiểm IP bên trong hàm).
  const admin = createAdminClient();
  const {data, error} = await admin.rpc('student_checkin', {
    p_student: profile.id,
    p_mood: mood,
    p_ip: ip ?? '',
  });
  if (error) return {ok: false, error: friendlyError(error)};
  if (data === 'blocked') return {ok: false, blocked: true};
  if (data === 'no_class') return {ok: false, noClass: true};

  revalidatePath('/student');
  revalidatePath(`/student/${profile.id}`);
  revalidatePath('/attendance');
  return {ok: true};
}

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

// Tiêu đề lead measure mặc định theo lĩnh vực (GVCN có thể đổi sau).
const DEFAULT_LEAD_TITLE: Record<(typeof AREAS)[number], string> = {
  knowledge: 'Buổi học / tutor',
  skills: 'Hành vi văn hoá tốt',
  english: 'Luyện tiếng Anh',
  physical: 'Buổi tập thể thao',
};

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type StudentMeetingState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {week_label: string; buddy_id: string; results: string; commitments: string; next_actions: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// Lưu biên bản họp WIG cá nhân (Coach × Buddy) cho 1 học sinh (PRD §6.2 màn 6).
// RLS wm_teacher_all / wm_admin_all quyết định ai được ghi; coach = người đang đăng nhập.
export async function saveStudentMeeting(
  _prev: StudentMeetingState,
  formData: FormData,
): Promise<StudentMeetingState> {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const buddy_id = String(formData.get('buddy_id') ?? '').trim();
  const results = String(formData.get('results') ?? '').trim();
  const commitments = String(formData.get('commitments') ?? '').trim();
  const next_actions = String(formData.get('next_actions') ?? '').trim();
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {week_label, buddy_id, results, commitments, next_actions};

  if (!student_id || !class_id) return {ok: false, error: friendlyError(null), values};
  if (!week_label) return {ok: false, fieldError: 'week_label', error: 'Hãy nhập nhãn tuần (vd W38-2026).', values};
  if (!results && !commitments && !next_actions)
    return {ok: false, fieldError: 'results', error: 'Nhập ít nhất một nội dung: chiêm nghiệm, cam kết hoặc việc tuần sau.', values};

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  // 1 biên bản / (học sinh, tuần): đã có thì SỬA (cho phép sửa lại), chưa có thì tạo.
  const {data: existing} = await supabase
    .from('wig_meetings')
    .select('id')
    .eq('student_id', student_id)
    .eq('week_label', week_label)
    .maybeSingle();

  const payload = {
    class_id,
    student_id,
    week_label,
    buddy_id: buddy_id || null,
    results: results || null,
    commitments: commitments || null,
    next_actions: next_actions || null,
    coach_id: user?.id ?? null,
  };
  // Idempotent/đồng thời: race 2 lần lưu 1 tuần → dính unique (HS,tuần) → tự chuyển update.
  let error = null as {code?: string} | null;
  if (existing) {
    ({error} = await supabase.from('wig_meetings').update(payload).eq('id', existing.id));
  } else {
    const ins = await supabase.from('wig_meetings').insert(payload);
    if (ins.error?.code === '23505') {
      ({error} = await supabase
        .from('wig_meetings')
        .update(payload)
        .eq('student_id', student_id)
        .eq('week_label', week_label));
    } else {
      error = ins.error;
    }
  }

  if (error) return {ok: false, error: friendlyError(error), values};

  revalidatePath(`/student/${student_id}`);
  return {ok: true, message: existing ? 'Đã cập nhật biên bản họp cá nhân.' : 'Đã lưu biên bản họp cá nhân.'};
}

// C6 — GVCN đặt WIG NĂM cá nhân 4 lĩnh vực cho 1 học sinh (làm 1 lần đầu năm).
export async function createStudentYearWigs(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const back = (m: string): never =>
    redirect(`/student/${student_id}?flash=${encodeURIComponent(m)}`);
  if (!student_id || !class_id) back('Thiếu học sinh hoặc lớp');

  const {label, start, end} = schoolYearRangeVN();
  const rows = AREAS.map((area) => ({
    area,
    target: Number(formData.get(`target_${area}`) ?? 0),
    unit: String(formData.get(`unit_${area}`) ?? '').trim(),
  })).filter((r) => r.target > 0 && r.unit);
  if (rows.length === 0) back('Nhập mục tiêu + đơn vị cho ít nhất 1 lĩnh vực');

  const supabase = await createClient();
  const {error} = await supabase.from('wigs').insert(
    rows.map((r) => ({
      class_id,
      student_id,
      scope: 'student' as const,
      area: r.area,
      period: 'year' as const,
      period_label: label,
      target_value: r.target,
      unit: r.unit,
      start_date: start,
      end_date: end,
    })),
  );
  revalidatePath(`/student/${student_id}`);
  back(error ? friendlyError(error) : `Đã tạo ${rows.length} WIG năm cá nhân`);
}

// C6 — 1 chạm: sinh WIG TUẦN NÀY (+ lead measure mặc định) cho mỗi WIG năm của em.
// Idempotent: bỏ qua lĩnh vực đã có WIG tuần này.
export async function createStudentWeekWigs(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const back = (m: string): never =>
    redirect(`/student/${student_id}?flash=${encodeURIComponent(m)}`);
  if (!student_id || !class_id) back('Thiếu học sinh hoặc lớp');

  const supabase = await createClient();
  const {label, start, end} = weekRangeVN();

  const {data: yearWigs} = await supabase
    .from('wigs')
    .select('id, area, unit')
    .eq('student_id', student_id)
    .eq('scope', 'student')
    .eq('period', 'year');
  if (!yearWigs || yearWigs.length === 0) back('Chưa có WIG năm — hãy đặt WIG năm trước');

  const {data: existing} = await supabase
    .from('wigs')
    .select('area')
    .eq('student_id', student_id)
    .eq('scope', 'student')
    .eq('period', 'week')
    .eq('period_label', label);
  const done = new Set((existing ?? []).map((e) => e.area));
  const toCreate = (yearWigs ?? []).filter((y) => !done.has(y.area));
  if (toCreate.length === 0) back(`Tuần ${label} đã có đủ WIG cho em này`);

  const {data: inserted, error} = await supabase
    .from('wigs')
    .insert(
      toCreate.map((y) => ({
        class_id,
        student_id,
        scope: 'student' as const,
        area: y.area,
        period: 'week' as const,
        period_label: label,
        parent_wig_id: y.id,
        target_value: 5,
        unit: y.unit,
        start_date: start,
        end_date: end,
      })),
    )
    .select('id, area, unit');
  if (error || !inserted) return back(friendlyError(error));

  await supabase.from('lead_measures').insert(
    inserted.map((w) => ({
      wig_id: w.id,
      title: DEFAULT_LEAD_TITLE[w.area as (typeof AREAS)[number]] ?? 'Tiến độ tuần',
      target_value: 5,
      unit: w.unit,
    })),
  );

  revalidatePath(`/student/${student_id}`);
  back(`Đã tạo ${inserted.length} WIG tuần ${label} cho em`);
}

// ============================================================
// Quản lý WIG/lead/tick CÁ NHÂN + yêu cầu-sửa (audit: hết ngõ cụt, idempotent)
// GVCN/Admin sửa trực tiếp; .select() bắt no-op do RLS (báo đúng, không "thành công" giả).
// ============================================================
function backToStudent(studentId: string, msg: string): never {
  redirect(`/student/${studentId}?flash=${encodeURIComponent(msg)}`);
}

export async function editStudentWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('wig_id') ?? '');
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim();
  const period_label = String(formData.get('period_label') ?? '').trim() || null;
  if (!id || !Number.isFinite(target_value) || target_value <= 0 || !unit)
    backToStudent(student_id, 'Thiếu mục tiêu/đơn vị hợp lệ.');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({target_value, unit, period_label})
    .eq('id', id)
    .eq('scope', 'student')
    .select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/');
  if (error) backToStudent(student_id, friendlyError(error));
  if (!data || data.length === 0) backToStudent(student_id, 'Không sửa được (không có quyền hoặc đã xoá).');
  backToStudent(student_id, 'Đã cập nhật WIG cá nhân');
}

export async function deleteStudentWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('wig_id') ?? '');
  if (!id) backToStudent(student_id, 'Thiếu WIG');
  const supabase = await createClient();
  await supabase.from('wigs').delete().eq('parent_wig_id', id); // con tuần (nếu là WIG năm)
  const {error} = await supabase.from('wigs').delete().eq('id', id).eq('scope', 'student');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/');
  backToStudent(student_id, error ? friendlyError(error) : 'Đã xoá WIG cá nhân');
}

export async function editStudentLead(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('lead_measure_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  if (!id || !title || !Number.isFinite(target_value) || target_value <= 0)
    backToStudent(student_id, 'Thiếu tên/mục tiêu hợp lệ.');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('lead_measures')
    .update({title, target_value, unit})
    .eq('id', id)
    .select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/');
  if (error) backToStudent(student_id, friendlyError(error));
  if (!data || data.length === 0) backToStudent(student_id, 'Không sửa được lead (không có quyền hoặc đã xoá).');
  backToStudent(student_id, 'Đã cập nhật lead measure');
}

export async function deleteStudentLead(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('lead_measure_id') ?? '');
  if (!id) backToStudent(student_id, 'Thiếu lead');
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').delete().eq('id', id);
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/');
  backToStudent(student_id, error ? friendlyError(error) : 'Đã xoá lead measure');
}

// Gỡ 1 lượt tick sai của học sinh (RLS lp_staff_manage cho GVCN/Admin lớp).
export async function removeLeadEntry(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const entry_id = String(formData.get('entry_id') ?? '');
  if (!entry_id) backToStudent(student_id, 'Thiếu lượt tick');
  const supabase = await createClient();
  const {data, error} = await supabase.from('lead_progress').delete().eq('id', entry_id).select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/');
  if (error) backToStudent(student_id, friendlyError(error));
  backToStudent(student_id, data && data.length ? 'Đã gỡ lượt tick' : 'Không gỡ được (không có quyền hoặc đã xoá).');
}

export async function deleteStudentMeeting(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('meeting_id') ?? '');
  if (!id) backToStudent(student_id, 'Thiếu biên bản');
  const supabase = await createClient();
  const {error} = await supabase.from('wig_meetings').delete().eq('id', id);
  revalidatePath(`/student/${student_id}`);
  backToStudent(student_id, error ? friendlyError(error) : 'Đã xoá biên bản');
}

// Học sinh (hoặc PH) gửi yêu cầu chỉnh sửa → GVCN duyệt. 23505 = đã có pending trùng.
export async function createEditRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const kind = String(formData.get('kind') ?? 'other');
  const ref_id = String(formData.get('ref_id') ?? '') || null;
  const message = String(formData.get('message') ?? '').trim();
  const back = (m: string): never => redirect(`/student/${student_id}?flash=${encodeURIComponent(m)}`);
  if (!student_id || !class_id) back('Thiếu thông tin yêu cầu');
  const supabase = await createClient();
  const {error} = await supabase.from('edit_requests').insert({
    class_id,
    student_id,
    requester_id: profile.id,
    kind,
    ref_id,
    message: message || null,
  });
  revalidatePath(`/student/${student_id}`);
  if (error && error.code !== '23505') back(friendlyError(error));
  back('Đã gửi yêu cầu chỉnh sửa cho giáo viên');
}

// ============================================================
// Buddy 4DX = LLM (DeepSeek qua OpenRouter) — PRD §7 cho học sinh "ghi chú Buddy" nhưng
// wig_meetings chỉ cho GVCN ghi (wm_teacher_all). Cách giải: ghi chú do SERVER sinh rồi ghi
// bằng service_role → học sinh KHÔNG tự bịa được nội dung Buddy, chỉ đọc.
// Quyền riêng tư + hợp đồng "không gửi PII": xem lib/buddy.ts và migration 0042.
// ============================================================
type BuddyErrCode = 'forbidden' | 'no_class' | 'no_wig' | 'no_key' | 'no_data' | 'api' | 'empty' | 'save';
export type BuddyAskResult = {ok: boolean; generated?: boolean; error?: BuddyErrCode};

// Gom bối cảnh tuần này của 1 học sinh: các LEAD MEASURE (bề mặt hành động thật của app) +
// số ngày còn lại + hôm nay đã check-in cảm xúc chưa. Dùng cho cả ghi chú hằng ngày và chat.
// Truy vấn bằng client CỦA NGƯỜI GỌI → RLS tự giới hạn, không có đường đọc sang em khác.
async function buddyContextFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  weekLabel: string,
): Promise<{ctx: BuddyContext; leadIds: string[]} | null> {
  const {data: weekWigs} = await supabase
    .from('wigs')
    .select('id')
    .eq('student_id', studentId)
    .eq('scope', 'student')
    .eq('period', 'week')
    .eq('period_label', weekLabel);
  const wigIds = (weekWigs ?? []).map((w) => w.id);
  if (wigIds.length === 0) return null;

  const {data: leadRows} = await supabase
    .from('lead_measures')
    .select('id, title, target_value, unit, lead_progress(value, logged_date)')
    .in('wig_id', wigIds);
  if (!leadRows || leadRows.length === 0) return null;

  const todayVN = todayInVN();
  const {end} = weekRangeVN();
  const dayMs = 86_400_000;

  const leads: BuddyLead[] = leadRows.map((l) => {
    const entries = (l.lead_progress ?? []) as {value: number | null; logged_date: string}[];
    return {
      title: l.title,
      target: Number(l.target_value ?? 0),
      unit: l.unit,
      actual: entries.reduce((s, e) => s + Number(e.value ?? 0), 0),
      tickedToday: entries.some((e) => e.logged_date === todayVN),
    };
  });

  const {data: mood} = await supabase
    .from('mood_checkins')
    .select('mood')
    .eq('student_id', studentId)
    .eq('date', todayVN)
    .maybeSingle();

  return {
    ctx: {
      leads,
      daysLeft: Math.max(
        0,
        Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${todayVN}T00:00:00Z`)) / dayMs),
      ),
      moodMissing: !mood,
    },
    leadIds: leadRows.map((l) => l.id),
  };
}

// Ghi chú hằng ngày. KHÔNG có nút bấm: client tự gọi 1 lần khi học sinh mở trang.
// Chỉ gọi LLM khi (a) chưa có ghi chú tuần này, hoặc (b) ghi chú cũ hơn hôm nay VÀ có tick mới
// kể từ lúc đó. Nghĩa là tối đa 1 lượt/ngày, và ngày nào không làm gì thì không tốn tiền.
export async function refreshBuddyNote(): Promise<BuddyAskResult> {
  const profile = await getCurrentProfile();
  // CHỈ chính em học sinh đó — GVCN/PH không sinh ghi chú thay mặt em.
  if (!profile || profile.role !== 'student') return {ok: false, error: 'forbidden'};

  const supabase = await createClient();
  const {label: weekLabel} = weekRangeVN();

  const {data: enr} = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', profile.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!enr?.class_id) return {ok: false, error: 'no_class'};

  const admin = createAdminClient();
  const todayVN = todayInVN();

  const {data: existing} = await admin
    .from('wig_meetings')
    .select('id, buddy_note, buddy_note_at')
    .eq('student_id', profile.id)
    .eq('week_label', weekLabel)
    .maybeSingle();

  if (existing?.buddy_note && existing.buddy_note_at) {
    const lastVN = new Date(existing.buddy_note_at).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    // Đã nhắn hôm nay → thôi.
    if (lastVN === todayVN) return {ok: true, generated: false};

    // Chưa nhắn hôm nay nhưng cũng CHƯA CÓ GÌ MỚI kể từ lần nhắn trước → thôi.
    // (Ghi chú y hệt thì gọi LLM chỉ để tốn tiền.)
    const {data: newer} = await supabase
      .from('lead_progress')
      .select('id')
      .eq('student_id', profile.id)
      .gt('created_at', existing.buddy_note_at)
      .limit(1);
    if (!newer || newer.length === 0) return {ok: true, generated: false};
  }

  const built = await buddyContextFor(supabase, profile.id, weekLabel);
  if (!built) return {ok: false, error: 'no_wig'};

  const res = await buddyNote(built.ctx);
  if ('error' in res) {
    // detail có thể chứa lý do thật (hết hạn mức, model sai, key sai) → chỉ log server, không ra UI.
    if (res.detail) console.error('[buddy] note', res.error, res.detail);
    return {ok: false, error: res.error};
  }

  const patch = {
    buddy_note: res.note,
    buddy_note_model: res.model,
    buddy_note_at: new Date().toISOString(),
    buddy_action: res.action,
    buddy_tokens: res.tokens,
    // focusIndex đã được lib/buddy.ts kiểm nằm trong danh sách gửi đi → map ra id thật an toàn.
    buddy_focus_lead_id: res.focusIndex === null ? null : built.leadIds[res.focusIndex],
  };
  // Không dùng upsert: unique index wig_meetings_student_week_uidx (0035) là index BỘ PHẬN
  // (where student_id is not null) nên ON CONFLICT không suy ra được → select rồi update/insert.
  const {error} = existing?.id
    ? await admin.from('wig_meetings').update(patch).eq('id', existing.id)
    : await admin
        .from('wig_meetings')
        .insert({class_id: enr.class_id, student_id: profile.id, week_label: weekLabel, ...patch});
  if (error) {
    console.error('[buddy] save', error.message);
    return {ok: false, error: 'save'};
  }

  revalidatePath('/student');
  revalidatePath(`/student/${profile.id}`);
  return {ok: true, generated: true};
}

// GVCN/Admin mở hoặc đóng chat Buddy cho 1 buổi họp. Đây là công tắc giám sát: học sinh chỉ
// chat được khi buổi họp đang diễn ra và có người lớn ngồi cạnh.
export async function toggleBuddyChat(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const meeting_id = String(formData.get('meeting_id') ?? '');
  const open = String(formData.get('open') ?? '') === '1';
  if (!meeting_id) backToStudent(student_id, 'Thiếu buổi họp');
  const supabase = await createClient();
  // RLS wm_teacher_all/wm_admin_all chốt quyền; .select() để phân biệt no-op do không có quyền.
  const {data, error} = await supabase
    .from('wig_meetings')
    .update({buddy_chat_open: open})
    .eq('id', meeting_id)
    .select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/student');
  if (error) backToStudent(student_id, friendlyError(error));
  if (!data || data.length === 0) backToStudent(student_id, 'Không đổi được (không có quyền hoặc đã xoá).');
  backToStudent(student_id, open ? 'Đã mở Buddy cho buổi họp' : 'Đã đóng Buddy');
}

// Số lượt học sinh được nói trong MỘT buổi họp. Chặn chi phí và giữ hội thoại đúng mục đích
// (đây là buổi họp WIG, không phải chỗ chat giải trí).
const BUDDY_CHAT_MAX_USER_TURNS = 10;

export type BuddyChatResult = {ok: boolean; error?: BuddyErrCode | 'closed' | 'too_long' | 'limit'};

// Học sinh gửi 1 lượt cho Buddy TRONG buổi họp. Chỉ chạy khi GVCN đã mở (buddy_chat_open) —
// RLS bm_student_insert là chốt cuối, kiểm ở đây chỉ để trả thông báo tử tế.
export async function sendBuddyMessage(meetingId: string, content: string): Promise<BuddyChatResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'student') return {ok: false, error: 'forbidden'};
  const text = content.trim();
  if (!text || text.length > 1000) return {ok: false, error: 'too_long'};

  const supabase = await createClient();
  // RLS wm_student_select chỉ trả buổi họp của chính em.
  const {data: meeting} = await supabase
    .from('wig_meetings')
    .select('id, week_label, buddy_chat_open, student_id')
    .eq('id', meetingId)
    .maybeSingle();
  if (!meeting || meeting.student_id !== profile.id) return {ok: false, error: 'forbidden'};
  if (!meeting.buddy_chat_open) return {ok: false, error: 'closed'};

  const {data: history} = await supabase
    .from('buddy_messages')
    .select('role, content')
    .eq('meeting_id', meetingId)
    .order('created_at', {ascending: true});
  const turns = (history ?? []).filter((m) => m.role === 'user').length;
  if (turns >= BUDDY_CHAT_MAX_USER_TURNS) return {ok: false, error: 'limit'};

  // Ghi lượt của học sinh bằng client CỦA EM → RLS bm_student_insert kiểm lại chat có đang mở.
  const {error: insErr} = await supabase
    .from('buddy_messages')
    .insert({meeting_id: meetingId, role: 'user', content: text});
  if (insErr) return {ok: false, error: 'save'};

  const built = await buddyContextFor(supabase, profile.id, meeting.week_label);
  if (!built) return {ok: false, error: 'no_wig'};

  const res = await buddyChat(built.ctx, [
    ...((history ?? []) as {role: 'user' | 'assistant'; content: string}[]),
    {role: 'user', content: text},
  ]);
  if ('error' in res) {
    if (res.detail) console.error('[buddy] chat', res.error, res.detail);
    return {ok: false, error: res.error};
  }

  // Lời của Buddy ghi bằng service_role → học sinh không giả được (RLS chỉ cho em ghi role='user').
  const admin = createAdminClient();
  const {error: aErr} = await admin
    .from('buddy_messages')
    .insert({meeting_id: meetingId, role: 'assistant', content: res.reply});
  if (aErr) {
    console.error('[buddy] chat save', aErr.message);
    return {ok: false, error: 'save'};
  }

  revalidatePath('/student');
  revalidatePath(`/student/${profile.id}`);
  return {ok: true};
}

// Học sinh/PH SỬA lời nhắn của yêu cầu MÌNH đã gửi, khi GVCN chưa xử lý.
// RLS er_requester_update (0040) chốt: chỉ yêu cầu của mình + còn 'pending'; `.eq('status','pending')`
// ở đây chỉ để phân biệt "GVCN vừa xử lý xong" → báo cho học sinh biết thay vì im lặng không đổi gì.
export async function updateEditRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  const back = (m: string): never => redirect(`/student/${student_id}?flash=${encodeURIComponent(m)}`);
  if (!id) back('Thiếu yêu cầu');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({message: message || null})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/student');
  if (error) back(friendlyError(error));
  back(
    data && data.length
      ? 'Đã cập nhật yêu cầu'
      : 'Không sửa được — GVCN đã xử lý yêu cầu này rồi.',
  );
}

// Học sinh/PH RÚT LẠI yêu cầu của mình khi GVCN chưa xử lý (RLS er_requester_delete, 0040).
// Rút lại giải phóng luôn unique index pending (0035) → gửi lại yêu cầu mới được ngay.
export async function withdrawEditRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const back = (m: string): never => redirect(`/student/${student_id}?flash=${encodeURIComponent(m)}`);
  if (!id) back('Thiếu yêu cầu');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath(`/student/${student_id}`);
  revalidatePath('/student');
  if (error) back(friendlyError(error));
  back(
    data && data.length
      ? 'Đã rút lại yêu cầu'
      : 'Không rút được — GVCN đã xử lý yêu cầu này rồi.',
  );
}

// GVCN/Admin duyệt/từ chối. IDEMPOTENT: chỉ đổi khi đang 'pending' → bấm 2 lần chỉ ăn 1.
// apply=1 + kind='undo_tick' → duyệt & gỡ tick luôn.
export async function resolveEditRequest(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const apply = String(formData.get('apply') ?? '') === '1';
  if (!id || (decision !== 'approved' && decision !== 'rejected'))
    backToStudent(student_id, 'Thiếu thông tin duyệt');
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({status: decision, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString()})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, kind, ref_id, student_id');
  revalidatePath(`/student/${student_id}`);
  if (error) backToStudent(student_id, friendlyError(error));
  if (!data || data.length === 0) backToStudent(student_id, 'Yêu cầu đã được xử lý trước đó.');
  const r = data[0];
  if (apply && decision === 'approved' && r.kind === 'undo_tick' && r.ref_id) {
    // Chỉ gỡ LƯỢT TICK GẦN NHẤT (không xoá cả lịch sử của lead measure) — khớp
    // undo() tự-phục-vụ ở LeadTicker.tsx (luôn thao tác trên 1 lead_progress.id cụ thể).
    const {data: target, error: findErr} = await supabase
      .from('lead_progress')
      .select('id')
      .eq('lead_measure_id', r.ref_id)
      .eq('student_id', r.student_id)
      .order('created_at', {ascending: false})
      .limit(1)
      .maybeSingle();
    if (findErr) backToStudent(student_id, friendlyError(findErr));
    if (target) {
      const {error: delErr} = await supabase.from('lead_progress').delete().eq('id', target.id);
      if (delErr) backToStudent(student_id, friendlyError(delErr));
    }
    revalidatePath('/');
    backToStudent(student_id, 'Đã duyệt & gỡ tick');
  }
  backToStudent(student_id, decision === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
}
