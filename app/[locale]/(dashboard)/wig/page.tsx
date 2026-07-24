import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {WigCreateForm} from './WigCreateForm';
import {
  addLeadMeasure,
  createWig,
  logProgress,
  deleteWig,
  deleteLeadMeasure,
  editWig,
  editLeadMeasure,
} from './actions';
import {Link} from '@/i18n/navigation';
import {AREAS, buildAreaMeta, areaLabel, type Area} from '@/lib/areas';

type Wig = {
  id: string;
  area: string;
  period: string;
  period_label: string | null;
  parent_wig_id: string | null;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
};
type Lead = {
  id: string;
  wig_id: string;
  title: string;
  target_value: number;
  unit: string | null;
  sub_category: string | null;
};
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
  searchParams: Promise<{class?: string; flash?: string; editWig?: string; editLead?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash, editWig: editWigId, editLead: editLeadId} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('wig');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  // Truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible, {data: areaCfg}] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
    supabase.from('area_config').select('*').order('sort_order'),
  ]);
  const areaMeta = buildAreaMeta(areaCfg);

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
      .select('id, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date')
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
  // Con trực tiếp của 1 WIG theo cấp (năm→tháng→tuần). Tuần có thể nằm dưới năm HOẶC tháng.
  const childrenOf = (pid: string, period: 'month' | 'week') =>
    wigs
      .filter((w) => w.parent_wig_id === pid && w.period === period)
      .sort((a, b) => (a.period_label ?? '').localeCompare(b.period_label ?? ''));

  const weekIds = wigs.filter((w) => w.period === 'week').map((w) => w.id);
  let leads: Lead[] = [];
  if (weekIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('id, wig_id, title, target_value, unit, sub_category')
      .in('wig_id', weekIds);
    leads = (leadData ?? []) as Lead[];
  }
  const leadsByWig = new Map<string, Lead[]>();
  for (const l of leads) {
    const arr = leadsByWig.get(l.wig_id) ?? [];
    arr.push(l);
    leadsByWig.set(l.wig_id, arr);
  }

  // Options lĩnh vực (đã dịch) truyền xuống form tạo WIG năm (client component).
  const areaOptions = AREAS.map((a) => ({value: a, label: areaLabel(areaMeta[a], locale)}));

  // Chế độ sửa qua ?editWig / ?editLead — panel hiện ở đầu trang (server-rendered, không cần client state).
  const editingWig = editWigId ? wigs.find((w) => w.id === editWigId) : undefined;
  const editingLead = editLeadId ? leads.find((l) => l.id === editLeadId) : undefined;
  const editHref = (extra: Record<string, string>) => ({
    pathname: '/wig' as const,
    query: {...(classParam ? {class: classParam} : {}), ...extra},
  });
  const backHref = editHref({}); // huỷ sửa → về danh sách (giữ ?class)
  const editLinkCls =
    'cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11px] font-extrabold text-navy transition-all hover:border-navy';

  const compactInput =
    'rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
  const ghostBtn =
    'cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3.5 py-2 text-xs font-extrabold text-navy transition-all hover:border-navy hover:bg-white';
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

  // Panel sửa WIG (mục tiêu/đơn vị/nhãn/ngày) — hiện khi ?editWig=<id>.
  const wigEditPanel = (w: Wig) => (
    <section className="glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60">
      <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
        {t('editWig')} · {areaLabel(areaMeta[w.area as Area], locale)}
        {w.period_label ? ` · ${w.period_label}` : ''}
      </div>
      <form action={editWig} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="class_id" value={myClass.id} />
        <input type="hidden" name="wig_id" value={w.id} />
        <input name="target_value" type="number" step="any" min="0.01" defaultValue={w.target_value} placeholder={t('target')} className={`${compactInput} w-[110px]`} required />
        <input name="unit" defaultValue={w.unit} placeholder={t('unit')} className={`${compactInput} w-[110px]`} required />
        <input name="period_label" defaultValue={w.period_label ?? ''} placeholder={t('label')} className={`${compactInput} w-[160px]`} />
        <input name="start_date" type="date" defaultValue={w.start_date} className={compactInput} />
        <input name="end_date" type="date" defaultValue={w.end_date} className={compactInput} />
        <button type="submit" className={logBtn}>{t('save')}</button>
        <Link href={backHref} className={ghostBtn}>{t('cancel')}</Link>
      </form>
    </section>
  );

  // Panel sửa lead measure — hiện khi ?editLead=<id>.
  const leadEditPanel = (l: Lead) => (
    <section className="glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60">
      <div className="mb-2.5 font-display text-[15px] font-bold text-navy">{t('editLead')}</div>
      <form action={editLeadMeasure} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="class_id" value={myClass.id} />
        <input type="hidden" name="lead_measure_id" value={l.id} />
        <input name="title" defaultValue={l.title} placeholder={t('leadTitle')} className={`${compactInput} min-w-[200px] flex-1`} required />
        <input name="target_value" type="number" step="any" min="0.01" defaultValue={l.target_value} placeholder={t('target')} className={`${compactInput} w-24`} required />
        <input name="unit" defaultValue={l.unit ?? ''} placeholder={t('unit')} className={`${compactInput} w-24`} />
        <input name="sub_category" defaultValue={l.sub_category ?? ''} placeholder={t('subCat')} className={`${compactInput} w-28`} />
        <button type="submit" className={logBtn}>{t('save')}</button>
        <Link href={backHref} className={ghostBtn}>{t('cancel')}</Link>
      </form>
    </section>
  );

  // Form tạo WIG con (tuần/tháng). allowMonth=true dưới WIG năm; false dưới WIG tháng.
  const createChildForm = (parentId: string, area: string, unit: string, allowMonth: boolean) => (
    <form action={createWig} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="class_id" value={myClass.id} />
      <input type="hidden" name="parent_wig_id" value={parentId} />
      <input type="hidden" name="area" value={area} />
      {allowMonth ? (
        <select name="period" defaultValue="week" className={`${compactInput} w-[100px] cursor-pointer`}>
          <option value="week">{t('week')}</option>
          <option value="month">{t('month')}</option>
        </select>
      ) : (
        <input type="hidden" name="period" value="week" />
      )}
      <input name="target_value" type="number" step="any" min="0.01" placeholder={t('target')} className={`${compactInput} w-[100px]`} required />
      <input name="unit" placeholder={t('unit')} className={`${compactInput} w-[100px]`} defaultValue={unit} required />
      <input name="period_label" placeholder={t('label')} className={`${compactInput} w-[150px]`} />
      <input name="start_date" type="date" className={compactInput} required />
      <input name="end_date" type="date" className={compactInput} required />
      <button type="submit" className={ghostBtn}>+ {t('createWeek')}</button>
    </form>
  );

  // Khối WIG tuần (bar + lead measures + thêm lead) — tái dùng dưới năm HOẶC tháng.
  const weekBlock = (ww: Wig) => {
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
          <Link href={editHref({editWig: ww.id})} className={editLinkCls}>
            {t('edit')}
          </Link>
        </div>
        <div className="mt-2">{bar(wprog)}</div>
        <ul className="mt-2.5 flex flex-col">
          {wleads.length === 0 && (
            <li className="py-2 text-xs font-semibold text-grey-mid">{t('noLeads')}</li>
          )}
          {wleads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 border-b border-navy/[0.08] py-2">
              <span className="text-[13px] font-bold text-navy">
                {l.title}{' '}
                <span className="font-semibold text-grey-mid">
                  ({l.target_value} {l.unit ?? ''})
                </span>
              </span>
              <form action={logProgress} className="ml-auto flex items-center gap-1.5">
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="lead_measure_id" value={l.id} />
                <input name="value" type="number" step="any" min="0.01" defaultValue={1} className={`${compactInput} w-14 text-center`} />
                <button type="submit" className={logBtn}>{t('log')}</button>
              </form>
              <Link href={editHref({editLead: l.id})} className={editLinkCls}>
                {t('edit')}
              </Link>
              <form action={deleteLeadMeasure}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="lead_measure_id" value={l.id} />
                <ConfirmButton message={t('confirmDeleteLead')} className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]">
                  ✕
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addLeadMeasure} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="class_id" value={myClass.id} />
          <input type="hidden" name="wig_id" value={ww.id} />
          <input name="title" placeholder={`3 · ${t('leadTitle')}`} className={`${compactInput} min-w-[180px] flex-1`} required />
          <input name="target_value" type="number" step="any" placeholder={t('target')} className={`${compactInput} w-24`} required />
          <input name="unit" placeholder={t('unit')} className={`${compactInput} w-24`} />
          <input name="sub_category" placeholder={t('subCat')} className={`${compactInput} w-28`} />
          <button type="submit" className={ghostBtn}>+ {t('addLead')}</button>
        </form>
      </div>
    );
  };

  // Khối WIG tháng: bar + form tạo tuần con + danh sách tuần.
  const monthBlock = (mw: Wig) => {
    const mprog = progByWig.get(mw.id);
    const mweeks = childrenOf(mw.id, 'week');
    return (
      <div key={mw.id} className="rounded-[14px] border-[1.5px] border-navy/15 bg-navy/[0.02] p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[14px] font-bold text-navy">
            {t('month')} {mw.period_label ? `· ${mw.period_label}` : ''}
          </span>
          <span className="ml-auto text-[11.5px] font-bold text-grey-mid">
            {Number(mprog?.actual ?? 0)} / {mw.target_value} {mw.unit}
          </span>
          <Link href={editHref({editWig: mw.id})} className={editLinkCls}>
            {t('edit')}
          </Link>
          <form action={deleteWig}>
            <input type="hidden" name="class_id" value={myClass.id} />
            <input type="hidden" name="wig_id" value={mw.id} />
            <ConfirmButton message={t('confirmDeleteWig')} className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]">
              ✕
            </ConfirmButton>
          </form>
        </div>
        <div className="mt-2">{bar(mprog)}</div>
        <div className="mt-2.5">{createChildForm(mw.id, mw.area, mw.unit, false)}</div>
        {mweeks.length > 0 && <div className="mt-2.5 flex flex-col gap-2.5">{mweeks.map(weekBlock)}</div>}
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

      {/* Panel sửa (WIG hoặc lead) — hiện khi có ?editWig / ?editLead */}
      {editingWig && wigEditPanel(editingWig)}
      {editingLead && leadEditPanel(editingLead)}

      <p className="text-xs font-semibold italic text-grey-mid">{t('leadHint')}</p>

      {/* Bước 1: Tạo WIG năm */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">1 · {t('createYear')}</div>
        <WigCreateForm classId={myClass.id} areas={areaOptions} />
      </section>

      {/* Danh sách WIG năm → WIG tuần → lead */}
      {yearWigs.length === 0 ? (
        <p className="text-sm font-semibold italic text-grey-mid">{t('noWigs')}</p>
      ) : (
        yearWigs.map((yw) => {
          const yprog = progByWig.get(yw.id);
          const months = childrenOf(yw.id, 'month');
          const directWeeks = childrenOf(yw.id, 'week');
          return (
            <section key={yw.id} className="glass rounded-[20px] p-[18px]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[16px] font-bold text-navy">
                  {areaLabel(areaMeta[yw.area as Area], locale)} · {t('year')}
                  {yw.period_label ? ` (${yw.period_label})` : ''}
                </span>
                <span className="ml-auto text-[12.5px] font-bold text-grey-mid">
                  {Number(yprog?.actual ?? 0)} / {yw.target_value} {yw.unit}
                </span>
                <Link href={editHref({editWig: yw.id})} className={editLinkCls}>
                  {t('edit')}
                </Link>
                <form action={deleteWig}>
                  <input type="hidden" name="class_id" value={myClass.id} />
                  <input type="hidden" name="wig_id" value={yw.id} />
                  <ConfirmButton
                    message={t('confirmDeleteWig')}
                    className="cursor-pointer rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2 py-1 text-[11px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16]"
                  >
                    {t('delete')}
                  </ConfirmButton>
                </form>
              </div>
              <div className="mt-2.5">{bar(yprog)}</div>
              <p className="mt-1.5 text-[10.5px] font-semibold italic text-grey-mid">{t('yearRollup')}</p>

              {/* Bước 2: Tạo WIG tuần (link với WIG năm này) */}
              <div className="mt-3.5 rounded-[14px] bg-navy/[0.04] p-3">
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-navy">
                  2 · {t('createWeek')}
                </div>
                {createChildForm(yw.id, yw.area, yw.unit, true)}
              </div>

              {/* WIG tháng (mỗi tháng có tuần con) + WIG tuần trực tiếp của năm */}
              {months.length === 0 && directWeeks.length === 0 ? (
                <div className="mt-3 text-xs font-semibold italic text-grey-mid">{t('noWeekWigs')}</div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {months.map(monthBlock)}
                  {directWeeks.map(weekBlock)}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
