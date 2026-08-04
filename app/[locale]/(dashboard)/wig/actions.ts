'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {taoMotWig, chuanHoaThu, chuanHoaHeSo} from '@/lib/wig-tao';
import type {Database} from '@/lib/database.types';

type Area = Database['public']['Enums']['wig_area'];

// Hai bộ đọc FormData mỏng, luật nằm ở lib/wig-tao.ts (phòng họp cũng dùng, tên trường khác).
function parseWeekdays(formData: FormData): number[] {
  return chuanHoaThu(formData.getAll('weekdays'));
}
function parseUnitPerTick(formData: FormData): number | null {
  const raw = formData.get('unit_per_tick');
  return chuanHoaHeSo(raw === null ? null : String(raw));
}

// Giữ lại ?class= khi redirect để không nhảy về lớp mặc định (WIG vừa tạo "biến mất"), và ?week=
// để không nhảy về tuần hiện tại (WIG vừa sửa cũng "biến mất" y như vậy, chỉ theo chiều thời gian).
//
// Mỗi action ở dưới che tên này bằng một hàm cục bộ đã gắn sẵn lớp + tuần:
//   const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
// nhờ vậy hàng chục lời gọi flash('...') sẵn có không phải sửa từng cái — và không có chỗ nào
// lỡ quên truyền tuần.
function flashTo(msg: string, classId?: string, week?: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  if (week) q.set('week', week);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/wig?${q.toString()}`);
}

// Tuần đang xem, do ô ẩn name="week" trên mọi form của /wig gửi lên. Rỗng = tuần hiện tại.
function weekOf(formData: FormData): string | undefined {
  return String(formData.get('week') ?? '') || undefined;
}

// setTickLockDow ĐÃ BỎ (0081). Mốc chốt tick nay không phải một ngày giáo viên khai trước, mà là
// việc thật sự xảy ra: ghi nhận buổi họp cho tuần nào thì tick tuần ấy khoá lại.

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type CreateWigState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// ════════════════════════════════════════════════════════════════════════════
// TẠO MỤC TIÊU — MỘT ĐƯỜNG DUY NHẤT cho cả năm, tháng, tuần.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây có HAI hàm tạo: createYearWig (báo lỗi ngay tại chỗ, giữ nguyên chữ đã gõ) và
// createWig (chuyển trang kèm một câu lỗi, chữ đã gõ mất sạch). Cùng một việc, hai cách cư xử —
// người dùng gõ hỏng một ô ở form này thì được sửa, ở form kia thì phải gõ lại từ đầu.
//
// Phần kiểm và ghi nằm ở lib/wig-tao.ts, dùng chung với bước 3 của phòng họp — hai chỗ tạo WIG
// mà hai bộ luật là đúng cái bệnh "hai nguồn sự thật" cả đợt sửa này đang chữa.
export async function taoWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const period = String(formData.get('period') ?? '') as 'year' | 'month' | 'week';
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const supabase = await createClient();

  const kq = await taoMotWig(supabase, {
    class_id: String(formData.get('class_id') ?? ''),
    period,
    title,
    baseline: baseline_raw === '' ? null : Number(baseline_raw),
    target_value: Number(String(formData.get('target_value') ?? '').trim()),
    unit: String(formData.get('unit') ?? '').trim(),
    period_label: String(formData.get('period_label') ?? '').trim(),
    parent_wig_id: String(formData.get('parent_wig_id') ?? '').trim() || undefined,
    area: (String(formData.get('area') ?? '') as Area) || undefined,
  });
  if (!kq.ok) return {ok: false, error: kq.loi, fieldError: kq.field};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  const ten = period === 'year' ? 'năm' : period === 'month' ? 'tháng' : 'tuần';
  return {ok: true, message: `Đã tạo mục tiêu ${ten} “${title}”.`};
}

// ════════════════════════════════════════════════════════════════════════════
// LƯU MỘT VIỆC (lead measure) — tạo mới hoặc sửa, cùng một đường.
// ════════════════════════════════════════════════════════════════════════════
//
// Gộp addLeadMeasure + editLeadMeasure. Hai hàm cũ khác nhau đúng một chữ (insert/update) nhưng
// mỗi hàm lại kiểm dữ liệu theo cách riêng, và cả hai đều chuyển trang kèm câu lỗi — tức là gõ
// hỏng một ô là mất sạch năm ô còn lại. Nay trả state để form giữ nguyên chữ đã gõ và chỉ tô đỏ
// đúng ô sai.
export async function luuViec(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('lead_measure_id') ?? '').trim();
  const wig_id = String(formData.get('wig_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const target_value = Number(target_raw);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const sub_category = String(formData.get('sub_category') ?? '').trim() || null;
  const active_weekdays = parseWeekdays(formData);
  const upt = parseUnitPerTick(formData);

  if (!id && !wig_id) return {ok: false, error: 'Chưa rõ việc này thuộc mục tiêu tuần nào.'};
  if (!title) return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho việc này.'};
  if (title.length > 160) return {ok: false, fieldError: 'title', error: 'Tên việc tối đa 160 ký tự.'};
  if (!target_raw || !Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số lớn hơn 0.'};
  // Ô "mỗi lần tick đáng" bỏ trống khi TẠO MỚI thì lấy 1; khi SỬA thì giữ nguyên giá trị đang có
  // (xem ghi chú dài ở parseUnitPerTick — ghi đè bằng 1 là chia cả lịch sử tick cho hệ số cũ).
  const supabase = await createClient();

  if (id) {
    const {data, error} = await supabase
      .from('lead_measures')
      .update({
        title,
        target_value,
        unit,
        sub_category,
        active_weekdays,
        ...(upt === null ? {} : {unit_per_tick: upt}),
      })
      .eq('id', id)
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    // .select() để biết có dòng nào thật sự đổi không: RLS chặn (lớp khác) → 0 dòng, error=null.
    // Không kiểm thì báo "đã lưu" trong khi chẳng có gì đổi.
    if (!data || data.length === 0)
      return {ok: false, error: 'Không sửa được việc này (không có quyền hoặc đã bị xoá).'};
  } else {
    const {data, error} = await supabase
      .from('lead_measures')
      .insert({wig_id, title, target_value, unit, sub_category, active_weekdays, unit_per_tick: upt ?? 1})
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    if (!data || data.length === 0)
      return {ok: false, error: 'Không thêm được việc này (không có quyền với lớp này).'};
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: id ? `Đã sửa “${title}”.` : `Đã thêm “${title}”.`};
}

// ════════════════════════════════════════════════════════════════════════════
// SỬA MỘT MỤC TIÊU (WIG) — cùng kiểu trả state với taoWig.
// ════════════════════════════════════════════════════════════════════════════
//
// NGÀY KHÔNG SỬA ĐƯỢC Ở ĐÂY, cố ý. Ngày sinh ra từ nhãn kỳ (xem ngayCuaKy), nên cho sửa tay là
// mở lại đúng cái cửa vừa đóng: một WIG tuần lệch hai hôm so với tuần lịch thì màn hình giáo viên
// và màn hình học sinh cắt ra hai kết quả khác nhau — sự cố 7B1. Muốn đổi kỳ thì tạo mục tiêu
// mới cho kỳ đó.
export async function suaWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('wig_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const target_value = Number(target_raw);
  const unit = String(formData.get('unit') ?? '').trim();

  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần sửa.'};
  if (!title) return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho mục tiêu.'};
  if (title.length > 160)
    return {ok: false, fieldError: 'title', error: 'Tên mục tiêu tối đa 160 ký tự.'};
  if (!target_raw || !Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số lớn hơn 0.'};
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0))
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải là số từ 0 trở lên.'};
  if (baseline !== null && baseline >= target_value)
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải nhỏ hơn mục tiêu.'};
  if (!unit) return {ok: false, fieldError: 'unit', error: 'Hãy nhập đơn vị (vd điểm, buổi, lần).'};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({title, baseline, target_value, unit})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: (friendlyError(error))};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không sửa được mục tiêu này (không có quyền hoặc đã bị xoá).'};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã sửa “${title}”.`};
}

