import {setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {TopBar} from '@/components/shell/TopBar';
import {NavRow} from '@/components/shell/NavRow';

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

  return (
    <div className="min-h-screen bg-grey-light">
      <TopBar profile={profile} />
      <NavRow role={profile.role} />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
