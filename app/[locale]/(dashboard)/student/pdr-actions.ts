'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {getCurrentProfile} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {isoWeekLabel, todayInVN, vnNoon, mondayOf, nextWeekRangeVN} from '@/lib/dates';

// ════════════════════════════════════════════════════════════════════════════
// HỌP PDR (Plan-Do-Review) — PRD v3 mục 6.2.7
// ════════════════════════════════════════════════════════════════════════════
//
// Mỗi tuần em họp với buddy (1-1 hoặc 1-1-1, GVCN ghép cặp ở /roster) và LẦN LƯỢT trả lời
// 6 câu hỏi. Mỗi dòng pdr_meetings là PHẦN TRẢ LỜI CỦA MỘT EM — buổi 1-1-1 có ba dòng cùng
// tuần. Câu 6 ("Tuần này bạn cam kết điều gì?") sinh bản ghi cam kết của TUẦN TỚI, bắt buộc
// gắn vào một WIG ĐÃ DUYỆT của chính em — cam kết không phục vụ mục tiêu nào là "lạc mục tiêu".
//
// RLS (0146) là chốt thật: em chỉ ghi dòng của mình, chỉ tới khi Ghi nhận; biên bản chỉ người
// tham gia + giáo viên thấy. Mã ở đây lo câu báo lỗi nói tiếng người và lo ráp buddy đúng.

export type PdrState = {ok: boolean; error?: string; fieldError?: string; message?: string};

const CAU = ['q1_plan', 'q2_result', 'q3_obstacle', 'q4_overcome', 'q5_better_way', 'q6_commitment'] as const;

