'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {getCurrentProfile, requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {kieuDonVi} from '@/lib/don-vi';
import {AREAS} from '@/lib/areas';
import {weekRangeVN, nextWeekRangeVN, todayInVN, isValidDayVN, mondayOf} from '@/lib/dates';
import type {Database} from '@/lib/database.types';

// ════════════════════════════════════════════════════════════════════════════════════════════
// TẦNG GHI CỦA MÀN EM — mô hình mục tiêu PA2 (muc_tieu / thuoc / luot / cam_ket / so_do / noi).
//
// Mô hình cũ (wigs/lead_measures/lead_progress/commitments/wig_meetings/wig_so_do/
// student_reflections/buddy_messages) ĐÃ BỊ DROP. Tệp này viết lại từ đầu theo docs/PA2/:
//   · 20-QUYEN — policy + trigger (đâu là luật thật; action chỉ lo câu báo tiếng người)
//   · 40-MAN-HINH §G — bảng câu lỗi tầng action
//   · 10-SCHEMA §4 — tên cột + CHECK (giá trị enum dạng chuỗi)
//
// QUY ƯỚC: form useActionState trả STATE (câu lỗi trỏ đúng ô, giữ nguyên chữ đã gõ); nút bấm
// (duyệt/đóng/xoá/tick) redirect về trang em kèm flash. Sau mỗi lượt ghi, `.select()` để phân
// biệt "RLS chặn, 0 dòng" với "đã ghi" — nếu không, tuần đã khoá vẫn báo thành công.
//
// checkinMood → student/mood-actions.ts; các action yêu-cầu-sửa → student/yeu-cau-actions.ts.
// Ba action Sư Tử (refreshBuddyNote/toggleBuddyChat/sendBuddyMessage) đã gỡ hẳn theo [H-24].
// ════════════════════════════════════════════════════════════════════════════════════════════

type WigDomain = Database['public']['Enums']['wig_domain'];

// Về trang của MỘT em kèm thông báo (xanh = thành công, đỏ = lỗi qua tachLoi/loi).
function veTrangEm(studentId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/student/${studentId}?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// Cơ sở của một lớp — mọi dòng muc_tieu đều cần campus_id, mà form của em chỉ cầm class_id.
async function layCampus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
): Promise<string | null> {
  const {data} = await supabase.from('classes').select('campus_id').eq('id', classId).maybeSingle();
  return data?.campus_id ?? null;
}

// State chung cho các form useActionState của màn em.
export type FormState = {ok: boolean; message?: string; error?: string; fieldError?: string};
export type MucTieuState = FormState;
export type ViecState = FormState;
export type CamKetState = FormState;
export type DuyetState = {ok: boolean; error?: string};
export type LuotResult = {ok: boolean; error?: string};

