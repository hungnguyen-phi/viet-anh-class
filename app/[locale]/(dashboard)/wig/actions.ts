'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {mondayOf, shiftWeeks, todayInVN} from '@/lib/dates';
import type {Database} from '@/lib/database.types';

type LinhVuc = Database['public']['Enums']['wig_domain'];

// ════════════════════════════════════════════════════════════════════════════
// MÔ HÌNH MỤC TIÊU (PA2). Màn cô /wig ghi vào ba bảng mới:
//   · muc_tieu   — mục tiêu (thay wigs). Cấp 'lop' cô tạo → gửi ban giám hiệu duyệt.
//   · thuoc      — việc của lớp (thay lead_measures). GVCN tạo là hiệu lực ngay (duyet_duoc_thuoc).
//   · cam_ket    — cam kết của lớp (thay commitments). Không có vòng duyệt; cô CHẤM Thắng/Thua.
// Luật quyền nằm ở RLS + trigger (docs/PA2/20-QUYEN). Action chỉ đọc FormData, ghi, và dịch lỗi
// sang tiếng người. Câu lỗi tầng action theo bảng 40-MAN-HINH §G.
// ════════════════════════════════════════════════════════════════════════════

// ── Đọc số mỏng ───────────────────────────────────────────────────────────────────────────────
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function str(formData: FormData, ten: string): string {
  return String(formData.get(ten) ?? '').trim();
}
function co(formData: FormData, ten: string): boolean {
  const v = str(formData, ten);
  return v === '1' || v === 'true' || v === 'on';
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
// Thứ Hai của tuần này / tuần sau, theo giờ VN. Chỉ tiêu mới của một việc chỉ có hiệu lực từ
// tuần sau (trigger thls_truoc_them đòi tu_tuan >= tuần sau) — nên suaChiTieu luôn dùng tuần sau.
function tuanNay(): string {
  return mondayOf(todayInVN());
}
function tuanSau(): string {
  return shiftWeeks(mondayOf(todayInVN()), 1);
}

// Giữ ?class= khi redirect để không nhảy về lớp mặc định; ?week= để giữ tuần đang xem.
function flashTo(msg: string, classId?: string, week?: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  if (week) q.set('week', week);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/wig?${q.toString()}`);
}
function weekOf(formData: FormData): string | undefined {
  return str(formData, 'week') || undefined;
}

// State cho useActionState → hiện lỗi/thành công INLINE, không redirect, giữ nguyên input.
// Client tự dọn ô controlled khi state.ok (bài học 31/08).
export type CreateWigState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
};
export type CamKetLopState = {ok: boolean; message?: string; error?: string; fieldError?: string};
export type DuyetState = {ok: boolean; error?: string};

const KHONG_QUYEN = 'Không lưu được — em không có quyền với lớp này.';

// ════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA LỚP — cô tạo, gửi ban giám hiệu duyệt.
// ════════════════════════════════════════════════════════════════════════════
//
// trang_thai = 'gui': trigger mt_truoc_them thấy người tạo (GVCN) KHÔNG duyệt được cấp lớp
// (duyet_duoc_chu_the='lop' chỉ đúng với ban giám hiệu) nên chỉ cho ở dạng 'nhap'/'gui'. Đây là
// "Gửi ban giám hiệu duyệt" (mucTieu.choBghDuyet). campus_id lấy theo lớp.
export async function taoWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id');
  const ten = str(formData, 'ten') || str(formData, 'title');
  const kieu_dich = str(formData, 'kieu_dich') || 'toi';
  const chieu = str(formData, 'chieu') || 'tang';
  const linh_vuc = str(formData, 'linh_vuc') || str(formData, 'area');
  const don_vi_id = str(formData, 'don_vi_id') || null;
  const nguon_so = str(formData, 'nguon_so') || 'ghi_tay';
  const ket_thuc = str(formData, 'ket_thuc');
  const chua_do_x = co(formData, 'chua_do_x');
  const x_so = num(formData.get('x_so'));
  const y_so = num(formData.get('y_so'));
  const y_chu = str(formData, 'y_chu') || null;
  const nhap = co(formData, 'luu_nhap');

  if (!class_id) return {ok: false, error: 'Chưa rõ mục tiêu này của lớp nào.'};
  if (!ten) return {ok: false, fieldError: 'ten', error: 'Hãy đặt tên cho mục tiêu của lớp.'};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: 'Tên mục tiêu tối đa 160 ký tự.'};
  if (!ket_thuc) return {ok: false, fieldError: 'ket_thuc', error: 'Chọn ngày hoàn thành mục tiêu.'};
  if (kieu_dich !== 'chu' && y_so === null)
    return {ok: false, fieldError: 'y_so', error: 'Nhập con số cần đạt (Đến …).'};
  if (kieu_dich === 'chu' && !y_chu)
    return {ok: false, fieldError: 'y_chu', error: 'Viết bằng lời điều lớp sẽ đạt được.'};
  if (kieu_dich !== 'chu' && kieu_dich !== 'ti_le_dat' && !don_vi_id)
    return {ok: false, fieldError: 'don_vi_id', error: 'Chọn đơn vị đo (điểm, buổi, %…).'};

  const supabase = await createClient();
  const {data: lop} = await supabase.from('classes').select('campus_id').eq('id', class_id).maybeSingle();
  if (!lop) return {ok: false, error: KHONG_QUYEN};

  const {data, error} = await supabase
    .from('muc_tieu')
    .insert({
      cap: 'lop',
      class_id,
      campus_id: lop.campus_id,
      ten,
      ket_thuc,
      kieu_dich,
      chieu,
      nguon_so,
      chua_do_x,
      linh_vuc: (linh_vuc || undefined) as LinhVuc | undefined,
      don_vi_id,
      x_so,
      y_so,
      y_chu,
      trang_thai: nhap ? 'nhap' : 'gui',
    })
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: KHONG_QUYEN};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: nhap ? 'Đã lưu nháp mục tiêu của lớp.' : 'Đã gửi ban giám hiệu duyệt.'};
}

// SỬA MỤC TIÊU (của lớp). Đổi nội dung khi cô không phải người duyệt-cấp thì trigger tự đưa về
// 'gui' (chờ ban giám hiệu duyệt lại) — action không phải lo, chỉ ghi.
export async function suaWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'muc_tieu_id') || str(formData, 'wig_id');
  const ten = str(formData, 'ten') || str(formData, 'title');
  const ket_thuc = str(formData, 'ket_thuc');
  const kieu_dich = str(formData, 'kieu_dich');
  const chua_do_x = co(formData, 'chua_do_x');
  const x_so = num(formData.get('x_so'));
  const y_so = num(formData.get('y_so'));
  const y_chu = str(formData, 'y_chu') || null;
  const linh_vuc = str(formData, 'linh_vuc') || str(formData, 'area');
  const don_vi_id = str(formData, 'don_vi_id') || null;

  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần sửa.'};
  if (!ten) return {ok: false, fieldError: 'ten', error: 'Hãy đặt tên cho mục tiêu.'};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: 'Tên mục tiêu tối đa 160 ký tự.'};

  const patch: Database['public']['Tables']['muc_tieu']['Update'] = {ten, chua_do_x};
  if (ket_thuc) patch.ket_thuc = ket_thuc;
  if (kieu_dich) patch.kieu_dich = kieu_dich;
  if (x_so !== null) patch.x_so = x_so;
  if (y_so !== null) patch.y_so = y_so;
  patch.y_chu = y_chu;
  if (linh_vuc) patch.linh_vuc = linh_vuc as LinhVuc;
  if (don_vi_id) patch.don_vi_id = don_vi_id;

  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').update(patch).eq('id', id).select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không sửa được mục tiêu này (không có quyền hoặc đã bị xoá).'};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã sửa “${ten}”.`};
}

