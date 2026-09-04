'use server';

// TẦNG GHI CỦA KHU MỤC TIÊU TRƯỜNG (sống trong popup lớp/trường trên /wig) — chỉ admin/BGH.
// Tạo mục tiêu trường đi qua luuMucTieu (form chung, cap='truong'); ở đây: ghi số / đóng / xoá.
// 04/09: trả STATE cho useActionState (không redirect) — popup đứng yên, lỗi hiện tại chỗ.
import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {todayInVN} from '@/lib/dates';
import type {TrangThaiForm} from '@/lib/form-state';

type S = TrangThaiForm;
const lamMoi = () => {
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/truong', 'page');
};

export async function dongMucTieuTruong(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  const ly_do_dong = String(formData.get('ly_do_dong') ?? 'bo');
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').update({trang_thai: 'dong', ly_do_dong}).eq('id', id).eq('cap', 'truong').select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongDongDuoc')};
  return {ok: true, message: t('daDongMucTieuTruong')};
}

export async function xoaMucTieuTruong(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'truong').select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongXoaMucTieuTruong')};
  return {ok: true, message: t('daXoaMucTieuTruong')};
}

// GHI SỐ cho mục tiêu trường — trường đo theo cách riêng, ban giám hiệu điền lại con số.
export async function ghiSoMucTieuTruong(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['admin', 'principal']);
  const t = await getTranslations('loi');
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!muc_tieu_id) return {ok: false, error: t('khongRoMucTieu')};
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (raw === '') return {ok: false, fieldError: 'gia_tri', error: t('dienSoDa')};
  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0) return {ok: false, fieldError: 'gia_tri', error: t('soTu0')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('so_do')
    .insert({muc_tieu_id, ngay: todayInVN(), gia_tri, nguon: 'tay', nguoi_ghi: me.id, student_id: null})
    .select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongGhiDuocQuyen')};
  return {ok: true, message: t('daGhiSoTruong')};
}
