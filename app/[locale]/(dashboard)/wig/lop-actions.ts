'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {isValidDayVN, todayInVN, weekRangeVN} from '@/lib/dates';

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

// ── CHẤM CAM KẾT CỦA LỚP (Thắng/Thua) ────────────────────────────────────────────────────────
// Chỉ GVCN/admin — RLS gác; action chỉ lo câu báo. Nút đã mờ trước thứ Sáu tuần cuối; nếu vẫn
// gửi thì trigger 23514 văng câu "Đợi đến thứ Sáu tuần cuối rồi chấm nhé", hiện nguyên.
export async function chamCamKetLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu cam kết.'), classId, week);
  const ketQuaRaw = String(formData.get('ket_qua') ?? '').trim();
  const ket_qua = ketQuaRaw === 'thang' || ketQuaRaw === 'thua' ? ketQuaRaw : null;
  const soDatRaw = String(formData.get('so_dat') ?? '').trim();
  const so_dat = soDatRaw === '' ? null : Number(soDatRaw);
  if (so_dat !== null && (!Number.isFinite(so_dat) || so_dat < 0))
    veWig(loi('Số đạt được phải từ 0 trở lên.'), classId, week);

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update({ket_qua, so_dat: ket_qua === null ? null : so_dat})
    .eq('id', id)
    .eq('chu_the', 'lop')
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Chỉ thầy cô chủ nhiệm chấm cam kết của lớp.'), classId, week);
  veWig(
    ket_qua === null ? 'Đã bỏ chấm' : ket_qua === 'thang' ? 'Đã chấm Thắng' : 'Đã chấm Thua',
    classId,
    week,
  );
}

// ── ĐẶT CAM KẾT CỦA LỚP ──────────────────────────────────────────────────────────────────────
// Một lời hứa của cả lớp cho tuần đang xem. Trần 2/tuần và created_by/trang_thai do trigger
// ck_truoc_them đặt; action chỉ đặt nội dung.
export async function taoCamKetLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const class_id = classId ?? '';
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) veWig(loi('Tuần này cả lớp hứa làm gì? Viết một câu.'), classId, week);
  if (noi_dung.length > 300) veWig(loi('Tối đa 300 ký tự.'), classId, week);
  const soHuaRaw = String(formData.get('so_hua') ?? '').trim();
  const so_hua = soHuaRaw === '' ? null : Number(soHuaRaw);
  if (so_hua !== null && (!Number.isFinite(so_hua) || so_hua <= 0))
    veWig(loi('Con số của cam kết phải lớn hơn 0.'), classId, week);
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim() || null;
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tuan_bat_dau = isValidDayVN(tuanGui) ? tuanGui : weekRangeVN().start;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .insert({chu_the: 'lop', class_id, student_id: null, noi_dung, so_hua, muc_tieu_id, so_tuan: 1, tuan_bat_dau})
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data) veWig(loi('Không lưu được — thầy cô không có quyền với lớp này.'), classId, week);
  veWig('Đã lưu cam kết của lớp', classId, week);
}

export async function xoaCamKetLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const {classId, week} = nen(formData);
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) veWig(loi('Thiếu cam kết.'), classId, week);
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .delete()
    .eq('id', id)
    .eq('chu_the', 'lop')
    .select('id');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veWig(loi(friendlyError(error)), classId, week);
  if (!data || data.length === 0)
    veWig(loi('Không huỷ được — cam kết đã chấm hoặc không có quyền.'), classId, week);
  veWig('Đã huỷ cam kết của lớp', classId, week);
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
