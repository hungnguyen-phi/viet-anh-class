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
  flash,
}: {
  studentId: string;
  classId: string | null;
  meetings: StudentMeeting[];
  classmates: Classmate[];
  canManage: boolean;
  defaultWeek: string;
  flash?: string;
}) {
  const t = await getTranslations('student');

  const inputCls =
    'w-full rounded-lg border border-grey-line bg-grey-light/50 px-3 py-2 text-sm text-ink outline-none transition-all focus:border-navy focus:bg-white';
  const taCls = `${inputCls} min-h-[64px] resize-y`;

  return (
    <div className="space-y-4">
      {flash && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      {canManage && classId && (
        <form action={saveStudentMeeting} className="card space-y-4 p-6">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <p className="text-xs italic text-grey-mid">{t('meetingHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                {t('week')}
              </label>
              <input name="week_label" defaultValue={defaultWeek} className={inputCls} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                {t('buddy')}
              </label>
              <select name="buddy_id" defaultValue="" className={`${inputCls} cursor-pointer`}>
                <option value="">{t('noBuddy')}</option>
                {classmates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-grey-mid">
              {t('reflection')}
            </label>
            <textarea name="results" className={taCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-grey-mid">
              {t('commitments')}
            </label>
            <textarea name="commitments" className={taCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-grey-mid">
              {t('nextActions')}
            </label>
            <textarea name="next_actions" className={taCls} />
          </div>
          <button
            type="submit"
            className="cursor-pointer rounded-xl bg-navy px-5 py-2.5 font-heading font-bold text-white shadow-[0_10px_24px_-10px_rgba(38,39,93,0.55)] transition-all hover:bg-navy-700 active:scale-[0.99]"
          >
            {t('saveMeeting')}
          </button>
        </form>
      )}

      {meetings.length === 0 ? (
        <p className="text-xs italic text-grey-mid">{t('noMeetings')}</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 font-heading text-xs font-black text-white">
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
                <div className="mt-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                    {t('reflection')}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {m.results}
                  </p>
                </div>
              )}
              {m.commitments && (
                <div className="mt-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                    {t('commitments')}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {m.commitments}
                  </p>
                </div>
              )}
              {m.next_actions && (
                <div className="mt-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-grey-mid">
                    {t('nextActions')}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {m.next_actions}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
