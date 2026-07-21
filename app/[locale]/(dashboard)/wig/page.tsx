import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {addLeadMeasure, createWig, logProgress} from './actions';

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

type Wig = {
  id: string;
  area: string;
  period: string;
  period_label: string | null;
  parent_wig_id: string | null;
  target_value: number;
  unit: string;
};
type Lead = {id: string; wig_id: string; title: string; target_value: number; unit: string | null};
type Prog = {actual: number | null; pct: number | null; status: string | null};

const statusColor: Record<string, string> = {
  on_track: 'var(--color-success)',
  mid: 'var(--color-warn)',
  off_track: 'var(--color-status-bad)',
};

export default async function WigPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('wig');
  const tArea = await getTranslations('class');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="rounded-xl border border-grey-line bg-white p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  // WIG + tiến độ chỉ phụ thuộc myClass.id — chạy song song.
  const [{data: wigsData}, {data: progData}] = await Promise.all([
    supabase
      .from('wigs')
      .select('id, area, period, period_label, parent_wig_id, target_value, unit')
      .eq('class_id', myClass.id)
      .eq('scope', 'class'),
    supabase
      .from('wig_progress_v')
      .select('wig_id, actual, pct, status')
      .eq('class_id', myClass.id)
      .eq('scope', 'class'),
  ]);
  const wigs = (wigsData ?? []) as Wig[];
  const progByWig = new Map((progData ?? []).map((p) => [p.wig_id, p as unknown as Prog]));

  const yearWigs = wigs.filter((w) => w.period === 'year').sort((a, b) => a.area.localeCompare(b.area));
  const weekByParent = new Map<string, Wig[]>();
  for (const w of wigs.filter((x) => x.period === 'week' && x.parent_wig_id)) {
    const arr = weekByParent.get(w.parent_wig_id!) ?? [];
    arr.push(w);
    weekByParent.set(w.parent_wig_id!, arr);
  }

  const weekIds = wigs.filter((w) => w.period === 'week').map((w) => w.id);
  let leads: Lead[] = [];
  if (weekIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('id, wig_id, title, target_value, unit')
      .in('wig_id', weekIds);
    leads = (leadData ?? []) as Lead[];
  }
  const leadsByWig = new Map<string, Lead[]>();
  for (const l of leads) {
    const arr = leadsByWig.get(l.wig_id) ?? [];
    arr.push(l);
    leadsByWig.set(l.wig_id, arr);
  }

  const inputCls = 'rounded-md border border-grey-line bg-white px-2 py-1.5 text-sm';
  const btnCls = 'rounded-md bg-navy px-3 py-1.5 text-sm font-bold text-white hover:bg-navy-dark';
  const ghostBtn = 'rounded-md border border-grey-line px-3 py-1.5 text-sm font-bold text-navy hover:border-navy';

  const bar = (p?: Prog) => {
    const pct = Math.round(Number(p?.pct ?? 0) * 100);
    return (
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-grey-line">
        <div className="h-full rounded-full" style={{width: `${pct}%`, background: statusColor[p?.status ?? ''] ?? 'var(--color-grey-mid)'}} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-black text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>
      {flash && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
          {flash}
        </div>
      )}
      <p className="text-xs italic text-grey-mid">{t('leadHint')}</p>

      {/* Bước 1: Tạo WIG năm */}
      <section className="rounded-xl border border-grey-line bg-white p-4">
        <h2 className="mb-3 font-heading font-extrabold text-navy">1 · {t('createYear')}</h2>
        <form action={createWig} className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          <input type="hidden" name="class_id" value={myClass.id} />
          <input type="hidden" name="period" value="year" />
          <select name="area" className={inputCls} required defaultValue="">
            <option value="" disabled>— {t('area')} —</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{tArea(`areas.${a}`)}</option>
            ))}
          </select>
          <input name="target_value" type="number" step="any" placeholder={t('target')} className={inputCls} required />
          <input name="unit" placeholder={t('unit')} className={inputCls} required />
          <input name="period_label" placeholder={t('label')} className={inputCls} defaultValue="2026" />
          <label className="text-xs text-grey-mid">{t('start')}<input name="start_date" type="date" className={`${inputCls} w-full`} required /></label>
          <label className="text-xs text-grey-mid">{t('end')}<input name="end_date" type="date" className={`${inputCls} w-full`} required /></label>
          <button type="submit" className={`${btnCls} md:col-span-2`}>+ {t('createYear')}</button>
        </form>
      </section>

      {/* Danh sách WIG năm → WIG tuần → lead */}
      {yearWigs.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noWigs')}</p>
      ) : (
        yearWigs.map((yw) => {
          const yprog = progByWig.get(yw.id);
          const weeks = weekByParent.get(yw.id) ?? [];
          return (
            <section key={yw.id} className="rounded-xl border-2 border-navy/15 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-lg font-black text-navy">
                  {tArea(`areas.${yw.area}`)} · {t('year')}
                  {yw.period_label ? ` (${yw.period_label})` : ''}
                </h3>
                <span className="text-sm text-grey-mid">
                  {Number(yprog?.actual ?? 0)} / {yw.target_value} {yw.unit}
                </span>
              </div>
              <div className="mt-2">{bar(yprog)}</div>
              <p className="mt-1 text-[11px] italic text-grey-mid">{t('yearRollup')}</p>

              {/* Bước 2: Tạo WIG tuần (link với WIG năm này) */}
              <div className="mt-4 rounded-lg bg-grey-light p-3">
                <div className="mb-2 text-xs font-bold uppercase text-navy">2 · {t('createWeek')}</div>
                <form action={createWig} className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <input type="hidden" name="class_id" value={myClass.id} />
                  <input type="hidden" name="period" value="week" />
                  <input type="hidden" name="parent_wig_id" value={yw.id} />
                  <input type="hidden" name="area" value={yw.area} />
                  <input name="target_value" type="number" step="any" placeholder={t('target')} className={inputCls} required />
                  <input name="unit" placeholder={t('unit')} className={inputCls} defaultValue={yw.unit} required />
                  <input name="period_label" placeholder={t('label')} className={inputCls} />
                  <div className="flex gap-2">
                    <input name="start_date" type="date" className={`${inputCls} w-full`} required />
                    <input name="end_date" type="date" className={`${inputCls} w-full`} required />
                  </div>
                  <button type="submit" className={`${ghostBtn} md:col-span-4`}>+ {t('createWeek')}</button>
                </form>
              </div>

              {/* WIG tuần + lead measures */}
              <div className="mt-3 space-y-3">
                <div className="text-xs font-bold uppercase text-grey-mid">{t('weekWigs')}</div>
                {weeks.length === 0 && <p className="text-sm italic text-grey-mid">{t('noWeekWigs')}</p>}
                {weeks.map((ww) => {
                  const wprog = progByWig.get(ww.id);
                  const wleads = leadsByWig.get(ww.id) ?? [];
                  return (
                    <div key={ww.id} className="rounded-lg border border-grey-line p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-heading font-bold text-navy">
                          {t('week')} {ww.period_label ? `· ${ww.period_label}` : ''}
                        </span>
                        <span className="text-xs text-grey-mid">
                          {Number(wprog?.actual ?? 0)} / {ww.target_value} {ww.unit}
                        </span>
                      </div>
                      <div className="mt-1">{bar(wprog)}</div>

                      <ul className="mt-2 space-y-1">
                        {wleads.length === 0 && <li className="text-xs text-grey-mid">{t('noLeads')}</li>}
                        {wleads.map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-line py-1">
                            <span className="text-sm text-ink">
                              {l.title} <span className="text-grey-mid">({l.target_value} {l.unit ?? ''})</span>
                            </span>
                            <form action={logProgress} className="flex items-center gap-1">
                              <input type="hidden" name="lead_measure_id" value={l.id} />
                              <input name="value" type="number" step="any" defaultValue={1} className={`${inputCls} w-16`} />
                              <button type="submit" className={btnCls}>{t('log')}</button>
                            </form>
                          </li>
                        ))}
                      </ul>

                      {/* Bước 3: thêm lead measure cho WIG tuần */}
                      <form action={addLeadMeasure} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="wig_id" value={ww.id} />
                        <input name="title" placeholder={`3 · ${t('leadTitle')}`} className={inputCls} required />
                        <input name="target_value" type="number" step="any" placeholder={t('target')} className={`${inputCls} w-24`} required />
                        <input name="unit" placeholder={t('unit')} className={`${inputCls} w-24`} />
                        <button type="submit" className={ghostBtn}>+ {t('addLead')}</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
