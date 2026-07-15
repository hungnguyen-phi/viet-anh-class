'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import type {Database} from '@/lib/database.types';

type Area = Database['public']['Enums']['wig_area'];
type Period = Database['public']['Enums']['wig_period'];

function flash(msg: string): never {
  redirect(`/wig?flash=${encodeURIComponent(msg)}`);
}

export async function createWig(formData: FormData) {
  const class_id = String(formData.get('class_id') ?? '');
  const area = String(formData.get('area') ?? '') as Area;
  const period = String(formData.get('period') ?? '') as Period;
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim();
  const start_date = String(formData.get('start_date') ?? '');
  const end_date = String(formData.get('end_date') ?? '');
  const period_label = String(formData.get('period_label') ?? '').trim() || null;
  const parent_wig_id = String(formData.get('parent_wig_id') ?? '') || null;
  if (!class_id || !area || !period || !target_value || !unit || !start_date || !end_date) {
    flash('Thiếu thông tin WIG (lĩnh vực / kỳ / mục tiêu / đơn vị / ngày).');
  }
  if (period === 'week' && !parent_wig_id) {
    flash('WIG tuần phải liên kết với 1 WIG năm.');
  }
  const supabase = await createClient();
  const {error} = await supabase.from('wigs').insert({
    class_id,
    scope: 'class',
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
  flash(error ? `Lỗi tạo WIG: ${error.message}` : 'Đã tạo WIG');
}

export async function addLeadMeasure(formData: FormData) {
  const wig_id = String(formData.get('wig_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const target_value = Number(formData.get('target_value') ?? 0);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  if (!wig_id || !title || !target_value) flash('Thiếu tên/mục tiêu lead measure');
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').insert({wig_id, title, target_value, unit});
  revalidatePath('/wig');
  flash(error ? `Lỗi: ${error.message}` : 'Đã thêm lead measure');
}

export async function logProgress(formData: FormData) {
  const lead_measure_id = String(formData.get('lead_measure_id') ?? '');
  const value = Number(formData.get('value') || 1);
  if (!lead_measure_id) flash('Thiếu lead measure');
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const {error} = await supabase
    .from('lead_progress')
    .insert({lead_measure_id, value, logged_by: user?.id ?? null});
  revalidatePath('/wig');
  revalidatePath('/');
  flash(error ? `Lỗi ghi tiến độ: ${error.message}` : `Đã ghi +${value}`);
}
