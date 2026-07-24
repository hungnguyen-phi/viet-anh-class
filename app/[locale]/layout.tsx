import type {Metadata} from 'next';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Baloo_2, Nunito} from 'next/font/google';
import {routing} from '@/i18n/routing';
import '../globals.css';

// Design system v3: Baloo 2 (display, bo tròn, có tiếng Việt) + Nunito (body).
// Thay Paytone One của prototype vì Paytone One không có subset tiếng Việt.
const baloo = Baloo_2({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-baloo',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Viet Anh Class',
  description: 'App lãnh đạo lớp học theo khung 4DX — Trường Việt Anh',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  // Truyền messages tường minh → prop được serialize kèm provider, client component
  // luôn có context dù render server fallback (tránh lỗi "NextIntlClientProvider not found").
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${baloo.variable} ${nunito.variable}`}>
      <body className="min-h-screen font-body text-ink antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
