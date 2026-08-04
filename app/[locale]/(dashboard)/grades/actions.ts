'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {CONDUCTS, SCORE_KINDS, TERM_KINDS} from '@/components/grades/labels';
import type {Conduct, ScoreKind, TermKind} from '@/components/grades/labels';

// Môn giờ là một dòng trong danh mục (0069), nên mọi chỗ nhắc tới môn đều là UUID — cả ô ẩn
// trong form lẫn ?subject= trên địa chỉ. Kiểm hình dạng trước khi gửi xuống DB để không phải
// dịch lỗi 22P02 ("invalid input syntax for type uuid") thành câu tiếng Việt.
const LA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TÊN MẶC ĐỊNH CỦA ĐỢT — cố ý KHÔNG lấy từ file dịch.
//
// Chuỗi này được GHI VÀO CSDL (cột assessment_terms.name) và cả trường cùng đọc một giá trị đó.
// Nếu lấy theo ngôn ngữ của người đang bấm nút thì hiệu trưởng mở app bản tiếng Anh sẽ tạo ra
// một đợt tên 'Semester 1' nằm lẫn giữa các đợt tên 'Học kỳ 1' — dữ liệu dùng chung mà mỗi dòng
// một thứ tiếng. Nhãn HIỂN THỊ thì vẫn dịch (grades.termKinds.*); đây là DỮ LIỆU, không phải nhãn.
const TEN_DOT_MAC_DINH: Record<TermKind, string> = {
  giua_ky_1: 'Giữa học kỳ 1',
  hoc_ky_1: 'Học kỳ 1',
  giua_ky_2: 'Giữa học kỳ 2',
  hoc_ky_2: 'Học kỳ 2',
  ca_nam: 'Cả năm',
};

// ── Ngữ cảnh đang xem ────────────────────────────────────────────────────────
// Trang này có tới năm tham số cùng lúc (lớp / đợt / môn / loại điểm / lần thứ mấy). Bỏ sót một
// cái khi quay về là giáo viên bị ném sang lớp khác hoặc mất đúng cột vừa nhập dở — chính là
// kiểu bực mình đã ghi nhận với ?class= ở các trang trước. Nên gom vào một chỗ, đọc và ghi lại
// nguyên vẹn.
type Ctx = {
  class?: string;
  term?: string;
  /** ID môn trong danh mục. Tên tham số trên địa chỉ vẫn là `subject`, nhưng GIÁ TRỊ là uuid. */
  subject?: string;
  kind?: string;
  ordinal?: string;
};

function readCtx(formData: FormData): Ctx {
  const s = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v || undefined;
  };
  return {
    class: s('class_id'),
    term: s('term_id'),
    subject: s('subject_id'),
    kind: s('kind'),
    ordinal: s('ordinal'),
  };
}

