'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {getCurrentProfile} from '@/lib/auth';
import {getTranslations} from 'next-intl/server';
import {friendlyError} from '@/lib/errors';
import {isoWeekLabel, todayInVN, vnNoon, mondayOf, shiftWeeks, tuanTuNhan} from '@/lib/dates';

// ════════════════════════════════════════════════════════════════════════════
// HỌP VỚI BẠN (Plan-Do-Review) — mô hình MỤC TIÊU PA2 (40-B ⑥, 40-F F7, 40-G)
// ════════════════════════════════════════════════════════════════════════════
//
// Mỗi tuần em họp với bạn cùng nhóm (1-1 hoặc 1-1-1, GVCN ghép ở /roster) và LẦN LƯỢT trả lời sáu
// câu. Mỗi dòng pdr_meetings là phần trả lời CỦA MỘT EM — buổi 1-1-1 có ba dòng cùng tuần.
//
//   · Câu 1  nhắc lời hứa tuần qua (chỉ đọc, khối HopPdr dựng từ cam_ket).
//   · Câu 2  KỂ LẠI từng cam kết TỚI HẠN qua bảng pdr_ke_lai — chấm Thắng/Thua từng cái; trigger
//            pkl_sau_ghi tự CHÉP kết quả về cam_ket (cam_ket là nguồn duy nhất của kết quả).
//            Cam kết nhiều tuần chưa tới hạn thì chỉ kể tình hình (ghi_chu, ket_qua để null).
//            Máy GỢI Ý Thắng/Thua qua goi_y_cam_ket() — hiển thị ở HopPdr, trigger chụp lại lúc chấm.
//   · Câu 6  SINH cam kết mới cho tuần kế tiếp (1–4 tuần), KHÔNG bắt gắn mục tiêu (lac_muc_tieu ok).
//
// RLS là chốt thật (20-QUYEN): em chỉ ghi dòng của mình, chỉ tới khi Ghi nhận; ghi_duoc_pdr_ke_lai
// gác câu 2; ck_truoc_them gác trần 2 cam kết/tuần. Mã ở đây lo câu báo lỗi nói tiếng người, lo ráp
// bạn cùng nhóm đúng, và chặn Ghi nhận khi còn cam kết tới hạn chưa chấm.
//
// Chữ ký (L8/C22): người bấm Ghi nhận LÀ người ký (acknowledged_by = uid người bấm). Ở lớp thường
// chỉ chính em ký; ở lớp bật nhập hộ (classes.nhap_ho) bạn cùng buổi được ký hộ; thầy cô KHÔNG ký.

export type PdrState = {ok: boolean; error?: string; fieldError?: string; message?: string};

const CAU = ['q1_plan', 'q2_result', 'q3_obstacle', 'q4_overcome', 'q5_better_way', 'q6_commitment'] as const;

