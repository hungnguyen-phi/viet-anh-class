'use server';

import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {mondayOf, shiftWeeks, todayInVN} from '@/lib/dates';
import type {TrangThaiForm} from '@/lib/form-state';

// ════════════════════════════════════════════════════════════════════════════
// VIỆC (THƯỚC) CẤP LỚP — phần còn sống sau đợt dọn 04/09.
//
// Mô hình cũ "cô tạo việc lớp / cam kết lớp / duyệt chỉ tiêu ở màn cô" đã gỡ khỏi UI (03–04/09):
// 15 action mồ côi (taoWig, suaWig, deleteWig, luuViec, datCamKetLop, suaCamKetLop, xoaCamKetLop,
// chamCamKetLop, duyetMucTieu, traLaiMucTieu, duyetThuoc, traLaiThuoc, duyetChiTieu, traLaiChiTieu)
// xoá theo — không ai import, giữ chỉ nuôi bug. Còn hai việc: xoá thước lớp cũ chưa gắn mục tiêu,
// và đổi chỉ tiêu của thước lớp từ tuần sau. Cả hai trả STATE (không redirect).
// ════════════════════════════════════════════════════════════════════════════

type S = TrangThaiForm;
export type CreateWigState = S;

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function str(formData: FormData, ten: string): string {
  return String(formData.get(ten) ?? '').trim();
}
// Những ngày trong tuần một việc áp dụng (ISO 1=T2 … 7=CN). Bỏ trống → T2–T6.
function ngayApDung(formData: FormData): number[] {
  const n = formData
    .getAll('ngay_ap_dung')
    .map((v) => Number(v))
    .filter((x) => Number.isInteger(x) && x >= 1 && x <= 7);
  const uniq = [...new Set(n)].sort((a, b) => a - b);
  return uniq.length > 0 ? uniq : [1, 2, 3, 4, 5];
}
// Chỉ tiêu mới chỉ có hiệu lực từ tuần sau (trigger thls_truoc_them đòi tu_tuan >= tuần sau).
function tuanSau(): string {
  return shiftWeeks(mondayOf(todayInVN()), 1);
}

// XOÁ VIỆC CỦA LỚP. RLS chỉ cho xoá việc chưa từng duyệt và chưa có lượt — việc đã duyệt thì
// "Kết thúc từ tuần sau" chứ không xoá.
export async function xoaViecLop(_prev: S, formData: FormData): Promise<S> {
  const tLoi = await getTranslations('common');
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = str(formData, 'thuoc_id') || str(formData, 'lead_id');
  if (!id) return {ok: false, error: t('thieuThuoc')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if ((data ?? []).length === 0) return {ok: false, error: t('khongXoaViecLop')};
  return {ok: true, message: t('daXoaViec')};
}

// SỬA CHỈ TIÊU của một việc lớp (từ tuần sau) — đi qua thuoc_lich_su, KHÔNG sửa thẳng thuoc.
// Trigger thls_truoc_them: GVCN duyệt được việc nên dòng vào 'hieu_luc' ngay, áp dụng từ tuần sau.
export async function suaChiTieu(_prev: S, formData: FormData): Promise<S> {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const thuoc_id = str(formData, 'thuoc_id');
  const chi_tieu_ky = num(formData.get('chi_tieu_ky'));
  const moi_lan = num(formData.get('moi_lan'));
  const ly_do = str(formData, 'ly_do') || null;

  if (!thuoc_id) return {ok: false, error: t('thieuThuoc')};
  if (chi_tieu_ky === null || chi_tieu_ky < 0) return {ok: false, fieldError: 'chi_tieu_ky', error: t('chiTieuTu0')};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .insert({
      thuoc_id,
      tu_tuan: tuanSau(),
      chi_tieu_ky,
      moi_lan,
      ngay_ap_dung: formData.getAll('ngay_ap_dung').length ? ngayApDung(formData) : null,
      ly_do,
      nguoi_doi: me.id,
    })
    .select('trang_thai');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('khongLuuQuyenLop')};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  const choDuyet = data[0]?.trang_thai === 'cho_duyet';
  return {ok: true, message: choDuyet ? t('daLuuChoDuyetHaNhieu') : t('daLuuChiTieuTuanSau')};
}
