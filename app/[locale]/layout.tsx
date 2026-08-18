import type {Metadata} from 'next';
import {Suspense} from 'react';
import {TopProgress} from '@/components/shell/TopProgress';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {SITE_URL, SCHOOL} from '@/lib/site';
import {KhoaLanChuotTrenSo} from '@/components/ui/KhoaLanChuotTrenSo';
import '../globals.css';

// Design system v3: Baloo 2 (display) + Nunito (body). Từ 17/08/2026 font TỰ CHỨA — @font-face khai
// trong app/globals.css, tệp ở public/fonts — không còn next/font/google (build từng đỏ hai lần vì
// runner không tải được fonts.gstatic.com).
const DESCRIPTION = 'App lãnh đạo lớp học theo khung 4DX — Trường Việt Anh';

// Namespace mà BUNDLE CLIENT cần (xem chỗ dùng ở dưới, và chốt chặn ở
// scripts/test-client-namespaces.mjs). 18/27 — chín cái còn lại chỉ được đọc bằng
// getTranslations() trong server component nên không phải gửi xuống trình duyệt.
const NAMESPACE_CHO_CLIENT = [
  'admin',
  'attendance',
  'campusReport',
  'common',
  'gallery',
  'goal',
  'grades',
  'inbox',
  'login',
  'meeting',
  'menu',
  'nav',
  'pdr',
  'roles',
  'roster',
  'student',
  'subjects',
  'wig',
] as const;

export const metadata: Metadata = {
  // metadataBase để canonical/OG sinh URL tuyệt đối; thiếu nó Next chỉ ra đường dẫn tương đối.
  metadataBase: new URL(SITE_URL),
  title: {default: SCHOOL.appName, template: `%s · ${SCHOOL.appName}`},
  description: DESCRIPTION,
  applicationName: SCHOOL.appName,
  // Bản vi là canonical; khai cả hai ngôn ngữ để không bị coi là trùng nội dung.
  alternates: {
    canonical: '/vi',
    languages: {vi: '/vi', en: '/en'},
  },
  openGraph: {
    type: 'website',
    siteName: SCHOOL.appName,
    title: `${SCHOOL.appName} — ${SCHOOL.name}`,
    description: DESCRIPTION,
    url: '/vi',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    images: [{url: '/logo-viet-anh.jpg', alt: `Logo ${SCHOOL.name}`}],
  },
  twitter: {card: 'summary', title: SCHOOL.appName, description: DESCRIPTION},
  icons: {
    icon: [
      {url: '/favicon.ico', sizes: '48x48'},
      {url: '/favicon.svg', type: 'image/svg+xml'},
    ],
    // CHƯA có apple-touch-icon.png thật trong public/ → dùng tạm .jpg. iOS muốn icon đẹp khi
    // "Add to Home Screen" thì cần PNG 180x180; xuất từ logo gốc rồi thay đường dẫn này.
    apple: [{url: '/logo-viet-anh.jpg'}],
  },
  manifest: '/manifest.webmanifest',
  // Sau đăng nhập là dữ liệu trẻ em → không mời bot. robots.ts chặn theo đường dẫn, còn đây là
  // lớp thứ hai ở cấp thẻ meta.
  robots: {index: true, follow: true},
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
  //
  // CHỈ GỬI NHỮNG NAMESPACE CLIENT THẬT SỰ DÙNG. Cả danh mục là 44,8 KB và nó được nhúng vào
  // MỌI trang — đo được 43% HTML thô của trang /report, trong khi phụ huynh ở đó không dùng một
  // câu nào của `grades`/`subjects`/`student`. Server component đọc chuỗi qua getTranslations()
  // (context phía máy chủ), không cần gói này; chỉ useTranslations() trong bundle client mới cần.
  //
  // Danh sách dưới đây KHÔNG được sửa bằng tay theo cảm tính: scripts/test-client-namespaces.mjs
  // dựng lại nó từ đồ thị import (mọi file 'use client' rồi lan theo import) và báo SAI nếu thiếu
  // — thiếu một namespace ở đây là lỗi lúc CHẠY, không phải lỗi lúc dịch, nên phải có chốt chặn.
  const tatCa = await getMessages();
  const messages = Object.fromEntries(
    NAMESPACE_CHO_CLIENT.filter((n) => n in tatCa).map((n) => [n, tatCa[n as keyof typeof tatCa]]),
  );

  return (
    <html lang={locale}>
      <body className="min-h-screen font-body text-ink antialiased">
        {/* Đặt ở lớp ngoài cùng vì nó che MỌI ô số của app, kể cả ô nằm trong server component
            — chỗ không gắn được onWheel. Xem ghi chú trong chính file ấy. */}
        <KhoaLanChuotTrenSo />
        <NextIntlClientProvider messages={messages}>
          <Suspense fallback={null}>
            <TopProgress />
          </Suspense>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
