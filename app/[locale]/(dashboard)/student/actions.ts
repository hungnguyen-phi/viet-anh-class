'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentProfile, requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {clientIp} from '@/lib/ip';
import {weekRangeVN, schoolYearRangeVN} from '@/lib/dates';
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
  const {error} = existing
    ? await supabase.from('wig_meetings').update(payload).eq('id', existing.id)
    : await supabase.from('wig_meetings').insert(payload);

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