// ════════════════════════════════════════════════════════════════════════════════════════════
// 1. MỤC TIÊU CỦA EM (muc_tieu, cap='em')
//
// Em gõ khoảng cách của CHÍNH EM ("điểm Toán 5,8 → 7,0 trước 31/12"). Vòng duyệt
// nhap → gui → duyet / tra_lai → dong nằm ở trang_thai; trigger mt_truoc_them/mt_truoc_sua
// (20 §3.2) là luật thật (trần 4, tập trung 2, "thầy cô không sửa nội dung của em"). Action chỉ
// đặt nội dung + trang_thai đích, để trigger kiểm và ký.
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function luuMucTieu(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};

  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  // cap='lop': GVCN đặt MỤC TIÊU CỦA LỚP (gửi BGH duyệt) — cùng form với màn em, khác chủ thể.
  const laLop = String(formData.get('cap') ?? 'em') === 'lop';
  const cap: 'em' | 'lop' = laLop ? 'lop' : 'em';
  const laChinhEm = !laLop && me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  if (laLop && !laNhanSu) return {ok: false, error: 'Chỉ thầy cô mới đặt mục tiêu cho lớp.'};
  if (!laLop && !laChinhEm && !laNhanSu) return {ok: false, error: 'Chỉ em mới ghi được phần này.'};

  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: 'Em muốn tiến bộ ở việc gì? Viết một câu.'};
  if (ten.length > 200) return {ok: false, fieldError: 'ten', error: 'Tối đa 200 ký tự.'};

  const linhVucRaw = String(formData.get('linh_vuc') ?? 'knowledge');
  const linh_vuc = ([...AREAS, 'khac'] as string[]).includes(linhVucRaw)
    ? (linhVucRaw as WigDomain)
    : ('knowledge' as WigDomain);

  const kieu_dich = String(formData.get('kieu_dich') ?? 'toi'); // toi/tran_tich_luy/giu/toc_do_ky/ti_le_dat/chu
  const chieu = String(formData.get('chieu') ?? 'tang'); // tang/giam/giu
  const ky = String(formData.get('ky') ?? '').trim() || null; // tuan/hai_tuan/thang
  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;
  const subject_id = String(formData.get('subject_id') ?? '').trim() || null;
  const chua_do_x = String(formData.get('chua_do_x') ?? '') === '1';

  const soHoac = (k: string): number | null => {
    const raw = String(formData.get(k) ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const x_so = soHoac('x_so');
  const y_so = soHoac('y_so');
  const x_chu = String(formData.get('x_chu') ?? '').trim() || null;
  const y_chu = String(formData.get('y_chu') ?? '').trim() || null;
  // Mô tả tự do (form SMART, 0170) — khuyến khích, không bắt buộc.
  const mo_ta = String(formData.get('mo_ta') ?? '').trim() || null;
  // "Hỗ trợ cho": id một mục tiêu của LỚP mà mục tiêu này góp hướng vào (dây `noi` vai chi_huong).
  const ho_tro_cho = String(formData.get('ho_tro_cho') ?? '').trim() || null;

  // LOẠI CỘT MỐC (0172): do_luong (X→Y, như cũ) · hanh_dong (0→100% một việc) · ke_hoach (các
  // bước cộng dồn 100%). Hai loại sau đo bằng % → ép về đích 0→100, đơn vị 'phan_tram', ghi tay
  // (với ke_hoach thì trigger buoc tự ghi số đo, em không nhập tay).
  const loaiMocRaw = String(formData.get('loai_moc') ?? 'do_luong');
  const loai_moc = ['do_luong', 'hanh_dong', 'ke_hoach'].includes(loaiMocRaw) ? loaiMocRaw : 'do_luong';
  const laPhanTram = loai_moc === 'hanh_dong' || loai_moc === 'ke_hoach';
  // Các bước của cột mốc kế hoạch — gửi kèm dạng JSON [{tieu_de,phan_tram,bat_dau,ket_thuc,mo_ta}].
  type BuocForm = {tieu_de: string; phan_tram: number; bat_dau?: string; ket_thuc?: string; mo_ta?: string};
  let cacBuoc: BuocForm[] = [];
  if (loai_moc === 'ke_hoach') {
    try {
      const arr = JSON.parse(String(formData.get('buoc_json') ?? '[]')) as BuocForm[];
      cacBuoc = (Array.isArray(arr) ? arr : [])
        .map((b) => ({
          tieu_de: String(b.tieu_de ?? '').trim(),
          phan_tram: Number(b.phan_tram) || 0,
          bat_dau: b.bat_dau && isValidDayVN(String(b.bat_dau)) ? String(b.bat_dau) : undefined,
          ket_thuc: b.ket_thuc && isValidDayVN(String(b.ket_thuc)) ? String(b.ket_thuc) : undefined,
          mo_ta: String(b.mo_ta ?? '').trim() || undefined,
        }))
        .filter((b) => b.tieu_de);
    } catch {
      cacBuoc = [];
    }
    if (cacBuoc.length < 1)
      return {ok: false, fieldError: 'buoc', error: 'Thêm ít nhất một bước cho kế hoạch.'};
    const tong = cacBuoc.reduce((s, b) => s + b.phan_tram, 0);
    if (Math.round(tong) !== 100)
      return {ok: false, fieldError: 'buoc', error: `Phần trăm các bước phải cộng đủ 100% (đang ${Math.round(tong)}%).`};
  }

  const ket_thuc = String(formData.get('ket_thuc') ?? '').trim();
  const bat_dau = String(formData.get('bat_dau') ?? '').trim();
  if (!isValidDayVN(ket_thuc))
    return {ok: false, fieldError: 'ket_thuc', error: 'Chọn ngày em muốn đạt được.'};
  if (bat_dau && isValidDayVN(bat_dau) && bat_dau > ket_thuc)
    return {ok: false, fieldError: 'bat_dau', error: 'Ngày bắt đầu phải trước ngày đạt.'};

  // Giá trị đo hiệu lực: hành động/kế hoạch ép về 0→100%; đo lường giữ như form.
  const eff_kieu_dich = laPhanTram ? 'toi' : kieu_dich;
  const eff_chieu = laPhanTram ? 'tang' : chieu;
  const eff_x = laPhanTram ? 0 : x_so;
  const eff_y = laPhanTram ? 100 : y_so;

  // Đích bằng lời (kieu='chu') cần y_chu; đích bằng số cần y_so. Đơn vị bắt buộc trừ chu/ti_le_dat.
  if (!laPhanTram) {
    if (kieu_dich === 'chu') {
      if (!y_chu) return {ok: false, fieldError: 'y_chu', error: 'Em sẽ đạt được gì? Viết bằng lời.'};
    } else {
      if (y_so === null || y_so <= 0)
        return {ok: false, fieldError: 'y_so', error: 'Đích phải là số lớn hơn 0.'};
      if (!don_vi_id) return {ok: false, fieldError: 'don_vi_id', error: 'Chọn đơn vị (điểm, bài, lần…).'};
    }
  }

  // Số này lấy từ đâu — với mục tiêu của EM chỉ hai đường: ĐẾM (máy cộng từ việc được nối vào →
  // 'thuoc') hoặc ĐO (em/thầy cô ghi tay → 'ghi_tay'). Hành động/kế hoạch luôn ghi_tay.
  const nguonSoRaw = String(formData.get('nguon_so') ?? '').trim();
  const nguon_so = laPhanTram ? 'ghi_tay' : nguonSoRaw === 'thuoc' || nguonSoRaw === 'ghi_tay' ? nguonSoRaw : 'ghi_tay';
  void kieuDonVi;

  const supabase = await createClient();

  // Đơn vị '%' cho hành động/kế hoạch (tra một lần, không cắm cứng UUID).
  let don_vi_pt: string | null = null;
  if (laPhanTram) {
    const {data: dv} = await supabase.from('don_vi').select('id').eq('ma', 'phan_tram').maybeSingle();
    don_vi_pt = dv?.id ?? null;
  }
  const eff_don_vi = laPhanTram ? don_vi_pt : don_vi_id;

  // Nội dung chung (dùng cho cả insert lẫn update). trang_thai đặt riêng theo nhánh.
  const noiDung = {
    ten,
    linh_vuc,
    subject_id,
    loai_moc,
    kieu_dich: eff_kieu_dich,
    chieu: eff_chieu,
    ky: laPhanTram ? null : ky,
    don_vi_id: eff_kieu_dich === 'chu' || eff_kieu_dich === 'ti_le_dat' ? null : eff_don_vi,
    x_so: eff_kieu_dich === 'chu' ? null : eff_x,
    y_so: eff_kieu_dich === 'chu' ? null : eff_y,
    x_chu: eff_kieu_dich === 'chu' ? x_chu : null,
    y_chu: eff_kieu_dich === 'chu' ? y_chu : null,
    chua_do_x: laPhanTram ? false : chua_do_x,
    ket_thuc,
    nguon_so,
    mo_ta,
    ly_do_tra_lai: null,
  };
  // "Lưu nháp" giữ ở nháp; mặc định gửi thầy cô duyệt.
  const trang_thai = String(formData.get('action') ?? 'gui') === 'nhap' ? 'nhap' : 'gui';

  let mtId = muc_tieu_id;
  if (muc_tieu_id) {
    // Sửa: KHÔNG đụng class_id/campus_id/student_id/cap (trigger chặn đổi lớp). Sửa nội dung tự
    // đưa mục tiêu về 'gui' qua trigger; ta vẫn nói rõ trang_thai đích để nhánh "lưu nháp" đúng.
    const {data, error} = await supabase
      .from('muc_tieu')
      .update({...noiDung, trang_thai})
      .eq('id', muc_tieu_id)
      .eq('cap', cap)
      .select('id');
    if (error) return {ok: false, error: friendlyError(error)};
    if (!data || data.length === 0)
      return {ok: false, error: 'Không lưu được — em không có quyền với lớp này.'};
  } else {
    const campus_id = await layCampus(supabase, class_id);
    if (!campus_id) return {ok: false, error: 'Không rõ lớp nên chưa lưu được.'};
    const {data, error} = await supabase
      .from('muc_tieu')
      .insert({
        cap,
        campus_id,
        class_id,
        student_id: laLop ? null : student_id,
        trang_thai,
        ...noiDung,
        bat_dau: isValidDayVN(bat_dau) ? bat_dau : todayInVN(),
      })
      .select('id')
      .maybeSingle();
    if (error) return {ok: false, error: friendlyError(error)};
    if (!data) return {ok: false, error: 'Không lưu được — em không có quyền với lớp này.'};
    mtId = data.id;
  }

  // CÁC BƯỚC của cột mốc kế hoạch — thay toàn bộ theo lần gửi này (giữ trạng thái "đã xong" của
  // bước cũ nếu tiêu đề trùng, để em sửa kế hoạch không mất tiến độ). Trigger buoc tự cập nhật %.
  if (mtId && loai_moc === 'ke_hoach') {
    const {data: cu} = await supabase
      .from('buoc')
      .select('tieu_de, xong_at')
      .eq('muc_tieu_id', mtId);
    const xongCu = new Map((cu ?? []).map((b) => [b.tieu_de, b.xong_at]));
    await supabase.from('buoc').delete().eq('muc_tieu_id', mtId);
    if (cacBuoc.length > 0) {
      await supabase.from('buoc').insert(
        cacBuoc.map((b, i) => ({
          muc_tieu_id: mtId as string,
          thu_tu: i,
          tieu_de: b.tieu_de,
          phan_tram: b.phan_tram,
          bat_dau: b.bat_dau ?? null,
          ket_thuc: b.ket_thuc ?? null,
          mo_ta: b.mo_ta ?? null,
          xong_at: xongCu.get(b.tieu_de) ?? null,
        })),
      );
    }
  }

  // DÂY "HỖ TRỢ CHO" — mục tiêu của em góp hướng vào một mục tiêu của LỚP (vai chi_huong).
  // Đồng bộ theo lựa chọn hiện tại: gỡ dây chi_huong cũ của mục tiêu này rồi nối lại nếu có chọn.
  // Không chặn luồng chính nếu lỗi (RLS/mục tiêu lớp không hợp lệ) — mục tiêu đã lưu là chính,
  // dây chỉ là liên kết phụ; nuốt lỗi có chủ ý và để em/thầy cô nối lại ở thẻ nếu cần.
  if (mtId) {
    await supabase
      .from('noi')
      .delete()
      .eq('con_loai', 'muc_tieu')
      .eq('con_id', mtId)
      .eq('vai', 'chi_huong');
    if (ho_tro_cho) {
      await supabase.from('noi').insert({
        cha_id: ho_tro_cho,
        con_muc_tieu_id: mtId, // con_loai/con_id là cột generated — tự suy từ đây
        vai: 'chi_huong',
      });
    }
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/campus', 'page');
  if (trang_thai === 'nhap') return {ok: true, message: 'Đã lưu nháp.'};
  if (laLop)
    return {
      ok: true,
      message: muc_tieu_id ? 'Sửa xong, mục tiêu lớp chờ Ban giám hiệu duyệt.' : 'Đã gửi Ban giám hiệu duyệt mục tiêu lớp.',
    };
  return {
    ok: true,
    message: laChinhEm
      ? muc_tieu_id
        ? 'Sửa xong, mục tiêu quay lại chờ thầy cô duyệt.'
        : 'Đã gửi thầy cô.'
      : 'Đã lưu mục tiêu cho em.',
  };
}

// Tập trung / thôi tập trung (tối đa 2 — trigger mt_kiem_tap_trung là luật thật).
export async function datTapTrung(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('muc_tieu_id') ?? '');
  const bat = String(formData.get('bat') ?? '') === '1';
  if (!id) veTrangEm(student_id, loi('Thiếu mục tiêu.'));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({dang_tap_trung: bat})
    .eq('id', id)
    .eq('cap', 'em')
    .select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không đổi được — không có quyền hoặc đã xoá.'));
  veTrangEm(student_id, bat ? 'Đang tập trung mục tiêu này' : 'Đã thôi tập trung');
}

// Đóng mục tiêu (ly_do_dong: dat/doi/bo — trigger đòi đúng ba giá trị ấy).
export async function dongMucTieu(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('muc_tieu_id') ?? '');
  const ly_do_dong = String(formData.get('ly_do_dong') ?? '');
  if (!id) veTrangEm(student_id, loi('Thiếu mục tiêu.'));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'dong', ly_do_dong})
    .eq('id', id)
    .eq('cap', 'em')
    .select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không đóng được — không có quyền hoặc đã xoá.'));
  veTrangEm(student_id, 'Đã đóng mục tiêu');
}

