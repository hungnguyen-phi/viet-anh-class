import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile, getUserId} from '@/lib/auth';
import {signOut} from '@/lib/auth-actions';
import {PARENT_PORTAL} from '@/lib/flags';
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

  // ── VỎ TRANG: MỘT ĐỢT, KHÔNG PHẢI HAI (audit tốc độ 10/08/2026) ─────────────────────────
  //
  // Layout này chạy trên MỌI trang sau đăng nhập, nên mỗi TẦNG CHỜ cắt được ở đây là cắt trên
  // toàn app. Bản cũ có hai tầng: đợt 1 (chuông + hồ sơ) rồi mới tới đợt 2 (cờ tổ trưởng HOẶC
  // đếm tin nhắn), vì hai câu sau bị chặn sau `await requireProfile()` để đọc `profile.role`.
  //
  // Nhưng cả hai câu ấy KHÔNG cần hàng `profiles` — chúng chỉ cần biết mình là ai, mà điều đó đã
  // nằm sẵn trong JWT: getClaims() verify cục bộ bằng khoá ES256, KHÔNG tốn vòng mạng nào (đo
  // được: 1 lượt tải khoá công khai cho cả tiến trình, 0 lượt gọi /auth/v1/user). Nên vai trò chỉ
  // còn là cái cổng "có nên hỏi không", và cái cổng ấy đang bắt cả trang xếp hàng thêm một vòng.
  //
  // Nay hỏi cả bốn thứ cùng lúc. Hai câu thừa cho vài vai (học sinh vẫn hỏi số tin nhắn, giáo
  // viên vẫn hỏi cờ tổ trưởng) là cái giá rẻ: chúng chạy SONG SONG trên cùng bộ kết nối đã ấm,
  // tốn thêm ~0ms thời gian chờ và dưới 2ms ở CSDL, đổi lấy việc bỏ hẳn một tầng đi-về cho mọi
  // trang, mọi vai. RLS vẫn là thứ quyết định: câu nào không phải phận sự thì trả về rỗng.
  const uid = await getUserId();

  // Nhánh lỗi trả rỗng để một sự cố mạng ở cái chuông không làm sập cả layout.
  const unreadPromise = supabase
    .from('notifications')
    .select('id', {count: 'exact', head: true})
    .eq('read', false)
    .then(
      (r) => r.count,
      () => null,
    );

  // Học sinh chỉ thấy link "Điểm danh" nếu là tổ trưởng điểm danh (PRD §6.2 màn 3).
  const leaderPromise = uid
    ? supabase
        .from('enrollments')
        .select('is_attendance_leader')
        .eq('student_id', uid)
        .eq('is_active', true)
        .eq('is_attendance_leader', true)
        .limit(1)
        .maybeSingle()
        .then(
          (r) => Boolean(r.data),
          () => false,
        )
    : Promise.resolve(false);

  // Tin nhắn phụ huynh↔giáo viên chưa đọc — badge trên icon phong bì. Hàm là SECURITY INVOKER,
  // tự lọc theo auth.uid(), nên vai không có kênh liên lạc chỉ nhận về số 0.
  const msgPromise = getInboxUnreadCount(supabase).catch(() => 0);

  // Bắt buộc đã đăng nhập + đã được cấp quyền (không 'pending'). Bọc react cache() nên các trang
  // gọi lại requireProfile()/requireRole() bên dưới KHÔNG đẻ thêm vòng mạng nào.
  const profilePromise = requireProfile();

  const [profile, isAttendanceLeader, unreadCount, unreadMessages] = await Promise.all([
    profilePromise,
    leaderPromise,
    unreadPromise,
    msgPromise,
  ]);

  // PRD v3 #10: Giai đoạn 1 CHƯA có phiên bản phụ huynh. Tài khoản phụ huynh còn lại (schema
  // giữ nguyên) thấy một lời hẹn thay vì báo cáo — bật lại bằng PARENT_PORTAL=true, không sửa mã.
  if (profile.role === 'parent' && !PARENT_PORTAL) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="glass flex max-w-[420px] flex-col items-center gap-4 rounded-[20px] p-6 text-center">
          <p className="text-noi-dung font-semibold leading-relaxed text-navy">{tc('parentPaused')}</p>
          {/* Không có nút này thì phụ huynh dùng chung máy với con bị kẹt (audit 04/09/2026). */}
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 text-than font-extrabold text-navy transition-colors hover:border-navy"
            >
              {tc('logout')}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
        className="skip-link rounded-[10px] bg-navy px-4 py-2.5 text-than font-extrabold text-white"
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
