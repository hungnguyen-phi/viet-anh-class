import {defineRouting} from 'next-intl/routing';

// Song ngữ Việt–Anh; vi là mặc định, URL sạch (không prefix cho vi), 'en' có prefix /en.
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
});
