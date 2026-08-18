import {ngayCuaKy} from '@/lib/dates';
import {friendlyError} from '@/lib/errors';
import type {createClient} from '@/lib/supabase/server';
import type {Database} from '@/lib/database.types';

type Sb = Awaited<ReturnType<typeof createClient>>;
type Area = Database['public']['Enums']['wig_domain'];

// ════════════════════════════════════════════════════════════════════════════
// TẠO MỘT MỤC TIÊU (WIG) — MỘT ĐƯỜNG DUY NHẤT cho mọi nơi trong app.
// ════════════════════════════════════════════════════════════════════════════
//
// ĐỔI MÔ HÌNH 14/08/2026 (xem 0121). WIG chỉ còn CẤP NĂM:
//
//   "wig thì chỉ tạo wig năm thôi, gv tạo cho lớp, hs tạo cho hs gắn theo lớp, sau đó ko còn
//    tháng nữa, sau đó mỗi tuần sẽ là weekly commitment, không còn là wig tuần nữa"
//
// Nên cả cỗ máy chia mốc (lib/wig-nhip.ts, sinhNhip, chaHopLe, ràng buộc chuỗi năm→tháng→tuần)
// đã gỡ bỏ. Việc của một tuần nay treo dưới CAM KẾT — xem taoCamKet() ở cuối tệp.
//
// Đặt ở lib/ chứ không trong file 'use server': file đó chỉ được export hàm async, nên mọi thứ
// dùng chung phải sống bên ngoài.

export type KetQuaTao = {ok: true; id: string} | {ok: false; loi: string; field?: string};

// ── Hai bộ chuẩn hoá dùng chung cho MỌI chỗ ghi lead measure ──────────────────────────────────
// Trang /wig và phòng họp đều tạo việc; đặt luật ở một chỗ để hai bên không trôi khỏi nhau.

// Những thứ trong tuần mà một việc được tick (ISO: 1=T2 … 7=CN).
// Bỏ trống → T2–T6, mặc định của một việc học ngày thường. Đây là chỗ đặt mặc định, KHÔNG phải
// cột trong CSDL: cột để cả 7 thứ nên các việc tạo trước 0073 không bị siết ngược.
export function chuanHoaThu(raw: unknown[]): number[] {
  const n = raw.map((v) => Number(v)).filter((x) => Number.isInteger(x) && x >= 1 && x <= 7);
  const uniq = [...new Set(n)].sort((a, b) => a - b);
  return uniq.length > 0 ? uniq : [1, 2, 3, 4, 5];
}

