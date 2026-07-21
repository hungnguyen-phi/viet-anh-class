import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
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
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-txt">{tc('noClass')}</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>
      <p className="text-xs italic text-grey-mid">{t('leaderHint')}</p>

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className="flex min-w-[560px] items-center gap-2 bg-white/40 px-[18px] py-[10px]">
          <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
            {t('name')}
          </span>
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
            {t('email')}
          </span>
          <span className="w-[200px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid">
            {t('attendanceLeader')}
          </span>
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.student_id}
            className="flex min-w-[560px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-white/35"
          >
            <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
            <span className="min-w-0 flex-1">
              {/* Mở scoreboard cá nhân của em (GVCN/Admin xem từng em) */}
              <Link
                href={`/student/${r.student_id}`}
                className="text-[13.5px] font-bold text-navy underline-offset-2 transition-colors hover:underline"
              >
                {r.profiles?.full_name ?? r.student_id}
              </Link>
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-grey-mid">
              {r.profiles?.email}
            </span>
            <span className="grid w-[200px] flex-none place-items-center">
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
                  className={`inline-flex h-8 cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-[10px] px-3 text-[11.5px] font-extrabold text-navy transition-all ${
                    r.is_attendance_leader
                      ? 'btn-gold border-[1.5px] border-transparent'
                      : 'border-[1.5px] border-navy/20 bg-white/65 hover:border-navy'
                  }`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    style={{
                      fill: r.is_attendance_leader ? '#26275d' : 'transparent',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {r.is_attendance_leader ? t('attendanceLeader') : t('makeLeader')}
                </button>
              </form>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
