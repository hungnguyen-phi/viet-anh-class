'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentProfile, requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {clientIp} from '@/lib/ip';
import {chuanHoaThu} from '@/lib/wig-tao';
import {kieuDonVi} from '@/lib/don-vi';
// MỘT nguồn duy nhất cho phép chia nhịp — cùng hàm mà mục tiêu LỚP đang dùng (lib/wig-tao gọi nó
// trong sinhNhip). Chép một bản riêng cho học sinh là dựng đúng cái bệnh "hai đường tính cho một
// khái niệm" mà repo này đã dính nhiều lần.
import {buddyNote, buddyChat, type BuddyContext, type BuddyLead} from '@/lib/buddy';
import {weekRangeVN, nextWeekRangeVN, todayInVN, schoolYearRangeVN, isValidDayVN, mondayOf} from '@/lib/dates';
import type {Database} from '@/lib/database.types';

type Mood = Database['public']['Enums']['mood_level'];

// Check-in cảm xúc = điểm danh, có CỔNG IP (chỉ khi ở mạng trường).
// Đường ghi duy nhất: server đọc IP thật từ header → gọi hàm student_checkin bằng service_role.
// Học sinh KHÔNG thể tự gọi hàm này (đã revoke) nên không lách được cổng IP.
// Về trang của MỘT em kèm thông báo. Trước đây câu này được chép tay sáu chỗ trong file; đợt
// thêm đường báo hỏng (?flash_err=) là lần đầu phải sửa cả sáu, và sót một chỗ nghĩa là chỗ đó
// vẫn báo thất bại bằng hộp xanh có dấu tích.
function veTrangEm(studentId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/student/${studentId}?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

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

export async function checkinMood(mood: Mood, buoi: 'sang' | 'chieu' = 'sang'): Promise<CheckinResult> {
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
    p_buoi: buoi,
  });
  if (error) return {ok: false, error: (friendlyError(error))};
  if (data === 'blocked') return {ok: false, blocked: true};
  if (data === 'no_class') return {ok: false, noClass: true};
  // Ngoài cửa sổ: KHÔNG ghi gì cả. Trả về để giao diện nói rõ giờ nào mới bấm được, thay vì báo
  // "lỗi" cho một việc hoàn toàn bình thường là em bấm sớm quá hoặc muộn quá.
  if (data === 'closed') return {ok: false, closed: true};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/attendance', 'page');
  return {ok: true, late: data === 'late'};
}

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type StudentMeetingState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {week_label: string; results: string; commitments: string; next_actions: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// Lưu biên bản họp WIG cá nhân (Coach × Buddy) cho 1 học sinh (PRD §6.2 màn 6).
// RLS wm_teacher_all / wm_admin_all quyết định ai được ghi; coach = người đang đăng nhập.
export async function saveStudentMeeting(
  _prev: StudentMeetingState,
  formData: FormData,
): Promise<StudentMeetingState> {
  const me = await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const results = String(formData.get('results') ?? '').trim();
  const commitments = String(formData.get('commitments') ?? '').trim();
  const next_actions = String(formData.get('next_actions') ?? '').trim();
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {week_label, results, commitments, next_actions};

  if (!student_id || !class_id) return {ok: false, error: (friendlyError(null)), values};
  if (!week_label) return {ok: false, fieldError: 'week_label', error: 'Hãy chọn tuần.', values};
  if (!results && !commitments && !next_actions)
    return {
      ok: false,
      fieldError: 'results',
      error: 'Nhập ít nhất một nội dung: chiêm nghiệm, cam kết, hoặc việc cần làm.',
      values,
    };

  const supabase = await createClient();

  // Ô "kế hoạch tuần sau" từng SINH RA WIG tuần cho em ngay tại đây (applyNextWeekPlan). Bỏ cùng
  // đợt 0100: mục tiêu của em nay là khoảng cách của chính em, đặt 2–3 lần một năm trong tiết đặt
  // mục tiêu — không phải thứ đẻ ra mỗi tuần từ biên bản họp. Xem docs/MO_HINH_WIG.md §1 và §6.2.

  // 1 biên bản / (học sinh, tuần): đã có thì SỬA (cho phép sửa lại), chưa có thì tạo.
  const {data: existing} = await supabase
    .from('wig_meetings')
    .select('id')
    .eq('student_id', student_id)
    .eq('week_label', week_label)
    .maybeSingle();

  // GHI CẢ NGÀY, không chỉ nhãn.
  //
  // 0080 đã chốt week_start là khoá thật của một biên bản, và biên bản LỚP đã chuyển sang dùng nó.
  // Biên bản CÁ NHÂN thì chưa: nó vẫn chỉ có week_label — một ô chữ. Nghĩa là cái bẫy cũ còn
  // nguyên ở nhánh học sinh: sửa nhãn một chút là biên bản rơi khỏi mọi màn hình tra cứu, lặng lẽ.
  // thu_hai_tu_nhan() là đường suy ngược DUY NHẤT trong dự án (0080) — không nơi nào tự cắt chuỗi
  // lấy năm/tuần nữa, vì chỗ ấy có bẫy: cắt lệch một ký tự là ra năm 0026.
  const {data: suyNgay} = await supabase.rpc('thu_hai_tu_nhan', {nhan: week_label});
  const week_start = (suyNgay as string | null) ?? null;

  const payload = {
    class_id,
    student_id,
    week_label,
    week_start,
    // KHÔNG ghi buddy_id nữa (12/08/2026): Buddy là con sư tử AI, không phải bạn cùng lớp. Cột
    // vẫn còn trong CSDL cho biên bản cũ đọc lại được — chỉ thôi ghi. Xem StudentMeetings.
    results: results || null,
    commitments: commitments || null,
    // Vẫn ghi next_actions dạng chữ, sinh TỪ kế hoạch có cấu trúc — để báo cáo phụ huynh và
    // mục Họp WIG của học sinh đọc được câu tự nhiên mà không phải sửa gì ở hai chỗ đó.
    next_actions: next_actions || null,
    coach_id: me.id,
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

  if (error) return {ok: false, error: (friendlyError(error)), values};

  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');
  return {
    ok: true,
    message: existing ? 'Đã cập nhật biên bản họp cá nhân.' : 'Đã lưu biên bản họp cá nhân.',
  };
}

// ============================================================
// Quản lý WIG/lead/tick CÁ NHÂN + yêu cầu-sửa (audit: hết ngõ cụt, idempotent)
// GVCN/Admin sửa trực tiếp; .select() bắt no-op do RLS (báo đúng, không "thành công" giả).
// ============================================================
function backToStudent(studentId: string, msg: string): never {
  veTrangEm(studentId, msg);
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
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  if (error) backToStudent(student_id, loi(friendlyError(error)));
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
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  backToStudent(student_id, error ? loi(friendlyError(error)) : 'Đã xoá WIG cá nhân');
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
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  if (error) backToStudent(student_id, loi(friendlyError(error)));
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
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  backToStudent(student_id, error ? loi(friendlyError(error)) : 'Đã xoá lead measure');
}

// Gỡ 1 lượt tick sai của học sinh (RLS lp_staff_manage cho GVCN/Admin lớp).
export async function removeLeadEntry(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const entry_id = String(formData.get('entry_id') ?? '');
  if (!entry_id) backToStudent(student_id, 'Thiếu lượt tick');
  const supabase = await createClient();
  const {data, error} = await supabase.from('lead_progress').delete().eq('id', entry_id).select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  if (error) backToStudent(student_id, loi(friendlyError(error)));
  backToStudent(student_id, data && data.length ? 'Đã gỡ lượt tick' : 'Không gỡ được (không có quyền hoặc đã xoá).');
}

export async function deleteStudentMeeting(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('meeting_id') ?? '');
  if (!id) backToStudent(student_id, 'Thiếu biên bản');
  const supabase = await createClient();
  const {error} = await supabase.from('wig_meetings').delete().eq('id', id);
  revalidatePath('/[locale]/student/[id]', 'page');
  backToStudent(student_id, error ? loi(friendlyError(error)) : 'Đã xoá biên bản');
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
  const back = (m: string): never => veTrangEm(student_id, m);
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
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error && error.code !== '23505') back(loi(friendlyError(error)));
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
  // HAI CHỖ MỤC TIÊU CỦA EM TREO, PHẢI HỎI CẢ HAI (cùng luật với `weekIds` ở StudentScoreboard).
  //
  //   · period='week' — WIG tuần cá nhân đời cũ, trước 0100. Dữ liệu cũ còn nguyên.
  //   · period='year' — mục tiêu của em từ 0100: sống cả học kỳ, không đẻ lại mỗi tuần.
  //
  // Bản cũ chỉ hỏi vế đầu, tức chỉ hỏi loại dữ liệu CSDL đã thôi sinh ra — nên Buddy trả
  // `no_wig` cho MỌI em, và màn hình nói "Con chưa đặt mục tiêu nên Buddy chưa có gì để xem"
  // ngay bên dưới khối mục tiêu em vừa đặt xong. App đổ lỗi cho em vì lỗi của chính nó.
  const {data: emWigs} = await supabase
    .from('wigs')
    .select('id, period, period_label')
    .eq('student_id', studentId)
    .eq('scope', 'student')
    .in('period', ['week', 'year']);
  const wigIds = (emWigs ?? [])
    .filter((w) => w.period === 'year' || w.period_label === weekLabel)
    .map((w) => w.id);
  if (wigIds.length === 0) return null;

  const {data: leadRows} = await supabase
    .from('lead_measures')
    .select('id, title, target_value, unit, unit_per_tick, lead_progress(value, logged_date)')
    .in('wig_id', wigIds);
  if (!leadRows || leadRows.length === 0) return null;

  const todayVN = todayInVN();
  const {end} = weekRangeVN();
  const dayMs = 86_400_000;

  const leads: BuddyLead[] = leadRows.map((l) => {
    const entries = (l.lead_progress ?? []) as {value: number | null; logged_date: string}[];
    // Nhân hệ số (0076) — nếu không thì Buddy nhắn cho em một con số khác hẳn con số trên màn
    // hình em đang nhìn. Với một trợ lý nói chuyện với trẻ con, sai số ấy còn tệ hơn ở bảng biểu:
    // các em tin lời nhắn hơn tin bảng.
    const moiTick = Number(l.unit_per_tick ?? 1) || 1;
    return {
      title: l.title,
      target: Number(l.target_value ?? 0),
      unit: l.unit,
      actual: entries.reduce((s, e) => s + Number(e.value ?? 0) * moiTick, 0),
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

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
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
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  if (error) backToStudent(student_id, loi(friendlyError(error)));
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

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
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
  const back = (m: string): never => veTrangEm(student_id, m);
  if (!id) back('Thiếu yêu cầu');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({message: message || null})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  if (error) back(loi(friendlyError(error)));
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
  const back = (m: string): never => veTrangEm(student_id, m);
  if (!id) back('Thiếu yêu cầu');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  if (error) back(loi(friendlyError(error)));
  back(
    data && data.length
      ? 'Đã rút lại yêu cầu'
      : 'Không rút được — GVCN đã xử lý yêu cầu này rồi.',
  );
}

// GVCN/Admin duyệt/từ chối. IDEMPOTENT: chỉ đổi khi đang 'pending' → bấm 2 lần chỉ ăn 1.
// apply=1 + kind='undo_tick' → duyệt & gỡ tick luôn.
export async function resolveEditRequest(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const apply = String(formData.get('apply') ?? '') === '1';
  if (!id || (decision !== 'approved' && decision !== 'rejected'))
    backToStudent(student_id, 'Thiếu thông tin duyệt');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({status: decision, resolved_by: me.id, resolved_at: new Date().toISOString()})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, kind, ref_id, student_id');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) backToStudent(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) backToStudent(student_id, 'Yêu cầu đã được xử lý trước đó.');
  const r = data[0];
  // rename_lead: `message` CHÍNH LÀ tên mới (0046) → duyệt là đổi tên luôn, GVCN không phải
  // đọc rồi tự gõ lại. Lấy message từ chính hàng vừa duyệt để không tin dữ liệu từ form.
  if (apply && decision === 'approved' && r.kind === 'rename_lead' && r.ref_id) {
    const {data: req} = await supabase.from('edit_requests').select('message').eq('id', id).maybeSingle();
    const newTitle = (req?.message ?? '').trim();
    if (!newTitle) backToStudent(student_id, 'Đã duyệt, nhưng yêu cầu không ghi tên mới nên chưa đổi được.');
    const {data: upd, error: upErr} = await supabase
      .from('lead_measures')
      .update({title: newTitle.slice(0, 200)})
      .eq('id', r.ref_id)
      .select('id');
    if (upErr) backToStudent(student_id, loi(friendlyError(upErr)));
    revalidatePath('/[locale]', 'page');
    backToStudent(
      student_id,
      upd && upd.length ? 'Đã duyệt & đổi tên việc' : 'Đã duyệt, nhưng việc đó không còn tồn tại.',
    );
  }
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
    if (findErr) backToStudent(student_id, loi(friendlyError(findErr)));
    if (target) {
      const {error: delErr} = await supabase.from('lead_progress').delete().eq('id', target.id);
      if (delErr) backToStudent(student_id, loi(friendlyError(delErr)));
    }
    revalidatePath('/[locale]', 'page');
    backToStudent(student_id, 'Đã duyệt & gỡ tick');
  }
  backToStudent(student_id, decision === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
}


// ════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA EM — em đặt cùng cô, không phải máy chia số rồi giao xuống
// ════════════════════════════════════════════════════════════════════════════
//
// Đây là đường ghi THAY THẾ cho createStudentYearWigs / createClassStudentWigs đã xoá ở 0100.
// Khác biệt không nằm ở mã, nằm ở ai cầm bút: trước đây app lấy mục tiêu lớp chia cho sĩ số rồi
// ghi con số ấy vào bản ghi của từng em — thứ 4DX gọi đích danh là *dictate*. Kết quả đo được:
// 0 bản ghi trên toàn hệ thống, vì "400 bài" không mô tả em nào cả.
//
// Nay em gõ khoảng cách của CHÍNH EM ("điểm Toán 5,8 → 7,0 trước 31/12"), kèm một việc em tự chọn
// để đi tới đó. Nguyên văn Leader in Me: "Once a student sets a goal with his or her teacher."
//
// CÔ VẪN ĐẶT HỘ ĐƯỢC — chủ dự án chốt 11/08/2026 để triệt rủi ro "em không gõ thì màn trống".
// Nhưng van an toàn ấy có thể nuốt cả thiết kế nếu cô gõ hộ hết, nên nó phải LỘ RA: cột `set_by`
// ghi ai thật sự đặt, và BGH theo dõi tỷ lệ em tự đặt (mốc ≥ 70%). Xem docs/MO_HINH_WIG.md §4.

export type MucTieuState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
};

/**
 * CỬA SỔ MỘT NGÀY — em còn tự sửa/xoá mục tiêu của mình được không.
 *
 * 24 giờ đầu mục tiêu vẫn là ĐỀ NGHỊ (nhất là khi cô đặt hộ: nó vào thẳng `approved`, em không kịp
 * nói gì); qua đó nó thành CAM KẾT, muốn đổi thì xin cô. Người lớn không bị cửa sổ này chặn.
 *
 * Chốt thật nằm ở RLS (0102). Bản TypeScript này chỉ để câu báo lỗi nói đúng chuyện.
 *
 * KHÔNG `export` hằng số này: tệp đang ở trong 'use server', mà tệp 'use server' chỉ được export
 * hàm async — export một con số làm cả trang đổ 500 ngay lúc dựng. `tsc` và `next build` đều xanh
 * khi ấy; chỉ trang thật mới nói ra.
 */
const CUA_SO_MS = 24 * 60 * 60 * 1000;

function conTrongCuaSo(w: {status: string; created_at: string} | null | undefined): boolean {
  if (!w) return true;
  if (w.status === 'draft' || w.status === 'sent') return true;
  return Date.now() - new Date(w.created_at).getTime() < CUA_SO_MS;
}

export async function luuMucTieuCuaEm(
  _prev: MucTieuState,
  formData: FormData,
): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};

  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const kind = String(formData.get('kind') ?? 'academic');
  const title = String(formData.get('title') ?? '').trim();
  const unit = String(formData.get('unit') ?? '').trim();
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const han = String(formData.get('due_on') ?? '').trim();
  const source_wig_id = String(formData.get('source_wig_id') ?? '').trim();
  const viec_title = String(formData.get('viec_title') ?? '').trim();
  const viec_days = chuanHoaThu(formData.getAll('viec_days'));

  // AI ĐANG GÕ. Chính em thì set_by='student'; cô hoặc quản trị gõ hộ thì 'teacher'. KHÔNG suy từ
  // một ô trên form — người dùng gửi gì lên cũng được, mà cột này là thước đo của cả chương trình.
  const laChinhEm = me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin';
  if (!laChinhEm && !laNhanSu) return {ok: false, error: 'Không có quyền đặt mục tiêu cho em này.'};

  if (kind !== 'academic' && kind !== 'personal')
    return {ok: false, error: 'Không rõ đây là mục tiêu học tập hay mục tiêu riêng.'};
  if (!title)
    return {ok: false, fieldError: 'title', error: 'Con muốn tiến bộ ở chuyện gì? Viết một câu.'};
  if (title.length > 160) return {ok: false, fieldError: 'title', error: 'Tối đa 160 ký tự.'};
  if (!han || !/^\d{4}-\d{2}-\d{2}$/.test(han))
    return {ok: false, fieldError: 'due_on', error: 'Chọn ngày con muốn đạt được.'};

  const target_value = Number(target_raw);
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (!Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Đích phải là số lớn hơn 0.'};
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0))
    return {ok: false, fieldError: 'baseline', error: 'Chỗ đang đứng phải là số từ 0 trở lên.'};
  if (baseline !== null && baseline >= target_value)
    return {
      ok: false,
      fieldError: 'baseline',
      error: 'Chỗ đang đứng phải nhỏ hơn đích — nếu không thì không còn gì để tiến bộ.',
    };
  if (!unit) return {ok: false, fieldError: 'unit', error: 'Đơn vị là gì (điểm, bài, lần…)?'};

  // KIỂU ĐƠN VỊ (0110) — suy từ chính đơn vị em gõ, ở MÁY CHỦ, không tin ô trên form.
  //
  //   'do'    (điểm, kg, cm) → cộng lại không có nghĩa, nên KHÔNG có lưới ngày. Ép thành đích
  //           ghi-nhận-ngoài và bỏ luôn việc tuần nếu em có gõ: 7 điểm thứ Hai cộng 8 điểm thứ Tư
  //           ra 15 điểm là con số app không có quyền bày.
  //   'luong' (giờ, bài, trang) → ô ngày là ô ĐIỀN SỐ; chỉ tiêu tuần là một LƯỢNG em tự khai.
  //   'luot'  (ngày, buổi, tiết) → một chạm như cũ; chỉ tiêu tuần = số thứ được bật (0103).
  const kieu = kieuDonVi(unit);
  // MỘT CÂU HỎI, HAI CÂU TRẢ LỜI — đúng hai ví dụ chủ dự án đưa 13/08/2026:
  //   "10000 giờ học, 1 tick ngày = 3 giờ" → mỗi lần CỐ ĐỊNH 3 → một chạm, unit_per_tick = 3
  //   "5000 lead, thứ Hai điền 10 lead"    → mỗi lần MỘT KHÁC   → ô điền số, lượng nằm ở value
  const nhap_luong = kieu === 'luong' && String(formData.get('viec_nhap_luong') ?? '') === '1';

  // ĐO BẰNG GÌ, suy ra từ việc em điền chứ không hỏi thêm một câu nữa.
  //
  // Có việc để tick → máy đếm được → 'tick'. Không có → đây là đích ghi nhận ngoài ("điểm trung
  // bình 8,0"), cô và trò tự theo dõi, đạt thì tick một ô → 'manual'. App KHÔNG có dữ liệu điểm
  // môn, nên vẽ vạch tiến độ cho loại thứ hai là bịa — 0101 đã chặn ở tầng view.
  const measure_by = viec_title && kieu !== 'do' ? 'tick' : 'manual';

  // MỖI TUẦN BAO NHIÊU LẦN = ĐẾM SỐ THỨ EM ĐÃ CHỌN. Không hỏi thành một ô riêng nữa.
  //
  // Ô ấy nói dối được, và đã nói dối: uq_lead_progress_daily (0020) chỉ cho MỘT lượt tick mỗi
  // (việc, em, ngày), nên số lần tối đa trong tuần đúng bằng số thứ được bật. Em chọn 5 thứ rồi
  // gõ 3 vào ô "mấy lần/tuần" thì tick đủ cả tuần vẫn hiện 5/3; gõ 7 thì vạch không bao giờ đầy
  // dù em không bỏ buổi nào. Chủ dự án bắt đúng chỗ này 12/08/2026 ("rất vô lí").
  //
  // Với ô ĐIỀN SỐ thì hai con số ấy tách hẳn nhau: em chọn 5 thứ nhưng mỗi tuần 10 giờ. Nên loại
  // này hỏi thẳng "mỗi tuần bao nhiêu {đơn vị}" — 0103 bỏ ô ấy đi là đúng cho một-chạm, và sai
  // cho đếm-theo-lượng.
  // MỖI LƯỢT TICK ĐÁNG BAO NHIÊU. Đơn vị đếm-được-bằng-lượt thì luôn 1 (một buổi là một buổi).
  // Đơn vị theo lượng mà mỗi lần một khác thì lượng nằm thẳng trong `lead_progress.value`, nên hệ
  // số cũng là 1 — nhân hai lần là đếm gấp đôi.
  const upt_raw = String(formData.get('viec_upt') ?? '').trim();
  const unit_per_tick = kieu === 'luong' && !nhap_luong ? Number(upt_raw) : 1;

  // CHỈ TIÊU TUẦN tính theo ĐƠN VỊ của mục tiêu, không theo số lần:
  //   một chạm  → số thứ được bật × mỗi lần bao nhiêu  (3 ngày × 3 giờ = 9 giờ/tuần)
  //   điền số   → em tự khai, vì "5 buổi" và "10 giờ" là hai con số khác nhau
  const luong_raw = String(formData.get('viec_luong') ?? '').trim();
  const viec_target = nhap_luong ? Number(luong_raw) : viec_days.length * unit_per_tick;

  if (viec_title && kieu !== 'do' && viec_days.length === 0)
    return {ok: false, fieldError: 'viec_days', error: 'Con chọn ít nhất một thứ trong tuần nhé.'};
  if (viec_title && kieu === 'luong' && !nhap_luong && (!Number.isFinite(unit_per_tick) || unit_per_tick <= 0))
    return {ok: false, fieldError: 'viec_upt', error: `Mỗi lần con làm được bao nhiêu ${unit}?`};
  if (viec_title && nhap_luong && (!Number.isFinite(viec_target) || viec_target <= 0))
    return {ok: false, fieldError: 'viec_luong', error: `Mỗi tuần con làm bao nhiêu ${unit}?`};

  const supabase = await createClient();
  const nam = schoolYearRangeVN();

  // ── LĨNH VỰC KHÔNG CÒN LÀ CÂU HỎI ────────────────────────────────────────────────────────
  //
  // Mọi mục tiêu của em nay phải chỉ ra nó góp vào mục tiêu nào của lớp, và lĩnh vực lấy từ đúng
  // mục tiêu ấy. Chủ dự án chốt 13/08/2026: "không cho con tự chọn nữa, vì các wig cô tạo đã có đủ
  // 4 loại rồi" — cô đã khai đủ bốn lĩnh vực thì em luôn có chỗ để gắn vào, và hỏi thêm một câu
  // lĩnh vực chỉ mở đường cho em trả lời khác cha mình.
  //
  // Bản trước để trống là lặng lẽ xếp vào Kiến thức, nên "chạy bộ mỗi sáng" nằm ở cột Kiến thức
  // trên bảng họp mà chính em không có cách nào sửa. Nay không có đường nào để trống nữa.
  //
  // LẤY TỪ CSDL, không tin ô trên form: đây là cột quyết định mục tiêu của em nằm ở nhánh nào của
  // cây, và cũng là chỗ khoá wigs_em_uidx dựa vào.
  if (!source_wig_id)
    return {
      ok: false,
      fieldError: 'source_wig_id',
      error: 'Con chọn mục tiêu của lớp mà việc này góp sức vào nhé.',
    };
  const {data: chaLop} = await supabase
    .from('wigs')
    .select('area')
    .eq('id', source_wig_id)
    .eq('class_id', class_id)
    .eq('scope', 'class')
    // Ô chọn đã lọc rồi, nhưng ô chọn nằm trong trình duyệt. Chặn lại ở đây mới là chặn thật.
    .neq('measure_by', 'cuon')
    .maybeSingle();
  if (!chaLop)
    return {
      ok: false,
      fieldError: 'source_wig_id',
      error: 'Mục tiêu của lớp này không còn nữa — chọn lại.',
    };
  const area: Database['public']['Enums']['wig_area'] = chaLop.area;

  // MỤC TIÊU RIÊNG CHỈ MƯỢN LĨNH VỰC, KHÔNG MANG LIÊN KẾT. `wig_source_ck` (0100) bắt
  // source_wig_id phải null với kind='personal' — mục tiêu riêng không góp vào trận nào của lớp,
  // nó chỉ được xếp vào cùng một lĩnh vực để bốn vòng tròn trên màn của em đọc đúng.
  const soi = kind === 'academic' ? source_wig_id : null;

  const ban = {
    class_id,
    student_id,
    scope: 'student' as const,
    kind,
    // Em gõ thì gửi cô duyệt; cô gõ thì duyệt luôn — cô chính là người duyệt.
    status: laChinhEm ? 'sent' : 'approved',
    set_by: laChinhEm ? 'student' : 'teacher',
    measure_by,
    title,
    area,
    period: 'year' as const,
    period_label: nam.label,
    baseline,
    target_value,
    unit,
    start_date: nam.start,
    // Hạn của em, nhưng không được thò ra ngoài năm học.
    end_date: han > nam.end ? nam.end : han,
    source_wig_id: soi,
  };

  // Mỗi em MỘT mục tiêu mỗi loại mỗi năm (khoá wigs_em_uidx ở 0100). Đã có thì SỬA, không đẻ cái
  // thứ hai — hai mục tiêu cùng loại là hai vạch tiến độ cho một chuyện, và không màn hình nào
  // nói được cái nào mới là thật.
  const {data: daCo} = await supabase
    .from('wigs')
    .select('id, status, created_at')
    .eq('student_id', student_id)
    .eq('scope', 'student')
    .eq('kind', kind)
    .eq('period_label', nam.label)
    .maybeSingle();

  let wigId = daCo?.id ?? null;
  if (wigId) {
    // CỬA SỔ MỘT NGÀY ĐÃ BỎ (15/08/2026). PRD v3: "WIGs có thể được thay đổi trong năm, nhưng
    // vẫn cần GVCN duyệt." Khoá cứng sau 24 giờ ngược với "thay đổi trong năm" — và `ban.status`
    // ngay bên dưới đã tự đưa mục tiêu về 'sent' mỗi lần em sửa, nên việc DUYỆT LẠI mới là chốt
    // thật, không cần thêm một cửa sổ thời gian chặn hẳn việc sửa.
    //
    // XOÁ thì KHÁC — xem xoaMucTieuCuaEm(): xoá kéo theo mất cả lịch sử tick (cascade), một hành
    // động không đảo ngược được như sửa, nên cửa sổ một ngày vẫn giữ nguyên ở đó.
    const {error} = await supabase.from('wigs').update(ban).eq('id', wigId);
    if (error) return {ok: false, error: (friendlyError(error))};
  } else {
    const {data, error} = await supabase.from('wigs').insert(ban).select('id').maybeSingle();
    if (error) return {ok: false, error: (friendlyError(error))};
    if (!data) return {ok: false, error: 'Không lưu được mục tiêu (không có quyền).'};
    wigId = data.id;
  }

  // VIỆC CỦA EM ĐÃ RỜI KHỎI ĐÂY (0121).
  //
  // Trước 14/08/2026 một lần bấm Lưu làm ba việc: đặt mục tiêu năm, tạo một việc dẫn dắt, và rải
  // mười hai mốc tháng. Mô hình mới tách hẳn: mục tiêu NĂM đặt một lần đầu năm, còn việc để tick
  // thì treo dưới CAM KẾT của từng tuần — mỗi tuần tối đa 2 cam kết.
  //
  // Đúng thứ tự mà PRD v3 viết: "Mỗi học sinh sau khi đặt Wig đều phải thiết lập Weekly
  // commitment, lead measure, lịch PDR meeting của tuần đầu tiên và Buddy."
  //
  // Mốc tháng thì không còn khái niệm ấy nữa.

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  return {
    ok: true,
    message: laChinhEm
      ? 'Đã gửi cô xem. Cô duyệt xong là con bắt đầu tick được.'
      : 'Đã lưu mục tiêu cho em.',
  };
}

