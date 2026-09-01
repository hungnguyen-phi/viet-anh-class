import {friendlyError} from '@/lib/errors';
import type {createClient} from '@/lib/supabase/server';
import type {Database} from '@/lib/database.types';

type Sb = Awaited<ReturnType<typeof createClient>>;
type LinhVuc = Database['public']['Enums']['wig_domain'];
type MucTieuInsert = Database['public']['Tables']['muc_tieu']['Insert'];
type CamKetInsert = Database['public']['Tables']['cam_ket']['Insert'];

// ════════════════════════════════════════════════════════════════════════════
// TẠO MỤC TIÊU + CAM KẾT — MỘT ĐƯỜNG DUY NHẤT cho mọi nơi trong app (PA2).
// ════════════════════════════════════════════════════════════════════════════
//
// ĐỔI MÔ HÌNH PA2 (0161–0169). Bảng cũ (wigs / commitments / lead_measures) ĐÃ DROP. Đường ghi
// nay trỏ hai bảng mới:
//   · muc_tieu — mục tiêu 4 cấp (trường / lớp / nhóm / em), nhiều kiểu đích (10-SCHEMA §2.1)
//   · cam_ket  — lời hứa 1–4 tuần, không còn vòng duyệt (10-SCHEMA §4.1)
//
// Việc theo tuần (lead measure cũ) nay là bảng `thuoc` riêng — KHÔNG đi qua tệp này; xem action
// tạo/sửa thước của màn cô và màn em.
//
// Đặt ở lib/ chứ không trong file 'use server': file đó chỉ được export hàm async, nên mọi thứ
// dùng chung (kiểu, hàm kiểm) phải sống bên ngoài.
//
// TRIẾT LÝ KIỂM (CLAUDE.md §5): luật thật nằm ở CHECK/trigger/RLS của CSDL. Ở đây chỉ chặn những
// lỗi người-dùng-hay-gặp để trả một câu tiếng người TRƯỚC khi đi một vòng mạng; phần còn lại để
// CHECK bắt rồi friendlyError() dịch. Mỗi nhánh dưới đây soi đúng một ràng buộc trong 10-SCHEMA.

export type KetQuaTao = {ok: true; id: string} | {ok: false; loi: string; field?: string};

// ── Chuẩn hoá NGÀY ÁP DỤNG trong tuần (ISO: 1=T2 … 7=CN) ────────────────────────────────────────
// Dùng cho mảng `ngay_ap_dung` của `thuoc` và mọi chỗ chọn thứ. Bỏ trống → T2–T6, mặc định của
// một việc học ngày thường (CSDL để cả 7 thứ nên các bản ghi cũ không bị siết ngược).
export function chuanHoaThu(raw: unknown[]): number[] {
  const n = raw.map((v) => Number(v)).filter((x) => Number.isInteger(x) && x >= 1 && x <= 7);
  const uniq = [...new Set(n)].sort((a, b) => a - b);
  return uniq.length > 0 ? uniq : [1, 2, 3, 4, 5];
}

