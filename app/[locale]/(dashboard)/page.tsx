import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {DonutRing} from '@/components/charts/DonutRing';

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  const t = await getTranslations();
  const supabase = await createClient();
  const myClass = await getMyClass(supabase, profile, classParam);
  const accessible = await getAccessibleClasses(supabase, profile);

  if (!myClass) {
    return (
      <div className="rounded-xl border border-grey-line bg-white p-8 text-center">
        <h1 className="font-heading text-xl font-extrabold text-navy">
          {t('class.noClass')}
        </h1>
        <p className="mt-2 text-sm text-grey-mid">{t('class.noClassDesc')}</p>
      </div>
    );
  }

  let rosterCount: number | null = null;
  if (profile.role === 'teacher') {
    const {count} = await supabase
      .from('enrollments')
      .select('id', {count: 'exact', head: true})
      .eq('class_id', myClass.id)
      .eq('is_active', true);
    rosterCount = count ?? 0;
  }
  const gvcnName = profile.role === 'teacher' ? profile.full_name : null;
  const areas = ['knowledge', 'skills', 'english', 'physical'] as const;

  // Tiến độ WIG năm cấp lớp (4 lĩnh vực) cho donut on/off-track.
  const {data: wigRows} = await supabase
    .from('wig_progress_v')
    .select('area, pct, status')
    .eq('class_id', myClass.id)
    .eq('scope', 'class')
    .eq('period', 'year');
  const wigByArea = new Map((wigRows ?? []).map((r) => [r.area, r]));
  const statusLabel: Record<string, string> = {
    on_track: t('class.onTrack'),
    mid: t('class.midTrack'),
    off_track: t('class.offTrack'),
  };

  // Thứ hạng thi đua (Khối / Cấp / Campus / Group).
  const {data: ranksData} = await supabase.rpc('class_ranks', {c: myClass.id});
  const rank = ranksData?.[0];
  const rankItems = rank
    ? [
        [t('class.rankGrade'), rank.grade_rank, rank.grade_total] as const,
        [t('class.rankLevel'), rank.level_rank, rank.level_total] as const,
        [t('class.rankCampus'), rank.campus_rank, rank.campus_total] as const,
        [t('class.rankGroup'), rank.global_rank, rank.global_total] as const,
      ]
    : [];

  return (
    <div className="space-y-6">
      {accessible.length > 1 && (
        <div className="flex justify-end">
          <ClassPicker classes={accessible} current={myClass.id} />
        </div>
      )}
      {/* Hero lớp */}
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-navy to-navy-dark p-6 text-white shadow">
        <h1 className="font-heading text-2xl font-black">
          {myClass.name}{' '}
          <span className="text-gold">· {myClass.school_year}</span>
        </h1>
        <p className="mt-1 text-sm text-white/85">
          {gvcnName ? `${t('class.gvcn')}: ${gvcnName}` : null}
          {gvcnName && rosterCount !== null ? ' · ' : null}
          {rosterCount !== null
            ? `${rosterCount} ${t('class.students')}`
            : null}
        </p>
        {rank && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rankItems.map(([label, r, total]) => (
              <span
                key={label}
                className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px]"
              >
                {label} <b className="text-gold">#{r}</b>/{total}
              </span>
            ))}
            <span className="rounded-md border border-gold/40 bg-gold/15 px-2 py-1 text-[11px] font-bold">
              {t('class.score')}: <b className="text-gold">{Number(rank.score)}</b>
            </span>
          </div>
        )}
      </div>

      {/* WIG năm — trạng thái rỗng (thiết lập ở bước WIG) */}
      <section>
        <h2 className="mb-3 font-heading text-sm font-extrabold uppercase tracking-wide text-navy">
          {t('class.wigYear')}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {areas.map((a) => {
            const w = wigByArea.get(a);
            const on = w?.status === 'on_track';
            const off = w?.status === 'off_track';
            return (
              <div
                key={a}
                className="rounded-xl border border-grey-line bg-white p-4 text-center"
              >
                <div className="mb-3 font-heading text-sm font-extrabold text-navy">
                  {t(`class.areas.${a}`)}
                </div>
                {w ? (
                  <>
                    <DonutRing pct={Number(w.pct ?? 0)} status={w.status ?? ''} />
                    <div
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-extrabold ${
                        on ? 'text-success' : off ? 'text-status-bad' : 'text-warn'
                      }`}
                    >
                      <span>{on ? '✓' : off ? '✕' : '•'}</span>
                      {statusLabel[w.status ?? ''] ?? ''}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-grey-mid">
                    {t('class.noWig')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs italic text-grey-mid">
          {t('class.noWigDesc')}
        </p>
      </section>
    </div>
  );
}
