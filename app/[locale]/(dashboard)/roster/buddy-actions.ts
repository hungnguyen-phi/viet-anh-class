'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

// ════════════════════════════════════════════════════════════════════════════
// BUDDY & LỊCH PDR — GVCN thao tác trên /roster (PRD v3: "lịch buddy được học sinh đăng ký
// với GVCN và DO GVCN TẠO trên hệ thống"; buddy tối đa 2, quan hệ đối xứng — 0146)
// ════════════════════════════════════════════════════════════════════════════

function flash(classId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/roster?class=${encodeURIComponent(classId)}&${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

export async function taoBuddyPair(formData: FormData) {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const emA = String(formData.get('em_a') ?? '');
  const emB = String(formData.get('em_b') ?? '');
  if (!class_id || !emA || !emB) flash(class_id, loi('Chọn đủ hai học sinh.'));
  if (emA === emB) flash(class_id, loi('Hai học sinh phải là hai người khác nhau.'));

  const supabase = await createClient();
  // Chuẩn hoá đầu nhỏ đứng trước (buddy_thu_tu_ck) — (A,B) và (B,A) là CÙNG một cặp.
  const [nho, lon] = emA < emB ? [emA, emB] : [emB, emA];
  const {error} = await supabase.from('buddy_pairs').insert({
    class_id,
    student_id: nho,
    buddy_id: lon,
    created_by: me.id,
  });
  revalidatePath('/[locale]/roster', 'page');
  if (error) {
    if (/tối đa 2/.test(error.message)) flash(class_id, loi('Mỗi học sinh tối đa 2 buddy.'));
    if (/duplicate|buddy_pairs_uidx/i.test(error.message)) flash(class_id, loi('Cặp này đã ghép rồi.'));
    flash(class_id, loi(friendlyError(error)));
  }
  flash(class_id, 'Đã ghép cặp buddy');
}

// GỠ = tắt is_active, không xoá dòng: lịch sử họp PDR của cặp cũ vẫn cần đối chiếu được
// (quyết định 18/08/2026: cho đổi buddy giữa năm, giữ lịch sử). Lịch của cặp tắt theo.
export async function goBuddyPair(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('buddy_pairs').update({is_active: false}).eq('id', id);
  if (!error) await supabase.from('pdr_schedules').update({is_active: false}).eq('buddy_pair_id', id);
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã gỡ cặp buddy (lịch sử họp giữ nguyên)');
}

export async function luuLichBuddy(formData: FormData) {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const pair_id = String(formData.get('pair_id') ?? '');
  const weekday = Number(formData.get('weekday') ?? 0);
  const time_slot = String(formData.get('time_slot') ?? '').trim() || null;
  if (!pair_id || weekday < 2 || weekday > 8) flash(class_id, loi('Chọn thứ trong tuần.'));

  const supabase = await createClient();
  // Mỗi cặp một lịch active (pdr_schedules_buddy_uidx): có rồi thì SỬA, chưa có thì thêm.
  const {data: daCo} = await supabase
    .from('pdr_schedules')
    .select('id')
    .eq('buddy_pair_id', pair_id)
    .eq('is_active', true)
    .maybeSingle();
  const {error} = daCo
    ? await supabase.from('pdr_schedules').update({weekday, time_slot}).eq('id', daCo.id)
    : await supabase.from('pdr_schedules').insert({
        class_id,
        buddy_pair_id: pair_id,
        type: 'buddy',
        weekday,
        time_slot,
        created_by: me.id,
      });
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu lịch họp buddy');
}

export async function luuLichCoach(formData: FormData) {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const monthly_day = Number(formData.get('monthly_day') ?? 0);
  // 1–28 để lịch không tự trượt ở tháng thiếu ngày (CHECK ở 0146 cũng chặn).
  if (!student_id || monthly_day < 1 || monthly_day > 28)
    flash(class_id, loi('Chọn học sinh và một ngày từ 1 đến 28.'));

  const supabase = await createClient();
  const {data: daCo} = await supabase
    .from('pdr_schedules')
    .select('id')
    .eq('student_id', student_id)
    .eq('type', 'coach')
    .eq('is_active', true)
    .maybeSingle();
  const {error} = daCo
    ? await supabase.from('pdr_schedules').update({monthly_day}).eq('id', daCo.id)
    : await supabase.from('pdr_schedules').insert({
        class_id,
        student_id,
        type: 'coach',
        monthly_day,
        created_by: me.id,
      });
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu lịch PDR với giáo viên');
}
