'use server';

import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {timHoacTaoDonVi} from '@/lib/don-vi-server';
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
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};

  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  // cap='lop': GVCN đặt MỤC TIÊU CỦA LỚP (gửi BGH duyệt) — cùng form với màn em, khác chủ thể.
  // cap='truong': admin/BGH đặt MỤC TIÊU CỦA TRƯỜNG (campus_id thay class_id).
  const capRaw = String(formData.get('cap') ?? 'em');
  const cap: 'em' | 'lop' | 'truong' = capRaw === 'lop' ? 'lop' : capRaw === 'truong' ? 'truong' : 'em';
  const laLop = cap === 'lop';
  const laTruong = cap === 'truong';
  const laChinhEm = cap === 'em' && me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  // Thầy cô đặt mục tiêu CÁ NHÂN của chính mình (0181) — cũng cap='em', student_id = thầy cô.
  const laToiGv = cap === 'em' && me.id === student_id && laNhanSu;
  if (laLop && !laNhanSu) return {ok: false, error: t('chiThayCoMoiDatMuc')};
  if (laTruong && !(me.role === 'admin' || me.role === 'principal'))
    return {ok: false, error: t('chiBanGiamHieuMoiDat')};
  if (cap === 'em' && !laChinhEm && !laNhanSu) return {ok: false, error: t('chiEmMoiGhiDuocPhan')};

  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('emMuonTienBoOViec')};
  if (ten.length > 200) return {ok: false, fieldError: 'ten', error: t('toiDa200KyTu')};

  const linhVucRaw = String(formData.get('linh_vuc') ?? 'knowledge');
  const linh_vuc = ([...AREAS, 'khac'] as string[]).includes(linhVucRaw)
    ? (linhVucRaw as WigDomain)
    : ('knowledge' as WigDomain);

  const kieu_dich = String(formData.get('kieu_dich') ?? 'toi'); // toi/tran_tich_luy/giu/toc_do_ky/ti_le_dat/chu
  const chieu = String(formData.get('chieu') ?? 'tang'); // tang/giam/giu
  const ky = String(formData.get('ky') ?? '').trim() || null; // tuan/hai_tuan/thang
  let don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;
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
  // 04/09: người lớn (tôi/lớp) phải chọn hướng lên cấp trên khi cấp trên có mục tiêu — form gửi
  // cờ ho_tro_bat_buoc='1' đúng trong trường hợp ấy.
  if (String(formData.get('ho_tro_bat_buoc') ?? '') === '1' && !ho_tro_cho) {
    return {ok: false, fieldError: 'ho_tro_cho', error: t('chonMucTieuCapTrenDe')};
  }

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
      return {ok: false, fieldError: 'buoc', error: t('themItNhatMotBuocCho')};
    const tong = cacBuoc.reduce((s, b) => s + b.phan_tram, 0);
    if (Math.round(tong) !== 100)
      return {ok: false, fieldError: 'buoc', error: t('phanTramBuoc', {dang: Math.round(tong)})};
  }

  const ket_thuc = String(formData.get('ket_thuc') ?? '').trim();
  const bat_dau = String(formData.get('bat_dau') ?? '').trim();
  if (!isValidDayVN(ket_thuc))
    return {ok: false, fieldError: 'ket_thuc', error: t('chonNgayEmMuonDatDuoc')};
  if (bat_dau && isValidDayVN(bat_dau) && bat_dau > ket_thuc)
    return {ok: false, fieldError: 'bat_dau', error: t('ngayBatDauPhaiTruocNgay')};

  // Số này lấy từ đâu — với mục tiêu của EM chỉ hai đường: ĐẾM (máy cộng từ việc được nối vào →
  // 'thuoc') hoặc ĐO (em/thầy cô ghi tay → 'ghi_tay'). Hành động/kế hoạch luôn ghi_tay.
  // 0193: mục tiêu LỚP/TRƯỜNG có thêm 'dem_em' — % số em đạt mục tiêu của mình ("95% học sinh
  // đạt mục tiêu cá nhân", kiểu lớp hay đặt nhất). Máy đếm qua dây nối, đơn vị ép '%', 0 → y.
  const nguonSoRaw = String(formData.get('nguon_so') ?? '').trim();
  const laDemEm = !laPhanTram && nguonSoRaw === 'dem_em' && (laLop || laTruong);
  const nguon_so = laPhanTram ? 'ghi_tay' : laDemEm ? 'dem_em' : nguonSoRaw === 'thuoc' || nguonSoRaw === 'ghi_tay' ? nguonSoRaw : 'ghi_tay';
  void kieuDonVi;

  // Giá trị đo hiệu lực: hành động/kế hoạch ép về 0→100%; đếm em ép 0→y%; đo lường giữ như form.
  const eff_kieu_dich = laPhanTram || laDemEm ? 'toi' : kieu_dich;
  const eff_chieu = laPhanTram || laDemEm ? 'tang' : chieu;
  const eff_x = laPhanTram || laDemEm ? 0 : x_so;
  const eff_y = laPhanTram ? 100 : y_so;

  // Đích bằng lời (kieu='chu') cần y_chu; đích bằng số cần y_so. Đơn vị bắt buộc trừ chu/ti_le_dat.
  if (laDemEm) {
    if (y_so === null || y_so <= 0 || y_so > 100)
      return {ok: false, fieldError: 'y_so', error: t('demEmDichPhanTram')};
  } else if (!laPhanTram) {
    if (kieu_dich === 'chu') {
      if (!y_chu) return {ok: false, fieldError: 'y_chu', error: t('emSeDatDuocGiViet')};
    } else {
      if (y_so === null || y_so <= 0)
        return {ok: false, fieldError: 'y_so', error: t('dichPhaiLaSoLonHon')};
      if (!don_vi_id) return {ok: false, fieldError: 'don_vi_id', error: t('chonDonViDiemBaiLan')};
    }
  }

  const supabase = await createClient();

  // Đơn vị '%' cho hành động/kế hoạch/đếm em (tra một lần, không cắm cứng UUID).
  let don_vi_pt: string | null = null;
  if (laPhanTram || laDemEm) {
    const {data: dv} = await supabase.from('don_vi').select('id').eq('ma', 'phan_tram').maybeSingle();
    don_vi_pt = dv?.id ?? null;
  }
  // "khác": em tự gõ đơn vị chưa có — tìm-hoặc-tạo trong don_vi (dedupe theo `ma` slug), dùng id thật.
  if (don_vi_id === '__khac__') {
    const tenDv = String(formData.get('don_vi_moi') ?? '').trim();
    if (!tenDv) return {ok: false, fieldError: 'don_vi_id', error: t('goTenDonViEmMuon')};
    const dv = await timHoacTaoDonVi(supabase, me.id, tenDv);
    if (!dv.id) return {ok: false, fieldError: 'don_vi_id', error: dv.error ?? t('khongTaoDonVi')};
    don_vi_id = dv.id;
  }
  const eff_don_vi = laPhanTram || laDemEm ? don_vi_pt : don_vi_id;
  if (laDemEm && !don_vi_pt) return {ok: false, error: t('khongTaoDonVi')};

  // Nội dung chung (dùng cho cả insert lẫn update). trang_thai đặt riêng theo nhánh.
  const noiDung = {
    ten,
    linh_vuc,
    subject_id,
    loai_moc,
    kieu_dich: eff_kieu_dich,
    chieu: eff_chieu,
    ky: laPhanTram || laDemEm ? null : ky,
    don_vi_id: eff_kieu_dich === 'chu' || eff_kieu_dich === 'ti_le_dat' ? null : eff_don_vi,
    x_so: eff_kieu_dich === 'chu' ? null : eff_x,
    y_so: eff_kieu_dich === 'chu' ? null : eff_y,
    x_chu: eff_kieu_dich === 'chu' ? x_chu : null,
    y_chu: eff_kieu_dich === 'chu' ? y_chu : null,
    chua_do_x: laPhanTram || laDemEm ? false : chua_do_x,
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
    if (error) return {ok: false, error: friendlyError(error, tLoi)};
    if (!data || data.length === 0)
      return {ok: false, error: t('khongLuuDuocEmKhongCo')};
  } else {
    // Mục tiêu TRƯỜNG: campus gửi thẳng từ form (không có lớp); còn lại suy campus từ lớp.
    const campus_id = laTruong
      ? String(formData.get('campus_id') ?? '').trim() || null
      : await layCampus(supabase, class_id);
    if (!campus_id) return {ok: false, error: laTruong ? t('chonCoSoChoTruong') : t('khongRoLopChuaLuu')};
    const {data, error} = await supabase
      .from('muc_tieu')
      .insert({
        cap,
        campus_id,
        class_id: laTruong ? null : class_id,
        student_id: laLop || laTruong ? null : student_id,
        trang_thai,
        ...noiDung,
        bat_dau: isValidDayVN(bat_dau) ? bat_dau : todayInVN(),
      })
      .select('id')
      .maybeSingle();
    // 0187: muc_tieu_lop_ten_nam_uidx — hai mục tiêu lớp cùng tên trong một năm (bấm Lưu hai lần
    // lúc mạng chậm) → 23505, nói tiếng người thay vì "dữ liệu bị trùng".
    if (error?.code === '23505' && laLop) return {ok: false, fieldError: 'ten', error: t('lopDaCoMucTieuTen')};
    if (error) return {ok: false, error: friendlyError(error, tLoi)};
    if (!data) return {ok: false, error: t('khongLuuDuocEmKhongCo')};
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
  if (mtId && !laTruong) {
    await supabase
      .from('noi')
      .delete()
      .eq('con_loai', 'muc_tieu')
      .eq('con_id', mtId)
      .eq('vai', 'chi_huong');
    if (ho_tro_cho) {
      if (laToiGv || laLop) {
        // laLop: "Hướng tới mục tiêu trường" chọn ngay trong form — 0182 nối CHỈ giữ hướng.
        // Mục tiêu CÁ NHÂN của thầy cô → mục tiêu lớp: hàm 0181 nối chi_huong + (cùng đơn vị)
        // gop_so và chuyển mục tiêu lớp sang nguon_so='con' để máy tự cộng. Lỗi thì nuốt như dây
        // thường: mục tiêu đã lưu là chính.
        await supabase.rpc('noi_wig_len_tren', {p_con: mtId, p_cha: ho_tro_cho});
      } else {
        await supabase.from('noi').insert({
          cha_id: ho_tro_cho,
          con_muc_tieu_id: mtId, // con_loai/con_id là cột generated — tự suy từ đây
          vai: 'chi_huong',
        });
      }
    }
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]/truong', 'page');
  if (trang_thai === 'nhap') return {ok: true, message: t('daLuuNhap')};
  if (laTruong) return {ok: true, message: t('daLuuMucTieuCuaTruong')};
  if (laToiGv) return {ok: true, message: t('daLuuMucTieuCuaThay')};
  if (laLop)
    return {
      ok: true,
      // 0186: GVCN tạo/sửa mục tiêu lớp là hiệu lực ngay — không còn "chờ ban giám hiệu".
      message: muc_tieu_id ? t('daSuaMucTieuLop') : t('daLuuMucTieuLop'),
    };
  return {
    ok: true,
    message: laChinhEm ? (muc_tieu_id ? t('suaXongChoThayCo') : t('daGuiThayCo')) : t('daLuuMucTieuChoEm'),
  };
}