// Xoá mục tiêu — RLS chỉ cho khi nhap/gui/tra_lai VÀ chưa có số đo/dây/cam kết hiệu lực dưới nó.
export async function xoaMucTieu(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('muc_tieu_id') ?? '');
  if (!id) veTrangEm(student_id, loi('Thiếu mục tiêu.'));
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'em').select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0)
    veTrangEm(student_id, loi('Chỉ xoá được khi mục tiêu chưa có số nào ghi dưới nó.'));
  veTrangEm(student_id, 'Đã xoá mục tiêu');
}

// GVCN duyệt / trả lại mục tiêu của em (trigger mt_truoc_sua kiểm quyền + ký + kiểm trần).
export async function duyetMucTieu(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .eq('cap', 'em')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data) veTrangEm(student_id, loi('Mục tiêu này không còn nữa.'));
  veTrangEm(student_id, 'Đã duyệt mục tiêu của em');
}

export async function traLaiMucTieu(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!note) veTrangEm(student_id, loi('Trả lại thì ghi cho em một câu vì sao nhé.'));
  if (note.length > 300) veTrangEm(student_id, loi('Nhận xét tối đa 300 ký tự.'));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('cap', 'em')
    .eq('trang_thai', 'gui')
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data) veTrangEm(student_id, loi('Mục tiêu này không còn chờ duyệt.'));
  veTrangEm(student_id, 'Đã trả lại kèm nhận xét cho em');
}

