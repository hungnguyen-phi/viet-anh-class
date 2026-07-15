import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {DonutRing} from '@/components/charts/DonutRing';

export default async function ReportPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireRole(['parent', 'admin']);
  const t = await getTranslations('report');
  const tArea = await getTranslations('class');
  const supabase = await createClient();

  // Con của phụ huynh (RLS pl_parent_self chỉ trả link của chính họ).
  const {data: links} = await supabase.from('parent_links').select('student_id').limit(1);
  const childId = links?.[0]?.student_id;

  if (!childId) {
    return (
      <div className="rounded-xl border border-grey-line bg-white p-8 text-center">
        <h1 className="font-heading text-xl font-extrabold text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-grey-mid">{t('noChild')}</p>
      </div>
    );
  }

  const {data: child} = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', childId)
    .maybeSingle();

  const {data: enr} = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', childId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  let className = '—';
  if (enr) {
    const {data: cls} = await supabase.from('classes').select('name').eq('id', enr.class_id).maybeSingle();
    className = cls?.name ?? '—';
  }

  const {data: att} = await supabase
    .from('attendance_records')
    .select('status')
    .eq('student_id', childId);
  const counts: Record<string, number> = {present: 0, absent: 0, late: 0, excused: 0};
  (att ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });

  const {data: prog} = await supabase.rpc('child_class_progress', {s: childId});
  const progByArea = new Map((prog ?? []).map((p) => [p.area, p]));

  // Ghi audit truy cập báo cáo nhạy cảm (§12.4).
  await supabase.rpc('log_audit', {p_action: 'view_parent_report', p_detail: {student_id: childId}});

  const areas = ['knowledge', 'skills', 'english', 'physical'] as const;
  const statuses = ['present', 'absent', 'late', 'excused'] as const;
  const statusColor: Record<string, string> = {
    present: 'text-success',
    absent: 'text-status-bad',
    late: 'text-warn',
    excused: 'text-grey-mid',
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-navy to-navy-dark p-6 text-white">
        <h1 className="font-heading text-2xl font-black">
          {child?.full_name ?? t('child')}
        </h1>
        <p className="mt-1 text-sm text-white/85">
          {t('class')}: {className}
        </p>
        <p className="mt-1 text-xs text-gold">{t('readOnly')}</p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-sm font-extrabold uppercase tracking-wide text-navy">
          {t('attendance')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statuses.map((s) => (
            <div key={s} className="rounded-xl border border-grey-line bg-white p-4 text-center">
              <div className={`font-heading text-2xl font-black ${statusColor[s]}`}>
                {counts[s] ?? 0}
              </div>
              <div className="mt-1 text-xs font-semibold text-grey-mid">{t(s)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-extrabold uppercase tracking-wide text-navy">
          {t('wigProgress')}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {areas.map((a) => {
            const w = progByArea.get(a);
            return (
              <div key={a} className="rounded-xl border border-grey-line bg-white p-4 text-center">
                <div className="mb-3 font-heading text-sm font-extrabold text-navy">
                  {tArea(`areas.${a}`)}
                </div>
                {w ? (
                  <DonutRing pct={Number(w.pct ?? 0)} status={w.status ?? ''} />
                ) : (
                  <div className="mt-3 text-xs text-grey-mid">{tArea('noWig')}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
