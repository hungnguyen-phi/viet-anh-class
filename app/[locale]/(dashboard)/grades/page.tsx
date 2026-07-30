import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Lock, LockOpen} from 'lucide-react';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {FlashToast} from '@/components/ui/FlashToast';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {btnGold, btnGhost, btnDanger} from '@/components/ui/Field';
import {FamilyReport} from '@/components/grades/FamilyReport';
import {TermCreateForm} from '@/components/grades/TermCreateForm';
import {ClassOverview} from '@/components/grades/ClassOverview';
import {ClassScoreTable, type ScoreTableRow} from '@/components/grades/ClassScoreTable';
import {ScoreColumnForm, type ScoreCell} from '@/components/grades/ScoreColumnForm';
import {ReviewListForm, type ReviewRow} from '@/components/grades/ReviewListForm';
import {
  SCORE_KINDS,
  TERM_KIND_LABEL,
  tenCot,
  type Conduct,
  type ScoreKind,
  type TermKind,
} from '@/components/grades/labels';
import {TermPicker} from './TermPicker';
import {ColumnPicker} from './ColumnPicker';
import {openTermForClass, publishTerm, setTermLock} from './actions';

type EnrRow = {
  student_id: string;
  profiles: {full_name: string | null; email: string} | null;
};
type PhieuRow = {
  id: string;
  student_id: string;
  conduct: Conduct | null;
  conduct_score: number | null;
  comment: string | null;
  published_at: string | null;
  profiles: {full_name: string | null; email: string} | null;
};
type SumRow = {review_id: string | null; subject: string | null; diem_trung_binh: number | null};
type ColRow = {review_id: string; score: number; weight: number};