// XOÁ MỤC TIÊU. RLS chỉ cho xoá khi còn ở dạng nhap/gui/tra_lai và chưa có số đo / dây / cam kết
// treo dưới — mục tiêu đang chạy thì đóng chứ không xoá.
export async function deleteWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id') || undefined;
  const week = weekOf(formData);
  const id = str(formData, 'muc_tieu_id') || str(formData, 'wig_id');
  if (!id) flashTo(loi('Thiếu mục tiêu cần xoá'), class_id, week);
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).select('id');
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]', 'page');
  if (error) flashTo(loi(friendlyError(error)), class_id, week);
  flashTo(
    (data ?? []).length > 0 ? 'Đã xoá mục tiêu' : loi('Không xoá được — mục tiêu đang chạy hoặc đã có dữ liệu.'),
    class_id,
    week,
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VIỆC CỦA LỚP (thuoc). GVCN tạo là hiệu lực ngay (trigger th_truoc_them đặt duyet='duyet').
// ════════════════════════════════════════════════════════════════════════════
export async function luuViec(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id');
  const nhom_id = str(formData, 'nhom_id') || null;
  const subject_id = str(formData, 'subject_id') || null;
  const ten = str(formData, 'ten') || str(formData, 'title');
  const don_vi_id = str(formData, 'don_vi_id') || null;
  const cach_ghi = str(formData, 'cach_ghi') || 'cham';
  const chieu_dich = str(formData, 'chieu_dich') || 'it_nhat';
  const gop = str(formData, 'gop') || 'tong';
  const pham_vi = str(formData, 'pham_vi') || 'tung_em';
  const chi_tieu_ky = num(formData.get('chi_tieu_ky'));
  const ky_tuan = num(formData.get('ky_tuan')) ?? 1;
  const moi_lan = num(formData.get('moi_lan'));
  const nguong_moi_lan = num(formData.get('nguong_moi_lan'));
  const cho_bu = co(formData, 'cho_bu');

  if (!class_id) return {ok: false, error: 'Chưa rõ việc này của lớp nào.'};
  if (!ten) return {ok: false, fieldError: 'ten', error: 'Hãy đặt tên cho việc của lớp.'};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: 'Tên việc tối đa 160 ký tự.'};
  if (!don_vi_id) return {ok: false, fieldError: 'don_vi_id', error: 'Chọn đơn vị đo cho việc này.'};
  if (chi_tieu_ky === null || chi_tieu_ky < 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: 'Chỉ tiêu phải là số từ 0 trở lên.'};
  if (cach_ghi === 'cham' && moi_lan === null)
    return {ok: false, fieldError: 'moi_lan', error: 'Mỗi lần chạm tính bao nhiêu?'};
  if (gop === 'dem_dat_nguong' && nguong_moi_lan === null)
    return {ok: false, fieldError: 'nguong_moi_lan', error: 'Nhập ngưỡng mỗi lần cần đạt.'};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .insert({
      chu_the: nhom_id ? 'nhom' : 'lop',
      class_id,
      nhom_id,
      subject_id,
      ten,
      don_vi_id,
      cach_ghi,
      nguon_he_thong: cach_ghi === 'he_thong' ? 'diem_danh' : null,
      chieu_dich,
      gop,
      pham_vi,
      chi_tieu_ky,
      ky_tuan,
      moi_lan,
      nguong_moi_lan,
      ngay_ap_dung: ngayApDung(formData),
      cho_bu,
      tu_tuan: tuanNay(),
    })
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: KHONG_QUYEN};

  // ĐẨY MỤC TIÊU NÀO: nối việc mới GÓP SỐ vào một mục tiêu lớp → mục tiêu tự cộng từ lượt tick.
  // Trigger noi_hop_le đòi mục tiêu ĐANG là nguon_so='thuoc' TRƯỚC khi nhận dây góp số — nên phải
  // bật 'thuoc' trước, rồi mới nối; nối hỏng thì hoàn nguyên. Dây hỏng không làm mất việc đã lưu.
  const day_muc_tieu = str(formData, 'day_muc_tieu');
  if (day_muc_tieu && data[0]?.id) {
    const {data: mtCu} = await supabase.from('muc_tieu').select('nguon_so').eq('id', day_muc_tieu).maybeSingle();
    if (mtCu?.nguon_so === 'ghi_tay') {
      await supabase.from('muc_tieu').update({nguon_so: 'thuoc'}).eq('id', day_muc_tieu).eq('nguon_so', 'ghi_tay');
    }
    const {error: eNoi} = await supabase.from('noi').insert({
      cha_id: day_muc_tieu,
      con_thuoc_id: data[0].id,
      vai: 'gop_so',
      he_so: 1,
      noi_tu_dong: false,
    });
    // Nối hỏng và mục tiêu vừa bị bật 'thuoc' (chưa có dây nào khác) → trả về ghi tay.
    if (eNoi && mtCu?.nguon_so === 'ghi_tay') {
      await supabase.from('muc_tieu').update({nguon_so: 'ghi_tay'}).eq('id', day_muc_tieu).eq('nguon_so', 'thuoc');
    }
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã thêm việc “${ten}”.`};
}

// XOÁ VIỆC CỦA LỚP. RLS chỉ cho xoá việc chưa từng duyệt và chưa có lượt — việc đã duyệt thì
// "Kết thúc từ tuần sau" (đặt den_tuan) chứ không xoá.
export async function xoaViecLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id') || undefined;
  const week = weekOf(formData);
  const id = str(formData, 'thuoc_id') || str(formData, 'lead_id');
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', id).select('id');
  if (error) flashTo(loi(friendlyError(error)), class_id, week);
  flashTo(
    (data ?? []).length > 0
      ? 'Đã xoá việc'
      : loi('Không xoá được — việc đã duyệt hoặc đã có lượt ghi. Hãy kết thúc từ tuần sau.'),
    class_id,
    week,
  );
}

// SỬA CHỈ TIÊU của một việc lớp (từ tuần sau) — đi qua thuoc_lich_su, KHÔNG sửa thẳng thuoc.
// Trigger thls_truoc_them: GVCN duyệt được việc nên dòng vào 'hieu_luc' ngay, áp dụng từ tuần sau.
export async function suaChiTieu(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  const me = await requireRole(['teacher', 'admin']);
  const thuoc_id = str(formData, 'thuoc_id');
  const chi_tieu_ky = num(formData.get('chi_tieu_ky'));
  const moi_lan = num(formData.get('moi_lan'));
  const ly_do = str(formData, 'ly_do') || null;

  if (!thuoc_id) return {ok: false, error: 'Thiếu việc cần đổi chỉ tiêu.'};
  if (chi_tieu_ky === null || chi_tieu_ky < 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: 'Chỉ tiêu phải là số từ 0 trở lên.'};

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
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: KHONG_QUYEN};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  const choDuyet = data[0]?.trang_thai === 'cho_duyet';
  return {
    ok: true,
    message: choDuyet ? 'Đã lưu, chờ duyệt lại vì hạ nhiều.' : 'Đã lưu chỉ tiêu mới, áp dụng từ tuần sau.',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CAM KẾT CỦA LỚP — không có vòng duyệt; cô đặt, cô CHẤM Thắng/Thua.
// ════════════════════════════════════════════════════════════════════════════
export async function datCamKetLop(_prev: CamKetLopState, formData: FormData): Promise<CamKetLopState> {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id');
  const noi_dung = str(formData, 'noi_dung') || str(formData, 'title');
  const so_tuan = num(formData.get('so_tuan')) ?? 1;
  const so_hua = num(formData.get('so_hua'));
  const don_vi_id = str(formData, 'don_vi_id') || null;
  const muc_tieu_id = str(formData, 'muc_tieu_id') || null;
  const thuoc_id = str(formData, 'thuoc_id') || null;
  const tuan_bat_dau = str(formData, 'tuan_bat_dau') || tuanNay();

  if (!class_id) return {ok: false, error: 'Chưa rõ cam kết này của lớp nào.'};
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: 'Tuần này lớp hứa làm gì?'};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: 'Cam kết tối đa 300 ký tự.'};
  if (so_tuan < 1 || so_tuan > 4)
    return {ok: false, fieldError: 'so_tuan', error: 'Cam kết kéo dài 1 đến 4 tuần.'};
  // Ràng buộc CSDL: có con số thì phải có đơn vị, và ngược lại.
  if (so_hua !== null && !don_vi_id)
    return {ok: false, fieldError: 'don_vi_id', error: 'Có con số thì chọn đơn vị đo.'};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .insert({
      chu_the: 'lop',
      class_id,
      noi_dung,
      tuan_bat_dau,
      so_tuan,
      so_hua,
      don_vi_id: so_hua !== null ? don_vi_id : null,
      muc_tieu_id,
      thuoc_id,
    })
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: KHONG_QUYEN};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true, message: 'Đã lưu cam kết của lớp.'};
}

// SỬA NỘI DUNG cam kết lớp. Trigger chặn khi đã chấm / đã kể lại trong buổi họp.
export async function suaCamKetLop(_prev: CamKetLopState, formData: FormData): Promise<CamKetLopState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'commitment_id') || str(formData, 'cam_ket_id');
  const noi_dung = str(formData, 'noi_dung') || str(formData, 'title');
  const so_hua = num(formData.get('so_hua'));
  const don_vi_id = str(formData, 'don_vi_id') || null;
  if (!id) return {ok: false, error: 'Thiếu cam kết cần sửa.'};
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: 'Cam kết không được để trống.'};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: 'Cam kết tối đa 300 ký tự.'};

  const patch: Database['public']['Tables']['cam_ket']['Update'] = {noi_dung};
  if (formData.has('so_hua')) {
    patch.so_hua = so_hua;
    patch.don_vi_id = so_hua !== null ? don_vi_id : null;
  }

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update(patch)
    .eq('id', id)
    .eq('chu_the', 'lop')
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0)
    return {ok: false, error: 'Không sửa được — cam kết đã chấm, đã kể lại, hoặc không còn.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true, message: 'Đã sửa cam kết.'};
}

// XOÁ / HUỶ cam kết lớp. RLS chỉ cho xoá khi chưa chấm, chưa kể lại, chưa ai xác nhận.
export async function xoaCamKetLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = str(formData, 'class_id') || undefined;
  const week = weekOf(formData);
  const id = str(formData, 'commitment_id') || str(formData, 'cam_ket_id');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .delete()
    .eq('id', id)
    .eq('chu_the', 'lop')
    .select('id');
  if (error) flashTo(loi(friendlyError(error)), class_id, week);
  flashTo(
    (data ?? []).length > 0 ? 'Đã xoá cam kết' : loi('Không xoá được — cam kết đã chấm hoặc đã kể lại.'),
    class_id,
    week,
  );
}

// CHẤM cam kết của lớp — chỉ GVCN/admin (trigger ck_truoc_sua). Trước thứ Sáu tuần cuối thì
// trigger văng 23514 "Đợi đến thứ Sáu tuần cuối rồi chấm nhé" (nút đã mờ sẵn phía màn).
export async function chamCamKetLop(_prev: CamKetLopState, formData: FormData): Promise<CamKetLopState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'commitment_id') || str(formData, 'cam_ket_id');
  const ket_qua = str(formData, 'ket_qua');
  const so_dat = num(formData.get('so_dat'));
  if (!id) return {ok: false, error: 'Thiếu cam kết cần chấm.'};
  if (ket_qua !== 'thang' && ket_qua !== 'thua')
    return {ok: false, error: 'Chọn Thắng hoặc Thua cho cam kết.'};

  const patch: Database['public']['Tables']['cam_ket']['Update'] = {ket_qua};
  if (so_dat !== null) patch.so_dat = so_dat;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update(patch)
    .eq('id', id)
    .eq('chu_the', 'lop')
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0)
    return {ok: false, error: 'Chỉ thầy cô chủ nhiệm chấm cam kết của lớp.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true, message: 'Đã chấm cam kết của lớp.'};
}

// ════════════════════════════════════════════════════════════════════════════
// CHỜ DUYỆT — cô duyệt mục tiêu của em (gui), việc của em (gui), và chỉ tiêu hạ (cho_duyet).
// Cam kết KHÔNG có ở đây (em tự hứa, tự chấm).
// ════════════════════════════════════════════════════════════════════════════

// DUYỆT mục tiêu của em. Nếu là mục tiêu cấp LỚP thì trigger từ chối "Mục tiêu của lớp do ban
// giám hiệu duyệt" — GVCN chỉ duyệt mục tiêu của em.
export async function duyetMucTieu(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'muc_tieu_id');
  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần duyệt.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}

export async function traLaiMucTieu(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'muc_tieu_id');
  const ly_do = str(formData, 'ly_do');
  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần trả lại.'};
  if (!ly_do) return {ok: false, error: 'Trả lại thì ghi lý do để em biết sửa gì.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'tra_lai', ly_do_tra_lai: ly_do})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}

// DUYỆT việc (thuoc) của em — GVCN/admin cho MỌI chủ thể của việc, kể cả việc môn (C11).
export async function duyetThuoc(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'thuoc_id');
  if (!id) return {ok: false, error: 'Thiếu việc cần duyệt.'};
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').update({duyet: 'duyet'}).eq('id', id).select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}

export async function traLaiThuoc(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'thuoc_id');
  const ly_do = str(formData, 'ly_do');
  if (!id) return {ok: false, error: 'Thiếu việc cần trả lại.'};
  if (!ly_do) return {ok: false, error: 'Trả lại thì ghi lý do để em biết sửa gì.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .update({duyet: 'tra_lai', ly_do_tra_lai: ly_do})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}

// DUYỆT / TRẢ LẠI dòng hạ chỉ tiêu (thuoc_lich_su cho_duyet). Trigger thls_truoc_sua đặt lại chữ
// ký và trả cờ duyet của việc về đúng chỗ khi hết dòng chờ.
export async function duyetChiTieu(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'lich_su_id') || str(formData, 'thls_id');
  if (!id) return {ok: false, error: 'Thiếu chỉ tiêu cần duyệt.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .update({trang_thai: 'hieu_luc'})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}

export async function traLaiChiTieu(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = str(formData, 'lich_su_id') || str(formData, 'thls_id');
  if (!id) return {ok: false, error: 'Thiếu chỉ tiêu cần trả lại.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .update({trang_thai: 'tu_choi'})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Bạn không chủ nhiệm lớp này.'};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  return {ok: true};
}
