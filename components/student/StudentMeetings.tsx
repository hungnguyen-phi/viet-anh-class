import {getTranslations} from 'next-intl/server';
import {MessagesSquare, UserRound} from 'lucide-react';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {deleteStudentMeeting} from '@/app/[locale]/(dashboard)/student/actions';
import {StudentMeetingForm} from './StudentMeetingForm';

export type StudentMeeting = {
  id: string;
  week_label: string;
  results: string | null;
  commitments: string | null;
  next_actions: string | null;
  buddy_name: string | null;
  created_at: string;
};
export type Classmate = {id: string; name: string};

export async function StudentMeetings({
  studentId,
  classId,
  meetings,
  classmates,
  canManage,
  defaultWeek,
}: {
  studentId: string;
  classId: string | null;
  meetings: StudentMeeting[];
  classmates: Classmate[];
  canManage: boolean;
  defaultWeek: string;
}) {
  const t = await getTranslations('student');

  return (
    <div className="flex flex-col gap-3">
      {canManage && classId && (
        <StudentMeetingForm
          studentId={studentId}
          classId={classId}
          defaultWeek={defaultWeek}
          classmates={classmates}
        />
      )}

      {meetings.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/15 bg-navy/[0.02] p-5 text-center text-[12.5px] font-semibold italic text-grey-mid">
          {t('noMeetings')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetings.map((m) => (
            <div key={m.id} className="glass rounded-[20px] p-[18px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 font-display text-xs font-bold text-white">
                  <MessagesSquare size={12} strokeWidth={2.5} />
                  {m.week_label}
                </span>
                {m.buddy_name && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-navy">
                    <UserRound size={12} strokeWidth={2.5} />
                    {t('buddy')}: {m.buddy_name}
                  </span>
                )}
                {canManage && (
                  <form action={deleteStudentMeeting} className="ml-auto">
                    <input type="hidden" name="student_id" value={studentId} />
                    <input type="hidden" name="meeting_id" value={m.id} />
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
                <div className="mt-3 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('reflection')}: </b>
                  <span className="whitespace-pre-line">{m.results}</span>
                </div>
              )}
              {m.commitments && (
                <div className="mt-1.5 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('commitments')}: </b>
                  <span className="whitespace-pre-line">{m.commitments}</span>
                </div>
              )}
              {m.next_actions && (
                <div className="mt-1.5 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('nextActions')}: </b>
                  <span className="whitespace-pre-line">{m.next_actions}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
