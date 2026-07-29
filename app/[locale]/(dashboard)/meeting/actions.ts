'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type MeetingState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {week_label: string; results: string; commitments: string; next_actions: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

export async function saveMeeting(_prev: MeetingState, formData: FormData): Promise<MeetingState> {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const results = String(formData.get('results') ?? '').trim();
  const commitments = String(formData.get('commitments') ?? '').trim();
  const next_actions = String(formData.get('next_actions') ?? '').trim();
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {week_label, results, commitments, next_actions};

  if (!class_id) return {ok: false, error: friendlyError(null), values};
  if (!week_label) return {ok: false, fieldError: 'week_label', error: 'Hãy nhập nhãn tuần (vd W38-2026).', values};
  if (!results && !commitments && !next_actions)
    return {ok: false, fieldError: 'results', error: 'Nhập ít nhất một nội dung: chiêm nghiệm, cam kết hoặc việc tuần sau.', values};

  const supabase = await createClient();
  // 1 biên bản / (lớp, tuần): đã có thì SỬA, chưa có thì tạo (cho phép sửa lại nội dung).
  const {data: existing} = await supabase
    .from('wig_meetings')
    .select('id')
    .eq('class_id', class_id)
    .eq('week_label', week_label)
    .is('student_id', null)
    .maybeSingle();

  const payload = {
    class_id,
    week_label,
    results: results || null,
    commitments: commitments || null,
    next_actions: next_actions || null,
    coach_id: me.id,
  };
  // Idempotent/đồng thời: nếu chưa có thì insert; nếu 2 người cùng lưu 1 tuần → 1 người dính
  // unique (23505) → tự chuyển sang update theo khoá (lớp,tuần) thay vì báo lỗi trùng.
  let error = null as {code?: string} | null;
  if (existing) {
    ({error} = await supabase.from('wig_meetings').update(payload).eq('id', existing.id));
  } else {
    const ins = await supabase.from('wig_meetings').insert(payload);
    if (ins.error?.code === '23505') {
      ({error} = await supabase
        .from('wig_meetings')
        .update(payload)
        .eq('class_id', class_id)
        .eq('week_label', week_label)
        .is('student_id', null));
    } else {
      error = ins.error;
    }
  }

  if (error) return {ok: false, error: friendlyError(error), values};

  revalidatePath('/meeting');
  return {ok: true, message: existing ? 'Đã cập nhật biên bản tuần này.' : 'Đã lưu biên bản.'};
}

// Xoá 1 biên bản họp lớp (sửa sai/tạo nhầm tuần).
export async function deleteMeeting(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('id') ?? '');
  const classParam = String(formData.get('class') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('wig_meetings').delete().eq('id', id);
  revalidatePath('/meeting');
  const q = new URLSearchParams();
  if (classParam) q.set('class', classParam);
  q.set('flash', error ? friendlyError(error) : 'Đã xoá biên bản');
  redirect(`/meeting?${q.toString()}`);
}
