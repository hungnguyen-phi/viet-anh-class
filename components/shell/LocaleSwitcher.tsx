'use client';

import {useTransition} from 'react';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

// Nút chuyển ngôn ngữ vi <-> en, giữ nguyên đường dẫn hiện tại.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const other = locale === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      aria-label="Switch language"
      disabled={isPending}
      onClick={() =>
        startTransition(() => router.replace(pathname, {locale: other}))
      }
      className="cursor-pointer rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
    >
      {locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}
