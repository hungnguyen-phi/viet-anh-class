'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

function flash(classId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/timetable?class=${encodeURIComponent(classId)}&${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// Hiệu trưởng nằm trong danh sách: ở trường thật, THỜI KHOÁ BIỂU do ban giám hiệu xếp, giáo
// viên chỉ đổi ngoại lệ (thi, thực hành, dạy thay). RLS ở migration 0057 giới hạn họ đúng các
// lớp trong cơ sở mình.
const KINDS = ['regular', 'practice', 'exam'] as const;

// Ô môn giờ gửi lên id của danh mục. Kiểm dạng uuid ngay tại đây để câu lỗi là tiếng Việt dễ
// hiểu, thay vì để Postgres trả 22P02 rồi friendlyError chỉ nói được "Đã xảy ra lỗi".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LuuOState = {ok: boolean; error?: string; message?: string};

// Lưu (tạo/sửa) 1 ô thời khoá biểu. RLS tt_manage: chỉ GVCN lớp/admin.
//
// TRẢ STATE, KHÔNG CHUYỂN TRANG. Form này nay nằm trong hộp thoại mở ra từ chính ô lịch: chuyển
// trang kèm một câu lỗi ở đầu trang có nghĩa là hộp thoại biến mất, chữ vừa gõ mất theo, và câu
// lỗi hiện ở chỗ cách xa nơi vừa bấm. Trả state thì lỗi hiện ngay trong hộp, còn lưu xong thì
// hộp tự đóng (cùng lối đã dùng cho form sửa mục tiêu ở /wig).
export async function luuOTiet(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const day_of_week = Number(formData.get('day_of_week') ?? 0);
  const period_no = Number(formData.get('period_no') ?? 0);
  const subject_id = String(formData.get('subject_id') ?? '').trim();
  const room = String(formData.get('room') ?? '').trim() || null;
  const teacher_name = String(formData.get('teacher_name') ?? '').trim() || null;
  const kindRaw = String(formData.get('kind') ?? 'regular');
  // Giá trị lạ từ form → về 'regular' cho khỏi dính CHECK ở DB rồi báo lỗi khó hiểu.
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'regular';
  if (!class_id || !day_of_week || !period_no)
    return {ok: false, error: 'Thiếu thông tin ô thời khoá biểu'};
  if (!UUID.test(subject_id)) return {ok: false, error: 'Hãy chọn môn cho ô này'};

  // ÁP CHO NHIỀU THỨ MỘT LẦN (18/08/2026 — "trình quản lý chuyên nghiệp"): môn học chính khoá
  // thường lặp 2–3 buổi/tuần, mà bản cũ bắt mở hộp thoại từng ô khai lại y hệt. Các checkbox
  // "áp thêm cho thứ…" gửi lên đây; ô gốc luôn nằm trong danh sách. Kiểm lại dải 2..8 vì
  // checkbox nằm trong trình duyệt.
  const cacThu = [
    ...new Set([
      day_of_week,
      ...formData
        .getAll('ap_thu')
        .map((d) => Number(String(d)))
        .filter((n) => Number.isInteger(n) && n >= 2 && n <= 8),
    ]),
  ];

  const supabase = await createClient();
  const {error} = await supabase
    .from('timetable_slots')
    // CHỈ ghi subject_id. Cột chữ `subject` cũ cố ý KHÔNG đụng tới: ghi cả hai là dựng lại đúng
    // hai nguồn sự thật mà 0069 vừa dẹp. onConflict giữ nguyên (class, thứ, tiết) — cột môn
    // không nằm trong khoá nên đổi môn của một ô vẫn là SỬA ô đó, không đẻ ô mới.
    .upsert(
      cacThu.map((thu) => ({
        class_id,
        day_of_week: thu,
        period_no,
        subject_id,
        room,
        teacher_name,
        kind,
      })),
      {onConflict: 'class_id,day_of_week,period_no'},
    );
  if (error) return {ok: false, error: friendlyError(error)};
  revalidatePath('/[locale]/timetable', 'page');
  return {
    ok: true,
    message: cacThu.length > 1 ? `Đã lưu tiết này cho ${cacThu.length} ngày` : 'Đã lưu ô thời khoá biểu',
  };
}

// ============================================================
// KHUNG GIỜ TIẾT (0149): "Tiết 3" phải nói được là mấy giờ.
// Form gửi 12 cặp tu_N / den_N; cặp bỏ trống = tiết đó không khai (xoá dòng nếu có).
// ============================================================
export async function luuGioTiet(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  if (!class_id) return {ok: false, error: 'Thiếu thông tin lớp'};

  const ghi: {class_id: string; period_no: number; start_time: string; end_time: string; updated_by: string}[] = [];
  const xoa: number[] = [];
  for (let p = 1; p <= 12; p++) {
    const tu = String(formData.get(`tu_${p}`) ?? '').trim();
    const den = String(formData.get(`den_${p}`) ?? '').trim();
    if (!tu && !den) {
      xoa.push(p);
      continue;
    }
    if (!tu || !den) return {ok: false, error: `Tiết ${p}: điền cả giờ bắt đầu và kết thúc, hoặc bỏ trống cả hai.`};
    if (den <= tu) return {ok: false, error: `Tiết ${p}: giờ kết thúc phải sau giờ bắt đầu.`};
    ghi.push({class_id, period_no: p, start_time: tu, end_time: den, updated_by: me.id});
  }
  // Tiết sau không được BẮT ĐẦU trước khi tiết trước KẾT THÚC — khung giờ chồng nhau là lưới
  // nói dối hai kiểu cùng lúc.
  for (let i = 1; i < ghi.length; i++) {
    if (ghi[i].start_time < ghi[i - 1].end_time)
      return {ok: false, error: `Tiết ${ghi[i].period_no} bắt đầu trước khi tiết ${ghi[i - 1].period_no} kết thúc.`};
  }

  const supabase = await createClient();
  if (ghi.length > 0) {
    const {error} = await supabase
      .from('class_period_times')
      .upsert(ghi, {onConflict: 'class_id,period_no'});
    if (error) return {ok: false, error: friendlyError(error)};
  }
  if (xoa.length > 0) {
    const {error} = await supabase
      .from('class_period_times')
      .delete()
      .eq('class_id', class_id)
      .in('period_no', xoa);
    if (error) return {ok: false, error: friendlyError(error)};
  }
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: 'Đã lưu khung giờ tiết học'};
}

// Gieo cả bộ môn của cơ sở vào chương trình lớp (class_subjects), để ô chọn môn thôi rỗng.
//
// Không tự làm ngầm khi mở trang: đây là một thao tác GHI, và người bấm phải là người chịu trách
// nhiệm về chương trình của lớp. RPC tự kiểm quyền (GVCN lớp / hiệu trưởng cùng cơ sở / admin) và
// tự bỏ qua môn đã có, nên bấm nhầm hai lần cũng không sao.
export async function seedSubjects(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  if (!class_id) flash(class_id, 'Thiếu thông tin lớp');
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('seed_class_subjects', {p_class: class_id});
  revalidatePath('/[locale]/timetable', 'page');
  flash(
    class_id,
    error ? loi(friendlyError(error)) : `Đã thêm ${data ?? 0} môn vào chương trình của lớp`,
  );
}

// ============================================================
// Ngoại lệ THEO NGÀY: huỷ / dời / dạy thay (0044).
// timetable_slots là mẫu tuần lặp nên không thể biểu diễn "huỷ tiết 3 thứ Tư ngày 15/09" —
// phải ghi riêng theo ngày, nếu không sẽ phá cả các tuần khác.
// ============================================================
export async function saveOverride(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const slot_id = String(formData.get('slot_id') ?? '');
  const date = String(formData.get('date') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;
  const substitute_name = String(formData.get('substitute_name') ?? '').trim() || null;
  const new_date = String(formData.get('new_date') ?? '').trim() || null;
  const newPeriodRaw = String(formData.get('new_period_no') ?? '').trim();
  const new_period_no = newPeriodRaw ? Number(newPeriodRaw) : null;

  if (!slot_id || !date) flash(class_id, 'Thiếu tiết hoặc ngày');
  if (!['cancelled', 'moved', 'substituted'].includes(status)) flash(class_id, 'Trạng thái không hợp lệ');
  // Kiểm ở đây để báo câu dễ hiểu; DB vẫn có CHECK tto_moved_needs_target / tto_sub_needs_name
  // làm chốt cuối (không tin form).
  if (status === 'moved' && (!new_date || !new_period_no))
    flash(class_id, 'Dời tiết thì phải chọn ngày và tiết đích.');
  if (status === 'substituted' && !substitute_name)
    flash(class_id, 'Dạy thay thì phải ghi tên người dạy thay.');

  const supabase = await createClient();
  // 1 ngoại lệ / (tiết, ngày) — ghi lại thì thay cái cũ, không chồng nhiều trạng thái lên nhau.
  const {error} = await supabase.from('timetable_overrides').upsert(
    {
      slot_id,
      date,
      status,
      note,
      substitute_name: status === 'substituted' ? substitute_name : null,
      new_date: status === 'moved' ? new_date : null,
      new_period_no: status === 'moved' ? new_period_no : null,
    },
    {onConflict: 'slot_id,date'},
  );
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu thay đổi lịch');
}

export async function deleteOverride(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_overrides').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã gỡ thay đổi, tiết trở lại bình thường');
}

// ============================================================
// CLB (PRD v3 #14): mục theo GIỜ, nằm ở dải period_no 13–18 dưới lưới tiết (xem migration 0144).
// Tên CLB ghi vào cột `subject` dạng chữ: CLB không phải MÔN nên không có chỗ trong danh mục
// subjects — quyết định E của 0069 ("chỉ ghi subject_id") là nói về tiết chính khoá.
// ============================================================
// TRẢ STATE, KHÔNG CHUYỂN TRANG (18/08/2026 — chủ dự án gõ giờ kết thúc sớm hơn giờ bắt đầu và
// chỉ thấy "màn hình load rồi thôi"): form này nằm CUỐI trang, còn toast flash thì hiện ở ĐẦU
// trang — câu báo đúng mà đặt sai chỗ thì với người dùng nó không tồn tại. Trả state để lỗi
// hiện ngay dưới nút vừa bấm, cùng lối với luuOTiet ở trên.
export async function luuCLB(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const day_of_week = Number(formData.get('day_of_week') ?? 0);
  const name = String(formData.get('name') ?? '').trim();
  const start_time = String(formData.get('start_time') ?? '').trim();
  const end_time = String(formData.get('end_time') ?? '').trim();
  const room = String(formData.get('room') ?? '').trim() || null;
  if (!class_id || day_of_week < 2 || day_of_week > 8)
    return {ok: false, error: 'Thiếu thông tin ngày'};
  if (!name) return {ok: false, error: 'Hãy ghi tên CLB'};
  if (!start_time || !end_time) return {ok: false, error: 'Hãy chọn giờ bắt đầu và kết thúc'};
  if (end_time <= start_time) return {ok: false, error: 'Giờ kết thúc phải sau giờ bắt đầu'};

  const supabase = await createClient();
  // Chỗ đứng trong dải 13–18: lấy số trống nhỏ nhất của ngày đó. Unique (lớp, thứ, tiết) vẫn
  // là trọng tài cuối — hai người cùng bấm thì một người nhận lỗi trùng chứ không đè nhau.
  const {data: daCo} = await supabase
    .from('timetable_slots')
    .select('period_no')
    .eq('class_id', class_id)
    .eq('day_of_week', day_of_week)
    .gte('period_no', 13);
  const dung = new Set((daCo ?? []).map((r) => r.period_no));
  const cho = [13, 14, 15, 16, 17, 18].find((p) => !dung.has(p));
  if (!cho) return {ok: false, error: 'Ngày này đã đủ 6 CLB'};

  const {error} = await supabase.from('timetable_slots').insert({
    class_id,
    day_of_week,
    period_no: cho,
    subject: name,
    kind: 'club',
    start_time,
    end_time,
    room,
  });
  if (error) return {ok: false, error: friendlyError(error)};
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: 'Đã thêm CLB'};
}

export async function deleteSlot(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_slots').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã xoá ô');
}