// Đóng mục tiêu (ly_do_dong: dat/doi/bo — trigger đòi đúng ba giá trị ấy).
export async function dongMucTieu(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('muc_tieu_id') ?? '');
  const ly_do_dong = String(formData.get('ly_do_dong') ?? '');
  if (!id) veTrangEm(student_id, loi(t('thieuMucTieu')));
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
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data || data.length === 0) veTrangEm(student_id, loi(t('khongDongDuocKhongCoQuyen')));
  veTrangEm(student_id, t('daDongMucTieu'));
}

// Xoá mục tiêu — RLS chỉ cho khi nhap/gui/tra_lai VÀ chưa có số đo/dây/cam kết hiệu lực dưới nó.
// 04/09: trả state (trong hộp Sửa của FormMucTieu), không redirect.
export async function xoaMucTieu(_prev: FormState, formData: FormData): Promise<FormState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const id = String(formData.get('muc_tieu_id') ?? '');
  if (!id) return {ok: false, error: t('thieuMucTieu')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('muc_tieu').delete().eq('id', id).eq('cap', 'em').select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('chiXoaDuocKhiMucTieu')};
  return {ok: true, message: t('daXoaMucTieu')};
}

// GVCN duyệt / trả lại mục tiêu của em (trigger mt_truoc_sua kiểm quyền + ký + kiểm trần).
export async function duyetMucTieu(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
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
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data) veTrangEm(student_id, loi(t('mucTieuNayKhongConNua')));
  veTrangEm(student_id, t('daDuyetMucTieuCuaEm'));
}

