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
// mocId truyền vào thì CHỈ lấy những dòng khai `viec_<k>_moc` đúng bằng mốc ấy (0106: mỗi lĩnh
// vực một khối, phải tách đúng việc của khối nào cho khối đó). Không truyền (nhánh bù mốc, chỉ
// một khối chung) thì lấy hết, không lọc.
function docViec(formData: FormData, mocId?: string): ViecMoi[] {
  const khoa: string[] = [];
  for (const key of formData.keys()) {
    const m = key.match(/^viec_(.+)_title$/);
    if (m && !khoa.includes(m[1])) khoa.push(m[1]);
  }
  const out: ViecMoi[] = [];
  for (const k of khoa) {
    if (mocId !== undefined && String(formData.get(`viec_${k}_moc`) ?? '') !== mocId) continue;
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

  // ── 1. VIỆC CHO TUẦN TỚI — MỖI LĨNH VỰC MỘT MỐC (0106) ───────────────────────────────────
  //
  // Bước này KHÔNG tạo mục tiêu nữa. Trước đây nó đẻ ra một WIG tuần mới mỗi tuần (và cả một WIG
  // tháng nếu thiếu mắt xích) — nghĩa là mỗi tuần một mục tiêu rời, số lượng phình theo thời gian,
  // mỗi cái có thể lệch đơn vị với cha nó. Cả 4DX lẫn Individual WIG Plan đều đặt mục tiêu MỘT
  // LẦN cho cả kỳ; buổi họp chỉ báo cáo → nhìn bảng điểm → dọn đường.
  //
  // Từ 0100, mốc tuần đã được app rải sẵn ngay khi cô khai mục tiêu năm (lib/wig-nhip.ts). Ở đây
  // chỉ còn hai việc: chỉnh chỉ tiêu của mốc nếu tuần ấy đặc biệt, và gắn việc cho các em tick.
  //
  // TRƯỚC 0106 chỉ MỘT mốc (một <select>) được sửa mỗi lần họp — ba lĩnh vực còn lại không có
  // đường nào chạm tới qua phòng họp. Nay PhongHop gửi lên một trường `moc_target_<id>` cho MỖI
  // mốc đang hiện; quét hết các trường ấy để biết cần chỉnh bao nhiêu mốc, không tin vào một
  // danh sách id gửi kèm riêng (danh sách ấy cũng do trình duyệt gửi, không đáng tin hơn).
  const buMoc = String(formData.get('bu_moc') ?? '') === '1';

  if (buMoc) {
    if (!dich_label) return {ok: false, fieldError: 'moc_target', error: 'Không rõ đang họp cho tuần nào.'};
    const moc_target = Number(String(formData.get('moc_target') ?? '').trim());
    if (!Number.isFinite(moc_target) || moc_target <= 0)
      return {ok: false, fieldError: 'moc_target', error: 'Chỉ tiêu của tuần phải là số lớn hơn 0.'};

    // BÙ MỐC — chỉ xảy ra khi cô khai mục tiêu năm SAU khi tuần này đã trôi qua, nên nhịp app
    // rải không phủ tới. Bù đúng một mốc, không đẻ mục tiêu mới. Trường hợp hiếm (chưa lĩnh vực
    // nào có mốc), nên vẫn là một khối chung — không cần tách theo lĩnh vực.
    const kq = await taoMotWig(supabase, {
      class_id,
      period: 'week',
      // Không có ô cho cô gõ tên/đơn vị: gõ lệch cha một chữ là mốc rơi khỏi cây tổng hợp mà
      // nhìn màn hình vẫn thấy nằm đúng chỗ. Trước đây hai dòng này ĐỌC hai trường `bu_title` /
      // `bu_unit` mà PhongHop chưa từng dựng ra, nên đơn vị luôn rơi vào chuỗi bịa 'lần' — mục
      // tiêu năm đếm "bài", mốc bù của chính nó đếm "lần". Nay taoMotWig tra cha và thừa kế
      // đơn vị thật, nên ở đây để trống là đúng.
      title: `Tuần ${dich_label}`,
      baseline: null,
      target_value: moc_target,
      unit: '',
      period_label: dich_label,
      parent_wig_id: String(formData.get('bu_nam') ?? '').trim() || undefined,
    });
    if (!kq.ok) return {ok: false, fieldError: 'moc_target', error: kq.loi};
    lam.push(`bù mốc tuần ${dich_label}`);

    // VIỆC cho các em tick — nhánh này chỉ có một khối chung, không có trường `_moc` nào được
    // gửi (không mocId nào để lọc), nên lấy hết là đúng.
    const viec = docViec(formData);
    const hong = viec.find((v) => !Number.isFinite(v.target_value) || v.target_value <= 0);
    if (hong)
      return {
        ok: false,
        fieldError: 'viec',
        error: `Việc “${hong.title}” chưa có mục tiêu hợp lệ (phải là số lớn hơn 0). Chỉ tiêu tuần ĐÃ lưu — sửa số rồi lưu lại, lần này chỉ cần thêm việc.`,
      };
    if (viec.length > 0) {
      const {data, error} = await supabase
        .from('lead_measures')
        .insert(viec.map((v) => ({wig_id: kq.id, ...v})))
        .select('id');
      if (error) return {ok: false, error: friendlyError(error)};
      lam.push(`đặt ${data?.length ?? 0} việc cho các em tick`);
    }
  } else {
    // Mỗi mốc hiện trên màn gửi lên đúng một trường `moc_target_<id>` — quét ra danh sách mốc
    // cần xử lý. Không mốc nào (lớp chưa có mục tiêu năm nào) thì vòng lặp không chạy, giữ
    // nguyên hành vi cũ: bước 1 không đụng gì, chỉ bước 2/3 chạy.
    const mocIds: string[] = [];
    for (const key of formData.keys()) {
      const m = key.match(/^moc_target_(.+)$/);
      if (m && !mocIds.includes(m[1])) mocIds.push(m[1]);
    }

    for (const mocId of mocIds) {
      const moc_target = Number(String(formData.get(`moc_target_${mocId}`) ?? '').trim());
      if (!Number.isFinite(moc_target) || moc_target <= 0)
        return {
          ok: false,
          fieldError: `moc_target_${mocId}`,
          error: 'Chỉ tiêu của tuần phải là số lớn hơn 0.',
        };

      // CHỈNH chỉ tiêu của mốc đã có. .select() để phân biệt "RLS chặn" với "đã ghi" — thiếu nó
      // thì lớp không thuộc quyền mình vẫn báo thành công.
      const {data, error} = await supabase
        .from('wigs')
        .update({target_value: moc_target})
        .eq('id', mocId)
        .eq('class_id', class_id)
        .eq('scope', 'class')
        .select('id')
        .maybeSingle();
      if (error) return {ok: false, fieldError: `moc_target_${mocId}`, error: friendlyError(error)};
      if (!data)
        return {
          ok: false,
          fieldError: `moc_target_${mocId}`,
          error: 'Không sửa được mốc tuần này (không có quyền với lớp).',
        };
      lam.push(`chỉnh chỉ tiêu tuần ${dich_label}`);

      // VIỆC cho các em tick, RIÊNG của mốc này. THAY toàn bộ, không cộng dồn: buổi họp mở ra đã
      // điền sẵn việc của tuần rồi (viecMau), nên nếu chỉ chèn thêm thì mỗi lần lưu lại là một
      // bộ việc trùng nữa, và bảng tick của em dài gấp đôi sau hai tuần.
      const viec = docViec(formData, mocId);
      const hong = viec.find((v) => !Number.isFinite(v.target_value) || v.target_value <= 0);
      if (hong)
        return {
          ok: false,
          fieldError: 'viec',
          error: `Việc “${hong.title}” chưa có mục tiêu hợp lệ (phải là số lớn hơn 0). Chỉ tiêu tuần ĐÃ lưu — sửa số rồi lưu lại, lần này chỉ cần thêm việc.`,
        };
      if (viec.length > 0) {
        // Chỉ xoá những việc CHƯA CÓ TICK NÀO. Xoá một việc đã có tick là xoá dữ liệu thật của
        // học sinh — thà để lại một dòng thừa còn hơn mất lịch sử làm bài của các em.
        const {data: cu} = await supabase
          .from('lead_measures')
          .select('id, lead_progress(id)')
          .eq('wig_id', mocId);
        const trong = (cu ?? [])
          .filter((l) => ((l.lead_progress as unknown[]) ?? []).length === 0)
          .map((l) => l.id);
        if (trong.length > 0) await supabase.from('lead_measures').delete().in('id', trong);

        const {data: moi, error: e2} = await supabase
          .from('lead_measures')
          .insert(viec.map((v) => ({wig_id: mocId, ...v})))
          .select('id');
        if (e2) return {ok: false, error: friendlyError(e2)};
        lam.push(`đặt ${moi?.length ?? 0} việc cho các em tick`);
      }
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

  // ── 3. BIÊN BẢN ─────────────────────────────────────────────────────────────────────────
  //
  // LƯU KHÔNG CÒN LÀ CHỐT (0108). Trước đây chỉ cần dòng biên bản tồn tại là `tuan_da_hop()` trả
  // true và cả tuần khoá lại. Phòng họp chỉ có một nút nên thường điều đó trùng với lúc họp xong —
  // nhưng cô lưu giữa chừng (chấm ba việc, lưu, họp tiếp) là các em hết tick được và ô số đo hết
  // ghi được ngay giữa buổi họp, đúng lúc buổi họp cần chúng.
  //
  // Nay hai nút: Lưu tạm ghi mọi thứ nhưng để `chot_at` null; Chốt buổi họp mới đóng tuần.
  const chot = String(formData.get('chot') ?? '') === '1';

  // Bấm CHỐT thì luôn phải có dòng biên bản để mang dấu chốt — kể cả khi buổi họp không chấm việc
  // nào và không ghi chữ nào. Chốt là một sự kiện, không phải một hệ quả của việc điền form.
  if (chiem_nghiem || cam_ket || rows.length > 0 || chot) {
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
      // Chỉ GHI dấu chốt, không bao giờ xoá nó ở đây: bỏ chốt là việc của nút gỡ biên bản, có hộp
      // xác nhận riêng. Lưu tạm sau khi đã chốt mà lại âm thầm mở khoá tuần thì cô không hề biết
      // mình vừa mở, còn các em thì đột nhiên tick lại được vào một tuần đã tổng kết.
      ...(chot ? {chot_at: new Date().toISOString(), chot_by: me.id} : {}),
    };
    const {error} = cu
      ? await supabase.from('wig_meetings').update(payload).eq('id', cu.id)
      : await supabase.from('wig_meetings').insert(payload);
    if (error) return {ok: false, error: (friendlyError(error))};
    lam.push(chot ? 'chốt buổi họp' : cu ? 'cập nhật biên bản' : 'lưu biên bản');
  }

  if (lam.length === 0)
    return {ok: false, error: 'Chưa điền gì cả — chấm ít nhất một việc, hoặc ghi chiêm nghiệm/cam kết.'};

  // Nói đúng cái vừa xảy ra. Câu "tick đã chốt" chỉ được nói khi tick THẬT SỰ đã chốt — bản trước
  // nói câu ấy sau mọi lần lưu, nên cô lưu tạm cũng đọc thấy tuần đã đóng.

  revalidatePath('/[locale]/wig', 'page');
  revalidatePath('/[locale]/wig/hop', 'page');
  revalidatePath('/[locale]/wig/chi-tiet', 'page');
  revalidatePath('/[locale]/meeting', 'page');
  revalidatePath('/[locale]/student', 'page');
  revalidatePath('/[locale]', 'page');

  return {
    ok: true,
    message: chot
      ? `Xong: ${lam.join(', ')}. Tick và số đo của tuần ${hop_label} đã chốt.`
      : `Đã lưu: ${lam.join(', ')}. Tuần ${hop_label} chưa chốt — các em vẫn tick và nhập số được.`,
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
