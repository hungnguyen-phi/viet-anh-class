'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import type {Database} from '@/lib/database.types';

type Area = Database['public']['Enums']['wig_area'];
type Period = Database['public']['Enums']['wig_period'];

// Giữ lại ?class= khi redirect để không nhảy về lớp mặc định (WIG vừa tạo "biến mất").
function flash(msg: string, classId?: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  q.set('flash', msg);
  redirect(`/wig?${q.toString()}`);
}

// Ngày CHỐT tick của tuần (0046). Học sinh tự tick/gỡ/tick bù cả tuần, tới ngày này thì khoá để
// buổi họp WIG đọc số liệu đã chốt. 1=T2 … 7=CN (mặc định 7 = mở suốt tuần).
// Lớp họp thứ Bảy thì đặt 5 (thứ Sáu). RLS lp_student_* đọc cột này qua tick_open().
export async function setTickLockDow(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const dow = Number(formData.get('tick_lock_dow') ?? 0);
  if (!class_id || !Number.isInteger(dow) || dow < 1 || dow > 7) flash('Ngày chốt không hợp lệ', class_id);
  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn" với "đã lưu" — không báo thành công giả.
  const {data, error} = await supabase
    .from('classes')
    .update({tick_lock_dow: dow})
    .eq('id', class_id)
    .select('id');
  revalidatePath('/wig');
  revalidatePath('/student');
  if (error) flash(friendlyError(error), class_id);
  flash(data && data.length ? 'Đã lưu ngày chốt tuần' : 'Không lưu được (không có quyền).', class_id);
}

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type CreateWigState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {area: string; target_value: string; unit: string; period_label: string; start_date: string; end_date: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// Tạo WIG NĂM — INLINE validation (useActionState): lỗi cạnh field, giữ nguyên input, báo thành công ngay.
// Tách riêng khỏi createWig() (vẫn redirect/flash) để form tạo WIG tuần/tháng con không đổi.
export async function createYearWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const area = String(formData.get('area') ?? '') as Area;
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const target_value = Number(target_raw);
  const unit = String(formData.get('unit') ?? '').trim();
  const start_date = String(formData.get('start_date') ?? '');
  const end_date = String(formData.get('end_date') ?? '');
  const period_label = String(formData.get('period_label') ?? '').trim();
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {area, target_value: target_raw, unit, period_label, start_date, end_date};

  if (!class_id) return {ok: false, error: friendlyError(null), values};
  // Tên là BẮT BUỘC ở tầng ứng dụng (cột DB để nullable cho các WIG cũ). Một WIG không tên thì
  // mọi màn hình sau đó chỉ hiện được con số trần, không ai biết nó là mục tiêu gì.
  if (!title) return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho mục tiêu.', values};
  if (title.length > 160)
    return {ok: false, fieldError: 'title', error: 'Tên mục tiêu tối đa 160 ký tự.', values};
  if (!area) return {ok: false, fieldError: 'area', error: 'Hãy chọn lĩnh vực.', values};
  if (!target_raw || !Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số lớn hơn 0.', values};
  // "Từ" được phép bỏ trống (chưa đo được mốc đầu), nhưng gõ rồi thì phải là số hợp lệ.
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0))
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải là số từ 0 trở lên.', values};
  if (baseline !== null && baseline >= target_value)
    return {
      ok: false,
      fieldError: 'baseline',
      error: 'Mốc xuất phát phải nhỏ hơn mục tiêu — nếu không thì không còn gì để cải thiện.',
      values,
    };
  if (!unit) return {ok: false, fieldError: 'unit', error: 'Hãy nhập đơn vị (vd điểm, buổi, lần).', values};
  if (!start_date) return {ok: false, fieldError: 'start_date', error: 'Hãy chọn ngày bắt đầu.', values};
  if (!end_date) return {ok: false, fieldError: 'end_date', error: 'Hãy chọn ngày kết thúc.', values};

  const supabase = await createClient();
  const {error} = await supabase.from('wigs').insert({
    class_id,
    scope: 'class',
    title,
    baseline,
    area,
    period: 'year' as Period,
    period_label: period_label || null,
    target_value,
    unit,
    start_date,
    end_date,
    parent_wig_id: null,
  });
  if (error) return {ok: false, error: friendlyError(error), values};

  revalidatePath('/wig');
  revalidatePath('/');
  return {ok: true, message: 'Đã tạo WIG năm'};
}

export async function createWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const area = String(formData.get('area') ?? '') as Area;
  const period = String(formData.get('period') ?? '') as Period;
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim();
  const start_date = String(formData.get('start_date') ?? '');
  const end_date = String(formData.get('end_date') ?? '');
  const period_label = String(formData.get('period_label') ?? '').trim() || null;
  const parent_wig_id = String(formData.get('parent_wig_id') ?? '') || null;
  if (!class_id || !area || !period || !target_value || !unit || !start_date || !end_date) {
    flash('Thiếu thông tin WIG (lĩnh vực / kỳ / mục tiêu / đơn vị / ngày).', class_id);
  }
  if (!title) flash('Hãy đặt tên cho mục tiêu tuần/tháng.', class_id);
  if (target_value <= 0) flash('Mục tiêu phải lớn hơn 0.', class_id);
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0)) {
    flash('Mốc xuất phát phải là số từ 0 trở lên.', class_id);
  }
  if (baseline !== null && baseline >= target_value) {
    flash('Mốc xuất phát phải nhỏ hơn mục tiêu.', class_id);
  }
  if ((period === 'week' || period === 'month') && !parent_wig_id) {
    flash('WIG tuần/tháng phải liên kết với 1 WIG cha.', class_id);
  }
  const supabase = await createClient();
  const {error} = await supabase.from('wigs').insert({
    class_id,
    scope: 'class',
    title,
    baseline,
    area,
    period,
    period_label,
    target_value,
    unit,
    start_date,
    end_date,
    parent_wig_id,
  });
  revalidatePath('/wig');
  revalidatePath('/');
  flash(error ? friendlyError(error) : 'Đã tạo WIG', class_id);
}

