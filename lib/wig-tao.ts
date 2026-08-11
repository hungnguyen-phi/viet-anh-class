import {ngayCuaKy} from '@/lib/dates';
import {chiaNhip} from '@/lib/wig-nhip';
import {friendlyError} from '@/lib/errors';
import type {createClient} from '@/lib/supabase/server';
import type {Database} from '@/lib/database.types';

type Sb = Awaited<ReturnType<typeof createClient>>;
type Area = Database['public']['Enums']['wig_area'];
type Period = 'year' | 'month' | 'week';

// ════════════════════════════════════════════════════════════════════════════
// TẠO MỘT MỤC TIÊU (WIG) — MỘT ĐƯỜNG DUY NHẤT cho mọi nơi trong app.
// ════════════════════════════════════════════════════════════════════════════
//
// Hai chỗ tạo WIG lớp: nút "+ Tạo mục tiêu" ở /wig, và bước 3 của phòng họp (/wig/hop). Trước
// đây mỗi chỗ có hàm riêng, và chúng đã bắt đầu lệch nhau — một bên bắt buộc có tên, bên kia
// không; một bên nhận ngày từ trình duyệt, bên kia tự tính. Đúng cái bệnh "hai nguồn sự thật"
// mà cả đợt sửa này đang chữa, chỉ khác là nằm ở phía ghi thay vì phía đọc.
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

export type ThongTinWig = {
  class_id: string;
  period: Period;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  period_label: string;
  // 'tick'   — đích ĐẾM ĐƯỢC ("1200 bài"): máy đếm từ lượt tick, có vạch tiến độ thật.
  // 'manual' — đích GHI NHẬN NGOÀI ("điểm TB 8,0"): cô và trò tự theo dõi, đạt thì tick một ô.
  //
  // Phân biệt này có vì app KHÔNG có dữ liệu điểm môn (bảng điểm 0 dòng ngày 11/08/2026). Cho
  // một mục tiêu điểm số chạy ở chế độ 'tick' là để nó hiện một phần trăm suy ra từ số lượt tick,
  // tức là suy ra từ thứ chẳng liên quan gì tới điểm. Xem docs/MO_HINH_WIG.md §5.0 và 0101.
  measure_by?: 'tick' | 'manual';
  // Bắt buộc với tháng/tuần, bỏ qua với năm.
  parent_wig_id?: string;
  // Bắt buộc với năm; tháng/tuần thừa kế của cha.
  area?: Area;
};

// Kiểm CHUỖI CHA: mục tiêu tháng phải nằm dưới một mục tiêu NĂM, mục tiêu tuần dưới một THÁNG.
//
// Chủ dự án chốt luật này (2026-08-04): "phải có wig năm thì mới được tạo wig tháng, có wig tháng
// mới tạo wig tuần". Lý do không chỉ là gọn gàng — tiến độ năm là TỔNG các kỳ con (wig_actual,
// 0075), nên một mục tiêu tuần treo lơ lửng không cộng vào đâu cả: nó chạy suốt một tuần rồi biến
// mất khỏi mọi bảng tổng hợp, và không màn hình nào nói ra điều đó.
//
// Dữ liệu CŨ có mục tiêu tuần nằm thẳng dưới năm; luật này chỉ chặn tạo MỚI, không đụng tới chúng.
async function chaHopLe(
  supabase: Sb,
  classId: string,
  parentId: string,
  canPeriod: 'year' | 'month',
): Promise<{area: Area; unit: string; start_date: string; end_date: string} | null> {
  const {data} = await supabase
    .from('wigs')
    .select('area, unit, period, start_date, end_date')
    .eq('id', parentId)
    .eq('class_id', classId)
    .eq('scope', 'class')
    .maybeSingle();
  if (!data || data.period !== canPeriod) return null;
  return {
    area: data.area as Area,
    unit: data.unit,
    start_date: data.start_date,
    end_date: data.end_date,
  };
}

