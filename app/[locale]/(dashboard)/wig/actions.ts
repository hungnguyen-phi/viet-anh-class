'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {taoMotWig, taoCamKet, chuanHoaThu, chuanHoaHeSo} from '@/lib/wig-tao';
import {AREAS} from '@/lib/areas';
import type {Database} from '@/lib/database.types';
import {kieuDonVi} from '@/lib/don-vi';

type Area = Database['public']['Enums']['wig_domain'];

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
  const baseline_raw = String(formData.get('baseline') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const supabase = await createClient();

  // "86% học sinh có 6/8 môn ≥ 6.5" — ba con số này chỉ có ở tab NĂM khi cô chọn kiểu đo "đếm số
  // bạn đạt". Số nguyên đọc bằng Math.trunc chứ không Number(): "6.5 môn" là câu vô nghĩa, và để
  // nó trôi xuống thì CHECK ở CSDL mới chặn, người dùng nhận một câu lỗi kỹ thuật thay vì ô đỏ.
  const soNguyen = (ten: string): number | null => {
    const raw = String(formData.get(ten) ?? '').trim();
    return raw === '' ? null : Math.trunc(Number(raw));
  };
  const laCuon = String(formData.get('measure_by') ?? '') === 'cuon';

  const kq = await taoMotWig(supabase, {
    class_id: String(formData.get('class_id') ?? ''),
    cuon: laCuon
      ? {
          ty_le_can: Number(String(formData.get('ty_le_can') ?? '').trim()),
          so_dich_can: soNguyen('so_dich_can') ?? 0,
          tong_dich: soNguyen('tong_dich'),
        }
      : undefined,
    title,
    baseline: baseline_raw === '' ? null : Number(baseline_raw),
    target_value: Number(String(formData.get('target_value') ?? '').trim()),
    unit: String(formData.get('unit') ?? '').trim(),
    period_label: String(formData.get('period_label') ?? '').trim(),
    area: (String(formData.get('area') ?? '') as Area) || undefined,
    // Giá trị lạ rơi về 'tick' — mặc định của cột, và là cái duy nhất app tự cộng số được.
    measure_by: laCuon
      ? 'cuon'
      : String(formData.get('measure_by') ?? '') === 'manual'
        ? 'manual'
        : 'tick',
  });
  if (!kq.ok) return {ok: false, error: kq.loi, fieldError: kq.field};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã tạo mục tiêu năm “${title}”.`};
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
  const commitment_id = String(formData.get('commitment_id') ?? '').trim();
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
  // KHÔNG suy từ đơn vị nữa. Chủ dự án chốt 14/08/2026: con số kg/điểm là con số của CHÍNH MỤC
  // TIÊU, nhập lại mỗi tuần ở ô số đo (wig_so_do) — không phải của việc dẫn dắt. Việc dẫn dắt
  // là hành vi hằng ngày: "tập thể dục", "học từ mới". Nó luôn TICK, và ô số chỉ là phần thêm khi
  // mỗi ngày một lượng khác nhau.
  // Bản 0114 tự bật theo đơn vị nên tạo ra đúng cái nhầm ấy: một việc tên "điểm kiểm tra" mang
  // luôn con số của mục tiêu, và không còn chỗ nào để nói "hôm nay em có làm".
  const nhap_luong = String(formData.get('nhap_luong') ?? '') === '1';
  const heSo = nhap_luong ? 1 : (upt ?? 1);

  if (!commitment_id) return {ok: false, error: 'Chưa rõ việc này thuộc cam kết nào.'};
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
  // Ô "mỗi lần tick đáng" bỏ trống thì lấy 1 (xem parseUnitPerTick).
  const supabase = await createClient();

  // CHỈ THÊM, KHÔNG SỬA (0129). Nhánh cập nhật đã gỡ: việc dẫn dắt khoá ngay khi vừa thêm, vì
  // đây là thứ các em tick vào mỗi ngày — đổi tên hay đổi chỉ tiêu giữa tuần là đổi luật giữa
  // trận, và mọi lượt tick đã ghi bỗng nói về một việc khác. Gõ nhầm thì xoá cả CAM KẾT rồi đặt
  // lại. RLS (rls_sua_viec_chi_quan_tri) mới là thứ chặn thật.
  const {data, error} = await supabase
    .from('lead_measures')
    // `wig_id` KHÔNG gửi lên: trigger lead_theo_cam_ket (0121) suy nó từ cam kết. Gửi cũng bị đè.
    .insert({commitment_id, title, target_value, unit, sub_category, active_weekdays, nhap_luong, unit_per_tick: heSo})
    .select('id');
  if (error) return {ok: false, error: (friendlyError(error))};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không thêm được việc này (không có quyền với lớp này).'};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: `Đã thêm “${title}”.`};
}

// ════════════════════════════════════════════════════════════════════════════
// SỬA MỘT MỤC TIÊU (WIG) — cùng kiểu trả state với taoWig.
// ════════════════════════════════════════════════════════════════════════════
//
// NGÀY KHÔNG SỬA ĐƯỢC Ở ĐÂY, cố ý. Ngày sinh ra từ nhãn kỳ (xem ngayCuaKy), nên cho sửa tay là
// mở lại đúng cái cửa vừa đóng: một WIG tuần lệch hai hôm so với tuần lịch thì màn hình giáo viên
// và màn hình học sinh cắt ra hai kết quả khác nhau — sự cố 7B1. Muốn đổi kỳ thì tạo mục tiêu
// mới cho kỳ đó.
// Sửa một mục tiêu cuộn: ba con số của phép cuộn, không có mốc xuất phát và không có đơn vị.
// `target_value` được kéo theo `ty_le_can` vì mọi màn hình cũ đọc cột ấy để vẽ vạch — để hai cột
// lệch nhau là vạch nói một đằng, chữ nói một nẻo.
async function suaCuon(id: string, title: string, formData: FormData): Promise<CreateWigState> {
  const soNguyen = (ten: string): number | null => {
    const raw = String(formData.get(ten) ?? '').trim();
    return raw === '' ? null : Math.trunc(Number(raw));
  };
  const ty_le_can = Number(String(formData.get('ty_le_can') ?? '').trim());
  const so_dich_can = soNguyen('so_dich_can');
  const tong_dich = soNguyen('tong_dich');

  if (!Number.isFinite(ty_le_can) || ty_le_can <= 0 || ty_le_can > 100)
    return {ok: false, fieldError: 'ty_le_can', error: 'Tỉ lệ cần đạt phải nằm trong khoảng 1–100%.'};
  if (so_dich_can === null || !Number.isInteger(so_dich_can) || so_dich_can < 1)
    return {ok: false, fieldError: 'so_dich_can', error: 'Mỗi đơn vị cần đạt ít nhất 1 mục tiêu.'};
  if (tong_dich !== null && (!Number.isInteger(tong_dich) || tong_dich < so_dich_can))
    return {ok: false, fieldError: 'tong_dich', error: 'Tổng số mục tiêu không được nhỏ hơn số cần đạt.'};

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('wigs')
    .update({title, ty_le_can, so_dich_can, tong_dich, target_value: ty_le_can, unit: '%'})
    .eq('id', id)
    // KHÔNG tin ô ẩn: chỉ đổi được đúng những mục tiêu VỐN ĐÃ là mục tiêu cuộn.
    .eq('measure_by', 'cuon')
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không sửa được mục tiêu này (không có quyền hoặc đã bị xoá).'};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]', 'page');
  return {ok: true, message: 'Đã lưu.'};
}

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

  // MỤC TIÊU CUỘN SỬA BẰNG BA Ô KHÁC. Nhận ra nó qua chính form (ô ẩn), rồi vẫn kiểm lại bằng
  // CSDL bên dưới — ô ẩn là thứ người ta sửa được trong hai giây bằng công cụ của trình duyệt, và
  // tin nó một mình là để ngỏ đường biến một mục tiêu thường thành mục tiêu cuộn.
  if (String(formData.get('la_cuon') ?? '') === '1') return suaCuon(id, title, formData);
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

// deleteLeadMeasure ĐÃ GỠ (0129): việc dẫn dắt không xoá được nữa, kể cả bởi GVCN. Đường thoát
// khi gõ nhầm là xoá cả cam kết — cascade dọn việc theo, và không để lại một việc mồ côi mang
// lịch sử tick của một lời hứa đã biến mất.


// ════════════════════════════════════════════════════════════════════════════
// DUYỆT CAM KẾT CỦA EM (0129)
// ════════════════════════════════════════════════════════════════════════════
//
// "Học sinh tạo wig, tạo commitment tuần, thì gv duyệt" — chủ dự án chốt 15/08/2026. Cam kết em
// tự đặt vào trạng thái 'sent'; đây là cái gật.
//
// KHÔNG có nút "từ chối": lời hứa của một đứa trẻ thì không ai bác bỏ. Cô thấy chưa ổn thì ngồi
// nói với em rồi để em sửa lại — sửa xong nó tự về 'sent' lần nữa (trigger cam_ket_trang_thai).
export async function duyetCamKet(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const flash: (m: string) => never = (m) => flashTo(m, class_id, week);
  const id = String(formData.get('commitment_id') ?? '').trim();
  if (!id) flash(loi('Thiếu cam kết cần duyệt.'));

  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn" với "đã duyệt": thiếu nó thì cam kết của lớp khác vẫn báo
  // thành công, và cô đi tìm một cái gật chưa từng xảy ra.
  const {data, error} = await supabase
    .from('commitments')
    .update({status: 'approved'})
    .eq('id', id)
    .select('id');
  if (error) flash(loi(friendlyError(error)));
  flash(
    data && data.length > 0
      ? 'Đã duyệt cam kết'
      : loi('Không duyệt được cam kết này (không có quyền hoặc đã bị xoá).'),
  );
}

// ── DUYỆT MÀ KHÔNG NHẢY TRANG (24/08/2026) ───────────────────────────────────────────────────
//
// Chủ dự án: "khi ấn, nó cứ đứng im như không nhận". Đúng, và cả hai nửa đều góp phần:
//
//   · MÀN: nút Duyệt là <button type=submit> trần trong một server component — không có trạng
//     thái pending, không khoá nút, không spinner. Cô bấm xong màn hình y nguyên; cô bấm lại.
//   · MÁY CHỦ: `duyetCamKet` kết bằng redirect về /wig?flash=… — tức DỰNG LẠI CẢ TRANG /wig cho
//     một lượt UPDATE một dòng. Trang ấy là trang nặng nhất của app, trên VPS mất ~5% gói TCP thì
//     đó là vài giây trắng, mất luôn chỗ cuộn.
//
// Bản này trả về STATE cho useActionState: một câu UPDATE, không redirect, không dựng lại trang
// đang mở. Màn tự đổi chip sang "Đã duyệt" ngay tại dòng đó (components/wig/NutDuyet).
// Vẫn revalidate các trang KHÁC (màn của em) để chúng không hiện trạng thái cũ.
export type DuyetState = {ok: boolean; error?: string};

export async function duyetCamKetTraVe(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('commitment_id') ?? '').trim();
  if (!id) return {ok: false, error: 'Thiếu cam kết cần duyệt.'};
  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn" với "đã duyệt": thiếu nó thì cam kết của lớp khác vẫn báo
  // thành công, và cô đi tìm một cái gật chưa từng xảy ra.
  const {data, error} = await supabase
    .from('commitments')
    .update({status: 'approved'})
    .eq('id', id)
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if (!data || data.length === 0)
    return {ok: false, error: 'Không duyệt được cam kết này (không có quyền hoặc đã bị xoá).'};
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]/student/[id]', 'page');
  return {ok: true};
}

// ── CÔ SỬA / XOÁ CAM KẾT VÀ VIỆC CỦA LỚP (16/08/2026) ─────────────────────────────────────────
// Chủ dự án: "ko thấy xóa sửa cam kết tuần/lead measure của gvcn nữa". Cam kết lớp: RLS
// rls_cam_ket_gvcn; việc lớp: rls_sua/xoa_viec_cua_lop (0142) — cả hai khoá khi tuần đã chốt.
export type CamKetLopState = {ok: boolean; message?: string; error?: string; fieldError?: string};

export async function suaCamKetLop(_prev: CamKetLopState, formData: FormData): Promise<CamKetLopState> {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('commitment_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!id) return {ok: false, error: 'Thiếu cam kết.'};
  if (!title) return {ok: false, fieldError: 'title', error: 'Cam kết không được để trống.'};
  const supabase = await createClient();
  const {data, error} = await supabase.from('commitments').update({title}).eq('id', id).is('student_id', null).select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Không sửa được — cam kết không còn, hoặc tuần đã chốt.'};
  for (const vId of formData.getAll('viec_id').map(String)) {
    const vTitle = String(formData.get(`viec_title_${vId}`) ?? '').trim();
    const vTarget = Number(String(formData.get(`viec_target_${vId}`) ?? '').trim());
    if (!vTitle) return {ok: false, error: 'Tên việc không được để trống.'};
    if (!Number.isFinite(vTarget) || vTarget <= 0) return {ok: false, error: `Đích của "${vTitle}" phải là số lớn hơn 0.`};
    const {error: e2} = await supabase.from('lead_measures').update({title: vTitle, target_value: vTarget}).eq('id', vId);
    if (e2) return {ok: false, error: friendlyError(e2)};
  }
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  return {ok: true, message: 'Đã sửa cam kết.'};
}

export async function xoaCamKetLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const id = String(formData.get('commitment_id') ?? '');
  const supabase = await createClient();
  const {data, error} = await supabase.from('commitments').delete().eq('id', id).is('student_id', null).select('id');
  if (error) flashTo(loi(friendlyError(error)), class_id, week);
  flashTo((data ?? []).length > 0 ? 'Đã xoá cam kết' : loi('Không xoá được — cam kết không còn, hoặc tuần đã chốt.'), class_id, week);
}

export async function xoaViecLop(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '') || undefined;
  const week = weekOf(formData);
  const id = String(formData.get('lead_id') ?? '');
  const supabase = await createClient();
  const {data, error} = await supabase.from('lead_measures').delete().eq('id', id).select('id');
  if (error) flashTo(loi(friendlyError(error)), class_id, week);
  flashTo((data ?? []).length > 0 ? 'Đã xoá việc' : loi('Không xoá được — việc không còn, hoặc tuần đã chốt.'), class_id, week);
}

// ĐẶT CAM KẾT CỦA LỚP NGAY TRÊN TRANG WIG — không phải chờ tới buổi họp.
// Chủ dự án 16/08/2026: "nên có phần đặt cam kết và lead measure chứ ko phải chờ đến khi vào họp".
// Cùng luật với bước 3 của phòng họp (taoCamKet: trần 2, treo dưới mục tiêu năm của lớp).
export async function datCamKetLop(_prev: CamKetLopState, formData: FormData): Promise<CamKetLopState> {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const week_start = String(formData.get('week_start') ?? '');
  const wig_id = String(formData.get('wig_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const supabase = await createClient();
  const kq = await taoCamKet(supabase, {wig_id, class_id, week_start, title});
  if (!kq.ok) return {ok: false, fieldError: kq.field, error: kq.loi};
  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  return {ok: true, message: 'Đã đặt cam kết.'};
}