export async function luuPdr(_prev: PdrState, formData: FormData): Promise<PdrState> {
  const t = await getTranslations('loi');
  const tc = await getTranslations('common');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  if (me.role !== 'student') return {ok: false, error: t('pdrChiEmGhi')};

  const traLoi = {} as {[K in (typeof CAU)[number]]: string | null};
  for (const c of CAU) {
    const v = String(formData.get(c) ?? '').trim();
    if (v.length > 600) return {ok: false, fieldError: c, error: t('pdrToiDa600')};
    traLoi[c] = v || null;
  }

  // Họp với BẠN hằng tuần hay với THẦY CÔ (1-1, hằng tháng) — hai nhánh của cùng một biên bản 6 câu.
  const loai = String(formData.get('type') ?? 'buddy');
  if (loai !== 'buddy' && loai !== 'coach')
    return {ok: false, error: t('pdrKhongRoLoai')};

  const supabase = await createClient();
  const {data: ghiDanh} = await supabase
    .from('enrollments')
    .select('class_id, classes(homeroom_teacher_id)')
    .eq('student_id', me.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!ghiDanh?.class_id) return {ok: false, error: t('pdrChuaXepLop')};

  // NGƯỜI NGỒI HỌP LẤY TỪ CSDL, không tin form: bạn cùng nhóm do GVCN ghép, coach là chính GVCN.
  // Thứ tự ổn định theo ngày ghép để counterpart/second không nhảy chỗ mỗi lần lưu.
  let counterpart: string | null = null;
  let secondBuddy: string | null = null;
  if (loai === 'buddy') {
    const {data: cap} = await supabase
      .from('buddy_pairs')
      .select('student_id, buddy_id, created_at')
      .eq('is_active', true)
      .or(`student_id.eq.${me.id},buddy_id.eq.${me.id}`)
      // Nhóm 3 sinh cả 3 cặp trong MỘT giao dịch → created_at bằng nhau; thêm khoá phụ để
      // counterpart/second không đổi chỗ giữa hai lần đọc.
      .order('created_at')
      .order('id');
    const banHoc = (cap ?? []).map((p) => (p.student_id === me.id ? p.buddy_id : p.student_id));
    if (banHoc.length === 0)
      return {ok: false, error: t('pdrChuaCoBan')};
    counterpart = banHoc[0];
    secondBuddy = banHoc[1] ?? null;
  } else {
    const gvcn = (ghiDanh as unknown as {classes: {homeroom_teacher_id: string | null} | null}).classes
      ?.homeroom_teacher_id;
    if (!gvcn) return {ok: false, error: t('pdrChuaCoGvcn')};
    counterpart = gvcn;
  }

  // ── TUẦN CỦA BIÊN BẢN ĐI THEO THANH TUẦN ──────────────────────────────────────────────────
  // Màn gửi lên thứ Hai của tuần biên bản; ở đây kiểm lại (ô hidden nằm trong trình duyệt, sửa được):
  //   · phải đúng là một thứ Hai;
  //   · KHÔNG ghi cho tuần chưa tới — chưa sống thì chưa có gì để nhìn lại;
  //   · chỉ tuần này và tuần trước. Xa hơn thì câu 6 sinh cam kết cho một tuần đã đi qua.
  const thisMonday = mondayOf(todayInVN());
  const tuanGui = String(formData.get('week_start') ?? '').trim();
  const tuanBienBan = /^\d{4}-\d{2}-\d{2}$/.test(tuanGui) ? tuanGui : thisMonday;
  if (mondayOf(tuanBienBan) !== tuanBienBan)
    return {ok: false, error: t('pdrTuanKhongHopLe')};
  if (tuanBienBan > thisMonday)
    return {ok: false, error: t('pdrTuanChuaToi')};
  if (tuanBienBan < shiftWeeks(thisMonday, -1))
    return {ok: false, error: t('pdrChiTuanNayTruoc')};
  const weekLabel = isoWeekLabel(vnNoon(tuanBienBan));
  const {data: daCo} = await supabase
    .from('pdr_meetings')
    .select('id, acknowledged_at')
    .eq('student_id', me.id)
    .eq('type', loai)
    .eq('week_label', weekLabel)
    .maybeSingle();
  if (daCo?.acknowledged_at)
    return {ok: false, error: t('pdrDaGhiNhanTuan')};

  let meetingId = daCo?.id ?? null;
  if (meetingId) {
    const {error} = await supabase.from('pdr_meetings').update(traLoi).eq('id', meetingId);
    if (error) return {ok: false, error: friendlyError(error)};
  } else {
    const {data, error} = await supabase
      .from('pdr_meetings')
      .insert({
        class_id: ghiDanh.class_id,
        student_id: me.id,
        type: loai,
        counterpart_id: counterpart,
        second_buddy_id: secondBuddy,
        week_label: weekLabel,
        ...traLoi,
      })
      .select('id')
      .maybeSingle();
    if (error) return {ok: false, error: friendlyError(error)};
    if (!data) return {ok: false, error: t('pdrKhongQuyenLop')};
    meetingId = data.id;
  }

  let canhBao = '';

  // ── CÂU 2 → KỂ LẠI TỪNG CAM KẾT TỚI HẠN (pdr_ke_lai) ──────────────────────────────────────
  // Form gửi lên bốn mảng SONG SONG theo chỉ số: cam_ket_id · ket_qua ('thang'/'thua'/'') · so_dat ·
  // ghi_chu. Chỉ ghi dòng em thực sự kể (có ket_qua HOẶC ghi_chu HOẶC so_dat) — không đẻ dòng rỗng,
  // và tránh vô tình xoá điểm đã chấm khi lưu lại biên bản không đụng câu 2. Trigger pkl_sau_ghi
  // chép ket_qua sang cam_ket và chụp gợi ý máy; ở đây không tự chấm cam_ket.
  const keLaiIds = formData.getAll('ke_lai_cam_ket').map((v) => String(v));
  const keLaiKq = formData.getAll('ke_lai_ket_qua').map((v) => String(v));
  const keLaiSo = formData.getAll('ke_lai_so_dat').map((v) => String(v));
  const keLaiGhi = formData.getAll('ke_lai_ghi_chu').map((v) => String(v));
  let loiKeLai = 0;
  for (let i = 0; i < keLaiIds.length; i++) {
    const camKetId = keLaiIds[i].trim();
    if (!/^[0-9a-f-]{36}$/i.test(camKetId)) continue;
    const kqRaw = (keLaiKq[i] ?? '').trim();
    const ketQua = kqRaw === 'thang' || kqRaw === 'thua' ? kqRaw : null;
    const soRaw = (keLaiSo[i] ?? '').trim();
    const soDatNum = soRaw === '' ? null : Number(soRaw);
    const soDat = soDatNum !== null && Number.isFinite(soDatNum) && soDatNum >= 0 ? soDatNum : null;
    const ghiChu = (keLaiGhi[i] ?? '').trim().slice(0, 300) || null;
    if (!ketQua && !ghiChu && soDat === null) continue; // em chưa kể gì cho cam kết này
    const {error} = await supabase
      .from('pdr_ke_lai')
      .upsert(
        {pdr_meeting_id: meetingId, cam_ket_id: camKetId, ket_qua: ketQua, so_dat: soDat, ghi_chu: ghiChu},
        {onConflict: 'pdr_meeting_id,cam_ket_id'},
      );
    if (error) loiKeLai++;
  }
  if (loiKeLai > 0)
    canhBao =
      loiKeLai === 1
        ? ' ' + t('pdrKeLaiHong1')
        : ' ' + t('pdrKeLaiHongN', {n: loiKeLai});

  // ── CÂU 6 → SINH CAM KẾT MỚI CHO TUẦN KẾ TIẾP ─────────────────────────────────────────────
  // Chỉ sinh MỘT lần cho mỗi buổi (soi pdr_meeting_id); em sửa câu 6 sau đó thì sửa lời văn ở thẻ
  // cam kết như mọi cam kết khác, không đẻ bản thứ hai. Không bắt gắn mục tiêu — cam kết "lạc mục
  // tiêu" vẫn hợp lệ (lac_muc_tieu). Gắn thước/mục tiêu là TUỲ CHỌN; trigger ck_truoc_them kiểm
  // link cùng chủ thể + trần 2/tuần.
  if (traLoi.q6_commitment) {
    const noiDung = traLoi.q6_commitment.trim();
    if (noiDung.length > 300)
      return {ok: false, fieldError: 'q6_commitment', error: t('toiDa300KyTu')};
    const {data: daSinh} = await supabase
      .from('cam_ket')
      .select('id')
      .eq('pdr_meeting_id', meetingId)
      .limit(1)
      .maybeSingle();
    if (!daSinh) {
      const soTuanRaw = Number(String(formData.get('q6_so_tuan') ?? '1'));
      const soTuan = Number.isInteger(soTuanRaw) && soTuanRaw >= 1 && soTuanRaw <= 4 ? soTuanRaw : 1;
      const thuocId = String(formData.get('q6_thuoc_id') ?? '').trim() || null;
      const mucTieuId = String(formData.get('q6_muc_tieu_id') ?? '').trim() || null;
      const {error} = await supabase.from('cam_ket').insert({
        chu_the: 'em',
        class_id: ghiDanh.class_id,
        student_id: me.id,
        tuan_bat_dau: shiftWeeks(tuanBienBan, 1),
        so_tuan: soTuan,
        noi_dung: noiDung,
        thuoc_id: thuocId,
        muc_tieu_id: mucTieuId,
        pdr_meeting_id: meetingId,
      });
      if (error) {
        if (/nhiều nhất 2 cam kết|2\/tuần|tối đa 2/i.test(error.message ?? ''))
          canhBao +=
            ' ' + t('pdrCau6DuTran');
        else canhBao += ' ' + t('pdrCau6Hong', {loi: friendlyError(error, tc)});
      }
    }
  }

  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: t('pdrDaLuu') + canhBao};
}