// Duyệt mục tiêu KHÔNG nhảy trang (NutDuyet trên bảng /wig, useActionState).
export async function duyetMucTieuTraVe(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần duyệt.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .eq('cap', 'em')
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: 'Mục tiêu này không còn nữa.'};
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true};
}

// ── SỐ ĐO NGOÀI APP (so_do) ──────────────────────────────────────────────────────────────────
// Mục tiêu ĐO (nguon_so='ghi_tay'): cân nặng, điểm môn — máy không đếm được. Mỗi lần ghi là MỘT
// dòng mới (lịch sử giữ lại, số MỚI NHẤT là số thật — private.so_hien_tai đọc 'moi_nhat'). Luật
// ngày (không tương lai, không trước bat_dau) nằm ở trigger so_do_truoc_ghi.
export async function ghiSoDo(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '');
  if (!muc_tieu_id) return {ok: false, error: 'Không rõ đang ghi cho mục tiêu nào.'};
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (raw === '') return {ok: false, fieldError: 'gia_tri', error: 'Em điền số đã nhé.'};
  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0)
    return {ok: false, fieldError: 'gia_tri', error: 'Số phải từ 0 trở lên.'};
  const ngayGui = String(formData.get('ngay') ?? '').trim();
  const ngay = isValidDayVN(ngayGui) ? ngayGui : todayInVN();

  const supabase = await createClient();
  // student_id của dòng số đo = chủ mục tiêu (mục tiêu lớp/trường thì null).
  const {data: mt} = await supabase.from('muc_tieu').select('student_id').eq('id', muc_tieu_id).maybeSingle();

  const {data, error} = await supabase
    .from('so_do')
    .insert({
      muc_tieu_id,
      ngay,
      gia_tri,
      nguon: 'tay',
      nguoi_ghi: me.id,
      student_id: mt?.student_id ?? null,
    })
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không ghi được — em không có quyền với mục tiêu này.'};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: 'Đã ghi số.'};
}

// ── CỘT MỐC KẾ HOẠCH: đánh dấu MỘT BƯỚC xong/chưa xong ──────────────────────────────────────
// Chỉ đổi buoc.xong_at; trigger buoc_sau_ghi (0172) tự tính lại % rồi ghi vào so_do. RLS buoc_ghi
// bảo đảm chỉ chủ mục tiêu (em) ghi được. Không nhận số tay cho loại này — % là do bước quyết.
export async function datBuocXong(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return;
  const buoc_id = String(formData.get('buoc_id') ?? '');
  if (!buoc_id) return;
  const xong = String(formData.get('xong') ?? '') === '1';
  const supabase = await createClient();
  await supabase
    .from('buoc')
    .update({xong_at: xong ? new Date().toISOString() : null, xong_boi: xong ? me.id : null})
    .eq('id', buoc_id);
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
}

