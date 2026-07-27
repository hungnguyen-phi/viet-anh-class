import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassCoverUpload} from '@/components/shell/ClassCoverUpload';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {AttendanceLeaderPicker} from '@/components/roster/AttendanceLeaderPicker';
import {EnrollForm} from './EnrollForm';
import {removeStudent} from './actions';

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

  const {data: enrolls} = await supabase
    .from('enrollments')
    .select('student_id, is_attendance_leader, profiles!enrollments_student_id_fkey(full_name, email)')
    .eq('class_id', myClass.id)
    .eq('is_active', true);

  const rows = ((enrolls ?? []) as unknown as EnrRow[]).sort((a, b) =>
    (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'vi'),
  );
  const leaderId = rows.find((r) => r.is_attendance_leader)?.student_id ?? null;
  const candidates = rows.map((r) => ({
    id: r.student_id,
    name: r.profiles?.full_name ?? r.student_id,
    email: r.profiles?.email ?? null,
  }));

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
          {/* Tổ trưởng điểm danh gom về MỘT chỗ (trước đây mỗi dòng một nút) */}
          <AttendanceLeaderPicker
            classId={myClass.id}
            students={candidates}
            currentLeaderId={leaderId}
          />
        </>
      )}

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className="flex min-w-[520px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
          <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
            {t('name')}
          </span>
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
            {t('email')}
          </span>
          <span className="w-[70px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid" />
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.student_id}
            className="flex min-w-[520px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
          >
            <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {/* Mở scoreboard cá nhân của em (GVCN/Admin xem từng em) */}
              <Link
                href={`/student/${r.student_id}`}
                className="truncate text-[13.5px] font-bold text-navy underline-offset-2 transition-colors hover:underline"
              >
                {r.profiles?.full_name ?? r.student_id}
              </Link>
              {/* Chỉ là nhãn: đổi tổ trưởng làm ở khối phía trên, không còn nút trên từng dòng */}
              {r.is_attendance_leader && (
                <span
                  title={t('attendanceLeader')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
                >
                  ★ {t('attendanceLeader')}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-grey-mid">
              {r.profiles?.email}
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

      {/* Bảng cảm xúc 7 ngày ĐÃ DỜI sang trang Điểm danh: check-in cảm xúc CHÍNH LÀ điểm danh
          (student_checkin ghi cả mood_checkins lẫn attendance_records), nên đặt cạnh nhau mới
          đọc được cùng lúc. */}
    </div>
  );
}
