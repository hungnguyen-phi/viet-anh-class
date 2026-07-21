import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {Lock, CalendarDays, Users} from 'lucide-react';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {todayInVN} from '@/lib/dates';
import {AttendanceTable} from '@/components/attendance/AttendanceTable';
import {ClassPicker} from '@/components/shell/ClassPicker';
import type {Database} from '@/lib/database.types';

type Status = Database['public']['Enums']['attendance_status'];
type EnrRow = {
  student_id: string;
  profiles: {id: string; full_name: string | null} | null;
};

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  const t = await getTranslations('attendance');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="rounded-xl border border-grey-line bg-white p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  // Học sinh chỉ vào được trang điểm danh KHI là tổ trưởng điểm danh (PRD §6.2 màn 3).
  // Học sinh thường → về trang cá nhân, không thấy dữ liệu cả lớp.
  if (profile.role === 'student') {
    const {data: myEnr} = await supabase
      .from('enrollments')
      .select('is_attendance_leader')
      .eq('class_id', myClass.id)
      .eq('student_id', profile.id)
      .maybeSingle();
    if (!myEnr?.is_attendance_leader) redirect('/student');
  }

  // Đợt 1 (song song): ngày hôm nay + danh sách lớp.
  const [{data: todayData}, {data: enrolls}] = await Promise.all([
    supabase.rpc('app_today'),
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
  ]);
  const today = (todayData as unknown as string) ?? todayInVN();

  const students = ((enrolls ?? []) as unknown as EnrRow[])
    .map((e) => ({id: e.student_id, name: e.profiles?.full_name ?? e.student_id}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // Đợt 2: bản ghi điểm danh phụ thuộc `today` nên phải chờ đợt 1.
  const {data: recs} = await supabase
    .from('attendance_records')
    .select('student_id, status')
    .eq('class_id', myClass.id)
    .eq('date', today);
  const initial: Record<string, Status> = {};
  (recs ?? []).forEach((r) => {
    initial[r.student_id] = r.status;
  });

  // Tới đây học sinh chắc chắn là tổ trưởng (đã guard ở trên) → được sửa hôm nay.
  const canEdit =
    profile.role === 'student' ||
    profile.role === 'teacher' ||
    profile.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-black text-navy">
          {t('title')} · {myClass.name}
        </h1>
        <div className="flex items-center gap-2">
          {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-status-bad/10 px-2.5 py-1 text-[11px] font-bold text-status-bad">
            <Lock size={12} strokeWidth={2.5} />
            {t('lockedPast')}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-txt">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={15} strokeWidth={2} className="text-navy" />
          {t('todayLabel')}: <span className="text-navy">{today}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} strokeWidth={2} className="text-navy" />
          {t('sizeLabel')}: <span className="text-navy">{students.length}</span>
        </span>
      </div>
      {!canEdit && (
        <p className="text-xs italic text-grey-mid">{t('readOnly')}</p>
      )}
      {canEdit && (
        <p className="text-xs italic text-grey-mid">{t('tickAllHint')}</p>
      )}
      <AttendanceTable
        classId={myClass.id}
        today={today}
        students={students}
        initial={initial}
        canEdit={canEdit}
      />
    </div>
  );
}
