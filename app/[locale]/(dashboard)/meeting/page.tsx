import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {isoWeekLabel} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {MeetingForm} from './MeetingForm';
import {deleteMeeting} from './actions';

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
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  // BGH chỉ XEM biên bản + panel; GVCN/Admin mới ghi/sửa/xoá.
  const canManage = profile.role === 'teacher' || profile.role === 'admin';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {/* PRD Màn 5: "cầm scoreboard mà họp" — WIG tuần/lead của lớp tuần này */}
      <MeetingScoreboard classId={myClass.id} weekLabel={defaultWeek} />

      {canManage && (
        <section className="glass rounded-[20px] p-[18px]">
          <MeetingForm classId={myClass.id} defaultWeek={defaultWeek} />
        </section>
      )}

      <section>
        <h2 className="mb-2.5 font-display text-[15px] font-bold text-navy">{t('history')}</h2>
        {meetings.length === 0 ? (
          <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/15 bg-navy/[0.02] p-5 text-center text-[12.5px] font-semibold italic text-grey-mid">
            {t('noMeetings')}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {meetings.map((m) => (
              <div key={m.id} className="glass rounded-[20px] px-[18px] py-4">
                <div className="flex items-center gap-2">
                  <div className="font-display text-[15px] font-bold text-navy">{m.week_label}</div>
                  {canManage && (
                    <form action={deleteMeeting} className="ml-auto">
                      <input type="hidden" name="id" value={m.id} />
                      {classParam && <input type="hidden" name="class" value={classParam} />}
                      <ConfirmButton
                        message={t('confirmDeleteMeeting')}
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                      >
                        ✕
                      </ConfirmButton>
                    </form>
                  )}
                </div>
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