export async function luuPdr(_prev: PdrState, formData: FormData): Promise<PdrState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  if (me.role !== 'student') return {ok: false, error: 'Biên bản PDR do chính em ghi.'};

  const traLoi = {} as {[K in (typeof CAU)[number]]: string | null};
  for (const c of CAU) {
    const v = String(formData.get(c) ?? '').trim();
    if (v.length > 600) return {ok: false, fieldError: c, error: 'Mỗi câu tối đa 600 ký tự.'};
    traLoi[c] = v || null;
  }

  // BUDDY hằng tuần hay COACH (1-1 với GVCN, hằng tháng) — hai nhánh của cùng một biên bản 6 câu.
  const loai = String(formData.get('type') ?? 'buddy');
  if (loai !== 'buddy' && loai !== 'coach')
    return {ok: false, error: 'Không rõ đây là buổi họp loại nào.'};

  const supabase = await createClient();
  const {data: ghiDanh} = await supabase
    .from('enrollments')
    .select('class_id, classes(homeroom_teacher_id)')
    .eq('student_id', me.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!ghiDanh?.class_id) return {ok: false, error: 'Em chưa được xếp lớp.'};

  // NGƯỜI NGỒI HỌP LẤY TỪ CSDL, không tin form: buddy do GVCN ghép, coach là chính GVCN.
  // Thứ tự ổn định theo ngày ghép để counterpart/second không nhảy chỗ mỗi lần lưu.
  let counterpart: string | null = null;
  let secondBuddy: string | null = null;
  if (loai === 'buddy') {
    const {data: cap} = await supabase
      .from('buddy_pairs')
      .select('student_id, buddy_id, created_at')
      .eq('is_active', true)
      .or(`student_id.eq.${me.id},buddy_id.eq.${me.id}`)
      // Nhóm 3 sinh cả 3 cặp trong MỘT giao dịch (0153) → created_at bằng nhau; thêm khoá phụ
      // để counterpart/second không đổi chỗ giữa hai lần đọc.
      .order('created_at')
      .order('id');
    const banHoc = (cap ?? []).map((p) => (p.student_id === me.id ? p.buddy_id : p.student_id));
    if (banHoc.length === 0)
      return {ok: false, error: 'Em chưa có buddy — giáo viên ghép cặp xong là họp được.'};
    counterpart = banHoc[0];
    secondBuddy = banHoc[1] ?? null;
  } else {
    const gvcn = (ghiDanh as unknown as {classes: {homeroom_teacher_id: string | null} | null}).classes
      ?.homeroom_teacher_id;
    if (!gvcn) return {ok: false, error: 'Lớp em chưa có giáo viên chủ nhiệm.'};
    counterpart = gvcn;
  }

  const weekLabel = isoWeekLabel(vnNoon(todayInVN()));
  const {data: daCo} = await supabase
    .from('pdr_meetings')
    .select('id, acknowledged_at')
    .eq('student_id', me.id)
    .eq('type', loai)
    .eq('week_label', weekLabel)
    .maybeSingle();
  if (daCo?.acknowledged_at)
    return {ok: false, error: 'Buổi họp tuần này đã Ghi nhận rồi — biên bản đã đóng.'};

  let meetingId = daCo?.id ?? null;
  if (meetingId) {
    const {error} = await supabase.from('pdr_meetings').update(traLoi).eq('id', meetingId);
    if (error) return {ok: false, error: friendlyError(error)};
  } else {
    const {data, error} = await supabase
      .from('pdr_meetings')
      .insert({
        class_id: ghiDanh.class_id,
        student_id: me.id,
        type: loai,
        counterpart_id: counterpart,
        second_buddy_id: secondBuddy,
        week_label: weekLabel,
        ...traLoi,
      })
      .select('id')
      .maybeSingle();
    if (error) return {ok: false, error: friendlyError(error)};
    if (!data) return {ok: false, error: 'Không lưu được biên bản (không có quyền).'};
    meetingId = data.id;
  }

  // ── CÂU 2 → CHỐT THẮNG/THUA CHO CAM KẾT TUẦN TRƯỚC (PRD v3 6.2.7) ────────────────────────
  // Từ 19/08/2026 đây là ĐƯỜNG CHẤM DUY NHẤT (không còn họp lớp): em tự chấm; không bấm thì
  // cam kết để trống thắng/thua.
  // Chốt cho cam kết tuần trước CHƯA có kết quả: ưu tiên cái sinh từ PDR tuần trước; nếu chỉ
  // có một cái chưa chấm thì là nó; còn mơ hồ (2 cái, không cái nào từ PDR) thì KHÔNG đoán.
  let canhBao = '';
  const chot = String(formData.get('q2_verdict') ?? '').trim();
  if (chot === 'win' || chot === 'lose') {
    const tuanTruoc = mondayOf(todayInVN());
    const d = new Date(`${tuanTruoc}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    const monTruoc = d.toISOString().slice(0, 10);
    const {data: ckTruoc} = await supabase
      .from('commitments')
      .select('id, pdr_meeting_id, verdict, pdr_meetings(type)')
      .eq('student_id', me.id)
      .eq('week_start', monTruoc)
      .is('verdict', null);
    const ds = (ckTruoc ?? []) as unknown as {
      id: string;
      pdr_meeting_id: string | null;
      verdict: string | null;
      pdr_meetings: {type: string} | null;
    }[];
    // ƯU TIÊN cam kết mà buổi sinh ra nó CÙNG LOẠI với buổi đang lưu (audit 18/08): tuần trước có
    // cả buổi buddy lẫn coach thì mỗi buổi một cam kết cùng week_start — không phân loại thì
    // Thắng/Thua của buổi buddy có thể ghi nhầm vào cam kết của buổi coach.
    const muctieu =
      ds.find((c) => c.pdr_meetings?.type === loai) ??
      ds.find((c) => c.pdr_meeting_id) ??
      (ds.length === 1 ? ds[0] : null);
    if (muctieu) {
      const {data: goiY} = await supabase.rpc('cam_ket_goi_y', {p_commitment: muctieu.id});
      const {error} = await supabase
        .from('commitments')
        .update({
          verdict: chot,
          verdict_goi_y: (goiY as string | null) === 'win' || goiY === 'lose' ? goiY : null,
          verdict_by: me.id,
          verdict_at: new Date().toISOString(),
        })
        .eq('id', muctieu.id);
      if (error) canhBao = ' Kết quả Thắng/Thua chưa ghi được (cam kết tuần trước có thể đã chốt rồi).';
    } else if (ds.length > 1) {
      canhBao = ' Tuần trước có hai cam kết chưa chấm — không rõ Thắng/Thua này thuộc cam kết nào nên chưa ghi.';
    }
  }

  // ── CÂU 6 → CAM KẾT TUẦN TỚI ──────────────────────────────────────────────────────────────
  // Chỉ sinh MỘT lần cho mỗi buổi (soi pdr_meeting_id); em sửa câu 6 sau đó thì sửa lời văn ở
  // thẻ cam kết như mọi cam kết khác, không đẻ bản thứ hai.
  const wigGui = String(formData.get('wig_id') ?? '').trim();
  if (traLoi.q6_commitment) {
    if (!wigGui)
      return {
        ok: false,
        fieldError: 'wig_id',
        error: 'Cam kết phải gắn vào một WIG đã duyệt của em — chọn WIG nhé.',
      };
    const {data: daSinh} = await supabase
      .from('commitments')
      .select('id')
      .eq('pdr_meeting_id', meetingId)
      .maybeSingle();
    if (!daSinh) {
      // WIG phải là CỦA EM và ĐÃ DUYỆT (PRD v3: "1 trong các WIG đã duyệt của học sinh").
      const {data: wig} = await supabase
        .from('wigs')
        .select('id')
        .eq('id', wigGui)
        .eq('student_id', me.id)
        .eq('scope', 'student')
        .eq('status', 'approved')
        .maybeSingle();
      if (!wig)
        return {ok: false, fieldError: 'wig_id', error: 'WIG này chưa được duyệt hoặc không phải của em.'};
      const {error} = await supabase.from('commitments').insert({
        wig_id: wig.id,
        class_id: ghiDanh.class_id,
        student_id: me.id,
        week_start: nextWeekRangeVN().start,
        title: traLoi.q6_commitment.slice(0, 160),
        area: 'knowledge', // trigger đè bằng lĩnh vực của WIG — giá trị qua cửa, không phải lựa chọn
        pdr_meeting_id: meetingId,
      });
      if (error) {
        if (/hai cam k|tối đa 2|qua_hai/i.test(error.message))
          return {
            ok: false,
            error: 'Tuần tới đã đủ 2 cam kết — cam kết trong câu 6 không sinh thêm được. Biên bản vẫn đã lưu.',
          };
        return {ok: false, error: friendlyError(error)};
      }
    }
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: 'Đã lưu biên bản PDR.' + canhBao};
}

// Nút "Ghi nhận" — xác nhận buổi họp ĐÃ DIỄN RA (PRD v3: chưa Ghi nhận thì không tính KPI).
// Người bấm là người tham gia (RLS pdr_student_update / pdr_staff_all quyết ai bấm được);
// bấm xong biên bản đóng — USING của policy không cho em sửa nữa.
export async function ghiNhanPdr(_prev: PdrState, formData: FormData): Promise<PdrState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  const id = String(formData.get('meeting_id') ?? '');
  if (!id) return {ok: false, error: 'Thiếu buổi họp.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('pdr_meetings')
    .update({acknowledged_at: new Date().toISOString(), acknowledged_by: me.id})
    .eq('id', id)
    .is('acknowledged_at', null)
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: 'Buổi họp đã Ghi nhận rồi, hoặc em không tham gia buổi này.'};
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: 'Đã ghi nhận buổi họp.'};
}
