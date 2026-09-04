'use server';

import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {isValidDayVN, todayInVN, weekRangeVN} from '@/lib/dates';
import {timHoacTaoDonVi} from '@/lib/don-vi-server';
import type {TrangThaiForm} from '@/lib/form-state';

// ════════════════════════════════════════════════════════════════════════════════════════════
// TẦNG GHI CỦA MÀN THẦY CÔ — /wig (mô hình mục tiêu PA2)
//
// 04/09 (audit): MỌI action ở đây trả STATE cho useActionState, KHÔNG redirect. Lý do: dưới tải,
// redirect trả "Connection closed" → màn lỗi trong khi CSDL đã ghi, người dùng bấm lại → trùng.
// Trang đứng yên, lỗi hiện cạnh nút, revalidatePath làm mới số.
//
// Luật quyền nằm ở RLS/trigger (20-QUYEN). Action chỉ đặt giá trị đích + lo CÂU BÁO tiếng người
// (namespace `loi` trong messages — không còn chuỗi cứng), và `.select()` sau mỗi lệnh ghi để
// phân biệt "RLS chặn, 0 dòng" với "đã ghi".
// ════════════════════════════════════════════════════════════════════════════════════════════

type S = TrangThaiForm;
const lamMoi = () => {
  revalidatePath('/[locale]/wig', 'page');
};
const soTu = (v: FormDataEntryValue | null): number | null => {
  const raw = String(v ?? '').trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};
const ngayChonTu = (formData: FormData) =>
  formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

// ── GHI SỐ cho mục tiêu LỚP đo tay (nguon_so='ghi_tay') ─────────────────────────────────────
// Mỗi lần ghi là MỘT dòng so_do mới — số mới nhất là số thật, lịch sử giữ.
export async function ghiSoMucTieuLop(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!muc_tieu_id) return {ok: false, error: t('khongRoMucTieu')};
  const gia_tri = soTu(formData.get('gia_tri'));
  if (gia_tri === null) return {ok: false, fieldError: 'gia_tri', error: t('dienSoDa')};
  if (Number.isNaN(gia_tri) || gia_tri < 0) return {ok: false, fieldError: 'gia_tri', error: t('soTu0')};
  const ngayGui = String(formData.get('ngay') ?? '').trim();
  const ngay = isValidDayVN(ngayGui) ? ngayGui : todayInVN();
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('so_do')
    .insert({muc_tieu_id, ngay, gia_tri, nguon: 'tay', nguoi_ghi: me.id, student_id: null})
    .select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongGhiDuocQuyen')};
  return {ok: true, message: t('daGhiSoLop')};
}

// ── XOÁ MỤC TIÊU CỦA LỚP — RLS chỉ cho khi chưa có số đo/dây; đã có thì Đóng (trong hộp Sửa). ──
export async function xoaMucTieuLop(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'lop').select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongXoaMucTieuLop')};
  return {ok: true, message: t('daXoaMucTieuLop')};
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// CAM KẾT + THƯỚC ĐO CÁ NHÂN CỦA THẦY CÔ (chốt 03/09; quyền mở ở 0181; nhiều thước ở 0185)
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function taoCamKetToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const class_id = String(formData.get('class_id') ?? '').trim();
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: t('camKetHuaGiToi')};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: t('toiDa300')};
  let so_hua = soTu(formData.get('so_hua'));
  if (so_hua !== null && (Number.isNaN(so_hua) || so_hua <= 0))
    return {ok: false, fieldError: 'so_hua', error: t('soCamKetLonHon0')};
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim() || null;
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tuan_bat_dau = isValidDayVN(tuanGui) ? tuanGui : weekRangeVN().start;

  const supabase = await createClient();
  // Đơn vị ÉP theo mục tiêu cá nhân; ck_don_vi_ck: có số hứa ⟺ có đơn vị.
  let don_vi_id: string | null = null;
  if (muc_tieu_id) {
    const {data: g} = await supabase.from('muc_tieu').select('don_vi_id').eq('id', muc_tieu_id).maybeSingle();
    don_vi_id = g?.don_vi_id ?? null;
  }
  if (so_hua === null || don_vi_id === null) {
    so_hua = null;
    don_vi_id = null;
  }
  const {data, error} = await supabase
    .from('cam_ket')
    .insert({chu_the: 'em', class_id, student_id: me.id, noi_dung, so_hua, don_vi_id, muc_tieu_id, thuoc_id: null, so_tuan: 1, tuan_bat_dau})
    .select('id')
    .maybeSingle();
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('khongLuuQuyenLop')};
  return {ok: true, message: t('daLuuCamKet')};
}