function gradesFlash(ctx: Ctx, msg: string): never {
  const q = new URLSearchParams();
  if (ctx.class) q.set('class', ctx.class);
  if (ctx.term) q.set('term', ctx.term);
  if (ctx.subject) q.set('subject', ctx.subject);
  if (ctx.kind) q.set('kind', ctx.kind);
  if (ctx.ordinal) q.set('ordinal', ctx.ordinal);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/grades?${q.toString()}`);
}

// ── Mở đợt cho cả lớp ────────────────────────────────────────────────────────
// Gọi ĐÚNG MỘT RPC cho cả lớp. Không lặp insert 30 lượt từ đây: hàm open_term_for_class kiểm
// quyền một lần ở một chỗ (comment trong 0064 nói rõ vì sao), còn 30 lượt gọi qua mạng VPS đang
// mất gói thì gần như chắc chắn có lượt rơi giữa chừng, để lại lớp nhập dở một nửa.
export async function openTermForClass(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.class || !ctx.term) gradesFlash(ctx, 'Thiếu lớp hoặc đợt đánh giá');

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('open_term_for_class', {
    p_term: ctx.term,
    p_class: ctx.class,
  });
  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));
  gradesFlash(
    ctx,
    data && data > 0
      ? `Đã mở đợt và tạo phiếu cho ${data} em`
      : 'Mọi em đang học lớp này đều đã có phiếu của đợt này',
  );
}

// ── Lưu MỘT CỘT điểm cho cả lớp ──────────────────────────────────────────────
// Một lần bấm = một cột (môn + loại điểm + lần thứ mấy) của TOÀN LỚP, đúng bộ khoá tự nhiên
// (review_id, subject_id, kind, ordinal) của bảng subject_scores. Nhờ trùng khớp với khoá đó nên
// chỉ cần MỘT lượt upsert cho các em có điểm và MỘT lượt delete cho các ô bị xoá trắng — 30 em
// vẫn là hai chặng mạng, không phải sáu mươi.
//
// AI GỌI ĐƯỢC: giáo viên chủ nhiệm (policy cũ của 0064) VÀ giáo viên bộ môn được phân công đúng
// môn đó ở đúng lớp đó (policy mới của 0069). Cả hai đều là vai 'teacher' nên requireRole không
// phân biệt được — và cũng KHÔNG nên cố phân biệt ở đây: chốt thật nằm ở RLS
// can_write_subject_score(review, subject), hỏi QUAN HỆ chứ không hỏi vai trò. Ở đây chỉ chặn
// người không có việc gì ở màn hình này.
export async function saveScoreColumn(formData: FormData) {
  const me = await requireRole(['teacher', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.class || !ctx.term) gradesFlash(ctx, 'Thiếu lớp hoặc đợt đánh giá');

  const subjectId = ctx.subject ?? '';
  const kind = (ctx.kind ?? '') as ScoreKind;
  const ordinal = Number(ctx.ordinal ?? 1);
  if (!subjectId) gradesFlash(ctx, 'Hãy chọn môn trước khi nhập điểm');
  if (!LA_UUID.test(subjectId))
    gradesFlash(ctx, 'Môn học không hợp lệ — hãy chọn lại trong ô Môn học');
  if (!SCORE_KINDS.includes(kind)) gradesFlash(ctx, 'Loại điểm không hợp lệ');
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 20)
    gradesFlash(ctx, 'Cột điểm phải từ 1 đến 20');

  const ids = String(formData.get('ids') ?? '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0) gradesFlash(ctx, 'Lớp chưa có phiếu nào của đợt này — hãy mở đợt trước.');

  const supabase = await createClient();

  // Hệ số: ưu tiên con số giáo viên chọn; bỏ trống thì HỎI DB chứ không tự điền 1/2/3 ở đây.
  // Migration 0064 đặt default_score_weight() làm nguồn duy nhất đúng vì hệ số lệch giữa màn hình
  // cô và màn hình phụ huynh là loại lỗi phụ huynh phát hiện trước nhà trường.
  const wRaw = Number(String(formData.get('weight') ?? '').trim());
  const wChon: number | null =
    Number.isFinite(wRaw) && wRaw >= 1 && wRaw <= 5 ? Math.round(wRaw) : null;

  // Hai câu hỏi độc lập, hỏi một lượt: hệ số mặc định, và TÊN môn để câu thông báo cuối cùng đọc
  // được. Không tra tên thì thông báo in ra một chuỗi uuid — thứ không giáo viên nào hiểu.
  const [weight, tenMon] = await Promise.all([
    wChon === null
      ? supabase.rpc('default_score_weight', {k: kind}).then((r) => Number(r.data ?? 1))
      : Promise.resolve(wChon),
    supabase
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .maybeSingle()
      .then((r) => r.data?.name ?? null),
  ]);
  const nhanMon = tenMon ? ` môn ${tenMon}` : '';

  const rows: {
    review_id: string;
    subject_id: string;
    kind: ScoreKind;
    ordinal: number;
    score: number;
    weight: number;
    created_by: string;
  }[] = [];
  const empty: string[] = [];
  let soLoi = 0;

  for (const id of ids) {
    // Chấp nhận cả '8,5' lẫn '8.5': bàn phím tiếng Việt cho dấu phẩy là chuyện thường ngày.
    const raw = String(formData.get(`s_${id}`) ?? '')
      .trim()
      .replace(',', '.');
    if (!raw) {
      empty.push(id);
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      soLoi++;
      continue;
    }
    rows.push({
      review_id: id,
      // CHỈ ghi subject_id. Cột chữ `subject` vẫn còn trong bảng nhưng cố ý không đụng tới: ghi
      // cả hai là dựng lại đúng cái "hai nguồn sự thật" mà 0069 vừa dỡ bỏ.
      subject_id: subjectId,
      kind,
      ordinal,
      // numeric(4,2) ở DB — cắt sẵn 2 chữ số để 8.333 không bị Postgres làm tròn theo cách khác.
      score: Math.round(n * 100) / 100,
      weight,
      // subject_scores không có cột updated_by, nên created_by ghi NGƯỜI SỬA GẦN NHẤT thì hữu ích
      // hơn là người gõ đầu tiên — cần truy ai nhập sai thì đây là manh mối duy nhất.
      created_by: me.id,
    });
  }

  // Không lưu một nửa: sai một ô là dừng hẳn. Lưu phần đúng rồi báo lỗi phần sai sẽ khiến giáo
  // viên tưởng đã lưu hết, và con số sai nằm im tới lúc công bố.
  if (soLoi > 0)
    gradesFlash(ctx, `Có ${soLoi} ô điểm không hợp lệ (điểm phải từ 0 đến 10). Chưa lưu gì cả.`);

  if (rows.length > 0) {
    // onConflict PHẢI đi cùng khoá unique thật của bảng. 0069 đã đổi khoá đó sang
    // (review_id, subject_id, kind, ordinal); để nguyên chuỗi cũ là PostgREST trả 42P10
    // "no unique constraint matching the ON CONFLICT specification" và không lưu được gì.
    //
    // .select() để phân biệt "RLS chặn / đợt đã chốt sổ" với "đã ghi xong" — không báo thành công giả.
    const {data, error} = await supabase
      .from('subject_scores')
      .upsert(rows, {onConflict: 'review_id,subject_id,kind,ordinal'})
      .select('id');
    revalidatePath('/[locale]/grades', 'page');
    if (error) gradesFlash(ctx, loi(friendlyError(error)));
    if ((data ?? []).length === 0)
      gradesFlash(
        ctx,
        'Không lưu được — đợt có thể đã chốt sổ, hoặc bạn không phụ trách môn này ở lớp này.',
      );
  }

  // Xoá trắng một ô = xoá con điểm đó. Nghiệp vụ thật: gõ 9 thành 90 rồi phải bỏ hẳn (0064 nói
  // đúng tình huống này). Chỉ đụng đúng cột đang nhập, không đụng môn khác.
  if (empty.length > 0) {
    const {error} = await supabase
      .from('subject_scores')
      .delete()
      .eq('subject_id', subjectId)
      .eq('kind', kind)
      .eq('ordinal', ordinal)
      .in('review_id', empty);
    if (error) {
      revalidatePath('/[locale]/grades', 'page');
      gradesFlash(ctx, loi(friendlyError(error)));
    }
  }

  revalidatePath('/[locale]/grades', 'page');
  gradesFlash(
    ctx,
    rows.length > 0
      ? `Đã lưu ${rows.length} con điểm${nhanMon}`
      : `Đã xoá điểm${nhanMon} của cột này`,
  );
}

// ── Gieo chương trình môn cho lớp ────────────────────────────────────────────
// Lớp chưa khai môn nào thì ô chọn môn rỗng và cả màn hình nhập điểm là ngõ cụt. RPC
// seed_class_subjects() gắn cả bộ môn đang dùng của cơ sở vào lớp trong một cú bấm — gọi lại
// nhiều lần vẫn an toàn (on conflict do nothing).
//
// Ai được gọi thì chính hàm trong DB quyết (GVCN lớp / ban giám hiệu cơ sở / quản trị viên), ở
// đây không đoán lại: đoán sai theo hướng chặt là khoá nhầm người, đoán sai theo hướng lỏng là
// vẽ ra cái nút bấm vào chỉ để nhận thông báo bị từ chối.
export async function seedClassSubjects(formData: FormData) {
  await requireRole(['teacher', 'principal', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.class) gradesFlash(ctx, 'Thiếu lớp');

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('seed_class_subjects', {p_class: ctx.class});
  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));
  gradesFlash(
    ctx,
    data && data > 0
      ? `Đã thêm ${data} môn vào chương trình của lớp`
      : 'Lớp đã có đủ các môn đang dùng của cơ sở',
  );
}

// ── Lưu nhận xét + hạnh kiểm cả lớp ──────────────────────────────────────────
// Cũng một lượt cho cả lớp, vì cùng lý do với cột điểm. Khoá dùng ở đây là (term_id, student_id)
// — ràng buộc unique có sẵn trong 0064 — nên không cần mang theo id của phiếu.
export async function saveClassReviews(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.class || !ctx.term) gradesFlash(ctx, 'Thiếu lớp hoặc đợt đánh giá');

  const ids = String(formData.get('ids') ?? '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0) gradesFlash(ctx, 'Lớp chưa có phiếu nào của đợt này — hãy mở đợt trước.');

  const rows: {
    term_id: string;
    student_id: string;
    class_id: string;
    comment: string | null;
    conduct: Conduct | null;
    conduct_score: number | null;
  }[] = [];

  for (const sid of ids) {
    const nhanXet = String(formData.get(`comment_${sid}`) ?? '').trim();
    // Chặn ở đây thay vì cắt cụt: cắt cụt là im lặng làm mất chữ cô vừa viết.
    if (nhanXet.length > 2000)
      gradesFlash(ctx, 'Có nhận xét dài quá 2000 ký tự — hãy rút ngắn rồi lưu lại.');

    const hk = String(formData.get(`conduct_${sid}`) ?? '');
    const diemRL = String(formData.get(`cscore_${sid}`) ?? '').trim();
    let diem: number | null = null;
    if (diemRL) {
      const n = Number(diemRL);
      if (!Number.isFinite(n) || n < 0 || n > 100)
        gradesFlash(ctx, 'Điểm rèn luyện phải từ 0 đến 100. Chưa lưu gì cả.');
      diem = Math.round(n);
    }

    rows.push({
      term_id: ctx.term,
      student_id: sid,
      class_id: ctx.class,
      comment: nhanXet || null,
      conduct: CONDUCTS.includes(hk as Conduct) ? (hk as Conduct) : null,
      conduct_score: diem,
    });
  }

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('student_term_reviews')
    .upsert(rows, {onConflict: 'term_id,student_id'})
    .select('student_id');
  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));
  if ((data ?? []).length === 0)
    gradesFlash(ctx, 'Không lưu được — đợt có thể đã chốt sổ, hoặc bạn không chủ nhiệm lớp này.');
  gradesFlash(ctx, `Đã lưu nhận xét và hạnh kiểm cho ${(data ?? []).length} em`);
}

// ── Công bố / gỡ công bố cho cả lớp ──────────────────────────────────────────
// Cố ý làm THEO LỚP chứ không theo từng em: cô nhập rải rác nhiều ngày rồi mới gửi gia đình một
// thể, đó mới là nhịp làm việc thật. Sửa một lỗi nhỏ sau khi công bố thì KHÔNG cần gỡ — RLS vẫn
// cho GVCN sửa phiếu đã công bố, và trigger audit_review_publish ghi lại việc sửa-sau-công-bố.
export async function publishTerm(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.class || !ctx.term) gradesFlash(ctx, 'Thiếu lớp hoặc đợt đánh giá');
  const congBo = String(formData.get('mode') ?? 'publish') === 'publish';

  // Trang gửi kèm ĐÚNG danh sách phiếu được phép ghi (em còn học lớp). Không nhận danh sách này
  // mà quét "cả lớp" thì chỉ một phiếu của em đã chuyển lớp là đủ làm đổ nguyên lệnh UPDATE:
  // WITH CHECK của rls_update_student_term_reviews đòi is_enrolled(student_id, class_id), và
  // Postgres huỷ cả câu lệnh chứ không bỏ qua dòng vi phạm.
  const ids = String(formData.get('ids') ?? '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0) gradesFlash(ctx, 'Không có phiếu nào để công bố');

  const supabase = await createClient();
  // published_at là một MỐC THỜI ĐIỂM (timestamptz), không phải "ngày hôm nay" — nên lấy giờ máy
  // chủ là đúng, không cần todayInVN(). Người đọc thấy giờ nào là do trình duyệt tự quy đổi.
  //
  // Vẫn giữ hai bộ lọc term_id/class_id bên cạnh danh sách id: danh sách đến từ trình duyệt nên
  // không được tin một mình. RLS đã chặn phiếu của lớp khác, hai bộ lọc này chặn nốt trường hợp
  // sửa tay id sang một đợt khác của chính lớp mình.
  const q = supabase
    .from('student_term_reviews')
    .update({published_at: congBo ? new Date().toISOString() : null})
    .in('id', ids)
    .eq('term_id', ctx.term)
    .eq('class_id', ctx.class);
  const {data, error} = congBo
    ? await q.is('published_at', null).select('id')
    : await q.not('published_at', 'is', null).select('id');

  // Gia đình đọc bảng điểm ở CHÍNH route này (/grades đổi màn hình theo vai), nên một lần
  // revalidate là đủ cho cả màn hình cô lẫn màn hình phụ huynh.
  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));

  const n = (data ?? []).length;
  gradesFlash(
    ctx,
    congBo
      ? n > 0
        ? `Đã công bố ${n} phiếu — gia đình xem được ngay bây giờ`
        : 'Mọi phiếu của đợt này đã được công bố từ trước'
      : n > 0
        ? `Đã gỡ công bố ${n} phiếu — gia đình không còn xem được`
        : 'Không có phiếu nào đang được công bố',
  );
}

// ── Khai báo đợt đánh giá (hiệu trưởng / quản trị) ───────────────────────────
// Đây KHÔNG phải ngoại lệ tự nghĩ ra: policy rls_all_assessment_terms trong 0064 cho hiệu trưởng
// ghi bảng này và giải thích rõ vì sao — khai báo học kỳ là việc LỊCH của nhà trường, không phải
// dữ liệu của một đứa trẻ. Hiệu trưởng vẫn không chạm được một con điểm nào.
// Không có màn này thì không ai tạo được đợt, và toàn bộ tính năng đứng im.
export async function createTerm(formData: FormData) {
  const me = await requireRole(['principal', 'admin']);
  const ctx = readCtx(formData);
  const campusId = String(formData.get('campus_id') ?? '').trim();
  const schoolYear = String(formData.get('school_year') ?? '').trim();
  const kind = String(formData.get('kind') ?? '') as TermKind;
  const start = String(formData.get('start_date') ?? '').trim();
  const end = String(formData.get('end_date') ?? '').trim();

  if (!campusId || !schoolYear) gradesFlash(ctx, 'Thiếu cơ sở hoặc năm học');
  if (!TERM_KINDS.includes(kind)) gradesFlash(ctx, 'Hãy chọn loại đợt đánh giá');

  // Bỏ trống tên thì lấy đúng tên loại đợt. 0064 tách `kind` (máy so sánh) khỏi `name` (người
  // đọc) để trường tự đặt tên riêng được, nhưng phần lớn trường gọi y như loại — bắt gõ lại một
  // lần nữa chỉ tổ tạo ra 'HK1', 'Học kì 1', 'Học kỳ I' nằm lẫn trong cùng một cột.
  const name = String(formData.get('name') ?? '').trim() || TEN_DOT_MAC_DINH[kind];
  if (name.length > 80) gradesFlash(ctx, 'Tên đợt dài quá 80 ký tự');
  if (start && end && end < start) gradesFlash(ctx, 'Ngày kết thúc phải sau ngày bắt đầu');

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('assessment_terms')
    .insert({
      campus_id: campusId,
      school_year: schoolYear,
      kind,
      name,
      start_date: start || null,
      end_date: end || null,
      created_by: me.id,
    })
    .select('id')
    .maybeSingle();

  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));
  // Nhảy thẳng vào đợt vừa tạo — vừa khai báo xong là mở được ngay, không phải đi tìm trong ô chọn.
  gradesFlash({...ctx, term: data?.id ?? ctx.term}, `Đã tạo đợt đánh giá "${name}"`);
}

// ── Chốt sổ / mở lại đợt ─────────────────────────────────────────────────────
// is_locked là chốt an toàn của 0064: khoá rồi thì giáo viên hết sửa được điểm và nhận xét, để
// điểm không bị đổi lặng lẽ SAU khi phiếu đã về tay phụ huynh.
export async function setTermLock(formData: FormData) {
  await requireRole(['principal', 'admin']);
  const ctx = readCtx(formData);
  if (!ctx.term) gradesFlash(ctx, 'Thiếu đợt đánh giá');
  const khoa = String(formData.get('lock') ?? '') === '1';

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('assessment_terms')
    .update({is_locked: khoa})
    .eq('id', ctx.term)
    .select('id');

  revalidatePath('/[locale]/grades', 'page');
  if (error) gradesFlash(ctx, loi(friendlyError(error)));
  if ((data ?? []).length === 0)
    gradesFlash(ctx, 'Không đổi được — bạn không có quyền với đợt đánh giá của cơ sở này.');
  gradesFlash(
    ctx,
    khoa
      ? 'Đã chốt sổ đợt này — giáo viên không sửa được điểm và nhận xét nữa'
      : 'Đã mở lại đợt này cho giáo viên nhập tiếp',
  );
}
