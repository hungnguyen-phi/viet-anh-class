import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {setAttendanceLeader} from './actions';

type EnrRow = {
  student_id: string;
  is_attendance_leader: boolean;
  profiles: {full_name: string | null; email: string} | null;
};

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('roster');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  const myClass = await getMyClass(supabase, profile, classParam);
  const accessible = await getAccessibleClasses(supabase, profile);

  if (!myClass) {
    return (
      <div className="rounded-xl border border-grey-line bg-white p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  const {data: enrolls} = await supabase
    .from('enrollments')
    .select('student_id, is_attendance_leader, profiles!enrollments_student_id_fkey(full_name, email)')
    .eq('class_id', myClass.id)
    .eq('is_active', true);

  const rows = ((enrolls ?? []) as unknown as EnrRow[]).sort((a, b) =>
    (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'vi'),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-black text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>
      <p className="text-xs italic text-grey-mid">{t('leaderHint')}</p>

      <div className="overflow-x-auto rounded-xl border border-grey-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-light text-navy">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">{t('name')}</th>
              <th className="px-3 py-2 text-left">{t('email')}</th>
              <th className="px-3 py-2 text-center">{t('attendanceLeader')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.student_id} className="border-t border-grey-line">
                <td className="px-3 py-2 text-grey-mid">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-ink">
                  {r.profiles?.full_name ?? r.student_id}
                </td>
                <td className="px-3 py-2 text-grey-mid">{r.profiles?.email}</td>
                <td className="px-3 py-2 text-center">
                  <form action={setAttendanceLeader}>
                    <input type="hidden" name="classId" value={myClass.id} />
                    <input type="hidden" name="studentId" value={r.student_id} />
                    <input
                      type="hidden"
                      name="value"
                      value={(!r.is_attendance_leader).toString()}
                    />
                    <button
                      type="submit"
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        r.is_attendance_leader
                          ? 'bg-gold text-navy'
                          : 'border border-grey-line text-grey-mid hover:border-navy'
                      }`}
                    >
                      {r.is_attendance_leader ? '★ ' + t('attendanceLeader') : t('makeLeader')}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
