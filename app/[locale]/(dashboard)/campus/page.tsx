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
import {TeacherManager} from './TeacherManager';
import {CampusLevelPicker} from './CampusLevelPicker';
import {FlashToast} from '@/components/ui/FlashToast';

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
  const {data: rollupData} = await supabase.rpc('campus_rollup');
  const rows = (rollupData ?? []) as RollupRow[];

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