export async function addLeadMeasure(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const wig_id = String(formData.get('wig_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const sub_category = String(formData.get('sub_category') ?? '').trim() || null;
  if (!wig_id || !title || !target_value) flash('Thiếu tên/mục tiêu lead measure', class_id);
  if (target_value <= 0) flash('Mục tiêu phải lớn hơn 0.', class_id);
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').insert({wig_id, title, target_value, unit, sub_category});
  revalidatePath('/wig');
  flash(error ? friendlyError(error) : 'Đã thêm lead measure', class_id);
}

export async function logProgress(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const lead_measure_id = String(formData.get('lead_measure_id') ?? '');
  const value = Number(formData.get('value') || 1);
  if (!lead_measure_id) flash('Thiếu lead measure', class_id);
  if (!Number.isFinite(value) || value <= 0) flash('Giá trị ghi phải lớn hơn 0.', class_id);
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const {error} = await supabase
    .from('lead_progress')
    .insert({lead_measure_id, value, logged_by: user?.id ?? null});
  revalidatePath('/wig');
  revalidatePath('/');
  flash(error ? friendlyError(error) : `Đã ghi +${value}`, class_id);
}

// Xoá WIG (sửa sai sót làm méo xếp hạng). WIG năm: xoá WIG tuần con trước
// (parent_wig_id không cascade); lead_measures + lead_progress tự cascade theo wig_id.
export async function deleteWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const wig_id = String(formData.get('wig_id') ?? '');
  if (!wig_id) flash('Thiếu WIG cần xoá', class_id);
  const supabase = await createClient();
  await supabase.from('wigs').delete().eq('parent_wig_id', wig_id); // WIG con (nếu là WIG năm)
  const {error} = await supabase.from('wigs').delete().eq('id', wig_id);
  revalidatePath('/wig');
  revalidatePath('/');
  flash(error ? friendlyError(error) : 'Đã xoá WIG', class_id);
}

// Sửa WIG (mục tiêu / đơn vị / nhãn kỳ / ngày) — bổ sung cho create+delete đã có.
export async function editWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const id = String(formData.get('wig_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim();
  const period_label = String(formData.get('period_label') ?? '').trim() || null;
  const start_date = String(formData.get('start_date') ?? '');
  const end_date = String(formData.get('end_date') ?? '');
  if (!id) flash('Thiếu WIG cần sửa', class_id);
  if (!title) flash('Hãy đặt tên cho mục tiêu.', class_id);
  if (!Number.isFinite(target_value) || target_value <= 0) flash('Mục tiêu phải lớn hơn 0.', class_id);
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0)) {
    flash('Mốc xuất phát phải là số từ 0 trở lên.', class_id);
  }
  if (baseline !== null && baseline >= target_value) {
    flash('Mốc xuất phát phải nhỏ hơn mục tiêu.', class_id);
  }
  if (!unit) flash('Thiếu đơn vị.', class_id);
  const supabase = await createClient();
  // .select() để biết có dòng nào thực sự đổi không: RLS chặn (lớp khác) → 0 dòng, error=null.
  // Không kiểm thì báo "thành công" sai (audit #5).
  const {data, error} = await supabase
    .from('wigs')
    .update({
      title,
      baseline,
      target_value,
      unit,
      period_label,
      ...(start_date ? {start_date} : {}),
      ...(end_date ? {end_date} : {}),
    })
    .eq('id', id)
    .select('id');
  revalidatePath('/wig');
  revalidatePath('/');
  if (error) flash(friendlyError(error), class_id);
  if (!data || data.length === 0) flash('Không sửa được WIG này (không có quyền hoặc đã bị xoá).', class_id);
  flash('Đã cập nhật WIG', class_id);
}

// Sửa lead measure (tên / mục tiêu / đơn vị / phân loại).
export async function editLeadMeasure(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const id = String(formData.get('lead_measure_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const sub_category = String(formData.get('sub_category') ?? '').trim() || null;
  if (!id || !title || !Number.isFinite(target_value)) flash('Thiếu tên/mục tiêu lead measure', class_id);
  if (target_value <= 0) flash('Mục tiêu phải lớn hơn 0.', class_id);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('lead_measures')
    .update({title, target_value, unit, sub_category})
    .eq('id', id)
    .select('id');
  revalidatePath('/wig');
  revalidatePath('/');
  if (error) flash(friendlyError(error), class_id);
  if (!data || data.length === 0)
    flash('Không sửa được lead measure này (không có quyền hoặc đã bị xoá).', class_id);
  flash('Đã cập nhật lead measure', class_id);
}

export async function deleteLeadMeasure(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const id = String(formData.get('lead_measure_id') ?? '');
  if (!id) flash('Thiếu lead measure cần xoá', class_id);
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').delete().eq('id', id);
  revalidatePath('/wig');
  revalidatePath('/');
  flash(error ? friendlyError(error) : 'Đã xoá lead measure', class_id);
}
