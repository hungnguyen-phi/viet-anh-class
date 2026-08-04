import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Lock, LockOpen, Plus} from 'lucide-react';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext, type ClassOption} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {Flash} from '@/components/ui/Flash';
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
  tenCot,
  type Conduct,
  type ScoreKind,
  type TermKind,
} from '@/components/grades/labels';
import {TermPicker} from './TermPicker';
import {ColumnPicker} from './ColumnPicker';
import {openTermForClass, publishTerm, seedClassSubjects, setTermLock} from './actions';

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
type SumRow = {
  review_id: string | null;
  subject_id: string | null;
  subject: string | null;
  short_name: string | null;
  sort_order: number | null;
  diem_trung_binh: number | null;
};
type ColRow = {review_id: string; score: number; weight: number};

/** Một môn trong danh mục (0069). `sort_order` là thứ tự nhà trường muốn thấy, không phải A→Z. */
type MonRow = {id: string; name: string; short_name: string; sort_order: number};

/** Một dòng phân công dạy bộ môn của CHÍNH tôi, kèm luôn môn để khỏi hỏi lại danh mục. */
type PhanCongRow = {class_id: string; subject_id: string; subjects: MonRow | null};

/** Lớp lấy kèm khối — đủ để dựng một mục trong bộ chọn lớp. */
type LopKemKhoi = {
  id: string;
  name: string;
  school_year: string;
  campus_id: string;
  homeroom_teacher_id: string | null;
  grade: string | null;
  grades: {name: string; sort_order: number} | null;
};

/**
 * Chỉ những cột lớp mà trang này thật sự dùng. Nhờ vậy lớp lấy từ getMyClass (một dòng `classes`
 * đầy đủ) và lớp lấy từ phân công dạy bộ môn cùng gán được vào một biến, không phải viết hai nhánh
 * hiển thị song song.
 */
type LopDangXem = {
  id: string;
  name: string;
  school_year: string;
  campus_id: string;
  homeroom_teacher_id: string | null;
};

/** Một em trong đợt: có thể đã có phiếu (nhập điểm được) hoặc chưa. */
type EmRow = {
  studentId: string;
  name: string;
  conHoc: boolean;
  /** id phiếu đánh giá — null nghĩa là GVCN chưa mở đợt cho em này. */
  reviewId: string | null;
  /** Nhận xét/hạnh kiểm. LUÔN null với giáo viên bộ môn: RLS không cho họ đọc phiếu (0069 §D3). */
  phieu: PhieuRow | null;
};

// Địa chỉ mang theo ID môn (?subject=<uuid>), không mang tên môn nữa.
const LA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Thứ tự hiện môn: theo sort_order của danh mục (Văn → Toán → Anh… như sổ điểm), trùng tên thì
// mới xếp theo chữ cái. Trước 0069 chỗ này sắp A→Z vì chỉ có tên môn để mà sắp.
const xepMon = (a: MonRow, b: MonRow) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi');

