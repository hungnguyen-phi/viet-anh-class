'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên input).
export type MeetingState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: {week_label: string; results: string; commitments: string; next_actions: string};
};

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

// ============================================================
// Ghi nhận buổi họp cho TỪNG VIỆC (0079)
// ============================================================
// Một form bao cả bảng: mỗi việc có một cặp ô mang tên `verdict_<id>` và `note_<id>`. Gửi một
// lượt thay vì mỗi dòng một nút lưu — buổi họp đi lần lượt qua các việc rồi chốt một lần, và
// một nút thì không ai phải nhớ mình đã lưu dòng nào.
//
// THẮNG/THUA Ở ĐÂY CHỈ LÀ GHI NHẬN, không đổi kết quả thật (quyết định của chủ dự án 2026-08-04).
// Con số quyết định vẫn là tick của học sinh, đi qua wig_actual/class_lead_board như cũ.
//
// HẠN CHẾ ĐÃ BIẾT: lưu hỏng thì redirect kèm câu lỗi, và nội dung vừa gõ mất. Chữa đúng cách là
// chuyển sang useActionState như MeetingForm — nhưng thế thì bảng thành client component, kéo
// theo cả cây vào bundle trình duyệt cho một lỗi gần như không xảy ra (nút Lưu chỉ hiện với
// canManage, nên nhánh RLS chặn khó chạm tới). Ghi ra đây để lần sau ai gặp thì biết là đã cân
// nhắc, không phải bỏ sót.
export async function saveMeetingNotes(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const week_start = String(formData.get('week_start') ?? '');
  const week = String(formData.get('week') ?? '');
  // Trang xuất phát, do form gửi kèm. Bảng này nhúng ở CẢ /wig lẫn /meeting (BGH chỉ vào được
  // trang sau), nên đoán mò là ném người ta sang một trang khác — đúng lỗi deleteMeeting vừa
  // phải sửa hôm qua vì cùng lý do.
  const tuTrang = String(formData.get('from') ?? '') === 'meeting' ? '/meeting' : '/wig';
  const back = (msg: string): never => {
    const q = new URLSearchParams();
    if (class_id) q.set('class', class_id);
    if (week && tuTrang === '/wig') q.set('week', week);
    q.set('flash', msg);
    redirect(`${tuTrang}?${q.toString()}`);
  };
  if (!class_id || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) back('Thiếu lớp hoặc tuần');

  // Gom theo id việc. Duyệt FormData thay vì đọc theo danh sách id gửi kèm: danh sách ấy cũng do
  // trình duyệt gửi lên nên không đáng tin hơn, mà lại thêm một chỗ có thể lệch.
  //
  // `daCo` là ảnh chụp lúc trang được dựng: dòng ấy lúc đó đã có ghi nhận hay chưa. Chỉ dùng cho
  // nhánh XOÁ — xem ghi chú ở đó.
  const theoViec = new Map<string, {verdict: string | null; note: string; daCo: boolean}>();
  const lay = (id: string) =>
    theoViec.get(id) ?? {verdict: null, note: '', daCo: false};
  for (const [key, val] of formData.entries()) {
    const mV = key.match(/^verdict_(.+)$/);
    const mN = key.match(/^note_(.+)$/);
    const mC = key.match(/^co_(.+)$/);
    if (!mV && !mN && !mC) continue;
    const id = (mV ?? mN ?? mC)![1];
    const cur = lay(id);
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
      week_start,
      lead_measure_id,
      verdict: v.verdict,
      note: v.note || null,
      updated_by: me.id,
    }));

  const supabase = await createClient();

  // Bỏ chấm VÀ xoá trắng ô ghi chú → xoá hẳn dòng, đừng để lại bản ghi rỗng. Đây cũng là đường
  // duy nhất để gỡ một lần chấm nhầm: nút "chưa chấm" trên bảng gửi verdict rỗng, rơi vào đây.
  //
  // NHƯNG CHỈ XOÁ THỨ NGƯỜI BẤM LƯU THẬT SỰ NHÌN THẤY (`daCo`). Nút "chưa chấm" được tích sẵn
  // cho MỌI dòng chưa có ghi nhận, nên mỗi lần lưu là form gửi lên một danh sách rỗng dài bằng
  // cả bảng. Không lọc theo ảnh chụp thì: thầy A mở bảng, cô B ghi chú một việc, A bấm Lưu — lệnh
  // xoá của A quét trúng việc đó và ghi chú của B biến mất, không một lời báo.
  const idsRong = [...theoViec.entries()]
    .filter(([, v]) => v.verdict === null && v.note === '' && v.daCo)
    .map(([id]) => id);
  let soXoa = 0;
  if (idsRong.length > 0) {
    // .select() ở cả nhánh xoá: không có nó thì RLS chặn cũng im lặng, và người dùng đọc được
    // "đã xoá" trong khi dòng vẫn nằm nguyên đó.
    const {data, error} = await supabase
      .from('wig_meeting_notes')
      .delete()
      .eq('class_id', class_id)
      .eq('week_start', week_start)
      .in('lead_measure_id', idsRong)
      .select('id');
    if (error) back(friendlyError(error));
    soXoa = data?.length ?? 0;
  }

  let soLuu = 0;
  if (rows.length > 0) {
    // .select() để phân biệt "RLS chặn" với "đã lưu" — không báo thành công giả (audit #5).
    const {data, error} = await supabase
      .from('wig_meeting_notes')
      .upsert(rows, {onConflict: 'class_id,week_start,lead_measure_id'})
      .select('id');
    if (error) back(friendlyError(error));
    soLuu = data?.length ?? 0;
    if (soLuu === 0) back('Không lưu được (không có quyền với lớp này).');
  }

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/meeting', 'page');

  // NÓI ĐÚNG VIỆC VỪA LÀM. Bản đầu rơi thẳng xuống câu "Đã xoá ghi nhận buổi họp" mỗi khi không
  // có gì để lưu — kể cả lúc bấm Lưu trên một bảng chưa ai chấm gì, tức là báo đã xoá một thứ
  // chưa từng tồn tại.
  if (soLuu === 0 && soXoa === 0) back('Chưa chấm và chưa ghi gì — không có gì để lưu.');
  if (soLuu === 0) back(`Đã bỏ ghi nhận của ${soXoa} việc`);
  if (soXoa === 0) back(`Đã ghi nhận buổi họp cho ${soLuu} việc`);
  back(`Đã ghi nhận ${soLuu} việc, bỏ ghi nhận ${soXoa} việc`);
}

