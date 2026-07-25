import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {schoolYearLabel} from '@/lib/dates';
import {Link} from '@/i18n/navigation';
import {GradeManager} from '@/app/[locale]/(dashboard)/admin/GradeManager';
import {ClassForm} from '@/app/[locale]/(dashboard)/admin/ClassForm';
import {ClassManager} from '@/app/[locale]/(dashboard)/admin/ClassManager';

export default async function CampusPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const profile = await requireRole(['principal', 'admin']);
  const t = await getTranslations('campusReport');
  const supabase = await createClient();

  // BGH quản lý Khối/Lớp trong CƠ SỞ MÌNH (admin dùng /admin). RLS giới hạn đúng campus.
  let mgmt: null | {
    campusId: string;
    campusName: string;
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
    defaultYear: string;
  } = null;
  if (profile.role === 'principal' && profile.campus_id) {
    const campusId = profile.campus_id;
    const [{data: gr}, {data: cls}, {data: tch}, {data: cp}] = await Promise.all([
      supabase.from('grades').select('id, name, sort_order, is_active, campus_id').eq('campus_id', campusId).order('sort_order'),
      supabase
        .from('classes')
        .select('id, name, grade_id, grade, school_year, campus_id, homeroom_teacher_id, is_active')
        .eq('campus_id', campusId)
        .eq('is_active', true)
        .order('name'),
      supabase.from('profiles').select('id, full_name, email').in('role', ['teacher', 'principal', 'admin']).order('email').limit(500),
      supabase.from('campuses').select('name').eq('id', campusId).maybeSingle(),
    ]);
    const grades = gr ?? [];
    mgmt = {
      campusId,
      campusName: cp?.name ?? '',
      gradesActive: grades.filter((g) => g.is_active).map((g) => ({id: g.id, name: g.name, sort_order: g.sort_order})),
      gradeOptions: grades.filter((g) => g.is_active).map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id})),
      gradeAll: grades.map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id, is_active: g.is_active})),
      classes: (cls ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        grade_id: c.grade_id,
        grade: c.grade,
        school_year: c.school_year,
        campus_id: c.campus_id,
        homeroom_teacher_id: c.homeroom_teacher_id,
      })),
      teachers: tch ?? [],
      defaultYear: schoolYearLabel(new Date()),
    };
  }

  // 1 RPC gộp: điểm thi đua (tính 1 lần) + điểm danh hôm nay cho MỌI lớp trong phạm vi
  // (BGH: campus mình; admin: tất cả). Thay cho N+1 class_ranks() trước đây.
  const {data: ranksData} = await supabase.rpc('campus_ranks');
  const rows = (ranksData ?? []).map((r) => ({
    id: r.class_id,
    name: r.name,
    school_year: r.school_year,
    score: Number(r.score),
    att: Number(r.att_today),
  }));

  await supabase.rpc('log_audit', {p_action: 'view_campus_report'});

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="font-display text-[22px] font-bold text-navy">
        {t('title')}
      </h1>

      {rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        <div className="glass overflow-x-auto rounded-[20px]">
          {/* Header */}
          <div className="flex min-w-[560px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5">
            <span
              className="text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1.3}}
            >
              {t('class')}
            </span>
            <span
              className="text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('year')}
            </span>
            <span
              className="text-right text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('score')}
            </span>
            <span
              className="text-right text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('attToday')}
            </span>
          </div>

          {/* Rows */}
          {rows.map((r) => (
            <Link
              key={r.id}
              href={{pathname: '/', query: {class: r.id}}}
              className="flex min-w-[560px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03]"
            >
              <span
                className="text-[13.5px] font-bold text-navy"
                style={{flex: 1.3}}
              >
                {r.name}
              </span>
              <span
                className="text-[12.5px] font-semibold text-grey-mid"
                style={{flex: 1}}
              >
                {r.school_year}
              </span>
              <span
                className="text-right font-display text-[15px] text-navy"
                style={{flex: 1}}
              >
                {Number(r.score)}
              </span>
              <span
                className="text-right text-[12.5px] font-semibold text-grey-mid"
                style={{flex: 1}}
              >
                {r.att} {t('marked')}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* BGH: quản lý Khối & Lớp trong cơ sở mình (tái dùng UI quản trị, RLS giới hạn campus) */}
      {mgmt && (
        <>
          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">
              {t('manageGrades')} · {mgmt.campusName}
            </div>
            <GradeManager campusId={mgmt.campusId} grades={mgmt.gradesActive} />
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
