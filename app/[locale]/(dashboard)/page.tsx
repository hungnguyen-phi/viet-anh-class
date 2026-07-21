import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {Check, X, Minus, Users, GraduationCap, Trophy, TrendingUp, Flame} from 'lucide-react';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {DonutRing} from '@/components/charts/DonutRing';

type WigRow = {
  wig_id: string;
  area: string;
  period: string;
  period_label: string | null;
  end_date: string;
  pct: number | null;
  status: string | null;
};
type LeadRow = {
  id: string;
  title: string;
  target_value: number;
  lead_progress: {value: number}[] | null;
};

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

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
  // Học sinh chỉ xem scoreboard CÁ NHÂN — tổng hợp lớp dành cho GV/quản trị (spec 20/07).
  if (profile.role === 'student') redirect('/student');
  const t = await getTranslations();
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="card p-10 text-center">
        <h1 className="font-heading text-xl font-extrabold text-navy">
          {t('class.noClass')}
        </h1>
        <p className="mt-2 text-sm text-grey-mid">{t('class.noClassDesc')}</p>
      </div>
    );
  }

  const gvcnName = profile.role === 'teacher' ? profile.full_name : null;

  // 3 truy vấn chỉ phụ thuộc myClass.id — chạy song song:
  // sĩ số (GVCN) + tiến độ WIG năm & tuần + thứ hạng thi đua.
  const [rosterRes, {data: wigRows}, {data: ranksData}] = await Promise.all([
    profile.role === 'teacher'
      ? supabase
          .from('enrollments')
          .select('id', {count: 'exact', head: true})
          .eq('class_id', myClass.id)
          .eq('is_active', true)
      : Promise.resolve(null),
    supabase
      .from('wig_progress_v')
      .select('wig_id, area, period, period_label, end_date, pct, status')
      .eq('class_id', myClass.id)
      .eq('scope', 'class')
      .in('period', ['year', 'week']),
    supabase.rpc('class_ranks', {c: myClass.id}),
  ]);
  const rosterCount: number | null = rosterRes ? (rosterRes.count ?? 0) : null;

  const rows = (wigRows ?? []) as WigRow[];
  const yearRows = rows.filter((r) => r.period === 'year');
  const weekRows = rows
    .filter((r) => r.period === 'week')
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
  const wigByArea = new Map(yearRows.map((r) => [r.area, r]));
  const weeksByArea = new Map<string, WigRow[]>();
  for (const w of weekRows) {
    const arr = weeksByArea.get(w.area) ?? [];
    arr.push(w);
    weeksByArea.set(w.area, arr);
  }

  // Lead measure tuần: hoàn thành khi tổng tiến độ ≥ mục tiêu.
  const weekIds = weekRows.map((w) => w.wig_id);
  let leads: {id: string; title: string; target: number; actual: number; done: boolean}[] = [];
  if (weekIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('id, title, target_value, lead_progress(value)')
      .in('wig_id', weekIds);
    leads = ((leadData ?? []) as LeadRow[]).map((l) => {
      const actual = (l.lead_progress ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0);
      const target = Number(l.target_value);
      return {id: l.id, title: l.title, target, actual, done: target > 0 && actual >= target};
    });
  }
  const leadsDone = leads.filter((l) => l.done).length;

  // Banner "3 giây": thắng khi số lĩnh vực on-track ≥ số off-track (theo WIG năm).
  const onCount = yearRows.filter((r) => r.status === 'on_track').length;
  const offCount = yearRows.filter((r) => r.status === 'off_track').length;
  const isWinning = yearRows.length > 0 ? onCount >= offCount : null;

  const statusLabel: Record<string, string> = {
    on_track: t('class.onTrack'),
    mid: t('class.midTrack'),
    off_track: t('class.offTrack'),
  };

  // Thứ hạng thi đua (Khối / Cấp / Campus / Group).
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
    <div className="space-y-8">
      {accessible.length > 1 && (
        <div className="flex justify-end">
          <ClassPicker classes={accessible} current={myClass.id} />
        </div>
      )}

      {/* Banner trạng thái "nhìn 3 giây biết thắng/thua" (PRD §6.1.1) */}
      {isWinning !== null && (
        <div
          className={`animate-rise flex items-center gap-4 rounded-2xl p-5 text-white shadow-raise ${
            isWinning
              ? '[background:linear-gradient(120deg,#1e8a5a_0%,#16724a_100%)]'
              : '[background:linear-gradient(120deg,#c0392b_0%,#9e2f23_100%)]'
          }`}
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 ring-2 ring-white/30">
            {isWinning ? (
              <Check size={30} strokeWidth={3} />
            ) : (
              <X size={30} strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0">
            <div className="font-heading text-2xl font-black tracking-tight sm:text-3xl">
              {isWinning ? t('class.winning') : t('class.losing')}
            </div>
            <p className="mt-0.5 text-sm text-white/85">
              {isWinning ? t('class.winningDesc') : t('class.losingDesc')}
            </p>
          </div>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold sm:inline-flex">
            {isWinning ? <TrendingUp size={14} strokeWidth={2.5} /> : <Flame size={14} strokeWidth={2.5} />}
            {onCount}/{yearRows.length} on-track
          </span>
        </div>
      )}

      {/* Hero lớp — ảnh lớp làm nền mờ (PRD §6.2.2), fallback gradient navy */}
      <div className="animate-rise relative overflow-hidden rounded-3xl p-6 text-white shadow-pop ring-1 ring-white/10 sm:p-8 [background:radial-gradient(40rem_22rem_at_85%_-20%,rgba(249,221,14,0.16),transparent_55%),radial-gradient(30rem_20rem_at_-10%_120%,rgba(47,49,112,0.9),transparent_60%),linear-gradient(135deg,#2c2e6e_0%,#26275d_55%,#1b1c45_100%)]">
        {myClass.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={myClass.cover_image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-[0.18] blur-[2px]"
          />
        )}
        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
              {myClass.name}
            </h1>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-heading text-xs font-extrabold tracking-wide text-gold">
              {myClass.school_year}
            </span>
          </div>

          {(gvcnName || rosterCount !== null) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-white/80">
              {gvcnName && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap size={16} strokeWidth={2} className="text-gold/80" />
                  {t('class.gvcn')}: <b className="font-semibold text-white">{gvcnName}</b>
                </span>
              )}
              {rosterCount !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users size={15} strokeWidth={2} className="text-gold/80" />
                  <b className="font-semibold text-white">{rosterCount}</b> {t('class.students')}
                </span>
              )}
            </div>
          )}

          {rank && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {rankItems.map(([label, r, total]) => (
                <span
                  key={label}
                  className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium text-white/75 ring-1 ring-white/15"
                >
                  {label}{' '}
                  <b className="font-heading text-[13px] font-black text-gold">#{r}</b>
                  <span className="text-white/50">/{total}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-b from-gold-soft to-gold px-3.5 py-1.5 text-[11px] font-black text-navy shadow-[0_4px_14px_rgba(249,221,14,0.35)]">
                <Trophy size={13} strokeWidth={2.5} />
                {t('class.score')}: {Number(rank.score)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* WIG năm — 4 lĩnh vực */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('class.wigYear')}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {AREAS.map((a) => {
            const w = wigByArea.get(a);
            const on = w?.status === 'on_track';
            const off = w?.status === 'off_track';
            return (
              <div key={a} className="card card-hover p-5 text-center">
                <div className="mb-4 font-heading text-sm font-extrabold text-navy">
                  {t(`class.areas.${a}`)}
                </div>
                {w ? (
                  <>
                    <DonutRing pct={Number(w.pct ?? 0)} status={w.status ?? ''} />
                    <div
                      className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        on
                          ? 'bg-success/10 text-success'
                          : off
                            ? 'bg-status-bad/10 text-status-bad'
                            : 'bg-warn/10 text-warn'
                      }`}
                    >
                      {on ? (
                        <Check size={13} strokeWidth={2.5} />
                      ) : off ? (
                        <X size={13} strokeWidth={2.5} />
                      ) : (
                        <Minus size={13} strokeWidth={2.5} />
                      )}
                      {statusLabel[w.status ?? ''] ?? ''}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 text-xs font-semibold text-grey-mid">
                    {t('class.noWig')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* WIG tuần — dãy pip thắng/thua + số thắng/tổng (PRD §6.1.1) */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('class.wigWeek')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((a) => {
            const weeks = weeksByArea.get(a) ?? [];
            const wins = weeks.filter((w) => Number(w.pct ?? 0) >= 1).length;
            return (
              <div key={a} className="card card-hover p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-heading text-sm font-extrabold text-navy">
                    {t(`class.areas.${a}`)}
                  </div>
                  {weeks.length > 0 && (
                    <div className="font-heading text-lg font-black text-navy">
                      {wins}
                      <span className="text-sm font-bold text-grey-mid">/{weeks.length}</span>
                    </div>
                  )}
                </div>
                {weeks.length > 0 ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {weeks.slice(-10).map((w) => {
                        const won = Number(w.pct ?? 0) >= 1;
                        return (
                          <span
                            key={w.wig_id}
                            title={w.period_label ?? ''}
                            className={`grid h-6 w-6 place-items-center rounded-md ${
                              won ? 'bg-success text-white' : 'bg-grey-light text-grey-mid'
                            }`}
                          >
                            {won ? (
                              <Check size={13} strokeWidth={3} />
                            ) : (
                              <X size={12} strokeWidth={2.5} />
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-grey-mid">
                      {wins}/{weeks.length} {t('class.weekWins')}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-grey-mid">
                    {t('class.noWeekWig')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Lead measure — hoàn thành/tổng + thanh tiến độ 3 màu */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('class.leadWeek')}
          </h2>
          {leads.length > 0 && (
            <span className="ml-auto rounded-full bg-navy px-3 py-1 font-heading text-xs font-black text-white">
              {leadsDone}/{leads.length} {t('class.leadDone')}
            </span>
          )}
        </div>
        {leads.length === 0 ? (
          <p className="text-xs italic text-grey-mid">{t('class.noLeads')}</p>
        ) : (
          <div className="card divide-y divide-grey-line">
            {leads.map((l) => {
              const pct = l.target > 0 ? Math.min(1, l.actual / l.target) : 0;
              const barColor =
                pct >= 1 ? 'bg-success' : pct >= 0.5 ? 'bg-gold' : 'bg-status-bad';
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      l.done ? 'bg-success text-white' : 'bg-grey-light text-grey-mid'
                    }`}
                  >
                    {l.done ? <Check size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{l.title}</div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-grey-light">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{width: `${Math.round(pct * 100)}%`}}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 font-heading text-sm font-black text-navy">
                    {l.actual}
                    <span className="font-bold text-grey-mid">/{l.target}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs italic text-grey-mid">{t('class.noWigDesc')}</p>
      </section>
    </div>
  );
}
