import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Check, X, GraduationCap, Trophy} from 'lucide-react';
import {DonutRing} from '@/components/charts/DonutRing';
import {WeekPicker} from '@/components/report/WeekPicker';

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

type WeekReportRow = {
  area: string;
  wig_actual: number;
  wig_target: number;
  wig_won: boolean;
  leads_total: number;
  leads_done: number;
};
type YearProg = {area: string; pct: number | null; status: string | null};
type Meeting = {results: string | null; commitments: string | null; next_actions: string | null};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{week?: string}>;
}) {
  const {locale} = await params;
  const {week: weekParam} = await searchParams;
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
      <div className="card p-10 text-center">
        <h1 className="font-heading text-xl font-extrabold text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-grey-mid">{t('noChild')}</p>
      </div>
    );
  }

  // Đợt 1 (song song, chỉ phụ thuộc childId): hồ sơ con, lớp, điểm danh tổng quan,
  // tiến độ WIG năm cá nhân (view — parent đọc được qua wig_parent_read), danh sách tuần.
  const [{data: child}, {data: enr}, {data: att}, {data: yearRows}, {data: weeksData}] =
    await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', childId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('classes(name, school_year)')
        .eq('student_id', childId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      supabase.from('attendance_records').select('status').eq('student_id', childId),
      supabase
        .from('wig_progress_v')
        .select('area, pct, status')
        .eq('student_id', childId)
        .eq('scope', 'student')
        .eq('period', 'year'),
      supabase.rpc('child_weeks', {s: childId}),
    ]);

  const cls = (enr as unknown as {classes: {name: string; school_year: string} | null} | null)
    ?.classes;
  const counts: Record<string, number> = {present: 0, absent: 0, late: 0, excused: 0};
  (att ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });
  const yearByArea = new Map((yearRows ?? []).map((r) => [(r as YearProg).area, r as YearProg]));
  const weeks = ((weeksData ?? []) as {week_label: string}[]).map((w) => w.week_label);
  const week = weekParam && weeks.includes(weekParam) ? weekParam : weeks[0];

  // Đợt 2 (phụ thuộc tuần đã chọn): báo cáo tuần (WIG thắng/tổng + LM hoàn thành/tổng) + biên bản họp.
  let weekRows: WeekReportRow[] = [];
  let meeting: Meeting | null = null;
  if (week) {
    const [{data: wr}, {data: mtg}] = await Promise.all([
      supabase.rpc('child_week_report', {s: childId, wk: week}),
      supabase
        .from('wig_meetings')
        .select('results, commitments, next_actions')
        .eq('student_id', childId)
        .eq('week_label', week)
        .maybeSingle(),
    ]);
    weekRows = (wr ?? []) as WeekReportRow[];
    meeting = (mtg ?? null) as Meeting | null;
  }
  const weekByArea = new Map(weekRows.map((r) => [r.area, r]));

  const statuses = ['present', 'absent', 'late', 'excused'] as const;
  const statusColor: Record<string, string> = {
    present: 'text-success',
    absent: 'text-status-bad',
    late: 'text-warn',
    excused: 'text-grey-mid',
  };

  // Ghi audit truy cập báo cáo nhạy cảm (§12.4).
  await supabase.rpc('log_audit', {
    p_action: 'view_parent_report',
    p_detail: {student_id: childId, week: week ?? null},
  });

  return (
    <div className="space-y-8">
      {/* Hero + bộ lọc tuần */}
      <div className="animate-rise relative overflow-hidden rounded-3xl p-6 text-white shadow-pop ring-1 ring-white/10 sm:p-8 [background:radial-gradient(40rem_22rem_at_85%_-20%,rgba(249,221,14,0.16),transparent_55%),linear-gradient(135deg,#2c2e6e_0%,#26275d_55%,#1b1c45_100%)]">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold/90">
              {t('title')}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              {child?.full_name ?? t('child')}
            </h1>
            {cls && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80">
                <GraduationCap size={16} strokeWidth={2} className="text-gold/80" />
                {t('class')}: <b className="font-semibold text-white">{cls.name}</b>
                <span className="text-white/50">· {cls.school_year}</span>
              </p>
            )}
          </div>
          {weeks.length > 0 && week && (
            <WeekPicker weeks={weeks} current={week} label={t('week')} />
          )}
        </div>
        <p className="text-shadow-dark relative mt-3 text-xs font-semibold text-gold">
          {t('readOnly')}
        </p>
      </div>

      {/* Điểm danh tổng quan */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('attendance')}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statuses.map((s) => (
            <div key={s} className="card card-hover p-5 text-center">
              <div className={`font-heading text-3xl font-black ${statusColor[s]}`}>
                {counts[s] ?? 0}
              </div>
              <div className="mt-1 text-xs font-semibold text-grey-mid">{t(s)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Kết quả tuần được chọn: WIG thắng/tổng + LM hoàn thành/tổng theo 4 lĩnh vực */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('weekResult')} {week ? `· ${week}` : ''}
          </h2>
        </div>
        {weeks.length === 0 ? (
          <p className="text-xs italic text-grey-mid">{t('noWeeks')}</p>
        ) : weekRows.length === 0 ? (
          <p className="text-xs italic text-grey-mid">{t('noWeekData')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map((a) => {
              const r = weekByArea.get(a);
              if (!r) {
                return (
                  <div key={a} className="card p-5">
                    <div className="font-heading text-sm font-extrabold text-navy">
                      {tArea(`areas.${a}`)}
                    </div>
                    <p className="mt-3 text-xs italic text-grey-mid">{t('noWeekData')}</p>
                  </div>
                );
              }
              return (
                <div key={a} className="card card-hover p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-heading text-sm font-extrabold text-navy">
                      {tArea(`areas.${a}`)}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        r.wig_won ? 'bg-success/10 text-success' : 'bg-status-bad/10 text-status-bad'
                      }`}
                    >
                      {r.wig_won ? (
                        <Check size={12} strokeWidth={2.5} />
                      ) : (
                        <X size={12} strokeWidth={2.5} />
                      )}
                      {r.wig_won ? t('won') : t('notWon')}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-grey-mid">{t('wigWon')}</dt>
                      <dd className="font-heading font-black text-navy">
                        {Number(r.wig_actual)}
                        <span className="font-bold text-grey-mid">/{Number(r.wig_target)}</span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-grey-mid">{t('leadDone')}</dt>
                      <dd className="font-heading font-black text-navy">
                        {r.leads_done}
                        <span className="font-bold text-grey-mid">/{r.leads_total}</span>
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Chiêm nghiệm + tuần sau (từ biên bản họp WIG cá nhân Coach×Buddy) */}
      {week && (
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
            <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
              {t('reflection')}
            </h2>
          </div>
          {meeting ? (
            <div className="card space-y-4 p-6">
              {meeting.results && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                    {t('reflection')}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {meeting.results}
                  </p>
                </div>
              )}
              {meeting.next_actions && (
                <div className="border-t border-grey-line pt-4">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy">
                    <Trophy size={12} strokeWidth={2.5} className="text-gold" />
                    {t('nextWeek')}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {meeting.next_actions}
                  </p>
                </div>
              )}
              {!meeting.results && !meeting.next_actions && (
                <p className="text-xs italic text-grey-mid">{t('noMeeting')}</p>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-grey-mid">{t('noMeeting')}</p>
          )}
        </section>
      )}

      {/* Tiến độ WIG NĂM cá nhân (4 lĩnh vực) — cumulative */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
            {t('wigProgress')}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {AREAS.map((a) => {
            const w = yearByArea.get(a);
            return (
              <div key={a} className="card card-hover p-5 text-center">
                <div className="mb-4 font-heading text-sm font-extrabold text-navy">
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
