'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {taoMotWig, chuanHoaThu, chuanHoaHeSo} from '@/lib/wig-tao';
import {AREAS} from '@/lib/areas';
import type {Database} from '@/lib/database.types';
import {kieuDonVi} from '@/lib/don-vi';

type Area = Database['public']['Enums']['wig_area'];

// Hai bộ đọc FormData mỏng, luật nằm ở lib/wig-tao.ts (phòng họp cũng dùng, tên trường khác).
function parseWeekdays(formData: FormData): number[] {
  return chuanHoaThu(formData.getAll('weekdays'));
}
function parseUnitPerTick(formData: FormData): number | null {
  const raw = formData.get('unit_per_tick');
  return chuanHoaHeSo(raw === null ? null : String(raw));
}

// Giữ lại ?class= khi redirect để không nhảy về lớp mặc định (WIG vừa tạo "biến mất"), và ?week=
// để không nhảy về tuần hiện tại (WIG vừa sửa cũng "biến mất" y như vậy, chỉ theo chiều thời gian).
//
// Mỗi action ở dưới che tên này bằng một hàm cục bộ đã gắn sẵn lớp + tuần:
//   const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
// nhờ vậy hàng chục lời gọi flash('...') sẵn có không phải sửa từng cái — và không có chỗ nào
// lỡ quên truyền tuần.
function flashTo(msg: string, classId?: string, week?: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  if (week) q.set('week', week);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/wig?${q.toString()}`);
}

// Tuần đang xem, do ô ẩn name="week" trên mọi form của /wig gửi lên. Rỗng = tuần hiện tại.
function weekOf(formData: FormData): string | undefined {
  return String(formData.get('week') ?? '') || undefined;
}

// setTickLockDow ĐÃ BỎ (0081). Mốc chốt tick nay không phải một ngày giáo viên khai trước, mà là
// việc thật sự xảy ra: ghi nhận buổi họp cho tuần nào thì tick tuần ấy khoá lại.

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type CreateWigState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// ════════════════════════════════════════════════════════════════════════════
// TẠO MỤC TIÊU — MỘT ĐƯỜNG DUY NHẤT cho cả năm, tháng, tuần.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây có HAI hàm tạo: createYearWig (báo lỗi ngay tại chỗ, giữ nguyên chữ đã gõ) và
// createWig (chuyển trang kèm một câu lỗi, chữ đã gõ mất sạch). Cùng một việc, hai cách cư xử —
// người dùng gõ hỏng một ô ở form này thì được sửa, ở form kia thì phải gõ lại từ đầu.
//
// Phần kiểm và ghi nằm ở lib/wig-tao.ts, dùng chung với bước 3 của phòng họp — hai chỗ tạo WIG
// mà hai bộ luật là đúng cái bệnh "hai nguồn sự thật" cả đợt sửa này đang chữa.
export async function taoWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const period = String(formData.get('period') ?? '') as 'year' | 'month' | 'week';
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const supabase = await createClient();

  const kq = await taoMotWig(supabase, {
    class_id: String(formData.get('class_id') ?? ''),
    period,
    title,
    baseline: baseline_raw === '' ? null : Number(baseline_raw),
    target_value: Number(String(formData.get('target_value') ?? '').trim()),
    unit: String(formData.get('unit') ?? '').trim(),
    period_label: String(formData.get('period_label') ?? '').trim(),
    parent_wig_id: String(formData.get('parent_wig_id') ?? '').trim() || undefined,
    area: (String(formData.get('area') ?? '') as Area) || undefined,
    // Ô này chỉ có ở tab NĂM; tháng/tuần không gửi và thừa kế từ cha trong taoMotWig. Giá trị lạ
    // rơi về 'tick' — mặc định của cột, và là cái duy nhất app tự đếm được.
    measure_by: String(formData.get('measure_by') ?? '') === 'manual' ? 'manual' : 'tick',
  });
  if (!kq.ok) return {ok: false, error: kq.loi, fieldError: kq.field};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  const ten = period === 'year' ? 'năm' : period === 'month' ? 'tháng' : 'tuần';
  return {ok: true, message: `Đã tạo mục tiêu ${ten} “${title}”.`};
}

// ════════════════════════════════════════════════════════════════════════════
// LƯU MỘT VIỆC (lead measure) — tạo mới hoặc sửa, cùng một đường.
// ════════════════════════════════════════════════════════════════════════════
//
// Gộp addLeadMeasure + editLeadMeasure. Hai hàm cũ khác nhau đúng một chữ (insert/update) nhưng
// mỗi hàm lại kiểm dữ liệu theo cách riêng, và cả hai đều chuyển trang kèm câu lỗi — tức là gõ
// hỏng một ô là mất sạch năm ô còn lại. Nay trả state để form giữ nguyên chữ đã gõ và chỉ tô đỏ
// đúng ô sai.
export async function luuViec(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('lead_measure_id') ?? '').trim();
  const wig_id = String(formData.get('wig_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const target_value = Number(target_raw);
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const sub_category = String(formData.get('sub_category') ?? '').trim() || null;
  const active_weekdays = parseWeekdays(formData);
  const upt = parseUnitPerTick(formData);
  // CÁC EM TỰ ĐIỀN SỐ MỖI NGÀY — thay vì một chạm nhân hệ số.
  //
  // Việc của EM đã có lựa chọn này từ 0110; việc CHUNG của lớp thì chưa, nên "đọc sách" của cả
  // lớp chỉ ghi được "một buổi = 30 trang" cố định, còn hôm nay 12 trang mai 40 trang thì không
  // có chỗ ghi. Chủ dự án chốt 14/08/2026.
  //
  // ĐƠN VỊ ĐO LẠI (kg, cm, điểm) LUÔN là ô điền số — không có nghĩa nào cho "một chạm = 1 kg".
  // Và cả hai trường hợp đều ép hệ số về 1: số em gõ CHÍNH LÀ con số, nhân thêm là sai thang
  // (class_lead_board và wig_actual đều nhân unit_per_tick khi cộng).
  const kieu = kieuDonVi(unit);
  const nhap_luong = kieu === 'do' || String(formData.get('nhap_luong') ?? '') === '1';
  const heSo = nhap_luong ? 1 : (upt ?? 1);

  if (!id && !wig_id) return {ok: false, error: 'Chưa rõ việc này thuộc mục tiêu tuần nào.'};
  if (!title) return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho việc này.'};
  if (title.length > 160) return {ok: false, fieldError: 'title', error: 'Tên việc tối đa 160 ký tự.'};
  // MỤC TIÊU LÀ SỐ NGUYÊN.
  //
  // Đếm bài, buổi, lần — không có nửa bài. Trước đây ô này nhận số lẻ (step="any"), nên một phím
  // gõ nhầm biến "5" thành "5.1" và không có gì cản: dữ liệu vẫn hợp lệ, server vẫn nhận, chỉ có
  // người dùng là ngơ ngác. Chủ dự án bắt được đúng cảnh ấy: "chỗ mục tiêu số tự nhiên nó hiển
  // thị lên 5.1 mà tôi chưa ấn".
  //
  // Chặn ở CẢ HAI đầu: ô nhập để trình duyệt nói ngay tại chỗ, và ở đây để không ai lách qua
  // trình duyệt. Ô nhập một mình là rào chắn bằng giấy.
  if (!target_raw || !Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số lớn hơn 0.'};
  // Số nguyên CHỈ với thứ đếm được. 50,5 kg hay 8,5 điểm là con số hoàn toàn hợp lệ — luật
  // "không có nửa bài" không áp được cho cân nặng.
  if (kieuDonVi(unit) !== 'do' && !Number.isInteger(target_value))
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số nguyên (không có phần thập phân).'};
  // Ô "mỗi lần tick đáng" bỏ trống khi TẠO MỚI thì lấy 1; khi SỬA thì giữ nguyên giá trị đang có
  // (xem ghi chú dài ở parseUnitPerTick — ghi đè bằng 1 là chia cả lịch sử tick cho hệ số cũ).
  const supabase = await createClient();

  if (id) {
    const {data, error} = await supabase
      .from('lead_measures')
      .update({
        title,
        target_value,
        unit,
        sub_category,
        active_weekdays,
        nhap_luong,
        ...(nhap_luong ? {unit_per_tick: 1} : upt === null ? {} : {unit_per_tick: upt}),
      })
      .eq('id', id)
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    // .select() để biết có dòng nào thật sự đổi không: RLS chặn (lớp khác) → 0 dòng, error=null.
    // Không kiểm thì báo "đã lưu" trong khi chẳng có gì đổi.
    if (!data || data.length === 0)
      return {ok: false, error: 'Không sửa được việc này (không có quyền hoặc đã bị xoá).'};
  } else {
    const {data, error} = await supabase
      .from('lead_measures')
      .insert({wig_id, title, target_value, unit, sub_category, active_weekdays, nhap_luong, unit_per_tick: heSo})
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    if (!data || data.length === 0)
      return {ok: false, error: 'Không thêm được việc này (không có quyền với lớp này).'};
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: id ? `Đã sửa “${title}”.` : `Đã thêm “${title}”.`};
}

// ════════════════════════════════════════════════════════════════════════════
// SỬA MỘT MỤC TIÊU (WIG) — cùng kiểu trả state với taoWig.
// ════════════════════════════════════════════════════════════════════════════
//
// NGÀY KHÔNG SỬA ĐƯỢC Ở ĐÂY, cố ý. Ngày sinh ra từ nhãn kỳ (xem ngayCuaKy), nên cho sửa tay là
// mở lại đúng cái cửa vừa đóng: một WIG tuần lệch hai hôm so với tuần lịch thì màn hình giáo viên
// và màn hình học sinh cắt ra hai kết quả khác nhau — sự cố 7B1. Muốn đổi kỳ thì tạo mục tiêu
// mới cho kỳ đó.
export async function suaWig(_prev: CreateWigState, formData: FormData): Promise<CreateWigState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('wig_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const target_raw = String(formData.get('target_value') ?? '').trim();
  const target_value = Number(target_raw);
  const unit = String(formData.get('unit') ?? '').trim();

  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần sửa.'};
  if (!title) return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho mục tiêu.'};
  if (title.length > 160)
    return {ok: false, fieldError: 'title', error: 'Tên mục tiêu tối đa 160 ký tự.'};
  // MỤC TIÊU LÀ SỐ NGUYÊN.
  //
  // Đếm bài, buổi, lần — không có nửa bài. Trước đây ô này nhận số lẻ (step="any"), nên một phím
  // gõ nhầm biến "5" thành "5.1" và không có gì cản: dữ liệu vẫn hợp lệ, server vẫn nhận, chỉ có
  // người dùng là ngơ ngác. Chủ dự án bắt được đúng cảnh ấy: "chỗ mục tiêu số tự nhiên nó hiển
  // thị lên 5.1 mà tôi chưa ấn".
  //
  // Chặn ở CẢ HAI đầu: ô nhập để trình duyệt nói ngay tại chỗ, và ở đây để không ai lách qua
  // trình duyệt. Ô nhập một mình là rào chắn bằng giấy.
  if (!target_raw || !Number.isFinite(target_value) || target_value <= 0)
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số lớn hơn 0.'};
  if (!Number.isInteger(target_value))
    return {ok: false, fieldError: 'target_value', error: 'Mục tiêu phải là số nguyên (không có phần thập phân).'};
  const baseline = baseline_raw === '' ? null : Number(baseline_raw);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0))
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải là số từ 0 trở lên.'};
  // Cùng một luật với mục tiêu: hai đầu của một câu "nâng từ X lên Y" mà một đầu cho số lẻ còn
  // đầu kia không thì chính câu ấy tự mâu thuẫn.
  if (baseline !== null && !Number.isInteger(baseline))
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải là số nguyên (không có phần thập phân).'};
  if (baseline !== null && baseline >= target_value)
    return {ok: false, fieldError: 'baseline', error: 'Mốc xuất phát phải nhỏ hơn mục tiêu.'};
  if (!unit) return {ok: false, fieldError: 'unit', error: 'Hãy nhập đơn vị (vd điểm, buổi, lần).'};
  // LĨNH VỰC chỉ form sửa mục tiêu NĂM gửi lên (người thử 08/2026 xin đổi được 4 lĩnh vực khi
  // sửa). Không gửi thì giữ nguyên — form tháng/tuần không có ô này.
  const area_raw = String(formData.get('area') ?? '').trim();
  if (area_raw && !AREAS.includes(area_raw as (typeof AREAS)[number]))
    return {ok: false, error: 'Lĩnh vực không hợp lệ.'};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({title, baseline, target_value, unit, ...(area_raw ? {area: area_raw as Area} : {})})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: (friendlyError(error))};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không sửa được mục tiêu này (không có quyền hoặc đã bị xoá).'};

  // Lan lĩnh vực mới xuống con (tháng) và cháu (tuần): trang WIG nhóm cả chuỗi theo area của
  // từng dòng, đổi mỗi cấp năm thì tháng/tuần cũ trôi sang nhóm lĩnh vực khác.
  if (area_raw) {
    const {data: con} = await supabase.from('wigs').select('id').eq('parent_wig_id', id);
    await supabase
      .from('wigs')
      .update({area: area_raw as Area})
      .in('parent_wig_id', [id, ...(con ?? []).map((c) => c.id)]);
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã sửa “${title}”.`};
}

