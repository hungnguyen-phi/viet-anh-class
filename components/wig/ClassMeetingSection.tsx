import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {MeetingForm} from '@/app/[locale]/(dashboard)/meeting/MeetingForm';
import {deleteMeeting} from '@/app/[locale]/(dashboard)/meeting/actions';

type Meeting = {
  id: string;
  week_label: string;
  results: string | null;
  commitments: string | null;
  next_actions: string | null;
  created_at: string;
};

// Họp WIG của LỚP — trước đây là một trang riêng /meeting (một tab riêng trên thanh nav).
// Nay nhúng vào /wig để WIG và nhịp họp nằm cùng chỗ, không phải nhảy trang; /meeting giữ lại
// dưới dạng redirect cho link cũ.
export async function ClassMeetingSection({
  classId,
  weekLabel,
  canManage,
  classParam,
}: {
  classId: string;
  weekLabel: string;
  canManage: boolean;
  classParam?: string;
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  const {data} = await supabase
    .from('wig_meetings')
    .select('id, week_label, results, commitments, next_actions, created_at')
    .eq('class_id', classId)
    .is('student_id', null)
    .order('created_at', {ascending: false});
  const meetings = (data ?? []) as Meeting[];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[15px] font-bold text-navy">{t('title')}</h2>

      {/* PRD Màn 5: "cầm scoreboard mà họp" — WIG tuần/lead của lớp tuần này */}
      <MeetingScoreboard classId={classId} weekLabel={weekLabel} />

      {canManage && (
        <div className="glass rounded-[20px] p-[18px]">
          <MeetingForm classId={classId} defaultWeek={weekLabel} />
        </div>
      )}

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
  );
}
