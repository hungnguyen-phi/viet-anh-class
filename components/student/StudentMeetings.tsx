import {getTranslations} from 'next-intl/server';
import {MessagesSquare, UserRound} from 'lucide-react';
import {saveStudentMeeting} from '@/app/[locale]/(dashboard)/student/actions';

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

  const inputCls =
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const taCls = `${inputCls} min-h-[60px] resize-y`;

  return (
    <div className="flex flex-col gap-3">
      {canManage && classId && (
        <form action={saveStudentMeeting} className="glass flex flex-col gap-3 rounded-[20px] p-5">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <p className="text-xs italic text-grey-mid">{t('meetingHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('week')}
              </span>
              <input name="week_label" defaultValue={defaultWeek} className={inputCls} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('buddy')}
              </span>
              <select name="buddy_id" defaultValue="" className={`${inputCls} cursor-pointer`}>
                <option value="">{t('noBuddy')}</option>
                {classmates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
              {t('reflection')}
            </span>
            <textarea name="results" className={taCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
              {t('commitments')}
            </span>
            <textarea name="commitments" className={taCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
              {t('nextActions')}
            </span>
            <textarea name="next_actions" className={taCls} />
          </label>
          <button
            type="submit"
            className="btn-gold h-10 cursor-pointer self-start rounded-xl px-[18px] font-display text-[13.5px] font-bold"
          >
            {t('saveMeeting')}
          </button>
        </form>
      )}

      {meetings.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/20 bg-white/30 p-5 text-center text-[12.5px] font-semibold italic text-grey-mid backdrop-blur-[24px]">
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