// logProgress() ĐÃ BỎ (0073). Trước đây GVCN tự bấm "Ghi +" để cộng số cho WIG lớp — nên bảng
// thắng/thua chỉ phản chiếu lại chính tay người bấm, lớp nào cũng thắng. Nay con số ấy do học
// sinh tick mà thành: cùng một bảng lead_progress, nhưng student_id là em nào tick, và
// wig_actual() cộng lên như cũ. Cần chữa sai sót thì sửa/xoá tick của em (RLS lp_staff_manage
// vẫn cho GVCN toàn quyền), chứ không cộng thêm một con số không thuộc về ai.

// Xoá WIG (sửa sai sót làm méo xếp hạng). WIG năm: xoá WIG tuần con trước
// (parent_wig_id không cascade); lead_measures + lead_progress tự cascade theo wig_id.
export async function deleteWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
  const wig_id = String(formData.get('wig_id') ?? '');
  if (!wig_id) flash('Thiếu WIG cần xoá');
  const supabase = await createClient();
  await supabase.from('wigs').delete().eq('parent_wig_id', wig_id); // WIG con (nếu là WIG năm)
  const {error} = await supabase.from('wigs').delete().eq('id', wig_id);
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error)) : 'Đã xoá WIG');
}

export async function deleteLeadMeasure(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
  const id = String(formData.get('lead_measure_id') ?? '');
  if (!id) flash('Thiếu lead measure cần xoá');
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').delete().eq('id', id);
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error)) : 'Đã xoá lead measure');
}
