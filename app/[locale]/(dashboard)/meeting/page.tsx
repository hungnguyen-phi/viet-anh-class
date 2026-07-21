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
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm font-semibold text-grey-mid">{tc('noClass')}</p>
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

  const fieldLabelCls =
    'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
  const inputCls =
    'rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const taCls = `${inputCls} w-full min-h-[64px] resize-y`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {flash && (
        <div className="rounded-[14px] border border-success/25 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      <section className="glass rounded-[20px] p-[18px]">
        <form action={saveMeeting} className="flex flex-col gap-3">
          <input type="hidden" name="class_id" value={myClass.id} />
          <div>
            <span className={fieldLabelCls}>{t('week')}</span>
            <input
              name="week_label"
              defaultValue={defaultWeek}
              required
              className={`${inputCls} w-[200px] max-w-full`}
            />
          </div>
          <div>
            <span className={fieldLabelCls}>{t('reflection')}</span>
            <textarea name="results" className={taCls} />
          </div>
          <div>
            <span className={fieldLabelCls}>{t('commitments')}</span>
            <textarea name="commitments" className={taCls} />
          </div>
          <div>
            <span className={fieldLabelCls}>{t('nextActions')}</span>
            <textarea name="next_actions" className={taCls} />
          </div>
          <button
            type="submit"
            className="btn-gold h-10 cursor-pointer self-start rounded-[12px] px-[18px] font-display text-sm font-bold"
          >
            {t('save')}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2.5 font-display text-[15px] font-bold text-navy">{t('history')}</h2>
        {meetings.length === 0 ? (
          <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/20 bg-white/30 p-5 text-center text-[12.5px] font-semibold italic text-grey-mid backdrop-blur-md">
            {t('noMeetings')}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {meetings.map((m) => (
              <div key={m.id} className="glass rounded-[20px] px-[18px] py-4">
                <div className="font-display text-[15px] font-bold text-navy">{m.week_label}</div>
                {m.results && (
                  <p className="mt-1.5 text-[13px] font-semibold text-navy">
                    <span className="font-bold text-grey-mid">{t('reflection')}: </span>
                    {m.results}
                  </p>
                )}
                {m.commitments && (
                  <p className="mt-1 text-[13px] font-semibold text-navy">
                    <span className="font-bold text-grey-mid">{t('commitments')}: </span>
                    {m.commitments}
                  </p>
                )}
                {m.next_actions && (
                  <p className="mt-1 text-[13px] font-semibold text-navy">
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
