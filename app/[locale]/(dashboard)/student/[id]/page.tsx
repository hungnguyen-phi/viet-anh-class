import {setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/auth';
import {StudentScoreboard} from '@/components/student/StudentScoreboard';

// Scoreboard cá nhân của MỘT học sinh — cho GVCN/Admin/BGH xem từng em (từ roster).
// Học sinh chỉ được xem của chính mình; phụ huynh dùng /report (đã lọc).
export default async function StudentByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{flash?: string}>;
}) {
  const {locale, id} = await params;
  const {flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  if (profile.role === 'student' && profile.id !== id) redirect('/student');
  if (profile.role === 'parent') redirect('/report');
  // GVCN/Admin/BGH: RLS quyết định dữ liệu được thấy — ngoài phạm vi sẽ ra "không tìm thấy".
  return <StudentScoreboard studentId={id} viewer={profile} flash={flash} />;
}
