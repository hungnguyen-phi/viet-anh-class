'use server';

// TẦNG GHI CỦA MÀN MỤC TIÊU TRƯỜNG (/truong) — chỉ admin/BGH. Tạo mục tiêu trường đi qua
// luuMucTieu (form chung, cap='truong'); ở đây chỉ còn đóng/xoá, phải Ở LẠI /truong.
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

function veTruong(msg: string, campus?: string): never {
  const q = new URLSearchParams();
  if (campus) q.set('campus', campus);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/truong?${q.toString()}`);
}

export async function dongMucTieuTruong(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const campus = String(formData.get('campus') ?? '').trim() || undefined;
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  const ly_do_dong = String(formData.get('ly_do_dong') ?? 'bo');
  if (!id) veTruong(loi('Thiếu mục tiêu.'), campus);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'dong', ly_do_dong})
    .eq('id', id)
    .eq('cap', 'truong')
    .select('id');
  revalidatePath('/[locale]/truong', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTruong(loi(friendlyError(error)), campus);
  if (!data || data.length === 0) veTruong(loi('Không đóng được — không có quyền hoặc đã xoá.'), campus);
  veTruong('Đã đóng mục tiêu của trường', campus);
}

export async function xoaMucTieuTruong(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const campus = String(formData.get('campus') ?? '').trim() || undefined;
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) veTruong(loi('Thiếu mục tiêu.'), campus);
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'truong').select('id');
  revalidatePath('/[locale]/truong', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTruong(loi(friendlyError(error)), campus);
  if (!data || data.length === 0)
    veTruong(loi('Không xoá được — mục tiêu đã có lớp nối vào hoặc có số đo. Hãy Đóng thay vì xoá.'), campus);
  veTruong('Đã xoá mục tiêu của trường', campus);
}