// ════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU (muc_tieu)
// ════════════════════════════════════════════════════════════════════════════
//
// Một cửa duy nhất cho cả 4 cấp và 6 kiểu đích, để màn cô / màn em / màn BGH không mỗi nơi một
// bộ luật (đúng bệnh "hai nguồn sự thật" cả đợt PA2 đang chữa). `cap` quyết cột khoá; `kieu_dich`
// quyết ô số nào bắt buộc.
export type ThongTinMucTieu = {
  cap: 'truong' | 'lop' | 'nhom' | 'em';
  /** Bắt buộc khi cap='truong'. Các cấp khác để trống thì tự suy từ lớp. */
  campus_id?: string;
  class_id?: string | null;
  nhom_id?: string | null;
  student_id?: string | null;
  ten: string;
  linh_vuc?: LinhVuc;
  subject_id?: string | null;
  // 'toi'          — đi từ x tới y (có mốc xuất phát hoặc chưa đo)
  // 'tran_tich_luy'— trần tích luỹ, luôn chiều 'giu'
  // 'giu'          — giữ mức, cần chu kỳ
  // 'toc_do_ky'    — tốc độ mỗi kỳ, cần chu kỳ
  // 'ti_le_dat'    — % đơn vị con đạt, cần lay_tu
  // 'chu'          — đích bằng CHỮ (y_chu), không cần số/đơn vị
  kieu_dich?: 'toi' | 'tran_tich_luy' | 'giu' | 'toc_do_ky' | 'ti_le_dat' | 'chu';
  chieu?: 'tang' | 'giam' | 'giu';
  x_so?: number | null;
  y_so?: number | null;
  chua_do_x?: boolean;
  x_chu?: string | null;
  y_chu?: string | null;
  don_vi_id?: string | null;
  ky?: 'tuan' | 'hai_tuan' | 'thang' | null;
  /** YYYY-MM-DD. Bỏ trống → CSDL lấy hôm nay (giờ VN). */
  bat_dau?: string;
  /** YYYY-MM-DD — BẮT BUỘC. */
  ket_thuc: string;
  /** Nhãn năm học, vd '2026-2027'. Bỏ trống → CSDL lấy năm học hiện tại. */
  nam_hoc?: string;
  nguon_so?: 'thuoc' | 'ghi_tay' | 'he_thong' | 'con' | 'thanh_phan';
  nguon_he_thong?: 'diem_danh' | null;
  gop_con?: 'cong' | 'trung_binh' | 'ti_le_dat' | null;
  gop_thanh_phan?: 'cong' | 'trung_binh' | null;
  nguong_con?: number | null;
  lay_tu?: 'thuoc' | 'muc_tieu_em' | 'muc_tieu_lop' | null;
  mau_id?: string | null;
  trang_thai?: 'nhap' | 'gui' | 'duyet' | 'tra_lai' | 'dong';
  dang_tap_trung?: boolean;
};

