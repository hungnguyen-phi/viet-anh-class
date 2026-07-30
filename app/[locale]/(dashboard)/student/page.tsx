import {setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile, homeRouteForRole} from '@/lib/auth';
import {StudentScoreboard} from '@/components/student/StudentScoreboard';
import {TodayMenuCard} from '@/components/menu/TodayMenuCard';

// Scoreboard cá nhân của CHÍNH học sinh đang đăng nhập (PRD §6.2 màn 4).
export default async function MyScoreboardPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{flash?: string}>;
}) {
  const {locale} = await params;
  const {flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  if (profile.role !== 'student') redirect(homeRouteForRole(profile.role));
  return (
    <div className="space-y-4">
      <StudentScoreboard studentId={profile.id} viewer={profile} flash={flash} />
      {/* Thực đơn hôm nay — ban giám hiệu xin cho phụ huynh, nhưng chính học sinh mới là người
          quan tâm "trưa nay ăn gì". Thẻ tự suy ra cơ sở của em, không cần truyền gì. */}
      <TodayMenuCard />
    </div>
  );
}