// Một lượt tick đáng bao nhiêu đơn vị của mục tiêu cha (0076).
//
// TRẢ null KHI Ô RỖNG, và nơi gọi phải BỎ HẲN cột khỏi lệnh cập nhật — đừng thay bằng 1.
//
// Vì sao quan trọng: hệ số KHÔNG đóng băng vào từng lượt tick; wig_actual nhân nó lúc ĐỌC. Nên
// ghi đè 30 thành 1 là chia toàn bộ lịch sử tick cho 30 — một mục tiêu đang "30/30 đã đạt" tụt
// về "1/30" chỉ vì ai đó mở panel sửa để đổi cái tên rồi bấm Lưu. Ô number không có `required`
// thì trình duyệt gửi lên chuỗi rỗng mà không kêu gì, `??` chỉ bắt null nên chuỗi rỗng lọt qua,
// Number('') = 0, rồi bản cũ lặng lẽ biến nó thành 1 và báo "Đã cập nhật".
//
// Gõ bậy (chữ, số âm, 0) thì về 1: đó là giá trị mặc định có nghĩa, và CHECK ở CSDL chặn ≤ 0 làm
// lớp thứ hai.
export function chuanHoaHeSo(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ── MỤC TIÊU CUỘN ─────────────────────────────────────────────────────────────────────────────
// "86% học sinh của lớp có 6/8 môn tính điểm đạt 6.5 trở lên" — dạng của cả 13 mục tiêu lớp thật
// ở cơ sở Gò Vấp. Nó không phải một quãng đường A→B mà là một PHÉP ĐẾM: đếm xem bao nhiêu đơn vị
// con đã đạt đủ số mục tiêu năm của mình.
//
// `tong_dich` (số 8 trong "6/8 môn") KHÔNG tham gia phép tính — em đặt 7 mục tiêu môn và đạt 6
// thì vẫn là đạt. Nó chỉ để câu chữ trên màn hình giống hệt câu cô đã viết trong kế hoạch.
export type ThongTinCuon = {
  ty_le_can: number;
  so_dich_can: number;
  tong_dich: number | null;
};

export type ThongTinWig = {
  /** Mục tiêu trường thì bỏ trống và truyền campus_id. */
  class_id: string;
  /** Mặc định 'class'. 'school' bắt buộc đi kèm campus_id và measure_by 'cuon'. */
  scope?: 'class' | 'school';
  campus_id?: string;
  cuon?: ThongTinCuon;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  /** Nhãn năm học, vd '2026-2027'. */
  period_label: string;
  // 'tick'   — đích ĐẾM ĐƯỢC ("1200 bài"): máy cộng từ lượt tick để vẽ vạch tiến độ.
  // 'manual' — đích GHI NHẬN NGOÀI ("điểm TB 8,0"): cô và trò tự theo dõi, đạt thì tick một ô.
  // 'cuon'   — số của nó do MÁY ĐẾM NGƯỢC từ các đơn vị con; xem ThongTinCuon.
  //
  // LƯU Ý SAU 0121: vạch tiến độ của mục tiêu NĂM vẫn còn (chủ dự án: "vẫn có vạch tiến độ, chưa
  // đủ thì cảnh báo chậm…"), nhưng THẮNG/THUA thì thôi suy từ tick — nó là V/X do người bấm trên
  // từng cam kết tuần.
  measure_by?: 'tick' | 'manual' | 'cuon';
  area?: Area;
};

// Mục tiêu cuộn đi đường riêng vì gần như không dùng được ô nào của đường thường: không có đơn
// vị (luôn là %), không có mốc xuất phát (đếm từ 0 em), và số của nó do máy đếm ngược.
// Vẫn vào chung một cửa taoMotWig() để nơi gọi chỉ biết một hàm.
async function taoCuon(supabase: Sb, w: ThongTinWig): Promise<KetQuaTao> {
  const c = w.cuon;
  const laTruong = w.scope === 'school';
  if (!c) return {ok: false, loi: 'Thiếu hai con số của phép cuộn.'};
  if (!w.title) return {ok: false, field: 'title', loi: 'Hãy đặt tên cho mục tiêu.'};
  if (w.title.length > 160)
    return {ok: false, field: 'title', loi: 'Tên mục tiêu tối đa 160 ký tự.'};
  if (!Number.isFinite(c.ty_le_can) || c.ty_le_can <= 0 || c.ty_le_can > 100)
    return {ok: false, field: 'ty_le_can', loi: 'Tỉ lệ cần đạt phải nằm trong khoảng 1–100%.'};
  if (!Number.isInteger(c.so_dich_can) || c.so_dich_can < 1)
    return {
      ok: false,
      field: 'so_dich_can',
      loi: `Mỗi ${laTruong ? 'lớp' : 'bạn'} cần đạt ít nhất 1 mục tiêu.`,
    };
  if (c.tong_dich !== null && (!Number.isInteger(c.tong_dich) || c.tong_dich < c.so_dich_can))
    return {
      ok: false,
      field: 'tong_dich',
      loi: 'Tổng số mục tiêu không được nhỏ hơn số cần đạt.',
    };
  if (!w.area) return {ok: false, field: 'area', loi: 'Hãy chọn lĩnh vực.'};
  if (laTruong && !w.campus_id) return {ok: false, loi: 'Thiếu cơ sở.'};
  if (!laTruong && !w.class_id) return {ok: false, loi: 'Thiếu lớp.'};

  const ky = ngayCuaKy('year', w.period_label);
  if (!ky) return {ok: false, field: 'period_label', loi: 'Hãy chọn năm học cho mục tiêu này.'};

  const {data, error} = await supabase
    .from('wigs')
    .insert({
      class_id: laTruong ? null : w.class_id,
      campus_id: laTruong ? w.campus_id : null,
      scope: laTruong ? 'school' : 'class',
      title: w.title,
      area: w.area,
      period: 'year',
      period_label: w.period_label,
      // Đích CHÍNH LÀ tỉ lệ, và đơn vị là %. Hai cột này không phải bản sao thừa của ty_le_can:
      // mọi màn hình cũ đọc target_value/unit để vẽ vạch và ghi chú, nên để trống là chúng hiện
      // một mục tiêu "0" mà không báo gì.
      target_value: c.ty_le_can,
      unit: '%',
      baseline: null,
      start_date: ky.start,
      end_date: ky.end,
      measure_by: 'cuon',
      ty_le_can: c.ty_le_can,
      so_dich_can: c.so_dich_can,
      tong_dich: c.tong_dich,
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  if (!data)
    return {
      ok: false,
      loi: laTruong
        ? 'Không tạo được mục tiêu trường (chỉ ban giám hiệu của cơ sở này mới đặt được).'
        : 'Không tạo được mục tiêu (không có quyền với lớp này).',
    };
  return {ok: true, id: data.id};
}

export async function taoMotWig(supabase: Sb, w: ThongTinWig): Promise<KetQuaTao> {
  if (w.measure_by === 'cuon' || w.scope === 'school') return taoCuon(supabase, w);
  if (!w.class_id) return {ok: false, loi: 'Thiếu lớp.'};
  // Tên là BẮT BUỘC ở tầng ứng dụng (cột DB để nullable cho các WIG cũ). Một mục tiêu không tên
  // thì mọi màn hình sau đó chỉ hiện được con số trần, không ai biết nó là mục tiêu gì.
  if (!w.title) return {ok: false, field: 'title', loi: 'Hãy đặt tên cho mục tiêu.'};
  if (w.title.length > 160)
    return {ok: false, field: 'title', loi: 'Tên mục tiêu tối đa 160 ký tự.'};
  if (!Number.isFinite(w.target_value) || w.target_value <= 0)
    return {ok: false, field: 'target_value', loi: 'Mục tiêu phải là số lớn hơn 0.'};
  // "Từ" được phép bỏ trống (chưa đo được mốc đầu), nhưng gõ rồi thì phải là số hợp lệ.
  if (w.baseline !== null && (!Number.isFinite(w.baseline) || w.baseline < 0))
    return {ok: false, field: 'baseline', loi: 'Mốc xuất phát phải là số từ 0 trở lên.'};
  if (w.baseline !== null && w.baseline >= w.target_value)
    return {
      ok: false,
      field: 'baseline',
      loi: 'Mốc xuất phát phải nhỏ hơn mục tiêu — nếu không thì không còn gì để cải thiện.',
    };
  if (!w.unit)
    return {ok: false, field: 'unit', loi: 'Hãy nhập đơn vị (vd điểm, buổi, lần).'};
  if (!w.area) return {ok: false, field: 'area', loi: 'Hãy chọn lĩnh vực.'};

  const ky = ngayCuaKy('year', w.period_label);
  if (!ky) return {ok: false, field: 'period_label', loi: 'Hãy chọn năm học cho mục tiêu này.'};

  const {data, error} = await supabase
    .from('wigs')
    .insert({
      class_id: w.class_id,
      scope: 'class',
      title: w.title,
      baseline: w.baseline,
      area: w.area,
      period: 'year',
      period_label: w.period_label,
      target_value: w.target_value,
      unit: w.unit,
      start_date: ky.start,
      end_date: ky.end,
      measure_by: w.measure_by === 'manual' ? 'manual' : 'tick',
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  // .select() để phân biệt "RLS chặn" với "đã tạo": không có nó thì lớp không thuộc quyền mình
  // vẫn báo thành công, và người dùng đi tìm một mục tiêu chưa từng được ghi.
  if (!data) return {ok: false, loi: 'Không tạo được mục tiêu (không có quyền với lớp này).'};

  // KHÔNG rải nhịp tháng/tuần nữa — xem ghi chú ở đầu tệp.
  return {ok: true, id: data.id};
}

// ════════════════════════════════════════════════════════════════════════════
// CAM KẾT TUẦN — một lời hứa, tối đa 2 mỗi tuần.
// ════════════════════════════════════════════════════════════════════════════
//
// Cam kết KHÔNG mang con số đích của riêng nó: con số nằm ở các việc dẫn dắt treo dưới. Lĩnh vực
// cũng không hỏi — CSDL tự thừa kế từ mục tiêu năm (trigger cam_ket_hop_le, 0121), vì khai lệch
// một cái là cam kết rơi khỏi cây tổng hợp mà nhìn màn hình vẫn thấy nằm đúng chỗ.
//
// Bốn cái chặn (tối đa 2, treo đúng mục tiêu, không treo vào mục tiêu cuộn, tuần đã chốt thì
// khoá) đều nằm ở CSDL. Ở đây chỉ kiểm những thứ để báo lỗi tử tế trước khi đi một vòng mạng.
export type ThongTinCamKet = {
  wig_id: string;
  class_id: string;
  /** Bỏ trống = cam kết của LỚP. */
  student_id?: string | null;
  /** Thứ Hai của tuần, dạng YYYY-MM-DD. */
  week_start: string;
  title: string;
};

export async function taoCamKet(supabase: Sb, c: ThongTinCamKet): Promise<KetQuaTao> {
  if (!c.wig_id)
    return {ok: false, field: 'wig_id', loi: 'Chọn mục tiêu năm mà cam kết này phục vụ.'};
  if (!c.class_id) return {ok: false, loi: 'Thiếu lớp.'};
  if (!c.week_start) return {ok: false, field: 'week_start', loi: 'Thiếu tuần.'};
  const ten = c.title.trim();
  if (!ten) return {ok: false, field: 'title', loi: 'Hãy viết cam kết của tuần này.'};
  if (ten.length > 160) return {ok: false, field: 'title', loi: 'Cam kết tối đa 160 ký tự.'};

  const {data, error} = await supabase
    .from('commitments')
    .insert({
      wig_id: c.wig_id,
      class_id: c.class_id,
      student_id: c.student_id ?? null,
      week_start: c.week_start,
      title: ten,
      // Cột NOT NULL nhưng trigger đè lại bằng lĩnh vực của mục tiêu năm. Gửi một giá trị hợp lệ
      // bất kỳ chỉ để qua cửa NOT NULL; đừng đọc nó như một lựa chọn của người dùng.
      area: 'knowledge',
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  if (!data) return {ok: false, loi: 'Không tạo được cam kết (không có quyền với lớp này).'};
  return {ok: true, id: data.id};
}