export async function taoMotWig(supabase: Sb, w: ThongTinWig): Promise<KetQuaTao> {
  if (!w.class_id) return {ok: false, loi: 'Thiếu lớp.'};
  if (w.period !== 'year' && w.period !== 'month' && w.period !== 'week')
    return {ok: false, loi: 'Không rõ đang tạo mục tiêu năm, tháng hay tuần.'};
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
  if (!w.unit) return {ok: false, field: 'unit', loi: 'Hãy nhập đơn vị (vd điểm, buổi, lần).'};

  const ky = ngayCuaKy(w.period, w.period_label);
  if (!ky) return {ok: false, field: 'period_label', loi: 'Hãy chọn kỳ cho mục tiêu này.'};

  // Lĩnh vực: mục tiêu năm tự khai, con THỪA KẾ của cha. Trước đây con cũng có ô lĩnh vực riêng —
  // đặt lệch cha một cái là nó rơi khỏi cây tổng hợp mà nhìn trên màn hình vẫn thấy nằm đúng chỗ.
  let area: Area;
  if (w.period === 'year') {
    if (!w.area) return {ok: false, field: 'area', loi: 'Hãy chọn lĩnh vực.'};
    area = w.area;
  } else {
    if (!w.parent_wig_id)
      return {
        ok: false,
        field: 'parent_wig_id',
        loi:
          w.period === 'month'
            ? 'Chọn mục tiêu NĂM mà mục tiêu tháng này thuộc về.'
            : 'Chọn mục tiêu THÁNG mà mục tiêu tuần này thuộc về.',
      };
    const cha = await chaHopLe(
      supabase,
      w.class_id,
      w.parent_wig_id,
      w.period === 'month' ? 'year' : 'month',
    );
    if (!cha)
      return {
        ok: false,
        field: 'parent_wig_id',
        loi:
          w.period === 'month'
            ? 'Mục tiêu năm này không còn nữa — chọn lại.'
            : 'Mục tiêu tháng này không còn nữa — chọn lại.',
      };
    area = cha.area;
    // Kỳ con phải NẰM TRONG kỳ cha. Không kiểm thì một mục tiêu tuần của tháng 9 treo được dưới
    // mục tiêu tháng 8, và tiến độ tháng 8 cộng vào đó một tuần chưa từng thuộc về nó.
    if (ky.start < cha.start_date || ky.end > cha.end_date)
      return {
        ok: false,
        field: 'period_label',
        loi: `Kỳ này nằm ngoài mục tiêu cha (${cha.start_date} → ${cha.end_date}). Chọn kỳ khác hoặc chọn mục tiêu cha khác.`,
      };
  }

  const {data, error} = await supabase
    .from('wigs')
    .insert({
      class_id: w.class_id,
      scope: 'class',
      title: w.title,
      baseline: w.baseline,
      area,
      period: w.period,
      period_label: w.period_label,
      target_value: w.target_value,
      unit: w.unit,
      start_date: ky.start,
      end_date: ky.end,
      parent_wig_id: w.period === 'year' ? null : w.parent_wig_id,
      measure_by: w.measure_by ?? 'tick',
    })
    .select('id')
    .maybeSingle();
  if (error) return {ok: false, loi: friendlyError(error)};
  // .select() để phân biệt "RLS chặn" với "đã tạo": không có nó thì lớp không thuộc quyền mình
  // vẫn báo thành công, và người dùng đi tìm một mục tiêu chưa từng được ghi.
  if (!data) return {ok: false, loi: 'Không tạo được mục tiêu (không có quyền với lớp này).'};

  // Mục tiêu NĂM thì rải luôn nhịp tháng + tuần. Cô khai một lần thay vì 12 lượt (3 cấp × 4 lĩnh
  // vực), và mọi tuần trong năm có sẵn chỗ để gắn việc — xem lib/wig-nhip.ts.
  if (w.period === 'year') {
    const loiNhip = await sinhNhip(supabase, data.id, {
      class_id: w.class_id,
      area,
      title: w.title,
      unit: w.unit,
      start: ky.start,
      end: ky.end,
      // Rải phần PHẢI ĐI THÊM, không rải cả phần đã có sẵn.
      tong: w.target_value - (w.baseline ?? 0),
      measure_by: w.measure_by ?? 'tick',
    });
    // Mục tiêu năm đã ghi được rồi — nhịp hỏng thì KHÔNG nuốt lỗi, nhưng cũng không giả vờ là
    // chưa tạo gì. Nói đúng cả hai vế để cô biết mình đang đứng ở đâu.
    if (loiNhip)
      return {
        ok: false,
        loi: `Đã tạo mục tiêu năm nhưng chưa rải được nhịp tháng/tuần: ${loiNhip}`,
      };
  }

  return {ok: true, id: data.id};
}

/**
 * Sinh mốc tháng + mốc tuần dưới một mục tiêu năm vừa tạo.
 *
 * Ghi tháng TRƯỚC rồi mới tới tuần, vì tuần phải trỏ `parent_wig_id` về đúng tháng chứa nó. Cả
 * hai đợt đều là MỘT câu insert nhiều dòng — một năm học có ~52 tuần, bắn 52 câu lẻ qua đường
 * tới Supabase là chỗ chờ dài nhất mà đợt audit tốc độ vừa rồi đã đi dọn.
 *
 * Trả về chuỗi lỗi nếu hỏng, `null` nếu xong.
 */
async function sinhNhip(
  supabase: Sb,
  namId: string,
  w: {
    class_id: string;
    area: Area;
    title: string;
    unit: string;
    start: string;
    end: string;
    tong: number;
    measure_by: 'tick' | 'manual';
  },
): Promise<string | null> {
  const nhip = chiaNhip(w.start, w.end, w.tong);
  if (nhip.tuan.length === 0) return null;

  const chung = {
    class_id: w.class_id,
    scope: 'class' as const,
    area: w.area,
    title: w.title,
    unit: w.unit,
    baseline: null,
    // Mốc thừa kế kiểu đo của mục tiêu năm. Để mốc là 'tick' trong khi năm là 'manual' thì mốc
    // tháng/tuần lại vẽ vạch suy ra từ lượt tick — đúng cái nói dối mà 0101 đi dẹp.
    measure_by: w.measure_by,
  };

  const {data: thang, error: eThang} = await supabase
    .from('wigs')
    .insert(
      nhip.thang.map((m) => ({
        ...chung,
        period: 'month' as const,
        period_label: m.label,
        target_value: m.target,
        start_date: m.start,
        end_date: m.end,
        parent_wig_id: namId,
      })),
    )
    .select('id, period_label');
  if (eThang) return friendlyError(eThang);

  const idTheoThang = new Map((thang ?? []).map((m) => [m.period_label as string, m.id]));

  const {error: eTuan} = await supabase.from('wigs').insert(
    nhip.tuan.map((t) => ({
      ...chung,
      period: 'week' as const,
      period_label: t.label,
      target_value: t.target,
      start_date: t.start,
      end_date: t.end,
      // Tuần thuộc tháng chứa ngày ĐẦU của nó — cùng luật với lib/wig-nhip.ts, nếu không thì một
      // tuần vắt qua hai tháng sẽ treo nhầm cha và tiến độ tháng lệch mà không ai thấy.
      parent_wig_id: idTheoThang.get(t.start.slice(0, 7)) ?? namId,
    })),
  );
  if (eTuan) return friendlyError(eTuan);

  return null;
}