// Đọc phần "cách đo" của form thước (dùng chung cho thêm + sửa).
async function docCachDo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  meId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): Promise<{ok: true; payload: {cach_ghi: string; don_vi_id: string; chi_tieu_ky: number; moi_lan: number | null; ngay_ap_dung: number[]}} | {ok: false; state: S}> {
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  if (viecCach === 'dien_so') {
    let vdv = String(formData.get('viec_don_vi') ?? '').trim();
    const vdich = soTu(formData.get('viec_dich'));
    if (!vdv || vdich === null || Number.isNaN(vdich) || vdich <= 0)
      return {ok: false, state: {ok: false, fieldError: 'viec_dich', error: t('doSoCanDonViDich')}};
    if (vdv === '__khac__') {
      const tenDv = String(formData.get('don_vi_moi') ?? '').trim();
      if (!tenDv) return {ok: false, state: {ok: false, fieldError: 'don_vi_moi', error: t('goTenDonVi')}};
      const dv = await timHoacTaoDonVi(supabase, meId, tenDv);
      if (!dv.id) return {ok: false, state: {ok: false, fieldError: 'don_vi_moi', error: dv.error ?? t('khongTaoDonVi')}};
      vdv = dv.id as string;
    }
    return {ok: true, payload: {cach_ghi: 'dien_so', don_vi_id: vdv, chi_tieu_ky: vdich, moi_lan: null, ngay_ap_dung: [1, 2, 3, 4, 5, 6, 7]}};
  }
  const ngayChon = ngayChonTu(formData);
  if (ngayChon.length === 0) return {ok: false, state: {ok: false, fieldError: 'ngay', error: t('chonItNhatMotNgay')}};
  const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
  const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
  if (!ngayId) return {ok: false, state: {ok: false, error: t('thieuDonViHeThong')}};
  return {ok: true, payload: {cach_ghi: 'cham', don_vi_id: ngayId, chi_tieu_ky: ngayChon.length, moi_lan: 1, ngay_ap_dung: ngayChon}};
}

// THÊM THƯỚC ĐO DẪN DẮT cho một cam kết cá nhân (0185: thước trỏ về cam kết qua cam_ket_id).
export async function themThuocChoCamKetToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const class_id = String(formData.get('class_id') ?? '').trim();
  const cam_ket_id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!cam_ket_id) return {ok: false, error: t('thieuCamKet')};
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('thuocLaViecGi')};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: t('toiDa160')};
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tu_tuan = isValidDayVN(tuanGui) ? tuanGui : weekRangeVN().start;
  const supabase = await createClient();
  const cd = await docCachDo(supabase, formData, me.id, t);
  if (!cd.ok) return cd.state;
  const {data: vRow, error: vErr} = await supabase
    .from('thuoc')
    .insert({chu_the: 'em', class_id, student_id: me.id, ten, chieu_dich: 'it_nhat', gop: 'tong', ky_tuan: 1, pham_vi: 'tung_em', tu_tuan, duyet: 'duyet', trang_thai: 'chay', cam_ket_id, ...cd.payload})
    .select('id')
    .maybeSingle();
  lamMoi();
  if (vErr) return {ok: false, error: friendlyError(vErr)};
  if (!vRow) return {ok: false, error: t('khongTaoThuoc')};
  return {ok: true, message: t('daThemThuoc')};
}

