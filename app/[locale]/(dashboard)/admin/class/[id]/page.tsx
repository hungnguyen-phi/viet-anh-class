import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {
  Users,
  Target,
  ClipboardCheck,
  Trophy,
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
import {tenHienThi} from '@/lib/ten-hien-thi';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  await requireRole(['admin', 'principal']); // BGH quản lý lớp trong campus mình (RLS gate)
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
    {data: teachersRaw},
  ] = await Promise.all([
    supabase.from('campuses').select('name').eq('id', cls.campus_id).maybeSingle(),
    cls.homeroom_teacher_id
      ? supabase.from('profiles').select('full_name, email').eq('id', cls.homeroom_teacher_id).maybeSingle()
      : Promise.resolve({data: null}),
    supabase.from('enrollments').select('id', {count: 'exact', head: true}).eq('class_id', id).eq('is_active', true),
    supabase.from('muc_tieu').select('id', {count: 'exact', head: true}).eq('class_id', id),
    supabase.from('campuses').select('id, name').eq('is_active', true).order('name'),
    supabase.from('grades').select('id, name, campus_id, is_active').order('sort_order'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['teacher', 'admin'])       // GVCN là giáo viên (admin kiêm nhiệm được); BGH không chủ nhiệm
      .order('full_name')
      .limit(500),
  ]);

  const gvcn = teacher ? tenHienThi(teacher.full_name, teacher.email) : null;
  // Ô chọn GVCN hiện TÊN, không email trần; xếp theo tên tiếng Việt.
  const teachers = (teachersRaw ?? [])
    .map((p) => ({...p, full_name: tenHienThi(p.full_name, p.email)}))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

  // Thẻ liên kết sang các màn hình của lớp (mang theo ?class=id).
  const softOf = (c: string) => `color-mix(in srgb, ${c} 12%, transparent)`;
  const links: {href: string; label: string; desc: string; Icon: LucideIcon; hex: string; soft: string}[] = [
    // Năm cặp màu này TRÙNG KHÍT token màu lĩnh vực + warn, chỉ là trước đây gõ lại bằng hex và
    // rgba. `soft` pha ra từ chính màu ấy thay vì gõ tay bộ rgb tương ứng — đổi token một lần là
    // đủ, không phải nhớ sửa thêm ba con số ở đây.
    {href: '/roster', label: tn('roster'), desc: t('linkRoster'), Icon: Users, hex: 'var(--color-subj-knowledge)', soft: softOf('var(--color-subj-knowledge)')},
    {href: '/wig', label: tn('wig'), desc: t('linkWig'), Icon: Target, hex: 'var(--color-subj-skills)', soft: softOf('var(--color-subj-skills)')},
    {href: '/attendance', label: tn('attendance'), desc: t('linkAttendance'), Icon: ClipboardCheck, hex: 'var(--color-subj-english)', soft: softOf('var(--color-subj-english)')},
    {href: '/', label: tn('compete'), desc: t('linkScoreboard'), Icon: Trophy, hex: 'var(--color-warn)', soft: softOf('var(--color-warn)')},
  ];

  const metaChip = 'inline-flex items-center gap-1.5 rounded-full bg-navy/[0.06] px-3 py-1 text-[12px] font-bold text-txt';

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="inline-flex min-h-[24px] items-center text-[12.5px] font-extrabold text-gold-text hover:underline">
        {t('backToAdmin')}
      </Link>

      {/* Hero lớp */}
      <section className="glass rounded-[22px] p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[26px] font-bold leading-none text-navy">{cls.name}</h1>
          <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/10 px-3 py-1 text-[11.5px] font-extrabold text-gold-text">
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
            {campus?.name ?? t('notAssigned')}
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
            {t('mucTieuCount', {n: wigCount ?? 0})}
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
          teachers={teachers}
        />
      </section>
    </div>
  );
}
