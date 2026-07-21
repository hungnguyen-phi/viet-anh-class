import {setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {AppNav} from '@/components/shell/AppNav';

// Trang sau đăng nhập phụ thuộc session (cookie) → luôn render động, không cache tĩnh.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  // Bắt buộc đã đăng nhập + đã được cấp quyền (không 'pending').
  const profile = await requireProfile();

  // Học sinh chỉ thấy link "Điểm danh" nếu là tổ trưởng điểm danh (PRD §6.2 màn 3).
  let isAttendanceLeader = false;
  if (profile.role === 'student') {
    const supabase = await createClient();
    const {data} = await supabase
      .from('enrollments')
      .select('is_attendance_leader')
      .eq('student_id', profile.id)
      .eq('is_active', true)
      .eq('is_attendance_leader', true)
      .limit(1)
      .maybeSingle();
    isAttendanceLeader = Boolean(data);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppNav profile={profile} isAttendanceLeader={isAttendanceLeader} />
      {/* Vùng nội dung: lệch qua sidebar trên desktop, dùng trọn bề ngang còn lại. */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