export async function traLaiMucTieu(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!note) veTrangEm(student_id, loi(t('traLaiThiGhiChoEm')));
  if (note.length > 300) veTrangEm(student_id, loi(t('nhanXetToiDa300Ky')));
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
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data) veTrangEm(student_id, loi(t('mucTieuNayKhongConCho')));
  veTrangEm(student_id, t('daTraLaiKemNhanXet'));
}

// ── SỐ ĐO NGOÀI APP (so_do) ──────────────────────────────────────────────────────────────────
// Mục tiêu ĐO (nguon_so='ghi_tay'): cân nặng, điểm môn — máy không đếm được. Mỗi lần ghi là MỘT
// dòng mới (lịch sử giữ lại, số MỚI NHẤT là số thật — private.so_hien_tai đọc 'moi_nhat'). Luật
// ngày (không tương lai, không trước bat_dau) nằm ở trigger so_do_truoc_ghi.
export async function ghiSoDo(_prev: MucTieuState, formData: FormData): Promise<MucTieuState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '');
  if (!muc_tieu_id) return {ok: false, error: t('khongRoDangGhiChoMuc')};
  const raw = String(formData.get('gia_tri') ?? '').trim();
  if (raw === '') return {ok: false, fieldError: 'gia_tri', error: t('emDienSoDaNhe')};
  const gia_tri = Number(raw);
  if (!Number.isFinite(gia_tri) || gia_tri < 0)
    return {ok: false, fieldError: 'gia_tri', error: t('soPhaiTu0TroLen')};
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
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0)
    return {ok: false, error: t('khongGhiDuocEmKhongCo')};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: t('daGhiSo')};
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
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const laChinhEm = me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  if (!laChinhEm && !laNhanSu) return {ok: false, error: t('chiEmMoiGhiDuocPhan')};

  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('emSeLamViecGiBat')};
  if (ten.length > 200) return {ok: false, fieldError: 'ten', error: t('toiDa200KyTu')};

  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim();
  if (!don_vi_id) return {ok: false, fieldError: 'don_vi_id', error: t('chonDonViEmDongDem')};

  const cach_ghi = String(formData.get('cach_ghi') ?? 'cham'); // cham/dien_so/he_thong
  const chieu_dich = String(formData.get('chieu_dich') ?? 'it_nhat'); // it_nhat/nhieu_nhat
  const gop = String(formData.get('gop') ?? 'tong'); // tong/moi_nhat/dem_dat_nguong
  const kyTuanRaw = Number(String(formData.get('ky_tuan') ?? '1'));
  const ky_tuan = [1, 2, 4].includes(kyTuanRaw) ? kyTuanRaw : 1;
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: t('baoNhieuLaDuMoiKy', {ky: ky_tuan === 1 ? t('kyMotTuan') : t('kyNTuan', {n: ky_tuan})})};

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
    return {ok: false, fieldError: 'ngay', error: t('emChonItNhatMotNgay')};

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
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data) return {ok: false, error: t('khongLuuDuocEmKhongCo')};

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
    if (eNoi) return {ok: false, error: t('daLuuChuaNoi', {loi: friendlyError(eNoi, tLoi)})};
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: t('daGuiThayCoEmGhi')};
}

