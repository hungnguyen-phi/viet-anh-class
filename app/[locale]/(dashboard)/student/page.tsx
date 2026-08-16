import {setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile, homeRouteForRole} from '@/lib/auth';
import {StudentScoreboard} from '@/components/student/StudentScoreboard';

// Scoreboard cá nhân của CHÍNH học sinh đang đăng nhập (PRD §6.2 màn 4).
export default async function MyScoreboardPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{flash?: string; week?: string}>;
}) {
  const {locale} = await params;
  const {flash, week} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  if (profile.role !== 'student') redirect(homeRouteForRole(profile.role));
  return (
    <div className="space-y-4">
      {/* Thẻ "Thực đơn hôm nay" từng nằm ngay đây. Chuyển thành MỘT MỤC RIÊNG trên thanh điều
          hướng (13/08/2026): trang này là chỗ em vào mỗi ngày để tick việc, mà cái thẻ ấy chiếm
          một khối trọn vẹn để nói "nhà trường chưa cập nhật thực đơn" — phần lớn thời gian nó là
          một ô trống nằm giữa đường. Thực đơn vẫn quan trọng, chỉ là nó không thuộc về đây; nó
          xứng đáng một chỗ riêng để em bấm vào khi muốn xem, kể cả xem cả tuần.
          Trang /report của phụ huynh giữ nguyên thẻ ấy — chủ dự án chỉ nói về trang học sinh. */}
      <StudentScoreboard studentId={profile.id} viewer={profile} flash={flash} weekParam={week} pathname="/student" />
    </div>
  );
}
