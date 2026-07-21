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
  searchParams: Promise<{flash?: string}>;
}) {
  const {locale} = await params;
  const {flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  if (profile.role !== 'student') redirect(homeRouteForRole(profile.role));
  return <StudentScoreboard studentId={profile.id} viewer={profile} flash={flash} />;
}
