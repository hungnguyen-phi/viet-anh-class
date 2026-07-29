'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import type {Database} from '@/lib/database.types';

type Area = Database['public']['Enums']['wig_area'];

function flash(msg: string): never {
  redirect(`/admin?flash=${encodeURIComponent(msg)}`);
}

// Nền mờ (soft_rgba) suy ra từ màu hex ở opacity 0.14 — trùng giá trị seed hiện tại,
// nên admin chỉ cần chọn 1 màu; parity với bản cũ được giữ.
function softFromHex(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return 'rgba(38,39,93,0.14)';
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},0.14)`;
}

// Cập nhật 1 lĩnh vực 4DX (nhãn VN/EN, màu, icon, đơn vị mặc định).
export async function updateArea(formData: FormData) {
  await requireRole(['admin']);
  const area = String(formData.get('area') ?? '') as Area;
  const label_vi = String(formData.get('label_vi') ?? '').trim();
  const label_en = String(formData.get('label_en') ?? '').trim();
  const color_hex = String(formData.get('color_hex') ?? '').trim();
  const icon_name = String(formData.get('icon_name') ?? '').trim();
  const default_unit = String(formData.get('default_unit') ?? '').trim() || null;
  if (!area || !label_vi || !label_en || !color_hex || !icon_name) flash('Thiếu thông tin lĩnh vực');

  const supabase = await createClient();
  const {error} = await supabase
    .from('area_config')
    .update({label_vi, label_en, color_hex, soft_rgba: softFromHex(color_hex), icon_name, default_unit})
    .eq('area', area);
  if (!error) await supabase.rpc('log_audit', {p_action: 'update_area', p_detail: {area}});
  // Lĩnh vực hiển thị ở scoreboard lớp (/) và trang WIG.
  revalidatePath('/[locale]/admin', 'page');
  revalidatePath('/[locale]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  flash(error ? friendlyError(error) : 'Đã cập nhật lĩnh vực');
}