// CHẤM TẠI CHỖ (Thắng/Thua/Bỏ chấm). ket_qua rỗng = bỏ chấm (trigger xoá sạch chữ ký).
export type ChamState = S;
export async function chamCamKetToiTaiCho(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuCamKet')};
  const ketQuaRaw = String(formData.get('ket_qua') ?? '').trim();
  const ket_qua = ketQuaRaw === 'thang' || ketQuaRaw === 'thua' ? ketQuaRaw : null;
  const so_dat = soTu(formData.get('so_dat'));
  if (so_dat !== null && (Number.isNaN(so_dat) || so_dat < 0)) return {ok: false, error: t('soDatTu0')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update({ket_qua, so_dat: ket_qua === null ? null : so_dat})
    .eq('id', id)
    .eq('student_id', me.id)
    .select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongChamDuoc')};
  return {ok: true};
}

export async function suaCamKetToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuCamKet')};
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: t('camKetHuaGiToi')};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: t('toiDa300')};
  const patch: {noi_dung: string; so_hua?: number} = {noi_dung};
  const so_hua = soTu(formData.get('so_hua'));
  if (so_hua !== null) {
    if (Number.isNaN(so_hua) || so_hua <= 0) return {ok: false, fieldError: 'so_hua', error: t('soCamKetLonHon0')};
    patch.so_hua = so_hua;
  }
  const supabase = await createClient();
  const {data, error} = await supabase.from('cam_ket').update(patch).eq('id', id).eq('student_id', me.id).select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongSuaCamKet')};
  return {ok: true, message: t('daSuaCamKet')};
}

// Xoá = đánh dấu 'huy' (như bản của em): biến khỏi màn, KHÔNG tự lăn sang tuần sau, không tính
// trần 2/tuần. Xoá cứng thì con lăn tuần (0177) nhân bản lại từ bản cũ — thành cam kết ma.
export async function xoaCamKetToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuCamKet')};
  const supabase = await createClient();
  const {data: ck} = await supabase.from('cam_ket').select('ket_qua').eq('id', id).maybeSingle();
  if (ck?.ket_qua) return {ok: false, error: t('camKetDaChamKhongXoa')};
  const {data, error} = await supabase.from('cam_ket').update({trang_thai: 'huy'}).eq('id', id).eq('student_id', me.id).select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongXoaCamKet')};
  await supabase.from('thuoc').delete().eq('cam_ket_id', id).eq('student_id', me.id);
  lamMoi();
  return {ok: true, message: t('daXoaCamKet')};
}

// SỬA thước cá nhân — tên/ngày/đích tuỳ thích; đổi CÁCH ĐO/ĐƠN VỊ khi đã có lượt thì trigger
// th_truoc_sua chặn (câu báo hiện nguyên).
export async function suaThuocToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const thuoc_id = String(formData.get('thuoc_id') ?? '').trim();
  if (!thuoc_id) return {ok: false, error: t('thieuThuoc')};
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('thuocLaViecGi')};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: t('toiDa160')};
  const supabase = await createClient();
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  let patch: {ten: string; cach_ghi: string; don_vi_id?: string; chi_tieu_ky: number; moi_lan: number | null; ngay_ap_dung?: number[]};
  if (viecCach === 'dien_so') {
    const vdv = String(formData.get('viec_don_vi') ?? '').trim();
    const vdich = soTu(formData.get('viec_dich'));
    if (vdich === null || Number.isNaN(vdich) || vdich <= 0) return {ok: false, fieldError: 'viec_dich', error: t('dichLonHon0')};
    patch = {ten, cach_ghi: 'dien_so', chi_tieu_ky: vdich, moi_lan: null};
    if (vdv) patch.don_vi_id = vdv;
  } else {
    const ngayChon = ngayChonTu(formData);
    if (ngayChon.length === 0) return {ok: false, fieldError: 'ngay', error: t('chonItNhatMotNgay')};
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) return {ok: false, error: t('thieuDonViHeThong')};
    patch = {ten, cach_ghi: 'cham', don_vi_id: ngayId, chi_tieu_ky: ngayChon.length, moi_lan: 1, ngay_ap_dung: ngayChon};
  }
  const {data, error} = await supabase.from('thuoc').update(patch).eq('id', thuoc_id).eq('student_id', me.id).select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('khongSuaThuoc')};
  return {ok: true, message: t('daSuaThuoc')};
}