// Đổi chỉ tiêu từ TUẦN SAU (thuoc_lich_su). Trigger thls_truoc_them quyết định hiệu lực ngay hay
// về chờ duyệt (hạ >30% hoặc hạ lần hai trong năm → cho_duyet + thuoc.duyet='gui').
export async function suaChiTieu(_prev: ViecState, formData: FormData): Promise<ViecState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) return {ok: false, error: t('thieuViecCanSua')};
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0)
    return {ok: false, fieldError: 'chi_tieu_ky', error: t('chiTieuMoiPhaiLaSo')};
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
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data) return {ok: false, error: t('khongLuuDuocEmKhongCo2')};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {
    ok: true,
    message:
      data.trang_thai === 'cho_duyet'
        ? t('daLuuChoDuyetHaNhieu')
        : t('daLuuChiTieuTuanSau'),
  };
}

// Xoá thước tại chỗ (hộp Sửa của em) — RLS/trigger chỉ cho khi chưa có lượt ghi.
export async function xoaViecTaiCho(_prev: FormState, formData: FormData): Promise<FormState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) return {ok: false, error: t('thieuViec')};
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', thuoc_id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('chiXoaDuocKhiViecChua')};
  return {ok: true, message: t('daXoaViec')};
}

// Xoá việc — RLS chỉ cho khi chưa từng duyệt và chưa có lượt ghi.
export async function xoaViec(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) veTrangEm(student_id, loi(t('thieuViec')));
  const supabase = await createClient();
  const {data, error} = await supabase.from('thuoc').delete().eq('id', thuoc_id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data || data.length === 0)
    veTrangEm(student_id, loi(t('chiXoaDuocKhiViecChua')));
  veTrangEm(student_id, t('daXoaViec'));
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
  const tLoi = await getTranslations('common');
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
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: 'Không ghi được — thử lại nhé.'};   // helper không export, không có t(); caller hiện qua viec.ghiLoi
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true};
}

