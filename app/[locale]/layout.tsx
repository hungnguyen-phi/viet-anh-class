import type {Metadata} from 'next';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Montserrat, Be_Vietnam_Pro, Baloo_2, Nunito} from 'next/font/google';
import {routing} from '@/i18n/routing';
import '../globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

// Font vui, bo tròn cho trải nghiệm học sinh (Baloo 2 heading + Nunito body).
// Baloo 2 có subset 'vietnamese' — hiển thị đủ dấu tiếng Việt.
const fredoka = Baloo_2({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
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

  return (
    <html
      lang={locale}
      className={`${montserrat.variable} ${beVietnam.variable} ${fredoka.variable} ${nunito.variable}`}
    >
      <body className="min-h-screen bg-canvas font-body text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
