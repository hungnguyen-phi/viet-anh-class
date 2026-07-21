import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {isoWeekLabel} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {saveMeeting} from './actions';

type Meeting = {
  id: string;
  week_label: string;
  results: string | null;
  commitments: string | null;
  next_actions: string | null;
  created_at: string;
};

export default async function MeetingPage({
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
  const t = await getTranslations('meeting');
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

  const {data: meetingsData} = await supabase
    .from('wig_meetings')
    .select('id, week_label, results, commitments, next_actions, created_at')
    .eq('class_id', myClass.id)
    .is('student_id', null)
    .order('created_at', {ascending: false});
  const meetings = (meetingsData ?? []) as Meeting[];
  const defaultWeek = isoWeekLabel(new Date());

  const inputCls = 'w-full rounded-md border border-grey-line bg-white px-2 py-1.5 text-sm';
  const taCls = `${inputCls} min-h-[60px]`;

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

      <section className="rounded-xl border border-grey-line bg-white p-4">
        <form action={saveMeeting} className="space-y-3">
          <input type="hidden" name="class_id" value={myClass.id} />
          <div>
            <label className="text-xs font-bold uppercase text-grey-mid">{t('week')}</label>
            <input name="week_label" defaultValue={defaultWeek} className={inputCls} required />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-grey-mid">{t('reflection')}</label>
            <textarea name="results" className={taCls} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-grey-mid">{t('commitments')}</label>
            <textarea name="commitments" className={taCls} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-grey-mid">{t('nextActions')}</label>
            <textarea name="next_actions" className={taCls} />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-navy px-5 py-2 font-heading font-bold text-white hover:bg-navy-dark"
          >
            {t('save')}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-sm font-extrabold uppercase tracking-wide text-navy">
          {t('history')}
        </h2>
        {meetings.length === 0 ? (
          <p className="text-sm italic text-grey-mid">{t('noMeetings')}</p>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="rounded-xl border border-grey-line bg-white p-4">
                <div className="font-heading font-extrabold text-navy">{m.week_label}</div>
                {m.results && (
                  <p className="mt-2 text-sm">
                    <span className="font-bold text-grey-mid">{t('reflection')}: </span>
                    {m.results}
                  </p>
                )}
                {m.commitments && (
                  <p className="mt-1 text-sm">
                    <span className="font-bold text-grey-mid">{t('commitments')}: </span>
                    {m.commitments}
                  </p>
                )}
                {m.next_actions && (
                  <p className="mt-1 text-sm">
                    <span className="font-bold text-grey-mid">{t('nextActions')}: </span>
                    {m.next_actions}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