// ── CỘT MỐC HÀNH ĐỘNG: một nút "đã đạt" (0→100%) thay vì gõ số ───────────────────────────────
// Ghi một dòng so_do hôm nay = 100 (đạt) hoặc 0 (bỏ đạt). Cùng đường của ghiSoDo (nguon='tay',
// student_id = chủ mục tiêu) nên qua đúng trigger/RLS. so_hien_tai đọc dòng mới nhất.
export async function datHanhDong(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return;
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '');
  if (!muc_tieu_id) return;
  const dat = String(formData.get('dat') ?? '') === '1';
  const supabase = await createClient();
  const {data: mt} = await supabase.from('muc_tieu').select('student_id').eq('id', muc_tieu_id).maybeSingle();
  await supabase.from('so_do').insert({
    muc_tieu_id,
    ngay: todayInVN(),
    gia_tri: dat ? 100 : 0,
    nguon: 'tay',
    nguoi_ghi: me.id,
    student_id: mt?.student_id ?? null,
  });
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2. VIỆC EM LÀM (thuoc) + LƯỢT GHI (luot)
//
// "Việc" là thứ nhỏ em làm đều mỗi ngày. Trigger th_truoc_them (20 §3.3) đặt trang_thai='chay',
// duyet='gui', created_by, và kiểm trần ≤4 hàng/em. Việc `gui` của em VẪN ghi lượt được ngay
// (C107) — không ai phải chờ duyệt mới được làm việc tốt.
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function luuViec(_prev: ViecState, formData: FormData): Promise<ViecState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const laChinhEm = me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  if (!laChinhEm && !laNhanSu) return {ok: false, error: 'Chỉ em mới ghi được phần này.'};

  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: 'Em sẽ làm việc gì? Bắt đầu bằng một việc làm.'};
  if (ten.length > 200) return {ok: false, fieldError: 'ten', error: 'Tối đa 200 ký tự.'};

  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim();
  if (!don_vi_id) return {ok: false, fieldError: 'don_vi_id', error: 'Chọn đơn vị em đong đếm việc này.'};

  const cach_ghi = String(formData.get('cach_ghi') ?? 'cham'); // cham/dien_so/he_thong
  const chieu_dich = String(formData.get('chieu_dich') ?? 'it_nhat'); // it_nhat/nhieu_nhat
  const gop = String(formData.get('gop') ?? 'tong'); // tong/moi_nhat/dem_dat_nguong
  const kyTuanRaw = Number(String(formData.get('ky_tuan') ?? '1'));
  const ky_tuan = [1, 2, 4].includes(kyTuanRaw) ? kyTuanRaw : 1;
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: `Bao nhiêu là đủ mỗi ${ky_tuan === 1 ? 'tuần' : ky_tuan + ' tuần'}?`};

  const moiLan = Number(String(formData.get('moi_lan') ?? '').trim());
  const moi_lan = cach_ghi === 'cham' ? (Number.isFinite(moiLan) && moiLan > 0 ? moiLan : 1) : null;
  const nguongRaw = Number(String(formData.get('nguong_moi_lan') ?? '').trim());
  const nguong_moi_lan = gop === 'dem_dat_nguong' && Number.isFinite(nguongRaw) ? nguongRaw : null;
  const cho_bu = String(formData.get('cho_bu') ?? '') === '1';

  // Những ngày trong tuần em làm (1=Thứ Hai … 7=Chủ nhật).
  const ngay_ap_dung = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  if (cach_ghi !== 'he_thong' && ngay_ap_dung.length === 0)
    return {ok: false, fieldError: 'ngay', error: 'Em chọn ít nhất một ngày trong tuần cho việc ấy nhé.'};

  const tuTuan = String(formData.get('tu_tuan') ?? 'nay');
  const tu_tuan = tuTuan === 'sau' ? nextWeekRangeVN().start : weekRangeVN().start;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc')
    .insert({
      chu_the: 'em',
      class_id,
      student_id,
      ten,
      don_vi_id,
      cach_ghi,
      chieu_dich,
      gop,
      ky_tuan,
      chi_tieu_ky,
      moi_lan,
      nguong_moi_lan,
      ngay_ap_dung,
      cho_bu,
      pham_vi: 'tung_em',
      tu_tuan,
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: 'Không lưu được — em không có quyền với lớp này.'};

  // Nối việc vào một mục tiêu (không bắt buộc). Cùng đơn vị thì cộng số (gop_so); khác thì chỉ
  // hướng (chi_huong) — form quyết. Dây hỏng KHÔNG làm mất việc đã lưu.
  const giup_muc_tieu = String(formData.get('giup_muc_tieu') ?? '').trim();
  if (giup_muc_tieu) {
    const vai = String(formData.get('cong_vao') ?? '') === '1' ? 'gop_so' : 'chi_huong';
    const he_so = Number(String(formData.get('he_so') ?? '1').trim());
    const {error: eNoi} = await supabase.from('noi').insert({
      cha_id: giup_muc_tieu,
      con_thuoc_id: data.id,
      vai,
      he_so: Number.isFinite(he_so) && he_so > 0 ? he_so : 1,
      noi_tu_dong: false,
      created_by: me.id,
    });
    if (eNoi) return {ok: false, error: `Việc đã lưu, nhưng chưa nối vào mục tiêu được: ${friendlyError(eNoi)}`};
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: 'Đã gửi thầy cô. Em ghi được ngay từ hôm nay.'};
}