const tenCuaEm = (p: {full_name: string | null; email: string} | null, fallback: string) =>
  p?.full_name ?? p?.email ?? fallback;

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
    } = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();

  // Gia đình (phụ huynh + chính học sinh) xem một màn hình hoàn toàn khác: chỉ đọc, chỉ các đợt
  // ĐÃ CÔNG BỐ, và của đúng một em. Tách hẳn từ đây cho khỏi lẫn với màn hình nhập liệu.
  if (profile.role === 'parent' || profile.role === 'student') {
    return <FamilyReport profile={profile} childParam={childParam} termParam={termParam} />;
  }

  const t = await getTranslations('grades');
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [{myClass: myClassGoc, classes: accessibleGoc}, phanCong] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    // PHÂN CÔNG DẠY BỘ MÔN CỦA CHÍNH TÔI. Đây là bảng CẤP QUYỀN của 0069: có một dòng ở đây thì
    // mới đọc/ghi được điểm môn đó ở lớp đó. RLS chỉ trả dòng của chính mình (hoặc của lớp mình
    // chủ nhiệm) nên không cần — và không nên — lọc thêm gì ngoài teacher_id.
    // Hỏi cả khi mình đang chủ nhiệm một lớp: cô chủ nhiệm 7A mà dạy Toán 8B là chuyện thường.
    profile.role === 'teacher'
      ? supabase
          .from('teaching_assignments')
          .select('class_id, subject_id, subjects(id, name, short_name, sort_order)')
          .eq('teacher_id', profile.id)
          .eq('is_active', true)
          .then((r) => (r.data ?? []) as unknown as PhanCongRow[])
      : Promise.resolve([] as PhanCongRow[]),
  ]);

  // Lớp mình DẠY BỘ MÔN không nằm trong getClassContext (hàm đó chỉ biết lớp CHỦ NHIỆM), nên
  // thiếu bước này thì giáo viên bộ môn mở /grades là thấy "chưa có lớp" — dù RLS đã cho họ vào.
  // Một chặng mạng thêm, và chỉ với người thật sự có phân công.
  let lopDay: LopKemKhoi[] = [];
  if (phanCong.length > 0) {
    const {data} = await supabase
      .from('classes')
      .select(
        'id, name, school_year, campus_id, homeroom_teacher_id, grade, grades(name, sort_order)',
      )
      .in('id', [...new Set(phanCong.map((p) => p.class_id))])
      .eq('is_active', true)
      .order('name');
    lopDay = (data ?? []) as unknown as LopKemKhoi[];
  }

  const daCoTrongDS = new Set(accessibleGoc.map((c) => c.id));
  const accessible: ClassOption[] = [
    ...accessibleGoc,
    ...lopDay
      .filter((c) => !daCoTrongDS.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        school_year: c.school_year,
        grade_name: c.grades?.name ?? c.grade ?? '—',
        grade_sort: c.grades?.sort_order ?? 9999,
      })),
  ].sort((a, b) => a.grade_sort - b.grade_sort || a.name.localeCompare(b.name, 'vi'));

  const myClass: LopDangXem | null =
    myClassGoc ?? lopDay.find((c) => c.id === classParam) ?? lopDay[0] ?? null;

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // BA quyền khác nhau, đừng gộp:
  //  • canEdit  = nhập điểm MỌI môn + nhận xét + hạnh kiểm + công bố → GVCN CỦA CHÍNH LỚP NÀY và
  //    quản trị viên (RLS rls_insert/update_student_term_reviews). Hiệu trưởng KHÔNG có.
  //    Phải hỏi "có chủ nhiệm LỚP NÀY không" chứ không phải "có phải giáo viên không": từ 0069
  //    một giáo viên vào được cả lớp mình chỉ dạy bộ môn.
  //  • laGVBM   = giáo viên đang xem một lớp mình KHÔNG chủ nhiệm → chỉ thấy và chỉ nhập được môn
  //    mình được phân công, không đọc được nhận xét/hạnh kiểm, không công bố (0069 §D).
  //  • canTerm  = khai báo/chốt sổ đợt đánh giá → hiệu trưởng cùng cơ sở và quản trị viên.
  const laGVCN = myClass.homeroom_teacher_id === profile.id;
  const laGVBM = profile.role === 'teacher' && !laGVCN;
  const canEdit = profile.role === 'admin' || (profile.role === 'teacher' && laGVCN);
  const canTerm = profile.role === 'principal' || profile.role === 'admin';

  // Môn TÔI được phân công dạy Ở CHÍNH LỚP NÀY. Đây là toàn bộ phạm vi của giáo viên bộ môn.
  const monToiDay = phanCong
    .filter((p) => p.class_id === myClass.id)
    .map((p) => p.subjects)
    .filter((m): m is MonRow => m !== null)
    .sort(xepMon);

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
        <Flash />
        {/* Ai mở trang này cũng đang muốn ĐỌC ĐIỂM. Nói thẳng vì sao chưa có gì để đọc, và ai là
            người mở đường — thay vì đưa ngay một cái form hành chính mà không giải thích nó là gì.
            Ban giám hiệu vào đây để xem học sinh học ra sao, không phải để làm thủ tục. */}
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="font-display text-[16px] font-bold text-navy">
            {t('noTermTitle', {year: myClass.school_year})}
          </p>
          <p className="mx-auto mt-2 max-w-[520px] text-[12.5px] font-semibold leading-relaxed text-grey-mid">
            {canTerm ? t('noTermForLeader') : t('askLeadershipTerm')}
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

  // ── Danh sách em + danh mục môn của lớp ───────────────────────────────────
  // Hai màn hình khác nhau vì hai bộ quyền khác nhau, không phải vì thẩm mỹ:
  // giáo viên bộ môn KHÔNG select được student_term_reviews (0069 §D3 — RLS chặn theo DÒNG chứ
  // không theo CỘT, cho đọc phiếu là cho đọc luôn nhận xét cô chủ nhiệm viết cho gia đình).
  // Họ lấy danh sách em + id phiếu bằng RPC subject_roster(), hàm trả đúng ba cột.
  let hocSinh: EmRow[] = [];
  let mon: MonRow[] = [];
  let heSoMacDinh = 1;

  const truyVanEnrollments = supabase
    .from('enrollments')
    .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
    .eq('class_id', myClass.id)
    .eq('is_active', true);
  // Hệ số mặc định theo loại điểm — hỏi DB, không rải số 1/2/3 trong frontend.
  const truyVanHeSo = supabase
    .rpc('default_score_weight', {k: kind})
    .then((r) => Number(r.data ?? 1));

  if (laGVBM) {
    const [rosterRes, enrRes, dw] = await Promise.all([
      supabase.rpc('subject_roster', {p_term: term.id, p_class: myClass.id}),
      truyVanEnrollments,
      truyVanHeSo,
    ]);
    heSoMacDinh = dw;
    mon = monToiDay; // đúng phạm vi của họ, không hơn một môn nào
    const roster = rosterRes.data ?? [];
    const daCoPhieu = new Set(roster.map((r) => r.student_id));
    hocSinh = [
      ...roster.map((r) => ({
        studentId: r.student_id,
        name: r.full_name,
        conHoc: r.con_hoc,
        reviewId: r.review_id,
        phieu: null,
      })),
      // Em vào lớp sau khi GVCN đã mở đợt thì chưa có phiếu, mà không có phiếu thì không treo
      // điểm vào đâu được. Vẫn hiện tên để cô biết còn thiếu ai thay vì lặng lẽ bỏ qua.
      ...((enrRes.data ?? []) as unknown as EnrRow[])
        .filter((e) => !daCoPhieu.has(e.student_id))
        .map((e) => ({
          studentId: e.student_id,
          name: tenCuaEm(e.profiles, e.student_id),
          conHoc: true,
          reviewId: null,
          phieu: null,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  } else {
    const [enrRes, phieuRes, monList, dw] = await Promise.all([
      truyVanEnrollments,
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
      // CHƯƠNG TRÌNH CỦA LỚP là nguồn duy nhất cho ô chọn môn (0069 §B). Trước đây chỗ này bới
      // tên môn từ timetable_slots — nên lớp chưa xếp thời khoá biểu thì ô chọn rỗng, và mỗi
      // cách gõ hoa/thường lại đẻ ra một môn mới.
      supabase
        .from('class_subjects')
        .select('subjects(id, name, short_name, sort_order, is_active)')
        .eq('class_id', myClass.id)
        .eq('is_active', true)
        .then((r) => {
          const raw = (r.data ?? []) as unknown as {
            subjects: (MonRow & {is_active: boolean}) | null;
          }[];
          return raw
            .map((x) => x.subjects)
            .filter((m): m is MonRow & {is_active: boolean} => m !== null && m.is_active)
            .sort(xepMon);
        }),
      truyVanHeSo,
    ]);
    heSoMacDinh = dw;
    mon = monList;

    const phieu = (phieuRes.data ?? []) as unknown as PhieuRow[];
    const phieuTheoEm = new Map(phieu.map((p) => [p.student_id, p]));

    // Em CÒN ĐANG HỌC lớp này. Phải phân biệt với "em có phiếu", vì RLS
    // rls_update_student_term_reviews đặt `is_enrolled(student_id, class_id)` trong WITH CHECK:
    // phiếu của em ĐÃ RỜI LỚP giữa đợt vẫn ĐỌC được nhưng không GHI được nữa. Mà vi phạm WITH
    // CHECK thì Postgres huỷ NGUYÊN CÂU LỆNH, không phải bỏ qua một dòng — nghĩa là một em chuyển
    // trường đủ làm cả lớp không lưu được nhận xét và không công bố được, với thông báo cụt lủn
    // "bạn không có quyền". Nên mọi form GHI chỉ nhận em còn học; phiếu của em đã rời lớp vẫn
    // hiện trong bảng để điểm cũ không biến mất.
    const dangHoc = new Set(((enrRes.data ?? []) as unknown as EnrRow[]).map((e) => e.student_id));

    hocSinh = [
      ...phieu.map((p) => ({
        studentId: p.student_id,
        name: tenCuaEm(p.profiles, p.student_id),
        conHoc: dangHoc.has(p.student_id),
        reviewId: p.id,
        phieu: p as PhieuRow | null,
      })),
      // Em đang học lớp nhưng CHƯA có phiếu của đợt này (mới vào lớp sau khi cô đã mở đợt).
      ...((enrRes.data ?? []) as unknown as EnrRow[])
        .filter((e) => !phieuTheoEm.has(e.student_id))
        .map((e) => ({
          studentId: e.student_id,
          name: tenCuaEm(e.profiles, e.student_id),
          conHoc: true,
          reviewId: null,
          phieu: null as PhieuRow | null,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  const coPhieu = hocSinh.filter((h) => h.reviewId !== null);
  const thieuPhieu = hocSinh.length - coPhieu.length;
  const reviewIds = coPhieu.map((h) => h.reviewId!);
  // Tập ghi được = phiếu của em còn học. Cũng chính là tập mà nút Công bố tác động.
  const ghiDuoc = coPhieu.filter((h) => h.conHoc);
  const daRoiLop = coPhieu.length - ghiDuoc.length;

  // Môn đang nhập. Địa chỉ mang ID, không mang tên.
  const monParam = (subjectParam ?? '').trim();
  const subjectId = laGVBM
    ? // Giáo viên bộ môn: CHỈ môn mình được phân công. Sửa tay ?subject= sang môn của đồng nghiệp
      // thì RLS vẫn chặn lúc lưu — nhưng đừng để họ gõ xong 30 con điểm rồi mới biết.
      monToiDay.some((m) => m.id === monParam)
      ? monParam
      : (monToiDay[0]?.id ?? '')
    : // GVCN/quản trị: nhận mọi id môn hợp lệ, kể cả môn đã gỡ khỏi chương trình lớp mà vẫn còn
      // điểm cũ — chỉ nhận môn đang có trong class_subjects thì gỡ nhầm một môn là khoá luôn
      // đường sửa những con điểm đã nhập. RLS vẫn là chốt thật.
      LA_UUID.test(monParam)
      ? monParam
      : (mon[0]?.id ?? '');

  // Ai được gõ điểm vào lưới: GVCN (mọi môn của lớp) hoặc GV bộ môn (đúng môn mình). Cả hai đều
  // phải đợt CHƯA CHỐT SỔ — trùng khớp với can_write_subject_score/review_is_editable, để không
  // bao giờ vẽ một cái nút mà bấm vào là bị chặn. Quản trị viên sửa được cả sau khi chốt.
  const nhapDiem =
    (canEdit || (laGVBM && monToiDay.length > 0)) &&
    (!term.is_locked || profile.role === 'admin');
  // Nhận xét, hạnh kiểm, công bố: CHỈ GVCN và quản trị viên (0069 §D3).
  const suaPhieu = canEdit && (!term.is_locked || profile.role === 'admin');

  let sumRows: SumRow[] = [];
  let colRows: ColRow[] = [];
  if (reviewIds.length > 0) {
    // Bỏ hẳn truy vấn khi lớp chưa có phiếu nào: `.in('review_id', [])` vẫn tốn một chặng mạng.
    const [sums, cols] = await Promise.all([
      // Giáo viên bộ môn chỉ đọc được điểm MÔN MÌNH (0069 §D2), nên bảng tổng kết cả lớp với họ
      // luôn khuyết. Không hỏi, để khỏi vẽ một cái bảng thủng lỗ chỗ rồi họ tưởng app hỏng.
      laGVBM
        ? Promise.resolve([] as SumRow[])
        : supabase
            .from('subject_term_summary_v')
            .select('review_id, subject_id, subject, short_name, sort_order, diem_trung_binh')
            .in('review_id', reviewIds)
            .then((r) => (r.data ?? []) as SumRow[]),
      // Con điểm của ĐÚNG cột đang nhập — chỉ hỏi khi có người nhập được. Hiệu trưởng chỉ xem
      // bảng tổng kết, kéo về cả cột điểm cho họ là một chặng mạng không ai dùng tới.
      nhapDiem && subjectId
        ? supabase
            .from('subject_scores')
            .select('review_id, score, weight')
            .eq('subject_id', subjectId)
            .eq('kind', kind)
            .eq('ordinal', ordinal)
            .in('review_id', reviewIds)
            .then((r) => (r.data ?? []) as ColRow[])
        : Promise.resolve([] as ColRow[]),
    ]);
    sumRows = sums;
    colRows = cols;
  }

  // Trung bình từng môn của từng em — lấy NGUYÊN từ view, không nhân chia lại ở đây.
  // Khoá của Map và của Record đều là ID MÔN: gom theo tên chính là chỗ "Ngữ văn" với "Ngữ Văn"
  // tách thành hai cột trước 0069.
  const tbTheoPhieu = new Map<string, Record<string, number | null>>();
  const monCoDiem = new Map<string, MonRow>();
  for (const s of sumRows) {
    if (!s.review_id || !s.subject_id) continue;
    if (!monCoDiem.has(s.subject_id)) {
      monCoDiem.set(s.subject_id, {
        id: s.subject_id,
        name: s.subject ?? '—',
        short_name: s.short_name ?? s.subject ?? '—',
        sort_order: s.sort_order ?? 9999,
      });
    }
    const rec = tbTheoPhieu.get(s.review_id) ?? {};
    rec[s.subject_id] = s.diem_trung_binh === null ? null : Number(s.diem_trung_binh);
    tbTheoPhieu.set(s.review_id, rec);
  }

  // Môn để chọn/hiện = chương trình của lớp CỘNG môn đã có điểm (môn bị gỡ khỏi chương trình
  // nhưng còn điểm cũ vẫn phải nhìn thấy và sửa được).
  const monHienCo: MonRow[] = [
    ...mon,
    ...[...monCoDiem.values()].filter((m) => !mon.some((x) => x.id === m.id)),
  ].sort(xepMon);
  const subjectName = monHienCo.find((m) => m.id === subjectId)?.name ?? '';

  const diemTheoPhieu = new Map(colRows.map((c) => [c.review_id, c]));
  // Hệ số của cột: nếu cột đã có điểm thì giữ đúng hệ số đang lưu (lưu lại mà đổi lặng lẽ hệ số
  // là mọi con điểm cũ đổi ý nghĩa); cột mới thì lấy mặc định theo loại điểm từ DB.
  const heSo = colRows[0]?.weight ?? heSoMacDinh;

  // Số hiển thị ở thanh đợt tính trên MỌI phiếu (kể cả em đã rời lớp) — đó là sự thật của lớp.
  const daCongBo = coPhieu.filter((h) => h.phieu?.published_at != null).length;
  // Còn hai con số trên NÚT thì tính trên tập ghi được, để nút hứa đúng bằng việc nó làm được.
  const coTheCongBo = ghiDuoc.filter((h) => h.phieu?.published_at == null).length;
  const coTheGoCongBo = ghiDuoc.length - coTheCongBo;

  // Điểm thì em đã rời lớp VẪN sửa được: policy của subject_scores chỉ hỏi review_is_editable()
  // (chủ nhiệm lớp + đợt chưa chốt sổ) hoặc can_write_subject_score() (phân công bộ môn + đợt
  // chưa chốt sổ), không hỏi em còn học hay không. Giữ các em ấy trong lưới nhập điểm để cô sửa
  // nốt con điểm gõ nhầm, nhưng ghi rõ để không ai tưởng em còn trong lớp.
  const scoreCells: ScoreCell[] = coPhieu.map((h) => ({
    reviewId: h.reviewId!,
    name: h.conHoc ? h.name : t('leftClassSuffix', {name: h.name}),
    current:
      diemTheoPhieu.get(h.reviewId!) === undefined
        ? ''
        : String(diemTheoPhieu.get(h.reviewId!)!.score),
  }));

  const reviewRows: ReviewRow[] = ghiDuoc
    .filter((h) => h.phieu !== null)
    .map((h) => ({
      studentId: h.studentId,
      name: h.name,
      comment: h.phieu!.comment ?? '',
      conduct: h.phieu!.conduct ?? '',
      conductScore: h.phieu!.conduct_score === null ? '' : String(h.phieu!.conduct_score),
      published: h.phieu!.published_at !== null,
    }));

  const tableRows: ScoreTableRow[] = coPhieu
    .filter((h) => h.phieu !== null)
    .map((h) => ({
      studentId: h.studentId,
      name: h.name,
      published: h.phieu!.published_at !== null,
      daRoiLop: !h.conHoc,
      conduct: h.phieu!.conduct,
      tb: tbTheoPhieu.get(h.reviewId!) ?? {},
    }));

  return (
    <div className="flex flex-col gap-4">
      {tieuDe}

      <Flash />

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
              {term.is_locked ? t('statusLocked') : t('statusOpen')}
            </span>
            {/* Giáo viên bộ môn không đọc được phiếu nên không biết đã công bố bao nhiêu — không
                bịa một con số 0 ra cho họ đọc. */}
            {!laGVBM && (
              <span className="text-[12px] font-semibold text-grey-mid">
                Đã công bố <b className="text-navy">{daCongBo}</b>/{coPhieu.length} phiếu
              </span>
            )}
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
                      ? t('confirmReopen', {name: term.name})
                      : t('confirmLock', {name: term.name})
                  }
                  className={btnGhost}
                >
                  {/* ConfirmButton bọc nội dung trong một <span> trơn, nên gap của nút không áp
                      được cho cặp icon+chữ — phải tự cho chúng một hàng flex. */}
                  <span className="inline-flex items-center gap-1.5">
                    {term.is_locked ? (
                      <>
                        <LockOpen size={14} strokeWidth={2.5} />
                        {t('reopenTerm')}
                      </>
                    ) : (
                      <>
                        <Lock size={14} strokeWidth={2.5} />
                        {t('lockTerm')}
                      </>
                    )}
                  </span>
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-[11px] italic text-grey-mid">
          {t('termMeta', {kind: t(`termKinds.${term.kind as TermKind}`), year: term.school_year})}
          {(term.start_date || term.end_date) &&
            t('termRange', {from: ngayVN(term.start_date) || '…', to: ngayVN(term.end_date) || '…'})}
        </p>
      </div>

      {/* ── Phạm vi của giáo viên bộ môn ───────────────────────────────────────
          Nói thẳng họ đang đứng ở đâu và vì sao màn hình gọn hơn của cô chủ nhiệm. Thiếu đoạn này
          thì "sao tôi không thấy điểm môn khác" sẽ thành phiếu báo lỗi, trong khi đó là thiết kế. */}
      {laGVBM && (
        <div className="glass rounded-[20px] p-4">
          <div className="font-display text-[15px] font-bold text-navy">
            {monToiDay.length > 0
              ? t('subjectTeacherHere', {subject: subjectName || monToiDay[0].name, class: myClass.name})
              : t('subjectTeacherNone', {class: myClass.name})}
          </div>
          <p className="mt-1 text-[12px] font-semibold leading-[1.55] text-grey-mid">
            {monToiDay.length > 0 ? (
              <>
                Bạn được phân công {monToiDay.length} môn ở lớp này:{' '}
                <b className="text-navy">{monToiDay.map((m) => m.name).join(', ')}</b>. Màn hình
                này chỉ hiện đúng phần của bạn — điểm các môn khác, nhận xét và hạnh kiểm thuộc
                giáo viên chủ nhiệm, không phải app thiếu dữ liệu. Cần thêm môn thì nhờ ban giám
                hiệu phân công.
              </>
            ) : (
              <>
                {t('askAssignment')}
                Chỉ ban giám hiệu và quản trị viên phân công được — giáo viên chủ nhiệm cũng không
                tự mở quyền cho ai vào học bạ lớp mình.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Lớp chưa khai môn nào ───────────────────────────────────────────
          Không có môn thì ô chọn môn rỗng và cả màn hình nhập điểm đứng im. RPC
          seed_class_subjects() gắn cả bộ môn đang dùng của cơ sở vào lớp trong một cú bấm (gọi
          lại bao nhiêu lần cũng an toàn). Đặt ở đây — ngoài khối nhập điểm — để còn bấm được cả
          khi lớp chưa có phiếu nào, tức là đúng lúc lớp mới lập. */}
      {monHienCo.length === 0 && (canEdit || canTerm) && (
        <div className="glass rounded-[20px] p-4">
          <div className="font-display text-[15px] font-bold text-navy">
            Lớp {myClass.name} chưa khai môn học nào
          </div>
          <p className="mt-1 text-[12px] font-semibold leading-[1.55] text-grey-mid">
            {t('seedHint')}
            để gắn cả bộ môn đang dùng của cơ sở cho lớp — thừa môn nào thì nhờ quản trị viên gỡ
            bớt, còn hơn là không nhập được điểm.
          </p>
          <form action={seedClassSubjects} className="mt-2.5">
            <input type="hidden" name="class_id" value={myClass.id} />
            <input type="hidden" name="term_id" value={term.id} />
            {/* wrapClass mặc định của SubmitButton đã là inline-flex có gap, nên icon + chữ đặt
                thẳng vào là đủ — không cần bọc thêm span như chỗ dùng ConfirmButton. */}
            <SubmitButton className={btnGhost}>
              <Plus size={14} strokeWidth={2.5} />
              {t('seedButton')}
            </SubmitButton>
          </form>
        </div>
      )}

      {term.is_locked && (canEdit || laGVBM) && profile.role !== 'admin' && (
        <p className="text-[12px] font-bold text-status-bad">
          {t('lockedNotice')}
          mở lại đợt.
        </p>
      )}

      {coPhieu.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {canEdit
              ? t('noSheetsManage')
              : t('noSheets')}
          </p>
        </div>
      ) : (
        <>
          {/* ── Nhập điểm theo từng cột ────────────────────────────────────── */}
          {nhapDiem && (
            <div className="flex flex-col gap-3">
              <div className="glass rounded-[20px] p-4">
                <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
                  {t('pickColumn')}
                </div>
                <ColumnPicker
                  subjects={monHienCo}
                  subjectId={subjectId}
                  kind={kind}
                  ordinal={ordinal}
                />
              </div>

              {/* Đòi CẢ id lẫn tên: id không tra ra tên nghĩa là ?subject= trỏ vào một môn không
                  có thật (địa chỉ bị sửa tay). Vẽ form lúc đó là mời người ta gõ 30 con điểm rồi
                  mới báo lỗi ở bước lưu. */}
              {subjectId && subjectName ? (
                // key ép remount khi đổi cột → defaultValue nạp lại đúng con điểm của cột mới,
                // nếu không React giữ nguyên giá trị đang gõ trong các ô cũ (bẫy đã gặp ở TKB).
                <ScoreColumnForm
                  key={`${subjectId}|${kind}|${ordinal}`}
                  classId={myClass.id}
                  termId={term.id}
                  subjectId={subjectId}
                  subjectName={subjectName}
                  kind={kind}
                  ordinal={ordinal}
                  weight={heSo}
                  rows={scoreCells}
                />
              ) : (
                <p className="text-[12px] font-semibold text-grey-mid">
                  {monHienCo.length === 0
                    ? t('noSubjectsSeed')
                    : t('pickSubjectFirst')}
                </p>
              )}
            </div>
          )}

          {/* ── Nhận xét + hạnh kiểm (GVCN / quản trị) ─────────────────────── */}
          {suaPhieu && (
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
          {suaPhieu && (
            <div className="glass rounded-[20px] p-4">
              <div className="font-display text-[15px] font-bold text-navy">
                {t('publishTitle')}
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-[1.55] text-grey-mid">
                {t('publishHint')}
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
                    <input type="hidden" name="ids" value={ghiDuoc.map((h) => h.reviewId).join(',')} />
                    <ConfirmButton
                      message={t('confirmPublish', {n: coTheCongBo, name: term.name})}
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
                    <input type="hidden" name="ids" value={ghiDuoc.map((h) => h.reviewId).join(',')} />
                    <ConfirmButton
                      message={t('confirmUnpublish', {n: coTheGoCongBo})}
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
                    {t('nothingToPublish')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Bảng điểm cả lớp ────────────────────────────────────────────
              KHÔNG vẽ cho giáo viên bộ môn: RLS chỉ trả điểm môn họ dạy, nên bảng sẽ rỗng ở mọi
              cột khác và cột hạnh kiểm/trạng thái thì họ không đọc được. Một bảng như vậy trông
              y hệt app hỏng. */}
          {!laGVBM && (
            <>
              <section>
                <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
                  Bảng điểm cả lớp · {term.name}
                </h2>
                <ClassScoreTable
                  subjects={monHienCo.filter((m) => monCoDiem.has(m.id))}
                  rows={tableRows}
                />
                {monCoDiem.size === 0 && (
                  <p className="mt-2 text-[11px] italic text-grey-mid">
                    {t('noScoresYet')}
                    đầu tiên.
                  </p>
                )}
                {nhapDiem && subjectName && (
                  <p className="mt-2 text-[11px] italic text-grey-mid">
                    {t('enteringNow', {column: tenCot(subjectName, kind, ordinal, t), weight: heSo})}
                  </p>
                )}
              </section>

              <ClassOverview
                rows={tableRows.map((r) => ({conduct: r.conduct, published: r.published}))}
              />
            </>
          )}
        </>
      )}

      {thieuPhieu > 0 && coPhieu.length > 0 && (
        <p className="text-[11px] italic text-grey-mid">
          Còn {thieuPhieu} em trong lớp chưa có phiếu của đợt này
          {canEdit
            ? t('missingSheetsManage')
            : t('missingSheets')}
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
