import {setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {AppNav} from '@/components/shell/AppNav';
import {IntroGuide} from '@/components/shell/IntroGuide';

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

  const supabase = await createClient();

  // Học sinh chỉ thấy link "Điểm danh" nếu là tổ trưởng điểm danh (PRD §6.2 màn 3).
  let isAttendanceLeader = false;
  if (profile.role === 'student') {
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

  // Số thông báo chưa đọc cho badge trên chuông. head:true → chỉ lấy count, không tải hàng.
  // RLS notif_own_read đã giới hạn user_id = auth.uid().
  const {count: unreadCount} = await supabase
    .from('notifications')
    .select('id', {count: 'exact', head: true})
    .eq('read', false);

  return (
    <div className="min-h-screen">
      <AppNav
        profile={profile}
        isAttendanceLeader={isAttendanceLeader}
        unreadCount={unreadCount ?? 0}
      />
      {/* Nội dung căn giữa dưới top-nav; nền gradient nằm ở <body>. */}
      <main className="mx-auto max-w-[1160px] px-4 pb-10 pt-2 sm:px-6">{children}</main>
      {/* Hướng dẫn onboarding — tự hiện lần đầu, mở lại từ nút Hướng dẫn trên nav. */}
      <IntroGuide userId={profile.id} role={profile.role} introSeen={profile.intro_seen} />
    </div>
  );
}