// XOÁ thước cá nhân — th_truoc_xoa chặn khi đã có lượt (câu báo hiện nguyên).
export async function xoaThuocToi(_prev: S, formData: FormData): Promise<S> {
  const me = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const thuoc_id = String(formData.get('thuoc_id') ?? '').trim();
  if (!thuoc_id) return {ok: false, error: t('thieuThuoc')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', thuoc_id).eq('student_id', me.id).select('id');
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: t('chiXoaThuocChuaGhi')};
  return {ok: true, message: t('daXoaThuoc')};
}

// ── NỐI / GỠ mục tiêu LỚP ↔ mục tiêu TRƯỜNG (hàm 0181/0182 gác quyền; lớp→trường chỉ giữ hướng) ──
export async function noiWigTruong(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const con = String(formData.get('muc_tieu_id') ?? '').trim();
  const cha = String(formData.get('truong_id') ?? '').trim();
  if (!con || !cha) return {ok: false, fieldError: 'truong_id', error: t('chonMucTieuTruongDa')};
  const supabase = await createClient();
  const {error} = await supabase.rpc('noi_wig_len_tren', {p_con: con, p_cha: cha});
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  return {ok: true, message: t('daNoiTruong')};
}

export async function goWigTruong(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const con = String(formData.get('muc_tieu_id') ?? '').trim();
  const cha = String(formData.get('truong_id') ?? '').trim();
  if (!con || !cha) return {ok: false, error: t('thieuDayGo')};
  const supabase = await createClient();
  const {error} = await supabase.rpc('go_wig_len_tren', {p_con: con, p_cha: cha});
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  return {ok: true, message: t('daGoTruong')};
}

// ── DUYỆT / TRẢ LẠI mục tiêu của EM (chờ ở màn thầy cô) ────────────────────────────────────
export async function duyetMucTieuEm(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .eq('cap', 'em')
    .eq('trang_thai', 'gui')
    .select('id')
    .maybeSingle();
  lamMoi();
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('mucTieuKhongConCho')};
  return {ok: true, message: t('daDuyetMucTieuEm')};
}

export async function traLaiMucTieuEm(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  if (!note) return {ok: false, fieldError: 'note', error: t('traLaiGhiViSao')};
  if (note.length > 300) return {ok: false, fieldError: 'note', error: t('nhanXetToiDa300')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('cap', 'em')
    .eq('trang_thai', 'gui')
    .select('id')
    .maybeSingle();
  lamMoi();
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('mucTieuKhongConCho')};
  return {ok: true, message: t('daTraLaiEm')};
}

// ── DUYỆT / TRẢ LẠI thước của em (cột `duyet`, khác `trang_thai`) ────────────────────────────
export async function duyetThuoc(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('thuoc_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuThuoc')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').update({duyet: 'duyet'}).eq('id', id).eq('duyet', 'gui').select('id').maybeSingle();
  lamMoi();
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('thuocKhongConCho')};
  return {ok: true, message: t('daDuyetThuocEm')};
}

export async function traLaiThuoc(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('thuoc_id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuThuoc')};
  if (!note) return {ok: false, fieldError: 'note', error: t('traLaiGhiViSao')};
  if (note.length > 300) return {ok: false, fieldError: 'note', error: t('nhanXetToiDa300')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .update({duyet: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('duyet', 'gui')
    .select('id')
    .maybeSingle();
  lamMoi();
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('thuocKhongConCho')};
  return {ok: true, message: t('daTraLaiEm')};
}

// ── DUYỆT LẠI khi hạ chỉ tiêu nhiều (thuoc_lich_su 'cho_duyet' → 'hieu_luc') ────────────────
export async function duyetHaChiTieu(_prev: S, formData: FormData): Promise<S> {
  await requireRole(['teacher', 'admin']);
  const t = await getTranslations('loi');
  const id = String(formData.get('lich_su_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuDongDuyet')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .update({trang_thai: 'hieu_luc'})
    .eq('id', id)
    .eq('trang_thai', 'cho_duyet')
    .select('id')
    .maybeSingle();
  lamMoi();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('dongKhongConCho')};
  return {ok: true, message: t('daDuyetChiTieuMoi')};
}
