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
  on_track: '#1e8a5a',
  mid: '#e3b400',
  off_track: '#c0392b',
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
      <div className="glass rounded-[20px] p-8 text-center">
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

  const fieldLabel = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
  const fieldInput =
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const compactInput =
    'rounded-[10px] border-[1.5px] border-navy/15 bg-white/75 px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const goldBtn = 'btn-gold cursor-pointer rounded-[12px] px-4 py-2 text-sm font-extrabold';
  const ghostBtn =
    'cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-3.5 py-2 text-xs font-extrabold text-navy transition-all hover:border-navy hover:bg-white';
  const logBtn = 'btn-gold cursor-pointer rounded-[10px] px-3 py-1.5 text-xs font-extrabold';

  const bar = (p?: Prog) => {
    const pct = Math.round(Number(p?.pct ?? 0) * 100);
    return (
      <div className="h-[9px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
        <div
          className="h-full rounded-[5px]"
          style={{width: `${pct}%`, background: statusColor[p?.status ?? ''] ?? 'var(--color-grey-mid)'}}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {flash && (
        <div className="rounded-[12px] border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      <p className="text-xs font-semibold italic text-grey-mid">{t('leadHint')}</p>

      {/* Bước 1: Tạo WIG năm */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">1 · {t('createYear')}</div>
        <form action={createWig} className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <input type="hidden" name="class_id" value={myClass.id} />
          <input type="hidden" name="period" value="year" />
          <div>
            <span className={fieldLabel}>{t('area')}</span>
            <select name="area" className={`${fieldInput} cursor-pointer`} required defaultValue="">
              <option value="" disabled>
                — {t('area')} —
              </option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {tArea(`areas.${a}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>{t('target')}</span>
            <input name="target_value" type="number" step="any" placeholder={t('target')} className={fieldInput} required />
          </div>
          <div>
            <span className={fieldLabel}>{t('unit')}</span>
            <input name="unit" placeholder={t('unit')} className={fieldInput} required />
          </div>
          <div>
            <span className={fieldLabel}>{t('label')}</span>
            <input name="period_label" placeholder={t('label')} className={fieldInput} defaultValue="2026" />
          </div>
          <div>
            <span className={fieldLabel}>{t('start')}</span>
            <input name="start_date" type="date" className={fieldInput} required />
          </div>
          <div>
            <span className={fieldLabel}>{t('end')}</span>
            <input name="end_date" type="date" className={fieldInput} required />
          </div>
          <div className="flex items-end">
            <button type="submit" className={goldBtn}>
              + {t('createYear')}
            </button>
          </div>
        </form>
      </section>

      {/* Danh sách WIG năm → WIG tuần → lead */}
      {yearWigs.length === 0 ? (
        <p className="text-sm font-semibold italic text-grey-mid">{t('noWigs')}</p>
      ) : (
        yearWigs.map((yw) => {
          const yprog = progByWig.get(yw.id);
          const weeks = weekByParent.get(yw.id) ?? [];
          return (
            <section key={yw.id} className="glass rounded-[20px] p-[18px]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[16px] font-bold text-navy">
                  {tArea(`areas.${yw.area}`)} · {t('year')}
                  {yw.period_label ? ` (${yw.period_label})` : ''}
                </span>
                <span className="ml-auto text-[12.5px] font-bold text-grey-mid">
                  {Number(yprog?.actual ?? 0)} / {yw.target_value} {yw.unit}
                </span>
              </div>
              <div className="mt-2.5">{bar(yprog)}</div>
              <p className="mt-1.5 text-[10.5px] font-semibold italic text-grey-mid">{t('yearRollup')}</p>

              {/* Bước 2: Tạo WIG tuần (link với WIG năm này) */}
              <div className="mt-3.5 rounded-[14px] bg-navy/[0.04] p-3">
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-navy">
                  2 · {t('createWeek')}
                </div>
                <form action={createWig} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="class_id" value={myClass.id} />
                  <input type="hidden" name="period" value="week" />
                  <input type="hidden" name="parent_wig_id" value={yw.id} />
                  <input type="hidden" name="area" value={yw.area} />
                  <input
                    name="target_value"
                    type="number"
                    step="any"
                    placeholder={t('target')}
                    className={`${compactInput} w-[110px]`}
                    required
                  />
                  <input
                    name="unit"
                    placeholder={t('unit')}
                    className={`${compactInput} w-[100px]`}
                    defaultValue={yw.unit}
                    required
                  />
                  <input
                    name="period_label"
                    placeholder={t('label')}
                    className={`${compactInput} w-[170px]`}
                  />
                  <input name="start_date" type="date" className={compactInput} required />
                  <input name="end_date" type="date" className={compactInput} required />
                  <button type="submit" className={ghostBtn}>
                    + {t('createWeek')}
                  </button>
                </form>
              </div>

              {/* WIG tuần + lead measures */}
              {weeks.length === 0 ? (
                <div className="mt-3 text-xs font-semibold italic text-grey-mid">{t('noWeekWigs')}</div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {weeks.map((ww) => {
                    const wprog = progByWig.get(ww.id);
                    const wleads = leadsByWig.get(ww.id) ?? [];
                    return (
                      <div key={ww.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-display text-[14px] font-bold text-navy">
                            {t('week')} {ww.period_label ? `· ${ww.period_label}` : ''}
                          </span>
                          <span className="ml-auto text-[11.5px] font-bold text-grey-mid">
                            {Number(wprog?.actual ?? 0)} / {ww.target_value} {ww.unit}
                          </span>
                        </div>
                        <div className="mt-2">{bar(wprog)}</div>

                        <ul className="mt-2.5 flex flex-col">
                          {wleads.length === 0 && (
                            <li className="py-2 text-xs font-semibold text-grey-mid">{t('noLeads')}</li>
                          )}
                          {wleads.map((l) => (
                            <li
                              key={l.id}
                              className="flex flex-wrap items-center gap-2 border-b border-navy/[0.08] py-2"
                            >
                              <span className="text-[13px] font-bold text-navy">
                                {l.title}{' '}
                                <span className="font-semibold text-grey-mid">
                                  ({l.target_value} {l.unit ?? ''})
                                </span>
                              </span>
                              <form action={logProgress} className="ml-auto flex items-center gap-1.5">
                                <input type="hidden" name="lead_measure_id" value={l.id} />
                                <input
                                  name="value"
                                  type="number"
                                  step="any"
                                  defaultValue={1}
                                  className={`${compactInput} w-14 text-center`}
                                />
                                <button type="submit" className={logBtn}>
                                  {t('log')}
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>

                        {/* Bước 3: thêm lead measure cho WIG tuần */}
                        <form action={addLeadMeasure} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="wig_id" value={ww.id} />
                          <input
                            name="title"
                            placeholder={`3 · ${t('leadTitle')}`}
                            className={`${compactInput} min-w-[180px] flex-1`}
                            required
                          />
                          <input
                            name="target_value"
                            type="number"
                            step="any"
                            placeholder={t('target')}
                            className={`${compactInput} w-24`}
                            required
                          />
                          <input name="unit" placeholder={t('unit')} className={`${compactInput} w-24`} />
                          <button type="submit" className={ghostBtn}>
                            + {t('addLead')}
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
