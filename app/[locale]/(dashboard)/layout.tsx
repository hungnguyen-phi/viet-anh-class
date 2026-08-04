import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {AppNav} from '@/components/shell/AppNav';
import {IntroGuide} from '@/components/shell/IntroGuide';
import {getInboxUnreadCount} from '@/components/inbox/unread';

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
  const tc = await getTranslations('common');

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

  // Tin nhắn phụ huynh↔giáo viên chưa đọc — badge trên icon phong bì.
  //
  // Chỉ hai vai này mới có kênh đó (migration 0065 chặn admin/hiệu trưởng đọc nội dung), nên các
  // vai khác không tốn vòng mạng nào — layout này chạy trên MỌI trang sau đăng nhập.
  const msgPromise =
    profile.role === 'teacher' || profile.role === 'parent'
      ? getInboxUnreadCount(supabase)
      : Promise.resolve(0);

  const [isAttendanceLeader, unreadCount, unreadMessages] = await Promise.all([
    leaderPromise,
    unreadPromise,
    msgPromise,
  ]);

  return (
    <div className="min-h-screen">
      {/* ĐƯỜNG TẮT XUỐNG NỘI DUNG (WCAG 2.4.1).
          Thanh nav của giáo viên chủ nhiệm có 8 tab cộng chuông, phong bì và menu cài đặt. Người
          dùng bàn phím — và người dùng trình đọc màn hình — phải đi qua toàn bộ chừng ấy ở MỌI
          trang trước khi chạm được vào nội dung. Liên kết này ẩn cho tới khi nhận focus, nên
          không đổi gì về mặt hình ảnh.
          Kiểu `.skip-link` viết bằng CSS thường trong globals.css — ở đó có ghi vì sao không
          dùng utility của Tailwind cho chỗ này. */}
      <a
        href="#noi-dung"
        className="skip-link rounded-[10px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white"
      >
        {tc('skipToContent')}
      </a>
      <AppNav
        profile={profile}
        isAttendanceLeader={isAttendanceLeader}
        unreadCount={unreadCount ?? 0}
        unreadMessages={unreadMessages}
      />
      {/* Nội dung căn giữa dưới top-nav; nền gradient nằm ở <body>. */}
      <main id="noi-dung" className="mx-auto max-w-[1160px] px-4 pb-10 pt-2 sm:px-6">
        {children}
      </main>
      {/* Hướng dẫn onboarding — tự hiện lần đầu, mở lại từ nút Hướng dẫn trên nav. */}
      <IntroGuide userId={profile.id} role={profile.role} introSeen={profile.intro_seen} />
    </div>
  );
}
