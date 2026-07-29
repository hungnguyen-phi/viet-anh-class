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

  const supabase = await createClient();

  // Đếm thông báo chưa đọc KHÔNG cần biết người dùng là ai (RLS notif_own_read đã tự giới hạn
  // user_id = auth.uid()) → phóng đi NGAY, chạy chồng lên lượt lấy hồ sơ bên dưới thay vì xếp
  // hàng sau nó. Layout này nằm trên MỌI trang sau đăng nhập nên mỗi vòng mạng cắt được ở đây
  // là cắt trên toàn app.
  //
  // Phải gọi .then() mới thật sự bắn request: builder của supabase-js là "thenable" LƯỜI —
  // chỉ dựng câu query mà chưa gửi đi cho tới khi có ai đó await/then nó. Nhánh lỗi trả về
  // count rỗng để một sự cố mạng ở cái chuông không làm sập cả layout.
  const unreadPromise = supabase
    .from('notifications')
    .select('id', {count: 'exact', head: true})
    .eq('read', false)
    .then(
      (r) => r.count,
      () => null,
    );

  // Bắt buộc đã đăng nhập + đã được cấp quyền (không 'pending').
  const profile = await requireProfile();

  // Học sinh chỉ thấy link "Điểm danh" nếu là tổ trưởng điểm danh (PRD §6.2 màn 3).
  // Chỉ học sinh mới tốn query này; các vai khác không mất vòng mạng nào.
  const leaderPromise =
    profile.role === 'student'
      ? supabase
          .from('enrollments')
          .select('is_attendance_leader')
          .eq('student_id', profile.id)
          .eq('is_active', true)
          .eq('is_attendance_leader', true)
          .limit(1)
          .maybeSingle()
          .then(
            (r) => Boolean(r.data),
            () => false,
          )
      : Promise.resolve(false);

  const [isAttendanceLeader, unreadCount] = await Promise.all([leaderPromise, unreadPromise]);

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
