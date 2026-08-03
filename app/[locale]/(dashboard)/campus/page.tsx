import {after} from 'next/server';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {schoolYearLabel} from '@/lib/dates';
import type {SchoolLevel} from '@/lib/levels';
import {GradeManager} from '@/app/[locale]/(dashboard)/admin/GradeManager';
import {ClassForm} from '@/app/[locale]/(dashboard)/admin/ClassForm';
import {ClassManager} from '@/app/[locale]/(dashboard)/admin/ClassManager';
import {SchoolRollup, type RollupRow} from './SchoolRollup';
import {WigRollup, type WigRollupRow} from './WigRollup';
import {TeacherManager} from './TeacherManager';
import {CampusLevelPicker} from './CampusLevelPicker';
import {FlashToast} from '@/components/ui/FlashToast';
import {MessageHealthCard} from '@/components/inbox/MessageHealthCard';
import {Link} from '@/i18n/navigation';
import {BookMarked} from 'lucide-react';

export default async function CampusPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{flash?: string}>;
}) {
  const {locale} = await params;
  const {flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['principal', 'admin']);
  const t = await getTranslations('campusReport');
  const supabase = await createClient();

  // Bảng tổng hợp toàn trường: MỘT lượt RPC trả về mọi lớp trong phạm vi kèm khối, điểm, điểm
  // danh và sĩ số. RLS/định nghĩa hàm tự giới hạn: admin thấy tất cả, BGH chỉ cơ sở mình.
  // KHÔNG await ở đây — phóng đi rồi chờ chung với khối truy vấn quản lý bên dưới.
  //
  // Trước đây await ngay dòng này, mà campus_rollup là truy vấn nặng nhất trang (đo được
  // 228–835 ms) và KHÔNG câu nào trong đợt dưới cần kết quả của nó. Tức là cả trang đứng chờ nó
  // xong rồi mới bắt đầu hỏi những thứ còn lại — hai đợt xếp hàng cho một việc có thể làm một đợt.
  //
  // Builder của supabase-js là "thenable" LƯỜI: phải gọi .then() mới thật sự bắn request đi.
  const rollupPromise = supabase.rpc('campus_rollup').then(
    (r) => (r.data ?? []) as RollupRow[],
    () => [] as RollupRow[],
  );

  // Nhịp WIG tuần này theo lớp (0073) — phóng đi cùng lúc với campus_rollup, cùng lý do: nó không
  // cần kết quả của câu nào, và cũng không câu nào dưới đây cần nó.
  const wigRollupPromise = supabase.rpc('school_wig_rollup').then(
    (r) => (r.data ?? []) as WigRollupRow[],
    () => [] as WigRollupRow[],
  );

  // BGH quản lý Cơ sở mình (admin dùng /admin). Các truy vấn dưới đây độc lập → chạy song song.
  let mgmt: null | {
    campusId: string;
    campusName: string;
    level: SchoolLevel | null;
    gradesActive: {id: string; name: string; sort_order: number}[];
    gradeOptions: {id: string; name: string; campus_id: string}[];
    gradeAll: {id: string; name: string; campus_id: string; is_active: boolean}[];
    classes: {
      id: string;
      name: string;
      grade_id: string | null;
      grade: string | null;
      school_year: string;
      campus_id: string;
      homeroom_teacher_id: string | null;
    }[];
    teachers: {id: string; full_name: string | null; email: string}[];
    staff: {id: string; full_name: string | null; email: string; role: string; homerooms: string[]}[];
    invites: {email: string; created_at: string}[];
    defaultYear: string;
  } = null;

  if (profile.role === 'principal' && profile.campus_id) {
    const campusId = profile.campus_id;
    const [{data: gr}, {data: cls}, {data: staffRows}, {data: cp}, {data: inv}] = await Promise.all([
      supabase
        .from('grades')
        .select('id, name, sort_order, is_active, campus_id')
        .eq('campus_id', campusId)
        .order('sort_order'),
      supabase
        .from('classes')
        .select('id, name, grade_id, grade, school_year, campus_id, homeroom_teacher_id, is_active')
        .eq('campus_id', campusId)
        .eq('is_active', true)
        .order('name'),
      // Nhân sự trong cơ sở: giáo viên đang hoạt động + người đang bị vô hiệu ('pending').
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('campus_id', campusId)
        .in('role', ['teacher', 'pending'])
        .order('email')
        .limit(500),
      supabase.from('campuses').select('name, level').eq('id', campusId).maybeSingle(),
      supabase
        .from('pending_user_grants')
        .select('email, created_at')
        .eq('campus_id', campusId)
        .eq('role', 'teacher')
        .order('created_at', {ascending: false}),
    ]);

    const grades = gr ?? [];
    const classes = cls ?? [];
    const staffList = staffRows ?? [];

    mgmt = {
      campusId,
      campusName: cp?.name ?? '',
      level: (cp?.level ?? null) as SchoolLevel | null,
      gradesActive: grades
        .filter((g) => g.is_active)
        .map((g) => ({id: g.id, name: g.name, sort_order: g.sort_order})),
      gradeOptions: grades
        .filter((g) => g.is_active)
        .map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id})),
      gradeAll: grades.map((g) => ({
        id: g.id,
        name: g.name,
        campus_id: g.campus_id,
        is_active: g.is_active,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade_id: c.grade_id,
        grade: c.grade,
        school_year: c.school_year,
        campus_id: c.campus_id,
        homeroom_teacher_id: c.homeroom_teacher_id,
      })),
      // Gồm CẢ người còn ở vai 'chờ cấp quyền' (vừa đăng nhập lần đầu, chưa được nâng vai).
      // Trước đây lọc cứng role='teacher' nên hiệu trưởng vừa mời giáo viên xong, người đó đăng
      // nhập rồi mà vẫn không chọn được làm GVCN — đúng lỗi "không gõ được tên chủ nhiệm mới".
      // Chọn xong thì createClass/updateClass tự nâng vai họ lên 'teacher'.
      teachers: staffList
        .filter((s) => s.role === 'teacher' || s.role === 'pending')
        .map((s) => ({
          id: s.id,
          full_name:
            s.role === 'pending'
              ? `${s.full_name ?? s.email} — chưa cấp quyền, chọn là cấp luôn`
              : s.full_name,
          email: s.email,
        })),
      // Ghép sẵn tên lớp chủ nhiệm — dữ liệu đã có trong `classes`, không cần truy vấn thêm.
      staff: staffList.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        role: s.role,
        homerooms: classes.filter((c) => c.homeroom_teacher_id === s.id).map((c) => c.name),
      })),
      invites: inv ?? [],
      defaultYear: schoolYearLabel(new Date()),
    };
  }

  // Giờ mới chờ hai bảng tổng hợp — cả hai đã chạy SONG SONG với khối quản lý ở trên.
  const [rows, wigRows] = await Promise.all([rollupPromise, wigRollupPromise]);

  // Nhật ký kiểm toán không nằm trên đường tới hạn — xem ghi chú ở lần sửa hiệu năng.
  after(() => {
    void supabase.rpc('log_audit', {p_action: 'view_campus_report'});
  });

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="font-display text-[22px] font-bold text-navy">{t('title')}</h1>

      {flash && <FlashToast message={flash} />}

      {rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        <SchoolRollup rows={rows} />
      )}

      {/* Nhịp 4DX tuần này — thắng/thua theo lớp và theo GVCN. Đặt ngay dưới bảng thi đua vì đây
          là cùng một câu hỏi ở hai thang thời gian: bảng trên là cả năm, bảng này là tuần. */}
      <WigRollup rows={wigRows} canOpenWig={profile.role === 'admin'} />

      {/* Kênh liên lạc phụ huynh ↔ GVCN: ban giám hiệu chỉ nhận SỐ, không nhận CHỮ.
          Đặt ở đây vì đây là màn hình cấp trường của họ, và "lớp nào để phụ huynh chờ lâu" là
          việc đôn đốc cùng loại với các con số phía trên. Nội dung tin nhắn thì RLS của 0065
          không cho họ đọc, cố ý. */}
      {/* Môn riêng của cơ sở + phân công giáo viên bộ môn cho từng lớp.
          Hiệu trưởng sửa được môn RIÊNG của cơ sở mình và phân công giáo viên; môn dùng chung
          toàn trường thì chỉ quản trị viên đổi (RLS 0069, cố ý — đổi tên "Ngữ văn" ở một cơ sở là
          đổi cho cả bốn, và mọi con điểm Ngữ văn toàn trường đổi nhãn theo). */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">
          Môn học &amp; phân công giáo viên bộ môn
        </div>
        <p className="mb-3 text-xs text-grey-mid">
          Xem danh mục môn của trường, thêm môn riêng của cơ sở, và chọn ai dạy môn gì ở từng lớp.
        </p>
        <Link
          href="/subjects"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <BookMarked size={14} strokeWidth={2.2} />
          Mở danh mục môn
        </Link>
      </section>

      <MessageHealthCard />

      {mgmt && (
        <>
          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">
              {t('manageTeachers')} · {mgmt.campusName}
            </div>
            <TeacherManager teachers={mgmt.staff} invites={mgmt.invites} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">
              {t('manageGrades')} · {mgmt.campusName}
            </div>
            {/* Chọn cấp học trước — khối sinh ra từ đây, không ai phải gõ tên khối nữa. */}
            <CampusLevelPicker level={mgmt.level} />
            <GradeManager campusId={mgmt.campusId} grades={mgmt.gradesActive} level={mgmt.level} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">{t('createClass')}</div>
            <ClassForm
              campuses={[{id: mgmt.campusId, name: mgmt.campusName}]}
              grades={mgmt.gradeOptions}
              teachers={mgmt.teachers}
              defaultYear={mgmt.defaultYear}
            />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <ClassManager
              classes={mgmt.classes}
              campuses={[{id: mgmt.campusId, name: mgmt.campusName}]}
              grades={mgmt.gradeAll}
              teachers={mgmt.teachers}
            />
          </section>
        </>
      )}
    </div>
  );
}