// Đổi chỉ tiêu từ TUẦN SAU (thuoc_lich_su). Trigger thls_truoc_them quyết định hiệu lực ngay hay
// về chờ duyệt (hạ >30% hoặc hạ lần hai trong năm → cho_duyet + thuoc.duyet='gui').
export async function suaChiTieu(_prev: ViecState, formData: FormData): Promise<ViecState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) return {ok: false, error: 'Thiếu việc cần sửa.'};
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: 'Chỉ tiêu mới phải là số lớn hơn 0.'};
  const ly_do = String(formData.get('ly_do') ?? '').trim() || null;
  const moiLan = Number(String(formData.get('moi_lan') ?? '').trim());
  const moi_lan = Number.isFinite(moiLan) && moiLan > 0 ? moiLan : null;
  const ngay_ap_dung = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('thuoc_lich_su')
    .insert({
      thuoc_id,
      tu_tuan: nextWeekRangeVN().start,
      chi_tieu_ky,
      moi_lan,
      ngay_ap_dung: ngay_ap_dung.length ? ngay_ap_dung : null,
      ly_do,
    })
    .select('trang_thai')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: 'Không lưu được — em không có quyền với việc này.'};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {
    ok: true,
    message:
      data.trang_thai === 'cho_duyet'
        ? 'Đã lưu, chờ duyệt lại vì hạ nhiều.'
        : 'Đã lưu chỉ tiêu mới, áp dụng từ tuần sau.',
  };
}

// Tạm dừng / chạy lại / kết thúc việc (từ tuần sau). Trigger th_truoc_sua kiểm quyền.
export async function doiTrangThaiViec(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  const viec = String(formData.get('viec') ?? ''); // tam_dung | chay | ket_thuc
  if (!thuoc_id) veTrangEm(student_id, loi('Thiếu việc.'));
  const supabase = await createClient();
  const patch =
    viec === 'ket_thuc'
      ? {den_tuan: nextWeekRangeVN().start}
      : viec === 'tam_dung'
        ? {trang_thai: 'tam_dung'}
        : {trang_thai: 'chay'};
  const {data, error} = await supabase.from('thuoc').update(patch).eq('id', thuoc_id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không đổi được — không có quyền hoặc đã xoá.'));
  veTrangEm(
    student_id,
    viec === 'ket_thuc'
      ? 'Việc sẽ kết thúc từ tuần sau'
      : viec === 'tam_dung'
        ? 'Đã tạm dừng việc'
        : 'Đã cho việc chạy lại',
  );
}

// Xoá việc — RLS chỉ cho khi chưa từng duyệt và chưa có lượt ghi.
export async function xoaViec(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) veTrangEm(student_id, loi('Thiếu việc.'));
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', thuoc_id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0)
    veTrangEm(student_id, loi('Chỉ xoá được khi việc chưa ghi lần nào.'));
  veTrangEm(student_id, 'Đã xoá việc');
}

// ── GHI LƯỢT ─────────────────────────────────────────────────────────────────────────────────
//
// EM tự ghi: cửa sổ 7 ngày + khoá chữ ký (rls_em_ghi_luot). "Một con số cho một ngày": xoá dòng
// tay của ngày ấy rồi ghi lại. giaTri < 0 = xoá trắng ngày (nút Bớt về 0); giaTri = 0 là MỘT dòng
// thật (việc kiêng: giữ được ≠ chưa ghi). Cửa sổ kiểm sớm ở TS để câu báo đúng chỗ; RLS là chốt.
async function ghiLuotChung(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {thuocId: string; studentId: string; ngay: string; giaTri: number; nguoiGhi: string},
): Promise<LuotResult> {
  const {thuocId, studentId, ngay, giaTri, nguoiGhi} = args;
  await supabase
    .from('luot')
    .delete()
    .eq('thuoc_id', thuocId)
    .eq('student_id', studentId)
    .eq('ngay', ngay)
    .eq('nguon', 'tay');
  if (giaTri < 0) {
    revalidatePath('/[locale]/student', 'page');
    revalidatePath('/[locale]/student/[id]', 'page');
    return {ok: true};
  }
  const {data, error} = await supabase
    .from('luot')
    .insert({thuoc_id: thuocId, student_id: studentId, ngay, gia_tri: giaTri, nguon: 'tay', nguoi_ghi: nguoiGhi})
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0) return {ok: false, error: 'Không ghi được — thử lại nhé.'};
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true};
}