// Nút "Ghi nhận" — chữ ký xác nhận buổi họp ĐÃ DIỄN RA (chưa Ghi nhận thì không tính KPI). Người
// bấm LÀ người ký (acknowledged_by = uid). Ở lớp thường chỉ chính em ký; lớp bật nhập hộ thì bạn
// cùng buổi ký hộ; thầy cô KHÔNG ký (L8/C22). RLS + trigger pdr_truoc_sua là chốt cuối; các kiểm
// dưới đây chỉ để câu báo lỗi nói tiếng người. Ghi nhận đóng cả tuần lượt ghi (luot_bi_khoa) nên
// chặn khi còn cam kết TỚI HẠN chưa chấm ở câu 2.
export async function ghiNhanPdr(_prev: PdrState, formData: FormData): Promise<PdrState> {
  const t = await getTranslations('loi');
  const me = await getCurrentProfile();
  if (!me) return {ok: false, error: t('chuaDangNhap')};
  const id = String(formData.get('meeting_id') ?? '');
  if (!id) return {ok: false, error: t('pdrThieuBuoiHop')};

  const supabase = await createClient();
  const {data: bb} = await supabase
    .from('pdr_meetings')
    .select('student_id, class_id, type, counterpart_id, second_buddy_id, acknowledged_at, week_label')
    .eq('id', id)
    .maybeSingle();
  if (!bb) return {ok: false, error: t('pdrKhongThayBuoi')};
  if (bb.acknowledged_at)
    return {ok: false, error: t('pdrDaGhiNhan')};

  // L8: thầy cô KHÔNG ký thay.
  if (me.role !== 'student')
    return {ok: false, error: t('pdrThayCoKhongKy')};
  // Bạn ký hộ chỉ được ở lớp bật nhập hộ, và chỉ khi là bạn trong buổi họp (buddy).
  if (me.id !== bb.student_id) {
    const {data: lop} = await supabase
      .from('classes')
      .select('nhap_ho')
      .eq('id', bb.class_id)
      .maybeSingle();
    if (!lop?.nhap_ho)
      return {
        ok: false,
        error: t('pdrChiEmBam'),
      };
    if (bb.type !== 'buddy' || (me.id !== bb.counterpart_id && me.id !== bb.second_buddy_id))
      return {ok: false, error: t('pdrChiBanKy')};
  }

  // Chặn khi còn cam kết TỚI HẠN (tuan_ket_thuc ≤ tuần biên bản) chưa chấm Thắng/Thua (câu 2).
  const tuan = tuanTuNhan(bb.week_label);
  if (tuan) {
    const {count} = await supabase
      .from('cam_ket')
      .select('id', {count: 'exact', head: true})
      .eq('student_id', bb.student_id)
      .eq('chu_the', 'em')
      .eq('trang_thai', 'hieu_luc')
      .is('ket_qua', null)
      .lte('tuan_ket_thuc', tuan.start);
    if (count && count > 0)
      return {ok: false, error: t('pdrConCamKetChuaCham', {n: count})};
  }

  const {data, error} = await supabase
    .from('pdr_meetings')
    .update({acknowledged_at: new Date().toISOString(), acknowledged_by: me.id})
    .eq('id', id)
    .is('acknowledged_at', null)
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data) return {ok: false, error: t('pdrDaGhiNhanHoacKhongThamGia')};
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true, message: t('pdrDaGhiNhanXong')};
}
