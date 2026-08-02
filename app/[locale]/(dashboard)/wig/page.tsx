import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
// SubmitButton thay <button type="submit"> trần ở mọi form của trang này. Người thử báo bấm
// "Ghi +" và "Tạo WIG tuần" xong không thấy dấu hiệu gì nên tưởng hỏng, bấm lại nhiều lần —
// nút này khoá + hiện spinner ngay khi bấm, và chặn luôn double-submit.
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, inputCls, btnGhost, btnGold, btnIconDanger} from '@/components/ui/Field';
import {WigCreateForm} from './WigCreateForm';
import {
  addLeadMeasure,
  createWig,
  deleteWig,
  deleteLeadMeasure,
  editWig,
  editLeadMeasure,
} from './actions';
import {Link} from '@/i18n/navigation';
import {isoWeekLabel, schoolYearOptions, weekOptions, monthOptions} from '@/lib/dates';
import {ClassMeetingSection} from '@/components/wig/ClassMeetingSection';
import {ClassStudentWigSetup} from '@/components/wig/ClassStudentWigSetup';
import {ClassTickBoard} from '@/components/wig/ClassTickBoard';
import {ChildPeriodFields} from '@/components/wig/ChildPeriodFields';
import {WeekdayPicker} from '@/components/wig/WeekdayPicker';
import {AREAS, buildAreaMeta, areaLabel, type Area} from '@/lib/areas';
import {FlashToast} from '@/components/ui/FlashToast';