export async function taoMucTieu(supabase: Sb, w: ThongTinMucTieu): Promise<KetQuaTao> {
  // ── Cấp + cột khoá (mt_khoa_ck) ────────────────────────────────────────────────────────────
  let campus_id = w.campus_id ?? null;
  let class_id: string | null = null;
  let nhom_id: string | null = null;
  let student_id: string | null = null;

  if (w.cap === 'truong') {
    if (!campus_id) return {ok: false, loi: 'Thiếu cơ sở cho mục tiêu trường.'};
  } else {
    if (!w.class_id) return {ok: false, loi: 'Thiếu lớp.'};
    class_id = w.class_id;
    if (w.cap === 'nhom') {
      if (!w.nhom_id) return {ok: false, field: 'nhom_id', loi: 'Hãy chọn nhóm cho mục tiêu này.'};
      nhom_id = w.nhom_id;
    } else if (w.cap === 'em') {
      if (!w.student_id) return {ok: false, loi: 'Thiếu học sinh cho mục tiêu cá nhân.'};
      student_id = w.student_id;
    }
    // campus_id NOT NULL kể cả với mục tiêu lớp/nhóm/em — tự tra từ lớp nếu nơi gọi không đưa.
    if (!campus_id) {
      const {data: lop, error: eLop} = await supabase
        .from('classes')
        .select('campus_id')
        .eq('id', class_id)
        .maybeSingle();
      if (eLop) return {ok: false, loi: friendlyError(eLop)};
      if (!lop) return {ok: false, loi: 'Không tìm thấy lớp (hoặc không có quyền với lớp này).'};
      campus_id = lop.campus_id;
    }
  }

  // ── Tên (mt_ten_ck) ────────────────────────────────────────────────────────────────────────
  const ten = w.ten.trim();
  if (!ten) return {ok: false, field: 'ten', loi: 'Hãy đặt tên cho mục tiêu.'};
  if (ten.length > 200) return {ok: false, field: 'ten', loi: 'Tên mục tiêu tối đa 200 ký tự.'};

  // ── Ngày (mt_ngay_ck) ──────────────────────────────────────────────────────────────────────
  if (!w.ket_thuc) return {ok: false, field: 'ket_thuc', loi: 'Hãy chọn ngày kết thúc.'};
  if (w.bat_dau && w.bat_dau > w.ket_thuc)
    return {ok: false, field: 'ket_thuc', loi: 'Ngày kết thúc phải sau ngày bắt đầu.'};

  const kieu_dich = w.kieu_dich ?? 'toi';
  const chieu = w.chieu ?? (kieu_dich === 'tran_tich_luy' ? 'giu' : 'tang');
  const nguon_so = w.nguon_so ?? 'ghi_tay';

  // ── Đích theo kiểu ─────────────────────────────────────────────────────────────────────────
  if (kieu_dich === 'chu') {
    // mt_chu_ck: đích bằng chữ thì y_chu bắt buộc; số/đơn vị bỏ qua.
    if (!w.y_chu || !w.y_chu.trim())
      return {ok: false, field: 'y_chu', loi: 'Hãy mô tả đích cần đạt.'};
  } else {
    // mt_so_dich_ck: mọi kiểu số đều cần y_so.
    if (w.y_so === null || w.y_so === undefined || !Number.isFinite(w.y_so))
      return {ok: false, field: 'y_so', loi: 'Hãy nhập con số cần đạt.'};

    if (kieu_dich === 'toi') {
      // mt_y_can_x_ck: có mốc xuất phát HOẶC đánh dấu chưa đo được.
      const coX = w.x_so !== null && w.x_so !== undefined && Number.isFinite(w.x_so);
      if (!coX && !w.chua_do_x)
        return {
          ok: false,
          field: 'x_so',
          loi: 'Nhập mốc bắt đầu, hoặc đánh dấu "chưa đo được".',
        };
      // mt_chieu_thuan_ck: chiều phải khớp với x→y (trừ khi giữ mức).
      if (coX && chieu !== 'giu') {
        if (chieu === 'tang' && !((w.x_so as number) < (w.y_so as number)))
          return {ok: false, field: 'y_so', loi: 'Đích tăng thì số cần đạt phải lớn hơn mốc bắt đầu.'};
        if (chieu === 'giam' && !((w.x_so as number) > (w.y_so as number)))
          return {ok: false, field: 'y_so', loi: 'Đích giảm thì số cần đạt phải nhỏ hơn mốc bắt đầu.'};
      }
    }
    if (kieu_dich === 'tran_tich_luy' && chieu !== 'giu')
      // mt_tran_giu_ck
      return {ok: false, field: 'chieu', loi: 'Trần tích luỹ luôn là giữ mức, không tăng/giảm.'};
    if ((kieu_dich === 'toc_do_ky' || kieu_dich === 'giu') && !w.ky)
      // mt_ky_can_ck
      return {ok: false, field: 'ky', loi: 'Hãy chọn chu kỳ (tuần / hai tuần / tháng).'};
    if (kieu_dich === 'ti_le_dat' && !w.lay_tu)
      // mt_ti_le_ck
      return {ok: false, field: 'lay_tu', loi: 'Hãy chọn tỉ lệ này đếm trên cái gì.'};
  }

  // ── Đơn vị (mt_don_vi_ck): mọi kiểu trừ 'chu'/'ti_le_dat' đều cần đơn vị ────────────────────
  if (kieu_dich !== 'chu' && kieu_dich !== 'ti_le_dat' && !w.don_vi_id)
    return {ok: false, field: 'don_vi_id', loi: 'Hãy chọn đơn vị (vd điểm, bài, buổi).'};

  // ── Nguồn số (mt_nguon_con_ck / mt_gop_tp_ck / mt_he_thong_ck) ─────────────────────────────
  if (nguon_so === 'con') {
    if (w.cap === 'em')
      return {ok: false, loi: 'Mục tiêu của một em không thể gộp số từ mục tiêu con.'};
    if (!w.gop_con)
      return {ok: false, field: 'gop_con', loi: 'Hãy chọn cách gộp số từ mục tiêu con.'};
  }
  if (nguon_so === 'thanh_phan' && !w.gop_thanh_phan)
    return {ok: false, field: 'gop_thanh_phan', loi: 'Hãy chọn cách gộp các thành phần.'};
  if (nguon_so === 'he_thong' && !w.nguon_he_thong)
    return {ok: false, loi: 'Thiếu nguồn hệ thống cho mục tiêu này.'};

  const row: MucTieuInsert = {
    cap: w.cap,
    campus_id,
    class_id,
    nhom_id,
    student_id,
    ten,
    linh_vuc: w.linh_vuc ?? 'knowledge',
    subject_id: w.subject_id ?? null,
    kieu_dich,
    chieu,
    x_so: kieu_dich === 'chu' ? null : w.x_so ?? null,
    y_so: kieu_dich === 'chu' ? null : w.y_so ?? null,
    chua_do_x: w.chua_do_x ?? false,
    x_chu: w.x_chu ?? null,
    y_chu: kieu_dich === 'chu' ? (w.y_chu as string).trim() : null,
    don_vi_id: w.don_vi_id ?? null,
    ky: w.ky ?? null,
    ket_thuc: w.ket_thuc,
    nguon_so,
    nguon_he_thong: w.nguon_he_thong ?? null,
    gop_con: w.gop_con ?? null,
    gop_thanh_phan: w.gop_thanh_phan ?? null,
    nguong_con: w.nguong_con ?? null,
    lay_tu: w.lay_tu ?? null,
    mau_id: w.mau_id ?? null,
    trang_thai: w.trang_thai ?? 'nhap',
    dang_tap_trung: w.dang_tap_trung ?? false,
  };
  // Chỉ đặt bat_dau/nam_hoc khi nơi gọi truyền — để trống cho CSDL lấy mặc định (hôm nay VN / năm
  // học hiện tại) thay vì áp một giá trị sai.
  if (w.bat_dau) row.bat_dau = w.bat_dau;
  if (w.nam_hoc) row.nam_hoc = w.nam_hoc;

  const {data, error} = await supabase.from('muc_tieu').insert(row).select('id').maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  // .select() để phân biệt "RLS chặn" với "đã tạo": không có nó thì bản ghi ngoài quyền vẫn báo
  // thành công, và người dùng đi tìm một mục tiêu chưa từng được ghi.
  if (!data) return {ok: false, loi: 'Không tạo được mục tiêu (không có quyền ghi ở đây).'};
  return {ok: true, id: data.id};
}