// Cô duyệt mục tiêu em vừa gửi.
export async function duyetMucTieu(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const wig_id = String(formData.get('wig_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({status: 'approved'})
    .eq('id', wig_id)
    .eq('scope', 'student')
    .select('id')
    .maybeSingle();
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data) veTrangEm(student_id, loi('Mục tiêu này không còn nữa.'));
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  veTrangEm(student_id, 'Đã duyệt mục tiêu của em');
}

// Xoá mục tiêu của em.
//
// Hai người xoá được, vì hai lý do khác nhau:
//   · CÔ — bất cứ lúc nào, như mọi bản ghi khác của lớp (rls_all_wigs).
//   · CHÍNH EM — chỉ trong cửa sổ một ngày. Đây là đường "con không nhận mục tiêu này": cô đặt hộ
//     xong em thấy không phải chuyện của mình thì bỏ thẳng, không phải viết đơn xin sửa rồi ngồi
//     chờ. Qua 24 giờ thì hết đường ấy — xem 0102.
export async function xoaMucTieuCuaEm(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return;
  const wig_id = String(formData.get('wig_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  if (!wig_id) veTrangEm(student_id, loi('Thiếu mục tiêu.'));

  const supabase = await createClient();
  const {data: w} = await supabase
    .from('wigs')
    .select('id, status, created_at')
    .eq('id', wig_id)
    .eq('scope', 'student')
    .maybeSingle();
  if (!w) veTrangEm(student_id, loi('Mục tiêu này không còn nữa.'));

  const laChinhEm = me.id === student_id && me.role === 'student';
  if (laChinhEm && !conTrongCuaSo(w))
    veTrangEm(student_id, loi('Mục tiêu này đã chốt rồi (quá 1 ngày). Con muốn bỏ thì nhắn cô nhé.'));

  // lead_measures và lead_progress dưới nó đi theo (on delete cascade, 0002).
  const {error} = await supabase.from('wigs').delete().eq('id', wig_id).eq('scope', 'student');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  veTrangEm(student_id, 'Đã xoá mục tiêu');
}

// Tick "đã đạt" cho đích ghi nhận ngoài. Cô và trò tự theo dõi ở ngoài app (bài kiểm tra, sổ liên
// lạc); app chỉ ghi lại AI xác nhận và LÚC NÀO — xem docs/MO_HINH_WIG.md §5.0.
export async function danhDauDaDat(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return;
  const wig_id = String(formData.get('wig_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const bo = String(formData.get('bo') ?? '') === '1';
  const supabase = await createClient();
  const {error} = await supabase
    .from('wigs')
    .update(
      bo
        ? {achieved_at: null, achieved_by: null}
        : {achieved_at: new Date().toISOString(), achieved_by: me.id},
    )
    .eq('id', wig_id);
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  veTrangEm(student_id, bo ? 'Đã bỏ đánh dấu' : 'Đã đánh dấu ĐẠT');
}

// ── SỐ ĐO NGOÀI APP (0108) ───────────────────────────────────────────────────────────────────
//
// Mục tiêu `measure_by='manual'` — cân nặng, chiều cao, điểm trung bình môn — app không đếm được.
// Tới 0108 nó chỉ có đúng một bit `achieved_at`, nên không ai đọc ra em đang đi nhanh hay chậm và
// buổi họp không có gì để cầm. Nay mỗi tuần một dòng số.
//
// Chủ dự án chốt: EM ghi được, CÔ ghi được, KHÔNG có bước duyệt, và đến khi buổi họp WIG của lớp
// được chốt thì khoá. Chốt thật nằm ở RLS (rls_insert/update_wig_so_do đọc `tuan_da_hop`); hàm này
// chỉ là cửa, và nó cố tình KHÔNG kiểm lại điều kiện khoá — hai chỗ cùng phán một luật là hai chỗ
// để chúng trôi khỏi nhau, mà tầng dưới mới là tầng có thẩm quyền.
//
// `vai_tro` do MÁY CHỦ suy từ người đang đăng nhập, không đọc từ form: nó là thứ màn hình dùng để
// nói "em tự ghi" hay "cô ghi", và một con số tự khai mà khai sai cả nguồn thì tệ hơn là không có.
export async function ghiSoDo(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};

  const wig_id = String(formData.get('wig_id') ?? '');
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (!wig_id) return {ok: false, error: 'Không rõ đang ghi cho mục tiêu nào.'};
  if (raw === '') return {ok: false, fieldError: 'gia_tri', error: 'Con điền số đã nhé.'};

  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0)
    return {ok: false, fieldError: 'gia_tri', error: 'Phải là một số từ 0 trở lên.'};

  const vai_tro = me.role === 'student' ? 'student' : 'teacher';
  const supabase = await createClient();

  // GHI VÀO TUẦN ĐANG XEM, không phải tuần hôm nay.
  //
  // Trước đây hàm này luôn dùng weekRangeVN() — tuần hiện tại. Màn của em thì luôn đứng ở tuần
  // này nên không lộ; nhưng trang /wig của cô lật được sang tuần khác, và ở đó cô gõ một con số
  // rồi nó lặng lẽ rơi vào TUẦN NÀY, biến mất khỏi màn cô đang nhìn. Đúng họ lỗi "nhập rồi mà
  // không thấy đâu" — thứ khó chẩn nhất, vì không có câu báo nào và dữ liệu thì vẫn ghi được.
  //
  // KIỂM, ĐỪNG TIN Ô ẨN: giá trị này do trình duyệt gửi. Không phải một ngày hợp lệ thì rơi về
  // tuần hiện tại, và luôn quy về THỨ HAI của tuần chứa ngày ấy (khoá của bảng là tuần, không
  // phải ngày). Cửa sổ cho phép để nguyên như cũ — RLS và dấu chốt buổi họp mới là thứ chặn thật.
  const tuanGui = String(formData.get('week') ?? '').trim();
  const tuan = isValidDayVN(tuanGui) ? weekRangeVN(new Date(`${mondayOf(tuanGui)}T12:00:00Z`)) : weekRangeVN();

  // Một dòng cho mỗi (mục tiêu, tuần). Ghi lại trong cùng tuần là SỬA — hai con số cho một tuần
  // thì buổi họp không biết đọc cái nào. 23505 nghĩa là dòng đã có, chuyển sang cập nhật.
  const ban = {wig_id, week_start: tuan.start, gia_tri, nguoi_nhap: me.id, vai_tro};
  const {error} = await supabase.from('wig_so_do').insert(ban);
  if (error) {
    if (error.code !== '23505') return {ok: false, error: friendlyError(error)};
    const {data, error: e2} = await supabase
      .from('wig_so_do')
      .update(ban)
      .eq('wig_id', wig_id)
      .eq('week_start', tuan.start)
      .select('id');
    if (e2) return {ok: false, error: friendlyError(e2)};
    // .select() để phân biệt "RLS chặn" với "đã ghi": thiếu nó thì tuần đã chốt vẫn báo thành công.
    if ((data?.length ?? 0) === 0)
      return {ok: false, error: 'Tuần này lớp đã họp chốt rồi nên số không sửa được nữa.'};
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: 'Đã ghi số của tuần này.'};
}

// ── SỔ CỦA CON ───────────────────────────────────────────────────────────────────────────────
//
// Trong Leader in Me, cuốn sổ THUỘC VỀ HỌC SINH — không phải hồ sơ của giáo viên. Đó là toàn bộ
// lý do nó có tác dụng, nên phân quyền phải nói đúng điều ấy: em viết, người lớn đọc. Chính sách
// rls_write_student_reflections (0100) là chốt cuối; hàm này chỉ là cửa.
//
// Khác mọi thứ còn lại trong mô hình: cô KHÔNG viết hộ được ở đây. Mục tiêu thì cô đặt hộ được
// (docs/MO_HINH_WIG.md §4), nhưng một cuốn sổ ai cũng viết được thì không còn là sổ của em nữa.
export async function luuSoCuaCon(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me || me.role !== 'student') return {ok: false, error: 'Chỉ chính em mới viết được sổ này.'};

  const class_id = String(formData.get('class_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return {ok: false, fieldError: 'body', error: 'Con viết vài chữ đã nhé.'};
  if (body.length > 2000) return {ok: false, fieldError: 'body', error: 'Tối đa 2000 ký tự.'};

  const supabase = await createClient();
  const tuan = weekRangeVN();

  // Một dòng cho mỗi (em, tuần) — khoá duy nhất ở CSDL. Viết lại trong cùng tuần là SỬA, không đẻ
  // thêm dòng; 23505 nghĩa là hai tab cùng gửi, chuyển sang cập nhật chứ không báo lỗi cho em.
  const {error} = await supabase
    .from('student_reflections')
    .insert({student_id: me.id, class_id, week_start: tuan.start, body});
  if (error && (error as {code?: string}).code === '23505') {
    const {error: e2} = await supabase
      .from('student_reflections')
      .update({body, updated_at: new Date().toISOString()})
      .eq('student_id', me.id)
      .eq('week_start', tuan.start);
    if (e2) return {ok: false, error: (friendlyError(e2))};
  } else if (error) {
    return {ok: false, error: (friendlyError(error))};
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: 'Đã lưu vào sổ của con.'};
}

// ── CHỈNH NHỊP ───────────────────────────────────────────────────────────────────────────────
//
// App rải mốc tháng đều nhau khi cô khai mục tiêu năm (lib/wig-nhip.ts). Nhưng năm học không đều:
// có Tết, có tuần thi, có tháng vào hè. Hàm này cho cô kéo lại.
//
// LUẬT DUY NHẤT: tổng các tháng phải bằng đúng đích năm. Không có luật ấy thì "nhịp" thành một
// dãy số rời rạc, và cảnh báo lệch nhịp — thứ đắt giá nhất của cả đợt sửa — sẽ nói dối theo hướng
// không ai đoán được. Kéo tháng này lên thì phải hạ tháng khác xuống; app không tự bù, vì tự bù
// nghĩa là sửa một con số cô không nhìn thấy.
export async function chinhNhip(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  await requireRole(['teacher', 'admin']);
  const nam_id = String(formData.get('nam_id') ?? '');
  const supabase = await createClient();

  const {data: nam} = await supabase
    .from('wigs')
    .select('id, target_value, baseline')
    .eq('id', nam_id)
    .eq('scope', 'class')
    .eq('period', 'year')
    // Mục tiêu cuộn không chia được: "86% học sinh đạt" chia cho 30 em không ra câu nào có nghĩa.
    .neq('measure_by', 'cuon')
    .maybeSingle();
  if (!nam) return {ok: false, error: 'Mục tiêu năm này không còn nữa.'};

  const {data: thang} = await supabase
    .from('wigs')
    .select('id')
    .eq('parent_wig_id', nam_id)
    .eq('period', 'month');

  const moi = new Map<string, number>();
  for (const m of thang ?? []) {
    const raw = String(formData.get(`moc_${m.id}`) ?? '').trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
      return {ok: false, fieldError: `moc_${m.id}`, error: 'Mỗi tháng phải là số lớn hơn 0.'};
    moi.set(m.id, n);
  }
  if (moi.size === 0) return {ok: false, error: 'Mục tiêu năm này chưa có mốc tháng nào.'};

  const tong = [...moi.values()].reduce((s, n) => s + n, 0);
  const can = Number(nam.target_value) - Number(nam.baseline ?? 0);
  if (Math.round(tong) !== Math.round(can))
    return {
      ok: false,
      error: `Tổng các tháng đang là ${Math.round(tong)}, phải bằng ${Math.round(can)}. Kéo tháng này lên thì hạ tháng khác xuống.`,
    };

  // Ghi từng tháng. Không gộp thành một câu được vì mỗi dòng một giá trị khác nhau; đổi lại con số
  // ở đây tối đa là 12, không phải 52.
  for (const [id, n] of moi) {
    const {error} = await supabase.from('wigs').update({target_value: n}).eq('id', id);
    if (error) return {ok: false, error: (friendlyError(error))};
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  return {ok: true, message: 'Đã chỉnh nhịp các tháng.'};
}

// BẠN ĐỒNG HÀNH kiểu ghép-cặp-bạn-cùng-lớp ĐÃ BỎ (12/08/2026).
//
// Hàm ghepBuddyTuan và components/wig/BanDongHanh.tsx gỡ khỏi mã nguồn: app chỉ còn MỘT nghĩa
// Buddy — con sư tử AI (lib/buddy.ts). Bảng buddy_pairs vẫn nằm nguyên trong CSDL cùng dữ liệu
// đã ghép; không xoá, chỉ thôi đọc và thôi ghi. Xem ghi chú ở components/student/StudentMeetings.

// ════════════════════════════════════════════════════════════════════════════════════════════
// EM TỰ ĐẶT CAM KẾT TUẦN — mắt xích bị đứt của cả vòng, nối lại (16/08/2026)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Cho tới hôm nay, đường DUY NHẤT sinh ra cam kết tuần của một em là ô "việc tuần này" mà GIÁO
// VIÊN gõ trong phòng họp. Chủ dự án bảo gỡ ("phải là em đặt chứ"), tôi gỡ — và quên rằng phía em
// chưa hề có đường thay thế. Kết quả: nửa cây cầu. Em viết cam kết thành một câu văn trong biên
// bản, còn bảng của cô đọc bảng `commitments` — hai bên nói về hai thứ khác nhau, và không có gì
// để tick suốt cả tuần.
//
// Đây là chỗ nối lại. Ba luật, và cả ba đều đã có sẵn trong CSDL — hàm này chỉ nói lại cho đúng
// câu tiếng Việt thay vì để người dùng nhận một mã lỗi Postgres:
//
//   · Cam kết của em treo dưới MỤC TIÊU NĂM CỦA CHÍNH EM (cam_ket_hop_le, 0121).
//   · Tối đa 2 cam kết mỗi tuần (chan_qua_hai_cam_ket) — "ít thì mới tập trung được".
//   · Em đặt thì vào trạng thái CHỜ DUYỆT, và máy tự ghi là em đặt (cam_ket_trang_thai, 0129).
//     Không tin ô nào của trình duyệt về hai chuyện ấy.
export async function datCamKetTuan(
  _prev: MucTieuState,
  formData: FormData,
): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return {ok: false, fieldError: 'title', error: 'Bạn viết cam kết của tuần đã nhé.'};
  if (title.length > 160)
    return {ok: false, fieldError: 'title', error: 'Cam kết tối đa 160 ký tự — viết ngắn cho dễ nhớ.'};

  // TUẦN NÀO: nhận từ form nhưng KIỂM lại, và luôn quy về thứ Hai. Bỏ trống thì là tuần tới —
  // buổi họp cuối tuần đặt cam kết cho tuần sắp tới, đó là nhịp mặc định.
  const tuanGui = String(formData.get('week') ?? '').trim();
  const monday = isValidDayVN(tuanGui) ? mondayOf(tuanGui) : nextWeekRangeVN().start;

  const supabase = await createClient();

  // Lớp em đang học, và mục tiêu năm của chính em để treo cam kết vào.
  const {data: ghiDanh} = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', me.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!ghiDanh?.class_id)
    return {ok: false, error: 'Bạn chưa được xếp lớp nên chưa đặt cam kết được.'};

  // EM CHỌN TRẬN ĐÁNH CỦA TUẦN NÀY (0138). Lớp có ba bốn mục tiêu năm; mỗi tuần em hứa vào cái
  // nào là quyền của em. Không gửi lên thì rơi về mục tiêu năm của chính em — đường cũ, vẫn giữ
  // cho mục tiêu riêng không thuộc trận nào của lớp.
  //
  // KIỂM Ở ĐÂY LÀ ĐỂ CÂU BÁO NÓI ĐƯỢC TIẾNG NGƯỜI; chốt thật nằm ở trigger cam_ket_hop_le, và nó
  // mới là thứ chặn khi ai đó gửi tay lên id mục tiêu của một lớp khác.
  const wigGui = String(formData.get('wig_id') ?? '').trim();
  let wigId: string | null = null;

  if (wigGui) {
    const {data: chon} = await supabase
      .from('wigs')
      .select('id')
      .eq('id', wigGui)
      .eq('period', 'year')
      .neq('measure_by', 'cuon')
      .or(`and(scope.eq.class,class_id.eq.${ghiDanh.class_id}),and(scope.eq.student,student_id.eq.${me.id})`)
      .maybeSingle();
    if (!chon?.id)
      return {ok: false, fieldError: 'wig_id', error: 'Mục tiêu bạn chọn không thuộc lớp mình.'};
    wigId = chon.id;
  } else {
    const {data: cuaEm} = await supabase
      .from('wigs')
      .select('id')
      .eq('student_id', me.id)
      .eq('scope', 'student')
      .eq('period', 'year')
      .eq('kind', 'academic')
      .maybeSingle();
    wigId = cuaEm?.id ?? null;
  }

  if (!wigId)
    return {
      ok: false,
      error: 'Bạn đặt mục tiêu năm trước đã — cam kết mỗi tuần là một bước đi tới mục tiêu ấy.',
    };

  const {data: daTao, error} = await supabase
    .from('commitments')
    .insert({
      wig_id: wigId,
      class_id: ghiDanh.class_id,
      student_id: me.id,
      week_start: monday,
      title,
      // Cột NOT NULL nhưng trigger đè lại bằng lĩnh vực của mục tiêu năm — gửi một giá trị hợp lệ
      // bất kỳ để qua cửa, đừng đọc nó như lựa chọn của người dùng.
      area: 'knowledge',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // Trần 2 cam kết là luật CÓ CHỦ Ý, không phải sự cố — nói bằng tiếng người.
    if (/hai cam k|tối đa 2|qua_hai/i.test(error.message))
      return {
        ok: false,
        error: 'Mỗi tuần chỉ đặt 2 cam kết thôi — ít thì mới tập trung được. Xoá bớt rồi đặt lại nhé.',
      };
    return {ok: false, error: friendlyError(error)};
  }

  // ── VIỆC ĐỂ TICK, NGAY TRONG CÙNG MỘT LẦN BẤM ─────────────────────────────────────────────
  //
  // Một lời hứa không có việc để tick là một lời hứa không ai đo được: cả tuần trôi qua, ô tick
  // trống trơn, và tới buổi họp thì không có gì để nói ngoài trí nhớ. Bắt em quay lại một màn khác
  // để thêm việc là chỗ người ta bỏ dở — nhất là trẻ con, nhất là trên điện thoại.
  //
  // Nên gộp vào một bước, và để TUỲ CHỌN: em chưa nghĩ ra việc thì cam kết vẫn gửi được, thêm sau.
  //
  // Chỉ tiêu = SỐ THỨ ĐƯỢC BẬT, không hỏi thành một ô riêng (0103): mỗi ngày một lượt tick, nên
  // hai con số ấy không thể lệch nhau — hỏi cả hai là mời người dùng tự mâu thuẫn với mình.
  const viecTitle = String(formData.get('viec_title') ?? '').trim();
  const thu = formData
    .getAll('viec_days')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

  if (viecTitle && daTao?.id) {
    if (thu.length === 0)
      return {
        ok: false,
        fieldError: 'viec_days',
        error: 'Bạn chọn ít nhất một thứ trong tuần cho việc ấy nhé. Cam kết ĐÃ gửi rồi.',
      };
    const {error: eViec} = await supabase.from('lead_measures').insert({
      commitment_id: daTao.id,
      title: viecTitle,
      target_value: thu.length,
      active_weekdays: thu,
      unit_per_tick: 1,
    });
    // Cam kết đã lưu rồi thì nói rõ ra, đừng để em tưởng mất cả hai và gửi lại.
    if (eViec)
      return {ok: false, error: `Cam kết đã gửi, nhưng việc chưa lưu được: ${friendlyError(eViec)}`};
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/hop', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {
    ok: true,
    message: viecTitle
      ? 'Đã gửi cam kết và việc của tuần cho thầy cô duyệt.'
      : 'Đã gửi cam kết tuần cho thầy cô duyệt.',
  };
}
