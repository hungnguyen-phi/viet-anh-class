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

// Lưu (tạo/sửa) 1 ô thời khoá biểu. RLS tt_manage: chỉ GVCN lớp/admin.
export async function saveSlot(formData: FormData) {
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
  if (!class_id || !day_of_week || !period_no) flash(class_id, 'Thiếu thông tin ô thời khoá biểu');
  if (!UUID.test(subject_id)) flash(class_id, 'Hãy chọn môn cho ô này');
  const supabase = await createClient();
  const {error} = await supabase
    .from('timetable_slots')
    // CHỈ ghi subject_id. Cột chữ `subject` cũ cố ý KHÔNG đụng tới: ghi cả hai là dựng lại đúng
    // hai nguồn sự thật mà 0069 vừa dẹp. onConflict giữ nguyên (class, thứ, tiết) — cột môn
    // không nằm trong khoá nên đổi môn của một ô vẫn là SỬA ô đó, không đẻ ô mới.
    .upsert(
      {class_id, day_of_week, period_no, subject_id, room, teacher_name, kind},
      {onConflict: 'class_id,day_of_week,period_no'},
    );
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu ô thời khoá biểu');
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

export async function deleteSlot(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_slots').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã xoá ô');
}