// logProgress() ĐÃ BỎ (0073). Trước đây GVCN tự bấm "Ghi +" để cộng số cho WIG lớp — nên bảng
// thắng/thua chỉ phản chiếu lại chính tay người bấm, lớp nào cũng thắng. Nay con số ấy do học
// sinh tick mà thành: cùng một bảng lead_progress, nhưng student_id là em nào tick, và
// wig_actual() cộng lên như cũ. Cần chữa sai sót thì sửa/xoá tick của em (RLS lp_staff_manage
// vẫn cho GVCN toàn quyền), chứ không cộng thêm một con số không thuộc về ai.

// Xoá WIG (sửa sai sót làm méo xếp hạng).
//
// Cây WIG SÂU BA TẦNG: năm → tháng → tuần (sinhNhip rải 12 tháng rồi ~52 tuần dưới tháng).
// parent_wig_id KHÔNG cascade (khoá ngoại để NO ACTION), nên phải xoá từ dưới lên: cháu → con →
// gốc. Bản cũ chỉ gỡ MỘT tầng con, thành ra xoá mục tiêu năm luôn thất bại — 12 mốc tháng vẫn
// còn cháu là mốc tuần treo dưới, cả hai lệnh xoá đều vướng khoá ngoại và WIG năm sống nguyên.
// lead_measures + lead_progress vẫn tự cascade theo wig_id nên không cần đụng tới.
export async function deleteWig(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
  const wig_id = String(formData.get('wig_id') ?? '');
  if (!wig_id) flash('Thiếu WIG cần xoá');
  const supabase = await createClient();

  // Lần lượt đi xuống từng tầng để biết ĐÍCH DANH id phải xoá, rồi xoá ngược lên.
  const conCua = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const {data} = await supabase.from('wigs').select('id').in('parent_wig_id', ids);
    return (data ?? []).map((w) => w.id as string);
  };
  const con = await conCua([wig_id]);
  const chau = await conCua(con);
  for (const tang of [chau, con]) {
    if (tang.length === 0) continue;
    const {error: eTang} = await supabase.from('wigs').delete().in('id', tang);
    // Dừng ngay: đi tiếp thì lệnh xoá gốc chỉ báo "còn dữ liệu liên quan", giấu mất lỗi thật.
    if (eTang) flash(loi(friendlyError(eTang)));
  }
  const {error} = await supabase.from('wigs').delete().eq('id', wig_id);
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error)) : 'Đã xoá WIG');
}

export async function deleteLeadMeasure(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
  const id = String(formData.get('lead_measure_id') ?? '');
  if (!id) flash('Thiếu lead measure cần xoá');
  const supabase = await createClient();
  const {error} = await supabase.from('lead_measures').delete().eq('id', id);
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  flash(error ? loi(friendlyError(error)) : 'Đã xoá lead measure');
}