// ════════════════════════════════════════════════════════════════════════════
// CAM KẾT (cam_ket) — một lời hứa 1–4 tuần.
// ════════════════════════════════════════════════════════════════════════════
//
// Cam kết KHÔNG còn vòng duyệt (10-SCHEMA §4.1). Luật "tối đa 2/tuần", ai được chấm, khoá sau khi
// chấm/kể lại — đều ở trigger ck_truoc_them/ck_truoc_sua (20-QUYEN §3.4). Ở đây chỉ kiểm những
// thứ để báo lỗi tử tế trước khi đi một vòng mạng.
export type ThongTinCamKet = {
  chu_the: 'lop' | 'nhom' | 'em';
  class_id: string;
  nhom_id?: string | null;
  student_id?: string | null;
  /** Thứ Hai của tuần, dạng YYYY-MM-DD. */
  tuan_bat_dau: string;
  /** 1–4, mặc định 1. */
  so_tuan?: number;
  noi_dung: string;
  /** Con số hứa (tuỳ chọn). Có số thì BẮT BUỘC có đơn vị (ck_don_vi_ck), và ngược lại. */
  so_hua?: number | null;
  don_vi_id?: string | null;
  /** Neo cam kết vào một thước / một mục tiêu (tuỳ chọn). */
  thuoc_id?: string | null;
  muc_tieu_id?: string | null;
  pdr_meeting_id?: string | null;
};