export async function ghiLuot(thuocId: string, ngay: string, giaTri: number): Promise<LuotResult> {
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me || me.role !== 'student') return {ok: false, error: t('chiEmMoiGhiDuocPhan')};
  if (!thuocId || !isValidDayVN(ngay)) return {ok: false, error: t('thieuViecHoacNgay')};
  // Cửa sổ 7 ngày (hôm nay lùi 6 ngày là ngày sớm nhất). Ngoài cửa sổ → nhờ thầy cô ghi giúp.
  const today = todayInVN();
  const cachNgay = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ngay}T00:00:00Z`)) / 86_400_000,
  );
  if (cachNgay > 6 || cachNgay < 0)
    return {ok: false, error: t('chiGhiDuocTrong7Ngay')};

  const supabase = await createClient();
  const res = await ghiLuotChung(supabase, {thuocId, studentId: me.id, ngay, giaTri, nguoiGhi: me.id});
  // Trong cửa sổ mà vẫn bị chặn → gần như chắc là tuần đã ký (luot_bi_khoa).
  if (!res.ok && res.error) return {ok: false, error: t('ngayNayDaKhoaSauBuoi')};
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
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const laChinhEm = me.id === student_id && me.role === 'student';
  const laNhanSu = me.role === 'teacher' || me.role === 'admin' || me.role === 'principal';
  if (!laChinhEm && !laNhanSu) return {ok: false, error: t('chiEmMoiGhiDuocPhan')};

  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: t('tuanNayEmHuaLamGi')};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: t('toiDa300KyTu')};

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
  let so_hua = soHuaRaw === '' ? null : Number(soHuaRaw);
  if (so_hua !== null && (!Number.isFinite(so_hua) || so_hua <= 0))
    return {ok: false, fieldError: 'so_hua', error: t('conSoCuaCamKetPhai')};
  let don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;
  // ck_don_vi_ck: "có số hứa" ⟺ "có đơn vị". Thiếu một trong hai thì bỏ CẢ hai — đừng để em gặp
  // lỗi "Giá trị nhập không hợp lệ" chỉ vì để trống ô số. Không có số thì cam kết chấm Thắng/Thua tay.
  if (so_hua === null || don_vi_id === null) {
    so_hua = null;
    don_vi_id = null;
  }
  const muc_tieu_id = String(formData.get('muc_tieu_id') ?? '').trim() || null;
  // Thước đo dẫn dắt (thuoc) KHÔNG tạo ở đây nữa — có nút "+ Thước đo dẫn dắt" riêng dưới mỗi cam
  // kết (themThuocChoCamKet). Form cam kết chỉ còn lời hứa + số.
  const thuoc_id: string | null = null;

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
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data) return {ok: false, error: t('khongLuuDuocEmKhongCo')};

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true, message: t('daLuuCamKet')};
}

// THÊM THƯỚC ĐO DẪN DẮT cho một cam kết của EM (nút "+" riêng dưới cam kết). Tạo thuoc chu_the='em'
// pham_vi='tung_em' trỏ về cam kết qua cam_ket_id (0185). Đo 'cham' (tick những ngày chọn) hoặc
// 'dien_so' (đơn vị + đích). 04/09: trả state — gửi rỗng thì lỗi hiện dưới ô (trước đây im lặng).
export async function themThuocChoCamKet(_prev: FormState, formData: FormData): Promise<FormState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const cam_ket_id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!cam_ket_id) return {ok: false, error: t('thieuCamKet')};
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('thuocDoDanDatLaViec')};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: t('toiDa160KyTu')};
  const tuanGui = String(formData.get('tuan_bat_dau') ?? '').trim();
  const tu_tuan = isValidDayVN(tuanGui) ? mondayOf(tuanGui) : weekRangeVN().start;
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  const ngayChon = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

  const supabase = await createClient();
  let payload: {cach_ghi: string; don_vi_id: string; chi_tieu_ky: number; moi_lan: number | null; ngay_ap_dung: number[]};
  if (viecCach === 'dien_so') {
    let vdv = String(formData.get('viec_don_vi') ?? '').trim();
    const vdich = Number(String(formData.get('viec_dich') ?? '').trim());
    if (!vdv || !Number.isFinite(vdich) || vdich <= 0)
      return {ok: false, fieldError: 'viec_dich', error: t('doBangSoThiChonDon')};
    if (vdv === '__khac__') {
      const tenDv = String(formData.get('don_vi_moi') ?? '').trim();
      if (!tenDv) return {ok: false, fieldError: 'don_vi_moi', error: t('goTenDonViEmMuon')};
      const dv = await timHoacTaoDonVi(supabase, me.id, tenDv);
      if (!dv.id) return {ok: false, fieldError: 'don_vi_moi', error: dv.error ?? t('khongTaoDonVi')};
      vdv = dv.id as string;
    }
    payload = {cach_ghi: 'dien_so', don_vi_id: vdv, chi_tieu_ky: vdich, moi_lan: null, ngay_ap_dung: [1, 2, 3, 4, 5, 6, 7]};
  } else {
    if (ngayChon.length === 0) return {ok: false, fieldError: 'ngay', error: t('emChonItNhatMotNgay2')};
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) return {ok: false, error: t('thieuDonViHeThongNgay')};
    payload = {cach_ghi: 'cham', don_vi_id: ngayId, chi_tieu_ky: ngayChon.length, moi_lan: 1, ngay_ap_dung: ngayChon};
  }

  const {data: vRow, error: vErr} = await supabase
    .from('thuoc')
    .insert({chu_the: 'em', class_id, student_id, ten, chieu_dich: 'it_nhat', gop: 'tong', ky_tuan: 1, pham_vi: 'tung_em', tu_tuan, duyet: 'duyet', trang_thai: 'chay', cam_ket_id, ...payload})
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (vErr) return {ok: false, error: friendlyError(vErr, tLoi)};
  if (!vRow) return {ok: false, error: t('khongTaoDuocThuocDoDan')};
  return {ok: true, message: t('daThemThuocDoDanDat')};
}

// CHẤM TẠI CHỖ (Thắng/Thua/Bỏ chấm) — KHÔNG redirect: nút bé, trang phải đứng yên (cùng mẫu
// chamCamKetToiTaiCho bên màn thầy cô). Trả state cho useActionState; RLS/trigger vẫn là luật
// thật — câu báo của trigger hiện nguyên cạnh nút.
export type ChamEmState = {ok: boolean; error?: string};
export async function chamCamKetTaiCho(_prev: ChamEmState, formData: FormData): Promise<ChamEmState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const id = String(formData.get('cam_ket_id') ?? '').trim();
  if (!id) return {ok: false, error: t('thieuCamKet')};
  const ketQuaRaw = String(formData.get('ket_qua') ?? '').trim();
  const ket_qua = ketQuaRaw === 'thang' || ketQuaRaw === 'thua' ? ketQuaRaw : null;
  const soDatRaw = String(formData.get('so_dat') ?? '').trim();
  const so_dat = soDatRaw === '' ? null : Number(soDatRaw);
  if (so_dat !== null && (!Number.isFinite(so_dat) || so_dat < 0))
    return {ok: false, error: t('soDatDuocPhaiTu0')};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cam_ket')
    .update({ket_qua, so_dat: ket_qua === null ? null : so_dat})
    .eq('id', id)
    .select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('khongChamDuocKhongCoQuyen')};
  return {ok: true};
}

// Huỷ cam kết — RLS chỉ cho khi chưa chấm, chưa kể lại trong họp, chưa ai xác nhận.
export async function xoaCamKet(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('cam_ket_id') ?? '');
  if (!id) veTrangEm(student_id, loi(t('thieuCamKet')));
  const supabase = await createClient();
  const {data, error} = await supabase.from('cam_ket').delete().eq('id', id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data || data.length === 0)
    veTrangEm(student_id, loi(t('khongHuyDuocCamKetDa')));
  veTrangEm(student_id, t('daHuyCamKet'));
}

// ĐỔI CAM KẾT TUẦN — em muốn hứa việc khác: xoá cam kết HIỆN TẠI KÈM lead measure gắn với nó (việc
// bổ trợ của cam kết cũ), rồi em set lại từ đầu qua form "+ Thêm cam kết". (Cam kết giữ nguyên thì
// lead measure giữ nguyên; đổi thì bỏ luôn lead measure cũ — theo chủ dự án 03/09.)
export async function doiCamKet(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('cam_ket_id') ?? '');
  if (!id) veTrangEm(student_id, loi(t('thieuCamKet')));
  const supabase = await createClient();
  // 0195: một RPC dọn cả cây (lượt → thước → cam kết 'huy'). Trước đây xoá thước ở đây bị RLS chặn
  // lặng lẽ với thước ĐÃ DUYỆT của em → thước cũ ở lại. Chưa áp 0195 (PGRST202/42883) → đường cũ.
  const rpc = await supabase.rpc('huy_cam_ket_ca_cay', {p_id: id});
  if (rpc.error && rpc.error.code !== 'PGRST202' && rpc.error.code !== '42883') {
    veTrangEm(student_id, loi(friendlyError(rpc.error, tLoi)));
  }
  if (rpc.error) {
    // ĐÁNH DẤU 'huy' (không xoá): tín hiệu để cam kết TỰ LĂN (0177) NGỪNG lăn dòng này — bản mới
    // nhất là 'huy' thì hàm lăn bỏ qua. Xoá thì tuần sau nó lại clone từ bản cũ hơn.
    const {data, error} = await supabase.from('cam_ket').update({trang_thai: 'huy'}).eq('id', id).select('id');
    if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
    if (!data || data.length === 0)
      veTrangEm(student_id, loi(t('khongDoiDuocCamKetDa')));
    // Xoá CẢ CHÙM thước của cam kết (0185: thuoc.cam_ket_id; RLS chặn nếu không phải của em).
    await supabase.from('thuoc').delete().eq('cam_ket_id', id).eq('chu_the', 'em');
  }
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  veTrangEm(student_id, t('daBoCamKetCuEm'));
}

// SỬA CAM KẾT — đổi LỜI HỨA (noi_dung) và SỐ HỨA (so_hua) khi CHƯA chấm. Trigger ck_truoc_sua chặn
// sửa nội dung sau khi đã chấm (câu báo hiện nguyên). Giữ nguyên đơn vị (không đụng don_vi_id) → chỉ
// đổi so_hua khi cam kết vốn có đơn vị; ck_don_vi_ck luôn thoả (cả hai vẫn non-null).
export async function suaCamKet(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('cam_ket_id') ?? '');
  if (!id) veTrangEm(student_id, loi(t('thieuCamKet')));
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) veTrangEm(student_id, loi(t('tuanNayEmHuaLamGi')));
  if (noi_dung.length > 300) veTrangEm(student_id, loi(t('toiDa300KyTu')));
  const patch: {noi_dung: string; so_hua?: number} = {noi_dung};
  // Ô số hứa chỉ hiện khi cam kết có đơn vị; có gửi thì đổi (giữ đơn vị cũ trong DB).
  const soHuaRaw = formData.get('so_hua');
  if (soHuaRaw != null && String(soHuaRaw).trim() !== '') {
    const so_hua = Number(String(soHuaRaw).trim());
    if (!Number.isFinite(so_hua) || so_hua <= 0) veTrangEm(student_id, loi(t('conSoCuaCamKetPhai')));
    patch.so_hua = so_hua;
  }
  const supabase = await createClient();
  const {data, error} = await supabase.from('cam_ket').update(patch).eq('id', id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data || data.length === 0) veTrangEm(student_id, loi(t('khongSuaDuocCamKetDa')));
  veTrangEm(student_id, t('daSuaCamKet'));
}

// SỬA CAM KẾT TẠI CHỖ (hộp Sửa của em) — như suaCamKet nhưng trả state: gửi rỗng thì lỗi hiện
// dưới ô và ô GIỮ chữ (trước đây redirect + mất nội dung đang sửa).
export async function suaCamKetTaiCho(_prev: FormState, formData: FormData): Promise<FormState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const id = String(formData.get('cam_ket_id') ?? '');
  if (!id) return {ok: false, error: t('thieuCamKet')};
  const noi_dung = String(formData.get('noi_dung') ?? '').trim();
  if (!noi_dung) return {ok: false, fieldError: 'noi_dung', error: t('tuanNayEmHuaLamGi')};
  if (noi_dung.length > 300) return {ok: false, fieldError: 'noi_dung', error: t('toiDa300KyTu')};
  const patch: {noi_dung: string; so_hua?: number; muc_tieu_id?: string; don_vi_id?: string | null} = {noi_dung};
  const soHuaRaw = formData.get('so_hua');
  if (soHuaRaw != null && String(soHuaRaw).trim() !== '') {
    const so_hua = Number(String(soHuaRaw).trim());
    if (!Number.isFinite(so_hua) || so_hua <= 0) return {ok: false, fieldError: 'so_hua', error: t('conSoCuaCamKetPhai')};
    patch.so_hua = so_hua;
  }
  const supabase = await createClient();
  // Gắn cam kết LẠC vào một mục tiêu (khu dọn trên màn em). Đơn vị ép theo mục tiêu: có số hứa mà
  // mục tiêu không có đơn vị thì bỏ số (ck_don_vi_ck: so_hua ⟺ don_vi_id).
  const mtRaw = String(formData.get('muc_tieu_id') ?? '').trim();
  if (mtRaw) {
    const {data: mt} = await supabase.from('muc_tieu').select('id, don_vi_id').eq('id', mtRaw).maybeSingle();
    if (!mt) return {ok: false, fieldError: 'muc_tieu_id', error: t('khongRoMucTieu')};
    patch.muc_tieu_id = mt.id;
    patch.don_vi_id = mt.don_vi_id ?? null;
    if (!mt.don_vi_id) patch.so_hua = undefined;
  }
  const {data, error} = await supabase.from('cam_ket').update(patch).eq('id', id).select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('khongSuaDuocCamKetDa')};
  return {ok: true, message: t('daSuaCamKet')};
}

// SỬA THƯỚC ĐO TẠI CHỖ (hộp Sửa của em) — cùng luật suaViec, trả state.
export async function suaViecTaiCho(_prev: FormState, formData: FormData): Promise<FormState> {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) return {ok: false, error: t('thieuViec')};
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) return {ok: false, fieldError: 'ten', error: t('thuocDoDanDatLaViec')};
  if (ten.length > 160) return {ok: false, fieldError: 'ten', error: t('toiDa160KyTu')};
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0) return {ok: false, fieldError: 'chi_tieu_ky', error: t('dichPhaiLaSoLonHon')};
  const ngay_ap_dung = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  const supabase = await createClient();
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  let cach_ghi: string;
  let don_vi_id: string;
  let moi_lan: number | null;
  if (viecCach === 'dien_so') {
    const vdv = String(formData.get('viec_don_vi') ?? '').trim();
    if (!vdv) return {ok: false, fieldError: 'viec_don_vi', error: t('doBangSoThiChonDon2')};
    cach_ghi = 'dien_so';
    don_vi_id = vdv;
    moi_lan = null;
  } else {
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) return {ok: false, error: t('thieuDonViHeThongNgay')};
    cach_ghi = 'cham';
    don_vi_id = ngayId;
    moi_lan = 1;
  }
  const patch: {ten: string; chi_tieu_ky: number; cach_ghi: string; don_vi_id: string; moi_lan: number | null; ngay_ap_dung?: number[]} =
    {ten, chi_tieu_ky, cach_ghi, don_vi_id, moi_lan};
  if (ngay_ap_dung.length) patch.ngay_ap_dung = ngay_ap_dung;
  const {data, error} = await supabase.from('thuoc').update(patch).eq('id', thuoc_id).eq('chu_the', 'em').select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  if (!data || data.length === 0) return {ok: false, error: t('khongSuaDuocKhongCoQuyen')};
  return {ok: true, message: t('daSuaThuocDoDanDat')};
}

// SỬA THƯỚC ĐO DẪN DẮT — đổi TÊN, ĐÍCH (chi_tieu_ky) và NGÀY áp dụng, có hiệu lực ngay (em sửa tuỳ
// thích, không duyệt — khác suaChiTieu vốn qua thuoc_lich_su + duyệt). Trigger th_truoc_sua gác quyền.
export async function suaViec(formData: FormData) {
  const tLoi = await getTranslations('common');
  const t = await getTranslations('loi');
  const student_id = String(formData.get('student_id') ?? '');
  const thuoc_id = String(formData.get('thuoc_id') ?? '');
  if (!thuoc_id) veTrangEm(student_id, loi(t('thieuViec')));
  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) veTrangEm(student_id, loi(t('thuocDoDanDatLaViec')));
  if (ten.length > 160) veTrangEm(student_id, loi(t('toiDa160KyTu')));
  const chi_tieu_ky = Number(String(formData.get('chi_tieu_ky') ?? '').trim());
  if (!Number.isFinite(chi_tieu_ky) || chi_tieu_ky <= 0) veTrangEm(student_id, loi(t('dichPhaiLaSoLonHon')));
  const ngay_ap_dung = formData
    .getAll('ngay')
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  const supabase = await createClient();
  // CÁCH ĐO (sửa tùy thích): 'cham' → đơn vị "ngày" (lùi "lần"), tick; 'dien_so' → đơn vị em chọn.
  // Đổi cách-đo/đơn vị chỉ được khi CHƯA ghi lượt — trigger th_truoc_sua chặn (23514) nếu đã tick.
  const viecCach = String(formData.get('viec_cach') ?? 'cham') === 'dien_so' ? 'dien_so' : 'cham';
  let cach_ghi: string;
  let don_vi_id: string;
  let moi_lan: number | null;
  if (viecCach === 'dien_so') {
    const vdv = String(formData.get('viec_don_vi') ?? '').trim();
    if (!vdv) veTrangEm(student_id, loi(t('doBangSoThiChonDon2')));
    cach_ghi = 'dien_so';
    don_vi_id = vdv;
    moi_lan = null;
  } else {
    const {data: dvRows} = await supabase.from('don_vi').select('id, ma').in('ma', ['ngay', 'lan']);
    const ngayId = dvRows?.find((d) => d.ma === 'ngay')?.id ?? dvRows?.find((d) => d.ma === 'lan')?.id ?? null;
    if (!ngayId) veTrangEm(student_id, loi(t('thieuDonViHeThongNgay')));
    cach_ghi = 'cham';
    don_vi_id = ngayId as string;
    moi_lan = 1;
  }
  const patch: {ten: string; chi_tieu_ky: number; cach_ghi: string; don_vi_id: string; moi_lan: number | null; ngay_ap_dung?: number[]} =
    {ten, chi_tieu_ky, cach_ghi, don_vi_id, moi_lan};
  if (ngay_ap_dung.length) patch.ngay_ap_dung = ngay_ap_dung;
  const {data, error} = await supabase.from('thuoc').update(patch).eq('id', thuoc_id).eq('chu_the', 'em').select('id');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error, tLoi)));
  if (!data || data.length === 0) veTrangEm(student_id, loi(t('khongSuaDuocKhongCoQuyen')));
  veTrangEm(student_id, t('daSuaThuocDoDanDat'));
}

