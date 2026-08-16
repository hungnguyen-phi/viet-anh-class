'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {taoCamKet} from '@/lib/wig-tao';
import {ngayCuaKy} from '@/lib/dates';

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

export async function ketThucBuoiHop(_prev: HopState, formData: FormData): Promise<HopState> {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const hop_start = String(formData.get('hop_start') ?? '');
  const hop_label = String(formData.get('hop_label') ?? '').trim();
  const dich_label = String(formData.get('dich_label') ?? '').trim();
  const chiem_nghiem = String(formData.get('chiem_nghiem') ?? '').trim();

  if (!class_id || !/^\d{4}-\d{2}-\d{2}$/.test(hop_start))
    return {ok: false, error: 'Thiếu lớp hoặc tuần đang tổng kết.'};

  const supabase = await createClient();
  const lam: string[] = [];

  // ── 1. CAM KẾT CHO TUẦN TỚI (0121) ───────────────────────────────────────────────────────
  //
  // Bước này trước đây chỉnh "chỉ tiêu của mốc tuần" và gắn việc vào mốc ấy. Mốc tuần không còn:
  // mỗi tuần nay là CAM KẾT, tối đa 2, và cam kết là một lời hứa nên không mang con số đích của
  // riêng nó — con số nằm ở các việc dẫn dắt treo dưới.
  //
  // Đây đúng là nhịp mà PRD v3 mô tả: buổi họp nhìn lại tuần vừa qua rồi ĐẶT cam kết tuần tới,
  // ngay trong cùng một buổi.
  const dichMonday = ngayCuaKy('week', dich_label)?.start ?? '';
  const ckKeys: string[] = [];
  for (const key of formData.keys()) {
    const m = key.match(/^ck_(.+)_title$/);
    if (m && !ckKeys.includes(m[1])) ckKeys.push(m[1]);
  }

  if (ckKeys.length > 0 && dichMonday) {
    // Cam kết đã có sẵn của tuần đích — để bấm Lưu hai lần không đẻ ra bản sao, và không đâm vào
    // trần 2 của CSDL bằng một câu lỗi kỹ thuật.
    const {data: daCoCk} = await supabase
      .from('commitments')
      .select('id, title')
      .eq('class_id', class_id)
      .is('student_id', null)
      .eq('week_start', dichMonday);
    const tenDaCo = new Map((daCoCk ?? []).map((c) => [c.title.trim().toLowerCase(), c.id]));

    let soCk = 0;
    for (const n of ckKeys) {
      const title = String(formData.get(`ck_${n}_title`) ?? '').trim();
      // Dòng bỏ trống thì bỏ qua — cô mở ra hai ô rồi chỉ dùng một là chuyện bình thường.
      if (!title) continue;
      const wig_id = String(formData.get(`ck_${n}_wig`) ?? '').trim();

      let camKetId = tenDaCo.get(title.toLowerCase()) ?? null;
      if (!camKetId) {
        const kq = await taoCamKet(supabase, {wig_id, class_id, week_start: dichMonday, title});
        if (!kq.ok) return {ok: false, fieldError: kq.field ?? `ck_${n}_title`, error: kq.loi};
        camKetId = kq.id;
        soCk += 1;
      }
    }
    if (soCk > 0) lam.push(`đặt ${soCk} cam kết cho tuần ${dich_label}`);
  }

  // ── 1b. CHẤM V/X CHO CAM KẾT CỦA TUẦN VỪA QUA — của LỚP và của TỪNG EM ────────────────────
  //
  // Thắng/thua nay là Ý NGƯỜI, không phải phép so. Máy đã gợi ý sẵn (cam_ket_goi_y) và form gửi
  // lên cả hai: gợi ý là gì, cô chọn gì. Lưu cả hai để "cô chấm khác máy" không thành vô hình —
  // đó chính là nguồn của chỉ số "commitment đã thay đổi" trên Dashboard PDR.
  //
  // Cùng một vòng cho cả cam kết của lớp lẫn cam kết của em (16/08/2026): chủ dự án chốt "gvcn
  // đánh thắng thua giống học sinh trong buổi họp". `.eq('class_id')` giữ cho một id lạ gửi lên
  // không chấm được cam kết của lớp khác; trigger 0133 giữ cho cô chỉ đụng được cột verdict.
  let soCham = 0;
  for (const key of formData.keys()) {
    const m = key.match(/^vx_(.+)$/);
    if (!m) continue;
    const gt = String(formData.get(key) ?? '');
    if (gt !== 'win' && gt !== 'lose') continue;
    const {error} = await supabase
      .from('commitments')
      .update({
        verdict: gt,
        verdict_goi_y: String(formData.get(`vxgoi_${m[1]}`) ?? '') || null,
        verdict_by: me.id,
        verdict_at: new Date().toISOString(),
      })
      .eq('id', m[1])
      .eq('class_id', class_id);
    if (error) return {ok: false, error: friendlyError(error)};
    soCham += 1;
  }
  if (soCham > 0) lam.push(`chấm ${soCham} cam kết`);

  // (Bảng "chấm từng việc + rút ra điều gì" (wig_meeting_notes) và hai ô "Tuần rồi / Tuần tới
  //  hứa" cô gõ hộ từng em đã gỡ 16/08/2026. Việc là bằng chứng của cam kết, thắng/thua chấm ở
  //  cam kết; còn lời của em là em tự viết ở /student/hop, cô đọc — không có ô nào để cô ghi đè.)

  // ── 3. BIÊN BẢN — VÀ ĐÂY LÀ THỨ CHỐT TUẦN ────────────────────────────────────────────────
  //
  // MỘT THỜI ĐIỂM GHI DUY NHẤT: cuối buổi họp, lưu tức là chốt. Bản 0108 từng tách đôi (Lưu tạm /
  // Chốt) để cô lưu giữa chừng mà không khoá em; chủ dự án gộp lại 13/08/2026 — buổi họp chỉ có
  // một lúc để ghi, hai nút chỉ tạo ra câu hỏi "bấm cái nào".
  //
  // Vẫn đóng dấu vào `chot_at` chứ không quay lại luật cũ ("có dòng biên bản nào là khoá"): luật cũ
  // khoá lây cả những dòng sinh ra từ đường khác, và nút gỡ biên bản cần một chỗ cụ thể để gỡ dấu.
  //
  // Chốt khi buổi họp CÓ LÀM một việc: chấm ít nhất một cam kết, ghi chiêm nghiệm, hoặc đặt cam
  // kết tuần tới. Không có gì trong ba thứ ấy thì không phải một buổi họp — trả lỗi ở dưới.
  if (chiem_nghiem || soCham > 0 || lam.length > 0) {
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
      // `commitments` (câu cam kết tự do của lớp) ĐỂ TRỐNG từ 16/08/2026: cam kết tuần tới nay là
      // hai dòng có cấu trúc ở bước 3 (bảng commitments), một câu văn chép lại là bản sao thứ hai
      // — chủ dự án: "đã chiêm nghiệm - cam kết rồi còn cam kết cho tuần tới nữa?".
      commitments: null,
      // next_actions ĐỂ TRỐNG từ bản này. Nó vốn là ô chữ tự do "WIG & Lead measure tuần sau" —
      // nay việc ấy tạo ra một mục tiêu tuần THẬT, có thanh tiến độ và có việc để tick, nên chép
      // lại nó thành một câu văn là dựng bản sao thứ hai của cùng một thứ.
      next_actions: null,
      coach_id: me.id,
      // Luôn đóng dấu chốt, và KHÔNG BAO GIỜ xoá dấu ở đây. Mở lại một tuần đã tổng kết là việc
      // của nút gỡ biên bản, có hộp xác nhận riêng — nếu lưu lần hai âm thầm mở khoá thì cô không
      // hề biết mình vừa mở, còn các em đột nhiên tick lại được vào tuần đã chốt.
      chot_at: new Date().toISOString(),
      chot_by: me.id,
    };
    const {error} = cu
      ? await supabase.from('wig_meetings').update(payload).eq('id', cu.id)
      : await supabase.from('wig_meetings').insert(payload);
    if (error) return {ok: false, error: (friendlyError(error))};
    lam.push(cu ? 'cập nhật biên bản' : 'lưu biên bản');
  }

  if (lam.length === 0)
    return {ok: false, error: 'Chưa có gì để chốt — chấm ít nhất một cam kết, hoặc ghi chiêm nghiệm.'};


  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');

  return {
    ok: true,
    message: `Xong: ${lam.join(', ')}. Tick và số đo của tuần ${hop_label} đã chốt.`,
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

// ════════════════════════════════════════════════════════════════════════════
// MỞ PHÒNG HỌP (0130)
// ════════════════════════════════════════════════════════════════════════════
//
// Cô bấm là mọi màn hình học sinh trong lớp hiện lời mời vào phòng. Không gửi thông báo, không
// đẩy tin: màn của em nghe thẳng bảng `wig_meetings` qua postgres_changes — cùng đường mà chữ
// "… đang điền" đã đi từ 0111, và là đường Realtime áp đúng RLS.
//
// MỞ PHÒNG KHÔNG PHẢI CHỐT TUẦN. Hai việc ấy từng bị gộp một lần (0121, phải sửa ở 0122): mở
// phòng mà khoá luôn cam kết thì buổi họp không còn gì để làm.
export async function moPhongHop(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const hop_start = String(formData.get('hop_start') ?? '');
  const hop_label = String(formData.get('hop_label') ?? '').trim();
  if (!class_id || !hop_start || !hop_label) return;

  const supabase = await createClient();
  await supabase.rpc('mo_phong_hop', {
    p_class: class_id,
    p_week_start: hop_start,
    p_week_label: hop_label,
  });
  void me;
  revalidatePath('/[locale]/wig/hop', 'page');
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/student/hop', 'page');
  revalidatePath('/[locale]/student', 'page');
}