export async function ghiLuot(thuocId: string, ngay: string, giaTri: number): Promise<LuotResult> {
  const me = await getCurrentProfile();
  if (!me || me.role !== 'student') return {ok: false, error: 'Chỉ em mới ghi được phần này.'};
  if (!thuocId || !isValidDayVN(ngay)) return {ok: false, error: 'Thiếu việc hoặc ngày.'};
  // Cửa sổ 7 ngày (hôm nay lùi 6 ngày là ngày sớm nhất). Ngoài cửa sổ → nhờ thầy cô ghi giúp.
  const today = todayInVN();
  const cachNgay = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ngay}T00:00:00Z`)) / 86_400_000,
  );
  if (cachNgay > 6 || cachNgay < 0)
    return {ok: false, error: 'Chỉ ghi được trong 7 ngày gần nhất — nhờ thầy cô ghi giúp.'};

  const supabase = await createClient();
  const res = await ghiLuotChung(supabase, {thuocId, studentId: me.id, ngay, giaTri, nguoiGhi: me.id});
  // Trong cửa sổ mà vẫn bị chặn → gần như chắc là tuần đã ký (luot_bi_khoa).
  if (!res.ok && res.error) return {ok: false, error: 'Ngày này đã khoá sau buổi họp với bạn.'};
  return res;
}

// THẦY CÔ ghi bù cho em (mọi lớp — C25): không vướng cửa sổ 7 ngày, vẫn không vượt chữ ký.
export async function ghiBuLuot(
  thuocId: string,
  studentId: string,
  ngay: string,
  giaTri: number,
): Promise<LuotResult> {
  const me = await requireRole(['teacher', 'admin']);
  if (!thuocId || !studentId || !isValidDayVN(ngay)) return {ok: false, error: 'Thiếu việc, em hoặc ngày.'};
  const supabase = await createClient();
  const res = await ghiLuotChung(supabase, {thuocId, studentId, ngay, giaTri, nguoiGhi: me.id});
  if (!res.ok && res.error)
    return {ok: false, error: 'Tuần này em đã ghi nhận buổi họp — mở lại qua yêu cầu sửa có lưu vết.'};
  return res;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 3. CAM KẾT TUẦN (cam_ket) — KHÔNG có vòng duyệt; em tự chấm Thắng/Thua
//
// Trigger ck_truoc_them (20 §3.4) đặt created_by, trang_thai='hieu_luc', xoá sạch phần chấm, và
// kiểm trần 2/tuần (đếm theo TỪNG tuần). ck_truoc_sua kiểm luật "chấm từ thứ Sáu tuần cuối",
// ký gợi ý lúc chấm, và "em tự chấm cam kết của mình".
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function luuCamKet(_prev: CamKetState, formData: FormData): Promise<CamKetState> {
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: 'Chưa đăng nhập.'};
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const laChinhEm = me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  if (!laChinhEm && !laNhanSu) return {ok: false, error: 'Chỉ em mới ghi được phần này.'};

  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: 'Tuần này em hứa làm gì? Viết một câu.'};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: 'Tối đa 300 ký tự.'};

  const soTuanRaw = Number(String(formData.get('so_tuan') ?? '1'));
  const so_tuan = [1, 2, 3, 4].includes(soTuanRaw) ? soTuanRaw : 1;

  const khi = String(formData.get('khi') ?? 'nay');
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tuan_bat_dau = isValidDayVN(tuanGui)
    ? mondayOf(tuanGui)
    : khi === 'sau'
      ? nextWeekRangeVN().start
      : weekRangeVN().start;

  const soHuaRaw = String(formData.get('so_hua') ?? '').trim();
  const so_hua = soHuaRaw === '' ? null : Number(soHuaRaw);
  if (so_hua !== null && (!Number.isFinite(so_hua) || so_hua <= 0))
    return {ok: false, fieldError: 'so_hua', error: 'Con số của cam kết phải lớn hơn 0.'};
  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim() || null;
  const thuoc_id = String(formData.get('thuoc_id') ?? '').trim() || null;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .insert({
      chu_the: 'em',
      class_id,
      student_id,
      noi_dung,
      so_hua,
      don_vi_id,
      so_tuan,
      tuan_bat_dau,
      muc_tieu_id,
      thuoc_id,
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: 'Không lưu được — em không có quyền với lớp này.'};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: 'Đã lưu cam kết.'};
}

// Em tự chấm Thắng/Thua (ket_qua rỗng = bỏ chấm). Nút đã mờ trước thứ Sáu; nếu vẫn gửi thì
// trigger văng 23514 "Đợi đến thứ Sáu tuần cuối rồi chấm nhé" — action hiện nguyên câu.
export async function chamCamKet(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('cam_ket_id') ?? '');
  const ketQuaRaw = String(formData.get('ket_qua') ?? '').trim();
  if (!id) veTrangEm(student_id, loi('Thiếu cam kết.'));
  const ket_qua = ketQuaRaw === 'thang' || ketQuaRaw === 'thua' ? ketQuaRaw : null;
  const soDatRaw = String(formData.get('so_dat') ?? '').trim();
  const so_dat = soDatRaw === '' ? null : Number(soDatRaw);
  if (so_dat !== null && (!Number.isFinite(so_dat) || so_dat < 0))
    veTrangEm(student_id, loi('Số đạt được phải từ 0 trở lên.'));

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update({ket_qua, so_dat: ket_qua === null ? null : so_dat})
    .eq('id', id)
    .select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không chấm được — không có quyền hoặc đã xoá.'));
  veTrangEm(student_id, ket_qua === null ? 'Đã bỏ chấm' : ket_qua === 'thang' ? 'Đã chấm Thắng' : 'Đã chấm Thua');
}

// Huỷ cam kết — RLS chỉ cho khi chưa chấm, chưa kể lại trong họp, chưa ai xác nhận.
export async function xoaCamKet(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('cam_ket_id') ?? '');
  if (!id) veTrangEm(student_id, loi('Thiếu cam kết.'));
  const supabase = await createClient();
  const {data, error} = await supabase.from('cam_ket').delete().eq('id', id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0)
    veTrangEm(student_id, loi('Không huỷ được — cam kết đã chấm hoặc đã kể lại trong buổi họp.'));
  veTrangEm(student_id, 'Đã huỷ cam kết');
}

// Người chứng xác nhận cam kết (buddy / thầy cô / phụ huynh). Trigger ckxn_dung_vai đặt nguoi_id
// = uid và SUY vai từ quan hệ — không tin cột `vai` gửi lên (đặt tạm 'buddy' để qua kiểu TS).
export async function xacNhanCamKet(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const cam_ket_id = String(formData.get('cam_ket_id') ?? '');
  const y_kien = String(formData.get('y_kien') ?? '').trim() || null;
  const dong_y = String(formData.get('dong_y') ?? '1') !== '0';
  if (!cam_ket_id) veTrangEm(student_id, loi('Thiếu cam kết.'));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket_xac_nhan')
    .insert({cam_ket_id, y_kien, dong_y, vai: 'buddy'})
    .select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không xác nhận được — không có quyền.'));
  veTrangEm(student_id, 'Đã xác nhận cam kết');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 4. DÂY NỐI (noi) — em tự nối việc/mục tiêu của mình HƯỚNG lên mục tiêu lớp (chi_huong).
//
// gop_so lên lớp/trường chỉ thầy cô/BGH; em chỉ gop_so lên mục tiêu CỦA CHÍNH EM. Dây không sửa
// tại chỗ — gỡ rồi nối lại (không có policy UPDATE). Máy tự nối đi đường trigger riêng, không qua
// đây.
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function noiNguon(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const cha_id = String(formData.get('cha_id') ?? '');
  const con_muc_tieu_id = String(formData.get('con_muc_tieu_id') ?? '').trim() || null;
  const con_thuoc_id = String(formData.get('con_thuoc_id') ?? '').trim() || null;
  const vai = String(formData.get('vai') ?? 'chi_huong') === 'gop_so' ? 'gop_so' : 'chi_huong';
  const heSo = Number(String(formData.get('he_so') ?? '1').trim());
  if (!cha_id || (!con_muc_tieu_id && !con_thuoc_id)) veTrangEm(student_id, loi('Thiếu nguồn hoặc mục tiêu cha.'));
  const supabase = await createClient();
  // NỐI GÓP SỐ TỪ MỘT VIỆC → mục tiêu tự cộng từ lượt tick. Trigger noi_hop_le đòi mục tiêu ĐANG
  // là nguon_so='thuoc' TRƯỚC khi nhận dây góp số, nên bật 'thuoc' trước rồi mới nối; nối hỏng thì
  // hoàn nguyên. Không đụng 'thanh_phan'/'he_thong'. RLS gác: chỉ chủ mục tiêu đổi được.
  const bumThuoc = vai === 'gop_so' && !!con_thuoc_id;
  let daBat = false;
  if (bumThuoc) {
    const {data: mtCu} = await supabase.from('muc_tieu').select('nguon_so').eq('id', cha_id).maybeSingle();
    if (mtCu?.nguon_so === 'ghi_tay') {
      await supabase.from('muc_tieu').update({nguon_so: 'thuoc'}).eq('id', cha_id).eq('nguon_so', 'ghi_tay');
      daBat = true;
    }
  }
  const {data, error} = await supabase
    .from('noi')
    .insert({
      cha_id,
      con_muc_tieu_id,
      con_thuoc_id,
      vai,
      he_so: Number.isFinite(heSo) && heSo > 0 ? heSo : 1,
      noi_tu_dong: false,
      created_by: me.id,
    })
    .select('id');
  if (error && daBat) {
    await supabase.from('muc_tieu').update({nguon_so: 'ghi_tay'}).eq('id', cha_id).eq('nguon_so', 'thuoc');
  }
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không nối được — không có quyền.'));
  veTrangEm(student_id, vai === 'gop_so' ? 'Đã nối — mục tiêu sẽ tự cộng từ việc này' : 'Đã nối hướng tới mục tiêu');
}

export async function goNguon(formData: FormData) {
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('noi_id') ?? '');
  if (!id) veTrangEm(student_id, loi('Thiếu dây cần gỡ.'));
  const supabase = await createClient();
  // Nhớ dây này thuộc mục tiêu nào + có phải góp-số-từ-việc không, để hoàn nguyên nguon_so sau khi gỡ.
  const {data: truoc} = await supabase.from('noi').select('cha_id, vai, con_thuoc_id').eq('id', id).maybeSingle();
  const {data, error} = await supabase.from('noi').delete().eq('id', id).select('id');
  // Gỡ dây góp số cuối cùng của một mục tiêu → trả về ghi tay (không còn việc nào để cộng).
  if (!error && data && data.length > 0 && truoc?.vai === 'gop_so' && truoc?.con_thuoc_id && truoc?.cha_id) {
    const {count} = await supabase
      .from('noi')
      .select('id', {count: 'exact', head: true})
      .eq('cha_id', truoc.cha_id)
      .eq('vai', 'gop_so')
      .not('con_thuoc_id', 'is', null);
    if (!count) await supabase.from('muc_tieu').update({nguon_so: 'ghi_tay'}).eq('id', truoc.cha_id).eq('nguon_so', 'thuoc');
  }
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi('Không gỡ được — không có quyền hoặc đã gỡ.'));
  veTrangEm(student_id, 'Đã gỡ dây');
}