// Postgres trả yyyy-mm-dd, trường học Việt Nam đọc ngày/tháng/năm (giống roster/page.tsx).
function ngayVN(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export default async function GradesPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    class?: string;
    term?: string;
    subject?: string;
    kind?: string;
    ordinal?: string;
    child?: string;
    flash?: string;
  }>;
}) {
  const {locale} = await params;
  const {
    class: classParam,
    term: termParam,
    subject: subjectParam,
    kind: kindParam,
    ordinal: ordinalParam,
    child: childParam,
    flash,
  } = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();

  // Gia đình (phụ huynh + chính học sinh) xem một màn hình hoàn toàn khác: chỉ đọc, chỉ các đợt
  // ĐÃ CÔNG BỐ, và của đúng một em. Tách hẳn từ đây cho khỏi lẫn với màn hình nhập liệu.
  if (profile.role === 'parent' || profile.role === 'student') {
    return <FamilyReport profile={profile} childParam={childParam} termParam={termParam} />;
  }

  const tc = await getTranslations('class');
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  // HAI quyền khác nhau, đừng gộp thành một `canManage`:
  //  • canEdit  = nhập điểm/nhận xét/hạnh kiểm → GVCN của lớp và quản trị viên (RLS
  //    rls_insert/update_student_term_reviews). Hiệu trưởng KHÔNG có, nên không vẽ nút cho họ.
  //  • canTerm  = khai báo/chốt sổ đợt đánh giá → hiệu trưởng cùng cơ sở và quản trị viên
  //    (rls_all_assessment_terms). 0064 nói rõ đây là việc LỊCH của trường, không phải dữ liệu
  //    của một đứa trẻ — và nếu không ai làm được thì cả tính năng đứng im.
  const canEdit = profile.role === 'teacher' || profile.role === 'admin';
  const canTerm = profile.role === 'principal' || profile.role === 'admin';

  // Đợt đánh giá của CƠ SỞ lớp này, trong ĐÚNG năm học của lớp. Lấy theo năm học của lớp chứ
  // không theo "năm học hiện tại" tính ở máy chủ: lớp lưu năm học của chính nó, còn máy chủ chạy
  // UTC nên quanh mốc chuyển năm học sẽ lệch (bài học ở 0019/0025).
  // `.order('kind')` = thứ tự enum trong Postgres = giữa kỳ 1 → cả năm, không phải sắp lại ở đây.
  const {data: termData} = await supabase
    .from('assessment_terms')
    .select('id, name, kind, school_year, start_date, end_date, is_locked')
    .eq('campus_id', myClass.campus_id)
    .eq('school_year', myClass.school_year)
    .order('kind');
  const terms = termData ?? [];
  const term = terms.find((t) => t.id === termParam) ?? terms[0] ?? null;
  const daCoLoai = terms.map((t) => t.kind as TermKind);

  const tieuDe = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-[22px] font-bold text-navy">Học bạ · {myClass.name}</h1>
      {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
    </div>
  );

  // Chưa có đợt nào → màn hình này là ngõ cụt với giáo viên. Nói thẳng ai là người mở đường.
  if (!term) {
    return (
      <div className="flex flex-col gap-4">
        {tieuDe}
        {flash && <FlashToast message={flash} />}
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            Năm học {myClass.school_year} chưa có đợt đánh giá nào cho cơ sở này.
            {!canTerm && ' Nhờ ban giám hiệu khai báo học kỳ trước, rồi giáo viên mới nhập điểm được.'}
          </p>
        </div>
        {canTerm && (
          <TermCreateForm
            campusId={myClass.campus_id}
            schoolYear={myClass.school_year}
            classId={myClass.id}
            daCo={daCoLoai}
          />
        )}
      </div>
    );
  }

  // Cột điểm đang nhập — lấy từ địa chỉ, có gì sai thì rơi về mặc định thay vì báo lỗi.
  const kind: ScoreKind = SCORE_KINDS.includes(kindParam as ScoreKind)
    ? (kindParam as ScoreKind)
    : 'mieng';
  const oRaw = Number(ordinalParam ?? 1);
  const ordinal = Number.isInteger(oRaw) && oRaw >= 1 && oRaw <= 20 ? oRaw : 1;

  const [{data: enrollData}, {data: phieuData}, {data: tkbData}, {data: heSoMacDinh}] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
        .eq('class_id', myClass.id)
        .eq('is_active', true),
      // Phiếu KÈM tên em: em chuyển lớp giữa đợt sẽ rời enrollments nhưng phiếu vẫn thuộc lớp cũ
      // (0064 cố ý lưu class_id tại thời điểm đánh giá). Không lấy tên ở đây thì phiếu của em đó
      // biến mất khỏi màn hình cùng với điểm đã nhập.
      supabase
        .from('student_term_reviews')
        .select(
          'id, student_id, conduct, conduct_score, comment, published_at, ' +
            'profiles!student_term_reviews_student_id_fkey(full_name, email)',
        )
        .eq('term_id', term.id)
        .eq('class_id', myClass.id),
      // Danh sách môn lấy từ THỜI KHOÁ BIỂU của lớp: dự án chưa có bảng danh mục môn (0064 giải
      // thích vì sao không dựng vội), mà TKB đã có sẵn đúng tên môn lớp này đang học.
      supabase.from('timetable_slots').select('subject').eq('class_id', myClass.id),
      // Hệ số mặc định theo loại điểm — hỏi DB, không rải số 1/2/3 trong frontend.
      supabase.rpc('default_score_weight', {k: kind}),
    ]);

  const phieu = (phieuData ?? []) as unknown as PhieuRow[];
  const phieuTheoEm = new Map(phieu.map((p) => [p.student_id, p]));
  const tenCuaEm = (p: {full_name: string | null; email: string} | null, fallback: string) =>
    p?.full_name ?? p?.email ?? fallback;

  // Em CÒN ĐANG HỌC lớp này. Phải phân biệt với "em có phiếu", vì RLS
  // rls_update_student_term_reviews đặt `is_enrolled(student_id, class_id)` trong WITH CHECK:
  // phiếu của em ĐÃ RỜI LỚP giữa đợt vẫn ĐỌC được nhưng không GHI được nữa. Mà vi phạm WITH CHECK
  // thì Postgres huỷ NGUYÊN CÂU LỆNH, không phải bỏ qua một dòng — nghĩa là một em chuyển trường
  // đủ làm cả lớp không lưu được nhận xét và không công bố được, với thông báo cụt lủn "bạn không
  // có quyền". Nên mọi form GHI chỉ nhận em còn học; phiếu của em đã rời lớp vẫn hiện trong bảng
  // để điểm cũ không biến mất.
  const dangHoc = new Set(((enrollData ?? []) as unknown as EnrRow[]).map((e) => e.student_id));

  const hocSinh = [
    ...phieu.map((p) => ({
      studentId: p.student_id,
      name: tenCuaEm(p.profiles, p.student_id),
      conHoc: dangHoc.has(p.student_id),
      phieu: p as PhieuRow | null,
    })),
    // Em đang học lớp nhưng CHƯA có phiếu của đợt này (mới vào lớp sau khi cô đã mở đợt).
    ...((enrollData ?? []) as unknown as EnrRow[])
      .filter((e) => !phieuTheoEm.has(e.student_id))
      .map((e) => ({
        studentId: e.student_id,
        name: tenCuaEm(e.profiles, e.student_id),
        conHoc: true,
        phieu: null as PhieuRow | null,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const coPhieu = hocSinh.filter((h) => h.phieu !== null);
  const thieuPhieu = hocSinh.length - coPhieu.length;
  const reviewIds = coPhieu.map((h) => h.phieu!.id);
  // Tập ghi được = phiếu của em còn học. Cũng chính là tập mà nút Công bố tác động.
  const ghiDuoc = coPhieu.filter((h) => h.conHoc);
  const daRoiLop = coPhieu.length - ghiDuoc.length;

  const monTKB = [...new Set(((tkbData ?? []) as {subject: string}[]).map((s) => s.subject))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'vi'));
  // Môn đang nhập: theo địa chỉ, mặc định là môn đầu trong TKB. Nếu lớp chưa có TKB thì để trống
  // và ColumnPicker mở sẵn ô gõ tên môn — chọn một môn đã có điểm cũng chỉ là một cú bấm.
  const subject = (subjectParam ?? '').trim() || monTKB[0] || '';

  let sumRows: SumRow[] = [];
  let colRows: ColRow[] = [];
  if (reviewIds.length > 0) {
    // Bỏ hẳn truy vấn khi lớp chưa có phiếu nào: `.in('review_id', [])` vẫn tốn một chặng mạng.
    const [sumRes, cols] = await Promise.all([
      supabase
        .from('subject_term_summary_v')
        .select('review_id, subject, diem_trung_binh')
        .in('review_id', reviewIds),
      // Con điểm của ĐÚNG cột đang nhập — chỉ hỏi khi có người nhập được. Hiệu trưởng chỉ xem
      // bảng tổng kết, kéo về cả cột điểm cho họ là một chặng mạng không ai dùng tới.
      canEdit && subject
        ? supabase
            .from('subject_scores')
            .select('review_id, score, weight')
            .eq('subject', subject)
            .eq('kind', kind)
            .eq('ordinal', ordinal)
            .in('review_id', reviewIds)
            .then((r) => ((r.data ?? []) as ColRow[]))
        : Promise.resolve([] as ColRow[]),
    ]);
    sumRows = (sumRes.data ?? []) as SumRow[];
    colRows = cols;
  }

  // Trung bình từng môn của từng em — lấy NGUYÊN từ view, không nhân chia lại ở đây.
  const tbTheoPhieu = new Map<string, Record<string, number | null>>();
  const monCoDiem = new Set<string>();
  for (const s of sumRows) {
    if (!s.review_id || !s.subject) continue;
    monCoDiem.add(s.subject);
    const rec = tbTheoPhieu.get(s.review_id) ?? {};
    rec[s.subject] = s.diem_trung_binh === null ? null : Number(s.diem_trung_binh);
    tbTheoPhieu.set(s.review_id, rec);
  }
  const monHienCo = [...new Set([...monTKB, ...monCoDiem])].sort((a, b) => a.localeCompare(b, 'vi'));

  const diemTheoPhieu = new Map(colRows.map((c) => [c.review_id, c]));
  // Hệ số của cột: nếu cột đã có điểm thì giữ đúng hệ số đang lưu (lưu lại mà đổi lặng lẽ hệ số
  // là mọi con điểm cũ đổi ý nghĩa); cột mới thì lấy mặc định theo loại điểm từ DB.
  const heSo = colRows[0]?.weight ?? Number(heSoMacDinh ?? 1);

  // Số hiển thị ở thanh đợt tính trên MỌI phiếu (kể cả em đã rời lớp) — đó là sự thật của lớp.
  const daCongBo = coPhieu.filter((h) => h.phieu!.published_at !== null).length;
  // Còn hai con số trên NÚT thì tính trên tập ghi được, để nút hứa đúng bằng việc nó làm được.
  const coTheCongBo = ghiDuoc.filter((h) => h.phieu!.published_at === null).length;
  const coTheGoCongBo = ghiDuoc.length - coTheCongBo;

  // Đúng bằng điều kiện của RLS (rls_update_student_term_reviews): GVCN sửa được khi đợt chưa
  // chốt sổ, quản trị viên sửa được cả sau khi chốt. Viết trùng khớp để không bao giờ hiện một
  // cái nút mà bấm vào là bị chặn.
  const suaDuoc = canEdit && (!term.is_locked || profile.role === 'admin');

  // Điểm thì em đã rời lớp VẪN sửa được: policy của subject_scores chỉ hỏi review_is_editable()
  // (chủ nhiệm lớp + đợt chưa chốt sổ), không hỏi em còn học hay không. Giữ các em ấy trong lưới
  // nhập điểm để cô sửa nốt con điểm gõ nhầm, nhưng ghi rõ để không ai tưởng em còn trong lớp.
  const scoreCells: ScoreCell[] = coPhieu.map((h) => ({
    reviewId: h.phieu!.id,
    name: h.conHoc ? h.name : `${h.name} (đã rời lớp)`,
    current:
      diemTheoPhieu.get(h.phieu!.id) === undefined
        ? ''
        : String(diemTheoPhieu.get(h.phieu!.id)!.score),
  }));

  const reviewRows: ReviewRow[] = ghiDuoc.map((h) => ({
    studentId: h.studentId,
    name: h.name,
    comment: h.phieu!.comment ?? '',
    conduct: h.phieu!.conduct ?? '',
    conductScore: h.phieu!.conduct_score === null ? '' : String(h.phieu!.conduct_score),
    published: h.phieu!.published_at !== null,
  }));

  const tableRows: ScoreTableRow[] = coPhieu.map((h) => ({
    studentId: h.studentId,
    name: h.name,
    published: h.phieu!.published_at !== null,
    daRoiLop: !h.conHoc,
    conduct: h.phieu!.conduct,
    tb: tbTheoPhieu.get(h.phieu!.id) ?? {},
  }));

  return (
    <div className="flex flex-col gap-4">
      {tieuDe}

      {flash && <FlashToast message={flash} />}

      {/* ── Thanh đợt đánh giá ─────────────────────────────────────────────── */}
      <div className="glass rounded-[20px] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <TermPicker terms={terms} current={term.id} />

          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                term.is_locked ? 'bg-status-bad/[0.08] text-status-bad' : 'bg-gold/20 text-navy'
              }`}
            >
              {term.is_locked ? 'đã chốt sổ' : 'đang mở'}
            </span>
            <span className="text-[12px] font-semibold text-grey-mid">
              Đã công bố <b className="text-navy">{daCongBo}</b>/{coPhieu.length} phiếu
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-2">
            {canEdit && thieuPhieu > 0 && (
              <form action={openTermForClass}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="term_id" value={term.id} />
                <SubmitButton className={btnGold} wrapClass="contents">
                  Mở đợt cho cả lớp ({thieuPhieu} em)
                </SubmitButton>
              </form>
            )}
            {canTerm && (
              <form action={setTermLock}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="term_id" value={term.id} />
                <input type="hidden" name="lock" value={term.is_locked ? '0' : '1'} />
                <ConfirmButton
                  message={
                    term.is_locked
                      ? `Mở lại đợt "${term.name}"? Giáo viên chủ nhiệm sẽ sửa được điểm và nhận xét trở lại.`
                      : `Chốt sổ đợt "${term.name}"? Sau khi chốt, giáo viên không sửa được điểm và nhận xét của đợt này nữa.`
                  }
                  className={btnGhost}
                >
                  {/* ConfirmButton bọc nội dung trong một <span> trơn, nên gap của nút không áp
                      được cho cặp icon+chữ — phải tự cho chúng một hàng flex. */}
                  <span className="inline-flex items-center gap-1.5">
                    {term.is_locked ? (
                      <>
                        <LockOpen size={14} strokeWidth={2.5} />
                        Mở lại đợt
                      </>
                    ) : (
                      <>
                        <Lock size={14} strokeWidth={2.5} />
                        Chốt sổ đợt
                      </>
                    )}
                  </span>
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-[11px] italic text-grey-mid">
          {TERM_KIND_LABEL[term.kind as TermKind]} · năm học {term.school_year}
          {(term.start_date || term.end_date) &&
            ` · từ ${ngayVN(term.start_date) || '…'} đến ${ngayVN(term.end_date) || '…'}`}
        </p>
      </div>

      {term.is_locked && canEdit && profile.role !== 'admin' && (
        <p className="text-[12px] font-bold text-status-bad">
          Đợt này đã chốt sổ — không sửa được điểm và nhận xét nữa. Cần sửa thì nhờ ban giám hiệu
          mở lại đợt.
        </p>
      )}

      {coPhieu.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {canEdit
              ? 'Lớp chưa có phiếu nào trong đợt này. Bấm “Mở đợt cho cả lớp” ở trên để tạo phiếu cho mọi em một lượt, rồi mới nhập điểm được.'
              : 'Giáo viên chủ nhiệm chưa mở đợt đánh giá này cho lớp.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Nhập điểm theo từng cột (GVCN / quản trị) ──────────────────── */}
          {suaDuoc && (
            <div className="flex flex-col gap-3">
              <div className="glass rounded-[20px] p-4">
                <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
                  Chọn cột điểm cần nhập
                </div>
                <ColumnPicker
                  subjects={monHienCo}
                  subject={subject}
                  kind={kind}
                  ordinal={ordinal}
                />
              </div>

              {subject ? (
                // key ép remount khi đổi cột → defaultValue nạp lại đúng con điểm của cột mới,
                // nếu không React giữ nguyên giá trị đang gõ trong các ô cũ (bẫy đã gặp ở TKB).
                <ScoreColumnForm
                  key={`${subject}|${kind}|${ordinal}`}
                  classId={myClass.id}
                  termId={term.id}
                  subject={subject}
                  kind={kind}
                  ordinal={ordinal}
                  weight={heSo}
                  rows={scoreCells}
                />
              ) : (
                <p className="text-[12px] font-semibold text-grey-mid">
                  Hãy chọn hoặc gõ tên môn ở trên để bắt đầu nhập điểm.
                </p>
              )}
            </div>
          )}

          {/* ── Nhận xét + hạnh kiểm (GVCN / quản trị) ─────────────────────── */}
          {suaDuoc && (
            <>
              <ReviewListForm classId={myClass.id} termId={term.id} rows={reviewRows} />
              {daRoiLop > 0 && (
                <p className="text-[11px] italic text-grey-mid">
                  Có {daRoiLop} em đã rời lớp giữa đợt: phiếu cũ vẫn giữ nguyên trong bảng bên dưới,
                  nhưng không sửa được nhận xét/hạnh kiểm và không công bố thêm được nữa. Cần xử lý
                  thì nhờ quản trị viên.
                </p>
              )}
            </>
          )}

          {/* ── Công bố cho gia đình ───────────────────────────────────────── */}
          {suaDuoc && (
            <div className="glass rounded-[20px] p-4">
              <div className="font-display text-[15px] font-bold text-navy">
                Công bố cho gia đình
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-[1.55] text-grey-mid">
                Trước khi công bố, mọi thứ ở đây là BẢN NHÁP — chỉ giáo viên và ban giám hiệu nhìn
                thấy. Khi công bố, phụ huynh và chính các em thấy ngay điểm, nhận xét và hạnh kiểm
                của đợt này.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {coTheCongBo > 0 && (
                  <form action={publishTerm}>
                    <input type="hidden" name="class_id" value={myClass.id} />
                    <input type="hidden" name="term_id" value={term.id} />
                    <input type="hidden" name="mode" value="publish" />
                    {/* Liệt kê ĐÚNG những phiếu được phép ghi thay vì "cả lớp": xem ghi chú ở
                        `dangHoc` phía trên — một phiếu của em đã rời lớp sẽ làm đổ cả lệnh. */}
                    <input type="hidden" name="ids" value={ghiDuoc.map((h) => h.phieu!.id).join(',')} />
                    <ConfirmButton
                      message={`Công bố ${coTheCongBo} phiếu của đợt "${term.name}"? GIA ĐÌNH SẼ THẤY NGAY điểm, nhận xét và hạnh kiểm — hãy soát lại trước khi bấm.`}
                      className={btnGold}
                    >
                      Công bố {coTheCongBo} phiếu
                    </ConfirmButton>
                  </form>
                )}
                {coTheGoCongBo > 0 && (
                  <form action={publishTerm}>
                    <input type="hidden" name="class_id" value={myClass.id} />
                    <input type="hidden" name="term_id" value={term.id} />
                    <input type="hidden" name="mode" value="unpublish" />
                    <input type="hidden" name="ids" value={ghiDuoc.map((h) => h.phieu!.id).join(',')} />
                    <ConfirmButton
                      message={`Gỡ công bố ${coTheGoCongBo} phiếu? Gia đình sẽ không xem được nữa. Việc này được ghi lại trong nhật ký hệ thống. Chỉ sửa vài chữ thì KHÔNG cần gỡ — cứ sửa rồi lưu là gia đình thấy bản mới.`}
                      // btnDanger chứ không để mặc định: nút mặc định của ConfirmButton cao 38px,
                      // đứng cạnh nút vàng 44px trong cùng hàng là lệch (đúng lỗi đã phải vá bằng ctl-h).
                      className={btnDanger}
                    >
                      Gỡ công bố {coTheGoCongBo} phiếu
                    </ConfirmButton>
                  </form>
                )}
                {coTheCongBo === 0 && coTheGoCongBo === 0 && (
                  <span className="text-[12px] font-semibold text-grey-mid">
                    Chưa có phiếu nào để công bố.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Bảng điểm cả lớp (mọi vai nhân sự đều xem được) ────────────── */}
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
              Bảng điểm cả lớp · {term.name}
            </h2>
            <ClassScoreTable subjects={monHienCo.filter((m) => monCoDiem.has(m))} rows={tableRows} />
            {monCoDiem.size === 0 && (
              <p className="mt-2 text-[11px] italic text-grey-mid">
                Đợt này chưa có con điểm nào — bảng sẽ hiện ngay khi giáo viên lưu cột điểm đầu tiên.
              </p>
            )}
            {suaDuoc && subject && (
              <p className="mt-2 text-[11px] italic text-grey-mid">
                Đang nhập: {tenCot(subject, kind, ordinal)} · hệ số {heSo}
              </p>
            )}
          </section>

          <ClassOverview
            rows={tableRows.map((r) => ({conduct: r.conduct, published: r.published}))}
          />
        </>
      )}

      {thieuPhieu > 0 && coPhieu.length > 0 && (
        <p className="text-[11px] italic text-grey-mid">
          Còn {thieuPhieu} em trong lớp chưa có phiếu của đợt này
          {canEdit ? ' — bấm “Mở đợt cho cả lớp” ở trên để bổ sung.' : '.'}
        </p>
      )}

      {/* Khai báo đợt mới: chỉ ban giám hiệu và quản trị viên. Đặt cuối trang vì đây là việc làm
          một lần mỗi học kỳ, không phải việc hằng ngày. */}
      {canTerm && (
        <TermCreateForm
          campusId={myClass.campus_id}
          schoolYear={myClass.school_year}
          classId={myClass.id}
          daCo={daCoLoai}
        />
      )}
    </div>
  );
}