export async function saveMeeting(_prev: MeetingState, formData: FormData): Promise<MeetingState> {
  const me = await requireRole(['teacher', 'admin']);
  const class_id = String(formData.get('class_id') ?? '');
  const week_label = String(formData.get('week_label') ?? '').trim();
  const results = String(formData.get('results') ?? '').trim();
  const commitments = String(formData.get('commitments') ?? '').trim();
  const next_actions = String(formData.get('next_actions') ?? '').trim();
  // Giữ lại input để trả về khi có lỗi (không mất nội dung đã gõ).
  const values = {week_label, results, commitments, next_actions};

  if (!class_id) return {ok: false, error: friendlyError(null), values};
  if (!week_label) return {ok: false, fieldError: 'week_label', error: 'Hãy nhập nhãn tuần (vd W38-2026).', values};
  if (!results && !commitments && !next_actions)
    return {ok: false, fieldError: 'results', error: 'Nhập ít nhất một nội dung: chiêm nghiệm, cam kết hoặc việc tuần sau.', values};

  const supabase = await createClient();

  // NGÀY là khoá thật (0080), nhãn chỉ để hiển thị. Form gửi kèm week_start; biên bản cũ hoặc
  // form chưa cập nhật thì suy ngược từ nhãn — cùng một đường duy nhất, không nơi nào tự cắt
  // chuỗi lấy năm/tuần nữa (chỗ ấy có bẫy: cắt lệch một ký tự là ra năm 0026).
  const wsRaw = String(formData.get('week_start') ?? '').trim();
  let week_start: string | null = /^\d{4}-\d{2}-\d{2}$/.test(wsRaw) ? wsRaw : null;
  if (!week_start) {
    const {data: suy} = await supabase.rpc('thu_hai_tu_nhan', {nhan: week_label});
    week_start = (suy as string | null) ?? null;
  }

  // 1 biên bản / (lớp, tuần): đã có thì SỬA, chưa có thì tạo (cho phép sửa lại nội dung).
  //
  // Tìm theo NGÀY khi có — thế thì sửa nhãn cũng không đẻ ra biên bản thứ hai cho cùng một tuần,
  // và dòng "tuần trước lớp đã hứa" luôn tìm thấy. Không suy được ngày thì đành theo nhãn như cũ.
  let q = supabase.from('wig_meetings').select('id').eq('class_id', class_id).is('student_id', null);
  q = week_start ? q.eq('week_start', week_start) : q.eq('week_label', week_label);
  const {data: existing} = await q.maybeSingle();

  const payload = {
    class_id,
    week_label,
    week_start,
    results: results || null,
    commitments: commitments || null,
    next_actions: next_actions || null,
    coach_id: me.id,
  };
  // Idempotent/đồng thời: nếu chưa có thì insert; nếu 2 người cùng lưu 1 tuần → 1 người dính
  // unique (23505) → tự chuyển sang update theo khoá (lớp,tuần) thay vì báo lỗi trùng.
  let error = null as {code?: string} | null;
  if (existing) {
    ({error} = await supabase.from('wig_meetings').update(payload).eq('id', existing.id));
  } else {
    const ins = await supabase.from('wig_meetings').insert(payload);
    if (ins.error?.code === '23505') {
      ({error} = await supabase
        .from('wig_meetings')
        .update(payload)
        .eq('class_id', class_id)
        .eq('week_label', week_label)
        .is('student_id', null));
    } else {
      error = ins.error;
    }
  }

  if (error) return {ok: false, error: friendlyError(error), values};

  revalidatePath('/[locale]/meeting', 'page');
  return {ok: true, message: existing ? 'Đã cập nhật biên bản tuần này.' : 'Đã lưu biên bản.'};
}

// Xoá 1 biên bản họp lớp (sửa sai/tạo nhầm tuần).
export async function deleteMeeting(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const id = String(formData.get('id') ?? '');
  const classParam = String(formData.get('class') ?? '');
  // Tuần đang xem, do khối họp nhúng trong /wig gửi lên (rỗng nếu bấm từ trang /meeting).
  const week = String(formData.get('week') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('wig_meetings').delete().eq('id', id);
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/wig', 'page');
  const q = new URLSearchParams();
  if (classParam) q.set('class', classParam);
  q.set('flash', error ? friendlyError(error) : 'Đã xoá biên bản');
  // VỀ ĐÚNG CHỖ VỪA BẤM. Trước đây luôn redirect sang /meeting, kể cả khi người dùng đang ở /wig
  // — mà /meeting không còn nằm trên thanh nav của GVCN, và cũng không có nút ← → nào. Bấm xoá
  // một biên bản của tuần cũ là bị ném sang một trang lạ, mất luôn tuần đang dọn dở.
  if (week) q.set('week', week);
  redirect(`${week ? '/wig' : '/meeting'}?${q.toString()}`);
}
