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
      <div className="glass rounded-[20px] p-8 text-center">
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[22px] font-bold text-navy">
            {t('title')} · {myClass.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-txt">
            <CalendarDays size={14} strokeWidth={2.2} className="text-grey-mid" />
            {t('todayLabel')}: <b className="text-navy">{today}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-txt">
            <Users size={14} strokeWidth={2.2} className="text-grey-mid" />
            {t('sizeLabel')}: <b className="text-navy">{students.length}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-status-bad"
            style={{backgroundColor: 'rgba(192,57,43,0.12)'}}
          >
            <Lock size={12} strokeWidth={2.5} />
            {t('lockedPast')}
          </span>
        </div>
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
