'use server';

// TẦNG GHI CỦA MÀN MỤC TIÊU TRƯỜNG (/truong) — chỉ admin/BGH. Tạo mục tiêu trường đi qua
// luuMucTieu (form chung, cap='truong'); ở đây chỉ còn đóng/xoá, phải Ở LẠI /truong.
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {todayInVN} from '@/lib/dates';

// 04/09: trang /truong đã gỡ — khu mục tiêu trường sống trong popup trên /wig. Quay về đó
// kèm ?bang=lop để popup tự bung lại sau redirect.
function veTruong(msg: string, _campus?: string): never {
  const q = new URLSearchParams();
  q.set('bang', 'lop');
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/wig?${q.toString()}`);
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

// GHI SỐ cho mục tiêu trường — trường đo theo cách riêng, ban giám hiệu điền lại con số.
// Mỗi lần ghi là MỘT dòng so_do mới (số mới nhất là số thật, lịch sử giữ) — như bản của lớp.
export async function ghiSoMucTieuTruong(formData: FormData) {
  const me = await requireRole(['admin', 'principal']);
  const campus = String(formData.get('campus') ?? '').trim() || undefined;
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!muc_tieu_id) veTruong(loi('Không rõ đang ghi cho mục tiêu nào.'), campus);
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (raw === '') veTruong(loi('Điền số đã nhé.'), campus);
  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0) veTruong(loi('Số phải từ 0 trở lên.'), campus);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('so_do')
    .insert({muc_tieu_id, ngay: todayInVN(), gia_tri, nguon: 'tay', nguoi_ghi: me.id, student_id: null})
    .select('id');
  revalidatePath('/[locale]/truong', 'page');
  if (error) veTruong(loi(friendlyError(error)), campus);
  if (!data || data.length === 0)
    veTruong(loi('Không ghi được — không có quyền với mục tiêu này.'), campus);
  veTruong('Đã ghi số cho mục tiêu của trường', campus);
}