export async function taoCamKet(supabase: Sb, c: ThongTinCamKet): Promise<KetQuaTao> {
  if (!c.class_id) return {ok: false, loi: 'Thiếu lớp.'};

  // Cột khoá (ck_khoa_ck)
  let nhom_id: string | null = null;
  let student_id: string | null = null;
  if (c.chu_the === 'nhom') {
    if (!c.nhom_id) return {ok: false, loi: 'Thiếu nhóm cho cam kết của nhóm.'};
    nhom_id = c.nhom_id;
  } else if (c.chu_the === 'em') {
    if (!c.student_id) return {ok: false, loi: 'Thiếu học sinh cho cam kết cá nhân.'};
    student_id = c.student_id;
  }

  // Tuần (ck_thu_hai_ck): phải là thứ Hai. So bằng giờ trưa UTC để tránh lệch ngày ở biên.
  if (!c.tuan_bat_dau) return {ok: false, field: 'tuan_bat_dau', loi: 'Thiếu tuần.'};
  const isodow = new Date(`${c.tuan_bat_dau}T12:00:00Z`).getUTCDay(); // 0=CN … 1=T2
  if (isodow !== 1)
    return {ok: false, field: 'tuan_bat_dau', loi: 'Tuần phải bắt đầu từ thứ Hai.'};

  // Số tuần (ck_so_tuan_ck)
  const so_tuan = c.so_tuan ?? 1;
  if (!Number.isInteger(so_tuan) || so_tuan < 1 || so_tuan > 4)
    return {ok: false, field: 'so_tuan', loi: 'Cam kết kéo dài từ 1 đến 4 tuần.'};

  // Nội dung (ck_noi_dung_ck)
  const noi_dung = c.noi_dung.trim();
  if (!noi_dung) return {ok: false, field: 'noi_dung', loi: 'Hãy viết cam kết của tuần này.'};
  if (noi_dung.length > 300)
    return {ok: false, field: 'noi_dung', loi: 'Cam kết tối đa 300 ký tự.'};

  // Số hứa ↔ đơn vị đi cặp (ck_don_vi_ck, ck_so_hua_ck)
  const coSo = c.so_hua !== null && c.so_hua !== undefined;
  if (coSo) {
    if (!Number.isFinite(c.so_hua as number) || (c.so_hua as number) < 0)
      return {ok: false, field: 'so_hua', loi: 'Con số hứa phải từ 0 trở lên.'};
    if (!c.don_vi_id)
      return {ok: false, field: 'don_vi_id', loi: 'Có con số thì hãy chọn đơn vị.'};
  } else if (c.don_vi_id) {
    return {ok: false, field: 'so_hua', loi: 'Đã chọn đơn vị thì hãy nhập con số hứa.'};
  }

  const row: CamKetInsert = {
    chu_the: c.chu_the,
    class_id: c.class_id,
    nhom_id,
    student_id,
    tuan_bat_dau: c.tuan_bat_dau,
    so_tuan,
    noi_dung,
    so_hua: coSo ? (c.so_hua as number) : null,
    don_vi_id: coSo ? c.don_vi_id ?? null : null,
    thuoc_id: c.thuoc_id ?? null,
    muc_tieu_id: c.muc_tieu_id ?? null,
    pdr_meeting_id: c.pdr_meeting_id ?? null,
  };

  const {data, error} = await supabase.from('cam_ket').insert(row).select('id').maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  if (!data) return {ok: false, loi: 'Không tạo được cam kết (không có quyền ghi ở đây).'};
  return {ok: true, id: data.id};
}
