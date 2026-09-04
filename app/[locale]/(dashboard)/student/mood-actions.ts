'use server';
import {getTranslations} from 'next-intl/server';

import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentProfile} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {clientIp} from '@/lib/ip';
import {todayInVN} from '@/lib/dates';
import {sendHubEvent, buildAttendanceEvent} from '@/lib/hub/webhook';
import type {Database} from '@/lib/database.types';

type Mood = Database['public']['Enums']['mood_level'];

export type CheckinResult = {
  ok: boolean;
  blocked?: boolean;
  noClass?: boolean;
  /** Bấm ngoài cửa sổ cho phép (trước 6h30, sau 8h00, hoặc ngoài khung chiều). */
  closed?: boolean;
  /** Bấm được nhưng đã quá giờ ân hạn → ghi MUỘN. */
  late?: boolean;
  error?: string;
};

// Check-in cảm xúc = điểm danh, có CỔNG IP (chỉ khi ở mạng trường). Khối này KHÔNG đụng mô hình
// mục tiêu — nó là điểm danh, thuộc nhóm "giữ nguyên" của PA2 (00-TONG-QUAN §1). Tách khỏi
// actions.ts (PR-2) để tệp mục tiêu không còn là chỗ duy nhất trong dự án gọi createAdminClient
// lẫn với mã nghiệp vụ mục tiêu.
//
// Đường ghi duy nhất: server đọc IP thật từ header → gọi hàm student_checkin bằng service_role.
// Học sinh KHÔNG thể tự gọi hàm này (đã revoke) nên không lách được cổng IP.
export async function checkinMood(mood: Mood, buoi: 'sang' | 'chieu' = 'sang'): Promise<CheckinResult> {
  const tLoi = await getTranslations('common');
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'student') return {ok: false, error: 'forbidden'};

  const ip = clientIp(await headers());

  const admin = createAdminClient();
  const {data, error} = await admin.rpc('student_checkin', {
    p_student: profile.id,
    p_mood: mood,
    p_ip: ip ?? '',
    p_buoi: buoi,
  });
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (data === 'blocked') return {ok: false, blocked: true};
  if (data === 'no_class') return {ok: false, noClass: true};
  if (data === 'closed') return {ok: false, closed: true};

  // BÁO VỀ HUB — KHÔNG CHẶN PHẢN HỒI CỦA EM. Đọc lại dòng vừa ghi thay vì tự đoán id:
  // student_checkin() có thể UPDATE một dòng đã có (bấm chiều sau khi đã bấm sáng). .catch()
  // nuốt lỗi CÓ CHỦ Ý: một lượt báo Hub hỏng không được làm hỏng buổi điểm danh thật của em.
  void (async () => {
    try {
      const {data: att} = await admin
        .from('attendance_records')
        .select('id, student_id, class_id, date, status')
        .eq('student_id', profile.id)
        .eq('date', todayInVN())
        .maybeSingle();
      if (att) await sendHubEvent(buildAttendanceEvent(att));
    } catch (e) {
      console.error('[hub] checkinMood webhook', e instanceof Error ? e.message : e);
    }
  })();

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/attendance', 'page');
  return {ok: true, late: data === 'late'};
}
