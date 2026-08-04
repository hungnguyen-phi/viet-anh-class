'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {taoMotWig, chuanHoaThu, chuanHoaHeSo} from '@/lib/wig-tao';

// ════════════════════════════════════════════════════════════════════════════
// KẾT THÚC BUỔI HỌP — một nút, ba việc.
// ════════════════════════════════════════════════════════════════════════════
//
// Buổi họp WIG là MỘT lần ngồi, nên nó phải là MỘT lần lưu. Trước đây nó là ba nút rải ở ba khối
// khác nhau trên cùng một trang dài: "Lưu ghi nhận buổi họp" (bảng từng việc), "Lưu biên bản"
// (ba ô văn bản), và "+ Tạo WIG tuần" (nằm tận trong một khung khác, sau khi đã cuộn qua mọi thứ).
// Bấm thiếu một nút là mất một phần buổi họp, mà không có gì trên màn hình nói ra điều đó.
//
// TRẢ STATE, không chuyển trang. Một buổi họp có thể gõ vào đây hai ba trăm chữ; chuyển trang kèm
// câu lỗi là xoá sạch chỗ ấy — chuyện đã ghi nhận là hạn chế đã biết của bản cũ, nay chữa hẳn.
//
// THỨ TỰ GHI có chủ ý: tạo mục tiêu tuần mới TRƯỚC, ghi biên bản SAU CÙNG. Ghi biên bản là thứ
// KHOÁ TICK của tuần vừa tổng kết (0081), nên nếu nó chạy trước mà phần tạo mục tiêu hỏng thì lớp
// vừa bị khoá tick vừa không có việc gì cho tuần mới — trạng thái tệ nhất trong các trạng thái dở.

export type HopState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
};

type ViecMoi = {
  title: string;
  target_value: number;
  unit: string | null;
  unit_per_tick: number;
  active_weekdays: number[];
};

// Đọc các dòng "việc cho tuần tới" ra khỏi FormData. Tên trường dạng viec_<k>_title, và <k> là
// khoá do trình duyệt sinh khi bấm "+ Thêm việc" — quét theo mẫu thay vì tin vào một danh sách
// chỉ số gửi kèm, vì danh sách ấy cũng do trình duyệt gửi nên không đáng tin hơn mà lại thêm một
// chỗ có thể lệch.
function docViec(formData: FormData): ViecMoi[] {
  const khoa: string[] = [];
  for (const key of formData.keys()) {
    const m = key.match(/^viec_(.+)_title$/);
    if (m && !khoa.includes(m[1])) khoa.push(m[1]);
  }
  const out: ViecMoi[] = [];
  for (const k of khoa) {
    const title = String(formData.get(`viec_${k}_title`) ?? '').trim();
    // Dòng để trống hoàn toàn thì bỏ qua, không báo lỗi: người ta bấm "+ Thêm việc" rồi đổi ý là
    // chuyện bình thường, bắt họ đi tìm cái nút xoá mới lưu được là gây khó vô cớ.
    if (!title) continue;
    out.push({
      title,
      target_value: Number(String(formData.get(`viec_${k}_target`) ?? '').trim()),
      unit: String(formData.get(`viec_${k}_unit`) ?? '').trim() || null,
      unit_per_tick: chuanHoaHeSo(String(formData.get(`viec_${k}_upt`) ?? '')) ?? 1,
      active_weekdays: chuanHoaThu(formData.getAll(`viec_${k}_days`)),
    });
  }
  return out;
}

