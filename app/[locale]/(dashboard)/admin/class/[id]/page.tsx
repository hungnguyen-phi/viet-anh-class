import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {
  Users,
  Target,
  ClipboardCheck,
  Trophy,
  MessagesSquare,
  GraduationCap,
  Building2,
  Layers,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {ClassEditForm} from '../../ClassEditForm';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  await requireRole(['admin']);
  const t = await getTranslations('admin');
  const tn = await getTranslations('nav');
  const supabase = await createClient();

  const {data: cls} = await supabase
    .from('classes')
    .select('id, name, grade, grade_id, school_year, campus_id, homeroom_teacher_id, is_active')
    .eq('id', id)
    .maybeSingle();
  if (!cls) notFound();

  // Dữ liệu phụ trợ (song song): cơ sở/GVCN + số học sinh/WIG + options cho form sửa.
  const [
    {data: campus},
    {data: teacher},
    {count: studentCount},
    {count: wigCount},
    {data: campuses},
    {data: grades},
    {data: teachers},
  ] = await Promise.all([
    supabase.from('campuses').select('name').eq('id', cls.campus_id).maybeSingle(),
    cls.homeroom_teacher_id
      ? supabase.from('profiles').select('full_name, email').eq('id', cls.homeroom_teacher_id).maybeSingle()
      : Promise.resolve({data: null}),
    supabase.from('enrollments').select('id', {count: 'exact', head: true}).eq('class_id', id).eq('is_active', true),
    supabase.from('wigs').select('id', {count: 'exact', head: true}).eq('class_id', id),
    supabase.from('campuses').select('id, name').eq('is_active', true).order('name'),
    supabase.from('grades').select('id, name, campus_id, is_active').order('sort_order'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['teacher', 'principal', 'admin'])
      .order('email')
      .limit(500),
  ]);

  const gvcn = teacher ? teacher.full_name ?? teacher.email : null;

  // Thẻ liên kết sang các màn hình của lớp (mang theo ?class=id).
  const links: {href: string; label: string; desc: string; Icon: LucideIcon; hex: string; soft: string}[] = [
    {href: '/roster', label: tn('roster'), desc: t('linkRoster'), Icon: Users, hex: '#3a62c9', soft: 'rgba(58,98,201,0.12)'},
    {href: '/wig', label: tn('wig'), desc: t('linkWig'), Icon: Target, hex: '#557f3c', soft: 'rgba(85,127,60,0.12)'},
    {href: '/attendance', label: tn('attendance'), desc: t('linkAttendance'), Icon: ClipboardCheck, hex: '#0e7c86', soft: 'rgba(14,124,134,0.12)'},
    {href: '/scoreboard', label: tn('compete'), desc: t('linkScoreboard'), Icon: Trophy, hex: '#b98900', soft: 'rgba(185,137,0,0.12)'},
    {href: '/meeting', label: tn('meeting'), desc: t('linkMeeting'), Icon: MessagesSquare, hex: '#cf5a42', soft: 'rgba(207,90,66,0.12)'},
  ];

  const metaChip = 'inline-flex items-center gap-1.5 rounded-full bg-navy/[0.06] px-3 py-1 text-[12px] font-bold text-txt';

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-[12.5px] font-extrabold text-gold-deep hover:underline">
        {t('backToAdmin')}
      </Link>

      {/* Hero lớp */}
      <section className="glass rounded-[22px] p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[26px] font-bold leading-none text-navy">{cls.name}</h1>
          <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/10 px-3 py-1 text-[11.5px] font-extrabold text-gold-deep">
            {cls.school_year}
          </span>
          {!cls.is_active && (
            <span className="rounded-full bg-status-bad/[0.12] px-3 py-1 text-[11.5px] font-extrabold text-status-bad">
              {t('archived')}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={metaChip}>
            <Building2 size={14} strokeWidth={2} className="text-gold-deep" />
            {campus?.name ?? '—'}
          </span>
          <span className={metaChip}>
            <Layers size={14} strokeWidth={2} className="text-gold-deep" />
            {t('grade')}: {cls.grade ?? t('none')}
          </span>
          <span className={metaChip}>
            <GraduationCap size={14} strokeWidth={2} className="text-gold-deep" />
            {t('gvcn')}: {gvcn ?? t('none')}
          </span>
          <span className={metaChip}>
            <Users size={14} strokeWidth={2} className="text-gold-deep" />
            {t('students')}: {studentCount ?? 0}
          </span>
          <span className={metaChip}>
            <CalendarRange size={14} strokeWidth={2} className="text-gold-deep" />
            WIG: {wigCount ?? 0}
          </span>
        </div>
      </section>

      {/* Liên kết nhanh sang các màn hình của lớp */}
      <section>
        <h2 className="mb-2.5 font-display text-[16px] font-bold text-navy">{t('linkTitle')}</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {links.map(({href, label, desc, Icon, hex, soft}) => (
            <Link
              key={href}
              href={{pathname: href, query: {class: cls.id}}}
              className="glass glass-hover flex items-start gap-3 rounded-[18px] p-4"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{background: soft, color: hex}}
              >
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold text-navy">{label}</span>
                <span className="mt-0.5 block text-[12px] font-semibold text-grey-mid">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sửa lớp */}
      <section className="glass rounded-[20px] p-[18px]">
        <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('editClass')}</h2>
        <ClassEditForm
          row={{
            id: cls.id,
            name: cls.name,
            grade_id: cls.grade_id,
            school_year: cls.school_year,
            campus_id: cls.campus_id,
            homeroom_teacher_id: cls.homeroom_teacher_id,
          }}
          campuses={campuses ?? []}
          grades={grades ?? []}
          teachers={teachers ?? []}
        />
      </section>
    </div>
  );
}
