import {getTranslations, getLocale} from 'next-intl/server';
import {Check, X} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {AREAS, buildAreaMeta, areaLabel} from '@/lib/areas';

// Panel "cầm scoreboard mà họp" (PRD Màn 5/6): WIG tuần thắng/thua ×4 + lead hoàn thành/tổng,
// cho tuần đang họp. Dùng cho họp LỚP (classId) hoặc CÁ NHÂN (studentId).
export async function MeetingScoreboard({
  classId,
  studentId,
  weekLabel,
}: {
  classId: string;
  studentId?: string;
  weekLabel: string;
}) {
  const t = await getTranslations('meeting');
  const locale = await getLocale();
  const supabase = await createClient();
  const scope = studentId ? 'student' : 'class';

  let q = supabase
    .from('wig_progress_v')
    .select('wig_id, area, pct')
    .eq('scope', scope)
    .eq('period', 'week')
    .eq('period_label', weekLabel);
  q = studentId ? q.eq('student_id', studentId) : q.eq('class_id', classId);

  const [{data: wrows}, {data: areaCfg}] = await Promise.all([
    q,
    supabase.from('area_config').select('*').order('sort_order'),
  ]);
  const areaMeta = buildAreaMeta(areaCfg);
  const rows = (wrows ?? []) as {wig_id: string; area: string; pct: number | null}[];
  const wonByArea = new Map(rows.map((r) => [r.area, Number(r.pct ?? 0) >= 1]));

  const wigIds = rows.map((r) => r.wig_id);
  let leadsDone = 0;
  let leadsTotal = 0;
  if (wigIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('target_value, lead_progress(value)')
      .in('wig_id', wigIds);
    for (const l of (leadData ?? []) as {target_value: number; lead_progress: {value: number}[] | null}[]) {
      leadsTotal += 1;
      const actual = (l.lead_progress ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0);
      if (Number(l.target_value) > 0 && actual >= Number(l.target_value)) leadsDone += 1;
    }
  }

  const hasData = rows.length > 0 || leadsTotal > 0;

  return (
    <div className="glass rounded-[20px] p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="font-display text-[14px] font-bold text-navy">{t('scoreThisWeek')}</span>
        <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
          {weekLabel}
        </span>
        {leadsTotal > 0 && (
          <span className="ml-auto rounded-full bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
            {t('leadDone')}: {leadsDone}/{leadsTotal}
          </span>
        )}
      </div>
      {!hasData ? (
        <p className="text-[12px] italic text-grey-mid">{t('noWeekData')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AREAS.map((a) => {
            const am = areaMeta[a];
            const has = wonByArea.has(a);
            const won = wonByArea.get(a) ?? false;
            return (
              <div
                key={a}
                className="flex items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-2.5 py-2"
              >
                <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{background: am.hex}} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-navy">
                  {areaLabel(am, locale)}
                </span>
                {has ? (
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                    style={{
                      background: won ? 'var(--color-success)' : 'rgba(192,57,43,0.12)',
                      color: won ? '#fff' : 'var(--color-status-bad)',
                    }}
                  >
                    {won ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-grey-soft">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