export async function ketThucBuoiHop(_prev: HopState, formData: FormData): Promise<HopState> {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const hop_start = String(formData.get('hop_start') ?? '');
  const hop_label = String(formData.get('hop_label') ?? '').trim();
  const dich_label = String(formData.get('dich_label') ?? '').trim();
  const chiem_nghiem = String(formData.get('chiem_nghiem') ?? '').trim();
  const cam_ket = String(formData.get('cam_ket') ?? '').trim();

  if (!class_id || !/^\d{4}-\d{2}-\d{2}$/.test(hop_start))
    return {ok: false, error: 'Thiếu lớp hoặc tuần đang tổng kết.'};

  const supabase = await createClient();
  const lam: string[] = [];

  // ── 1. MỤC TIÊU TUẦN TỚI (nếu có điền) ───────────────────────────────────────────────────
  const mt_title = String(formData.get('mt_title') ?? '').trim();
  if (mt_title) {
    if (!dich_label) return {ok: false, fieldError: 'mt_title', error: 'Không rõ đang đặt mục tiêu cho tuần nào.'};

    // Đã có mục tiêu cho tuần ấy rồi thì KHÔNG tạo cái thứ hai. Hai mục tiêu tuần cùng kỳ là hai
    // thanh tiến độ cho một việc, và không màn hình nào nói được cái nào mới là thật.
    const {data: daCo} = await supabase
      .from('wigs')
      .select('id')
      .eq('class_id', class_id)
      .eq('scope', 'class')
      .eq('period', 'week')
      .eq('period_label', dich_label)
      .limit(1);
    if (daCo && daCo.length > 0)
      return {
        ok: false,
        fieldError: 'mt_title',
        error: `Tuần ${dich_label} đã có mục tiêu rồi — sửa nó ở trang WIG thay vì tạo thêm một cái nữa.`,
      };

    // 1a. Chuỗi năm → tháng → tuần: thiếu mắt xích tháng thì tạo luôn tại đây, không đá người
    // đang họp sang trang khác rồi bắt quay lại.
    let parentId = String(formData.get('mt_parent') ?? '').trim();
    if (String(formData.get('thang_can') ?? '') === '1') {
      const kqThang = await taoMotWig(supabase, {
        class_id,
        period: 'month',
        title: String(formData.get('thang_title') ?? '').trim(),
        baseline: null,
        target_value: Number(String(formData.get('thang_target') ?? '').trim()),
        unit: String(formData.get('thang_unit') ?? '').trim(),
        period_label: String(formData.get('thang_label') ?? '').trim(),
        parent_wig_id: String(formData.get('thang_parent') ?? '').trim() || undefined,
      });
      if (!kqThang.ok)
        return {ok: false, fieldError: kqThang.field ? `thang_${kqThang.field}` : undefined, error: kqThang.loi};
      parentId = kqThang.id;
      lam.push('tạo mục tiêu tháng');
      // LÀM MỚI TRANG NGAY SAU KHI TẠO ĐƯỢC THÁNG.
      //
      // Nếu bước tạo TUẦN ngay dưới đây hỏng, hàm trả về lỗi và form vẫn còn nguyên trên màn —
      // kèm ô ẩn thang_can="1". Bấm Lưu lần nữa là tạo thêm một mục tiêu tháng THỨ HAI cho cùng
      // một tháng, và từ đó tiến độ tháng tách làm đôi mà không ai hiểu vì sao. Revalidate ở đây
      // buộc trang dựng lại: lần sau mở ra, tháng đã tồn tại nên khối "tạo tháng" tự biến mất và
      // ô chọn mục tiêu tháng hiện ra thay vào.
      revalidatePath('/[locale]/wig/hop', 'page');
      revalidatePath('/[locale]/wig', 'page');
    }

    const baseline_raw = String(formData.get('mt_baseline') ?? '').trim();
    const kqTuan = await taoMotWig(supabase, {
      class_id,
      period: 'week',
      title: mt_title,
      baseline: baseline_raw === '' ? null : Number(baseline_raw),
      target_value: Number(String(formData.get('mt_target') ?? '').trim()),
      unit: String(formData.get('mt_unit') ?? '').trim(),
      period_label: dich_label,
      parent_wig_id: parentId || undefined,
    });
    if (!kqTuan.ok)
      return {
        ok: false,
        fieldError: kqTuan.field ? `mt_${kqTuan.field}` : undefined,
        // Kể ra phần ĐÃ ghi được. Im lặng ở đây là để người dùng tin rằng chưa có gì xảy ra, rồi
        // họ bấm lại và sinh ra bản sao — đúng lỗi vừa chặn ở trên.
        error: lam.length > 0 ? `${kqTuan.loi} (đã ${lam.join(', ')})` : kqTuan.loi,
      };
    lam.push(`đặt mục tiêu tuần ${dich_label}`);

    const viec = docViec(formData);
    const hong = viec.find((v) => !Number.isFinite(v.target_value) || v.target_value <= 0);
    if (hong)
      return {
        ok: false,
        fieldError: 'viec',
        error: `Việc “${hong.title}” chưa có mục tiêu hợp lệ (phải là số lớn hơn 0). Mục tiêu tuần ĐÃ được tạo — sửa số rồi lưu lại, lần này chỉ cần thêm việc.`,
      };
    if (viec.length > 0) {
      const {data, error} = await supabase
        .from('lead_measures')
        .insert(viec.map((v) => ({wig_id: kqTuan.id, ...v})))
        .select('id');
      if (error) return {ok: false, error: (friendlyError(error))};
      lam.push(`thêm ${data?.length ?? 0} việc cho các em tick`);
    }
  }

  // ── 2. GHI NHẬN TỪNG VIỆC CỦA TUẦN VỪA QUA ───────────────────────────────────────────────
  // Gom theo id việc. `daCo` là ảnh chụp lúc trang được dựng: dòng ấy lúc đó đã có ghi nhận hay
  // chưa. Chỉ dùng cho nhánh XOÁ — xem ghi chú ở đó.
  const theoViec = new Map<string, {verdict: string | null; note: string; daCo: boolean}>();
  for (const [key, val] of formData.entries()) {
    const mV = key.match(/^verdict_(.+)$/);
    const mN = key.match(/^note_(.+)$/);
    const mC = key.match(/^co_(.+)$/);
    if (!mV && !mN && !mC) continue;
    const id = (mV ?? mN ?? mC)![1];
    const cur = theoViec.get(id) ?? {verdict: null, note: '', daCo: false};
    if (mV) {
      const v = String(val);
      cur.verdict = v === 'win' || v === 'lose' ? v : null;
    } else if (mN) {
      cur.note = String(val).trim();
    } else {
      cur.daCo = true;
    }
    theoViec.set(id, cur);
  }

  const rows = [...theoViec.entries()]
    // Không ghi dòng rỗng: chưa chấm mà cũng chưa ghi gì thì để trống, đừng đẻ ra một dòng
    // "đã họp" giả trong CSDL.
    .filter(([, v]) => v.verdict !== null || v.note !== '')
    .map(([lead_measure_id, v]) => ({
      class_id,
      week_start: hop_start,
      lead_measure_id,
      verdict: v.verdict,
      note: v.note || null,
      updated_by: me.id,
    }));

  // Bỏ chấm VÀ xoá trắng ô ghi chú → xoá hẳn dòng. Đây cũng là đường duy nhất để gỡ một lần chấm
  // nhầm: nút "chưa chấm" gửi verdict rỗng, rơi vào đây.
  //
  // NHƯNG CHỈ XOÁ THỨ NGƯỜI BẤM LƯU THẬT SỰ NHÌN THẤY (`daCo`). Nút "chưa chấm" được tích sẵn cho
  // MỌI dòng chưa có ghi nhận, nên mỗi lần lưu là form gửi lên một danh sách rỗng dài bằng cả
  // bảng. Không lọc theo ảnh chụp thì: thầy A mở bảng, cô B ghi chú một việc, A bấm Lưu — lệnh
  // xoá của A quét trúng việc đó và ghi chú của B biến mất, không một lời báo.
  const idsRong = [...theoViec.entries()]
    .filter(([, v]) => v.verdict === null && v.note === '' && v.daCo)
    .map(([id]) => id);
  if (idsRong.length > 0) {
    // .select() ở cả nhánh xoá: không có nó thì RLS chặn cũng im lặng, và người dùng đọc được
    // "đã xoá" trong khi dòng vẫn nằm nguyên đó.
    const {data, error} = await supabase
      .from('wig_meeting_notes')
      .delete()
      .eq('class_id', class_id)
      .eq('week_start', hop_start)
      .in('lead_measure_id', idsRong)
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    if ((data?.length ?? 0) > 0) lam.push(`bỏ ghi nhận ${data!.length} việc`);
  }

  if (rows.length > 0) {
    const {data, error} = await supabase
      .from('wig_meeting_notes')
      .upsert(rows, {onConflict: 'class_id,week_start,lead_measure_id'})
      .select('id');
    if (error) return {ok: false, error: (friendlyError(error))};
    // .select() để phân biệt "RLS chặn" với "đã lưu" — không báo thành công giả.
    if ((data?.length ?? 0) === 0)
      return {ok: false, error: 'Không lưu được (không có quyền với lớp này).'};
    lam.push(`chấm ${data!.length} việc`);
  }

  // ── 3. BIÊN BẢN — VÀ ĐÂY LÀ THỨ CHỐT TICK CỦA TUẦN VỪA QUA (0081) ────────────────────────
  if (chiem_nghiem || cam_ket || rows.length > 0) {
    // 1 biên bản / (lớp, tuần). Tìm theo NGÀY: nhãn là chữ để người đọc, ngày mới là khoá thật
    // (0080). Trước đây tra theo nhãn nên ai sửa tay thành "Tuần 31" là vòng cam kết đứt lặng lẽ.
    const {data: cu} = await supabase
      .from('wig_meetings')
      .select('id')
      .eq('class_id', class_id)
      .is('student_id', null)
      .eq('week_start', hop_start)
      .maybeSingle();

    const payload = {
      class_id,
      week_label: hop_label || dich_label,
      week_start: hop_start,
      results: chiem_nghiem || null,
      commitments: cam_ket || null,
      // next_actions ĐỂ TRỐNG từ bản này. Nó vốn là ô chữ tự do "WIG & Lead measure tuần sau" —
      // nay việc ấy tạo ra một mục tiêu tuần THẬT, có thanh tiến độ và có việc để tick, nên chép
      // lại nó thành một câu văn là dựng bản sao thứ hai của cùng một thứ.
      next_actions: null,
      coach_id: me.id,
    };
    const {error} = cu
      ? await supabase.from('wig_meetings').update(payload).eq('id', cu.id)
      : await supabase.from('wig_meetings').insert(payload);
    if (error) return {ok: false, error: (friendlyError(error))};
    lam.push(cu ? 'cập nhật biên bản' : 'lưu biên bản');
  }

  if (lam.length === 0)
    return {ok: false, error: 'Chưa điền gì cả — chấm ít nhất một việc, hoặc ghi chiêm nghiệm/cam kết.'};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');

  return {
    ok: true,
    message: `Xong: ${lam.join(', ')}. Tick của tuần ${hop_label} đã chốt.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GỠ BIÊN BẢN CỦA MỘT TUẦN — đường lùi cho việc một chiều.
// ════════════════════════════════════════════════════════════════════════════
//
// Ghi nhận buổi họp là thứ KHOÁ TICK của tuần đó (0081). Họp nhầm tuần — bấm ← một cái quá tay
// rồi lưu — là khoá tick của một tuần lớp đang làm dở, và các em lập tức không tick được nữa mà
// không hiểu vì sao. Không có đường gỡ thì lỗi ấy chỉ chữa được bằng cách gọi cho quản trị viên.
//
// Xoá CẢ HAI bảng: tuan_da_hop() kiểm cả wig_meeting_notes lẫn wig_meetings, nên bỏ một bảng
// thôi thì tick vẫn khoá và người dùng đọc được "đã xoá" trong khi chẳng có gì mở ra.
export async function xoaBienBan(_prev: HopState, formData: FormData): Promise<HopState> {
  await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const hop_start = String(formData.get('hop_start') ?? '');
  const hop_label = String(formData.get('hop_label') ?? '').trim();
  if (!class_id || !/^\d{4}-\d{2}-\d{2}$/.test(hop_start))
    return {ok: false, error: 'Thiếu lớp hoặc tuần cần gỡ.'};

  const supabase = await createClient();
  const {error: e1} = await supabase
    .from('wig_meeting_notes')
    .delete()
    .eq('class_id', class_id)
    .eq('week_start', hop_start);
  if (e1) return {ok: false, error: (friendlyError(e1))};
  const {data, error: e2} = await supabase
    .from('wig_meetings')
    .delete()
    .eq('class_id', class_id)
    .is('student_id', null)
    .eq('week_start', hop_start)
    .select('id');
  if (e2) return {ok: false, error: (friendlyError(e2))};

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/student', 'page');

  // Nói đúng việc vừa làm: không tìm thấy biên bản nào thì đừng báo "đã gỡ" — có thể người khác
  // vừa gỡ trước, hoặc RLS chặn, và cả hai đều khác với "xong rồi".
  if ((data?.length ?? 0) === 0)
    return {ok: false, error: `Không tìm thấy biên bản tuần ${hop_label} để gỡ (có thể đã gỡ rồi).`};
  return {ok: true, message: `Đã gỡ biên bản tuần ${hop_label}. Tick tuần đó mở lại.`};
}