type Wig = {
  id: string;
  title: string | null;   // 0051 — nullable cho các WIG tạo trước khi có cột này
  baseline: number | null; // 0051 — mốc X trong "Từ X lên Y"
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
  // 0073 — những thứ trong tuần mà việc này được tick (ISO 1=T2…7=CN).
  active_weekdays: number[] | null;
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
  const [{myClass, classes: accessible}, {data: areaCfg}] = await Promise.all([
    getClassContext(supabase, profile, classParam),
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
  // Kèm hai truy vấn cho khối "việc hằng ngày của học sinh": sĩ số đang học, và số em ĐÃ có WIG
  // cá nhân của tuần này. Gộp vào đây thay vì để component tự lấy → không thêm lượt chờ nào.
  const thisWeekLabel = isoWeekLabel(new Date());
  const [{data: wigsData}, {data: progData}, {data: enrolled}, {data: readyWigs}] = await Promise.all([
    // NHÚNG LUÔN lead_measures. Trước đây phải chờ câu này về mới biết id của các WIG tuần, rồi
    // mới hỏi lead_measures được — một vòng mạng xếp hàng thuần tuý ở giữa. PostgREST nhúng được
    // theo khoá ngoại wig_id, và RLS vẫn áp y như khi hỏi rời. Lead của WIG năm/tháng (nếu có)
    // theo về cùng, đổi lại là bỏ hẳn một chặng.
    supabase
      .from('wigs')
      .select(
        'id, title, baseline, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date, lead_measures(id, wig_id, title, target_value, unit, sub_category, active_weekdays)',
      )
      .eq('class_id', myClass.id)
      .eq('scope', 'class'),
    supabase
      .from('wig_progress_v')
      .select('wig_id, actual, pct, status')
      .eq('class_id', myClass.id)
      .eq('scope', 'class'),
    supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    supabase
      .from('wigs')
      .select('student_id')
      .eq('class_id', myClass.id)
      .eq('scope', 'student')
      .eq('period', 'week')
      .eq('period_label', thisWeekLabel),
  ]);
  const studentCount = (enrolled ?? []).length;
  const readyCount = new Set((readyWigs ?? []).map((w) => w.student_id)).size;
  const wigsKemLead = (wigsData ?? []) as unknown as (Wig & {lead_measures: Lead[] | null})[];
  const wigs = wigsKemLead as Wig[];
  const progByWig = new Map((progData ?? []).map((p) => [p.wig_id, p as unknown as Prog]));

  const yearWigs = wigs.filter((w) => w.period === 'year').sort((a, b) => a.area.localeCompare(b.area));
  // Con trực tiếp của 1 WIG theo cấp (năm→tháng→tuần). Tuần có thể nằm dưới năm HOẶC tháng.
  const childrenOf = (pid: string, period: 'month' | 'week') =>
    wigs
      .filter((w) => w.parent_wig_id === pid && w.period === period)
      .sort((a, b) => (a.period_label ?? '').localeCompare(b.period_label ?? ''));

  // Chỉ lấy lead của WIG TUẦN, đúng như câu `.in('wig_id', weekIds)` cũ — nay lọc trong bộ nhớ.
  const leads: Lead[] = wigsKemLead
    .filter((w) => w.period === 'week')
    .flatMap((w) => w.lead_measures ?? []);
  const leadsByWig = new Map<string, Lead[]>();
  for (const l of leads) {
    const arr = leadsByWig.get(l.wig_id) ?? [];
    arr.push(l);
    leadsByWig.set(l.wig_id, arr);
  }

  // Options lĩnh vực (đã dịch) truyền xuống form tạo WIG năm (client component).
  const areaOptions = AREAS.map((a) => ({value: a, label: areaLabel(areaMeta[a], locale)}));
  // Tính Ở SERVER rồi truyền xuống client component: nếu client tự gọi new Date() thì lúc
  // hydrate có thể lệch (qua nửa đêm / qua mốc tháng 6 của năm học) → cảnh báo hydration.
  // weekOptions(back=2) → chỉ số 2 là tuần hiện tại; monthOptions(back=1) → chỉ số 1.
  const weekOpts = weekOptions();
  const monthOpts = monthOptions();

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

  // Ô nhập và nút DÙNG CHUNG chiều cao ctl-h (44px) từ components/ui/Field.
  // Trước đây ba thứ này cao 40 / 38 / 31px vì mỗi cái tự chế padding riêng — đứng cùng một
  // hàng `items-center` là lệch, đúng lỗi người dùng báo. Chiều cao tường minh thì tự thẳng.
  const ghostBtn = btnGhost;
  const logBtn = btnGold;

  // Nhãn thứ (T2…CN) cho ô chọn ngày áp dụng của lead measure.
  const dayShort = t.raw('dayShort') as string[];

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
      <form action={editWig} className="flex flex-col gap-3">
        <input type="hidden" name="class_id" value={myClass.id} />
        <input type="hidden" name="wig_id" value={w.id} />

        <Field label={t('wigTitle')}>
          <input name="title" defaultValue={w.title ?? ''} placeholder={t('wigTitlePlaceholder')} className={inputCls} required />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
          <Field label={t('baseline')}>
            <input name="baseline" type="number" step="any" min="0" inputMode="decimal" defaultValue={w.baseline ?? ''} placeholder="0" className={inputCls} />
          </Field>
          <Field label={t('targetTo')}>
            <input name="target_value" type="number" step="any" min="0.01" inputMode="decimal" defaultValue={w.target_value} className={inputCls} required />
          </Field>
          <Field label={t('unit')} className="col-span-2 sm:col-span-1">
            <input name="unit" defaultValue={w.unit} placeholder={t('unitPlaceholder')} className={inputCls} required />
          </Field>
        </div>

        {/* Nhãn kỳ + hai ngày: trước đây ô nhãn rộng 160px trong khi placeholder của nó là
            "Nhãn kỳ (vd 2026, 2026-09, W38-2026)" — dài gấp ba lần chỗ chứa. Nay có nhãn thật
            bên ngoài nên ô không phải gánh việc giải thích chính nó. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label={t('label')} className="col-span-2 sm:col-span-1">
            <input name="period_label" defaultValue={w.period_label ?? ''} className={inputCls} />
          </Field>
          <Field label={t('startDate')}>
            <input name="start_date" type="date" defaultValue={w.start_date} className={inputCls} />
          </Field>
          <Field label={t('endDate')}>
            <input name="end_date" type="date" defaultValue={w.end_date} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href={backHref} className={ghostBtn}>{t('cancel')}</Link>
          <SubmitButton className={logBtn}>{t('save')}</SubmitButton>
        </div>
      </form>
    </section>
  );

  // Panel sửa lead measure — hiện khi ?editLead=<id>.
  const leadEditPanel = (l: Lead) => (
    <section className="glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60">
      <div className="mb-2.5 font-display text-[15px] font-bold text-navy">{t('editLead')}</div>
      <form action={editLeadMeasure} className="flex flex-col gap-3">
        <input type="hidden" name="class_id" value={myClass.id} />
        <input type="hidden" name="lead_measure_id" value={l.id} />
        <Field label={t('leadTitle')}>
          <input name="title" defaultValue={l.title} className={inputCls} required />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t('target')}>
            <input name="target_value" type="number" step="any" min="0.01" inputMode="decimal" defaultValue={l.target_value} className={inputCls} required />
          </Field>
          <Field label={t('unit')}>
            <input name="unit" defaultValue={l.unit ?? ''} placeholder={t('unitPlaceholder')} className={inputCls} />
          </Field>
          <Field label={t('subCat')} className="col-span-2 sm:col-span-1">
            <input name="sub_category" defaultValue={l.sub_category ?? ''} className={inputCls} />
          </Field>
        </div>
        <WeekdayPicker
          label={t('weekdays')}
          hint={t('weekdaysHint')}
          dayLabels={dayShort}
          selected={l.active_weekdays ?? undefined}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={backHref} className={ghostBtn}>{t('cancel')}</Link>
          <SubmitButton className={logBtn}>{t('save')}</SubmitButton>
        </div>
      </form>
    </section>
  );

  // Form tạo WIG con (tuần/tháng). allowMonth=true dưới WIG năm; false dưới WIG tháng.
  // Form tao WIG con (tuan/thang). allowMonth=true duoi WIG nam; false duoi WIG thang.
  //
  // Dung lai 2026-07-27: truoc day day la MOT hang flex nhet 5 dieu khien khong nhan, o muc tieu
  // rong 100px va o don vi 100px - khong du cho "buoi luyen noi" (don vi dai nhat dang dung
  // that). Nay xep thanh hang co nhan, va them o TEN + o TU de mot WIG tuan doc duoc thanh cau.
  const createChildForm = (parentId: string, area: string, unit: string, allowMonth: boolean) => (
    <form action={createWig} className="flex flex-col gap-3">
      <input type="hidden" name="class_id" value={myClass.id} />
      <input type="hidden" name="parent_wig_id" value={parentId} />
      <input type="hidden" name="area" value={area} />

      <Field label={t('wigTitle')} hint={t('wigTitleHint')}>
        <input name="title" placeholder={t('wigTitlePlaceholder')} className={inputCls} required />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
        <Field label={t('baseline')}>
          <input name="baseline" type="number" step="any" min="0" inputMode="decimal" placeholder="0" className={inputCls} />
        </Field>
        <Field label={t('targetTo')}>
          <input name="target_value" type="number" step="any" min="0.01" inputMode="decimal" className={inputCls} required />
        </Field>
        <Field label={t('unit')} className="col-span-2 sm:col-span-1">
          <input name="unit" placeholder={t('unitPlaceholder')} className={inputCls} defaultValue={unit} required />
        </Field>
      </div>

      <ChildPeriodFields
        weekOpts={weekOpts}
        monthOpts={monthOpts}
        weekDefault={2}
        monthDefault={1}
        allowMonth={allowMonth}
        weekLabel={t('week')}
        monthLabel={t('month')}
        currentTag={t('periodCurrent')}
        typeFieldLabel={t('periodType')}
        periodFieldLabel={t('periodWhich')}
      />

      {/* Nut rieng mot dong, canh phai - nhet chung hang voi o chon ky thi bi keo lech theo
          dong ghi chu ngay nam duoi o do. */}
      <div className="flex justify-end">
        <SubmitButton className={ghostBtn}>+ {t('createWeek')}</SubmitButton>
      </div>
    </form>
  );

  // Khối WIG tuần (bar + lead measures + thêm lead) — tái dùng dưới năm HOẶC tháng.
  const weekBlock = (ww: Wig) => {
    const wprog = progByWig.get(ww.id);
    const wleads = leadsByWig.get(ww.id) ?? [];
    return (
      <div key={ww.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
        {/* TÊN mục tiêu là dòng đầu, không phải "Tuần · Tuần 31".
            Trước đây khối này mở đầu bằng nhãn kỳ nên đọc xong vẫn không biết mục tiêu là gì —
            người dùng chỉ thấy "Tuần 31 — 0/5 lần" và phải tự đoán 5 lần đó là 5 lần nào. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-[14.5px] font-bold text-navy">
            {ww.title ?? t('week')}
          </span>
          <Link href={editHref({editWig: ww.id})} className={`${editLinkCls} ml-auto`}>
            {t('edit')}
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] font-semibold text-grey-mid">
          <span>
            {t('week')}
            {ww.period_label ? ` · ${ww.period_label}` : ''}
          </span>
          {/* "Từ X → Y" chỉ hiện khi có mốc xuất phát; WIG cũ chưa có thì bỏ qua, không hiện số 0
              giả để tránh nói sai là lớp bắt đầu từ con số không. */}
          {ww.baseline != null && (
            <span className="font-bold text-navy/70">
              · {t('from')} {Number(ww.baseline)} → {ww.target_value} {ww.unit}
            </span>
          )}
          <span className="ml-auto font-bold">
            {Number(wprog?.actual ?? 0)} / {ww.target_value} {ww.unit}
          </span>
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
              {/* Những thứ em được tick việc này. Ô "Ghi +" cũ ĐÃ BỎ (0073): con số của WIG lớp
                  nay do học sinh tick mà thành, giáo viên gõ tay thì bảng thắng/thua chỉ phản
                  chiếu lại chính tay người bấm. Xem ai đã tick ở bảng "Việc chung" đầu trang. */}
              <span className="ml-auto rounded-full bg-navy/[0.05] px-2 py-1 text-[10.5px] font-bold text-grey-mid">
                {(l.active_weekdays ?? [1, 2, 3, 4, 5, 6, 7])
                  .map((d) => dayShort[d - 1])
                  .join(' · ')}
              </span>
              <Link href={editHref({editLead: l.id})} className={editLinkCls}>
                {t('edit')}
              </Link>
              <form action={deleteLeadMeasure}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="lead_measure_id" value={l.id} />
                <ConfirmButton message={t('confirmDeleteLead')} label={t('deleteLead')} className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]">
                  ✕
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        {/* Thêm lead measure. Trước đây 4 ô + 1 nút chen trong một hàng flex, các ô rộng 96px
            và 112px trong khi nhãn của chúng là "Mục tiêu (số)" và "Nhóm (Kỹ năng)" — placeholder
            bị cắt cụt nên không đọc được ô nào là ô nào. Nay dùng lưới có nhãn thật. */}
        <form action={addLeadMeasure} className="mt-3 flex flex-col gap-3 border-t border-navy/[0.08] pt-3">
          <input type="hidden" name="class_id" value={myClass.id} />
          <input type="hidden" name="wig_id" value={ww.id} />
          <Field label={t('leadTitle')} hint={t('leadHint')}>
            <input name="title" className={inputCls} required />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t('target')}>
              <input name="target_value" type="number" step="any" min="0.01" inputMode="decimal" className={inputCls} required />
            </Field>
            <Field label={t('unit')}>
              <input name="unit" placeholder={t('unitPlaceholder')} className={inputCls} />
            </Field>
            <Field label={t('subCat')} className="col-span-2 sm:col-span-1">
              <input name="sub_category" className={inputCls} />
            </Field>
          </div>
          <WeekdayPicker label={t('weekdays')} hint={t('weekdaysHint')} dayLabels={dayShort} />
          <div className="flex justify-end">
            <SubmitButton className={ghostBtn}>+ {t('addLead')}</SubmitButton>
          </div>
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-[14.5px] font-bold text-navy">
            {mw.title ?? t('month')}
          </span>
          <Link href={editHref({editWig: mw.id})} className={`${editLinkCls} ml-auto`}>
            {t('edit')}
          </Link>
          <form action={deleteWig}>
            <input type="hidden" name="class_id" value={myClass.id} />
            <input type="hidden" name="wig_id" value={mw.id} />
            <ConfirmButton message={t('confirmDeleteWig')} label={t('deleteWig')} className={btnIconDanger}>
              ✕
            </ConfirmButton>
          </form>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] font-semibold text-grey-mid">
          <span>
            {t('month')}
            {mw.period_label ? ` · ${mw.period_label}` : ''}
          </span>
          {mw.baseline != null && (
            <span className="font-bold text-navy/70">
              · {t('from')} {Number(mw.baseline)} → {mw.target_value} {mw.unit}
            </span>
          )}
          <span className="ml-auto font-bold">
            {Number(mprog?.actual ?? 0)} / {mw.target_value} {mw.unit}
          </span>
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

      {flash && <FlashToast message={flash} />}

      {/* Panel sửa (WIG hoặc lead) — hiện khi có ?editWig / ?editLead */}
      {editingWig && wigEditPanel(editingWig)}
      {editingLead && leadEditPanel(editingLead)}

      {/* Họp WIG lớp — gộp từ trang /meeting cũ vào đây, đặt NGAY TRÊN (không chôn ở đáy trang)
          vì nhịp họp tuần là thứ GVCN dùng thường xuyên nhất trong 4DX. */}
      <ClassMeetingSection
        classId={myClass.id}
        weekLabel={isoWeekLabel(new Date())}
        canManage /* trang này đã requireRole(['teacher','admin']) nên ai vào được cũng quản lý được */
        classParam={classParam}
        tickLockDow={myClass.tick_lock_dow ?? 7}
      />

      {/* Việc chung của lớp: ai đã tick, đến đâu (0073). Đặt ngay dưới khối họp vì đây chính là
          con số quyết định thắng/thua tuần này — trước bản đó, số ấy do giáo viên tự gõ. */}
      <ClassTickBoard classId={myClass.id} />

      {/* Việc hằng ngày của HỌC SINH. Đặt ngay đây (không chôn trong trang từng em) vì thiếu nó
          thì màn hình của các em trống trơn — đúng lỗi cả ba người thử đều gặp. */}
      <ClassStudentWigSetup
        classId={myClass.id}
        weekLabel={thisWeekLabel}
        studentCount={studentCount}
        readyCount={readyCount}
      />

      <p className="text-xs font-semibold italic text-grey-mid">{t('leadHint')}</p>

      {/* Bước 1: Tạo WIG năm */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">1 · {t('createYear')}</div>
        <WigCreateForm classId={myClass.id} areas={areaOptions} periods={schoolYearOptions()} />
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
                {/* Dòng 1 = TÊN mục tiêu. Lĩnh vực và kỳ lùi xuống dòng phụ ngay bên dưới:
                    chúng là thuộc tính của mục tiêu, không phải tên của nó. */}
                <span className="font-display text-[16px] font-bold text-navy">
                  {yw.title ?? areaLabel(areaMeta[yw.area as Area], locale)}
                </span>
                <Link href={editHref({editWig: yw.id})} className={`${editLinkCls} ml-auto`}>
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
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] font-semibold text-grey-mid">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    background: areaMeta[yw.area as Area].soft,
                    color: areaMeta[yw.area as Area].hex,
                  }}
                >
                  {areaLabel(areaMeta[yw.area as Area], locale)}
                </span>
                <span>
                  {t('year')}
                  {yw.period_label ? ` · ${yw.period_label}` : ''}
                </span>
                {yw.baseline != null && (
                  <span className="font-bold text-navy/70">
                    · {t('from')} {Number(yw.baseline)} → {yw.target_value} {yw.unit}
                  </span>
                )}
                <span className="ml-auto text-[12.5px] font-bold">
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
