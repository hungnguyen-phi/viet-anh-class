'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {isValidDayVN, todayInVN, weekRangeVN} from '@/lib/dates';
import {timHoacTaoDonVi} from '@/lib/don-vi-server';

// ════════════════════════════════════════════════════════════════════════════════════════════
// TẦNG GHI CỦA MÀN CÔ — /wig (mô hình mục tiêu PA2)
//
// Màn của em ghi qua student/actions.ts (redirect về /student/[id]). Những nút Ở ĐÂY là việc cô
// làm TRÊN màn lớp và phải Ở LẠI /wig sau khi bấm — nên tách ra tệp riêng với một helper redirect
// riêng, thay vì mượn veTrangEm (nó luôn nhảy sang trang của một em).
//
// Luật quyền nằm ở RLS/trigger (20-QUYEN). Action chỉ đặt giá trị đích + lo CÂU BÁO tiếng người,
// và `.select()` sau mỗi lệnh ghi để phân biệt "RLS chặn, 0 dòng" với "đã ghi" — không có nó thì
// một lớp không thuộc quyền cô vẫn báo thành công trong khi CSDL không đổi gì.
// ════════════════════════════════════════════════════════════════════════════════════════════

// Về lại /wig kèm thông báo, GIỮ ngữ cảnh lớp + tuần đang xem (không thì cô rơi về lớp mặc định /
// tuần hiện tại và thứ vừa sửa "biến mất").
function veWig(msg: string, classId?: string, week?: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  if (week) q.set('week', week);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/wig?${q.toString()}`);
}

function nen(formData: FormData) {
  const classId = String(formData.get('class_id') ?? '').trim() || undefined;
  const week = String(formData.get('week') ?? '').trim() || undefined;
  return {classId, week};
}

// ── GHI SỐ HÔM NAY cho mục tiêu LỚP đo tay (nguon_so='ghi_tay') ───────────────────────────────
// Cân nặng, điểm trung bình lớp… máy không đếm được; cô (hoặc em) điền lại con số. Mỗi lần ghi là
// MỘT dòng so_do mới — số mới nhất là số thật (private.so_hien_tai đọc 'moi_nhat'), lịch sử giữ.
export async function ghiSoMucTieuLop(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!muc_tieu_id) veWig(loi('Không rõ đang ghi cho mục tiêu nào.'), classId, week);
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (raw === '') veWig(loi('Thầy cô điền số đã nhé.'), classId, week);
  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0)
    veWig(loi('Số phải từ 0 trở lên.'), classId, week);
  const ngayGui = String(formData.get('ngay') ?? '').trim();
  const ngay = isValidDayVN(ngayGui) ? ngayGui : todayInVN();

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('so_do')
    .insert({muc_tieu_id, ngay, gia_tri, nguon: 'tay', nguoi_ghi: me.id, student_id: null})
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Không ghi được — thầy cô không có quyền với mục tiêu này.'), classId, week);
  veWig('Đã ghi số cho mục tiêu của lớp', classId, week);
}

// ── ĐÓNG / XOÁ MỤC TIÊU CỦA LỚP ──────────────────────────────────────────────────────────────
// Bản của em (student/actions) khoá .eq('cap','em') và nhảy về /student; lớp cần bản riêng ở lại
// /wig. Luật ai-được-làm nằm ở RLS (ghi_duoc_muc_tieu) — .select() phân biệt "RLS chặn" với "xong".
export async function dongMucTieuLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  const ly_do_dong = String(formData.get('ly_do_dong') ?? '');
  if (!id) veWig(loi('Thiếu mục tiêu.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'dong', ly_do_dong})
    .eq('id', id)
    .eq('cap', 'lop')
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0) veWig(loi('Không đóng được — không có quyền hoặc đã xoá.'), classId, week);
  veWig('Đã đóng mục tiêu của lớp', classId, week);
}

// Xoá — RLS chỉ cho khi nhap/gui/tra_lai VÀ chưa có số đo/dây dưới nó; đã duyệt thì Đóng, không xoá.
export async function xoaMucTieuLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu mục tiêu.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'lop').select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Không xoá được — mục tiêu đã duyệt hoặc có số đo. Hãy Đóng thay vì xoá.'), classId, week);
  veWig('Đã xoá mục tiêu của lớp', classId, week);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// CAM KẾT + THƯỚC ĐO CÁ NHÂN CỦA THẦY CÔ (chốt 03/09: cam kết không treo ở mục tiêu lớp nữa)
//
// Thầy cô có mục tiêu CÁ NHÂN (cap='em', student_id = thầy cô) nối vào mục tiêu lớp; cam kết
// tuần + thước đo dẫn dắt của thầy cô treo ở mục tiêu cá nhân ấy, chu_the='em' — tự hứa, tự
// chấm, y như em. Quyền mở ở 0181; các action dưới đây chỉ khác bộ của em ở chỗ Ở LẠI /wig.
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function taoCamKetToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const class_id = classId ?? '';
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) veWig(loi('Tuần này thầy cô hứa làm gì? Viết một câu.'), classId, week);
  if (noi_dung.length > 300) veWig(loi('Tối đa 300 ký tự.'), classId, week);
  const soHuaRaw = String(formData.get('so_hua') ?? '').trim();
  let so_hua = soHuaRaw === '' ? null : Number(soHuaRaw);
  if (so_hua !== null && (!Number.isFinite(so_hua) || so_hua <= 0))
    veWig(loi('Con số của cam kết phải lớn hơn 0.'), classId, week);
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
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Không lưu được — thầy cô không có quyền với lớp này.'), classId, week);
  veWig('Đã lưu cam kết', classId, week);
}

// THÊM THƯỚC ĐO DẪN DẮT cho một cam kết CÁ NHÂN của thầy cô — như themThuocChoCamKet của em
// (chu_the='em', pham_vi='tung_em') nhưng ở lại /wig.
export async function themThuocChoCamKetToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const class_id = classId ?? '';
  const cam_ket_id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!cam_ket_id) veWig(loi('Thiếu cam kết.'), classId, week);
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) veWig(loi('Thước đo dẫn dắt là việc gì? Viết một câu.'), classId, week);
  if (ten.length > 160) veWig(loi('Tối đa 160 ký tự.'), classId, week);
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tu_tuan = isValidDayVN(tuanGui) ? tuanGui : weekRangeVN().start;
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  // Ngày ĐÍCH DANH (isodow 1..7) từ bộ chip — kiểu tick: chỉ tick được đúng những ngày này.
  const ngayChon = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

  const supabase = await createClient();
  let payload: {cach_ghi: string; don_vi_id: string; chi_tieu_ky: number; moi_lan: number | null; ngay_ap_dung: number[]} | null = null;
  if (viecCach === 'dien_so') {
    let vdv = String(formData.get('viec_don_vi') ?? '').trim();
    const vdich = Number(String(formData.get('viec_dich') ?? '').trim());
    if (!vdv || !Number.isFinite(vdich) || vdich <= 0)
      veWig(loi('Đo bằng số thì chọn đơn vị và nhập đích lớn hơn 0.'), classId, week);
    if (vdv === '__khac__') {
      const tenDv = String(formData.get('don_vi_moi') ?? '').trim();
      if (!tenDv) veWig(loi('Gõ tên đơn vị muốn dùng.'), classId, week);
      const dv = await timHoacTaoDonVi(supabase, me.id, tenDv);
      if (!dv.id) veWig(loi(dv.error ?? 'Không tạo được đơn vị mới.'), classId, week);
      vdv = dv.id as string;
    }
    payload = {cach_ghi: 'dien_so', don_vi_id: vdv, chi_tieu_ky: vdich, moi_lan: null, ngay_ap_dung: [1, 2, 3, 4, 5, 6, 7]};
  } else {
    if (ngayChon.length === 0) veWig(loi('Chọn ít nhất một ngày để tick.'), classId, week);
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) veWig(loi('Thiếu đơn vị hệ thống (ngày/lần).'), classId, week);
    payload = {cach_ghi: 'cham', don_vi_id: ngayId as string, chi_tieu_ky: ngayChon.length, moi_lan: 1, ngay_ap_dung: ngayChon};
  }

  const {data: vRow, error: vErr} = await supabase
    .from('thuoc')
    .insert({chu_the: 'em', class_id, student_id: me.id, ten, chieu_dich: 'it_nhat', gop: 'tong', ky_tuan: 1, pham_vi: 'tung_em', tu_tuan, duyet: 'duyet', trang_thai: 'chay', ...payload})
    .select('id')
    .maybeSingle();
  if (vErr) veWig(loi(friendlyError(vErr)), classId, week);
  if (!vRow) veWig(loi('Không tạo được thước đo dẫn dắt.'), classId, week);
  const {data, error} = await supabase.from('cam_ket').update({thuoc_id: vRow!.id}).eq('id', cam_ket_id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0) veWig(loi('Không nối được — cam kết đã chấm hoặc không có quyền.'), classId, week);
  veWig('Đã thêm thước đo dẫn dắt', classId, week);
}

// Thầy cô tự chấm Thắng/Thua cam kết CÁ NHÂN (ck_truoc_sua: em tự chấm của mình — thầy cô là
// CHẤM TẠI CHỖ (Thắng/Thua/Bỏ chấm) — KHÔNG redirect: nút bé, trang phải đứng yên. Trả state
// cho useActionState; revalidatePath làm mới số. ket_qua rỗng = bỏ chấm (trigger xoá sạch chữ ký).
export type ChamState = {ok: boolean; error?: string};
export async function chamCamKetToiTaiCho(_prev: ChamState, formData: FormData): Promise<ChamState> {
  const me = await requireRole(['teacher', 'admin']);
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) return {ok: false, error: 'Thiếu cam kết.'};
  const ketQuaRaw = String(formData.get('ket_qua') ?? '').trim();
  const ket_qua = ketQuaRaw === 'thang' || ketQuaRaw === 'thua' ? ketQuaRaw : null;
  const soDatRaw = String(formData.get('so_dat') ?? '').trim();
  const so_dat = soDatRaw === '' ? null : Number(soDatRaw);
  if (so_dat !== null && (!Number.isFinite(so_dat) || so_dat < 0))
    return {ok: false, error: 'Số đạt được phải từ 0 trở lên.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update({ket_qua, so_dat: ket_qua === null ? null : so_dat})
    .eq('id', id)
    .eq('student_id', me.id)
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: 'Không chấm được — không có quyền hoặc đã xoá.'};
  return {ok: true};
}

export async function suaCamKetToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu cam kết.'), classId, week);
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) veWig(loi('Tuần này thầy cô hứa làm gì? Viết một câu.'), classId, week);
  if (noi_dung.length > 300) veWig(loi('Tối đa 300 ký tự.'), classId, week);
  const patch: {noi_dung: string; so_hua?: number} = {noi_dung};
  const soHuaRaw = formData.get('so_hua');
  if (soHuaRaw != null && String(soHuaRaw).trim() !== '') {
    const so_hua = Number(String(soHuaRaw).trim());
    if (!Number.isFinite(so_hua) || so_hua <= 0) veWig(loi('Con số của cam kết phải lớn hơn 0.'), classId, week);
    patch.so_hua = so_hua;
  }
  const supabase = await createClient();
  const {data, error} = await supabase.from('cam_ket').update(patch).eq('id', id).eq('student_id', me.id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0) veWig(loi('Không sửa được — cam kết đã chấm hoặc không có quyền.'), classId, week);
  veWig('Đã sửa cam kết', classId, week);
}

export async function xoaCamKetToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu cam kết.'), classId, week);
  const supabase = await createClient();
  const {data: ck} = await supabase.from('cam_ket').select('thuoc_id, ket_qua').eq('id', id).maybeSingle();
  if (ck?.ket_qua) veWig(loi('Cam kết đã chấm thì không xoá được — bỏ chấm trước.'), classId, week);
  // Xoá = đánh dấu 'huy' (như bản của em): biến mất khỏi màn, KHÔNG tự lăn sang tuần sau, không
  // tính trần 2/tuần. Xoá cứng dòng thì con lăn tuần (0177) thấy tuần trước còn hiệu lực sẽ nhân
  // bản lại — thành cam kết ma.
  const {data, error} = await supabase
    .from('cam_ket')
    .update({trang_thai: 'huy'})
    .eq('id', id)
    .eq('student_id', me.id)
    .select('id');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Không xoá được — cam kết đã chấm hoặc đã kể lại trong họp.'), classId, week);
  if (ck?.thuoc_id) await supabase.from('thuoc').delete().eq('id', ck.thuoc_id).eq('student_id', me.id);
  revalidatePath('/[locale]/wig', 'page');
  veWig('Đã xoá cam kết', classId, week);
}

// SỬA thước đo dẫn dắt cá nhân — tên/ngày/đích sửa thoải mái; đổi CÁCH ĐO hay ĐƠN VỊ khi đã có
// lượt thì trigger th_truoc_sua chặn (câu báo hiện nguyên). Cần 0184 để mở đông cứng chính chủ.
export async function suaThuocToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const thuoc_id = String(formData.get('thuoc_id') ?? '').trim();
  if (!thuoc_id) veWig(loi('Thiếu thước đo.'), classId, week);
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) veWig(loi('Thước đo dẫn dắt là việc gì? Viết một câu.'), classId, week);
  if (ten.length > 160) veWig(loi('Tối đa 160 ký tự.'), classId, week);
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  const ngayChon = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

  const supabase = await createClient();
  let patch: {ten: string; cach_ghi: string; don_vi_id?: string; chi_tieu_ky: number; moi_lan: number | null; ngay_ap_dung?: number[]};
  if (viecCach === 'dien_so') {
    const vdv = String(formData.get('viec_don_vi') ?? '').trim();
    const vdich = Number(String(formData.get('viec_dich') ?? '').trim());
    if (!Number.isFinite(vdich) || vdich <= 0) veWig(loi('Đích phải là số lớn hơn 0.'), classId, week);
    patch = {ten, cach_ghi: 'dien_so', chi_tieu_ky: vdich, moi_lan: null};
    if (vdv) patch.don_vi_id = vdv;
  } else {
    if (ngayChon.length === 0) veWig(loi('Chọn ít nhất một ngày để tick.'), classId, week);
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) veWig(loi('Thiếu đơn vị hệ thống (ngày/lần).'), classId, week);
    patch = {ten, cach_ghi: 'cham', don_vi_id: ngayId as string, chi_tieu_ky: ngayChon.length, moi_lan: 1, ngay_ap_dung: ngayChon};
  }
  const {data, error} = await supabase.from('thuoc').update(patch).eq('id', thuoc_id).eq('student_id', me.id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0) veWig(loi('Không sửa được — không có quyền với thước đo này.'), classId, week);
  veWig('Đã sửa thước đo dẫn dắt', classId, week);
}

// XOÁ thước đo cá nhân (trong hộp Sửa). th_truoc_xoa chặn khi đã có lượt — câu báo hiện nguyên.
export async function xoaThuocToi(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const thuoc_id = String(formData.get('thuoc_id') ?? '').trim();
  if (!thuoc_id) veWig(loi('Thiếu thước đo.'), classId, week);
  const supabase = await createClient();
  // FK cam_ket.thuoc_id là ON DELETE SET NULL — xoá thước là cam kết tự rời dây, không cần gỡ tay.
  const {data, error} = await supabase.from('thuoc').delete().eq('id', thuoc_id).eq('student_id', me.id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0) veWig(loi('Chỉ xoá được khi thước chưa ghi lần nào.'), classId, week);
  veWig('Đã xoá thước đo dẫn dắt', classId, week);
}

// ── NỐI / GỠ mục tiêu LỚP ↔ mục tiêu TRƯỜNG (hàm 0181 gác quyền + tự xử cùng-đơn-vị) ─────────
export async function noiWigTruong(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const con = String(formData.get('muc_tieu_id') ?? '').trim();
  const cha = String(formData.get('truong_id') ?? '').trim();
  if (!con || !cha) veWig(loi('Chọn mục tiêu trường để hướng tới đã nhé.'), classId, week);
  const supabase = await createClient();
  const {error} = await supabase.rpc('noi_wig_len_tren', {p_con: con, p_cha: cha});
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/truong', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  veWig('Đã nối vào mục tiêu của trường', classId, week);
}

export async function goWigTruong(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const con = String(formData.get('muc_tieu_id') ?? '').trim();
  const cha = String(formData.get('truong_id') ?? '').trim();
  if (!con || !cha) veWig(loi('Thiếu dây cần gỡ.'), classId, week);
  const supabase = await createClient();
  const {error} = await supabase.rpc('go_wig_len_tren', {p_con: con, p_cha: cha});
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/truong', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  veWig('Đã gỡ khỏi mục tiêu của trường', classId, week);
}

// ── DUYỆT / TRẢ LẠI mục tiêu của EM (chờ ở màn cô) ───────────────────────────────────────────
export async function duyetMucTieuEm(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu mục tiêu cần duyệt.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .eq('cap', 'em')
    .eq('trang_thai', 'gui')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Mục tiêu này không còn chờ duyệt.'), classId, week);
  veWig('Đã duyệt mục tiêu của em', classId, week);
}

export async function traLaiMucTieuEm(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!id) veWig(loi('Thiếu mục tiêu.'), classId, week);
  if (!note) veWig(loi('Trả lại thì ghi cho em một câu vì sao nhé.'), classId, week);
  if (note.length > 300) veWig(loi('Nhận xét tối đa 300 ký tự.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('cap', 'em')
    .eq('trang_thai', 'gui')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Mục tiêu này không còn chờ duyệt.'), classId, week);
  veWig('Đã trả lại kèm nhận xét cho em', classId, week);
}

// ── DUYỆT / TRẢ LẠI việc (thuoc) của em ──────────────────────────────────────────────────────
// Trạng thái duyệt của thước nằm ở cột `duyet` (gui/duyet/tra_lai), KHÁC với `trang_thai`
// (chay/tam_dung/dong). Việc `gui` vẫn ghi lượt được ngay — duyệt chỉ mở đường cho số CỘNG vào
// mục tiêu.
export async function duyetThuoc(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('thuoc_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu việc cần duyệt.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .update({duyet: 'duyet'})
    .eq('id', id)
    .eq('duyet', 'gui')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Việc này không còn chờ duyệt.'), classId, week);
  veWig('Đã duyệt việc của em', classId, week);
}

export async function traLaiThuoc(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('thuoc_id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!id) veWig(loi('Thiếu việc.'), classId, week);
  if (!note) veWig(loi('Trả lại thì ghi cho em một câu vì sao nhé.'), classId, week);
  if (note.length > 300) veWig(loi('Nhận xét tối đa 300 ký tự.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .update({duyet: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('duyet', 'gui')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Việc này không còn chờ duyệt.'), classId, week);
  veWig('Đã trả lại kèm nhận xét cho em', classId, week);
}

// ── DUYỆT LẠI khi hạ chỉ tiêu nhiều (thuoc_lich_su trạng thái 'cho_duyet' → 'hieu_luc') ───────
// GVCN tự duyệt lại (Q6): thước lớp hạ >30% hoặc hạ lần hai trong năm về chờ duyệt, hiện ở đây
// chứ không sang BGH.
export async function duyetHaChiTieu(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('lich_su_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu dòng cần duyệt.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .update({trang_thai: 'hieu_luc'})
    .eq('id', id)
    .eq('trang_thai', 'cho_duyet')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Dòng này không còn chờ duyệt.'), classId, week);
  veWig('Đã duyệt lại chỉ tiêu mới', classId, week);
}

// ── MẪU MỤC TIÊU cho các em (muc_tieu_mau ≤ 8) ───────────────────────────────────────────────
// Cô soạn sẵn để em chỉ điền số. Trần 8 do trigger; action lo câu đẹp khi RLS chặn.
export async function taoMau(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const class_id = classId ?? '';
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) veWig(loi('Đặt tên cho mẫu đã nhé.'), classId, week);
  const linh_vuc = String(formData.get('linh_vuc') ?? '').trim();
  const chieu = String(formData.get('chieu') ?? 'tang').trim();
  const xRaw = String(formData.get('x_goi_y') ?? '').trim();
  const yRaw = String(formData.get('y_goi_y') ?? '').trim();
  const x_goi_y = xRaw === '' ? null : Number(xRaw);
  const y_goi_y = yRaw === '' ? null : Number(yRaw);
  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu_mau')
    .insert({
      class_id,
      ten,
      linh_vuc: linh_vuc as never,
      chieu,
      x_goi_y: Number.isFinite(x_goi_y as number) ? x_goi_y : null,
      y_goi_y: Number.isFinite(y_goi_y as number) ? y_goi_y : null,
      don_vi_id,
    })
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Không lưu được mẫu — thầy cô không có quyền với lớp này.'), classId, week);
  veWig('Đã thêm mẫu mục tiêu', classId, week);
}

export async function xoaMau(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('mau_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu mẫu.'), classId, week);
  const supabase = await createClient();
  // Xoá mềm: mục tiêu các em đã đặt từ mẫu vẫn giữ (FK mau_id), chỉ ẩn mẫu khỏi danh sách.
  const {data, error} = await supabase
    .from('muc_tieu_mau')
    .update({is_active: false})
    .eq('id', id)
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Không xoá được mẫu — không có quyền hoặc đã xoá.'), classId, week);
  veWig('Đã xoá mẫu', classId, week);
}
