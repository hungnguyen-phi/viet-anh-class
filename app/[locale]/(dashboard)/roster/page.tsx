import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassCoverUpload} from '@/components/shell/ClassCoverUpload';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {ClassMoodBoard} from '@/components/student/ClassMoodBoard';
import {EnrollForm} from './EnrollForm';
import {setAttendanceLeader, removeStudent} from './actions';

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
  searchParams: Promise<{class?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  // BGH chỉ XEM (danh sách + mở từng em); GVCN/Admin mới quản lý (ghi danh, tổ trưởng, xoá).
  const canManage = profile.role === 'teacher' || profile.role === 'admin';
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

  const [{data: enrolls}, {data: todayVal}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, is_attendance_leader, profiles!enrollments_student_id_fkey(full_name, email)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    supabase.rpc('app_today'),
  ]);
  const today = String(todayVal);

  const rows = ((enrolls ?? []) as unknown as EnrRow[]).sort((a, b) =>
    (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'vi'),
  );
  const moodStudents = rows.map((r) => ({id: r.student_id, name: r.profiles?.full_name ?? r.student_id}));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        <div className="flex items-center gap-2">
          {canManage && <ClassCoverUpload classId={myClass.id} />}
          {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
        </div>
      </div>

      {flash && (
        <div className="rounded-[12px] border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      {/* Ghi danh / chuyển lớp: nhập email học sinh (đã có tài khoản) — chỉ GVCN/Admin */}
      {canManage && (
        <>
          <EnrollForm classId={myClass.id} />
          <p className="text-xs italic text-grey-mid">{t('leaderHint')}</p>
        </>
      )}

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className="flex min-w-[640px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
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
          <span className="w-[70px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid" />
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.student_id}
            className="flex min-w-[640px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
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
              {canManage ? (
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
                        : 'border-[1.5px] border-navy/20 bg-navy/[0.02] hover:border-navy'
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
              ) : r.is_attendance_leader ? (
                <span className="inline-flex h-8 items-center gap-[5px] rounded-[10px] bg-gold/15 px-3 text-[11.5px] font-extrabold text-navy">
                  ★ {t('attendanceLeader')}
                </span>
              ) : (
                <span className="text-[11px] text-grey-soft">—</span>
              )}
            </span>
            <span className="grid w-[70px] flex-none place-items-center">
              {canManage && (
                <form action={removeStudent}>
                  <input type="hidden" name="classId" value={myClass.id} />
                  <input type="hidden" name="studentId" value={r.student_id} />
                  <ConfirmButton
                    message={t('confirmRemove', {name: r.profiles?.full_name ?? r.student_id})}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                  >
                    ✕
                  </ConfirmButton>
                </form>
              )}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
            {t('noStudents')}
          </div>
        )}
      </div>

      {/* Tổng hợp cảm xúc lớp 7 ngày — cảnh báo sớm tâm lý cho GVCN */}
      {moodStudents.length > 0 && (
        <ClassMoodBoard classId={myClass.id} today={today} students={moodStudents} />
      )}
    </div>
  );
}
